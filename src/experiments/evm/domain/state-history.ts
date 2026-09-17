import type { ExecutionResult } from "./state-transition";

export type HistoryEntry = {
  id: string;
  /** Canonical state at this point in history. For a REVERTED entry this
   * is the unchanged pre-state, never the attempted write — the whole
   * point being that a reverted transaction's attempted value must never
   * be presented as canonical. */
  value: number;
  status: "GENESIS" | ExecutionResult["status"];
  /** Only present on a REVERTED entry, so the UI can still show what was
   * attempted without it being read as the entry's own `value`. */
  attemptedWrite?: number;
};

export const INITIAL_STATE = 10;

export const GENESIS_ENTRY: HistoryEntry = {
  id: "GENESIS",
  value: INITIAL_STATE,
  status: "GENESIS",
};

/** Small on purpose — this is a teaching visualization, not a ledger;
 * repeated clicking must not grow the DOM indefinitely. Genesis plus the
 * 7 most recent transactions. */
export const MAX_HISTORY_ENTRIES = 8;

export function historyEntryFromResult(txNumber: number, result: ExecutionResult): HistoryEntry {
  const id = `TX ${String(txNumber).padStart(2, "0")}`;
  if (result.status === "REVERTED") {
    return { id, value: result.preState, status: "REVERTED", attemptedWrite: result.attemptedWrite };
  }
  return { id, value: result.postState, status: "COMMITTED" };
}

/** Appends `entry`, then trims from the front (keeping GENESIS pinned)
 * once the bound is exceeded — the oldest transaction drops first, never
 * genesis and never the entry that was just added. */
export function appendHistory(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...history, entry];
  if (next.length <= MAX_HISTORY_ENTRIES) return next;
  const overflow = next.length - MAX_HISTORY_ENTRIES;
  return [next[0], ...next.slice(1 + overflow)];
}
