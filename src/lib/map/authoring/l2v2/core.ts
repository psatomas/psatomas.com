/**
 * MAP L2 authoring pipeline v2: the pure core (docs/map-authoring/l2-pipeline-v2.md).
 *
 * A deterministic driver takes one ownership group (a batch) through bounded
 * sessions: plan, independent plan review (verified), draft, independent
 * review, exact repairs with semantic verification, focused escalation,
 * acceptance. This module holds the batch state, the session contracts, the
 * defect ledger, patching, batch selection over a v1 run, tool permissions,
 * and the metrics; it reads and writes nothing. Drafted records are data
 * (records.ts). Development tooling only.
 */
import { replaceOnce, type StagedRecord } from "./records.ts";

// ---------------------------------------------------------------- batch state

export const BATCH_STATUSES = ["pending", "planned", "plan-reviewed", "drafted", "reviewed", "escalated", "accepted", "stopped"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];
export type Role = "plan" | "plan-review" | "draft" | "review" | "escalate" | "deep-audit";

export type Finding = {
  /** Assigned by the driver when the finding enters the defect ledger. */
  id?: string;
  concept: string;
  severity: "defect" | "remark";
  rule: string;
  /** The exact text to replace, as the record shows it (map:inspect). */
  quote: string;
  /** Its replacement; "" deletes the quote. Required for a defect. */
  replacement?: string;
  why: string;
  uncertain?: boolean;
};
export type Resolution = { id: string; resolution: string };
export type Coverage = { claim: number; mechanism: boolean; conditions: boolean; failureOrConfusion: boolean };
export type ConceptReview = {
  verdict: "pass" | "defect";
  confidence: "high" | "medium" | "low";
  findings: Finding[];
  coverage: Coverage[];
  crossDomain?: boolean;
  note: string;
  resolutions: Resolution[];
};
/** Every output carries the run token the driver gave its session, so a stale file is never consumed. */
export type ReviewOutput = { run: string; concepts: Record<string, ConceptReview>; group?: { note: string; findings: Finding[]; resolutions: Resolution[] } };
export type DefectAnswer = { id: string; status: "fixed" | "withdrawn" | "open"; why: string };
export type VerifyOutput = { run: string; concepts: Record<string, { verdict: "pass" | "defect"; findings: Finding[]; defects: DefectAnswer[]; note: string; resolutions: Resolution[] }> };
export type ClaimFix = { concept: string; quote: string; replacement: string; why: string };
export type PlanReviewOutput = { run: string; verdict: "pass" | "fix" | "stop"; claimFixes: ClaimFix[]; stopReason?: string; note: string };

/** A substantive defect from its finding to its outcome. Only "verified" and "withdrawn" (with a reason) close it. */
export type Defect = { id: string; concept: string; finding: Finding; status: "open" | "applied" | "verified" | "withdrawn" | "refused"; why?: string; source?: Role };

export type ConceptState = {
  state: "open" | "accepted" | "parked";
  escalate: boolean;
  reasons: string[];
  /** The latest full review of the concept (the escalation review once there is one). */
  lastReview?: { by: Role; verdict: ConceptReview["verdict"]; confidence: ConceptReview["confidence"]; coverageComplete: boolean };
  parkReason?: string;
  /** When the concept was last accepted, and the fingerprint of the record accepted: finalize ships nothing else. */
  accepted?: { at: string; fingerprint: string };
};
/** What a batch's acceptance is judged from: kept as of each status reached, so a resume restarts from it. */
export type Evidence = { conceptStates: Record<string, ConceptState>; defects: Record<string, Defect>; audit: Record<string, { notes: string[]; resolutions: Resolution[] }>; groupAudit?: { note: string; resolutions: Resolution[] } };
/** Sessions and wall-clock time spent since the batch (or its latest resume) started; failed and interrupted sessions count. */
export type SessionWindow = { since: string; sessions: number; failed: number; interrupted: number; ms: number; inFlight?: { role: Role; startedAt: string } };
export type BatchState = {
  version: 2;
  slice: string;
  group: string;
  concepts: string[];
  status: BatchStatus;
  conceptStates: Record<string, ConceptState>;
  /** Session ids by role, for resuming the same session (its cache stays warm). */
  sessions: Partial<Record<Role, string>>;
  defects: Record<string, Defect>;
  /** The batch's validated records, by concept: the only source of what the driver renders into data.ts. */
  records?: Record<string, StagedRecord>;
  /** Fingerprints of the record text the driver itself rendered into data.ts, by concept: only these may it ever remove. */
  rendered?: Record<string, string>;
  /** What the reviews concluded, per concept and for the group: becomes the v1 audit records. */
  audit: Record<string, { notes: string[]; resolutions: Resolution[] }>;
  groupAudit?: { note: string; resolutions: Resolution[] };
  stop?: { reason: string; at: string; status: BatchStatus };
  /** 1, then one more for each resume. */
  attempt?: number;
  /** The evidence as of each status reached in this attempt. */
  checkpoints?: Partial<Record<BatchStatus, Evidence>>;
  /**
   * Earlier attempts, kept for the record and never judged again: their
   * evidence and their records (accepted but unfinalized text included), which
   * nothing reads as current.
   */
  history?: { attempt: number; endedAt: string; stop?: BatchState["stop"]; evidence: Evidence; records?: Record<string, StagedRecord>; window?: SessionWindow }[];
  window?: SessionWindow;
  updatedAt: string;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const evidenceOf = (state: BatchState): Evidence => clone({ conceptStates: state.conceptStates, defects: state.defects, audit: state.audit, ...(state.groupAudit ? { groupAudit: state.groupAudit } : {}) });
export const newWindow = (now: string): SessionWindow => ({ since: now, sessions: 0, failed: 0, interrupted: 0, ms: 0 });

export function newBatch(slice: string, group: string, concepts: readonly string[], now: string): BatchState {
  if (!concepts.length) throw new Error(`group ${group} has no concepts to author`);
  const state: BatchState = {
    version: 2,
    slice,
    group,
    concepts: [...concepts],
    status: "pending",
    conceptStates: Object.fromEntries(concepts.map((id) => [id, { state: "open", escalate: false, reasons: [] }])),
    sessions: {},
    defects: {},
    audit: Object.fromEntries(concepts.map((id) => [id, { notes: [], resolutions: [] }])),
    attempt: 1,
    window: newWindow(now),
    updatedAt: now,
  };
  return { ...state, checkpoints: { pending: evidenceOf(state) } };
}

const rank = (status: BatchStatus) => BATCH_STATUSES.indexOf(status);
/** Batches only move one step forward at a time; a stopped batch stays stopped until a human resumes it. */
export function advance(state: BatchState, to: BatchStatus, now: string): BatchState {
  if (state.status === "stopped") throw new Error(`batch ${state.group} is stopped: ${state.stop?.reason}`);
  if (rank(to) !== rank(state.status) + 1 || to === "stopped") throw new Error(`batch ${state.group} cannot move from ${state.status} to ${to}`);
  return { ...state, status: to, checkpoints: { ...state.checkpoints, [to]: evidenceOf(state) }, updatedAt: now };
}
export const stopBatch = (state: BatchState, reason: string, now: string): BatchState =>
  state.status === "stopped" ? state : { ...state, status: "stopped", stop: { reason, at: now, status: state.status }, updatedAt: now };
/**
 * A human resumes a stopped batch at the status it had reached, or earlier:
 * every later stage then runs again. Skipping forward is refused.
 *
 * The attempt's evidence moves to the history, and the batch restarts from
 * the evidence it had when it first reached `at`: later stages' defects,
 * notes and verdicts can never decide the new acceptance. Open deep-audit
 * defects are known defects of the record as it stands, so they stay unless
 * the record is drafted again. The session window starts afresh.
 */
export function resumeBatch(state: BatchState, at: BatchStatus, now: string): BatchState {
  if (state.status !== "stopped" || !state.stop) throw new Error(`batch ${state.group} is not stopped`);
  if (at === "stopped" || at === "accepted") throw new Error(`a batch cannot be resumed as ${at}: acceptance is earned by running the stages`);
  if (rank(at) > rank(state.stop.status)) throw new Error(`batch ${state.group} stopped at ${state.stop.status}; resuming at ${at} would skip stages`);
  const attempt = state.attempt ?? 1;
  const next: BatchState = clone({ ...state, status: at, updatedAt: now });
  delete next.stop;
  next.history = [...(state.history ?? []), clone({ attempt, endedAt: now, stop: state.stop, evidence: evidenceOf(state), ...(state.records ? { records: state.records } : {}), window: state.window })];
  // A redraft replaces the records: the current ones live on only in the history.
  if (rank(at) <= rank("plan-reviewed")) delete next.records;
  next.attempt = attempt + 1;
  next.window = newWindow(now);
  const base = state.checkpoints?.[at];
  if (base) Object.assign(next, clone({ conceptStates: base.conceptStates, defects: base.defects, audit: base.audit }), base.groupAudit ? { groupAudit: clone(base.groupAudit) } : {});
  else {
    // A state without checkpoints: concepts reopen with the earlier stages and the later evidence goes.
    if (rank(at) <= rank("drafted")) for (const id of next.concepts) next.conceptStates[id] = { state: "open", escalate: false, reasons: [] };
    if (rank(at) <= rank("drafted")) next.defects = {};
  }
  if (!base?.groupAudit) delete next.groupAudit;
  next.checkpoints = Object.fromEntries(Object.entries(state.checkpoints ?? {}).filter(([status]) => rank(status as BatchStatus) <= rank(at)));
  if (rank(at) >= rank("drafted"))
    for (const defect of Object.values(state.defects).filter((d) => d.source === "deep-audit" && d.status !== "verified" && d.status !== "withdrawn")) {
      next.defects[defect.id] = clone(defect);
      if (next.conceptStates[defect.concept].state !== "parked") next.conceptStates[defect.concept].state = "open";
    }
  return next;
}

// ---------------------------------------------------------------- session outputs

const isStr = (value: unknown): value is string => typeof value === "string";
function findingProblems(finding: unknown, where: string, concepts: readonly string[]): string[] {
  const f = finding as Partial<Finding>;
  if (!f || typeof f !== "object") return [`${where}: not an object`];
  const problems: string[] = [];
  if (!isStr(f.concept) || !concepts.includes(f.concept)) problems.push(`${where}: concept must be one of ${concepts.join(", ")}`);
  if (f.severity !== "defect" && f.severity !== "remark") problems.push(`${where}: severity must be "defect" or "remark"`);
  if (!isStr(f.rule) || !isStr(f.why)) problems.push(`${where}: rule and why are required`);
  if (!isStr(f.quote) || !f.quote) problems.push(`${where}: quote is required`);
  if (f.severity === "defect" && !isStr(f.replacement)) problems.push(`${where}: a defect needs its exact replacement ("" to delete)`);
  return problems;
}
const resolutionsProblems = (resolutions: unknown, where: string) =>
  Array.isArray(resolutions) && resolutions.every((r) => isStr((r as Resolution).id) && isStr((r as Resolution).resolution)) ? [] : [`${where}: resolutions must be [{id, resolution}]`];
const runProblems = (output: { run?: unknown }, run: string) => (output.run === run ? [] : [`run must be "${run}" (this session's token); a stale or foreign file is never used`]);

/** Problems with a review (or escalation) output for these concepts; [] when it is usable. */
export function reviewProblems(output: unknown, concepts: readonly string[], options: { group: boolean; run: string }): string[] {
  const o = output as Partial<ReviewOutput>;
  if (!o || typeof o.concepts !== "object") return ["the output needs a concepts object"];
  const problems = runProblems(o, options.run);
  for (const id of concepts) {
    const c = o.concepts[id] as Partial<ConceptReview> | undefined;
    if (!c) {
      problems.push(`no review for ${id}`);
      continue;
    }
    if (c.verdict !== "pass" && c.verdict !== "defect") problems.push(`${id}: verdict must be "pass" or "defect"`);
    if (!["high", "medium", "low"].includes(c.confidence as string)) problems.push(`${id}: confidence must be high, medium or low`);
    if (!Array.isArray(c.findings)) problems.push(`${id}: findings must be an array`);
    else c.findings.forEach((finding, index) => problems.push(...findingProblems(finding, `${id} finding ${index}`, concepts)));
    if (!Array.isArray(c.coverage) || !c.coverage.length) problems.push(`${id}: coverage must list every plan claim`);
    if (!isStr(c.note) || !c.note) problems.push(`${id}: note is required`);
    problems.push(...resolutionsProblems(c.resolutions, id));
    const defects = (c.findings ?? []).filter((finding) => finding.severity === "defect").length;
    if (c.verdict === "pass" && defects) problems.push(`${id}: a pass cannot carry a defect`);
    if (c.verdict === "defect" && !defects) problems.push(`${id}: a defect verdict must name each defect with its exact repair`);
  }
  if (options.group) {
    if (!o.group || !isStr(o.group.note) || !Array.isArray(o.group.findings)) problems.push("the output needs group {note, findings, resolutions}");
    else {
      o.group.findings.forEach((finding, index) => problems.push(...findingProblems(finding, `group finding ${index}`, concepts)));
      problems.push(...resolutionsProblems(o.group.resolutions, "group"));
    }
  }
  return problems;
}

/** A verification must answer every defect it was given, by id; "withdrawn" needs its reason. */
export function verifyProblems(output: unknown, reviewed: readonly string[], pending: Readonly<Record<string, readonly string[]>>, run: string): string[] {
  const o = output as Partial<VerifyOutput>;
  if (!o || typeof o.concepts !== "object") return ["the output needs a concepts object"];
  const problems = runProblems(o, run);
  for (const id of reviewed) {
    const c = o.concepts[id];
    if (!c) {
      problems.push(`no verification for ${id}`);
      continue;
    }
    if (c.verdict !== "pass" && c.verdict !== "defect") problems.push(`${id}: verdict must be "pass" or "defect"`);
    if (!Array.isArray(c.findings)) problems.push(`${id}: findings must be an array`);
    else c.findings.forEach((finding, index) => problems.push(...findingProblems(finding, `${id} finding ${index}`, reviewed)));
    problems.push(...resolutionsProblems(c.resolutions, id));
    const answers = Array.isArray(c.defects) ? c.defects : [];
    for (const defectId of pending[id] ?? []) {
      const answer = answers.find((a) => a.id === defectId);
      if (!answer || !["fixed", "withdrawn", "open"].includes(answer.status)) problems.push(`${id}: defect ${defectId} needs status fixed, withdrawn or open`);
      else if (answer.status === "withdrawn" && !answer.why?.trim()) problems.push(`${id}: withdrawing ${defectId} needs its reason`);
    }
    if (c.verdict === "pass" && (c.findings ?? []).some((finding) => finding.severity === "defect")) problems.push(`${id}: a pass cannot carry a defect`);
  }
  return problems;
}

export function planReviewProblems(output: unknown, concepts: readonly string[], run: string): string[] {
  const o = output as Partial<PlanReviewOutput>;
  if (!o || !["pass", "fix", "stop"].includes(o.verdict as string)) return ['verdict must be "pass", "fix" or "stop"'];
  const problems = runProblems(o, run);
  if (!Array.isArray(o.claimFixes)) problems.push("claimFixes must be an array");
  else
    o.claimFixes.forEach((fix, index) => {
      if (!concepts.includes(fix.concept) || !isStr(fix.quote) || !fix.quote || !isStr(fix.replacement)) problems.push(`claimFix ${index}: needs concept, quote and replacement`);
    });
  if (o.verdict === "stop" && !o.stopReason) problems.push("a stop needs stopReason");
  if (o.verdict === "fix" && !o.claimFixes?.length) problems.push("a fix needs claimFixes");
  return problems;
}

/** A session's JSON artifact, tolerating a fenced block around it. */
export function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

// ---------------------------------------------------------------- the defect ledger and acceptance

/** Adds a session's defect findings to the ledger with stable ids. */
export function recordDefects(state: BatchState, findings: readonly Finding[], prefix: string, source?: Role): Defect[] {
  const added: Defect[] = [];
  findings.filter((finding) => finding.severity === "defect").forEach((finding, index) => {
    const id = `${prefix}-${index + 1}`;
    const defect: Defect = { id, concept: finding.concept, finding: { ...finding, id }, status: "open", ...(source ? { source } : {}) };
    state.defects[id] = defect;
    added.push(defect);
  });
  return added;
}
export const openDefects = (state: BatchState, concept: string) => Object.values(state.defects).filter((d) => d.concept === concept && d.status !== "verified" && d.status !== "withdrawn");

/** Why a concept may not be accepted; [] when it may. */
export function acceptanceProblems(state: BatchState, concept: string): string[] {
  const c = state.conceptStates[concept];
  const problems: string[] = [];
  const open = openDefects(state, concept);
  if (open.length) problems.push(`unresolved defects: ${open.map((d) => `${d.id} (${d.status})`).join(", ")}`);
  if (!c.lastReview) problems.push("never reviewed");
  else {
    if (c.lastReview.verdict !== "pass" && open.length) problems.push(`last review (${c.lastReview.by}) found defects`);
    if (!c.lastReview.coverageComplete) problems.push(`claims not fully covered at the last review (${c.lastReview.by})`);
    if (c.lastReview.confidence === "low") problems.push(`low confidence at the last review (${c.lastReview.by})`);
    if (c.escalate && c.lastReview.by !== "escalate") problems.push("escalated but never given the second review");
  }
  return problems;
}

// ---------------------------------------------------------------- exact repairs

export type PatchResult = { finding: Finding; applied: boolean; problem?: string };

/**
 * Applies defect findings to the batch's records as exact replacements in
 * each concept's own content strings. A quote must occur exactly once in that
 * record, and the repaired record must stay valid and free of secrets;
 * anything else is refused, never guessed. Protected records are never touched.
 */
export function applyPatches(records: Readonly<Record<string, StagedRecord>>, findings: readonly Finding[], protectedIds: ReadonlySet<string>, secrets: readonly string[] = []): { records: Record<string, StagedRecord>; results: PatchResult[] } {
  const out = { ...records };
  const results: PatchResult[] = [];
  for (const finding of findings) {
    if (finding.severity !== "defect") continue;
    if (protectedIds.has(finding.concept)) {
      results.push({ finding, applied: false, problem: `${finding.concept} is protected content` });
      continue;
    }
    const record = Object.hasOwn(out, finding.concept) ? out[finding.concept] : undefined;
    if (!record) {
      results.push({ finding, applied: false, problem: `no record for ${finding.concept}` });
      continue;
    }
    const patched = replaceOnce(record, finding.quote, finding.replacement ?? "", secrets);
    if (patched.record) out[finding.concept] = patched.record;
    results.push(patched.record ? { finding, applied: true } : { finding, applied: false, problem: patched.problem });
  }
  return { records: out, results };
}

/** A group file with exact claim fixes applied to a member's claims and its model's copy. */
export function applyClaimFixes(groupFile: string, fixes: readonly ClaimFix[]): { text: string; problems: string[] } {
  const file = JSON.parse(groupFile) as { members: { conceptId: string; claims?: string[] }[]; concepts?: Record<string, { model?: { claims?: string[] } }> };
  const problems: string[] = [];
  for (const fix of fixes) {
    const member = file.members.find((entry) => entry.conceptId === fix.concept);
    const hits = (member?.claims ?? []).map((claim, index) => [claim, index] as const).filter(([claim]) => claim.split(fix.quote).length === 2);
    if (hits.length !== 1) {
      problems.push(`${fix.concept}: the quote must occur exactly once in one claim`);
      continue;
    }
    const [claim, index] = hits[0];
    member!.claims![index] = claim.replace(fix.quote, () => fix.replacement);
    const model = file.concepts?.[fix.concept]?.model;
    if (model?.claims) model.claims = [...member!.claims!];
  }
  return { text: `${JSON.stringify(file, null, 2)}\n`, problems };
}

// ---------------------------------------------------------------- escalation

/** Rules whose defects mean the concept gets a second, independent focused review. */
export const FORMAL_RULES: ReadonlySet<string> = new Set(["conditions", "formal-results", "definition"]);
export type ConceptFacts = { placements: number; domainOrder: number };
export const coverageComplete = (coverage: readonly Coverage[]) => coverage.length > 0 && coverage.every((c) => c.mechanism && c.conditions && c.failureOrConfusion);

/** Why a reviewed concept needs a second independent review; [] when it does not. */
export function escalationReasons(review: ConceptReview, facts: ConceptFacts, claimCorrected: boolean): string[] {
  const reasons: string[] = [];
  const defects = review.findings.filter((finding) => finding.severity === "defect");
  if (review.confidence !== "high") reasons.push(`reviewer confidence ${review.confidence}`);
  if (defects.length >= 3) reasons.push(`${defects.length} defects`);
  if (defects.some((finding) => FORMAL_RULES.has(finding.rule))) reasons.push("a defect in conditions, a formal result or the definition");
  if (review.findings.some((finding) => finding.uncertain)) reasons.push("an uncertain finding");
  if (review.crossDomain) reasons.push("touches another domain's concept");
  if (claimCorrected) reasons.push("a plan claim was corrected");
  if (facts.placements > 1) reasons.push(`${facts.placements} placements`);
  if (facts.domainOrder >= 19) reasons.push("emerging domain");
  if (!coverageComplete(review.coverage)) reasons.push("a claim not fully covered");
  return reasons;
}

/**
 * What a second reviewer looks at hardest, from the escalation reasons, without
 * the first review's verdict, confidence, findings or their count.
 */
export function escalationFocus(reasons: readonly string[]): string[] {
  const focus = new Set<string>();
  for (const reason of reasons) {
    if (reason.includes("conditions, a formal result or the definition")) focus.add("conditions, formal results with all their conditions, and the definition against every paragraph");
    else if (reason.includes("another domain")) focus.add("boundaries with other domains' concepts");
    else if (reason === "a plan claim was corrected") focus.add("the plan claims corrected before drafting");
    else if (/^\d+ placements$/.test(reason)) focus.add("one text true at every placement");
    else if (reason === "emerging domain") focus.add("accuracy in an emerging domain");
    else if (reason === "a claim not fully covered") focus.add("each claim's mechanism, conditions and failure or confusion");
  }
  focus.add("technical correctness of every sentence");
  return [...focus];
}

/** Signals the resolutions do not answer. */
export const unresolved = (signalIds: readonly string[], resolutions: readonly Resolution[]) => signalIds.filter((id) => !resolutions.some((r) => r.id === id && r.resolution.trim()));

// ---------------------------------------------------------------- batches over a v1 run

export type RunGroups = readonly { group: string; concepts: readonly string[] }[];
export type BatchPlan = {
  batches: { group: string; concepts: string[] }[];
  /** Groups v1 already finished (every concept audited and the group audited). */
  complete: string[];
  /** Groups with some v1 steps recorded but not finished: never guessed at. */
  refused: { group: string; reason: string }[];
  /** Content v2 never edits: registered at the base, or drafted or audited in the v1 run. */
  protectedIds: Set<string>;
};

/** Which groups of a v1 run v2 may author, from the run's recorded steps. */
export function planBatches(groups: RunGroups, steps: Readonly<Record<string, unknown>>, baseRegistry: ReadonlySet<string>): BatchPlan {
  const plan: BatchPlan = { batches: [], complete: [], refused: [], protectedIds: new Set(baseRegistry) };
  for (const { group, concepts } of groups) {
    for (const id of concepts) if (`author:${id}` in steps || `audit:${id}` in steps) plan.protectedIds.add(id);
    const recorded = [`plan:${group}`, `group-audit:${group}`, ...concepts.flatMap((id) => [`design:${id}`, `author:${id}`, `audit:${id}`])].filter((key) => key in steps);
    if (!recorded.length) plan.batches.push({ group, concepts: [...concepts] });
    else if (concepts.every((id) => `audit:${id}` in steps) && `group-audit:${group}` in steps) plan.complete.push(group);
    else plan.refused.push({ group, reason: `v1 steps already recorded (${recorded.slice(0, 4).join(", ")}${recorded.length > 4 ? ", …" : ""}): finish it with v1 or reset it explicitly` });
  }
  return plan;
}

/** The v1 commands that record an accepted slice, in v1's order, each scoped to the slice's run. */
export function finalizeCommands(slice: string, groups: RunGroups, dirOf: (group: string) => string): { key: string; argv: string[] }[] {
  const domain = ["--domain", slice];
  const out: { key: string; argv: string[] }[] = [];
  for (const { group } of groups) out.push({ key: `plan:${group}`, argv: ["record", "plan", group, ...domain] });
  for (const { concepts } of groups) for (const id of concepts) out.push({ key: `design:${id}`, argv: ["record", "design", id, ...domain] });
  for (const { group, concepts } of groups)
    for (const id of concepts) {
      out.push({ key: `author:${id}`, argv: ["record", "author", id, ...domain] });
      out.push({ key: `audit:${id}`, argv: ["record", "audit", id, "--audit-file", `${dirOf(group)}/audit-${id}.json`, ...domain] });
    }
  for (const { group } of groups) out.push({ key: `group-audit:${group}`, argv: ["record", "group-audit", group, "--audit-file", `${dirOf(group)}/group-audit.json`, ...domain] });
  return out;
}

// ---------------------------------------------------------------- session permissions

const L2 = "npm run -s map:author -- l2";
/**
 * The tools a session may use (prevention: the driver's guard only detects
 * and undoes changes after a session). Reading only the repository's
 * sources, docs and prompts, the session's own pack and its own output;
 * read-only inspection and validation; writing only the role's own JSON file.
 * No session sees another session's output or the batch state, edits
 * TypeScript, records anything, authorizes, delivers, writes territory, uses
 * git or runs arbitrary code.
 */
export function allowedTools(role: Role, group: string, files: { pack: string; out?: string }): string[] {
  const reads = ["Read(src/**)", "Read(docs/**)", "Read(scripts/l2v2/prompts/**)", `Read(${files.pack})`, ...(files.out ? [`Read(${files.out})`] : [])];
  const inspect = [`Bash(${L2} context:*)`, `Bash(${L2} territory ${group})`, `Bash(${L2} signals:*)`, `Bash(${L2} group-signals ${group})`, "Bash(npm run -s map:inspect --:*)"];
  const writes = files.out ? [`Write(${files.out})`, `Edit(${files.out})`] : [];
  switch (role) {
    case "plan": {
      // The group file is JSON: the plan is data, read with JSON.parse.
      const groupFile = `src/lib/map/authoring/l2/groups/${group}.json`;
      return [...reads, `Edit(${groupFile})`, `Write(${groupFile})`, ...inspect, `Bash(${L2} check --group ${group})`];
    }
    case "deep-audit":
      return [...reads, ...writes, `Bash(${L2} context:*)`, "Bash(npm run -s map:inspect --:*)"];
    default:
      return [...reads, ...writes, ...inspect];
  }
}

/** Never written by a session: executable and configuration surfaces, git, Claude Code, dependencies, run state and authorizations. */
const PROTECTED_WRITES = [
  "**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts", "**/*.js", "**/*.mjs", "**/*.cjs", "**/*.sh", "**/package.json", "**/package-lock.json", "**/tsconfig*.json",
  "**/.npmrc", "**/.nvmrc", "**/.envrc", "**/.env*", "**/.dev.vars*", "**/node_modules/**",
  "**/.git", "**/.git/**", "**/.gitignore", "**/.gitattributes", "**/.gitmodules", "**/.husky/**", "**/.claude/**", "**/.mcp.json", "**/CLAUDE.md", "**/AGENTS.md",
  ".map-authoring/*.json", ".map-authoring/l2/**", ".map-authoring/campaign/**", ".map-authoring/representation/**", ".map-authoring/l2v2/*.json", ".map-authoring/l2v2/*.jsonl", ".map-authoring/l2v2/lock",
  "**/state.json", "**/sample.json", "**/in-flight.json", "**/parked-records.json", "**/audit-*.json", "**/group-audit.json", "**/pack.md", "**/*.pack.md",
  "~/.claude/**", "~/.claude.json", "~/.gitconfig", "~/.npmrc", "~/.ssh/**", "~/.config/**", "~/.bashrc", "~/.zshrc", "~/.zshenv", "~/.profile", "//etc/**",
];
/**
 * Denied whatever the allow list says: local secrets, credentials, git
 * internals, and writing any protected path. (The repository lives under the
 * home directory, so the home directory itself is never denied wholesale.)
 */
export const DENIED_TOOLS: readonly string[] = [
  "Read(**/.dev.vars*)", "Read(**/.env*)", "Read(**/*.pem)", "Read(**/*.key)", "Read(**/.npmrc)", "Read(**/.netrc)", "Read(**/.git/**)",
  "Read(~/.ssh/**)", "Read(~/.aws/**)", "Read(~/.config/**)", "Read(~/.claude/**)", "Read(~/.claude.json)", "Read(~/.gnupg/**)", "Read(~/.git-credentials)", "Read(//etc/**)",
  ...PROTECTED_WRITES.flatMap((path) => [`Edit(${path})`, `Write(${path})`]),
];
/** A role's denials: a deep auditor also never reads the group files, which carry earlier audits' verdicts. */
export const deniedTools = (role: Role): readonly string[] => (role === "deep-audit" ? [...DENIED_TOOLS, "Read(src/lib/map/authoring/l2/groups/**)"] : DENIED_TOOLS);

// ---------------------------------------------------------------- metrics and stop rules

export type Usage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number };
/** Provisional weighting (not an official quota unit): input 1, cache read 0.1, cache write 1.25, output 5. */
export const weighted = (u: Usage) => Math.round(u.input_tokens + 0.1 * u.cache_read_input_tokens + 1.25 * u.cache_creation_input_tokens + 5 * u.output_tokens);

export type LedgerEntry =
  /** usage and weighted are null when the CLI reported no usage. */
  | { kind: "session"; at: string; slice: string; group: string; role: Role; sessionId: string; durationMs: number; turns: number; usage: Usage | null; weighted: number | null }
  /** A session that failed (timeout, usage limit, no JSON): its usage is unknown and never invented. */
  | { kind: "session-failed"; at: string; slice: string; group: string; role: Role; reason: string }
  | { kind: "batch"; at: string; slice: string; group: string; accepted: number; parked: number; escalated: number; defects: number }
  /** campaign: false for baselines, which never count toward the campaign's stop rules; fingerprint: the record audited, when it is a v2 record. */
  | { kind: "deep-audit"; at: string; label: string; concept: string; substantive: number; campaign: boolean; fingerprint?: string }
  | { kind: "meter"; at: string; percent: number; note?: string }
  /** A human resumed a stopped batch: its parked concepts are decided, and stop counting as parked. */
  | { kind: "resume"; at: string; slice: string; group: string; status: BatchStatus };

/**
 * Stop-rule thresholds and per-batch operational limits. Limits count
 * sessions and wall-clock time, never tokens: usage the CLI did not report
 * stays unknown, and --max-budget-usd does not bound a subscription's quota.
 */
export type Budget = {
  perConcept: number; stopFactor: number; maxEscalationRate: number; meterPercentPerConcept: number; sampleWindow: number; sampleMaxDefective: number; samplePerSlice: number;
  maxSessionsPerBatch: number; maxBatchMinutes: number;
  /** Concepts one audit command may audit (one session each). */
  maxAuditConcepts: number;
  /** Failed or interrupted sessions (any role, audits included) among the last `failureWindow` sessions that stop the campaign. */
  maxRecentFailures: number; failureWindow: number;
};
export const DEFAULT_BUDGET: Budget = {
  perConcept: 122_000, stopFactor: 1.3, maxEscalationRate: 0.4, meterPercentPerConcept: 0.109, sampleWindow: 20, sampleMaxDefective: 8, samplePerSlice: 4,
  maxSessionsPerBatch: 20, maxBatchMinutes: 240, maxAuditConcepts: 12, maxRecentFailures: 3, failureWindow: 10,
};

export type BatchMetrics = { slice: string; group: string; weighted: number; minutes: number; failed: number; unmeasured: number; accepted: number; parked: number; escalated: number; defects: number };

export function batchMetrics(ledger: readonly LedgerEntry[]): BatchMetrics[] {
  const out = new Map<string, BatchMetrics>();
  for (const entry of ledger) {
    if (entry.kind !== "session" && entry.kind !== "batch" && entry.kind !== "session-failed" && entry.kind !== "resume") continue;
    const k = `${entry.slice}/${entry.group}`;
    if (entry.kind === "resume") {
      const resumed = out.get(k);
      if (resumed) resumed.parked = 0;
      continue;
    }
    const m = out.get(k) ?? { slice: entry.slice, group: entry.group, weighted: 0, minutes: 0, failed: 0, unmeasured: 0, accepted: 0, parked: 0, escalated: 0, defects: 0 };
    if (entry.kind === "session") {
      if (entry.weighted === null) m.unmeasured++;
      else m.weighted += entry.weighted;
      m.minutes += entry.durationMs / 60000;
    } else if (entry.kind === "session-failed") m.failed++;
    else Object.assign(m, { accepted: entry.accepted, parked: entry.parked, escalated: entry.escalated, defects: entry.defects });
    out.set(k, m);
  }
  return [...out.values()];
}

/** The first stop rule a campaign's ledger breaks, or undefined. Thresholds stop the campaign; they never license a known defect. */
export function stopReason(ledger: readonly LedgerEntry[], budget: Budget = DEFAULT_BUDGET): string | undefined {
  const done = batchMetrics(ledger).filter((m) => m.accepted + m.parked > 0);
  const recent = done.slice(-3);
  const accepted = recent.reduce((sum, m) => sum + m.accepted, 0);
  if (recent.length === 3) {
    const perConcept = accepted ? recent.reduce((sum, m) => sum + m.weighted, 0) / accepted : Infinity;
    if (perConcept > budget.perConcept * budget.stopFactor) return `the last 3 batches cost ${Math.round(perConcept)} weighted per accepted concept, over ${budget.stopFactor} × the ${budget.perConcept} plan`;
  }
  const concepts = done.reduce((sum, m) => sum + m.accepted + m.parked, 0);
  const escalated = done.reduce((sum, m) => sum + m.escalated, 0);
  if (concepts >= 10 && escalated / concepts > budget.maxEscalationRate) return `${escalated} of ${concepts} concepts escalated, over ${budget.maxEscalationRate * 100}%`;
  const parked = done.reduce((sum, m) => sum + m.parked, 0);
  if (parked) return `${parked} concept(s) parked with unresolved defects: a human decides`;
  const sessions = ledger.filter((e) => e.kind === "session" || e.kind === "session-failed").slice(-budget.failureWindow);
  const failed = sessions.filter((e) => e.kind === "session-failed").length;
  if (failed >= budget.maxRecentFailures) return `${failed} of the last ${sessions.length} sessions failed or were interrupted: a human checks the CLI, the quota and the tree`;
  const audits = ledger.filter((e): e is Extract<LedgerEntry, { kind: "deep-audit" }> => e.kind === "deep-audit" && e.campaign).slice(-budget.sampleWindow);
  const defective = audits.filter((e) => e.substantive > 0).length;
  if (defective >= budget.sampleMaxDefective) return `${defective} of the last ${audits.length} sampled concepts had substantive defects`;
  const meters = ledger.filter((e): e is Extract<LedgerEntry, { kind: "meter" }> => e.kind === "meter");
  // A drop means the weekly quota reset: measure only within the latest window.
  let start = 0;
  for (let i = 1; i < meters.length; i++) if (meters[i].percent < meters[i - 1].percent) start = i;
  const window = meters.slice(start);
  if (window.length >= 2) {
    const [first, last] = [window[0], window[window.length - 1]];
    const since = batchMetrics(ledger.filter((e) => e.at >= first.at && e.at <= last.at)).reduce((sum, m) => sum + m.accepted, 0);
    if (since && (last.percent - first.percent) / since > budget.meterPercentPerConcept) return `the usage meter rose ${(last.percent - first.percent).toFixed(1)}% for ${since} accepted concepts, over ${budget.meterPercentPerConcept}% each`;
  }
  return undefined;
}

/** A deterministic sample of `n` items (seeded), for measurement deep audits. */
export function sample<T>(items: readonly T[], n: number, seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h >>> 0) / 2 ** 32);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

/** A slice's measurement sample: which concepts, and how each audit ended. */
export type SliceSample = { slice: string; concepts: string[]; audited: Record<string, { substantive: number; repaired: boolean }> };
/** Why a slice may not be finalized on its sample; [] when it may. A repaired concept must also be accepted again. */
export function sampleProblems(sampled: SliceSample | undefined, acceptedAgain: (concept: string) => boolean): string[] {
  if (!sampled) return ["the slice's measurement sample has not been drawn (`audit --sample-slice`)"];
  const problems: string[] = [];
  for (const id of sampled.concepts) {
    const a = sampled.audited[id];
    if (!a) problems.push(`${id}: sampled but not audited`);
    else if (a.substantive && (!a.repaired || !acceptedAgain(id))) problems.push(`${id}: ${a.substantive} substantive defect(s) not repaired and verified`);
  }
  return problems;
}

/**
 * Concepts with a known defect: a deep audit (sample, pilot or any other
 * label, fixed or not) found substantive defects at or after their last
 * acceptance, or in the very record that was accepted. They may not ship
 * until repaired, verified and accepted again. [] when none.
 */
export function knownDefectProblems(ledger: readonly LedgerEntry[], accepted: ReadonlyMap<string, { at: string; fingerprint?: string }>): string[] {
  const problems: string[] = [];
  for (const [concept, { at, fingerprint }] of accepted) {
    const found = ledger.filter((e): e is Extract<LedgerEntry, { kind: "deep-audit" }> => e.kind === "deep-audit" && e.concept === concept && e.substantive > 0 && (e.at >= at || (!!e.fingerprint && e.fingerprint === fingerprint)));
    if (found.length) problems.push(`${concept}: substantive defects found by deep audit ${found.map((e) => `"${e.label}" (${e.substantive}, ${e.at})`).join(", ")}, not repaired and accepted again since`);
  }
  return problems;
}
