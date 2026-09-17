import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { FlowBox } from "@/components/lab/flow";
import { getSystemBySlug } from "@/lib/systems";
import { SectionHeader } from "@/components/systems/section-header";
import { ObjectCard } from "@/components/systems/object-card";

// Provenance Registry follows the same isolation precedent ExeKPro and
// StakeVerse established: its presentation (locked context/mechanism
// objects, independent field-object grids, a remediation comparison, a
// trust-model comparison) is bespoke enough that it can't be expressed
// through the shared SystemSection renderer (src/app/systems/[slug]/
// page.tsx) without special-casing this system inside code no other
// system depends on any more — all three systems now have their own
// literal route, so [slug]'s generateStaticParams excludes all three
// (see that file). All factual copy below is read from
// src/lib/systems.ts, not duplicated as new hardcoded strings; only the
// layout and the short derived labels are new.
//
// Deliberate substitution: Verification Flow's data ends its flow array
// with "VALID / INVALID" (system.sections "Verification Flow" .flow),
// but this page's final mechanism-grid cell reads "RESULT" instead — the
// task's own design calls for the real four outcomes (No Records / Match
// on Latest / Match on Historical / No Matching Record, all preserved in
// full below the grid) rather than a binary label, which is more
// accurate than the two-state original, not a factual change.

const system = getSystemBySlug("provenance-registry");

export const metadata: Metadata = system
  ? {
      title: system.name,
      description: system.summary,
      alternates: {
        canonical: "/systems/provenance-registry",
      },
      openGraph: {
        title: system.name,
        description: system.summary,
        url: "/systems/provenance-registry",
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: system.name,
        description: system.summary,
      },
    }
  : {};

// A static attached-cell strip: equal-width cells sharing hairline
// dividers (the same gap-px/bg-border + bg-background technique used
// throughout the site), but with no active-cell state — unlike
// ExeKPro/StakeVerse's SequencePipeline, nothing here represents a live
// state machine advancing over time, so no animation is introduced.
function AttachedGrid({
  cells,
  columnClassName,
}: {
  cells: { lines: string[] }[];
  columnClassName: string;
}) {
  return (
    <div className={`grid gap-px bg-border ${columnClassName}`}>
      {cells.map((cell) => (
        <div
          key={cell.lines.join(" ")}
          className="flex min-h-[5.5rem] flex-col items-center justify-center gap-0.5 bg-background p-3 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-muted sm:p-4"
        >
          {cell.lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// Independent field objects: all but the last in a 2-column grid, the
// last full-width — the same "N-in-2col + 1 full-width" shape ExeKPro
// and StakeVerse already use for their own domain grids, redefined here
// (not imported from either) since neither page exports it and this
// route owns its own presentation independently.
function FieldGrid({ items }: { items: { title: string; detail: string }[] }) {
  const primary = items.slice(0, -1);
  const last = items[items.length - 1];
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {primary.map((item) => (
          <ObjectCard key={item.title} title={item.title}>
            <p className="text-sm text-muted">{item.detail}</p>
          </ObjectCard>
        ))}
      </div>
      {last && (
        <ObjectCard title={last.title}>
          <p className="text-sm text-muted">{last.detail}</p>
        </ObjectCard>
      )}
    </div>
  );
}

// Line-wraps for stage labels that need them — forced, independent of
// container width, matching the convention established by ExeKPro's own
// stage-wrapping map. Hyphens mark a visual break in an otherwise
// unbroken identifier (e.g. the real function name stays
// getProtocolHistory(), only its *display* wraps).
const REGISTRATION_STAGE_LINES: Record<string, string[]> = {
  "OWNER WALLET": ["OWNER", "WALLET"],
  "REGISTER UI": ["REGISTER", "UI"],
  METAMASK: ["METAMASK"],
  "REGISTERPROTOCOLRECORD()": ["REGISTER-", "PROTOCOL-", "RECORD()"],
  "APPEND TO STORAGE": ["APPEND TO", "STORAGE"],
  PROTOCOLREGISTERED: ["PROTOCOL-", "REGISTERED"],
};

const VERIFICATION_STAGE_LINES: Record<string, string[]> = {
  PDF: ["PDF"],
  "BROWSER KECCAK256": ["BROWSER", "KECCAK256"],
  "GETPROTOCOLHISTORY()": ["GETPROTOCOL-", "HISTORY()"],
  "HASH COMPARISON": ["HASH", "COMPARISON"],
  "VALID / INVALID": ["RESULT"],
};

// Provenance History's own flow repeats the same unspaced identifier.
const PROVENANCE_HISTORY_STAGE_LINES: Record<string, string[]> = {
  "GETPROTOCOLHISTORY()": ["GETPROTOCOL-", "HISTORY()"],
};

function toCells(stages: string[], lineMap: Record<string, string[]>) {
  return stages.map((label) => ({ lines: lineMap[label] ?? [label] }));
}

// Short domain labels for Architecture's four attached cells — mapped
// from each group's own heading, parallel to system.sections
// "Architecture" .groups.
const ARCHITECTURE_LABELS: Record<string, string> = {
  "Client Layer": "CLIENT",
  "Web3 Layer": "WEB3",
  "Contract Layer": "CONTRACT",
  Blockchain: "BLOCKCHAIN",
};

// Evidence tags for Verification Evidence, parallel by index to
// system.sections "Verification Evidence" .items.
const EVIDENCE_LABELS = [
  "TEST SUITE",
  "TEST COVERAGE",
  "DEPLOY PIPELINE",
  "DEPLOY / SANITY CHECK",
  "DEPLOY / SIMULATION",
  "SOURCE VERIFICATION",
];

// Left-column tags for Current Limitations, parallel by index to
// system.sections "Current Limitations" .items.
const LIMITATION_LABELS = [
  "OWNERSHIP MODEL",
  "AUDIT HASH",
  "COMMIT HASH",
  "CONTRACT ADDRESS",
  "HISTORY QUERY",
  "FRONTEND TESTING",
  "NETWORK ENFORCEMENT",
  "SUPERSEDED CONTRACT",
];

// The video pitch's fact string is already a real URL missing only its
// scheme ("youtube.com/watch?v=..."); this reconstructs a clickable link
// from that same text rather than inventing a new address. The pitch
// deck and the contract address have no concrete URL anywhere in the
// data, so neither is turned into a link.
function withHttps(value: string) {
  return value.startsWith("http") ? value : `https://${value}`;
}

export default function ProvenanceRegistryPage() {
  if (!system) {
    notFound();
  }

  const sections = system.sections ?? [];
  const getSection = (heading: string) => sections.find((s) => s.heading === heading);

  const systemModel = getSection("System Model");
  const architecture = getSection("Architecture");
  const contractModel = getSection("Contract Model");
  const registrationFlow = getSection("Registration Flow");
  const verificationFlow = getSection("Verification Flow");
  const provenanceHistory = getSection("Provenance History");
  const security = getSection("Security & Invariants");
  const remediation = getSection("Remediation");
  const verificationEvidence = getSection("Verification Evidence");
  const deployment = getSection("Deployment");
  const currentLimitations = getSection("Current Limitations");
  const trustModel = getSection("Trust Model");

  const architectureCells = (architecture?.groups ?? []).map((group) => {
    const entry = group.entries[0];
    return {
      label: ARCHITECTURE_LABELS[group.heading] ?? group.heading.toUpperCase(),
      tech: entry?.term ?? "",
      detail: entry?.detail ?? "",
    };
  });

  const contractFields = (contractModel?.entries ?? []).map((entry) => ({
    title: entry.term,
    detail: entry.detail,
  }));

  const remediationEntries = remediation?.entries ?? [];
  const supersededEntry = remediationEntries.find((e) => e.term === "Superseded Deployment");
  const currentEntry = remediationEntries.find((e) => e.term === "Current Deployment");

  const trustEntries = trustModel?.entries ?? [];

  const videoPitch = deployment?.entries?.find((e) => e.term === "Video Pitch")?.detail;

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <Link
        href="/systems"
        className="w-fit text-sm text-muted hover:text-accent transition-colors"
      >
        ← Back to systems
      </Link>

      {/* Project identity — same shape as ExeKPro/StakeVerse's: one
          bordered object that IS the link to the live application, stack
          inside, no separate "Open Provenance Registry" CTA. Provenance
          Registry has no formal name distinct from its public name, so
          no second identity line is fabricated. */}
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
          inside the identity object. */}
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

      {/* 01 / System Model — locked structure: dark-gray context plane
          (header inside, per the site's established locked-object
          convention) directly attached to a black five-cell system
          plane. The seven system properties are a separate, related but
          distinct list, so they sit below with normal spacing rather
          than inside the locked object itself. */}
      {systemModel && (
        <div className="flex flex-col gap-6">
          <div className="border border-border">
            <div className="flex flex-col gap-4 bg-surface p-6 sm:p-8">
              <SectionHeader index="01 / SYSTEM MODEL" subtitle="SYSTEM TOPOLOGY" />
              {systemModel.lede && (
                <p className="max-w-2xl text-foreground">{systemModel.lede}</p>
              )}
            </div>
            <div className="border-t border-border">
              <AttachedGrid
                cells={toCells(systemModel.flow ?? [], {})}
                columnClassName="grid-cols-1 sm:grid-cols-5"
              />
            </div>
          </div>
          {systemModel.items && (
            <div className="flex flex-wrap gap-1.5">
              {systemModel.items.map((item) => (
                <FlowBox key={item}>{item}</FlowBox>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 02 / Architecture — same locked grammar, four attached cells
          each carrying its domain label, technology, and the real
          responsibility description (not technology names alone). */}
      {architecture && (
        <div className="border border-border">
          <div className="flex flex-col gap-4 bg-surface p-6 sm:p-8">
            <SectionHeader index="02 / ARCHITECTURE" subtitle="DIRECT CLIENT → CHAIN PATH" />
            {architecture.lede && (
              <p className="max-w-2xl text-foreground">{architecture.lede}</p>
            )}
          </div>
          {architectureCells.length > 0 && (
            <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {architectureCells.map((cell) => (
                <div
                  key={cell.label}
                  className="flex flex-col gap-2 bg-background p-4 text-center sm:p-6"
                >
                  <span className="font-mono text-xs font-semibold uppercase tracking-wide text-foreground">
                    {cell.label}
                  </span>
                  <MonoLabel className="break-words">{cell.tech}</MonoLabel>
                  <p className="text-xs text-dim">{cell.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 03 / Contract Model — independent field objects, not one giant
          table, with real negative space between them. The core
          preservation-not-proof boundary is stated here as open prose
          before the fields, exactly as in the source data. */}
      {contractModel && (
        <div className="flex flex-col gap-6">
          <SectionHeader index="03 / CONTRACT MODEL" subtitle="PROTOCOL RECORD" />
          {contractModel.lede && (
            <p className="max-w-2xl text-foreground">{contractModel.lede}</p>
          )}
          {contractFields.length > 0 && <FieldGrid items={contractFields} />}
        </div>
      )}

      {/* 04 / Registration Flow — locked structure, six attached cells. */}
      {registrationFlow && (
        <div className="border border-border">
          <div className="flex flex-col gap-4 bg-surface p-6 sm:p-8">
            <SectionHeader index="04 / REGISTRATION FLOW" subtitle="AUTHORIZED WRITE PATH" />
            {registrationFlow.lede && (
              <p className="max-w-2xl text-foreground">{registrationFlow.lede}</p>
            )}
          </div>
          <div className="border-t border-border">
            <AttachedGrid
              cells={toCells(registrationFlow.flow ?? [], REGISTRATION_STAGE_LINES)}
              columnClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
            />
          </div>
        </div>
      )}

      {/* 05 / Verification Flow — locked structure, five attached cells
          ending in a generic "Result" (the four real outcomes are
          preserved in full immediately below, not reduced to a binary
          label). */}
      {verificationFlow && (
        <div className="flex flex-col gap-6">
          <div className="border border-border">
            <div className="flex flex-col gap-4 bg-surface p-6 sm:p-8">
              <SectionHeader index="05 / VERIFICATION FLOW" subtitle="CLIENT-SIDE INTEGRITY PATH" />
              {verificationFlow.lede && (
                <p className="max-w-2xl text-foreground">{verificationFlow.lede}</p>
              )}
            </div>
            <div className="border-t border-border">
              <AttachedGrid
                cells={toCells(verificationFlow.flow ?? [], VERIFICATION_STAGE_LINES)}
                columnClassName="grid-cols-1 sm:grid-cols-5"
              />
            </div>
          </div>
          {verificationFlow.items && (
            <AttachedGrid
              cells={verificationFlow.items.map((item) => ({ lines: [item] }))}
              columnClassName="grid-cols-2 sm:grid-cols-4"
            />
          )}
        </div>
      )}

      {/* 06 / Provenance History — the read path only (address → query →
          result set → timeline). Deliberately not a chain-of-records
          diagram: this is append-only historical storage, not a
          hash-linked sequence, so nothing here implies one record
          references another. */}
      {provenanceHistory && (
        <div className="flex flex-col gap-6">
          <SectionHeader index="06 / PROVENANCE HISTORY" subtitle="APPEND-ONLY STORAGE" />
          {provenanceHistory.lede && (
            <p className="max-w-2xl text-foreground">{provenanceHistory.lede}</p>
          )}
          {provenanceHistory.flow && (
            <div className="border border-border">
              <AttachedGrid
                cells={toCells(provenanceHistory.flow, PROVENANCE_HISTORY_STAGE_LINES)}
                columnClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
              />
            </div>
          )}
          {provenanceHistory.items && (
            <ul className="flex max-w-2xl flex-col gap-2 text-sm text-foreground">
              {provenanceHistory.items.map((item) => (
                <li key={item} className="list-inside list-disc">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 07 / Security & Invariants — one unified label/value matrix. */}
      {security?.entries && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="07 / SECURITY & INVARIANTS" subtitle="ENFORCED PROPERTIES" />
          {security.lede && <p className="max-w-2xl text-foreground">{security.lede}</p>}
          <div className="border border-border">
            {security.entries.map((entry, i) => (
              <div
                key={entry.term}
                className={`grid grid-cols-2 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="p-4 font-mono text-xs uppercase tracking-wide text-muted sm:p-5">
                  {entry.term}
                </span>
                <span className="break-words border-l border-border p-4 text-sm text-foreground sm:p-5">
                  {entry.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 08 / Remediation — two independent blocks with real negative
          space between them, full addresses preserved, restrained (no
          red/green dramatization). */}
      {remediation && (supersededEntry || currentEntry) && (
        <div className="flex flex-col gap-6">
          <SectionHeader index="08 / REMEDIATION" subtitle="AUTHORIZATION BOUNDARY" />
          {remediation.lede && (
            <p className="max-w-2xl text-foreground">{remediation.lede}</p>
          )}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {supersededEntry && (
              <ObjectCard title="Superseded Deployment">
                <p className="break-words font-mono text-sm text-muted">
                  {supersededEntry.detail}
                </p>
              </ObjectCard>
            )}
            {currentEntry && (
              <ObjectCard title="Current Deployment">
                <p className="break-words font-mono text-sm text-muted">
                  {currentEntry.detail}
                </p>
              </ObjectCard>
            )}
          </div>
        </div>
      )}

      {/* 09 / Verification Evidence — one unified evidence grid, all six
          facts, presented as evidence rather than promotional metrics. */}
      {verificationEvidence?.items && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="09 / VERIFICATION EVIDENCE" subtitle="VALIDATION" />
          <div className="border border-border">
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
              {verificationEvidence.items.map((item, i) => (
                <div key={item} className="flex flex-col gap-2 bg-background p-6 sm:p-8">
                  <MonoLabel>{EVIDENCE_LABELS[i] ?? ""}</MonoLabel>
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 10 / Deployment — technical registry table. Live Application and
          Video Pitch are real, existing URLs (the latter reconstructed
          from its own text, not invented) and are kept clickable; the
          contract address and pitch deck have no concrete URL in the
          data, so neither is turned into a link. */}
      {deployment?.entries && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="10 / DEPLOYMENT" subtitle="SEPOLIA / 11155111" />
          {deployment.lede && (
            <p className="max-w-2xl text-muted">{deployment.lede}</p>
          )}
          <div className="border border-border">
            {deployment.entries.map((entry, i) => (
              <div
                key={entry.term}
                className={`grid grid-cols-2 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="p-4 font-mono text-xs uppercase tracking-wide text-muted sm:p-5">
                  {entry.term}
                </span>
                <span className="break-words border-l border-border p-4 font-mono text-xs text-foreground sm:p-5">
                  {entry.term === "Live Application" && system.liveUrl ? (
                    <a
                      href={system.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    >
                      {entry.detail} ↗
                    </a>
                  ) : entry.term === "Video Pitch" && videoPitch ? (
                    <a
                      href={withHttps(videoPitch)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    >
                      {entry.detail} ↗
                    </a>
                  ) : (
                    entry.detail
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 11 / Current Limitations — candid, technical, unified matrix;
          nothing softened or omitted. */}
      {currentLimitations?.items && (
        <div className="flex flex-col gap-4">
          <SectionHeader index="11 / CURRENT LIMITATIONS" subtitle="KNOWN BOUNDARIES" />
          <div className="border border-border">
            {currentLimitations.items.map((item, i) => (
              <div
                key={item}
                className={`grid grid-cols-2 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="p-4 font-mono text-xs uppercase tracking-wide text-muted sm:p-5">
                  {LIMITATION_LABELS[i] ?? ""}
                </span>
                <span className="break-words border-l border-border p-4 text-sm text-foreground sm:p-5">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 12 / Trust Model — the page's conceptual resolution. The core
          distinction is stated prominently but plainly (a single-plane
          emphasis band, not an oversized pull-quote), then two
          independent blocks with real negative space, then a restrained
          closing line — never theatrical. */}
      {trustModel && (
        <div className="flex flex-col gap-6">
          <SectionHeader index="12 / TRUST MODEL" subtitle="WHAT THE REGISTRY PROVES" />
          {trustModel.lede && (
            <div className="border border-border bg-surface p-6 text-center sm:p-8">
              <p className="mx-auto max-w-2xl text-lg text-foreground">{trustModel.lede}</p>
            </div>
          )}
          {trustEntries.length > 0 && (
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              {trustEntries.map((entry) => (
                <ObjectCard key={entry.term} title={entry.term}>
                  <p className="text-sm text-muted">{entry.detail}</p>
                </ObjectCard>
              ))}
            </div>
          )}
          <p className="text-center font-mono text-xs uppercase tracking-[0.1em] text-dim">
            Tamper-Evident ≠ Inherently Truthful
          </p>
        </div>
      )}
    </Container>
  );
}
