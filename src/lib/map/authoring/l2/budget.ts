/**
 * A hard spending cap per L2 run (docs/map-authoring/l2-authoring.md, "Budget").
 * Model work may start only when what the run has measurably spent, plus what
 * is reserved for model work already started and not finished, plus a fixed
 * headroom for the orchestrator's own turns, plus a reserve for the new work,
 * fits under the run's cap.
 *
 * Two kinds of number never mix:
 * - spent: usage the API reported for each call on the run's branch since the
 *   run started, read from the transcripts and priced at list rates (cost.ts).
 *   Nothing is estimated: a call without usage, or a model without a price,
 *   leaves spend unknown, and an unknown spend refuses all new work.
 * - reserved: a per-role estimate held for each launch until its session
 *   finishes; while it runs, only the part of the reserve it has not yet
 *   measurably spent is held. A launch whose session never reports finishing
 *   (an interrupted session) stays reserved until a human releases it.
 *
 * Pure; the CLI and the hook (scripts/map-l2-budget.ts) read the transcripts
 * and the ledger and pass them in. Development tooling only.
 */

/** List-price USD held per launch, by step role (cost.ts roleOf). */
export type L2Reserves = Record<string, number>;
export type L2Budget = {
  capUsd: number;
  reserves: L2Reserves;
  /** Kept free for the orchestrator's own turns, which no launch gate sees. */
  headroomUsd: number;
  setAt: string;
  /** Every change of the cap after the start, with the human decision behind it. */
  changes?: { at: string; capUsd: number; decision: string }[];
};

/**
 * Default reserves: about three times the 90th-percentile Opus session of the
 * last measured slice (computation-execution-2, 2026-10: first audit p90
 * $1.02, re-audit p90 $0.95, group audit max $1.16), since no simplified
 * Opus-authored slice was measurable when these were set. Estimates, never
 * spend; a run sets its own with `--reserve role=usd`.
 */
export const DEFAULT_RESERVES: Readonly<L2Reserves> = { plan: 3, design: 3, author: 3, "first-audit": 3, repair: 3, "re-audit": 3, "group-audit": 4, other: 4 };
export const DEFAULT_HEADROOM_USD = 5;

/** One session as measured from its transcript. */
export type L2SpendSession = {
  /** The subagent's launch (its Agent tool call), or none for an orchestrator session. */
  toolUseId?: string;
  /** Whether the session reports having finished (its subagent metadata); undefined when it does not say. */
  finished?: boolean;
  description: string;
  usd: number;
  /** Models used without a list price: their spend is unknown. */
  unpriced: string[];
  /** Model calls on the branch that carry no usage: their spend is unknown. */
  unmeasured: number;
  /** Model calls measured. */
  calls?: number;
};

export type L2Reservation = {
  /** The launch's tool-use id, so its session can be matched when it reports; generated when the launcher has none. */
  id: string;
  role: string;
  usd: number;
  at: string;
  description?: string;
  session?: string;
  /** A human's release of a reservation whose session will not report (it was interrupted). */
  released?: { at: string; reason: string };
};
export type L2BudgetLedger = { version: 1; run: string; reservations: L2Reservation[] };
export const emptyLedger = (run: string): L2BudgetLedger => ({ version: 1, run, reservations: [] });

export class BudgetError extends Error {}

const money = (value: number) => `$${value.toFixed(2)}`;
const isAmount = (value: number) => Number.isFinite(value) && value > 0;

/** Parses `role=usd,role=usd` reserve overrides. */
export function parseReserves(text: string | undefined): L2Reserves {
  if (!text) return {};
  const reserves: L2Reserves = {};
  for (const part of text.split(",").map((entry) => entry.trim()).filter(Boolean)) {
    const [role, value, extra] = part.split("=").map((entry) => entry.trim());
    const amount = Number(value);
    if (!role || value === undefined || extra !== undefined || !isAmount(amount)) throw new BudgetError(`reserve "${part}" is not role=usd with a positive amount`);
    reserves[role] = amount;
  }
  return reserves;
}

/** A run's budget at its start: a positive cap, the default reserves with any overrides, and the headroom. */
export function startBudget(capText: string | undefined, reservesText: string | undefined, now: string, headroomText?: string): L2Budget {
  if (capText === undefined) throw new BudgetError("an L2 run needs a hard spending cap: --budget-usd <list-price USD> (docs/map-authoring/l2-authoring.md, Budget)");
  const capUsd = Number(capText);
  if (!isAmount(capUsd)) throw new BudgetError(`--budget-usd ${capText} is not a positive amount`);
  const headroomUsd = headroomText === undefined ? DEFAULT_HEADROOM_USD : Number(headroomText);
  if (!Number.isFinite(headroomUsd) || headroomUsd < 0) throw new BudgetError(`--headroom-usd ${headroomText} is not an amount`);
  const reserves = { ...DEFAULT_RESERVES, ...parseReserves(reservesText) };
  const largest = Math.max(...Object.values(reserves));
  if (capUsd < headroomUsd + largest) throw new BudgetError(`a cap of ${money(capUsd)} leaves no room for one launch: headroom ${money(headroomUsd)} plus the largest reserve ${money(largest)}`);
  return { capUsd, reserves, headroomUsd, setAt: now };
}

/** A budget with a new cap, and the human decision recorded with it. */
export function changeCap(budget: L2Budget, capText: string | undefined, decision: string | undefined, now: string): L2Budget {
  const capUsd = Number(capText);
  if (capText === undefined || !isAmount(capUsd)) throw new BudgetError("budget set needs --usd <positive list-price USD>");
  if (!decision?.trim()) throw new BudgetError('changing a run\'s cap needs the human decision: --decision "..."');
  return { ...budget, capUsd, changes: [...(budget.changes ?? []), { at: now, capUsd, decision }] };
}

/** The reserve held for a launch of `role`; a role the budget does not name holds the largest reserve. */
export const reserveFor = (budget: L2Budget, role: string) => budget.reserves[role] ?? Math.max(...Object.values(budget.reserves));

export type L2BudgetStatus = {
  capUsd: number;
  /** Measured, never estimated. */
  spentUsd: number;
  /** Held for launches still running: each reserve less what its session has measurably spent. */
  reservedUsd: number;
  headroomUsd: number;
  /** What a new launch may take: the cap less spent, reserved and headroom. */
  availableUsd: number;
  open: { id: string; role: string; heldUsd: number; spentUsd: number; at: string; description?: string; reporting: boolean }[];
  /** Of spent and reserved, what open or recorded attempts account for (attempts.ts attemptBudget). */
  attempts?: { recordedUsd: number; heldUsd: number };
  /** Why spend cannot be measured: any entry refuses every launch. */
  unknown: string[];
};

/**
 * The run's budget as the transcripts show it now. A reservation is settled
 * once its session reports finishing (its spend is then all measured) or a
 * human releases it; until then it holds whatever of its reserve its session
 * has not yet spent.
 */
export function budgetStatus(budget: L2Budget, sessions: readonly L2SpendSession[], ledger: L2BudgetLedger, extra: L2BudgetExtra = {}): L2BudgetStatus {
  const spentUsd = sessions.reduce((sum, session) => sum + session.usd, 0) + (extra.recordedUsd ?? 0);
  const unknown = [
    ...(extra.unknown ?? []),
    ...[...new Set(sessions.flatMap((session) => session.unpriced))].map((model) => `model ${model} has no list price (cost.ts PRICES): its spend is unknown`),
    ...sessions.filter((session) => session.unmeasured > 0).map((session) => `${session.unmeasured} model call(s) of ${session.description} carry no usage: their spend is unknown`),
  ];
  const open = ledger.reservations
    .filter((reservation) => !reservation.released)
    .flatMap((reservation) => {
      const own = sessions.filter((session) => session.toolUseId === reservation.id);
      if (own.some((session) => session.finished)) return [];
      const spent = own.reduce((sum, session) => sum + session.usd, 0);
      return [{ id: reservation.id, role: reservation.role, heldUsd: Math.max(0, reservation.usd - spent), spentUsd: spent, at: reservation.at, ...(reservation.description ? { description: reservation.description } : {}), reporting: own.length > 0 }];
    });
  const reservedUsd = open.reduce((sum, entry) => sum + entry.heldUsd, 0) + (extra.heldUsd ?? 0);
  const attempts = extra.recordedUsd || extra.heldUsd ? { attempts: { recordedUsd: extra.recordedUsd ?? 0, heldUsd: extra.heldUsd ?? 0 } } : {};
  return { capUsd: budget.capUsd, spentUsd, reservedUsd, headroomUsd: budget.headroomUsd, availableUsd: budget.capUsd - spentUsd - reservedUsd - budget.headroomUsd, open, unknown, ...attempts };
}

/**
 * What a run's attempts add to its budget (attempts.ts attemptBudget): spend
 * recorded for attempts whose sessions are no longer measured (counted as
 * spent), reserves held for open attempts nothing else accounts for, and
 * spend that cannot be known.
 */
export type L2BudgetExtra = { recordedUsd?: number; heldUsd?: number; unknown?: string[] };

/** Why a launch of `role` may not start now; undefined when it may. */
export function launchProblem(budget: L2Budget, status: L2BudgetStatus, role: string): string | undefined {
  if (status.unknown.length) return `the run's spend cannot be measured, so no model work may start: ${status.unknown.join("; ")}`;
  const reserve = reserveFor(budget, role);
  if (reserve <= status.availableUsd) return undefined;
  return `a ${role} launch reserves ${money(reserve)}, but only ${money(Math.max(0, status.availableUsd))} of the ${money(budget.capUsd)} cap is available (spent ${money(status.spentUsd)} measured, ${money(status.reservedUsd)} reserved for ${status.open.length} launch(es) still running, ${money(budget.headroomUsd)} headroom)`;
}

/** The ledger with a launch reserved, if the budget allows it; a refused launch changes nothing. */
export function reserveLaunch(budget: L2Budget, status: L2BudgetStatus, ledger: L2BudgetLedger, launch: Omit<L2Reservation, "usd">): { ledger: L2BudgetLedger } | { problem: string } {
  if (ledger.reservations.some((reservation) => reservation.id === launch.id)) return { problem: `launch ${launch.id} is already reserved` };
  const problem = launchProblem(budget, status, launch.role);
  if (problem) return { problem };
  return { ledger: { ...ledger, reservations: [...ledger.reservations, { ...launch, usd: reserveFor(budget, launch.role) }] } };
}

/** A human's release of a reservation whose session will not report finishing. The reservation stays in the ledger, released. */
export function releaseLaunch(ledger: L2BudgetLedger, id: string, reason: string | undefined, now: string): L2BudgetLedger {
  if (!reason?.trim()) throw new BudgetError("releasing a reservation needs the human's reason: --reason \"...\"");
  const reservation = ledger.reservations.find((entry) => entry.id === id);
  if (!reservation) throw new BudgetError(`no reservation ${id}`);
  if (reservation.released) throw new BudgetError(`${id} was already released ${reservation.released.at}`);
  return { ...ledger, reservations: ledger.reservations.map((entry) => (entry.id === id ? { ...entry, released: { at: now, reason } } : entry)) };
}

export const describeBudget = (status: L2BudgetStatus) =>
  `budget ${money(status.capUsd)}: spent ${money(status.spentUsd)} (measured${status.attempts?.recordedUsd ? `, ${money(status.attempts.recordedUsd)} of it recorded on attempts whose transcripts are gone` : ""}), reserved ${money(status.reservedUsd)} for ${status.open.length} launch(es) still running${status.attempts?.heldUsd ? ` and ${money(status.attempts.heldUsd)} for launched attempts whose spend is not measured (released only by \`l2 attempt release\`)` : ""}, headroom ${money(status.headroomUsd)}, available ${money(Math.max(0, status.availableUsd))}${status.unknown.length ? `; SPEND UNKNOWN: ${status.unknown.join("; ")}` : ""}`;

/** The settings a project or user may keep the budget hook in. */
export const BUDGET_HOOK = "map-l2-budget-hook";

/**
 * Whether any of the Claude Code settings given registers the budget hook
 * before every Agent launch: a PreToolUse entry whose matcher matches "Agent"
 * and whose command runs the hook and ends in `|| exit 2`. Claude Code lets a
 * launch through when a hook exits with any code but 2, so a command that
 * could fail to start (a moved script, no node) without that fallback would
 * fail open.
 */
export function budgetHookInstalled(settings: readonly unknown[]): boolean {
  return settings.some((entry) => {
    const hooks = (entry as { hooks?: { PreToolUse?: { matcher?: string; hooks?: { type?: string; command?: string }[] }[] } } | undefined)?.hooks?.PreToolUse ?? [];
    return hooks.some((group) => {
      let matches = false;
      try {
        matches = group.matcher === undefined || group.matcher === "" || group.matcher === "*" || new RegExp(`^(?:${group.matcher})$`).test("Agent");
      } catch {
        matches = false;
      }
      return matches && (group.hooks ?? []).some((hook) => hook.type === "command" && typeof hook.command === "string" && hook.command.includes(BUDGET_HOOK) && /\|\|\s*exit\s+2\s*$/.test(hook.command));
    });
  });
}
