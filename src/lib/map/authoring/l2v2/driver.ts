/**
 * The v2 batch driver: takes one ownership group through bounded sessions with
 * deterministic checks between them (docs/map-authoring/l2-pipeline-v2.md).
 * Every effect outside the files it names goes through `Env`, so the flow is
 * testable without Claude or the real repository. Development tooling only.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { recordSpans, withoutRecords, withoutRegistryEntries } from "../l2/campaign.ts";
import {
  advance, applyClaimFixes, applyPatches, changedRecords, escalationReasons, newBatch, parseJson, planReviewProblems, reviewProblems, stopBatch, unresolved, verifyProblems, weighted,
  type BatchState, type ConceptFacts, type Finding, type LedgerEntry, type PlanReviewOutput, type ReviewOutput, type Role, type Usage, type VerifyOutput,
} from "./core.ts";

export type Signal = { id: string; detail: string };
export type SessionResult = { sessionId: string; usage: Usage; durationMs: number; turns: number; isError: boolean; text: string };
export type Env = {
  root: string;
  now(): string;
  /** One bounded Claude session; `resume` continues an earlier one (its cache stays warm). */
  session(request: { role: Role; prompt: string; resume?: string; tools: readonly string[] }): Promise<SessionResult>;
  /** Plan and work problems for the group (`l2 check --group`); with records, also generate and the focused tests. */
  check(group: string, withRecords: boolean): Promise<string[]>;
  signals(conceptId: string): Promise<Signal[]>;
  groupSignals(group: string): Promise<Signal[]>;
  context(conceptId: string): Promise<string>;
  territory(group: string): Promise<string>;
  facts(conceptId: string): Promise<ConceptFacts>;
};

export const DATA = "src/lib/map/data.ts";
export const REGISTRY = "src/lib/map/authoring/content-registry.ts";
export const groupPath = (group: string) => `src/lib/map/authoring/l2/groups/${group}.json`;
export const V2_ROOT = ".map-authoring/l2v2";
export const batchDir = (slice: string, group: string) => join(V2_ROOT, slice, group);
export const LEDGER = join(V2_ROOT, "ledger.jsonl");
export const PROMPTS = "scripts/l2v2/prompts";
/** Repair and verification rounds per role before a concept is parked. */
export const MAX_ROUNDS = 2;

const AUTHOR_TOOLS = ["Read", "Edit", "Write", "Bash(npm run map:author:*)", "Bash(npm run map:inspect:*)", "Bash(npm run -s map:author:*)", "Bash(node --test:*)", "Bash(grep:*)", "Bash(python3:*)"];
const REVIEW_TOOLS = ["Read", "Write", "Bash(npm run map:author:*)", "Bash(npm run -s map:author:*)", "Bash(npm run map:inspect:*)", "Bash(grep:*)"];

// ---------------------------------------------------------------- files

const read = (env: Env, path: string) => readFileSync(join(env.root, path), "utf8");
const readIf = (env: Env, path: string) => (existsSync(join(env.root, path)) ? read(env, path) : undefined);
function write(env: Env, path: string, text: string) {
  const full = join(env.root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(`${full}.tmp`, text);
  renameSync(`${full}.tmp`, full);
}
export function loadLedger(root: string): LedgerEntry[] {
  const path = join(root, LEDGER);
  return existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as LedgerEntry) : [];
}
export function appendLedger(root: string, entry: LedgerEntry) {
  mkdirSync(join(root, V2_ROOT), { recursive: true });
  appendFileSync(join(root, LEDGER), `${JSON.stringify(entry)}\n`);
}
export const loadBatch = (root: string, slice: string, group: string): BatchState | undefined => {
  const path = join(root, batchDir(slice, group), "state.json");
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as BatchState) : undefined;
};

function prompt(env: Env, role: string, vars: Record<string, string>): string {
  let text = read(env, join(PROMPTS, `${role}.md`));
  for (const [key, value] of Object.entries(vars)) text = text.split(`{{${key}}}`).join(value);
  return text;
}

// ---------------------------------------------------------------- the batch

export type BatchInput = { slice: string; group: string; concepts: readonly string[]; protectedIds: ReadonlySet<string> };

export async function runBatch(env: Env, input: BatchInput): Promise<BatchState> {
  const { slice, group, concepts, protectedIds } = input;
  const dir = batchDir(slice, group);
  let state = loadBatch(env.root, slice, group) ?? newBatch(slice, group, concepts, env.now());
  const save = (next: BatchState) => (write(env, join(dir, "state.json"), `${JSON.stringify(next, null, 2)}\n`), (state = next));
  save(state);
  const stop = (reason: string) => save(stopBatch(state, reason, env.now()));
  const batch = new Set(concepts);
  const vars = { GROUP: group, SLICE: slice, CONCEPTS: concepts.join(", "), DIR: dir, PACK: join(dir, "pack.md"), RUBRIC: join(PROMPTS, "rubric.md"), RULES: join(PROMPTS, "rules.md") };

  /** A session whose effects are confined to `may` (data.ts records of the batch, the registry's batch entries, the group file). */
  async function session(role: Role, text: string, may: { records: boolean; group: boolean }, resume?: string): Promise<SessionResult> {
    const before = { data: read(env, DATA), registry: read(env, REGISTRY), group: readIf(env, groupPath(group)) };
    const result = await env.session({ role, prompt: text, resume, tools: may.records || may.group ? AUTHOR_TOOLS : REVIEW_TOOLS });
    appendLedger(env.root, { kind: "session", at: env.now(), slice, group, role, sessionId: result.sessionId, durationMs: result.durationMs, turns: result.turns, usage: result.usage, weighted: weighted(result.usage) });
    state.sessions[role] = result.sessionId;
    save(state);
    const after = { data: read(env, DATA), registry: read(env, REGISTRY), group: readIf(env, groupPath(group)) };
    const outside = changedRecords(before.data, after.data, may.records ? batch : new Set());
    if (outside.length) throw new GuardError(`${role} changed records outside its batch: ${outside.join(", ")}`);
    if (!may.records && after.data !== before.data) throw new GuardError(`${role} changed data.ts`);
    if (!may.records && after.registry !== before.registry) throw new GuardError(`${role} changed the registry`);
    if (may.records) {
      const added = after.registry.split("\n").filter((line) => !before.registry.split("\n").includes(line));
      const removed = before.registry.split("\n").filter((line) => !after.registry.split("\n").includes(line));
      if (removed.length || added.some((line) => !concepts.some((id) => line === `  "${id}",`))) throw new GuardError(`${role} changed registry entries outside its batch`);
    }
    if (!may.group && after.group !== before.group) throw new GuardError(`${role} changed the group file`);
    if (result.isError) throw new GuardError(`${role} session ended in an error: ${result.text.slice(0, 200)}`);
    return result;
  }
  /** A JSON artifact the session must write; asked for once more if missing or invalid. */
  async function artifact<T>(role: Role, file: string, problemsOf: (value: unknown) => string[], sessionId: string, may = { records: false, group: false }): Promise<T | undefined> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = readIf(env, join(dir, file));
      let problems: string[];
      let value: unknown;
      try {
        value = raw === undefined ? undefined : parseJson(raw);
        problems = value === undefined ? [`${file} was not written`] : problemsOf(value);
      } catch (error) {
        problems = [`${file} is not valid JSON: ${(error as Error).message}`];
      }
      if (!problems.length) return value as T;
      if (attempt === 1) {
        stop(`${role}: ${file} unusable: ${problems.slice(0, 5).join("; ")}`);
        return undefined;
      }
      await session(role, `Your output file ${join(dir, file)} is not usable:\n- ${problems.join("\n- ")}\nRewrite it exactly per the schema, then stop.`, may, sessionId);
    }
    return undefined;
  }
  async function checked(role: Role, withRecords: boolean, sessionId: string, may: { records: boolean; group: boolean }): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const problems = await env.check(group, withRecords);
      if (!problems.length) return true;
      if (attempt === 1) {
        stop(`${role}: validation still fails: ${problems.slice(0, 5).join("; ")}`);
        return false;
      }
      await session(role, `Validation failed:\n- ${problems.join("\n- ")}\nFix exactly these problems within your files, re-run the check, then stop.`, may, sessionId);
    }
    return false;
  }
  const signalBlock = async () => {
    const lines: string[] = [];
    for (const id of concepts) if (state.conceptStates[id].state !== "parked") for (const s of await env.signals(id)) lines.push(`${id} | ${s.id} | ${s.detail}`);
    for (const s of await env.groupSignals(group)) lines.push(`GROUP | ${s.id} | ${s.detail}`);
    return lines.join("\n") || "(none)";
  };

  /** Applies defects exactly, then has the same reviewer verify the changed passages; parks what stays defective. */
  async function repairLoop(role: Role, findings: Finding[], reviewed: readonly string[]): Promise<boolean> {
    let pending = findings.filter((finding) => finding.severity === "defect");
    for (let round = 1; pending.length && round <= MAX_ROUNDS; round++) {
      state.defects += pending.length;
      const patched = applyPatches(read(env, DATA), pending, protectedIds);
      write(env, DATA, patched.source);
      for (const r of patched.results) if (r.applied) state.conceptStates[r.finding.concept].repairRounds = round;
      save(state);
      const broken = await env.check(group, true);
      if (broken.length) {
        stop(`${role}: a repair broke validation: ${broken.slice(0, 3).join("; ")}`);
        return false;
      }
      const report = patched.results.map((r) => `- ${r.finding.concept} [${r.applied ? "applied" : `NOT applied: ${r.problem}`}] "${r.finding.quote}" -> "${r.finding.replacement}"`).join("\n");
      const file = `verify-${role}-${round}.json`;
      const sessionId = state.sessions[role]!;
      await session(role, prompt(env, "verify", { ...vars, REPORT: report, OUT: join(dir, file), REVIEWED: reviewed.join(", "), SIGNALS: await signalBlock() }), { records: false, group: false }, sessionId);
      const verified = await artifact<VerifyOutput>(role, file, (value) => verifyProblems(value, reviewed), sessionId);
      if (!verified) return false;
      pending = [];
      for (const id of reviewed) {
        const v = verified.concepts[id];
        state.audit[id].notes.push(`${role} verification ${round}: ${v.note}`);
        if (v.resolutions.length) state.audit[id].resolutions = v.resolutions;
        const defects = v.findings.filter((finding) => finding.severity === "defect");
        if (v.verdict === "defect" && !defects.length) park(id, `${role} verification ${round} found a defect without an exact repair`);
        pending.push(...defects);
      }
      save(state);
    }
    for (const id of new Set(pending.map((finding) => finding.concept))) park(id, `${role}: defects remain after ${MAX_ROUNDS} verified repair rounds`);
    return true;
  }
  function park(id: string, reason: string) {
    state.conceptStates[id] = { ...state.conceptStates[id], state: "parked", parkReason: reason };
    save(state);
  }

  try {
    if (state.status === "stopped" || state.status === "accepted") return state;

    if (state.status === "pending") {
      const pack = [`# Batch ${group} (slice ${slice})`, "", "## Territory plan", "```json", await env.territory(group), "```"];
      for (const id of concepts) pack.push("", `## Context: ${id}`, "```json", await env.context(id), "```");
      write(env, join(dir, "pack.md"), `${pack.join("\n")}\n`);
      const result = await session("plan", prompt(env, "plan", vars), { records: false, group: true });
      const planStop = result.text.match(/STOP:\s*(.+)/);
      if (planStop) return stop(`plan: ${planStop[1].slice(0, 300)}`);
      if (!(await checked("plan", false, result.sessionId, { records: false, group: true }))) return state;
      save(advance(state, "planned", env.now()));
    }

    if (state.status === "planned") {
      const result = await session("plan-review", prompt(env, "plan-review", { ...vars, OUT: join(dir, "plan-review.json") }), { records: false, group: false });
      const review = await artifact<PlanReviewOutput>("plan-review", "plan-review.json", (value) => planReviewProblems(value, concepts), result.sessionId);
      if (!review) return state;
      if (review.verdict === "stop") return stop(`plan review: ${review.stopReason}`);
      if (review.claimFixes.length) {
        const fixed = applyClaimFixes(read(env, groupPath(group)), review.claimFixes);
        if (fixed.problems.length) return stop(`plan review fixes did not apply: ${fixed.problems.join("; ")}`);
        write(env, groupPath(group), fixed.text);
        for (const fix of review.claimFixes) state.conceptStates[fix.concept].reasons.push("a plan claim was corrected");
        const problems = await env.check(group, false);
        if (problems.length) return stop(`the corrected plan fails validation: ${problems.slice(0, 3).join("; ")}`);
      }
      save(advance(state, "plan-reviewed", env.now()));
    }

    if (state.status === "plan-reviewed") {
      // A draft interrupted earlier leaves partial records: start the draft clean (never touching accepted content).
      const leftovers = concepts.filter((id) => recordSpans(read(env, DATA)).has(id) && !protectedIds.has(id));
      if (leftovers.length) {
        write(env, DATA, withoutRecords(read(env, DATA), leftovers));
        write(env, REGISTRY, withoutRegistryEntries(read(env, REGISTRY), leftovers));
      }
      const result = await session("draft", prompt(env, "draft", vars), { records: true, group: false });
      if (!(await checked("draft", true, result.sessionId, { records: true, group: false }))) return state;
      const spans = recordSpans(read(env, DATA));
      const missing = concepts.filter((id) => !spans.has(id));
      const doubled = concepts.filter((id) => read(env, DATA).split(`id: "${id}-content",`).length - 1 !== 1 || read(env, REGISTRY).split(`  "${id}",`).length - 1 !== 1);
      if (missing.length || doubled.length) return stop(`draft: missing ${missing.join(", ") || "none"}; not exactly once ${doubled.join(", ") || "none"}`);
      save(advance(state, "drafted", env.now()));
    }

    if (state.status === "drafted") {
      const open = concepts.filter((id) => state.conceptStates[id].state === "open");
      const result = await session("review", prompt(env, "review", { ...vars, OUT: join(dir, "review.json"), SIGNALS: await signalBlock() }), { records: false, group: false });
      const review = await artifact<ReviewOutput>("review", "review.json", (value) => reviewProblems(value, open, { group: true }), result.sessionId);
      if (!review) return state;
      for (const id of open) {
        const r = review.concepts[id];
        state.audit[id] = { notes: [`review: ${r.note}`], resolutions: r.resolutions };
        const reasons = escalationReasons(r, await env.facts(id), state.conceptStates[id].reasons.includes("a plan claim was corrected"));
        state.conceptStates[id] = { ...state.conceptStates[id], escalate: reasons.length > 0, reasons: [...state.conceptStates[id].reasons, ...reasons] };
      }
      state.groupAudit = { note: review.group!.note, resolutions: review.group!.resolutions };
      save(state);
      const findings = [...open.flatMap((id) => review.concepts[id].findings), ...review.group!.findings];
      if (!(await repairLoop("review", findings, open))) return state;
      save(advance(state, "reviewed", env.now()));
    }

    if (state.status === "reviewed") {
      const escalated = concepts.filter((id) => state.conceptStates[id].state === "open" && state.conceptStates[id].escalate);
      if (escalated.length) {
        const why = escalated.map((id) => `- ${id}: ${state.conceptStates[id].reasons.join("; ")}`).join("\n");
        const result = await session("escalate", prompt(env, "escalate", { ...vars, OUT: join(dir, "escalate.json"), ESCALATED: escalated.join(", "), WHY: why, SIGNALS: await signalBlock() }), { records: false, group: false });
        const review = await artifact<ReviewOutput>("escalate", "escalate.json", (value) => reviewProblems(value, escalated, { group: false }), result.sessionId);
        if (!review) return state;
        for (const id of escalated) {
          state.audit[id].notes.push(`second review: ${review.concepts[id].note}`);
          if (review.concepts[id].resolutions.length) state.audit[id].resolutions = review.concepts[id].resolutions;
        }
        save(state);
        if (!(await repairLoop("escalate", escalated.flatMap((id) => review.concepts[id].findings), escalated))) return state;
      }
      save(advance(state, "escalated", env.now()));
    }

    if (state.status === "escalated") {
      // Every signal must be answered by a review of the record as it now stands.
      for (const id of concepts.filter((c) => state.conceptStates[c].state === "open")) {
        const missing = unresolved((await env.signals(id)).map((s) => s.id), state.audit[id].resolutions);
        if (missing.length) park(id, `signals left unresolved after the last review: ${missing.join(", ")}`);
      }
      const groupMissing = unresolved((await env.groupSignals(group)).map((s) => s.id), state.groupAudit?.resolutions ?? []);
      if (groupMissing.length) return stop(`group signals left unresolved: ${groupMissing.join(", ")}`);
      const parked = concepts.filter((id) => state.conceptStates[id].state === "parked");
      if (parked.length) {
        // Parked drafts leave the published tree; their state and findings stay for a human.
        write(env, join(dir, "parked-data.ts"), read(env, DATA));
        write(env, DATA, withoutRecords(read(env, DATA), parked.filter((id) => recordSpans(read(env, DATA)).has(id))));
        write(env, REGISTRY, withoutRegistryEntries(read(env, REGISTRY), parked));
      }
      for (const id of concepts.filter((c) => state.conceptStates[c].state === "open")) {
        write(env, join(dir, `audit-${id}.json`), `${JSON.stringify({ note: state.audit[id].notes.join(" | "), resolutions: state.audit[id].resolutions }, null, 2)}\n`);
        state.conceptStates[id] = { ...state.conceptStates[id], state: "accepted" };
      }
      write(env, join(dir, "group-audit.json"), `${JSON.stringify(state.groupAudit, null, 2)}\n`);
      appendLedger(env.root, {
        kind: "batch", at: env.now(), slice, group,
        accepted: concepts.filter((id) => state.conceptStates[id].state === "accepted").length,
        parked: parked.length,
        escalated: concepts.filter((id) => state.conceptStates[id].escalate).length,
        defects: state.defects,
      });
      if (parked.length) return stop(`parked with unresolved defects: ${parked.map((id) => `${id} (${state.conceptStates[id].parkReason})`).join("; ")}`);
      save(advance(state, "accepted", env.now()));
    }
    return state;
  } catch (error) {
    if (error instanceof GuardError) return stop(error.message);
    throw error;
  }
}

export class GuardError extends Error {}
