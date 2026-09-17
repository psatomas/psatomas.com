/**
 * MODEL — a deliberately small, deterministic state-transition model. This
 * is not an EVM implementation, bytecode interpreter, or gas accounting
 * engine; it exists to expose one specific invariant clearly: a committed
 * write becomes canonical state, a reverted write does not, no matter how
 * far execution got before reverting. See EvmExperiment's own TECHNICAL
 * DETAILS section for the full simulation-boundary disclosure shown to
 * visitors.
 */

export type Operation = "INCREMENT" | "DECREMENT" | "REVERT";

export type TraceStep = {
  label: string;
  value: string;
};

export type ExecutionStatus = "COMMITTED" | "REVERTED";

export type ExecutionResult = {
  operation: Operation;
  preState: number;
  /** The value execution computed and attempted to write — always
   * present, whether or not it ultimately became canonical. */
  attemptedWrite: number;
  /** Canonical state after this transaction. Equal to `attemptedWrite`
   * when committed; equal to `preState` (unchanged) when reverted. */
  postState: number;
  status: ExecutionStatus;
  trace: TraceStep[];
  /** A modeled, deterministic resource cost — not live EVM gas
   * accounting. Identical across operations here because every
   * operation this model supports walks the same shape of steps
   * (read, compute, write, commit-or-revert). */
  modeledGasUsed: number;
};

const MODELED_GAS_USED = 400;

/**
 * Runs one deterministic transaction against `preState`.
 *
 * INCREMENT and DECREMENT always commit: postState = preState ± 1.
 * REVERT always models an attempted +1 write that is discarded:
 * postState stays exactly equal to preState — the core invariant this
 * experiment exists to demonstrate.
 */
export function executeTransition(preState: number, operation: Operation): ExecutionResult {
  const isRevert = operation === "REVERT";
  const isDecrement = operation === "DECREMENT";
  const delta = isDecrement ? -1 : 1;
  const opLabel = isDecrement ? "SUB" : "ADD";
  const opValue = isDecrement ? "-1" : "+1";

  const attemptedWrite = preState + delta;
  const postState = isRevert ? preState : attemptedWrite;
  const status: ExecutionStatus = isRevert ? "REVERTED" : "COMMITTED";

  const trace: TraceStep[] = [
    { label: "PRE-STATE", value: String(preState) },
    { label: "SLOAD", value: String(preState) },
    { label: opLabel, value: opValue },
    { label: "SSTORE", value: String(attemptedWrite) },
    { label: isRevert ? "REVERT" : "COMMIT", value: isRevert ? "DISCARDED" : String(postState) },
  ];

  return {
    operation,
    preState,
    attemptedWrite,
    postState,
    status,
    trace,
    modeledGasUsed: MODELED_GAS_USED,
  };
}
