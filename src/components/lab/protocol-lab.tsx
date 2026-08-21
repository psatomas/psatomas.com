"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { experiments, getExperiment } from "@/lib/experiments/registry";
import type { ExperimentId } from "@/types";

export function ProtocolLab() {
  const [selected, setSelected] = useState<ExperimentId | null>("evm-svm");
  const active = getExperiment(selected);

  return (
    <section id="lab" className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-20">
      <div className="flex flex-col gap-3">
        <MonoLabel>PROTOCOL LAB</MonoLabel>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Interactive experiments exploring blockchain systems.
        </h2>
      </div>

      <div
        className="relative mt-12 border border-border"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* hub */}
        <div className="flex flex-col items-center gap-2 pt-10">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <MonoLabel className="text-foreground">LAB</MonoLabel>
          </div>
          <div className="h-6 w-px bg-border-strong" />
        </div>

        {/* spine */}
        <div className="h-px w-full bg-border-strong" />

        {/* experiment nodes — the shell only ever reads registry metadata here,
            it never knows what any experiment actually does */}
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {experiments.map((exp) => {
            const isSelected = selected === exp.id;
            return (
              <button
                key={exp.id}
                type="button"
                disabled={!exp.enabled}
                onClick={() =>
                  setSelected((current) =>
                    current === exp.id ? null : exp.id,
                  )
                }
                className={`group relative flex flex-col gap-2 border-t border-border p-6 text-left transition-colors sm:border-t-0 sm:border-l first:sm:border-l-0 ${
                  exp.enabled
                    ? "cursor-pointer hover:bg-surface-hover"
                    : "cursor-default opacity-45"
                } ${isSelected ? "bg-surface-hover" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <MonoLabel className={isSelected ? "text-accent" : ""}>
                    {exp.index} · {exp.title}
                  </MonoLabel>
                  {!exp.enabled && (
                    <span className="font-mono text-[10px] tracking-[0.1em] text-dim">
                      SOON
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">{exp.subtitle}</p>
                {isSelected && (
                  <span className="absolute bottom-0 left-0 h-[2px] w-full bg-accent" />
                )}
              </button>
            );
          })}
        </div>

        {/* expanded experiment — resolved through the registry, not a
            hardcoded if/else chain */}
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-border">
              {active && <active.Component />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
