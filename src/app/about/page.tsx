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
        I&apos;m a blockchain developer working primarily with Solidity,
        TypeScript, and the EVM. My work is increasingly focused on what
        happens beneath the application layer: how protocols represent
        state, coordinate execution, enforce invariants, and connect
        on-chain systems with the infrastructure around them.
      </p>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10">
        <MonoLabel>BACKGROUND</MonoLabel>
        <p className="text-muted">I came into blockchain through software engineering.</p>
        <p className="text-muted">
          I started with HTML and JavaScript, moved into React and
          frontend development, and then went deeper into backend systems
          with Python and Django. That led me back to TypeScript and
          Node.js, where I began working with ethers.js and viem before
          moving further into Solidity and the EVM.
        </p>
        <p className="text-muted">
          That path still influences how I approach blockchain
          development. I don&apos;t see a smart contract as an isolated
          piece of code. I look at the system around it: the state it
          owns, the transitions it permits, the services that interact
          with it, and the assumptions that exist between on-chain and
          off-chain components.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10">
        <MonoLabel>BLOCKCHAIN</MonoLabel>
        <p className="text-muted">
          I had been studying blockchain technology for some time before
          making it the focus of my development work. When I moved into
          the space, I followed a deliberate path from the application
          layer into smart contracts and EVM systems.
        </p>
        <p className="text-muted">
          Today, Solidity and the EVM are at the center of my work,
          supported by TypeScript and the infrastructure needed to build
          and operate blockchain systems.
        </p>
        <p className="text-muted">
          I&apos;m particularly interested in smart contract architecture,
          protocol mechanisms, security and auditing, deterministic
          execution, state modeling, and the boundaries between canonical
          on-chain state and derived off-chain data.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10">
        <MonoLabel>HOW I THINK ABOUT SYSTEMS</MonoLabel>
        <p className="text-muted">
          The interesting problems are often not contained within a
          single contract.
        </p>
        <p className="text-muted">
          They emerge when execution crosses system boundaries, when
          state has to be reconstructed from events, when an off-chain
          service reports information back to a protocol, or when several
          components have to agree on what happened and what should
          happen next.
        </p>
        <p className="text-muted">
          That&apos;s where my interests increasingly converge: execution,
          state transitions, consistency, coordination, and the
          guarantees that can be established across a distributed system.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10">
        <MonoLabel>ENGINEERING DIRECTION</MonoLabel>
        <p className="text-muted">
          I&apos;m moving from building blockchain applications and
          individual protocol components toward understanding and
          designing the systems underneath them.
        </p>
        <p className="text-muted">
          That means going deeper into protocol architecture, execution
          models, distributed coordination, security, and the
          infrastructure that makes decentralized systems reliable.
        </p>
        <p className="text-muted">
          The work on this site is part of that progression. Some of it
          is built software. Some of it is research. Some of it is
          deliberately small experiments designed to isolate one
          technical question and understand it properly.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-10">
        <MonoLabel>THIS SITE</MonoLabel>
        <p className="max-w-xl text-muted">
          <Link href="/systems" className={linkClass}>
            Systems
          </Link>{" "}
          is where I build and ship.
        </p>
        <p className="max-w-xl text-muted">
          <Link href="/research" className={linkClass}>
            Research
          </Link>{" "}
          is where I work through a specific technical problem and
          document what I learn.
        </p>
        <p className="max-w-xl text-muted">
          <Link href="/lab" className={linkClass}>
            Lab
          </Link>{" "}
          is where I isolate smaller ideas and test how they behave.
        </p>
        <p className="max-w-xl text-muted">
          The three are different views of the same process:{" "}
          <strong className="font-semibold text-foreground">
            build, investigate, and understand the system underneath.
          </strong>
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-10">
        <MonoLabel>ELSEWHERE</MonoLabel>
        <p className="max-w-xl text-muted">
          <a
            href="https://github.com/psatomas"
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>{" "}
          — Code, experiments, and ongoing work.
        </p>
        <p className="max-w-xl text-muted">
          <a
            href="https://linkedin.com/in/psatomas"
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>{" "}
          — Professional background and engineering direction.
        </p>
        <p className="max-w-xl text-muted">
          <a
            href="https://x.com/psatomas"
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>{" "}
          — Notes, observations, and technical interests.
        </p>
      </div>
    </Container>
  );
}
