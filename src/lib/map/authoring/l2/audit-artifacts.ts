/**
 * Audit findings artifacts for group-batched L2 runs (simplified pipeline
 * version 2; docs/map-authoring/l2-simplified/v2.md).
 *
 * Auditors never write the run's state or its group files. Each auditor
 * submits one structured findings artifact, bound to the records it judged,
 * and the orchestrator alone records the outcome (`l2 record audit`). So
 * independent audits of a group can run concurrently: each writes only its own
 * new file, published whole by a hard link that never replaces an existing
 * file, so a reader sees a complete artifact or none, and no artifact is ever
 * rewritten. A later submission by the same auditor is a new artifact with a
 * higher sequence number; recording uses the latest.
 *
 * A first audit is recorded only from both independent first audits (auditors
 * A and B) of the record as it is now; a repaired record from a re-audit; a
 * group from a group audit. Any blocking finding refuses the recording: the
 * concept is reopened (`l2 reopen --from-findings`). Development tooling only.
 */
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { L2Resolution } from "./contracts.ts";

export const AUDIT_ROLES = ["first-audit", "re-audit", "group-audit"] as const;
export type L2AuditRole = (typeof AUDIT_ROLES)[number];
/** Who may submit for each role: the two independent first auditors, the re-auditor, the group auditor. */
export const AUDITORS: Readonly<Record<L2AuditRole, readonly string[]>> = { "first-audit": ["A", "B"], "re-audit": ["R"], "group-audit": ["G"] };
export const SEVERITIES = ["blocking", "advisory"] as const;
export type L2Severity = (typeof SEVERITIES)[number];

/**
 * One finding: how severe it is (docs/map-authoring/l2-authoring.md, "Finding
 * severity"), the concept whose record it concerns, the evidence (an exact
 * quote from that record, a location, or both) and the action it requires.
 */
export type L2Finding = { severity: L2Severity; concept: string; criterion?: string; evidence: { quote?: string; location?: string }; action: string };
/** What an auditor submits. Resolutions are required on a passing audit that records signals (A, R, G). */
export type L2FindingsInput = { verdict: "pass" | "fail"; note: string; findings: L2Finding[]; resolutions?: L2Resolution[] };
/** The records an artifact judged, by fingerprint; `neighbours` are a concept audit's authored neighbours (coverage.ts). */
export type L2AuditBinding = { records: Record<string, string>; neighbours?: Record<string, string> };
export type L2AuditArtifact = L2FindingsInput & { version: 1; run: string; subject: string; role: L2AuditRole; auditor: string; key: string; seq: number; at: string; binding: L2AuditBinding };

const blank = (value: unknown) => typeof value !== "string" || !value.trim();
const squeeze = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Why a submission is not a valid structured audit for `role` of `subject`.
 * `concepts` are the concepts it may name (the concept itself; a group's owned
 * members), `textOf` each one's record text: a quoted piece of evidence must
 * be found there verbatim (whitespace aside).
 */
export function findingsProblems(input: unknown, context: { role: L2AuditRole; auditor: string; concepts: readonly string[]; textOf: (conceptId: string) => string | undefined }): string[] {
  const problems: string[] = [];
  if (!(AUDITORS[context.role] ?? []).includes(context.auditor)) problems.push(`a ${context.role} is submitted by auditor ${(AUDITORS[context.role] ?? []).join(" or ")}, not ${context.auditor}`);
  const submission = input as Partial<L2FindingsInput> | undefined;
  if (!submission || typeof submission !== "object") return [...problems, "the findings file is not a JSON object"];
  if (submission.verdict !== "pass" && submission.verdict !== "fail") problems.push('verdict must be "pass" or "fail"');
  if (blank(submission.note)) problems.push("the audit needs its note: what was checked, and the advisory findings");
  if (!Array.isArray(submission.findings)) return [...problems, "findings must be an array (empty when there are none)"];
  submission.findings.forEach((finding, index) => {
    const at = `finding ${index + 1}`;
    if (!finding || typeof finding !== "object") return problems.push(`${at} is not an object`);
    if (!(SEVERITIES as readonly string[]).includes(finding.severity)) problems.push(`${at}: severity must be blocking or advisory`);
    if (!context.concepts.includes(finding.concept)) problems.push(`${at}: concept ${String(finding.concept)} is not one this audit judges (${context.concepts.join(", ")})`);
    if (blank(finding.action)) problems.push(`${at}: say what action the finding requires`);
    const evidence = finding.evidence ?? {};
    if (blank(evidence.quote) && blank(evidence.location)) problems.push(`${at}: give its evidence: an exact quote from the record, a location, or both`);
    if (!blank(evidence.quote) && context.concepts.includes(finding.concept)) {
      const text = context.textOf(finding.concept);
      if (text === undefined || !squeeze(text).includes(squeeze(evidence.quote!))) problems.push(`${at}: the quoted evidence is not in ${finding.concept}'s record as it is now`);
    }
  });
  const blocking = submission.findings.filter((finding) => finding?.severity === "blocking").length;
  if (submission.verdict === "pass" && blocking) problems.push(`a passing audit has no blocking finding; this one lists ${blocking}`);
  if (submission.verdict === "fail" && !blocking) problems.push("a failing audit lists at least one blocking finding");
  if (submission.resolutions !== undefined) {
    if (!Array.isArray(submission.resolutions)) problems.push("resolutions must be an array of { id, resolution }");
    else submission.resolutions.forEach((entry, index) => (blank(entry?.id) || blank(entry?.resolution)) && problems.push(`resolution ${index + 1} needs its signal id and how it was judged`));
  }
  return problems;
}

/** The binding key of a set of records: a concept audit's own record fingerprint, a group audit's members' fingerprints together. */
export const bindingKey = (records: Record<string, string>, subject: string) =>
  records[subject] ?? createHash("sha256").update(JSON.stringify(Object.entries(records).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");

const directory = (workDir: string, subject: string, key: string) => join(workDir, subject, key.slice(0, 16));
const NAME = /^(first-audit|re-audit|group-audit)-([A-Z])-(\d{3,})\.json$/;

/**
 * Publishes an artifact under `workDir` without ever replacing one: it is
 * written whole to a private temporary file, then hard-linked to the next free
 * name, which fails if that name exists; on a clash the next sequence number
 * is tried. Returns the artifact as published.
 */
export function submitArtifact(workDir: string, artifact: Omit<L2AuditArtifact, "seq" | "key" | "version">): { path: string; artifact: L2AuditArtifact } {
  const key = bindingKey(artifact.binding.records, artifact.subject);
  const dir = directory(workDir, artifact.subject, key);
  mkdirSync(dir, { recursive: true });
  const taken = readdirSync(dir).map((name) => name.match(NAME)).filter((match) => match && match[1] === artifact.role && match[2] === artifact.auditor).map((match) => Number(match![3]));
  for (let seq = Math.max(0, ...taken) + 1; ; seq++) {
    const published: L2AuditArtifact = { version: 1, ...artifact, key, seq };
    const name = `${artifact.role}-${artifact.auditor}-${String(seq).padStart(3, "0")}.json`;
    const temporary = join(dir, `.${name}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);
    writeFileSync(temporary, `${JSON.stringify(published, null, 2)}\n`, { flag: "wx" });
    try {
      linkSync(temporary, join(dir, name));
      return { path: join(dir, name), artifact: published };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    } finally {
      rmSync(temporary, { force: true });
    }
  }
}

/** Every artifact published for `subject` against the records `key` names, oldest first; temporary files are never read. */
export function readArtifacts(workDir: string, subject: string, key: string): L2AuditArtifact[] {
  const dir = directory(workDir, subject, key);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => NAME.test(name))
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf8")) as L2AuditArtifact)
    .filter((artifact) => artifact.version === 1 && artifact.subject === subject && artifact.key === key)
    .sort((a, b) => a.role.localeCompare(b.role) || a.auditor.localeCompare(b.auditor) || a.seq - b.seq);
}

/** The latest artifact of `role` by `auditor`. */
export const latest = (artifacts: readonly L2AuditArtifact[], role: L2AuditRole, auditor: string) => artifacts.filter((artifact) => artifact.role === role && artifact.auditor === auditor).at(-1);

export type L2AuditOutcome =
  | { kind: "record"; note: string; resolutions: L2Resolution[]; neighbours?: Record<string, string>; from: L2AuditArtifact[] }
  | { kind: "missing"; missing: string[] }
  | { kind: "blocking"; findings: (L2Finding & { auditor: string; role: L2AuditRole })[] }
  | { kind: "inconsistent"; problem: string };

/**
 * What the artifacts of one subject's current records support: a recordable
 * audit, a wait for an auditor, or the blocking findings that reopen it.
 * - a first audit needs both A and B; their resolutions are joined (A's
 *   first), their notes kept apart, and both must have judged the same
 *   neighbours;
 * - after a repair, the re-audit R;
 * - a group, its group audit G.
 */
export function auditOutcome(artifacts: readonly L2AuditArtifact[], need: "first-audit" | "re-audit" | "group-audit"): L2AuditOutcome {
  const used = need === "first-audit" ? [latest(artifacts, "first-audit", "A"), latest(artifacts, "first-audit", "B")] : need === "re-audit" ? [latest(artifacts, "re-audit", "R")] : [latest(artifacts, "group-audit", "G")];
  const auditors = need === "first-audit" ? ["A", "B"] : need === "re-audit" ? ["R"] : ["G"];
  const missing = auditors.filter((_, index) => !used[index]).map((auditor) => `${need} by auditor ${auditor}`);
  if (missing.length) return { kind: "missing", missing };
  const present = used as L2AuditArtifact[];
  const blocking = present.flatMap((artifact) => artifact.findings.filter((finding) => finding.severity === "blocking").map((finding) => ({ ...finding, auditor: artifact.auditor, role: artifact.role })));
  if (blocking.length) return { kind: "blocking", findings: blocking };
  if (need === "first-audit" && JSON.stringify(present[0].binding.neighbours ?? {}) !== JSON.stringify(present[1].binding.neighbours ?? {})) {
    return { kind: "inconsistent", problem: "auditors A and B judged different versions of its neighbours' records: both must judge the same records; resubmit the one that saw the older text" };
  }
  const resolutions = new Map<string, L2Resolution>();
  for (const artifact of present) for (const entry of artifact.resolutions ?? []) if (!resolutions.has(entry.id)) resolutions.set(entry.id, entry);
  const note = present.length === 1 ? present[0].note : present.map((artifact) => `${artifact.auditor}: ${artifact.note}`).join("\n");
  return { kind: "record", note, resolutions: [...resolutions.values()], ...(present[0].binding.neighbours ? { neighbours: present[0].binding.neighbours } : {}), from: present };
}

/** A repair reason from blocking findings: each concept, auditor, criterion, required action and evidence, on one line each. */
export const findingsReason = (findings: readonly (L2Finding & { auditor: string; role: L2AuditRole })[]) =>
  findings.map((finding) => `${finding.concept} [${finding.role} ${finding.auditor}${finding.criterion ? `, ${finding.criterion}` : ""}]: ${finding.action}${finding.evidence.quote ? ` ("${finding.evidence.quote}")` : ""}${finding.evidence.location ? ` at ${finding.evidence.location}` : ""}`).join("; ");
