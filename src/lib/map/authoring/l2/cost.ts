/**
 * What an L2 campaign's model sessions spent, read from the Claude Code
 * transcripts the orchestrator and its subagents leave on disk. Usage is the
 * API's own per-call report (input, cache writes, cache reads, output), each
 * call counted once however many transcript lines repeat it, and cost is the
 * campaign's weighted-token formula (l2v2/core.ts `weighted`). A transcript
 * line that does not parse or carries no usage is skipped, never estimated.
 * Development tooling only.
 */
import { weighted, type Usage } from "../l2v2/core.ts";

export type CostTotals = { sessions: number; calls: number; usage: Usage; weighted: number };

export type SessionCost = {
  /** The subagent's task description, or "orchestrator" for the main session. */
  description: string;
  role: string;
  calls: number;
  usage: Usage;
  weighted: number;
  firstAt?: string;
  lastAt?: string;
};

export type CostFilter = { branch?: string; since?: string; until?: string };

const ZERO = (): Usage => ({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });

/** The step a subagent ran, from its task description as the campaign names them. */
export function roleOf(description: string): string {
  if (/group audit/i.test(description)) return "group-audit";
  if (/^plan /i.test(description)) return "plan";
  if (/^(model and )?design /i.test(description)) return "design";
  if (/^author /i.test(description)) return "author";
  if (/re-audit|re-review/i.test(description)) return "re-audit";
  if (/^repair /i.test(description)) return "repair";
  if (/audit/i.test(description)) return "first-audit";
  return "other";
}

/**
 * One session's cost from its transcript lines, counting only the calls that
 * pass the filter (the branch the call was made on, and its time).
 */
export function sessionCost(lines: Iterable<string>, description: string, filter: CostFilter = {}): SessionCost {
  const calls = new Map<string, Usage>();
  let firstAt: string | undefined;
  let lastAt: string | undefined;
  for (const line of lines) {
    if (!line.includes('"assistant"') || !line.includes('"usage"')) continue;
    let entry: { type?: string; timestamp?: string; gitBranch?: string; message?: { id?: string; model?: string; usage?: Partial<Usage> } };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const message = entry.message;
    if (entry.type !== "assistant" || !message?.id || !message.usage || message.model === "<synthetic>") continue;
    if (filter.branch && entry.gitBranch !== filter.branch) continue;
    if (entry.timestamp && ((filter.since && entry.timestamp < filter.since) || (filter.until && entry.timestamp >= filter.until))) continue;
    const u = message.usage;
    calls.set(message.id, { input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0, cache_read_input_tokens: u.cache_read_input_tokens ?? 0 });
    if (entry.timestamp) {
      if (!firstAt || entry.timestamp < firstAt) firstAt = entry.timestamp;
      if (!lastAt || entry.timestamp > lastAt) lastAt = entry.timestamp;
    }
  }
  const usage = ZERO();
  for (const call of calls.values()) for (const key of Object.keys(usage) as (keyof Usage)[]) usage[key] += call[key];
  return { description, role: description === "orchestrator" ? "orchestrator" : roleOf(description), calls: calls.size, usage, weighted: calls.size ? weighted(usage) : 0, ...(firstAt ? { firstAt, lastAt } : {}) };
}

/** Sessions with at least one counted call, totalled by role (the orchestrator is its own role). */
export function costByRole(sessions: readonly SessionCost[]): Map<string, CostTotals> {
  const totals = new Map<string, CostTotals>();
  for (const session of sessions) {
    if (!session.calls) continue;
    const entry = totals.get(session.role) ?? { sessions: 0, calls: 0, usage: ZERO(), weighted: 0 };
    entry.sessions++;
    entry.calls += session.calls;
    for (const key of Object.keys(entry.usage) as (keyof Usage)[]) entry.usage[key] += session.usage[key];
    entry.weighted += session.weighted;
    totals.set(session.role, entry);
  }
  return totals;
}

/** The Claude Code transcript directory of a working directory (its path with every non-alphanumeric character as "-"). */
export const projectSlug = (cwd: string) => cwd.replace(/[^A-Za-z0-9]/g, "-");
