import type { Metadata } from "next";
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

export default function AboutPage() {
  return (
    <Container as="main" className="flex flex-1 flex-col gap-12 py-16">
      {/* Identity: name + current positioning + a one-sentence statement
          of direction. The photo pairs with this block the same way it
          pairs with the name in the homepage Hero (src/components/sections/hero.tsx)
          — a plain crop, no border, background color-matched to the page
          — just sized for this page's narrower Container instead of the
          homepage's wide two-column layout. */}
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

      <p className="max-w-xl text-lg text-muted">
        I care less about whether a system works once than about
        understanding what has to remain true for it to keep working.
        That changes the questions I ask while building: what happens
        outside the expected input range, which assumptions exist only
        in the design, where failure can propagate, and whether the
        deployed system actually preserves the guarantees the code was
        supposed to establish.
      </p>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10">
        <MonoLabel>BACKGROUND</MonoLabel>
        <p className="text-muted">
          My background in software engineering gave me experience
          building across application boundaries, but protocol work has
          changed what I consider the object being engineered. The
          contract is only one part of it. The execution path that
          reaches it, the authority that can change it, the services
          reconstructing its state, and the deployment that puts those
          assumptions into effect can all determine whether the system
          behaves correctly.
        </p>
        <p className="text-muted">
          That has made &ldquo;it works&rdquo; a less useful stopping
          point for me. I want to know what made it work, which
          conditions that answer depends on, and what happens when those
          conditions stop being friendly.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10">
        <MonoLabel>BLOCKCHAIN</MonoLabel>
        <p className="text-muted">
          Blockchain makes some of those questions difficult to postpone.
          State is persistent, authority has to be explicit, economic
          mistakes can become accounting problems, and deployed bytecode
          may leave no opportunity to quietly replace a bad assumption.
        </p>
        <p className="text-muted">
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
        <p className="text-muted">
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
        <p className="text-muted">
          Those are small implementation decisions individually, but
          together they reflect an important distinction for me: the
          source code can describe the system I intended to deploy; it
          cannot, by itself, prove the system that is actually there.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10">
        <MonoLabel>HOW I THINK ABOUT SYSTEMS</MonoLabel>
        <p className="text-muted">
          I tend to learn the most about an implementation by pushing
          against the assumptions that made its happy path
          straightforward.
        </p>
        <p className="text-muted">
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
        <p className="text-muted">
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
        <p className="text-muted">
          Accounting has pushed me toward the same kind of explicitness.
          A contract balance says what the contract holds; it
          doesn&apos;t necessarily say what the protocol is free to
          spend. Separating staking principal from the reward reserve in
          StakeVerse made that distinction concrete: principal, available
          rewards, and accrued obligations needed to have different
          meanings in the model rather than being inferred from one pool
          of tokens.
        </p>
        <p className="text-muted">
          The pattern I keep returning to is to make assumptions
          observable and enforceable. Find the boundary, decide what
          must remain true across it, test the conditions most likely to
          violate it, and then verify the resulting behavior at the
          level where the guarantee actually matters. Sometimes
          that&apos;s a Solidity test. Sometimes it&apos;s an execution
          module, an indexer, a deployment, or a service running outside
          the chain.
        </p>
        <p className="text-muted">
          Passing the test suite is evidence. I don&apos;t want it to be
          the only evidence.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10">
        <MonoLabel>ENGINEERING DIRECTION</MonoLabel>
        <p className="text-muted">
          That standard is also shaping where I&apos;m going deeper.
        </p>
        <p className="text-muted">
          ExeKPro has taken me further into execution models and the
          interaction between protocol logic and the infrastructure
          around it. Work on EVM state transitions has pushed me below
          Solidity&apos;s surface toward understanding what the machine
          is actually doing with calls, storage, gas, reverts, and
          atomicity. Fuzzing and adversarial testing have made me more
          interested in designing invariants before a failure reveals
          why they were needed.
        </p>
        <p className="text-muted">
          There is still a large distance between exploring these
          mechanisms in my own systems and operating protocols at
          production scale, and I don&apos;t want this site to pretend
          otherwise. What I do want is for each project to push the next
          one toward stronger reasoning: fewer implicit assumptions,
          clearer boundaries, better failure isolation, and verification
          that reaches beyond the implementation that produced the
          result.
        </p>
        <p className="text-muted">
          That&apos;s the direction of the work here: deeper into
          protocol architecture and execution, while becoming more
          rigorous about the guarantees those systems actually provide.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-10">
        <MonoLabel>THIS SITE</MonoLabel>
        <p className="max-w-xl text-muted">
          <Link href="/systems" className={linkClass}>
            Systems
          </Link>{" "}
          is where those ideas become working implementations.
        </p>
        <p className="max-w-xl text-muted">
          <Link href="/research" className={linkClass}>
            Research
          </Link>{" "}
          is where I slow down around a technical question and work
          through the mechanism underneath it.
        </p>
        <p className="max-w-xl text-muted">
          <Link href="/lab" className={linkClass}>
            Lab
          </Link>{" "}
          is where I isolate smaller behaviors and test them directly.
        </p>
        <p className="max-w-xl text-muted">
          Together, they document the same process from different
          angles:{" "}
          <strong className="font-semibold text-foreground">
            build, challenge, verify, understand.
          </strong>
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10">
        <MonoLabel>THE STANDARD</MonoLabel>
        <p className="text-muted">
          I&apos;m not trying to make every project larger. I&apos;m
          trying to make the standard behind each one higher.
        </p>
        <p className="text-muted">
          A system should do what it was designed to do, but it should
          also make its assumptions visible, contain failure where it
          begins, preserve the meaning of its state, and give me a way
          to verify those properties beyond the path I expected to work.
        </p>
        <p className="text-muted">
          That&apos;s the standard I&apos;m building toward. Not just
          software that runs, but systems I can explain, challenge, and
          trust for reasons I can demonstrate.
        </p>
      </div>
    </Container>
  );
}
