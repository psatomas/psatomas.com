/**
 * MAP L2 authoring pipeline v2: the pure core (docs/map-authoring/l2-pipeline-v2.md).
 *
 * A deterministic driver takes one ownership group (a batch) through bounded
 * sessions: plan, independent plan review, draft, independent review, exact
 * repairs with semantic verification, focused escalation, acceptance. This
 * module holds the batch state, the session outputs' contracts, the patching
 * and the metrics; it reads and writes nothing. Development tooling only.
 */
import { recordSpans } from "../l2/campaign.ts";

// ---------------------------------------------------------------- batch state

export const BATCH_STATUSES = ["pending", "planned", "plan-reviewed", "drafted", "reviewed", "escalated", "accepted", "stopped"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];
export type Role = "plan" | "plan-review" | "draft" | "review" | "escalate" | "deep-audit" | "verify";

export type Finding = {
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
export type ConceptReview = {
  verdict: "pass" | "defect";
  confidence: "high" | "medium" | "low";
  findings: Finding[];
  /** Per plan claim, by index: what the record explains for it. */
  coverage: { claim: number; mechanism: boolean; conditions: boolean; failureOrConfusion: boolean }[];
  crossDomain?: boolean;
  note: string;
  resolutions: Resolution[];
};
export type ReviewOutput = { concepts: Record<string, ConceptReview>; group?: { note: string; findings: Finding[]; resolutions: Resolution[] } };
export type VerifyOutput = { concepts: Record<string, { verdict: "pass" | "defect"; findings: Finding[]; note: string; resolutions: Resolution[] }> };
export type ClaimFix = { concept: string; quote: string; replacement: string; why: string };
export type PlanReviewOutput = { verdict: "pass" | "fix" | "stop"; claimFixes: ClaimFix[]; stopReason?: string; note: string };

export type ConceptState = { state: "open" | "accepted" | "parked"; escalate: boolean; reasons: string[]; repairRounds: number; parkReason?: string };
export type BatchState = {
  version: 1;
  slice: string;
  group: string;
  concepts: string[];
  status: BatchStatus;
  conceptStates: Record<string, ConceptState>;
  /** Session ids by role, for resuming the same session (its cache stays warm). */
  sessions: Partial<Record<Role, string>>;
  /** What the reviews concluded, per concept and for the group: becomes the v1 audit records. */
  audit: Record<string, { notes: string[]; resolutions: Resolution[] }>;
  groupAudit?: { note: string; resolutions: Resolution[] };
  defects: number;
  stop?: { reason: string; at: string };
  updatedAt: string;
};

export function newBatch(slice: string, group: string, concepts: readonly string[], now: string): BatchState {
  if (!concepts.length) throw new Error(`group ${group} has no concepts to author`);
  return {
    version: 1,
    slice,
    group,
    concepts: [...concepts],
    status: "pending",
    conceptStates: Object.fromEntries(concepts.map((id) => [id, { state: "open", escalate: false, reasons: [], repairRounds: 0 }])),
    sessions: {},
    audit: Object.fromEntries(concepts.map((id) => [id, { notes: [], resolutions: [] }])),
    defects: 0,
    updatedAt: now,
  };
}

/** Batches only move forward; a stopped batch stays stopped until a human resumes it. */
export function advance(state: BatchState, to: BatchStatus, now: string): BatchState {
  if (state.status === "stopped") throw new Error(`batch ${state.group} is stopped: ${state.stop?.reason}`);
  if (BATCH_STATUSES.indexOf(to) <= BATCH_STATUSES.indexOf(state.status) && to !== "stopped") throw new Error(`batch ${state.group} cannot move from ${state.status} to ${to}`);
  return { ...state, status: to, updatedAt: now };
}
export const stopBatch = (state: BatchState, reason: string, now: string): BatchState => ({ ...state, status: "stopped", stop: { reason, at: now }, updatedAt: now });
/** A human resumes a stopped batch at the status it stopped after. */
export function resumeBatch(state: BatchState, at: BatchStatus, now: string): BatchState {
  if (state.status !== "stopped") return state;
  const next = { ...state, status: at, updatedAt: now };
  delete next.stop;
  return next;
}

// ---------------------------------------------------------------- session outputs

const isStr = (value: unknown) => typeof value === "string";
function findingProblems(finding: unknown, where: string, concepts: readonly string[]): string[] {
  const f = finding as Partial<Finding>;
  const problems: string[] = [];
  if (!f || typeof f !== "object") return [`${where}: not an object`];
  if (!isStr(f.concept) || !concepts.includes(f.concept!)) problems.push(`${where}: concept must be one of ${concepts.join(", ")}`);
  if (f.severity !== "defect" && f.severity !== "remark") problems.push(`${where}: severity must be "defect" or "remark"`);
  if (!isStr(f.rule) || !isStr(f.why)) problems.push(`${where}: rule and why are required`);
  if (!isStr(f.quote) || !f.quote) problems.push(`${where}: quote is required`);
  if (f.severity === "defect" && !isStr(f.replacement)) problems.push(`${where}: a defect needs its exact replacement ("" to delete)`);
  return problems;
}
const resolutionsProblems = (resolutions: unknown, where: string) =>
  Array.isArray(resolutions) && resolutions.every((r) => isStr((r as Resolution).id) && isStr((r as Resolution).resolution)) ? [] : [`${where}: resolutions must be [{id, resolution}]`];

/** Problems with a review (or escalation) output for these concepts; [] when it is usable. */
export function reviewProblems(output: unknown, concepts: readonly string[], options: { group: boolean }): string[] {
  const o = output as Partial<ReviewOutput>;
  if (!o || typeof o.concepts !== "object") return ["the output needs a concepts object"];
  const problems: string[] = [];
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
    if (!Array.isArray(c.coverage)) problems.push(`${id}: coverage must be an array`);
    if (!isStr(c.note) || !c.note) problems.push(`${id}: note is required`);
    problems.push(...resolutionsProblems(c.resolutions, id));
    if (c.verdict === "pass" && c.findings?.some((finding) => finding.severity === "defect")) problems.push(`${id}: a pass cannot carry a defect`);
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

export function verifyProblems(output: unknown, concepts: readonly string[]): string[] {
  const o = output as Partial<VerifyOutput>;
  if (!o || typeof o.concepts !== "object") return ["the output needs a concepts object"];
  const problems: string[] = [];
  for (const id of concepts) {
    const c = o.concepts[id];
    if (!c) {
      problems.push(`no verification for ${id}`);
      continue;
    }
    if (c.verdict !== "pass" && c.verdict !== "defect") problems.push(`${id}: verdict must be "pass" or "defect"`);
    if (!Array.isArray(c.findings)) problems.push(`${id}: findings must be an array`);
    else c.findings.forEach((finding, index) => problems.push(...findingProblems(finding, `${id} finding ${index}`, concepts)));
    problems.push(...resolutionsProblems(c.resolutions, id));
  }
  return problems;
}

export function planReviewProblems(output: unknown, concepts: readonly string[]): string[] {
  const o = output as Partial<PlanReviewOutput>;
  if (!o || !["pass", "fix", "stop"].includes(o.verdict as string)) return ['verdict must be "pass", "fix" or "stop"'];
  const problems: string[] = [];
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

// ---------------------------------------------------------------- exact repairs

/** How a text is written inside a double-quoted string literal in data.ts. */
export const asLiteral = (text: string) => JSON.stringify(text).slice(1, -1);

export type PatchResult = { finding: Finding; applied: boolean; problem?: string };

/**
 * Applies defect findings to data.ts as exact replacements inside each
 * concept's own record. A quote must occur exactly once in that record;
 * anything else is refused, never guessed. Records of `protectedIds` (accepted
 * earlier, outside this batch) are never touched.
 */
export function applyPatches(source: string, findings: readonly Finding[], protectedIds: ReadonlySet<string>): { source: string; results: PatchResult[] } {
  let text = source;
  const results: PatchResult[] = [];
  for (const finding of findings) {
    if (finding.severity !== "defect") continue;
    if (protectedIds.has(finding.concept)) {
      results.push({ finding, applied: false, problem: `${finding.concept} is accepted content outside this batch` });
      continue;
    }
    const span = recordSpans(text).get(finding.concept);
    if (!span) {
      results.push({ finding, applied: false, problem: `no record for ${finding.concept}` });
      continue;
    }
    const lines = text.split("\n");
    const record = lines.slice(span.start, span.end + 1).join("\n");
    const quote = asLiteral(finding.quote);
    const count = record.split(quote).length - 1;
    if (count !== 1) {
      results.push({ finding, applied: false, problem: count === 0 ? "quote not found in the record" : `quote occurs ${count} times in the record` });
      continue;
    }
    const patched = record.replace(quote, () => asLiteral(finding.replacement ?? ""));
    text = [...lines.slice(0, span.start), patched, ...lines.slice(span.end + 1)].join("\n");
    results.push({ finding, applied: true });
  }
  return { source: text, results };
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

/** Records (outside `allowed`) whose text differs between two versions of data.ts. */
export function changedRecords(before: string, after: string, allowed: ReadonlySet<string>): string[] {
  const a = recordSpans(before);
  const b = recordSpans(after);
  const lines = { before: before.split("\n"), after: after.split("\n") };
  const text = (spans: typeof a, source: string[], id: string) => {
    const span = spans.get(id);
    return span ? source.slice(span.start, span.end + 1).join("\n") : undefined;
  };
  return [...new Set([...a.keys(), ...b.keys()])].filter((id) => !allowed.has(id) && text(a, lines.before, id) !== text(b, lines.after, id));
}

// ---------------------------------------------------------------- escalation

/** Rules whose defects mean the concept gets a second, independent focused review. */
export const FORMAL_RULES: ReadonlySet<string> = new Set(["conditions", "formal-results", "definition"]);
export type ConceptFacts = { placements: number; domainOrder: number };

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
  if (review.coverage.some((entry) => !entry.mechanism || !entry.conditions || !entry.failureOrConfusion)) reasons.push("a claim not fully covered");
  return reasons;
}

/** Signals the resolutions do not answer. */
export const unresolved = (signalIds: readonly string[], resolutions: readonly Resolution[]) => signalIds.filter((id) => !resolutions.some((r) => r.id === id && r.resolution.trim()));

// ---------------------------------------------------------------- metrics and stop rules

export type Usage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number };
/** Provisional weighting (not an official quota unit): input 1, cache read 0.1, cache write 1.25, output 5. */
export const weighted = (u: Usage) => Math.round(u.input_tokens + 0.1 * u.cache_read_input_tokens + 1.25 * u.cache_creation_input_tokens + 5 * u.output_tokens);

export type LedgerEntry =
  | { kind: "session"; at: string; slice: string; group: string; role: Role; sessionId: string; durationMs: number; turns: number; usage: Usage; weighted: number }
  | { kind: "batch"; at: string; slice: string; group: string; accepted: number; parked: number; escalated: number; defects: number }
  | { kind: "deep-audit"; at: string; label: string; concept: string; substantive: number }
  | { kind: "meter"; at: string; percent: number; note?: string };

export type Budget = { perConcept: number; stopFactor: number; maxEscalationRate: number; meterPercentPerConcept: number; sampleWindow: number; sampleMaxDefective: number };
export const DEFAULT_BUDGET: Budget = { perConcept: 122_000, stopFactor: 1.3, maxEscalationRate: 0.4, meterPercentPerConcept: 0.109, sampleWindow: 20, sampleMaxDefective: 8 };

export type BatchMetrics = { slice: string; group: string; weighted: number; minutes: number; accepted: number; parked: number; escalated: number; defects: number };

export function batchMetrics(ledger: readonly LedgerEntry[]): BatchMetrics[] {
  const out = new Map<string, BatchMetrics>();
  const key = (slice: string, group: string) => `${slice}/${group}`;
  for (const entry of ledger) {
    if (entry.kind !== "session" && entry.kind !== "batch") continue;
    const k = key(entry.slice, entry.group);
    const m = out.get(k) ?? { slice: entry.slice, group: entry.group, weighted: 0, minutes: 0, accepted: 0, parked: 0, escalated: 0, defects: 0 };
    if (entry.kind === "session") {
      m.weighted += entry.weighted;
      m.minutes += entry.durationMs / 60000;
    } else Object.assign(m, { accepted: entry.accepted, parked: entry.parked, escalated: entry.escalated, defects: entry.defects });
    out.set(k, m);
  }
  return [...out.values()];
}

/** The first stop rule a campaign's ledger breaks, or undefined. */
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
  const audits = ledger.filter((e): e is Extract<LedgerEntry, { kind: "deep-audit" }> => e.kind === "deep-audit").slice(-budget.sampleWindow);
  const defective = audits.filter((e) => e.substantive > 0).length;
  if (defective >= budget.sampleMaxDefective) return `${defective} of the last ${audits.length} deep-audited concepts had substantive defects`;
  const meters = ledger.filter((e): e is Extract<LedgerEntry, { kind: "meter" }> => e.kind === "meter");
  if (meters.length >= 2) {
    const [first, last] = [meters[0], meters[meters.length - 1]];
    const since = batchMetrics(ledger.filter((e) => e.at >= first.at && e.at <= last.at)).reduce((sum, m) => sum + m.accepted, 0);
    if (since && (last.percent - first.percent) / since > budget.meterPercentPerConcept) return `the usage meter rose ${(last.percent - first.percent).toFixed(1)}% for ${since} accepted concepts, over ${budget.meterPercentPerConcept}% each`;
  }
  return undefined;
}

/** A deterministic sample of `n` concepts (seeded), for measurement deep audits. */
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
