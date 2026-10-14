/**
 * The v2 batch driver: takes one ownership group through bounded sessions with
 * deterministic checks between them (docs/map-authoring/l2-pipeline-v2.md).
 * Every effect outside the files it names goes through `Env`, so the flow is
 * testable without Claude or the real repository. Development tooling only.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { recordSpans, withoutRecords, withoutRegistryEntries } from "../l2/campaign.ts";
import {
  acceptanceProblems, advance, allowedTools, applyClaimFixes, applyPatches, coverageComplete, escalationReasons, newBatch, openDefects, outsideRecords, parseJson, planReviewProblems, recordDefects,
  reviewProblems, stopBatch, unresolved, verifyProblems, weighted,
  type BatchState, type ConceptFacts, type Defect, type LedgerEntry, type PlanReviewOutput, type ReviewOutput, type Role, type VerifyOutput,
} from "./core.ts";
import type { SessionResult } from "./claude.ts";

export type Signal = { id: string; detail: string };
export type Env = {
  root: string;
  now(): string;
  /** A fresh token tying a session's output file to that session. */
  token(): string;
  /** One bounded Claude session; `resume` continues an earlier one. Rejects on any failure. */
  session(request: { role: Role; prompt: string; resume?: string; tools: readonly string[] }): Promise<SessionResult>;
  /** Plan and work problems for the group (`l2 check --group`); with records, also generate and the focused tests. */
  check(group: string, withRecords: boolean): Promise<string[]>;
  /** Creates the group's plan skeleton (`l2 territory <group> --write`) when it has none. */
  ensureSkeleton(group: string): Promise<string[]>;
  signals(conceptId: string): Promise<Signal[]>;
  groupSignals(group: string): Promise<Signal[]>;
  context(conceptId: string): Promise<string>;
  territory(group: string): Promise<string>;
  facts(conceptId: string): Promise<ConceptFacts>;
  /** Paths that differ from HEAD, including untracked files (never ignored ones). */
  changedPaths(): Promise<string[]>;
  /** A path's content at HEAD, or undefined when HEAD has none. */
  headContent(path: string): Promise<string | undefined>;
};

export const DATA = "src/lib/map/data.ts";
export const REGISTRY = "src/lib/map/authoring/content-registry.ts";
export const groupPath = (group: string) => `src/lib/map/authoring/l2/groups/${group}.json`;
export const V2_ROOT = ".map-authoring/l2v2";
export const batchDir = (slice: string, group: string) => join(V2_ROOT, slice, group);
export const LEDGER = join(V2_ROOT, "ledger.jsonl");
export const PROMPTS = "scripts/l2v2/prompts";
/** Verified repair rounds per review before a concept is parked. */
export const MAX_ROUNDS = 2;

// ---------------------------------------------------------------- files and lock

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
export function saveBatch(root: string, state: BatchState) {
  const path = join(root, batchDir(state.slice, state.group), "state.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
}

/** One driver per checkout: a second refuses, and a lock left by a dead process is reported, never stolen. */
export function acquireLock(root: string, pid = process.pid): () => void {
  const path = join(root, V2_ROOT, "lock");
  mkdirSync(dirname(path), { recursive: true });
  try {
    const fd = openSync(path, "wx");
    writeFileSync(fd, String(pid));
    closeSync(fd);
  } catch {
    const holder = Number(readFileSync(path, "utf8"));
    let alive = false;
    try {
      process.kill(holder, 0);
      alive = true;
    } catch {
      alive = false;
    }
    throw new Error(alive ? `another driver (pid ${holder}) holds ${path}` : `a stale lock from pid ${holder} remains at ${path}: check no driver is running, then remove it`);
  }
  return () => {
    if (existsSync(path) && readFileSync(path, "utf8") === String(pid)) unlinkSync(path);
  };
}

function prompt(env: Env, role: string, vars: Record<string, string>): string {
  let text = read(env, join(PROMPTS, `${role}.md`));
  for (const [key, value] of Object.entries(vars)) text = text.split(`{{${key}}}`).join(value);
  return text;
}

export class GuardError extends Error {}

// ---------------------------------------------------------------- batch operations

export type BatchInput = { slice: string; group: string; concepts: readonly string[]; protectedIds: ReadonlySet<string> };
type Snapshot = Map<string, string | undefined>;

/** The operations a batch is made of, sharing its state; used by runBatch and by repairs after a deep audit. */
function batchOps(env: Env, input: BatchInput, initial: BatchState) {
  const { slice, group, concepts, protectedIds } = input;
  const dir = batchDir(slice, group);
  let state = initial;
  const save = (next: BatchState) => (saveBatch(env.root, next), (state = next));
  const stop = (reason: string) => save(stopBatch(state, reason, env.now()));
  const batch = new Set(concepts);
  const vars = { GROUP: group, SLICE: slice, CONCEPTS: concepts.join(", "), DIR: dir, PACK: join(dir, "pack.md"), RUBRIC: join(PROMPTS, "rubric.md"), RULES: join(PROMPTS, "rules.md") };

  // -------- integrity: every tracked or untracked change a session makes is accounted for, or rolled back

  async function snapshot(): Promise<Snapshot> {
    const paths = new Set([...(await env.changedPaths()), DATA, REGISTRY, groupPath(group)]);
    return new Map([...paths].map((path) => [path, readIf(env, path)]));
  }
  async function expected(before: Snapshot, path: string) {
    return before.has(path) ? before.get(path) : env.headContent(path);
  }
  /** Restores every path changed since `before` (and only those): pre-existing user changes come back as they were. */
  async function rollback(before: Snapshot) {
    const failures: string[] = [];
    for (const path of new Set([...before.keys(), ...(await env.changedPaths())])) {
      const want = await expected(before, path);
      const now = readIf(env, path);
      if (now === want) continue;
      try {
        if (want === undefined) rmSync(join(env.root, path));
        else write(env, path, want);
      } catch (error) {
        failures.push(`${path}: ${(error as Error).message}`);
      }
    }
    if (failures.length) throw new GuardError(`rollback incomplete, manual recovery required: ${failures.join("; ")}`);
  }
  /** Changes a session may make: its allowed files, and in data.ts only its batch's records. */
  async function violations(before: Snapshot, allowed: ReadonlySet<string>): Promise<string[]> {
    const found: string[] = [];
    for (const path of new Set([...before.keys(), ...(await env.changedPaths())])) {
      if ((await expected(before, path)) !== readIf(env, path) && !allowed.has(path)) found.push(path);
    }
    if (allowed.has(DATA)) {
      const was = (await expected(before, DATA)) ?? "";
      const is = readIf(env, DATA) ?? "";
      if (outsideRecords(was, concepts) !== outsideRecords(is, concepts)) found.push(`${DATA} outside this batch's records (taxonomy, placements or other records)`);
    }
    if (allowed.has(REGISTRY)) {
      const was = ((await expected(before, REGISTRY)) ?? "").split("\n");
      const is = (readIf(env, REGISTRY) ?? "").split("\n");
      if (was.some((line) => !is.includes(line)) || is.some((line) => !was.includes(line) && !concepts.some((id) => line === `  "${id}",`))) found.push(`${REGISTRY} entries outside this batch`);
    }
    return found;
  }

  async function session(role: Role, text: string, allowed: ReadonlySet<string>, resume?: string): Promise<SessionResult> {
    const before = await snapshot();
    let result: SessionResult;
    try {
      result = await env.session({ role, prompt: text, resume, tools: allowedTools(role, group, dir) });
    } catch (error) {
      appendLedger(env.root, { kind: "session-failed", at: env.now(), slice, group, role, reason: (error as Error).message.slice(0, 300) });
      // Whatever a failed session changed is undone, so a resume starts from the last completed step.
      await rollback(before);
      throw error;
    }
    appendLedger(env.root, { kind: "session", at: env.now(), slice, group, role, sessionId: result.sessionId, durationMs: result.durationMs, turns: result.turns, usage: result.usage, weighted: result.usage ? weighted(result.usage) : null });
    state.sessions[role] = result.sessionId;
    save(state);
    const found = await violations(before, allowed);
    if (found.length) {
      await rollback(before);
      throw new GuardError(`${role} changed what it may not (rolled back): ${found.join(", ")}`);
    }
    return result;
  }

  /** A session that must write a JSON file stamped with its run token; a stale file is removed first and never consumed. */
  async function produce<T>(role: Role, file: string, template: string, extra: Record<string, string>, problemsOf: (value: unknown, run: string) => string[], resume?: string): Promise<T | undefined> {
    const out = join(dir, file);
    rmSync(join(env.root, out), { force: true });
    const run = env.token();
    let result = await session(role, prompt(env, template, { ...vars, ...extra, OUT: out, RUN: run }), new Set(), resume);
    for (let attempt = 0; ; attempt++) {
      const raw = readIf(env, out);
      let problems: string[];
      let value: unknown;
      try {
        value = raw === undefined ? undefined : parseJson(raw);
        problems = value === undefined ? [`${file} was not written`] : problemsOf(value, run);
      } catch (error) {
        problems = [`${file} is not valid JSON: ${(error as Error).message}`];
      }
      if (!problems.length) return value as T;
      if (attempt === 1) {
        stop(`${role}: ${file} unusable: ${problems.slice(0, 5).join("; ")}`);
        return undefined;
      }
      result = await session(role, `Your output file ${out} is not usable:\n- ${problems.join("\n- ")}\nRewrite it exactly per the schema, with "run": "${run}", then stop.`, new Set(), result.sessionId);
    }
  }

  /** Validation after an editing session; one fix round, then the step is rolled back and the batch stops. */
  async function checked(role: Role, withRecords: boolean, sessionId: string, allowed: ReadonlySet<string>, stepStart: Snapshot): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const problems = await env.check(group, withRecords);
      if (!problems.length) return true;
      if (attempt === 1) {
        await rollback(stepStart);
        stop(`${role}: validation still fails (rolled back): ${problems.slice(0, 5).join("; ")}`);
        return false;
      }
      await session(role, `Validation failed:\n- ${problems.join("\n- ")}\nFix exactly these problems within your files, re-run the check, then stop.`, allowed, sessionId);
    }
    return false;
  }

  const signalBlock = async () => {
    const lines: string[] = [];
    for (const id of concepts) if (state.conceptStates[id].state !== "parked") for (const s of await env.signals(id)) lines.push(`${id} | ${s.id} | ${s.detail}`);
    for (const s of await env.groupSignals(group)) lines.push(`GROUP | ${s.id} | ${s.detail}`);
    return lines.join("\n") || "(none)";
  };

  function park(id: string, reason: string) {
    state.conceptStates[id] = { ...state.conceptStates[id], state: "parked", parkReason: reason };
    save(state);
  }

  /**
   * Applies the open defects exactly, then has the reviewer that found them
   * (its session resumed) answer each one by id and re-read the changed
   * passages. Only an applied repair confirmed fixed, or a defect withdrawn
   * with a reason, closes; what stays open after the rounds parks its concept.
   */
  async function repairLoop(role: Role, reviewed: readonly string[], prefix: string): Promise<boolean> {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const unresolvedNow = reviewed.flatMap((id) => openDefects(state, id));
      if (!unresolvedNow.length) break;
      const toApply = unresolvedNow.filter((d) => d.status === "open");
      const beforeData = read(env, DATA);
      const patched = applyPatches(beforeData, toApply.map((d) => d.finding), protectedIds);
      write(env, DATA, patched.source);
      patched.results.forEach((r, index) => {
        const defect = state.defects[toApply[index].id];
        defect.status = r.applied ? "applied" : "refused";
        if (!r.applied) defect.why = r.problem;
      });
      save(state);
      const broken = await env.check(group, true);
      if (broken.length) {
        write(env, DATA, beforeData);
        stop(`${role}: a repair broke validation (repairs rolled back): ${broken.slice(0, 3).join("; ")}`);
        return false;
      }
      const pending: Record<string, string[]> = {};
      for (const id of reviewed) pending[id] = openDefects(state, id).map((d) => d.id);
      const report = reviewed.flatMap((id) => openDefects(state, id)).map((d) => `- ${d.id} (${d.concept}) [${d.status === "applied" ? "applied" : `NOT applied: ${d.why}`}] "${d.finding.quote}" -> "${d.finding.replacement}"`).join("\n");
      const verified = await produce<VerifyOutput>(role, `verify-${prefix}-${round}.json`, "verify", { REPORT: report, REVIEWED: reviewed.join(", "), SIGNALS: await signalBlock() }, (value, run) => verifyProblems(value, reviewed, pending, run), state.sessions[role]);
      if (!verified) return false;
      for (const id of reviewed) {
        const v = verified.concepts[id];
        state.audit[id].notes.push(`${role} verification ${round}: ${v.note}`);
        if (v.resolutions.length) state.audit[id].resolutions = v.resolutions;
        const added = recordDefects(state, v.findings, `${prefix}-${round}-${id}`);
        for (const answer of v.defects ?? []) {
          const defect = state.defects[answer.id];
          if (!defect || defect.concept !== id) continue;
          if (answer.status === "fixed" && defect.status === "applied") defect.status = "verified";
          else if (answer.status === "withdrawn") Object.assign(defect, { status: "withdrawn", why: answer.why });
          // An open answer is superseded by the new findings, which carry the defect forward under new ids.
          else if (answer.status === "open" && added.length) Object.assign(defect, { status: "withdrawn", why: `superseded by ${added.map((d) => d.id).join(", ")}` });
          // A refused repair cannot be confirmed fixed: it stays open until superseded or withdrawn.
        }
        if (v.verdict === "defect" && !openDefects(state, id).length) park(id, `${role} verification ${round} reported a defect it did not name`);
      }
      save(state);
    }
    for (const id of reviewed) if (state.conceptStates[id].state === "open" && openDefects(state, id).length) park(id, `${role}: defects remain after ${MAX_ROUNDS} verified repair rounds: ${openDefects(state, id).map((d) => d.id).join(", ")}`);
    return true;
  }

  return { get state() { return state; }, save, stop, session, produce, checked, snapshot, rollback, signalBlock, repairLoop, park, vars, dir, batch };
}

// ---------------------------------------------------------------- the batch

export async function runBatch(env: Env, input: BatchInput): Promise<BatchState> {
  const { slice, group, concepts, protectedIds } = input;
  const overlap = concepts.filter((id) => protectedIds.has(id));
  if (overlap.length) throw new Error(`batch ${group} includes protected concepts ${overlap.join(", ")}`);
  const ops = batchOps(env, input, loadBatch(env.root, slice, group) ?? newBatch(slice, group, concepts, env.now()));
  ops.save(ops.state);
  const { dir, vars } = ops;
  const groupFile = new Set([groupPath(group)]);
  const records = new Set([DATA, REGISTRY]);
  try {
    if (ops.state.status === "stopped" || ops.state.status === "accepted") return ops.state;

    if (ops.state.status === "pending") {
      const start = await ops.snapshot();
      const skeleton = await env.ensureSkeleton(group);
      if (skeleton.length) return ops.stop(`plan skeleton: ${skeleton.join("; ")}`);
      const pack = [`# Batch ${group} (slice ${slice})`, "", "## Territory plan", "```json", await env.territory(group), "```"];
      for (const id of concepts) pack.push("", `## Context: ${id}`, "```json", await env.context(id), "```");
      write(env, join(dir, "pack.md"), `${pack.join("\n")}\n`);
      const result = await ops.session("plan", prompt(env, "plan", vars), groupFile);
      const planStop = result.text.match(/STOP:\s*(.+)/);
      if (planStop) {
        await ops.rollback(start);
        return ops.stop(`plan: ${planStop[1].slice(0, 300)}`);
      }
      if (!(await ops.checked("plan", false, result.sessionId, groupFile, start))) return ops.state;
      ops.save(advance(ops.state, "planned", env.now()));
    }

    if (ops.state.status === "planned") {
      const review = await ops.produce<PlanReviewOutput>("plan-review", "plan-review.json", "plan-review", {}, (value, run) => planReviewProblems(value, concepts, run));
      if (!review) return ops.state;
      if (review.verdict === "stop") return ops.stop(`plan review: ${review.stopReason}`);
      if (review.claimFixes.length) {
        const before = read(env, groupPath(group));
        const fixed = applyClaimFixes(before, review.claimFixes);
        if (fixed.problems.length) return ops.stop(`plan review fixes did not apply: ${fixed.problems.join("; ")}`);
        write(env, groupPath(group), fixed.text);
        const problems = await env.check(group, false);
        if (problems.length) {
          write(env, groupPath(group), before);
          return ops.stop(`the corrected plan fails validation (rolled back): ${problems.slice(0, 3).join("; ")}`);
        }
        // The reviewer verifies its own claim fixes in the resumed session before drafting.
        const verdict = await ops.produce<PlanReviewOutput>("plan-review", "plan-verify.json", "plan-verify", { FIXES: review.claimFixes.map((f) => `- ${f.concept}: "${f.quote}" -> "${f.replacement}"`).join("\n") }, (value, run) => planReviewProblems(value, concepts, run), ops.state.sessions["plan-review"]);
        if (!verdict) return ops.state;
        if (verdict.verdict !== "pass") {
          write(env, groupPath(group), before);
          return ops.stop(`plan review did not confirm its claim fixes (rolled back): ${verdict.stopReason ?? verdict.note}`);
        }
        for (const fix of review.claimFixes) ops.state.conceptStates[fix.concept].reasons.push("a plan claim was corrected");
      }
      ops.save(advance(ops.state, "plan-reviewed", env.now()));
    }

    if (ops.state.status === "plan-reviewed") {
      // A draft interrupted earlier leaves partial records: start the draft clean (never touching protected content).
      const leftovers = concepts.filter((id) => recordSpans(read(env, DATA)).has(id));
      if (leftovers.length) {
        write(env, DATA, withoutRecords(read(env, DATA), leftovers));
        write(env, REGISTRY, withoutRegistryEntries(read(env, REGISTRY), leftovers));
      }
      const start = await ops.snapshot();
      const result = await ops.session("draft", prompt(env, "draft", vars), records);
      if (!(await ops.checked("draft", true, result.sessionId, records, start))) return ops.state;
      const data = read(env, DATA);
      const registry = read(env, REGISTRY);
      const wrong = concepts.filter((id) => data.split(`id: "${id}-content",`).length - 1 !== 1 || registry.split(`  "${id}",`).length - 1 !== 1);
      if (wrong.length) {
        await ops.rollback(start);
        return ops.stop(`draft: records or registry entries not exactly once (rolled back): ${wrong.join(", ")}`);
      }
      ops.save(advance(ops.state, "drafted", env.now()));
    }

    if (ops.state.status === "drafted") {
      const open = concepts.filter((id) => ops.state.conceptStates[id].state === "open");
      const review = await ops.produce<ReviewOutput>("review", "review.json", "review", { SIGNALS: await ops.signalBlock() }, (value, run) => reviewProblems(value, open, { group: true, run }));
      if (!review) return ops.state;
      for (const id of open) {
        const r = review.concepts[id];
        ops.state.audit[id] = { notes: [`review: ${r.note}`], resolutions: r.resolutions };
        const reasons = escalationReasons(r, await env.facts(id), ops.state.conceptStates[id].reasons.includes("a plan claim was corrected"));
        ops.state.conceptStates[id] = { ...ops.state.conceptStates[id], escalate: reasons.length > 0, reasons: [...ops.state.conceptStates[id].reasons, ...reasons], lastReview: { by: "review", verdict: r.verdict, confidence: r.confidence, coverageComplete: coverageComplete(r.coverage) } };
        recordDefects(ops.state, r.findings, `review-${id}`);
      }
      recordDefects(ops.state, review.group!.findings, "review-group");
      ops.state.groupAudit = { note: review.group!.note, resolutions: review.group!.resolutions };
      ops.save(ops.state);
      if (!(await ops.repairLoop("review", open, "review"))) return ops.state;
      ops.save(advance(ops.state, "reviewed", env.now()));
    }

    if (ops.state.status === "reviewed") {
      const escalated = concepts.filter((id) => ops.state.conceptStates[id].state === "open" && ops.state.conceptStates[id].escalate);
      if (escalated.length) {
        const why = escalated.map((id) => `- ${id}: ${ops.state.conceptStates[id].reasons.join("; ")}`).join("\n");
        const review = await ops.produce<ReviewOutput>("escalate", "escalate.json", "escalate", { ESCALATED: escalated.join(", "), WHY: why, SIGNALS: await ops.signalBlock() }, (value, run) => reviewProblems(value, escalated, { group: false, run }));
        if (!review) return ops.state;
        for (const id of escalated) {
          const r = review.concepts[id];
          ops.state.audit[id].notes.push(`second review: ${r.note}`);
          if (r.resolutions.length) ops.state.audit[id].resolutions = r.resolutions;
          ops.state.conceptStates[id].lastReview = { by: "escalate", verdict: r.verdict, confidence: r.confidence, coverageComplete: coverageComplete(r.coverage) };
          recordDefects(ops.state, r.findings, `escalate-${id}`);
        }
        ops.save(ops.state);
        if (!(await ops.repairLoop("escalate", escalated, "escalate"))) return ops.state;
      }
      ops.save(advance(ops.state, "escalated", env.now()));
    }

    if (ops.state.status === "escalated") return accept(env, ops);
    return ops.state;
  } catch (error) {
    if (error instanceof GuardError) return ops.stop(error.message);
    throw error;
  }
}

/** Acceptance: every concept's gates re-checked from the batch's evidence; failures park, parked drafts leave the tree. */
async function accept(env: Env, ops: ReturnType<typeof batchOps>): Promise<BatchState> {
  const { slice, group, concepts } = ops.state;
  for (const id of concepts.filter((c) => ops.state.conceptStates[c].state === "open")) {
    const missing = unresolved((await env.signals(id)).map((s) => s.id), ops.state.audit[id].resolutions);
    const problems = [...acceptanceProblems(ops.state, id), ...(missing.length ? [`signals unresolved: ${missing.join(", ")}`] : [])];
    if (problems.length) ops.park(id, problems.join("; "));
  }
  const groupMissing = unresolved((await env.groupSignals(group)).map((s) => s.id), ops.state.groupAudit?.resolutions ?? []);
  if (groupMissing.length) return ops.stop(`group signals left unresolved: ${groupMissing.join(", ")}`);
  const parked = concepts.filter((id) => ops.state.conceptStates[id].state === "parked");
  if (parked.length) {
    // Parked drafts leave the tree; their state, findings and a copy of the drafts stay for a human.
    write(env, join(ops.dir, "parked-data.ts"), read(env, DATA));
    write(env, DATA, withoutRecords(read(env, DATA), parked.filter((id) => recordSpans(read(env, DATA)).has(id))));
    write(env, REGISTRY, withoutRegistryEntries(read(env, REGISTRY), parked));
  }
  for (const id of concepts.filter((c) => ops.state.conceptStates[c].state === "open")) {
    write(env, join(ops.dir, `audit-${id}.json`), `${JSON.stringify({ note: ops.state.audit[id].notes.join(" | "), resolutions: ops.state.audit[id].resolutions }, null, 2)}\n`);
    ops.state.conceptStates[id] = { ...ops.state.conceptStates[id], state: "accepted" };
  }
  write(env, join(ops.dir, "group-audit.json"), `${JSON.stringify(ops.state.groupAudit, null, 2)}\n`);
  appendLedger(env.root, {
    kind: "batch", at: env.now(), slice, group,
    accepted: concepts.filter((id) => ops.state.conceptStates[id].state === "accepted").length,
    parked: parked.length,
    escalated: concepts.filter((id) => ops.state.conceptStates[id].escalate).length,
    defects: Object.keys(ops.state.defects).length,
  });
  if (parked.length) return ops.stop(`parked: ${parked.map((id) => `${id} (${ops.state.conceptStates[id].parkReason})`).join("; ")}`);
  ops.save(advance(ops.state, "accepted", env.now()));
  return ops.state;
}

/**
 * A deep audit's substantive findings on a concept of an accepted, not yet
 * finalized v2 batch: the concept is reopened, the repairs are applied
 * exactly and verified by the auditor's resumed session, and the concept is
 * accepted again only through the same gates; otherwise it is parked.
 */
export async function repairAfterAudit(env: Env, input: BatchInput & { concept: string; findings: readonly Omit<Defect["finding"], "concept" | "severity">[]; auditSession: string; label: string }): Promise<BatchState> {
  const state = loadBatch(env.root, input.slice, input.group);
  if (!state || state.status !== "accepted") throw new Error(`${input.concept} is not in an accepted v2 batch of ${input.slice}: a recorded or protected record needs a controlled v1 revision (\`l2 reopen\`)`);
  if (input.protectedIds.has(input.concept) || !state.concepts.includes(input.concept) || state.conceptStates[input.concept].state !== "accepted") throw new Error(`${input.concept} cannot be repaired here`);
  const ops = batchOps(env, input, { ...state, status: "escalated" });
  ops.state.sessions["deep-audit"] = input.auditSession;
  ops.state.conceptStates[input.concept].state = "open";
  // Ids stay unique across repeated audits, so the ledger keeps every earlier defect's history.
  const prefix = `audit-${input.label}-${input.concept}-${Object.keys(ops.state.defects).length}`;
  recordDefects(ops.state, input.findings.map((f) => ({ ...f, concept: input.concept, severity: "defect" as const })), prefix);
  ops.save(ops.state);
  try {
    if (!(await ops.repairLoop("deep-audit", [input.concept], prefix))) return ops.state;
    return await accept(env, ops);
  } catch (error) {
    if (error instanceof GuardError) return ops.stop(error.message);
    throw error;
  }
}
