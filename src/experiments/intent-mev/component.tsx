"use client";

import { useMemo, useState, type ReactNode } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { StatusBadge } from "@/components/lab/status-badge";
import { FlowBox, FlowArrow } from "@/components/lab/flow";
import {
  type Candidate,
  type ScorePolicy,
  defaultCandidates,
  defaultPolicy,
  policyPresets,
  scoreAndRank,
} from "./simulation";

const weightFields: Array<{ key: keyof ScorePolicy; label: string }> = [
  { key: "costWeight", label: "COST SENSITIVITY" },
  { key: "mevWeight", label: "MEV SENSITIVITY" },
  { key: "latencyWeight", label: "LATENCY SENSITIVITY" },
];

export function IntentMevExperiment() {
  const [policy, setPolicy] = useState<ScorePolicy>(defaultPolicy);
  const [candidates, setCandidates] = useState<Candidate[]>(defaultCandidates);
  const [activePreset, setActivePreset] = useState<string>("BALANCED");

  const { scored, winnerId } = useMemo(
    () => scoreAndRank(candidates, policy),
    [candidates, policy],
  );

  function updateCandidate(id: string, field: "quality" | "cost", value: number) {
    setCandidates((current) =>
      current.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }

  function applyPreset(name: string) {
    setPolicy(policyPresets[name]);
    setActivePreset(name);
  }

  function updateWeight(key: keyof ScorePolicy, value: number) {
    setPolicy((current) => ({ ...current, [key]: value }));
    setActivePreset("CUSTOM");
  }

  function reset() {
    setPolicy(defaultPolicy);
    setCandidates(defaultCandidates);
    setActivePreset("BALANCED");
  }

  return (
    <div className="flex flex-col gap-10 p-6 sm:p-8">
      <div>
        <MonoLabel className="text-dim">
          EXPERIMENT 02 — INTENT EXECUTION × MEV
        </MonoLabel>
        <p className="mt-2 max-w-xl text-sm text-muted">
          An intent doesn&apos;t prescribe an exact execution path. The
          protocol evaluates candidate execution routes and selects one
          according to a scoring policy — MEV risk is one input to that
          decision, not an afterthought.
        </p>
      </div>

      {/* SYSTEM VISUALIZATION */}
      <div className="flex flex-col gap-3">
        <MonoLabel>SYSTEM VISUALIZATION</MonoLabel>
        <div className="flex flex-wrap items-center gap-2">
          <FlowBox>INTENT</FlowBox>
          <FlowArrow />
          <FlowBox>SWAP</FlowBox>
          <FlowArrow />
          <FlowBox>SOLVERS</FlowBox>
          <FlowArrow />
          <FlowBox>QUOTES</FlowBox>
          <FlowArrow />
          <FlowBox>SCORING</FlowBox>
          <FlowArrow />
          <FlowBox>MEV CHECK</FlowBox>
          <FlowArrow />
          <FlowBox emphasis>SELECTED</FlowBox>
          <FlowArrow />
          <FlowBox>SETTLEMENT</FlowBox>
        </div>
        <p className="text-xs text-muted">
          User intent: <span className="text-foreground">&ldquo;Swap 1,000 USDC for ETH&rdquo;</span>
        </p>
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

        <div className="flex flex-col gap-3">
          <MonoLabel className="text-dim">EXECUTION PREFERENCE</MonoLabel>
          <div className="flex flex-wrap gap-2">
            {Object.keys(policyPresets).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => applyPreset(name)}
                className={`border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] transition-colors ${
                  activePreset === name
                    ? "border-accent text-accent"
                    : "border-border-strong text-muted hover:text-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {weightFields.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between">
                <MonoLabel className="text-dim">{label}</MonoLabel>
                <span className="font-mono text-xs text-foreground">
                  {policy[key].toFixed(1)}×
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={policy[key]}
                onChange={(e) => updateWeight(key, Number(e.target.value))}
                className="accent-accent"
              />
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <MonoLabel className="text-dim">CANDIDATE QUALITY / COST</MonoLabel>
          <div className="flex flex-col gap-2">
            {candidates.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border py-2 first:border-t-0"
              >
                <span className="w-6 font-mono text-xs text-muted">{c.id}</span>
                <span className="min-w-40 text-sm text-foreground">{c.name}</span>
                <label className="flex items-center gap-2">
                  <MonoLabel className="text-dim">QUALITY</MonoLabel>
                  <input
                    type="number"
                    value={c.quality}
                    onChange={(e) =>
                      updateCandidate(c.id, "quality", Number(e.target.value))
                    }
                    className="w-20 border border-border-strong bg-transparent px-2 py-1 font-mono text-xs text-foreground"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <MonoLabel className="text-dim">COST</MonoLabel>
                  <input
                    type="number"
                    value={c.cost}
                    onChange={(e) =>
                      updateCandidate(c.id, "cost", Number(e.target.value))
                    }
                    className="w-20 border border-border-strong bg-transparent px-2 py-1 font-mono text-xs text-foreground"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LIVE STATE */}
      <div className="flex flex-col gap-3 border-t border-border pt-8">
        <MonoLabel>LIVE STATE</MonoLabel>
        <div className="flex flex-col gap-3">
          {scored.map((c) => {
            const isWinner = c.id === winnerId;
            return (
              <div
                key={c.id}
                className={`flex flex-col gap-2 border p-4 transition-colors ${
                  isWinner ? "border-accent" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm text-foreground">
                    {c.id} · {c.name}
                  </span>
                  {isWinner ? (
                    <StatusBadge variant="accent">SELECTED</StatusBadge>
                  ) : (
                    <StatusBadge>NOT SELECTED</StatusBadge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-5">
                  <StatCell label="QUALITY" value={c.quality} />
                  <StatCell label="COST" value={c.cost} />
                  <StatCell
                    label="MEV RISK"
                    value={c.mevRisk}
                    badge={
                      <StatusBadge variant={c.mevBand === "HIGH" ? "warn" : "neutral"}>
                        {c.mevBand}
                      </StatusBadge>
                    }
                  />
                  <StatCell label="LATENCY" value={`${c.latencyMs}ms`} />
                  <StatCell label="SCORE" value={c.score} emphasis={isWinner} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TECHNICAL DETAILS */}
      <div className="flex flex-col gap-2 border-t border-border pt-8">
        <div className="flex items-center gap-2">
          <MonoLabel>TECHNICAL DETAILS</MonoLabel>
          <StatusBadge variant="warn">SIMULATION</StatusBadge>
        </div>
        <p className="max-w-xl text-xs text-muted">
          This models the Execution Kernel Protocol&apos;s design — it does
          not call a live solver network or the actual protocol
          implementation. Conceptual mapping:{" "}
          <span className="text-foreground">IntentRegistry</span> captures
          the intent, <span className="text-foreground">ModuleRegistry</span>{" "}
          lists candidate executors,{" "}
          <span className="text-foreground">ScorePolicy</span> is the
          weighted function tuned above, and{" "}
          <span className="text-foreground">ExecutionEngine</span> applies it
          to select a route — all computed here, deterministically, in your
          browser.
        </p>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  emphasis = false,
  badge,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <MonoLabel className="text-dim">{label}</MonoLabel>
      <span
        className={`font-mono text-sm ${emphasis ? "text-accent" : "text-foreground"}`}
      >
        {value}
      </span>
      {badge}
    </div>
  );
}
