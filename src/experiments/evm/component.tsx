"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { StatusBadge } from "@/components/lab/status-badge";
import { FlowBox, FlowArrow } from "@/components/lab/flow";
import { SystemVisualization } from "@/components/lab/system-visualization";
import { executeTransition, type ExecutionResult, type Operation } from "./domain/state-transition";
import {
  GENESIS_ENTRY,
  INITIAL_STATE,
  MAX_HISTORY_ENTRIES,
  appendHistory,
  historyEntryFromResult,
  type HistoryEntry,
} from "./domain/state-history";

type Stat = { label: string; value: string };

const stateStats: Stat[] = [
  { label: "STATE MODEL", value: "Global State" },
  { label: "STORAGE", value: "Contract Storage" },
  { label: "RESOURCE MODEL", value: "Gas" },
];

const executionStats: Stat[] = [
  { label: "EXECUTION", value: "Stack-based VM" },
  { label: "CALL MODEL", value: "Message Calls" },
  { label: "ATOMICITY", value: "Transaction-level" },
];

const technicalFactsLeft: Stat[] = [
  { label: "EXPERIMENT MODEL", value: "Deterministic browser simulation" },
  { label: "STATE", value: "Simplified persistent storage value" },
  { label: "OPERATIONS", value: "Increment / Decrement / Revert" },
  { label: "TRACE", value: "Simplified EVM-like execution steps" },
];

const technicalFactsRight: Stat[] = [
  { label: "COMMIT MODEL", value: "Successful writes advance canonical state" },
  { label: "REVERT MODEL", value: "Attempted writes are discarded" },
  { label: "GAS", value: "Modeled execution resource, not live gas usage" },
  { label: "NETWORK", value: "None — no RPC or chain interaction" },
];

const OPERATIONS: Operation[] = ["INCREMENT", "DECREMENT", "REVERT"];

function StatRow({ stat }: { stat: Stat }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-3 first:border-t-0">
      <MonoLabel>{stat.label}</MonoLabel>
      <span className="text-sm text-foreground">{stat.value}</span>
    </div>
  );
}

/** A connected-cell row matching SystemVisualization's own seam geometry
 * (border-l desktop / border-t mobile, equal-width via auto-cols-fr) —
 * reproduced locally rather than reusing the SystemVisualization
 * component itself, since that component owns its own autonomous
 * animation and is deliberately not coupled to this interactive
 * executor (see the shared component's own docs). This is a static,
 * result-driven display, not a second animated pipeline primitive. */
function ConnectedCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border p-3 text-center first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0">
      <div className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted">{label}</div>
      <div className="mt-1 font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

export function EvmExperiment() {
  const [canonicalValue, setCanonicalValue] = useState(INITIAL_STATE);
  const [txCounter, setTxCounter] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([GENESIS_ENTRY]);
  const [operation, setOperation] = useState<Operation>("INCREMENT");
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);

  function handleExecute() {
    const result = executeTransition(canonicalValue, operation);
    const nextTx = txCounter + 1;
    setLastResult(result);
    setTxCounter(nextTx);
    setHistory((h) => appendHistory(h, historyEntryFromResult(nextTx, result)));
    if (result.status === "COMMITTED") setCanonicalValue(result.postState);
  }

  function handleReset() {
    setCanonicalValue(INITIAL_STATE);
    setTxCounter(0);
    setHistory([GENESIS_ENTRY]);
    setOperation("INCREMENT");
    setLastResult(null);
  }

  return (
    <div className="flex flex-col gap-10 py-6 sm:py-8">
      {/* SYSTEM VISUALIZATION */}
      <div className="flex flex-col gap-3">
        <MonoLabel>SYSTEM VISUALIZATION</MonoLabel>
        <SystemVisualization
          pathLabel="TRANSACTION EXECUTION PATH"
          stages={["TRANSACTION", "STATE READ", "EVM EXECUTE", "STATE WRITE", "COMMIT / REVERT"]}
        />
      </div>

      {/* INTERACTIVE STATE TRANSITION — one coherent bordered object:
          execution control (bg-surface) directly attached to trace,
          result, and history (bg-background), each divided by a single
          border-t, the same attached-planes grammar as ExperimentHeader
          and SystemVisualization above. */}
      <div className="flex flex-col gap-3">
        <MonoLabel>INTERACTIVE STATE TRANSITION</MonoLabel>
        <div className="border border-border">
          {/* EXECUTION CONTROL */}
          <div className="flex flex-col gap-4 bg-surface p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <MonoLabel>EXECUTION CONTROL</MonoLabel>
              <button
                type="button"
                onClick={handleReset}
                className="font-mono text-[10px] tracking-[0.1em] text-muted transition-colors hover:text-accent"
              >
                RESET
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="flex flex-col gap-0.5">
                <MonoLabel className="text-dim">OPERATION</MonoLabel>
                <span className="font-mono text-sm text-foreground">{operation}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <MonoLabel className="text-dim">VALUE</MonoLabel>
                <span className="font-mono text-sm text-foreground">1</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <MonoLabel className="text-dim">GAS LIMIT</MonoLabel>
                <span className="font-mono text-sm text-foreground">100,000</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Select operation">
                {OPERATIONS.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setOperation(op)}
                    aria-pressed={operation === op}
                    className={`border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] transition-colors ${
                      operation === op
                        ? "border-accent text-accent"
                        : "border-border-strong text-muted hover:text-foreground"
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExecute}
                className="border border-accent px-4 py-1.5 font-mono text-[11px] tracking-[0.08em] text-accent transition-colors hover:bg-surface-hover"
              >
                EXECUTE
              </button>
            </div>
          </div>

          {/* EXECUTION TRACE */}
          <div className="flex flex-col gap-3 border-t border-border p-6 sm:p-8">
            <MonoLabel>EXECUTION TRACE</MonoLabel>
            {lastResult ? (
              <div className="grid grid-cols-1 border-t border-border sm:grid-flow-col sm:auto-cols-fr">
                {lastResult.trace.map((step) => (
                  <ConnectedCell key={step.label} label={step.label} value={step.value} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">
                Press EXECUTE to run {operation} against canonical state {canonicalValue}.
              </p>
            )}
          </div>

          {/* RESULT */}
          <div className="flex flex-col gap-3 border-t border-border p-6 sm:p-8">
            <MonoLabel>RESULT</MonoLabel>
            {lastResult ? (
              <>
                <div className="grid grid-cols-2 border-t border-border sm:grid-flow-col sm:auto-cols-fr">
                  <ConnectedCell label="PRE-STATE" value={String(lastResult.preState)} />
                  <ConnectedCell label="ATTEMPTED WRITE" value={String(lastResult.attemptedWrite)} />
                  <ConnectedCell label="POST-STATE" value={String(lastResult.postState)} />
                  <div className="border-t border-border p-3 text-center sm:border-t-0 sm:border-l">
                    <div className="font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                      STATUS
                    </div>
                    <div className="mt-1 flex justify-center">
                      <StatusBadge variant={lastResult.status === "COMMITTED" ? "accent" : "warn"}>
                        {lastResult.status}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-dim">
                  Modeled gas used: {lastResult.modeledGasUsed} — not live EVM gas accounting (see
                  Technical Details below).
                </p>
              </>
            ) : (
              <p className="text-xs text-muted">No transaction executed yet.</p>
            )}
          </div>

          {/* STATE HISTORY */}
          <div className="flex flex-col gap-3 border-t border-border p-6 sm:p-8">
            <MonoLabel>STATE HISTORY</MonoLabel>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {history.map((entry, i) => (
                <span key={entry.id} className="flex items-center gap-2">
                  {i > 0 && <span className="text-dim">→</span>}
                  <span
                    className={`flex flex-col gap-0.5 border px-2 py-1 font-mono text-xs ${
                      entry.status === "REVERTED"
                        ? "border-warn text-warn"
                        : "border-border-strong text-foreground"
                    }`}
                  >
                    <span>
                      {entry.id} / {entry.value}
                    </span>
                    {entry.status === "REVERTED" && (
                      <span className="text-[10px] tracking-[0.08em]">REVERTED</span>
                    )}
                  </span>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-dim">
              Canonical state only — a reverted transaction&apos;s attempted write is never shown
              here as the resulting state. Showing genesis plus the most recent{" "}
              {MAX_HISTORY_ENTRIES - 1} transactions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-0">
        {/* State & storage */}
        <div className="flex flex-col gap-6 sm:pr-10">
          <h3 className="font-mono text-sm tracking-[0.1em] text-foreground">
            STATE &amp; STORAGE
          </h3>

          <p className="text-xs text-muted">
            Ethereum execution operates against a shared global state. Contract storage forms
            part of that state, while gas bounds the computational work a transaction can
            perform.
          </p>

          <div>
            {stateStats.map((stat) => (
              <StatRow key={stat.label} stat={stat} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <MonoLabel>SEQUENTIAL WRITES</MonoLabel>
            <div className="flex flex-wrap items-center gap-2">
              <FlowBox emphasis>TX 01</FlowBox>
              <FlowArrow />
              <FlowBox>STATE</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>TX 02</FlowBox>
              <FlowArrow />
              <FlowBox>STATE</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>TX 03</FlowBox>
            </div>
            <p className="text-xs text-muted">
              Every transaction observes the state produced by the transaction before it. A
              committed write becomes input to subsequent execution; a reverted write does not
              become part of canonical state.
            </p>
          </div>
        </div>

        {/* Execution & calls */}
        <div className="flex flex-col gap-6 border-t border-border pt-10 sm:border-t-0 sm:border-l sm:pl-10 sm:pt-0">
          <h3 className="font-mono text-sm tracking-[0.1em] text-foreground">
            EXECUTION &amp; CALLS
          </h3>

          <div>
            {executionStats.map((stat) => (
              <StatRow key={stat.label} stat={stat} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <MonoLabel>MESSAGE CALL CHAIN</MonoLabel>
            <div className="flex flex-wrap items-center gap-2">
              <FlowBox>EOA</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>CONTRACT A</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>CONTRACT B</FlowBox>
              <FlowArrow />
              <FlowBox emphasis>CONTRACT C</FlowBox>
            </div>
            <p className="text-xs text-muted">
              A transaction can produce nested message calls during execution. These calls
              remain inside the transaction&apos;s atomic boundary: if execution ultimately
              reverts, state changes produced throughout the call chain are discarded.
            </p>
          </div>
        </div>
      </div>

      {/* TECHNICAL DETAILS */}
      <div className="flex flex-col gap-4 border-t border-border pt-8">
        <MonoLabel>TECHNICAL DETAILS</MonoLabel>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-0">
          <div className="sm:pr-10">
            {technicalFactsLeft.map((stat) => (
              <StatRow key={stat.label} stat={stat} />
            ))}
          </div>
          <div className="border-t border-border pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-10">
            {technicalFactsRight.map((stat) => (
              <StatRow key={stat.label} stat={stat} />
            ))}
          </div>
        </div>
        <p className="max-w-xl text-xs text-muted">
          This experiment is a conceptual execution model, not an EVM implementation or bytecode
          interpreter. It deliberately reduces execution to the state-transition properties being
          examined: ordered state access, storage mutation, gas-bounded work, nested calls,
          atomic commit, and revert behavior.
        </p>
      </div>
    </div>
  );
}
