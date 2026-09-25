"use client";

import { useEffect, useState } from "react";
import { getMapConceptContentHref } from "./explorer-model";
import type { MapConceptExposition } from "./explorer-model";
import { FlowModel, TensionPair } from "./exposition-models";
import type { MapContentBlock } from "@/lib/map";

const MONO = "font-mono text-[11px] uppercase tracking-[0.12em] sm:text-xs";

// MAP knowledge composition: one frame, two roles. Prose runs left-aligned on
// a wide editorial measure; structures (models, axioms, tension matrices)
// centre on the frame's axis. The frame is plain block flow so vertical
// margins collapse: prose-to-prose transitions share one spacing, and any
// transition into or out of a structure shares a larger one.
const PROSE = "my-6 max-w-[54rem] first:mt-0 last:mb-0";
const STRUCTURE = "my-10 first:mt-0 last:mb-0";

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
        <div>
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
        <p className={`${PROSE} ${lead ? "text-lg leading-8 text-foreground" : "leading-7 text-foreground/80"}`}>{block.text}</p>
      );
    case "flow":
      return (
        <div className={STRUCTURE}>
          <FlowModel label={block.label} stages={block.stages} />
        </div>
      );
    case "distinction":
      // An axiom on the structural axis. Visible symbol; spoken wording lives
      // only in the text alternative.
      return (
        <div className={STRUCTURE}>
          <p
            role="img"
            aria-label={`${block.left} is not the same as ${block.right}`}
            className={`${MONO} mx-auto max-w-2xl border-y border-border py-4 text-center text-foreground`}
          >
            {block.left} <span className="px-2 align-middle text-base leading-none text-muted">≠</span> {block.right}
          </p>
        </div>
      );
    case "tensions":
      // Relationship rows centred on the structural axis; each pair splits the
      // matrix width evenly, so every [concept] ↔ [concept] has the same geometry.
      return (
        <div className={STRUCTURE}>
          <div role="list" aria-label={block.label} className="mx-auto flex max-w-lg flex-col gap-2">
            {block.pairs.map(([left, right]) => (
              <div role="listitem" key={`${left}-${right}`}>
                <TensionPair left={left} right={right} />
              </div>
            ))}
          </div>
        </div>
      );
  }
}
