/**
 * The v2 batch driver: takes one ownership group through bounded sessions with
 * deterministic checks between them (docs/map-authoring/l2-pipeline-v2.md).
 * Every effect outside the files it names goes through `Env`, so the flow is
 * testable without Claude or the real repository. Sessions never write
 * TypeScript: drafts are staged as JSON, and only this driver renders them
 * into data.ts and the registry (records.ts). Development tooling only.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { recordSpans, withoutRecords, withoutRegistryEntries } from "../l2/campaign.ts";
import {
  acceptanceProblems, advance, applyClaimFixes, applyPatches, allowedTools, coverageComplete, escalationReasons, newBatch, openDefects, parseJson, planReviewProblems, recordDefects,
  reviewProblems, stopBatch, unresolved, verifyProblems, weighted,
  type BatchState, type ConceptFacts, type Defect, type LedgerEntry, type PlanReviewOutput, type ReviewOutput, type Role, type VerifyOutput,
} from "./core.ts";
import { recordFingerprint, recordsInPlaceProblems, recordStrings, renderedProblems, secretProblems, stagedRecordsProblems, toContent, withRecords, withRegistry, type StagedRecord, type StagedRecords } from "./records.ts";
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
  /** Values of local secrets (.dev.vars, .env): never logged, only matched against what would be committed. */
  secrets(): Promise<string[]>;
};

export const DATA = "src/lib/map/data.ts";
export const REGISTRY = "src/lib/map/authoring/content-registry.ts";
export const groupPath = (group: string) => `src/lib/map/authoring/l2/groups/${group}.json`;
/** Local run state (git-ignored): v1 runs, campaign authorizations and v2 batches. Guarded file by file around every session. */
export const LOCAL = ".map-authoring";
export const V2_ROOT = ".map-authoring/l2v2";
export const batchDir = (slice: string, group: string) => join(V2_ROOT, slice, group);
export const LEDGER = join(V2_ROOT, "ledger.jsonl");
export const PROMPTS = "scripts/l2v2/prompts";
/** Verified repair rounds per review before a concept is parked. */
export const MAX_ROUNDS = 2;

// ---------------------------------------------------------------- files and lock

const read = (env: Env, path: string) => readFileSync(join(env.root, path), "utf8");
/** Stands for a directory (such as a nested worktree): compared by presence, never read or restored. */
const DIRECTORY = "\0directory";
const readIf = (env: Env, path: string) => {
  const full = join(env.root, path);
  if (!existsSync(full)) return undefined;
  return statSync(full).isFile() ? readFileSync(full, "utf8") : DIRECTORY;
};
/** Every file under the local run state. */
function localFiles(env: Env): string[] {
  const walk = (dir: string): string[] =>
    existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(env.root, join(dir, entry.name))])) : [];
  return walk(join(env.root, LOCAL));
}
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

  let knownSecrets: string[] | undefined;
  const secrets = async () => (knownSecrets ??= await env.secrets());

  // -------- integrity: every tracked or untracked change a session makes is accounted for, or rolled back

  async function snapshot(): Promise<Snapshot> {
    const paths = new Set([...(await env.changedPaths()), DATA, REGISTRY, groupPath(group)]);
    return new Map([...paths].map((path) => [path, readIf(env, path)]));
  }
  /** The local run state is git-ignored, so it is guarded by its own snapshot: run states, authorizations, batch state. */
  const localSnapshot = (): Snapshot => new Map(localFiles(env).map((path) => [path, readIf(env, path)]));
  async function expected(before: Snapshot, path: string) {
    return before.has(path) ? before.get(path) : env.headContent(path);
  }
  async function restore(paths: Iterable<string>, want: (path: string) => Promise<string | undefined>) {
    const failures: string[] = [];
    for (const path of paths) {
      const wanted = await want(path);
      const now = readIf(env, path);
      if (now === wanted) continue;
      try {
        if (wanted === DIRECTORY || now === DIRECTORY) throw new Error("a directory is never restored automatically");
        if (wanted === undefined) rmSync(join(env.root, path));
        else write(env, path, wanted);
      } catch (error) {
        failures.push(`${path}: ${(error as Error).message}`);
      }
    }
    if (failures.length) throw new GuardError(`rollback incomplete, manual recovery required: ${failures.join("; ")}`);
  }
  /** Restores every path changed since `before` (and only those): pre-existing user changes come back as they were. */
  async function rollback(before: Snapshot) {
    await restore(new Set([...before.keys(), ...(await env.changedPaths())]), (path) => expected(before, path));
  }
  const rollbackLocal = (before: Snapshot) => restore(new Set([...before.keys(), ...localFiles(env)]), async (path) => before.get(path));
  /** Changes a session made outside its allowed files: no session may change data.ts or the registry. */
  async function violations(before: Snapshot, allowed: ReadonlySet<string>, local: Snapshot, out?: string): Promise<string[]> {
    const found: string[] = [];
    for (const path of new Set([...before.keys(), ...(await env.changedPaths())])) if ((await expected(before, path)) !== readIf(env, path) && !allowed.has(path)) found.push(path);
    for (const path of new Set([...local.keys(), ...localFiles(env)])) if (local.get(path) !== readIf(env, path) && path !== out) found.push(path);
    return found;
  }

  async function session(role: Role, text: string, allowed: ReadonlySet<string>, out?: string, resume?: string): Promise<SessionResult> {
    const before = await snapshot();
    const local = localSnapshot();
    let result: SessionResult;
    try {
      result = await env.session({ role, prompt: text, resume, tools: allowedTools(role, group, dir, out) });
    } catch (error) {
      // Whatever a failed session changed is undone, so a resume starts from the last completed step.
      await rollback(before);
      await rollbackLocal(local);
      appendLedger(env.root, { kind: "session-failed", at: env.now(), slice, group, role, reason: (error as Error).message.slice(0, 300) });
      throw error;
    }
    const found = await violations(before, allowed, local, out);
    if (found.length) {
      await rollback(before);
      await rollbackLocal(local);
    }
    // Recorded after any rollback, which restores the local state as it was before the session.
    appendLedger(env.root, { kind: "session", at: env.now(), slice, group, role, sessionId: result.sessionId, durationMs: result.durationMs, turns: result.turns, usage: result.usage, weighted: result.usage ? weighted(result.usage) : null });
    if (found.length) throw new GuardError(`${role} changed what it may not (rolled back): ${found.join(", ")}`);
    state.sessions[role] = result.sessionId;
    save(state);
    return result;
  }

  /**
   * A session that must write a JSON file stamped with its run token; a stale
   * file is removed first and never consumed. `message` replaces the role's
   * prompt (a resumed session asked to rewrite its file).
   */
  async function produce<T>(role: Role, file: string, template: string, extra: Record<string, string>, problemsOf: (value: unknown, run: string) => string[], resume?: string, message?: (out: string, run: string) => string): Promise<T | undefined> {
    const out = join(dir, file);
    rmSync(join(env.root, out), { force: true });
    const run = env.token();
    let result = await session(role, message ? message(out, run) : prompt(env, template, { ...vars, ...extra, OUT: out, RUN: run }), new Set(), out, resume);
    for (let attempt = 0; ; attempt++) {
      const raw = readIf(env, out);
      let problems: string[];
      let value: unknown;
      try {
        value = raw === undefined || raw === DIRECTORY ? undefined : parseJson(raw);
        problems = value === undefined ? [`${file} was not written`] : problemsOf(value, run);
      } catch (error) {
        problems = [`${file} is not valid JSON: ${(error as Error).message}`];
      }
      if (!problems.length) return value as T;
      if (attempt === 1) {
        stop(`${role}: ${file} unusable: ${problems.slice(0, 5).join("; ")}`);
        return undefined;
      }
      result = await session(role, `Your output file ${out} is not usable:\n- ${problems.join("\n- ")}\nRewrite it exactly per the schema, with "run": "${run}", then stop.`, new Set(), out, result.sessionId);
    }
  }

  /** Plan validation after the plan session (the group file is data); one fix round, then the step is rolled back and the batch stops. */
  async function checked(role: Role, sessionId: string, allowed: ReadonlySet<string>, stepStart: Snapshot): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const problems = [...(await env.check(group, false)), ...secretProblems([read(env, groupPath(group))], await secrets()).map((problem) => `the group file ${problem}`)];
      if (!problems.length) return true;
      if (attempt === 1) {
        await rollback(stepStart);
        stop(`${role}: validation still fails (rolled back): ${problems.slice(0, 5).join("; ")}`);
        return false;
      }
      await session(role, `Validation failed:\n- ${problems.join("\n- ")}\nFix exactly these problems within your file, re-run the check, then stop.`, allowed, undefined, sessionId);
    }
    return false;
  }

  // -------- records: validated data in, the driver's rendering out

  const batchRecords = (): StagedRecord[] => concepts.filter((id) => state.records?.[id]).map((id) => state.records![id]);
  /**
   * Renders the batch's validated records into data.ts and the registry, then
   * checks the result as text, before anything imports it: exactly the earlier
   * files plus the driver's rendering of these records.
   */
  function integrate() {
    const records = batchRecords();
    const data = { was: read(env, DATA), is: "" };
    const registry = { was: read(env, REGISTRY), is: "" };
    write(env, DATA, withRecords(data.was, records.map(toContent)));
    write(env, REGISTRY, withRegistry(registry.was, records.map((record) => record.conceptId)));
    data.is = read(env, DATA);
    registry.is = read(env, REGISTRY);
    const problems = renderedProblems(data, registry, records);
    if (problems.length) {
      write(env, DATA, data.was);
      write(env, REGISTRY, registry.was);
      throw new GuardError(`the rendered records failed their source check (restored): ${problems.join("; ")}`);
    }
  }

  /**
   * The draft: the session stages every record as JSON; the driver validates
   * it, renders it and runs the checks. One rewrite round, else the step is
   * rolled back and the batch stops.
   */
  async function draft(stepStart: Snapshot): Promise<boolean> {
    const known = await secrets();
    const valid = (value: unknown, run: string) => stagedRecordsProblems(value, concepts, run, known);
    let staged = await produce<StagedRecords>("draft", "draft.json", "draft", {}, valid);
    let problems: string[] = [];
    for (let attempt = 0; staged && attempt < 2; attempt++) {
      if (attempt) {
        staged = await produce<StagedRecords>("draft", "draft.json", "draft", {}, valid, state.sessions.draft, (out, run) => `Validation of your records failed:\n- ${problems.join("\n- ")}\nRewrite ${out} with every record corrected (the same schema, "run": "${run}"), then stop.`);
        if (!staged) break;
      }
      state.records = Object.fromEntries(staged.records.map((record) => [record.conceptId, record]));
      save(state);
      integrate();
      problems = await env.check(group, true);
      if (!problems.length) return true;
    }
    await rollback(stepStart);
    delete state.records;
    stop(`draft: ${problems.length ? `validation still fails (rolled back): ${problems.slice(0, 5).join("; ")}` : "no usable records (rolled back)"}`);
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
      const before = { records: state.records ?? {}, data: read(env, DATA), registry: read(env, REGISTRY) };
      // Repairs change the records' values, never the source: the driver renders them again.
      const patched = applyPatches(before.records, toApply.map((d) => d.finding), protectedIds, await secrets());
      state.records = patched.records;
      patched.results.forEach((r, index) => {
        const defect = state.defects[toApply[index].id];
        defect.status = r.applied ? "applied" : "refused";
        if (!r.applied) defect.why = r.problem;
      });
      save(state);
      integrate();
      const broken = await env.check(group, true);
      if (broken.length) {
        state.records = before.records;
        write(env, DATA, before.data);
        write(env, REGISTRY, before.registry);
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

  return { get state() { return state; }, save, stop, session, produce, checked, draft, snapshot, rollback, signalBlock, repairLoop, park, secrets, vars, dir, batch };
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
  try {
    if (ops.state.status === "stopped" || ops.state.status === "accepted") return ops.state;
    // Past the draft, data.ts must still hold exactly what the driver rendered from the validated records.
    if (["drafted", "reviewed", "escalated"].includes(ops.state.status)) {
      const changed = recordsInPlaceProblems(read(env, DATA), read(env, REGISTRY), concepts.filter((id) => ops.state.conceptStates[id].state !== "parked" && ops.state.records?.[id]).map((id) => ops.state.records![id]));
      if (changed.length || !ops.state.records) return ops.stop(`the batch's records changed outside the driver: ${changed.join("; ") || "no validated records"}; resume at plan-reviewed to draft again`);
    }

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
      if (!(await ops.checked("plan", result.sessionId, groupFile, start))) return ops.state;
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
      // An earlier draft of this batch leaves its rendered records: start the draft clean (never touching protected content).
      const leftovers = concepts.filter((id) => recordSpans(read(env, DATA)).has(id));
      if (leftovers.length) write(env, DATA, withoutRecords(read(env, DATA), leftovers));
      write(env, REGISTRY, withoutRegistryEntries(read(env, REGISTRY), concepts));
      delete ops.state.records;
      const start = await ops.snapshot();
      if (!(await ops.draft(start))) return ops.state;
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

/**
 * Acceptance: every concept's gates re-checked from the batch's evidence, and
 * everything that would be committed (records, audit notes, the group file)
 * scanned for secrets; failures park, parked drafts leave the tree. Each
 * accepted record's fingerprint is kept: finalize ships nothing else.
 */
async function accept(env: Env, ops: ReturnType<typeof batchOps>): Promise<BatchState> {
  const { slice, group, concepts } = ops.state;
  const secrets = await ops.secrets();
  const records = ops.state.records ?? {};
  for (const id of concepts.filter((c) => ops.state.conceptStates[c].state === "open")) {
    const missing = unresolved((await env.signals(id)).map((s) => s.id), ops.state.audit[id].resolutions);
    const audit = ops.state.audit[id];
    const leaks = secretProblems([...(records[id] ? recordStrings(records[id]) : []), ...audit.notes, ...audit.resolutions.map((r) => r.resolution)], secrets);
    const problems = [...acceptanceProblems(ops.state, id), ...(missing.length ? [`signals unresolved: ${missing.join(", ")}`] : []), ...(records[id] ? [] : ["no validated record"]), ...leaks.map((leak) => `its record or audit ${leak}`)];
    if (problems.length) ops.park(id, problems.join("; "));
  }
  const groupMissing = unresolved((await env.groupSignals(group)).map((s) => s.id), ops.state.groupAudit?.resolutions ?? []);
  if (groupMissing.length) return ops.stop(`group signals left unresolved: ${groupMissing.join(", ")}`);
  const groupLeaks = secretProblems([read(env, groupPath(group)), ops.state.groupAudit?.note ?? "", ...(ops.state.groupAudit?.resolutions ?? []).map((r) => r.resolution)], secrets);
  if (groupLeaks.length) return ops.stop(`the group file or group audit ${groupLeaks.join("; ")}: a human removes it`);
  const parked = concepts.filter((id) => ops.state.conceptStates[id].state === "parked");
  if (parked.length) {
    // Parked drafts leave the tree; their state, findings and records stay in the batch for a human.
    write(env, join(ops.dir, "parked-records.json"), `${JSON.stringify(Object.fromEntries(parked.filter((id) => records[id]).map((id) => [id, records[id]])), null, 2)}\n`);
    write(env, DATA, withoutRecords(read(env, DATA), parked.filter((id) => recordSpans(read(env, DATA)).has(id))));
    write(env, REGISTRY, withoutRegistryEntries(read(env, REGISTRY), parked));
  }
  const accepted = concepts.filter((c) => ops.state.conceptStates[c].state === "open");
  // What is accepted is exactly what data.ts holds: the driver's rendering of the reviewed records.
  const changed = recordsInPlaceProblems(read(env, DATA), read(env, REGISTRY), accepted.map((id) => records[id]));
  if (changed.length) return ops.stop(`data.ts no longer holds the reviewed records: ${changed.join("; ")}`);
  for (const id of accepted) {
    write(env, join(ops.dir, `audit-${id}.json`), `${JSON.stringify({ note: ops.state.audit[id].notes.join(" | "), resolutions: ops.state.audit[id].resolutions }, null, 2)}\n`);
    ops.state.conceptStates[id] = { ...ops.state.conceptStates[id], state: "accepted", accepted: { at: env.now(), fingerprint: recordFingerprint(records[id]) } };
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
  const changed = recordsInPlaceProblems(read(env, DATA), read(env, REGISTRY), [state.records?.[input.concept]].filter((r): r is StagedRecord => !!r));
  if (changed.length || !state.records?.[input.concept]) throw new Error(`${input.concept}: data.ts does not hold its accepted record (${changed.join("; ") || "no validated record"}); a human decides`);
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
