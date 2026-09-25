"use client";

import { useEffect, useState } from "react";
import { getMapConceptContentHref } from "./explorer-model";
import type { MapConceptExposition } from "./explorer-model";
import { FlowModel, TensionPair } from "./exposition-models";
import type { MapContentBlock } from "@/lib/map";

const MONO = "font-mono text-[11px] uppercase tracking-[0.12em] sm:text-xs";

// One request per concept for the page's lifetime; failures are not cached.
const expositions = new Map<string, Promise<MapConceptExposition>>();

function loadExposition(conceptId: string): Promise<MapConceptExposition> {
  let pending = expositions.get(conceptId);
  if (!pending) {
    pending = fetch(getMapConceptContentHref(conceptId)).then((response) => {
      if (!response.ok) throw new Error(`MAP exposition ${conceptId}: ${response.status}`);
      return response.json() as Promise<MapConceptExposition>;
    });
    pending.catch(() => expositions.delete(conceptId));
    expositions.set(conceptId, pending);
  }
  return pending;
}

type LoadState = { conceptId: string; attempt: number; exposition?: MapConceptExposition; failed?: boolean };

/**
 * A concept's canonical exposition, loaded only when its disclosure is open.
 * Rendered as continuous text and semantic models, never as labelled
 * template sections.
 */
export function ConceptExposition({ id, conceptId, label }: { id: string; conceptId: string; label: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ conceptId, attempt });

  useEffect(() => {
    let live = true;
    loadExposition(conceptId).then(
      (exposition) => live && setState({ conceptId, attempt, exposition }),
      () => live && setState({ conceptId, attempt, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [conceptId, attempt]);

  const current = state.conceptId === conceptId && state.attempt === attempt ? state : undefined;

  return (
    <div
      id={id}
      role="region"
      aria-label={label}
      aria-busy={!current?.exposition && !current?.failed}
      className="border-t border-border px-5 py-7 sm:px-6 sm:py-9"
    >
      {current?.exposition ? (
        <div className="flex flex-col gap-6">
          {/* Prose keeps a readable measure; conceptual models may use the
              panel's full width so parallel sets never break labels. */}
          {current.exposition.blocks.map((block, index) => (
            <ExpositionBlock key={index} block={block} lead={index === 0} />
          ))}
        </div>
      ) : current?.failed ? (
        <p className={`${MONO} text-muted`}>
          This explanation could not be loaded.{" "}
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="text-foreground underline underline-offset-4 hover:text-accent">
            Try again
          </button>
        </p>
      ) : (
        <p className={`${MONO} text-dim`}>Loading</p>
      )}
    </div>
  );
}

function ExpositionBlock({ block, lead }: { block: MapContentBlock; lead: boolean }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className={`max-w-3xl ${lead ? "text-lg leading-8 text-foreground" : "leading-7 text-foreground/80"}`}>{block.text}</p>
      );
    case "flow":
      return <FlowModel label={block.label} stages={block.stages} />;
    case "distinction":
      // Visible symbol; spoken wording lives only in the text alternative.
      return (
        <p
          role="img"
          aria-label={`${block.left} is not the same as ${block.right}`}
          className={`${MONO} max-w-3xl border-y border-border py-4 text-center text-foreground`}
        >
          {block.left} <span className="px-2 align-middle text-base leading-none text-muted">≠</span> {block.right}
        </p>
      );
    case "tensions":
      // Six relationship rows, each [concept] ↔ [concept]; not a table.
      return (
        <div role="list" aria-label={block.label} className="flex max-w-xl flex-col gap-2 py-1">
          {block.pairs.map(([left, right]) => (
            <div role="listitem" key={`${left}-${right}`}>
              <TensionPair left={left} right={right} />
            </div>
          ))}
        </div>
      );
  }
}
