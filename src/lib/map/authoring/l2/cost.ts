/**
 * What an L2 campaign's model sessions spent, read from the Claude Code
 * transcripts the orchestrator and its subagents leave on disk. Usage is the
 * API's own per-call report (input, cache writes, cache reads, output), each
 * call counted once however many transcript lines repeat it, and cost is the
 * campaign's weighted-token formula (l2v2/core.ts `weighted`), kept unchanged
 * so every historical measurement stays comparable. Beside it, each session's
 * usage is kept per model and priced at list rates (PRICES): weighted tokens
 * price every model alike, which hides what routing a role to a smaller model
 * changes. A call whose model has no price leaves the session unpriced rather
 * than guessed. A transcript line that does not parse or carries no usage is
 * skipped, never estimated. Development tooling only.
 */
import { weighted, type Usage } from "../l2v2/core.ts";

/** Usage of one model; 1-hour cache writes are priced apart from 5-minute ones. */
export type ModelUsage = Usage & { cache_creation_1h_input_tokens: number };

/**
 * List prices in USD per million tokens (Anthropic first-party API), as of
 * PRICES_AS_OF. Cache writes cost 1.25x input for the 5-minute TTL and 2x for
 * the 1-hour TTL. An estimate of API-equivalent spend, not a bill: plan usage
 * limits need not follow list prices. Update the table, and its date, when
 * prices change; a model not listed is reported as unpriced.
 */
export const PRICES_AS_OF = "2026-10-06";
export const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
};

/** A model's usage at list price, or undefined when the model has no price. */
export function priceOf(model: string, usage: ModelUsage): number | undefined {
  const price = PRICES[model];
  if (!price) return undefined;
  const oneHour = usage.cache_creation_1h_input_tokens;
  const fiveMinute = Math.max(0, usage.cache_creation_input_tokens - oneHour);
  return (usage.input_tokens * price.input + usage.output_tokens * price.output + usage.cache_read_input_tokens * price.cacheRead + fiveMinute * 1.25 * price.input + oneHour * 2 * price.input) / 1e6;
}

export type CostTotals = { sessions: number; calls: number; usage: Usage; weighted: number; usd: number; unpriced: string[]; models: Record<string, ModelUsage> };

export type SessionCost = {
  /** The subagent's task description, or "orchestrator" for the main session. */
  description: string;
  role: string;
  calls: number;
  usage: Usage;
  weighted: number;
  /** Usage by model, and its list price; models without a price are named in `unpriced` and left out of `usd`. */
  models: Record<string, ModelUsage>;
  usd: number;
  unpriced: string[];
  firstAt?: string;
  lastAt?: string;
};

export type CostFilter = { branch?: string; since?: string; until?: string };

const ZERO = (): Usage => ({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 });
const ZERO_MODEL = (): ModelUsage => ({ ...ZERO(), cache_creation_1h_input_tokens: 0 });
const addModels = (into: Record<string, ModelUsage>, from: Record<string, ModelUsage>) => {
  for (const [model, usage] of Object.entries(from)) {
    const entry = (into[model] ??= ZERO_MODEL());
    for (const key of Object.keys(entry) as (keyof ModelUsage)[]) entry[key] += usage[key];
  }
};
const priced = (models: Record<string, ModelUsage>) => {
  let usd = 0;
  const unpriced: string[] = [];
  for (const [model, usage] of Object.entries(models)) {
    const price = priceOf(model, usage);
    if (price === undefined) unpriced.push(model);
    else usd += price;
  }
  return { usd, unpriced: unpriced.sort() };
};

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
  const calls = new Map<string, ModelUsage & { model: string }>();
  let firstAt: string | undefined;
  let lastAt: string | undefined;
  for (const line of lines) {
    if (!line.includes('"assistant"') || !line.includes('"usage"')) continue;
    let entry: { type?: string; timestamp?: string; gitBranch?: string; message?: { id?: string; model?: string; usage?: Partial<Usage> & { cache_creation?: { ephemeral_1h_input_tokens?: number } } } };
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
    calls.set(message.id, { model: message.model ?? "unknown", input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0, cache_read_input_tokens: u.cache_read_input_tokens ?? 0, cache_creation_1h_input_tokens: u.cache_creation?.ephemeral_1h_input_tokens ?? 0 });
    if (entry.timestamp) {
      if (!firstAt || entry.timestamp < firstAt) firstAt = entry.timestamp;
      if (!lastAt || entry.timestamp > lastAt) lastAt = entry.timestamp;
    }
  }
  const usage = ZERO();
  const models: Record<string, ModelUsage> = {};
  for (const call of calls.values()) {
    for (const key of Object.keys(usage) as (keyof Usage)[]) usage[key] += call[key];
    const { model, ...counts } = call;
    addModels(models, { [model]: counts });
  }
  return { description, role: description === "orchestrator" ? "orchestrator" : roleOf(description), calls: calls.size, usage, weighted: calls.size ? weighted(usage) : 0, models, ...priced(models), ...(firstAt ? { firstAt, lastAt } : {}) };
}

/** Sessions with at least one counted call, totalled by role (the orchestrator is its own role). */
export function costByRole(sessions: readonly SessionCost[]): Map<string, CostTotals> {
  const totals = new Map<string, CostTotals>();
  for (const session of sessions) {
    if (!session.calls) continue;
    const entry = totals.get(session.role) ?? { sessions: 0, calls: 0, usage: ZERO(), weighted: 0, usd: 0, unpriced: [], models: {} };
    entry.sessions++;
    entry.calls += session.calls;
    for (const key of Object.keys(entry.usage) as (keyof Usage)[]) entry.usage[key] += session.usage[key];
    entry.weighted += session.weighted;
    addModels(entry.models, session.models ?? {});
    Object.assign(entry, priced(entry.models));
    totals.set(session.role, entry);
  }
  return totals;
}

/** The Claude Code transcript directory of a working directory (its path with every non-alphanumeric character as "-"). */
export const projectSlug = (cwd: string) => cwd.replace(/[^A-Za-z0-9]/g, "-");
