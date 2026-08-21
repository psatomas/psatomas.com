"use client";

import { useState, type ReactNode } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { StatusBadge } from "@/components/lab/status-badge";
import { FlowBox, FlowArrow } from "@/components/lab/flow";
import {
  type OracleEvaluation,
  defaultOracleInput,
  evaluateOracleUpdate,
} from "./simulation";

// Fixed simulation clock — deterministic, never Date.now(), so the demo
// never depends on when it's rendered.
const ANCHOR_TIME = Date.UTC(2026, 7, 21, 12, 0, 0);
const GENESIS_BLOCK = 21_442_000;

function formatTime(ms: number) {
  return new Date(ms).toISOString().slice(11, 19) + " UTC";
}

type LogEntry = OracleEvaluation & {
  id: number;
  price: number;
  ageSeconds: number;
  block: number;
  timestamp: number;
};

export function OraclesExperiment() {
  const [offChainPrice, setOffChainPrice] = useState(defaultOracleInput.offChainPrice);
  const [ageSeconds, setAgeSeconds] = useState(defaultOracleInput.ageSeconds);
  const [simulateInvalid, setSimulateInvalid] = useState(false);
  const maxStalenessSeconds = defaultOracleInput.maxStalenessSeconds;

  const genesisEvaluation = evaluateOracleUpdate(defaultOracleInput);
  const [log, setLog] = useState<LogEntry[]>([
    {
      id: 0,
      price: defaultOracleInput.offChainPrice,
      ageSeconds: defaultOracleInput.ageSeconds,
      block: GENESIS_BLOCK,
      timestamp: ANCHOR_TIME - defaultOracleInput.ageSeconds * 1000,
      ...genesisEvaluation,
    },
  ]);

  const draftEvaluation = evaluateOracleUpdate({
    offChainPrice,
    ageSeconds,
    maxStalenessSeconds,
    simulateInvalidSignature: simulateInvalid,
  });

  const onChainState = log.find((entry) => entry.accepted) ?? log[log.length - 1];

  function submit() {
    const evaluation = evaluateOracleUpdate({
      offChainPrice,
      ageSeconds,
      maxStalenessSeconds,
      simulateInvalidSignature: simulateInvalid,
    });
    setLog((current) => [
      {
        id: current.length,
        price: offChainPrice,
        ageSeconds,
        block: GENESIS_BLOCK + current.length,
        timestamp: ANCHOR_TIME,
        ...evaluation,
      },
      ...current,
    ].slice(0, 6));
  }

  function reset() {
    setOffChainPrice(defaultOracleInput.offChainPrice);
    setAgeSeconds(defaultOracleInput.ageSeconds);
    setSimulateInvalid(false);
    setLog([
      {
        id: 0,
        price: defaultOracleInput.offChainPrice,
        ageSeconds: defaultOracleInput.ageSeconds,
        block: GENESIS_BLOCK,
        timestamp: ANCHOR_TIME - defaultOracleInput.ageSeconds * 1000,
        ...genesisEvaluation,
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-10 p-6 sm:p-8">
      <div>
        <MonoLabel className="text-dim">
          EXPERIMENT 03 — ORACLES · OFF-CHAIN × ON-CHAIN
        </MonoLabel>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Off-chain data is not automatically on-chain truth. An oracle
          mechanism decides what a protocol is willing to accept — based on
          freshness and validity, not just &ldquo;the latest number.&rdquo;
        </p>
      </div>

      {/* SYSTEM VISUALIZATION */}
      <div className="flex flex-col gap-3">
        <MonoLabel>SYSTEM VISUALIZATION</MonoLabel>
        <div className="flex flex-wrap items-center gap-2">
          <FlowBox>OFF-CHAIN SOURCE</FlowBox>
          <FlowArrow />
          <FlowBox>ORACLE / ADAPTER</FlowBox>
          <FlowArrow />
          <FlowBox>ATTESTATION</FlowBox>
          <FlowArrow />
          <FlowBox emphasis>ON-CHAIN VERIFICATION</FlowBox>
          <FlowArrow />
          <FlowBox>PROTOCOL STATE</FlowBox>
        </div>
      </div>

      {/* INTERACTIVE CONTROLS */}
      <div className="flex flex-col gap-5 border-t border-border pt-8">
        <div className="flex items-center justify-between">
          <MonoLabel>INTERACTIVE CONTROLS</MonoLabel>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[10px] tracking-[0.1em] text-muted hover:text-accent transition-colors"
          >
            RESET
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between">
              <MonoLabel className="text-dim">OFF-CHAIN PRICE (ETH/USD)</MonoLabel>
              <span className="font-mono text-xs text-foreground">
                ${offChainPrice.toFixed(2)}
              </span>
            </span>
            <input
              type="range"
              min={3000}
              max={4000}
              step={0.1}
              value={offChainPrice}
              onChange={(e) => setOffChainPrice(Number(e.target.value))}
              className="accent-accent"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between">
              <MonoLabel className="text-dim">MESSAGE AGE</MonoLabel>
              <span className="font-mono text-xs text-foreground">{ageSeconds}s</span>
            </span>
            <input
              type="range"
              min={0}
              max={120}
              step={1}
              value={ageSeconds}
              onChange={(e) => setAgeSeconds(Number(e.target.value))}
              className="accent-accent"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAgeSeconds(maxStalenessSeconds + 30)}
            className="border border-border-strong px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] text-muted hover:text-foreground transition-colors"
          >
            SIMULATE STALE DATA
          </button>
          <button
            type="button"
            onClick={() => setSimulateInvalid((v) => !v)}
            className={`border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] transition-colors ${
              simulateInvalid
                ? "border-warn text-warn"
                : "border-border-strong text-muted hover:text-foreground"
            }`}
          >
            {simulateInvalid ? "INVALID SIGNATURE: ON" : "SIMULATE INVALID SIGNATURE"}
          </button>
          <button
            type="button"
            onClick={submit}
            className="border border-accent bg-accent px-4 py-1.5 font-mono text-[11px] tracking-[0.08em] text-accent-foreground hover:bg-transparent hover:text-accent transition-colors"
          >
            SUBMIT UPDATE
          </button>
        </div>

        <p className="text-xs text-muted">
          Draft evaluation:{" "}
          <span className={draftEvaluation.accepted ? "text-accent" : "text-warn"}>
            {draftEvaluation.accepted ? "WOULD BE ACCEPTED" : "WOULD BE REJECTED"}
          </span>{" "}
          — {draftEvaluation.reason.toLowerCase()}. Protocol freshness window:{" "}
          {maxStalenessSeconds}s.
        </p>
      </div>

      {/* LIVE STATE */}
      <div className="flex flex-col gap-6 border-t border-border pt-8">
        <MonoLabel>LIVE STATE</MonoLabel>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="font-mono text-sm tracking-[0.1em] text-foreground">
              OFF-CHAIN
            </h3>
            <StatRow label="SOURCE PRICE" value={`$${offChainPrice.toFixed(2)}`} />
            <StatRow label="MESSAGE TIMESTAMP" value={formatTime(ANCHOR_TIME - ageSeconds * 1000)} />
            <StatRow
              label="CONFIDENCE"
              value=""
              badge={
                <StatusBadge
                  variant={
                    draftEvaluation.confidence === "HIGH"
                      ? "accent"
                      : draftEvaluation.confidence === "EXPIRED"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {draftEvaluation.confidence}
                </StatusBadge>
              }
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:border-t-0 sm:border-l sm:pl-8 sm:pt-0">
            <h3 className="font-mono text-sm tracking-[0.1em] text-foreground">
              ON-CHAIN
            </h3>
            <StatRow label="PROTOCOL STATE" value={`$${onChainState.price.toFixed(2)}`} />
            <StatRow label="LAST ACCEPTED BLOCK" value={`#${onChainState.block}`} />
            <StatRow
              label="STATUS"
              value=""
              badge={
                <StatusBadge variant="accent">CURRENT</StatusBadge>
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <MonoLabel className="text-dim">SUBMISSION LOG</MonoLabel>
          <div className="flex flex-col gap-1.5">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-xs first:border-t-0"
              >
                <span className="font-mono text-muted">
                  #{entry.block} · ${entry.price.toFixed(2)} · age {entry.ageSeconds}s
                </span>
                <StatusBadge variant={entry.accepted ? "accent" : "warn"}>
                  {entry.accepted ? "ACCEPTED" : "REJECTED"}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TECHNICAL DETAILS */}
      <div className="flex flex-col gap-2 border-t border-border pt-8">
        <div className="flex items-center gap-2">
          <MonoLabel>TECHNICAL DETAILS</MonoLabel>
          <StatusBadge variant="warn">SIMULATION</StatusBadge>
        </div>
        <p className="max-w-xl text-xs text-muted">
          This is not connected to Chainlink, Pyth, RedStone, or any
          production oracle network — the clock, block numbers, and
          acceptance policy are all deterministic values computed in your
          browser. It demonstrates the mechanism: a protocol only accepts an
          update that is both validly signed and within its configured
          freshness window, regardless of how &ldquo;current&rdquo; the raw
          off-chain number looks.
        </p>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-2 first:border-t-0">
      <MonoLabel>{label}</MonoLabel>
      {badge ?? <span className="font-mono text-sm text-foreground">{value}</span>}
    </div>
  );
}
