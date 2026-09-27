import { Fragment } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { MapFlowElement } from "@/lib/map";

/**
 * A small visual grammar for MAP's conceptual models, deliberately not a
 * diagramming engine: a node is a bordered concept; a relationship is drawn
 * outside the nodes as a connector (straight, branching into a parallel set,
 * or converging out of one). Each model is one image whose text alternative
 * is generated from the data, so no fallback wording or list markers ever
 * need CSS to stay hidden.
 */

const NODE_TEXT = "font-mono text-[11px] uppercase text-foreground sm:text-xs";
const LINE = "bg-border";

function ArrowHead() {
  return <span className="block h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-border" />;
}

/** A concept in a model: bordered, non-interactive (no hover or pointer). */
export function ModelNode({
  children,
  compact = false,
  className = "",
}: {
  children: ReactNode;
  /** Tighter tracking and padding on narrow screens, for side-by-side pairs. */
  compact?: boolean;
  className?: string;
}) {
  const spacing = compact ? "px-1 tracking-[0.04em] sm:px-3 sm:tracking-[0.12em]" : "px-3 tracking-[0.12em]";
  return (
    <span className={`block border border-border bg-background py-2 text-center [overflow-wrap:anywhere] ${NODE_TEXT} ${spacing} ${className}`}>
      {children}
    </span>
  );
}

/** A directed relationship between two stacked nodes. */
function Relation({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`flex flex-col items-center ${className}`}>
      <span className={`block h-4 w-px ${LINE}`} />
      <ArrowHead />
    </span>
  );
}

// A parallel set stacks beside a rail on narrow screens (indented equally on
// both sides so stacked nodes stay on the model's axis) and becomes
// side-by-side columns once they can hold their labels within the knowledge
// field: up to three at sm, more at lg (the field's full 54rem, 144px per
// column for six). Every class is spelled out so Tailwind generates it.
const PARALLEL = {
  sm: {
    set: "sm:grid sm:gap-y-0 sm:border-l-0 sm:px-0",
    tick: "sm:before:hidden",
    node: "sm:mx-auto sm:w-fit sm:max-w-full",
    wideBlock: "hidden sm:block",
    wideFlex: "hidden sm:flex",
    wideGrid: "hidden sm:grid",
    narrow: "sm:hidden",
  },
  lg: {
    set: "lg:grid lg:gap-y-0 lg:border-l-0 lg:px-0",
    tick: "lg:before:hidden",
    node: "lg:mx-auto lg:w-fit lg:max-w-full",
    wideBlock: "hidden lg:block",
    wideFlex: "hidden lg:flex",
    wideGrid: "hidden lg:grid",
    narrow: "lg:hidden",
  },
} as const;

const columns = (count: number): CSSProperties => ({ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` });

/** Horizontal bar joining column centres, with a vertical stub per column. */
function Fan({ count, direction, className }: { count: number; direction: "branch" | "converge"; className: string }) {
  return (
    <span aria-hidden="true" className={className} style={columns(count)}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="relative flex flex-col items-center">
          <span
            className={`absolute h-px ${LINE} ${direction === "branch" ? "top-0" : "bottom-0"}`}
            style={{ left: index === 0 ? "50%" : 0, right: index === count - 1 ? "50%" : 0 }}
          />
          <span className={`block h-4 w-px ${LINE}`} />
          {direction === "branch" ? <ArrowHead /> : null}
        </span>
      ))}
    </span>
  );
}

/**
 * A conceptual flow. Single-node stages are centred and joined by straight
 * relationships; a multi-node stage is a parallel set, branched into from the
 * stage above and converging into the stage after. On narrow screens a
 * parallel set stacks beside a rail with the same relationships.
 */
export function FlowModel({ label, stages }: { label: string; stages: readonly (readonly MapFlowElement[])[] }) {
  return (
    <div role="img" aria-label={describeFlow(label, stages)} className="flex w-full flex-col">
      {stages.map((stage, index) => {
        const previous = stages[index - 1];
        const next = stages[index + 1];
        if (stage.length === 1) {
          return (
            <span key={index} className="flex flex-col items-center">
              {/* A parallel set above draws its own convergence into this node. */}
              {previous && previous.length === 1 ? <Relation /> : null}
              <ModelNode className="w-full sm:w-auto sm:min-w-56">{stage[0]}</ModelNode>
            </span>
          );
        }
        const size = stage.length <= 3 ? PARALLEL.sm : PARALLEL.lg;
        // Branches of several steps sit further apart on the rail than their steps.
        const branched = stage.some((element) => typeof element !== "string");
        // Columns stay proportionate to the set so small sets remain compact.
        return (
          <span key={index} className="mx-auto flex w-full flex-col" style={{ maxWidth: `${stage.length * 12}rem` }}>
            {/* Narrow: into the rail. Wide: a stem, then a branch to each column. */}
            <Relation className={`-ml-[3.5px] self-start ${size.narrow}`} />
            <span aria-hidden="true" className={`mx-auto h-3 w-px ${LINE} ${size.wideBlock}`} />
            <Fan count={stage.length} direction="branch" className={size.wideGrid} />
            <span className={`flex flex-col ${branched ? "gap-y-6" : "gap-y-2"} border-l border-border px-4 ${size.set}`} style={columns(stage.length)}>
              {branched
                ? stage.map((element) => (
                    <Branch key={elementKey(element)} steps={typeof element === "string" ? [element] : element} size={size} extend={Boolean(next)} />
                  ))
                : stage.map((element) => (
                    <span
                      key={elementKey(element)}
                      className={`relative px-1 before:absolute before:top-1/2 before:-left-4 before:h-px before:w-4 before:bg-border ${size.tick}`}
                    >
                      <ModelNode className={`w-full ${size.node}`}>{element}</ModelNode>
                    </span>
                  ))}
            </span>
            {next ? (
              <>
                <Fan count={stage.length} direction="converge" className={size.wideGrid} />
                <span aria-hidden="true" className={`flex-col items-center ${size.wideFlex}`}>
                  <span className={`block h-3 w-px ${LINE}`} />
                  <ArrowHead />
                </span>
                <Relation className={`-ml-[3.5px] self-start ${size.narrow}`} />
              </>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

const elementKey = (element: MapFlowElement) => (typeof element === "string" ? element : element.join(" > "));

/**
 * One column of a parallel set that continues for several steps: its steps
 * stack with their own relations. On narrow screens the rail's tick meets the
 * first step. On wide screens a column that converges below extends its line
 * to the shared convergence, so branches of different lengths still meet.
 */
function Branch({ steps, size, extend }: { steps: readonly string[]; size: (typeof PARALLEL)[keyof typeof PARALLEL]; extend: boolean }) {
  return (
    <span className="flex flex-col px-1">
      {steps.map((step, index) => (
        <Fragment key={step}>
          {index > 0 ? <Relation /> : null}
          <span
            className={
              index === 0
                ? `relative before:absolute before:top-1/2 before:-left-5 before:h-px before:w-4 before:bg-border ${size.tick}`
                : "relative"
            }
          >
            <ModelNode className={`w-full ${size.node}`}>{step}</ModelNode>
          </span>
        </Fragment>
      ))}
      {extend ? <span aria-hidden="true" className={`mx-auto w-px flex-1 ${LINE} ${size.wideBlock}`} /> : null}
    </span>
  );
}

function describeFlow(label: string, stages: readonly (readonly MapFlowElement[])[]): string {
  const say = (element: MapFlowElement) => (typeof element === "string" ? element : element.join(" leading to "));
  const said = stages.map((stage) =>
    stage.length === 1 ? say(stage[0]) : `${stage.slice(0, -1).map(say).join(", ")} and ${say(stage.at(-1)!)}`,
  );
  return `${label}: ${said.join(", then ")}.`;
}

/** Two concepts held in tension: a node, the relation between them, a node. */
export function TensionPair({ left, right }: { left: string; right: string }) {
  return (
    <span
      role="img"
      aria-label={`${left} in tension with ${right}`}
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-3"
    >
      <ModelNode compact>{left}</ModelNode>
      <span aria-hidden="true" className="text-base leading-none text-muted">
        ↔
      </span>
      <ModelNode compact>{right}</ModelNode>
    </span>
  );
}
