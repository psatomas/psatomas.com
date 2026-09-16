import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { FlowBox } from "@/components/lab/flow";
import { getAllSystems } from "@/lib/systems";

const description =
  "Protocol engineering, smart contract, and blockchain infrastructure systems.";

export const metadata: Metadata = {
  title: "Systems",
  description,
  alternates: {
    canonical: "/systems",
  },
  openGraph: {
    title: "Systems",
    description,
    url: "/systems",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Systems",
    description,
  },
};

export default function SystemsPage() {
  const systems = getAllSystems();

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Systems
        </h1>
        <p className="max-w-xl text-muted">
          Protocol engineering, smart contracts, and blockchain
          infrastructure — the systems I&apos;ve built and am building.
        </p>
      </div>

      {/* Each system is its own independent bordered object — not rows in
          one continuous document the way About reads. ExeKPro, StakeVerse,
          and Provenance Registry are separate implementations, so each
          gets its own outer border and the whole list is spaced with a
          restrained gap (the same gap-8 rhythm every homepage environment
          section already uses for its own internal spacing), not a
          hairline divider — the negative space itself is what signals
          "independent system," not a decorative rule. */}
      <ul className="flex flex-col gap-8">
        {systems.map((system) => (
          <li key={system.slug}>
            {/* One <Link> is the entire system — identity plane and
                content plane are its direct children (not nested
                interactive elements), so hover/focus on either half
                activates the whole object. `group` here lets the name
                react to the Link's own hover/focus state. Both plane
                backgrounds never change on interaction — only the
                boundary and the name respond. The boundary itself steps
                up to a brighter neutral white (border-white/60): neither
                existing border token works as a "highlighted" neutral
                here (border-strong, at 18% white, is fainter than the
                40%-white resting border, not brighter), and border-accent
                read as too aggressive for objects this large, so this is
                a narrowly-scoped arbitrary opacity on the same white-alpha
                approach the theme's own border tokens already use, not a
                new hardcoded gray — scoped to this one interaction rather
                than a new global token, since nothing else in the site
                currently needs a "brighter neutral border" step. */}
            <Link
              href={`/systems/${system.slug}`}
              className="group block border border-border transition-colors hover:border-white/60 focus-visible:border-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {/* Identity plane — the site's existing dark-gray surface
                  token (bg-surface), the same one every homepage
                  environment identity region already uses, and unchanged
                  on hover/focus: only the name (below) carries the accent
                  signal. Identity and content have no gap between them:
                  the content plane's own border-t below is the single
                  divider, so this plane carries no border-b of its own
                  (no doubled border). */}
              <div className="flex flex-col gap-2 bg-surface p-6 sm:p-8">
                <span className="font-mono text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent">
                  {system.name}
                </span>
                <MonoLabel>{system.tagline}</MonoLabel>
              </div>

              {/* Content plane — resting black (the page's own background)
                  in every state, holding the system's description and
                  stack as subordinate supporting content beneath its
                  identity. */}
              <div className="flex flex-col gap-4 border-t border-border bg-background p-6 sm:p-8">
                <p className="max-w-xl text-muted">{system.summary}</p>
                {/* Stack as a wrap of FlowBox chips — the same bordered
                    mono-box primitive the system detail pages and Lab
                    already use for flow steps, reused flat (no arrows)
                    here since this is a set, not a sequence — rather than
                    the old rounded pill Tags, which read as decorative
                    badges. These stay resting black structural units in
                    every state: the system name and outer boundary carry
                    the interaction signal, not the individual cells. */}
                <div className="flex flex-wrap gap-1.5">
                  {system.stack.map((tech) => (
                    <FlowBox key={tech}>{tech}</FlowBox>
                  ))}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
