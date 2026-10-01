/**
 * Commit messages, PR text and the completion report for a domain run,
 * generated from run state rather than written by hand, so that they state
 * exactly what the run recorded.
 */
import type { DiffReport } from "./diff-check.ts";
import type { RunState } from "./run-state.ts";

/** "Identity, Accounts & Authority" → "identity, accounts and authority"; acronyms such as "MEV" keep their case. */
export const domainPhrase = (title: string) =>
  title
    .replace(/\s*&\s*/g, " and ")
    .split(" ")
    .map((word) => (/^[A-Z]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(" ");

const list = (values: readonly string[]) => (values.length ? values.join(", ") : "none");
const withTrailer = (message: string, trailer?: string) => (trailer ? `${message}\n\n${trailer}\n` : `${message}\n`);

export function contentCommitMessage(state: RunState, trailer?: string): string {
  const lines = [
    `feat(map): add ${domainPhrase(state.title)} L1 content`,
    "",
    `Canonical exposition for ${list(state.plan.eligible)}, authored through the map-authoring domain runbook.`,
  ];
  if (state.plan.facet.length) lines.push(`Authored under the facet rule as the preferred domain: ${list(state.plan.facet)}.`);
  if (state.plan.deferred.length) lines.push(`Deferred to their owning domains: ${list(state.plan.deferred.map((entry) => entry.conceptId))}.`);
  return withTrailer(lines.join("\n"), trailer);
}

export function fixCommitMessage(fix: RunState["fixes"][number], trailer?: string): string {
  return withTrailer(`${fix.message}\n\n${fix.reason}`, trailer);
}

export const prTitle = (state: RunState) => `MAP: ${state.title} L1 content`;

export function prBody(state: RunState, diff: DiffReport, footer?: string): string {
  const check = (name: string) => state.checks[name]?.detail ?? "not run";
  const lines = [
    "## Summary",
    "",
    `**${state.title} L1 domain run**, driven by \`npm run map:author\` (docs/map-authoring/domain-runbook.md).`,
    "",
    `- **Authored in this run:** ${list(state.plan.eligible)}`,
    `- **Already authored:** ${list(state.plan.authored)}`,
    `- **Deferred:** ${state.plan.deferred.length ? state.plan.deferred.map((entry) => `${entry.conceptId} (${entry.reason})`).join("; ") : "none"}`,
  ];
  if (state.plan.facet.length) lines.push(`- **Facet rule:** ${list(state.plan.facet)} authored here as the preferred domain; one exposition serves every child-carrying placement.`);
  if (state.fixes.length) lines.push(`- **General fixes (separate commits):** ${state.fixes.map((fix) => `\`${fix.message}\``).join("; ")}`);
  if (state.auditNotes.length) lines.push(`- **Editorial audit:** ${state.auditNotes.join(" ")}`);
  lines.push(
    "",
    "## Scope",
    "",
    `- ${diff.addedConcepts.length} content records and ${diff.registryAdded.length} registry entries added; hasContent false → true at ${diff.flipped.length} placements.`,
    "- No existing content, taxonomy, relationship, mechanism or path changed.",
    "",
    "## Verification",
    "",
    `- map:generate: ${check("generate")}`,
    `- Unit tests: ${check("test")}`,
    `- Lint (tracked tree): ${check("lint")}`,
    `- Build: ${check("build")}`,
    `- Browser suite: ${check("browser")}`,
    `- Render verification: ${check("render")}`,
  );
  if (footer) lines.push("", footer);
  return `${lines.join("\n")}\n`;
}

/** The one concise report a successful run ends with: only what the human reviews before merging. */
export function completionReport(state: RunState): string {
  const diff = state.diff;
  return [
    `${state.title}: validated PR awaiting human merge`,
    `authored: ${list(state.plan.eligible)} | already authored: ${list(state.plan.authored)} | deferred: ${state.plan.deferred.length ? state.plan.deferred.map((entry) => `${entry.conceptId} (${entry.reason})`).join("; ") : "none"}`,
    `editorial: ${state.auditNotes.join(" ") || "no notes"}`,
    `fixes: ${state.fixes.length ? state.fixes.map((fix) => fix.message).join("; ") : "none"}`,
    `verified: ${Object.entries(state.checks).map(([name, value]) => `${name} ${value.ok ? value.detail : "FAILED"}`).join("; ")}`,
    `diff: ${diff ? `${diff.addedConcepts.length} records, ${diff.registryAdded.length} registry entries, ${diff.flipped.length} hasContent flips; nothing else` : "not validated"}`,
    `commits: ${state.commits.map((commit) => `${commit.sha.slice(0, 7)} ${commit.message.split("\n")[0]}`).join("; ")}`,
    `PR: ${state.pr ? state.pr.url : "none"} | CI: ${state.ci ? `${state.ci.status} (${state.ci.detail})` : "unknown"}`,
  ].join("\n");
}
