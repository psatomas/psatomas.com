import { buildSocialMetadata } from "@/lib/social/metadata";
import { systemSocial } from "@/lib/social/content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { FlowBox } from "@/components/lab/flow";
import { getSystemBySlug } from "@/lib/systems";
import { SectionHeader } from "@/components/systems/section-header";
import { ObjectCard } from "@/components/systems/object-card";
import { SequencePipeline, type PipelineStage } from "@/components/systems/sequence-pipeline";

// StakeVerse follows the same isolation precedent ExeKPro established:
// its presentation (an authority-composition object, two lifecycle
// pipelines, an oracle-boundary diagram, several matrices) is bespoke
// enough that it can't be expressed through the shared SystemSection
// renderer (src/app/systems/[slug]/page.tsx) without special-casing this
// system inside code Provenance Registry also depends on. This literal
// route sits alongside [slug] instead — see the generateStaticParams
// exclusion there — with zero risk to Provenance Registry, which keeps
// rendering through the generic template unchanged. All factual copy
// below is read from src/lib/systems.ts, not duplicated as new hardcoded
// strings; only the layout and the short derived labels are new.

const system = getSystemBySlug("stakeverse");

export const metadata: Metadata = buildSocialMetadata(systemSocial(system ?? notFound()));

// The five protocol domains, used twice: once with System Model's plain-
// language summary (01), once with Architecture's precise component
// description (02) — same five-domain shape, different data source, so
// this is parametrized rather than duplicated.
function DomainGrid({ items }: { items: { title: string; detail: string }[] }) {
  const primary = items.slice(0, 4);
  const full = items[4];
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {primary.map((item) => (
          <ObjectCard key={item.title} title={item.title}>
            <p className="text-sm text-muted">{item.detail}</p>
          </ObjectCard>
        ))}
      </div>
      {full && (
        <ObjectCard title={full.title}>
          <p className="text-sm text-muted">{full.detail}</p>
        </ObjectCard>
      )}
    </div>
  );
}

// StakeVerse's own line-break maps for its two lifecycle pipelines —
// forced wrapping independent of container width (see PipelineStage).
const GOVERNANCE_STAGE_LINES: Record<string, string[]> = {
  DELEGATE: ["DELEGATE"],
  "CREATE PROPOSAL": ["CREATE", "PROPOSAL"],
  SNAPSHOT: ["SNAPSHOT"],
  VOTE: ["VOTE"],
  "QUORUM / STATE": ["QUORUM /", "STATE"],
  EXECUTE: ["EXECUTE"],
};

const STAKING_STAGE_LINES: Record<string, string[]> = {
  APPROVE: ["APPROVE"],
  STAKE: ["STAKE"],
  ACCRUE: ["ACCRUE"],
  "CLAIM / UNSTAKE": ["CLAIM /", "UNSTAKE"],
};

function toPipelineStages(
  stages: string[],
  lineMap: Record<string, string[]>,
): PipelineStage[] {
  return stages.map((label) => ({ label, lines: lineMap[label] ?? [label] }));
}

// Left-column domain tags for the Security/Invariants matrix — extracted
// from each guarantee's own subject (e.g. "the funded reward reserve" ->
// REWARD RESERVE), not new claims, parallel by index to
// system.sections "Security / Invariants" .items.
const SECURITY_LABELS = [
  "REWARD RESERVE",
  "PRINCIPAL",
  "VOTING POWER",
  "QUORUM",
  "EXECUTION",
  "AUTHORITY",
  "EMERGENCY",
  "ORACLE",
];

// Evidence tags for the Verification grid — parallel by index to
// system.sections "Verification" .items; the detail text rendered is
// always the real item string, never retyped here.
const VERIFICATION_LABELS = [
  "TEST SUITE",
  "COVERAGE",
  "CI PIPELINE",
  "FRONTEND CI",
  "DEPLOY / CHAIN ID",
  "DEPLOY / BYTECODE",
  "DEPLOY / OWNERSHIP",
  "SEPOLIA STATE",
];

// Left-column tags for the Known Boundaries matrix — parallel by index to
// system.sections "Current State" .items.
// Titles for the four staking facts, parallel by index to
// system.sections "Staking Model" .items.
const STAKING_INVARIANT_TITLES = [
  "PRINCIPAL",
  "REWARD RESERVE",
  "REWARD RATE",
  "EMERGENCY PAUSE",
];

const CURRENT_STATE_LABELS = [
  "STAKING UI",
  "ORACLE UI",
  "NFT",
  "ISSUANCE",
  "EXTERNAL REVIEW",
  "SOURCE VERIFICATION",
  "UPGRADES",
];

export default function StakeVersePage() {
  if (!system) {
    notFound();
  }

  const sections = system.sections ?? [];
  const getSection = (heading: string) => sections.find((s) => s.heading === heading);

  const systemModel = getSection("System Model");
  const architecture = getSection("Architecture");
  const oracleBoundary = getSection("Oracle Boundary");
  const governanceExecution = getSection("Governance Execution");
  const stakingModel = getSection("Staking Model");
  const security = getSection("Security / Invariants");
  const verification = getSection("Verification");
  const deployment = getSection("Deployment");
  const currentState = getSection("Current State");

  const systemModelDomains = (systemModel?.entries ?? []).map((entry) => ({
    title: entry.term,
    detail: entry.detail,
  }));

  const architectureGroups = architecture?.groups ?? [];
  const architectureDomains = architectureGroups
    .map((group) => group.entries[0])
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({ title: entry.term, detail: entry.detail }));

  // The authority-composition band: StakeVerseDAO's own component name
  // and the opening clause of its own description ("Root administrative
  // authority") pulled directly from the Governance group, plus the four
  // owned/self-owned cells derived from Architecture's own flow array
  // (["DAO", "TOKEN, STAKING, NFT, DAO (ITSELF)"]) — the same fact,
  // split for this layout rather than drawn as the old arrow/tree flow.
  const daoEntry = architectureGroups.find((g) => g.heading === "Governance")?.entries[0];
  const authorityCells = (architecture?.flow?.[1] ?? "")
    .split(", ")
    .map((label) => ({
      label,
      ownership: label === "DAO (ITSELF)" ? "SELF-OWNED" : "DAO-OWNED",
    }));

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <Link
        href="/systems"
        className="w-fit text-sm text-muted hover:text-accent transition-colors"
      >
        ← Back to systems
      </Link>

      {/* StakeVerse identity — same shape as ExeKPro's: one bordered
          object that IS the link to stakeverse.vercel.app, stack inside,
          no separate "Visit StakeVerse" CTA. StakeVerse has no formal
          name distinct from its public name (unlike ExeKPro's "Execution
          Kernel Protocol"), so no second identity line is fabricated. */}
      <Link
        href={system.liveUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="group block border border-border transition-colors hover:border-white/60 focus-visible:border-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <div className="flex flex-col gap-3 bg-surface p-6 sm:p-8">
          <span className="font-mono text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl">
            {system.name} ↗
          </span>
          <p className="text-muted">{system.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-border bg-background p-6 sm:p-8">
          {system.stack.map((tech) => (
            <FlowBox key={tech}>{tech}</FlowBox>
          ))}
        </div>
      </Link>

      {/* Description stays open prose beneath the identity object.
          GitHub is a separate, restrained secondary link — not nested
          inside the identity object, which already owns the primary
          stakeverse.vercel.app destination. */}
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

      {/* 01 / System Model — the five protocol domains as independent
          objects, not one table: four in a 2x2 grid, Oracle Boundary
          full-width to visually set the standalone boundary apart from
          the four primary domains. */}
      {systemModelDomains.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="01 / SYSTEM MODEL" subtitle="PROTOCOL DOMAINS" />
          <DomainGrid items={systemModelDomains} />
        </div>
      )}

      {/* 02 / Architecture — locked structure: one continuous authority-
          composition object (context + lede, the DAO root-authority
          band, the four ownership cells, all directly attached with no
          gap), then the actual architecture component descriptions as
          separate independent objects below with real negative space —
          no ASCII-style arrows/tree; the continuous composition itself
          carries the hierarchy. */}
      {architecture && (
        <div className="flex flex-col gap-8">
          <div className="border border-border">
            <div className="flex flex-col gap-4 bg-surface p-6 sm:p-8">
              <SectionHeader index="02 / ARCHITECTURE" subtitle="AUTHORITY COMPOSITION" />
              {architecture.lede && (
                <p className="max-w-2xl text-foreground">{architecture.lede}</p>
              )}
            </div>
            <div className="flex flex-col items-center gap-1 border-t border-border bg-background p-6 text-center sm:p-8">
              <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
                {daoEntry?.term ?? "StakeVerseDAO"}
              </span>
              <MonoLabel>Root Administrative Authority</MonoLabel>
            </div>
            {authorityCells.length > 0 && (
              <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
                {authorityCells.map((cell) => (
                  <div
                    key={cell.label}
                    className="flex flex-col items-center justify-center gap-1 bg-background p-4 text-center sm:p-6"
                  >
                    <span className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">
                      {cell.label}
                    </span>
                    <MonoLabel className="text-dim">{cell.ownership}</MonoLabel>
                  </div>
                ))}
              </div>
            )}
          </div>

          {architectureDomains.length > 0 && <DomainGrid items={architectureDomains} />}
        </div>
      )}

      {/* 03 / Governance Execution — locked structure, identical grammar
          to ExeKPro's Execution Model: dark-gray context plane directly
          attached to a black six-cell lifecycle grid, zero surrounding
          padding around the grid itself. */}
      {governanceExecution && (
        <div className="border border-border">
          <div className="flex flex-col gap-4 bg-surface p-6 sm:p-8">
            <SectionHeader index="03 / GOVERNANCE EXECUTION" subtitle="HISTORICAL VOTING PATH" />
            {governanceExecution.lede && (
              <p className="max-w-2xl text-foreground">{governanceExecution.lede}</p>
            )}
          </div>
          <div className="border-t border-border">
            <SequencePipeline
              stages={toPipelineStages(governanceExecution.flow ?? [], GOVERNANCE_STAGE_LINES)}
            />
          </div>
        </div>
      )}

      {/* 04 / Staking Model — same lifecycle grammar, four cells instead
          of six. Below it, the four staking facts become independent
          objects rather than a bullet list. */}
      {stakingModel && (
        <div className="flex flex-col gap-8">
          <div className="border border-border">
            <div className="flex flex-col gap-4 bg-surface p-6 sm:p-8">
              <SectionHeader index="04 / STAKING MODEL" subtitle="REWARD ACCOUNTING PATH" />
              {stakingModel.lede && (
                <p className="max-w-2xl text-foreground">{stakingModel.lede}</p>
              )}
            </div>
            <div className="border-t border-border">
              <SequencePipeline
                stages={toPipelineStages(stakingModel.flow ?? [], STAKING_STAGE_LINES)}
                columnClassName="grid-cols-2 sm:grid-cols-4"
              />
            </div>
          </div>

          {stakingModel.items && (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              {stakingModel.items.map((item, i) => (
                <ObjectCard key={item} title={STAKING_INVARIANT_TITLES[i] ?? ""}>
                  <p className="text-sm text-muted">{item}</p>
                </ObjectCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 05 / Oracle Boundary — a structural boundary visualization, not
          the old two-step flow: Chainlink feeds PriceOracleConsumer
          (a single static arrow, not an animation), then a dashed
          divider marks the core-protocol boundary that data does not
          currently cross — communicating disconnection, not a live
          dependency. */}
      {oracleBoundary && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="05 / ORACLE BOUNDARY" subtitle="EXTERNAL DATA" />
          <div className="border border-border">
            <div className="bg-surface p-6 sm:p-8">
              {oracleBoundary.lede && (
                <p className="max-w-2xl text-foreground">{oracleBoundary.lede}</p>
              )}
            </div>
            <div className="border-t border-border bg-background p-6 text-center sm:p-8">
              <span className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">
                Chainlink
              </span>
            </div>
            <div className="flex justify-center border-t border-border bg-background py-1 text-dim">
              ↓
            </div>
            <div className="flex flex-col items-center gap-1 border-t border-border bg-background p-6 text-center sm:p-8">
              <span className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">
                Price Oracle Consumer
              </span>
              <MonoLabel>Round completeness · Price positivity · Staleness</MonoLabel>
            </div>
            <div className="flex flex-col items-center gap-1 border-t border-dashed border-border bg-background p-6 text-center sm:p-8">
              <MonoLabel className="text-dim">Core Protocol Boundary</MonoLabel>
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-dim">
                Not currently connected
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 06 / Security — one unified invariant surface: a two-column
          matrix (domain | guarantee), attached rows, full factual
          guarantee text preserved. */}
      {security?.items && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="06 / SECURITY" subtitle="ENFORCED INVARIANTS" />
          <div className="border border-border">
            {security.items.map((item, i) => (
              <div
                key={item}
                className={`grid grid-cols-2 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="break-words p-4 font-mono text-xs uppercase tracking-wide text-muted sm:p-5">
                  {SECURITY_LABELS[i] ?? ""}
                </span>
                <span className="break-words border-l border-border p-4 text-sm text-foreground sm:p-5">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 07 / Verification — one unified evidence grid holding all eight
          facts (not a reduced subset), attached cells, hairline
          dividers, mono tag + full statement per cell. */}
      {verification?.items && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="07 / VERIFICATION" subtitle="EVIDENCE" />
          <div className="border border-border">
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
              {verification.items.map((item, i) => (
                <div key={item} className="flex flex-col gap-2 bg-background p-6 sm:p-8">
                  <MonoLabel>{VERIFICATION_LABELS[i] ?? ""}</MonoLabel>
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 08 / Deployment — a technical deployment registry table. No
          address truncation; long values wrap safely within their own
          column via break-words, which only force-breaks a token (a hex
          address) when it genuinely doesn't fit, rather than break-all's
          "break anywhere" — which would (and did, before this) split
          short unbroken values like the chain ID "11155111" mid-number
          for no reason. Addresses aren't links in the current
          data/generic renderer, so none are introduced here either. */}
      {deployment?.entries && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="08 / DEPLOYMENT" subtitle="SEPOLIA / 11155111" />
          <div className="border border-border">
            {deployment.entries.map((entry, i) => (
              <div
                key={entry.term}
                className={`grid grid-cols-2 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="break-words p-4 font-mono text-xs uppercase tracking-wide text-muted sm:p-5">
                  {entry.term}
                </span>
                <span className="break-words border-l border-border p-4 font-mono text-xs text-foreground sm:p-5">
                  {entry.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 09 / Current State — communicates limitations plainly: a
          neutral deployment-state banner, the original explanatory
          paragraph, then one continuous known-boundaries matrix (not
          another achievement grid). */}
      {currentState && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="09 / CURRENT STATE" subtitle="KNOWN BOUNDARIES" />
          <div className="border border-border bg-surface p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <MonoLabel>Deployment</MonoLabel>
              <span className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">
                Sepolia · DAO-Owned · Not Mainnet
              </span>
            </div>
          </div>
          {currentState.lede && (
            <p className="max-w-2xl text-muted">{currentState.lede}</p>
          )}
          {currentState.items && (
            <div className="border border-border">
              {currentState.items.map((item, i) => (
                <div
                  key={item}
                  className={`grid grid-cols-2 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <span className="break-words p-4 font-mono text-xs uppercase tracking-wide text-muted sm:p-5">
                    {CURRENT_STATE_LABELS[i] ?? ""}
                  </span>
                  <span className="break-words border-l border-border p-4 text-sm text-foreground sm:p-5">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Container>
  );
}
