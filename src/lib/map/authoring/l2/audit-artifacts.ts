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
import { join, resolve } from "node:path";
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
/** `attempt` names the attempt (attempts.ts) that produced it, in runs that track attempts. */
export type L2AuditArtifact = L2FindingsInput & { version: 1; run: string; subject: string; role: L2AuditRole; auditor: string; key: string; seq: number; at: string; binding: L2AuditBinding; attempt?: string };

/** A published artifact is untrusted input until the orchestrator reads it. */
export class AuditArtifactError extends Error {}

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

const ordered = (values: Record<string, string> | undefined) => Object.entries(values ?? {}).sort(([a], [b]) => a.localeCompare(b));
const normalizedBinding = (binding: L2AuditBinding | undefined) => ({ records: ordered(binding?.records), neighbours: ordered(binding?.neighbours) });
const sameBinding = (a: L2AuditBinding | undefined, b: L2AuditBinding) => JSON.stringify(normalizedBinding(a)) === JSON.stringify(normalizedBinding(b));

/**
 * The complete evidence basis, not only the subject record. A neighbour
 * changing therefore sends a new artifact to a new directory and the old one
 * can never be mistaken for a current audit.
 */
export const bindingKey = (binding: L2AuditBinding, subject: string) =>
  createHash("sha256").update(JSON.stringify({ subject, ...normalizedBinding(binding) })).digest("hex");

const directory = (workDir: string, subject: string, key: string) => join(workDir, subject, key.slice(0, 16));
const NAME = /^(first-audit|re-audit|group-audit)-([A-Z])-(\d{3,})\.json$/;

/**
 * Publishes an artifact under `workDir` without ever replacing one: it is
 * written whole to a private temporary file, then hard-linked to the next free
 * name, which fails if that name exists; on a clash the next sequence number
 * is tried. Returns the artifact as published.
 */
export function submitArtifact(workDir: string, artifact: Omit<L2AuditArtifact, "seq" | "key" | "version">): { path: string; artifact: L2AuditArtifact } {
  const key = bindingKey(artifact.binding, artifact.subject);
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

export type ArtifactReadContext = {
  run: string;
  subject: string;
  binding: L2AuditBinding;
  concepts: readonly string[];
  textOf: (conceptId: string) => string | undefined;
};

/** Every current artifact, revalidated at the recording boundary. */
export function readArtifacts(workDir: string, context: ArtifactReadContext): L2AuditArtifact[] {
  const key = bindingKey(context.binding, context.subject);
  const dir = directory(workDir, context.subject, key);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => NAME.test(name))
    .map((name) => {
      let artifact: unknown;
      try { artifact = JSON.parse(readFileSync(join(dir, name), "utf8")); }
      catch { throw new AuditArtifactError(`${join(dir, name)} is not complete JSON`); }
      const file = name.match(NAME)!;
      const value = artifact as Partial<L2AuditArtifact> | undefined;
      const structural = !value || typeof value !== "object" || value.version !== 1 || value.run !== context.run || value.subject !== context.subject || value.key !== key || !Number.isInteger(value.seq) || value.seq! < 1 || value.role !== file[1] || value.auditor !== file[2] || value.seq !== Number(file[3]) || !(AUDIT_ROLES as readonly string[]).includes(value.role as string) || !sameBinding(value.binding as L2AuditBinding, context.binding);
      if (structural) throw new AuditArtifactError(`${join(dir, name)} does not match the current run, subject, filename, or complete record-and-neighbour binding`);
      const problems = findingsProblems(value, { role: value.role!, auditor: value.auditor!, concepts: context.concepts, textOf: context.textOf });
      if (problems.length) throw new AuditArtifactError(`${join(dir, name)} is not a valid ${value.role}: ${problems.join("; ")}`);
      return value as L2AuditArtifact;
    })
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

/** Artifacts of `subject` published against other bindings than `key`: audits of records (its own or a neighbour's) that have since changed. */
export function staleArtifacts(workDir: string, subject: string, key: string): number {
  const root = join(workDir, subject);
  if (!existsSync(root)) return 0;
  return readdirSync(root)
    .filter((entry) => entry !== key.slice(0, 16))
    .reduce((sum, entry) => sum + (existsSync(join(root, entry)) ? readdirSync(join(root, entry)).filter((name) => NAME.test(name)).length : 0), 0);
}

// ---------------------------------------------------------------- independent auditors

/**
 * The one file an auditor writes its findings to: private to the subject,
 * role and auditor, so two auditors of a concept never share an input file,
 * and `submit-audit` accepts no other (inboxProblem). Under the run's work
 * directory, apart from the published artifacts.
 */
export const auditorInbox = (runWorkDir: string, subject: string, role: L2AuditRole, auditor: string) => join(runWorkDir, "inbox", subject, `${role}-${auditor}`, "findings.json");

/** Why `file` is not the submitting auditor's own inbox; undefined when it is. */
export function inboxProblem(file: string, inbox: string): string | undefined {
  return resolve(file) === resolve(inbox) ? undefined : `an auditor submits only its own findings file, ${inbox} (\`l2 audit-task\` names it); ${file} is not it`;
}

/**
 * The prompt for one auditor of one subject (`l2 audit-task`): each auditor
 * gets its own, naming only its own inbox, and never another auditor's
 * findings, artifacts or the `l2 findings` command, which are the
 * orchestrator's.
 */
export function auditTaskPrompt(input: { run: string; subject: string; role: L2AuditRole; auditor: string; inbox: string; instructions: string; attempt?: string }): string {
  const step = input.role === "group-audit" ? "group-audit.md" : "audit.md";
  const what =
    input.role === "first-audit"
      ? `an independent FIRST audit of ${input.subject}, as auditor ${input.auditor}. Another auditor audits it independently; you are never shown their work and must not look for it`
      : input.role === "re-audit"
        ? `the independent RE-AUDIT of ${input.subject} as repaired (auditor ${input.auditor}); \`npm run map:author -- l2 repair-diff ${input.subject}\` shows what the repair changed`
        : `the independent GROUP audit of ${input.subject} (auditor ${input.auditor})`;
  return [
    `You perform ${what}, in run ${input.run} of the MAP L2 simplified pipeline, version 2.`,
    `Read ${input.instructions}common.md, then ${input.instructions}${step}, then ${input.instructions}v2.md, and follow them. Where they differ, v2.md wins.`,
    `Write your findings, in the JSON form v2.md gives, to exactly this file and no other: ${input.inbox}`,
    `Then submit it: npm run map:author -- l2 submit-audit ${input.subject} --role ${input.role} --auditor ${input.auditor} --file ${input.inbox}${input.attempt ? ` --attempt ${input.attempt}` : ""}`,
    "Never run `l2 record`, `l2 reopen` or `l2 findings`, never edit records or group files, and never read, list or search the run's work directory beyond your own file: other auditors' findings and the published artifacts are the orchestrator's.",
    "Report back: PASS or FAIL, each blocking finding in one line, the number of advisory findings, and whether submit-audit succeeded.",
  ].join("\n");
}

// ---------------------------------------------------------------- atomic recording

/**
 * Records an audit all or nothing. The group file's new text is computed in
 * memory and every check runs against it (`validate`, then the run-state
 * transition `step`) before anything is written; only then is the group file
 * replaced and the run state saved. If saving the state fails, the group file
 * is put back as it was. A failure at any point leaves both as they were.
 */
export function commitAuditRecording<S>(io: {
  readGroup: () => string;
  writeGroup: (text: string) => void;
  next: (before: string) => string;
  validate: (nextText: string) => string[];
  step: () => S;
  saveState: (state: S) => void;
  /** Writes the group file and the run state together, crash-safely (journal.ts journaledCommit); without it, the two writes below. */
  persist?: (nextText: string, state: S, before: string) => void;
}): { ok: true; state: S } | { ok: false; problems: string[] } {
  const before = io.readGroup();
  const nextText = io.next(before);
  const problems = io.validate(nextText);
  if (problems.length) return { ok: false, problems };
  const state = io.step();
  if (io.persist) {
    io.persist(nextText, state, before);
    return { ok: true, state };
  }
  io.writeGroup(nextText);
  try {
    io.saveState(state);
  } catch (error) {
    io.writeGroup(before);
    throw error;
  }
  return { ok: true, state };
}
