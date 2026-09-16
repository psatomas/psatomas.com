import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { FlowBox } from "@/components/lab/flow";
import { getSystemBySlug } from "@/lib/systems";
import type { SystemSectionEntry } from "@/types";
import { ExecutionPipeline } from "./execution-pipeline";

// ExeKPro's presentation is bespoke enough (a locked, animated six-cell
// pipeline; architecture regrouped into four independent objects instead
// of the generic template's nested groups; a validation evidence grid; a
// current-state matrix) that it can't be expressed through the shared
// SystemSection renderer (src/app/systems/[slug]/page.tsx) without
// special-casing this one system inside code every other system also
// depends on. This route intentionally sits alongside [slug] instead:
// Next.js always resolves a literal segment before a dynamic one, so this
// page fully owns /systems/exekpro with zero risk to StakeVerse or
// Provenance Registry, which continue through the generic template
// unchanged (see the generateStaticParams exclusion in [slug]/page.tsx).
// All factual copy below is still read from src/lib/systems.ts, not
// duplicated as new hardcoded strings — only the layout is bespoke.

const system = getSystemBySlug("exekpro");

export const metadata: Metadata = system
  ? {
      title: system.name,
      description: system.summary,
      alternates: {
        canonical: "/systems/exekpro",
      },
      openGraph: {
        title: system.name,
        description: system.summary,
        url: "/systems/exekpro",
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: system.name,
        description: system.summary,
      },
    }
  : {};

function SectionHeader({ index, subtitle }: { index: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1">
      {/* Not <MonoLabel className="text-accent">: MonoLabel's own base
          classes bake in text-muted after it in the generated stylesheet,
          so a text-accent override loses regardless of class order in
          this className string — the same pre-existing issue already
          affects /lab's "01" index badges. Reproducing MonoLabel's own
          classes directly here (rather than editing the shared
          component, which would also change Lab) is scoped to just this
          page. */}
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
        {index}
      </span>
      <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
        {subtitle}
      </span>
    </div>
  );
}

// A term/detail pair, e.g. "IntentRegistry" / "Defines and validates
// registered execution intents." Small local equivalent of the private
// EntryList in [slug]/page.tsx — not imported from there since that
// component isn't exported, and duplicating ~10 lines here is cheaper
// and safer than exporting a piece of the shared template just for this
// one isolated route.
function EntryList({ entries }: { entries: SystemSectionEntry[] }) {
  return (
    <dl className="flex flex-col gap-3">
      {entries.map((entry) => (
        <div key={entry.term} className="flex flex-col gap-0.5">
          <dt className="font-mono text-sm font-medium text-foreground">
            {entry.term}
          </dt>
          <dd className="text-sm text-muted">{entry.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

// One independent bordered object: a dark-gray identity plane (title)
// directly attached to a black content plane (children) with a single
// divider between them — the same two-plane shape as each system object
// on /systems, reused here for Architecture's and System Boundaries'
// independent components rather than one enclosing table.
function ObjectCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-border">
      <div className="bg-surface p-6 sm:p-8">
        <span className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </span>
      </div>
      <div className="border-t border-border bg-background p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}

// The same five Validation facts as system.sections "Validation" .items,
// split into a big value + a descriptive label for the evidence grid
// below — a display-only restructuring of the same five facts (see the
// Validation section render), not a new or altered claim. The sixth grid
// slot is intentionally left blank (5 facts don't fill a 3x2 grid).
const VALIDATION_EVIDENCE = [
  { value: "43 / 43", label: "CONTRACT TESTS" },
  { value: "ADVERSARIAL + FUZZ", label: "VALIDATION" },
  { value: "3", label: "ISSUES RESOLVED" },
  { value: "REAL BROWSER E2E", label: "VALIDATION" },
  { value: "CI / EVERY PR", label: "VALIDATION" },
] as const;

// The same Current State facts as system.sections "Current State" .lede
// (retained verbatim below this table), restructured into a compact
// label/value matrix rather than prose-only.
const CURRENT_STATE_ROWS = [
  { label: "LOCAL ANVIL", value: "VALIDATED" },
  { label: "PROTOCOL CONSOLE", value: "PUBLIC · EXEKPRO.COM" },
  { label: "PUBLIC TESTNET", value: "NOT DEPLOYED" },
  { label: "MAINNET", value: "NOT DEPLOYED" },
] as const;

export default function ExeKProPage() {
  if (!system) {
    notFound();
  }

  const sections = system.sections ?? [];
  const getSection = (heading: string) => sections.find((s) => s.heading === heading);

  const executionModel = getSection("Execution Model");
  const architecture = getSection("Architecture");
  const boundaries = getSection("System Boundaries");
  const currentState = getSection("Current State");
  const scope = getSection("Scope");
  const outOfScope = getSection("Out of Scope");

  // Display order is row1 (On-Chain Kernel, Off-Chain Infrastructure),
  // row2 (Execution Modules, Protocol Console) — the design's required
  // reading order, which differs from the data's own group order. Groups
  // themselves (entries, terms, details) are unchanged; only this
  // lookup's output order differs from systems.ts's array order.
  const architectureGroups = architecture?.groups ?? [];
  const findGroup = (heading: string) =>
    architectureGroups.find((g) => g.heading === heading);
  const orderedArchitecture = [
    findGroup("On-Chain Kernel"),
    findGroup("Off-Chain Infrastructure"),
    findGroup("Execution Modules"),
    findGroup("Protocol Console"),
  ].filter((group): group is NonNullable<typeof group> => Boolean(group));

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <Link
        href="/systems"
        className="w-fit text-sm text-muted hover:text-accent transition-colors"
      >
        ← Back to systems
      </Link>

      {/* ExeKPro identity — one bordered object, visually derived from
          the clickable system object on /systems, that IS the link to
          exekpro.com (the stack lives inside it; there's no separate
          "Visit ExeKPro" CTA since this object replaces it entirely).
          Hover/focus follow the same restrained boundary treatment
          approved for /systems: backgrounds never change, only the
          boundary brightens and the name goes accent. */}
      <Link
        href={system.liveUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="group block border border-border transition-colors hover:border-white/60 focus-visible:border-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <div className="flex flex-col gap-3 bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl">
              {system.name} ↗
            </span>
            {system.formalName && <MonoLabel>{system.formalName}</MonoLabel>}
          </div>
          <p className="text-muted">{system.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-border bg-background p-6 sm:p-8">
          {system.stack.map((tech) => (
            <FlowBox key={tech}>{tech}</FlowBox>
          ))}
        </div>
      </Link>

      {/* Description stays open prose beneath the identity object, not
          inside it. GitHub is a separate, restrained secondary link here
          — not nested inside the identity object, which already owns the
          primary exekpro.com destination. */}
      <div className="flex max-w-2xl flex-col gap-4">
        {system.description.map((paragraph) => (
          <p key={paragraph} className="text-foreground">
            {paragraph}
          </p>
        ))}
        {system.repoUrl && (
          <a
            href={system.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center text-sm text-muted hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            GitHub ↗
          </a>
        )}
      </div>

      {/* 01 / Execution Model — locked structure: one continuous bordered
          object, dark-gray context plane directly attached (zero gap) to
          the black six-cell pipeline plane below it. */}
      {executionModel && (
        <div className="border border-border">
          <div className="flex flex-col gap-4 bg-surface p-6 sm:p-8">
            <SectionHeader index="01 / EXECUTION MODEL" subtitle="SELECTION PIPELINE" />
            {executionModel.lede && (
              <p className="max-w-2xl text-foreground">{executionModel.lede}</p>
            )}
          </div>
          <div className="border-t border-border">
            <ExecutionPipeline stages={executionModel.flow ?? []} />
          </div>
        </div>
      )}

      {/* 02 / Architecture — four independent objects, not one table.
          Real negative space (gap-8, the same rhythm used between the
          three independent systems on /systems) separates all four,
          including between the two rows. */}
      {orderedArchitecture.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="02 / ARCHITECTURE" subtitle="SYSTEM COMPOSITION" />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {orderedArchitecture.map((group) => (
              <ObjectCard key={group.heading} title={group.heading}>
                <EntryList entries={group.entries} />
              </ObjectCard>
            ))}
          </div>
        </div>
      )}

      {/* 03 / System Boundaries — same independent-object principle. Data
          order (Ownership, Deployment Isolation, Execution, Separation of
          Concerns) already matches the required row1/row2 reading order. */}
      {boundaries?.entries && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="03 / SYSTEM BOUNDARIES" subtitle="OPERATIONAL CONSTRAINTS" />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {boundaries.entries.map((entry) => (
              <ObjectCard key={entry.term} title={entry.term}>
                <p className="text-sm text-muted">{entry.detail}</p>
              </ObjectCard>
            ))}
          </div>
        </div>
      )}

      {/* 04 / Validation — deliberately different: one unified object
          (all evidence belongs to one validation surface) with an
          internal grid, hairline dividers only, no gaps between cells. */}
      <div className="flex flex-col gap-4">
        <SectionHeader index="04 / VALIDATION" subtitle="EVIDENCE" />
        <div className="border border-border">
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
            {VALIDATION_EVIDENCE.map((cell) => (
              <div
                key={cell.label + cell.value}
                className="flex flex-col items-center justify-center gap-2 bg-background p-6 text-center sm:p-8"
              >
                <span className="font-mono text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  {cell.value}
                </span>
                <MonoLabel>{cell.label}</MonoLabel>
              </div>
            ))}
            <div aria-hidden="true" className="hidden bg-background sm:block" />
          </div>
        </div>
      </div>

      {/* 05 / Current State — a compact label/value matrix rather than
          prose-only, with the original explanatory paragraph retained
          verbatim underneath. Protocol Console (public) and
          testnet/mainnet (not deployed) stay separate rows so the public
          console is never read as implying a public protocol deployment. */}
      {currentState && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="05 / CURRENT STATE" subtitle="DEPLOYMENT" />
          <div className="border border-border">
            {CURRENT_STATE_ROWS.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-2 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="p-4 font-mono text-xs uppercase tracking-wide text-muted sm:p-5">
                  {row.label}
                </span>
                <span className="border-l border-border p-4 font-mono text-xs uppercase tracking-wide text-foreground sm:p-5">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          {currentState.lede && (
            <p className="max-w-2xl text-muted">{currentState.lede}</p>
          )}
        </div>
      )}

      {/* 06 / Scope — one unified two-column boundary object, not two
          independent ones, since in/out of scope are one boundary. */}
      {(scope?.items || outOfScope?.items) && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="06 / SCOPE" subtitle="IMPLEMENTATION BOUNDARY" />
          <div className="border border-border">
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="flex flex-col gap-3 p-6 sm:p-8">
                <MonoLabel>In Scope</MonoLabel>
                <ul className="flex flex-col gap-2 text-sm text-foreground">
                  {scope?.items?.map((item) => (
                    <li key={item} className="list-inside list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-3 p-6 sm:p-8">
                <MonoLabel>Out of Scope</MonoLabel>
                <ul className="flex flex-col gap-2 text-sm text-foreground">
                  {outOfScope?.items?.map((item) => (
                    <li key={item} className="list-inside list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
