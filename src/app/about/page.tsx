import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { siteConfig } from "@/lib/site";
import portrait from "@/assets/portrait.jpg";

const description =
  "Blockchain developer working in Solidity, TypeScript, and the EVM, moving deeper into protocol-level engineering.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About",
    description,
    url: "/about",
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: "About",
    description,
  },
};

const linkClass =
  "font-semibold text-foreground hover:text-accent transition-colors";

// Shared prose treatment for every paragraph inside the indexed
// document. md:text-justify (not a smaller breakpoint): the prose
// column is capped at max-w-xl (36rem), which only reaches its full,
// comfortable width once the surrounding Container itself is no longer
// viewport-constrained — below md the same column is narrower, and
// justifying it produced visibly uneven word-spacing (checked directly
// at 640px, not assumed). text-left is the explicit default below md
// rather than an accident of omission.
const proseClass = "text-left text-muted md:text-justify";

// The engineering scope block's own data — the six engineering concerns
// the About narrative actually demonstrates, summarized rather than
// indexed: this is deliberately a separate small list rather than
// derived from the indexed document below, since these six concepts
// don't map 1:1 onto the document's own six sections (they're a
// cross-cutting summary, not a table of contents).
const engineeringScopeItems = [
  { concept: "EXECUTION", detail: "EVM · calls · gas" },
  { concept: "STATE", detail: "storage · accounting" },
  { concept: "AUTHORITY", detail: "ownership · access" },
  { concept: "FAILURE", detail: "isolation · recovery" },
  { concept: "VERIFICATION", detail: "tests · invariants" },
  { concept: "INFRASTRUCTURE", detail: "indexers · deployment" },
] as const;

/**
 * Per-item divider borders for the engineering scope's 3-column x 2-row
 * (row-major) grid — explicit rather than the gap-color "peek-through"
 * trick used elsewhere on the site, per the same reasoning that already
 * applied to this page's own former section index: a shared `gap-px`/
 * `bg-border`/`bg-background` divider can silently omit part of a
 * divider when a grid's per-cell edges aren't uniform, so every edge is
 * computed explicitly here instead. Row-major DOM order (items 0-2 are
 * the top row, 3-5 the bottom row) means this is simpler than the
 * former column-major index: `isBottomRow` and `isLastColumn` alone
 * decide every edge. `sm:border-b-0` only has something to cancel for
 * indices 3/4 (index 5 never gets a base border-b, since it's also the
 * last item overall) — a harmless no-op there, same as the pattern this
 * mirrors. Below `sm`, everything is one stacked column in DOM order, so
 * every item except the very last needs the same bottom divider,
 * computed as the unprefixed (mobile-first) `border-b`.
 */
function engineeringScopeItemBorderClass(index: number): string {
  const isLastOverall = index === 5;
  const isBottomRow = index >= 3;
  const isLastColumn = index % 3 === 2;

  return [
    !isLastOverall && "border-b border-border",
    isBottomRow && "sm:border-b-0",
    !isLastColumn && "sm:border-r",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * A section heading for the indexed document below — same typographic
 * voice as MonoLabel (font-mono, uppercase, tracked), but a real <h2>
 * rather than MonoLabel's own <span>, since these are genuine document
 * sections that should be heading-navigable, not decorative labels.
 * Deliberately local to this file rather than a change to the shared
 * MonoLabel component: nothing else on the site needs an indexed,
 * three-color heading like this, and MonoLabel itself is used well
 * beyond About (homepage, Systems, Research, Lab).
 * Colors mirror Lab's own index/title convention (see lab-preview.tsx):
 * accent number, dim separator, foreground name — the same "technical
 * identifier" language, just inlined onto one line instead of Lab's
 * stacked index/title.
 */
function SectionHeading({
  id,
  number,
  children,
}: {
  id: string;
  number: string;
  children: ReactNode;
}) {
  return (
    <h2 id={id} className="font-mono text-base uppercase tracking-[0.12em]">
      <span className="text-accent">{number}</span>
      <span className="text-dim"> / </span>
      <span className="text-foreground">{children}</span>
    </h2>
  );
}

/**
 * One section of the indexed document — indexed heading, a small
 * subordinate descriptor naming the section's role (mirroring Lab's
 * own dim MonoLabel subtitle beneath its index/title), then the
 * section's own prose — kept to a readable max-w-xl measure even
 * though the document container itself spans the full width available.
 * `first` drops the divider for 01/BACKGROUND, so the outer border is
 * the only line at the top of the document rather than a doubled one.
 * The tight gap-1 between heading and descriptor keeps them read as
 * one identity block; the larger gap-6 before the prose is the
 * "meaningful breathing room" separating that identity block from the
 * paragraphs themselves.
 */
function DocumentSection({
  id,
  number,
  title,
  descriptor,
  first = false,
  children,
}: {
  id: string;
  number: string;
  title: string;
  descriptor: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`px-6 py-8 sm:px-8 sm:py-10 ${first ? "" : "border-t border-border"}`}
    >
      <div className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <SectionHeading id={id} number={number}>{title}</SectionHeading>
          {/* Deliberately not MonoLabel here: MonoLabel is fixed at
              text-[11px], the same size as SectionHeading above it, so
              reusing it made the descriptor read as equally prominent
              rather than subordinate. One explicit size step down
              (text-[10px]) is what actually establishes that this line
              is secondary to the heading, not just differently colored. */}
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
            {descriptor}
          </span>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <Container as="main" className="flex flex-1 flex-col gap-12 py-16">
      {/* Identity: name + current positioning + a one-sentence statement
          of direction. The photo pairs with this block the same way it
          pairs with the name in the homepage Hero (src/components/sections/hero.tsx)
          — a plain crop, no border, background color-matched to the page
          — just sized for this page's narrower Container instead of the
          homepage's wide two-column layout. Stays outside the indexed
          document below: this is identity, not one of the six sections. */}
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="w-full max-w-[140px] shrink-0 overflow-hidden sm:max-w-[150px]">
          <Image
            src={portrait}
            alt={siteConfig.name}
            placeholder="blur"
            className="h-auto w-full object-cover"
            style={{ aspectRatio: "1 / 1", objectPosition: "50% 25%" }}
            sizes="150px"
            priority
          />
        </div>

        <div className="flex flex-col gap-4">
          <MonoLabel>ABOUT</MonoLabel>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {siteConfig.name}
          </h1>
          <MonoLabel>BLOCKCHAIN DEVELOPER · PROTOCOL ENGINEER</MonoLabel>
          <MonoLabel className="text-dim">
            EVM · SOLIDITY · PROTOCOL DESIGN · DISTRIBUTED SYSTEMS
          </MonoLabel>
        </div>
      </div>

      {/* Opening thesis — outside the numbered document. 01/BACKGROUND
          is where the document itself begins. Same responsive
          justification as the document prose (proseClass), reused
          rather than reinvented, so the preamble and the indexed
          document read as one consistent typographic system instead of
          the preamble looking like leftover un-migrated text.
          Deliberately no max-w-xl here (unlike the section body prose
          below): as the thesis/abstract for the whole document, it
          should span the same full structural width as the section
          index and indexed document beneath it, not the narrower
          controlled reading measure that's intentional for body
          paragraphs inside each section. */}
      <p className={`text-lg ${proseClass}`}>
        I care less about whether a system works once than about
        understanding what has to remain true for it to keep working.
        That changes the questions I ask while building: what happens
        outside the expected input range, which assumptions exist only
        in the design, where failure can propagate, and whether the
        deployed system actually preserves the guarantees the code was
        supposed to establish.
      </p>

      {/* Engineering scope — a compact, purely informational summary of
          the engineering concerns the document below actually
          demonstrates. Deliberately not navigation: no <nav>, no <Link>,
          no hover/focus treatment, no cursor affordance — just a label
          above one small bordered grid, read-only. It replaces what used
          to be a fragment-navigation "section index" here, which became
          redundant once the indexed document immediately below already
          exposes its own 01-06 structure directly; this block answers a
          different question ("what engineering concerns does this
          document cover") rather than duplicating that same table of
          contents. Row-major DOM order (top row 0-2, bottom row 3-5)
          needs no grid-flow override, unlike the former column-major
          index. Dividers are explicit per-item borders (see
          engineeringScopeItemBorderClass) rather than the gap-px/
          bg-border/bg-background "peek-through" trick used elsewhere on
          the site — chosen deliberately here so the divider geometry
          can't silently omit an edge the way the former section index's
          did before it was corrected. No numbering: 01-06 belongs only
          to the indexed document beneath this. */}
      <div className="flex flex-col gap-3">
        <MonoLabel>ENGINEERING SCOPE</MonoLabel>
        <div className="border border-border">
          <ul className="grid grid-cols-1 sm:grid-cols-3">
            {engineeringScopeItems.map((item, index) => (
              <li
                key={item.concept}
                className={`flex flex-col gap-1 px-5 py-4 ${engineeringScopeItemBorderClass(index)}`}
              >
                <span className="font-mono text-xs uppercase tracking-[0.1em] text-foreground">
                  {item.concept}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The indexed document: one outer border, six sections separated
          by internal dividers only (see DocumentSection) — never six
          independent boxes, gaps, or hoverable surfaces. Inline links
          inside the prose stay interactive; the section surfaces
          themselves are not. */}
      <div className="border border-border bg-background">
        <DocumentSection
          id="background"
          number="01"
          title="BACKGROUND"
          descriptor="ENGINEERING CONTEXT"
          first
        >
          <p className={proseClass}>
            My background in software engineering gave me experience
            building across application boundaries, but protocol work has
            changed what I consider the object being engineered. The
            contract is only one part of it. The execution path that
            reaches it, the authority that can change it, the services
            reconstructing its state, and the deployment that puts those
            assumptions into effect can all determine whether the system
            behaves correctly.
          </p>
          <p className={proseClass}>
            That has made &ldquo;it works&rdquo; a less useful stopping
            point for me. I want to know what made it work, which
            conditions that answer depends on, and what happens when those
            conditions stop being friendly.
          </p>
        </DocumentSection>

        <DocumentSection
          id="blockchain"
          number="02"
          title="BLOCKCHAIN"
          descriptor="PROTOCOL CONSTRAINTS"
        >
          <p className={proseClass}>
            Blockchain makes some of those questions difficult to postpone.
            State is persistent, authority has to be explicit, economic
            mistakes can become accounting problems, and deployed bytecode
            may leave no opportunity to quietly replace a bad assumption.
          </p>
          <p className={proseClass}>
            I encountered that directly when an authorization boundary
            that existed in the design of{" "}
            <Link href="/systems/provenance-registry" className={linkClass}>
              Provenance Registry
            </Link>{" "}
            was absent from the deployed contract. Correcting the Solidity
            was necessary, but it wasn&apos;t enough: the immutable
            contract had to be superseded by a new deployment. More
            importantly, I changed what I expected from the deployment
            process itself. It now verifies the boundary against the
            deployed contract by attempting the unauthorized behavior and
            requiring it to fail for the expected reason.
          </p>
          <p className={proseClass}>
            I&apos;ve applied the same thinking elsewhere. Ownership in{" "}
            <Link href="/systems/stakeverse" className={linkClass}>
              StakeVerse
            </Link>{" "}
            is checked again against live deployed state instead of being
            trusted because the deployment script says it was configured
            correctly. Oracle data is validated for the properties the
            protocol actually depends on rather than accepted simply
            because it arrived through an on-chain interface.
          </p>
          <p className={proseClass}>
            Those are small implementation decisions individually, but
            together they reflect an important distinction for me: the
            source code can describe the system I intended to deploy; it
            cannot, by itself, prove the system that is actually there.
          </p>
        </DocumentSection>

        <DocumentSection
          id="how-i-think-about-systems"
          number="03"
          title="HOW I THINK ABOUT SYSTEMS"
          descriptor="ENGINEERING METHOD"
        >
          <p className={proseClass}>
            I tend to learn the most about an implementation by pushing
            against the assumptions that made its happy path
            straightforward.
          </p>
          <p className={proseClass}>
            That is why fuzzing and adversarial tests have become more
            useful to me than their coverage numbers. While working on{" "}
            <Link href="/systems/exekpro" className={linkClass}>
              ExeKPro
            </Link>
            &apos;s scoring model, inputs outside the ranges I would
            naturally choose exposed both an arithmetic failure capable of
            interrupting execution and an unsafe integer conversion that
            could reverse the meaning of an extreme value. The important
            outcome wasn&apos;t simply fixing two bugs. It changed the
            boundary around execution modules so that one module&apos;s
            failure no longer had to become everybody else&apos;s failure.
          </p>
          <p className={proseClass}>
            I apply a similar standard to state outside the contracts. An
            indexer should not claim progress for a block it failed to
            process. A cached observation should not become
            &ldquo;current&rdquo; merely because it was retrieved
            successfully. When the{" "}
            <Link href="/lab/oracle" className={linkClass}>
              Oracle Lab experiment
            </Link>{" "}
            on this site began hitting real rate limits under concurrent
            browser sessions, sharing and coalescing requests solved the
            operational problem, but preserving the age of the underlying
            observation was the correctness requirement. The cache was
            allowed to change how data was obtained, not what that data
            claimed about the world.
          </p>
          <p className={proseClass}>
            Accounting has pushed me toward the same kind of explicitness.
            A contract balance says what the contract holds; it
            doesn&apos;t necessarily say what the protocol is free to
            spend. Separating staking principal from the reward reserve in
            StakeVerse made that distinction concrete: principal, available
            rewards, and accrued obligations needed to have different
            meanings in the model rather than being inferred from one pool
            of tokens.
          </p>
          <p className={proseClass}>
            The pattern I keep returning to is to make assumptions
            observable and enforceable. Find the boundary, decide what
            must remain true across it, test the conditions most likely to
            violate it, and then verify the resulting behavior at the
            level where the guarantee actually matters. Sometimes
            that&apos;s a Solidity test. Sometimes it&apos;s an execution
            module, an indexer, a deployment, or a service running outside
            the chain.
          </p>
          <p className={proseClass}>
            Passing the test suite is evidence. I don&apos;t want it to be
            the only evidence.
          </p>
        </DocumentSection>

        <DocumentSection
          id="engineering-direction"
          number="04"
          title="ENGINEERING DIRECTION"
          descriptor="CURRENT TRAJECTORY"
        >
          <p className={proseClass}>
            That standard is also shaping where I&apos;m going deeper.
          </p>
          <p className={proseClass}>
            ExeKPro has taken me further into execution models and the
            interaction between protocol logic and the infrastructure
            around it. Work on EVM state transitions has pushed me below
            Solidity&apos;s surface toward understanding what the machine
            is actually doing with calls, storage, gas, reverts, and
            atomicity. Fuzzing and adversarial testing have made me more
            interested in designing invariants before a failure reveals
            why they were needed.
          </p>
          <p className={proseClass}>
            There is still a large distance between exploring these
            mechanisms in my own systems and operating protocols at
            production scale, and I don&apos;t want this site to pretend
            otherwise. What I do want is for each project to push the next
            one toward stronger reasoning: fewer implicit assumptions,
            clearer boundaries, better failure isolation, and verification
            that reaches beyond the implementation that produced the
            result.
          </p>
          <p className={proseClass}>
            That&apos;s the direction of the work here: deeper into
            protocol architecture and execution, while becoming more
            rigorous about the guarantees those systems actually provide.
          </p>
        </DocumentSection>

        <DocumentSection
          id="this-site"
          number="05"
          title="THIS SITE"
          descriptor="WORKING STRUCTURE"
        >
          <p className={`max-w-xl ${proseClass}`}>
            <Link href="/systems" className={linkClass}>
              Systems
            </Link>{" "}
            is where those ideas become working implementations.
          </p>
          <p className={`max-w-xl ${proseClass}`}>
            <Link href="/research" className={linkClass}>
              Research
            </Link>{" "}
            is where I slow down around a technical question and work
            through the mechanism underneath it.
          </p>
          <p className={`max-w-xl ${proseClass}`}>
            <Link href="/lab" className={linkClass}>
              Lab
            </Link>{" "}
            is where I isolate smaller behaviors and test them directly.
          </p>
          <p className={`max-w-xl ${proseClass}`}>
            Together, they document the same process from different
            angles:{" "}
            <strong className="font-semibold text-foreground">
              build, challenge, verify, understand.
            </strong>
          </p>
        </DocumentSection>

        <DocumentSection
          id="the-standard"
          number="06"
          title="THE STANDARD"
          descriptor="CLOSING PRINCIPLE"
        >
          <p className={proseClass}>
            I&apos;m not trying to make every project larger. I&apos;m
            trying to make the standard behind each one higher.
          </p>
          <p className={proseClass}>
            A system should do what it was designed to do, but it should
            also make its assumptions visible, contain failure where it
            begins, preserve the meaning of its state, and give me a way
            to verify those properties beyond the path I expected to work.
          </p>
          <p className={proseClass}>
            That&apos;s the standard I&apos;m building toward. Not just
            software that runs, but systems I can explain, challenge, and
            trust for reasons I can demonstrate.
          </p>
        </DocumentSection>
      </div>
    </Container>
  );
}
