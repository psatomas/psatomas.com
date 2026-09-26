"use client";

import { Fragment, useEffect, useState } from "react";
import { getMapConceptContentHref } from "./explorer-model";
import type { MapConceptExposition } from "./explorer-model";
import { FlowModel, TensionPair } from "./exposition-models";
import type { MapContentBlock } from "@/lib/map";

const MONO = "font-mono text-[11px] uppercase tracking-[0.12em] sm:text-xs";

// MAP knowledge composition. The panel is the container; the knowledge field
// inside it has the prose measure and is the one coordinate system for all
// exposition: prose fills it left-aligned, and structures (models, axioms,
// tension matrices) centre within it, never on the wider panel. The field is
// plain block flow so vertical margins collapse: prose-to-prose transitions
// share one spacing, and any transition into or out of a structure another.
const KNOWLEDGE_FIELD = "max-w-[54rem]";
const PROSE = "my-6 first:mt-0 last:mb-0";
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
        <div className={KNOWLEDGE_FIELD}>
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
    case "heading":
      // A section title within the exposition; it collapses into the prose rhythm.
      return <h4 className="mt-12 mb-4 text-lg font-semibold tracking-tight text-foreground first:mt-0 last:mb-0">{block.text}</h4>;
    case "terms":
      // The vocabulary a passage introduces: plain text, not navigation.
      return (
        <div role="list" aria-label="Key terms" className={`${PROSE} ${MONO} flex flex-wrap gap-x-2 gap-y-1 text-muted`}>
          {block.terms.map((term, index) => (
            <span role="listitem" key={term}>
              {term}
              {index < block.terms.length - 1 ? (
                <span aria-hidden="true" className="pl-2 text-dim">
                  ·
                </span>
              ) : null}
            </span>
          ))}
        </div>
      );
    case "distinction":
      if (block.further?.length) {
        // A chain of distinctions, one notion per line down the structural axis.
        const chain = [block.left, block.right, ...block.further];
        return (
          <div className={STRUCTURE}>
            <p
              role="img"
              aria-label={`${chain[0]} is not the same as ${chain[1]}${chain
                .slice(2)
                .map((term) => `, which is not the same as ${term}`)
                .join("")}`}
              className={`${MONO} mx-auto flex max-w-2xl flex-col items-center gap-1 border-y border-border py-4 text-center text-foreground`}
            >
              {chain.map((term, index) => (
                <Fragment key={term}>
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-base leading-none text-muted">
                      ≠
                    </span>
                  ) : null}
                  <span>{term}</span>
                </Fragment>
              ))}
            </p>
          </div>
        );
      }
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
