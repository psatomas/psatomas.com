import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { siteConfig } from "@/lib/site";

const description =
  "Protocol engineer building and investigating blockchain execution environments and distributed infrastructure.";

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

// Short pointers only — Systems/Research/Lab each already have their own
// full description on the homepage and on their own index pages. This
// page's job is the paragraphs above (the person), not a third copy of
// what those sections say about themselves.
const sections = [
  { label: "Systems", href: "/systems", role: "What I build" },
  { label: "Research", href: "/research", role: "How I think" },
  { label: "Lab", href: "/lab", role: "What I explore" },
];

export default function AboutPage() {
  return (
    <Container as="main" className="flex flex-1 flex-col gap-12 py-16">
      <div className="flex flex-col gap-4">
        <MonoLabel>ABOUT</MonoLabel>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h1>
        <MonoLabel className="text-dim">
          EVM · SOLIDITY · PROTOCOL DESIGN · DISTRIBUTED SYSTEMS
        </MonoLabel>
      </div>

      <div className="flex max-w-xl flex-col gap-4 border-t border-border pt-10 text-muted">
        <p>
          I&apos;m a protocol engineer. The problems that hold my attention
          are the ones where a system&apos;s design has to be exactly
          right — state transitions, execution guarantees, consistency
          under concurrent access — because there&apos;s no partial credit
          once independent parties depend on the same result.
        </p>
        <p>
          Blockchain execution environments are where that problem is
          sharpest, which is most of what I build and write about here:
          the EVM as a state machine, how caching changes what an oracle
          can honestly claim, how an intent gets resolved into one
          specific execution path. I tend to trust what I can verify
          against the real system over what should be true in theory.
        </p>
        <p>
          This site is that work directly — the systems below, the
          research, and the experiments in the Lab — not a summary of it.
        </p>
      </div>

      <ul className="flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-8">
        {sections.map((section) => (
          <li key={section.href} className="flex flex-col gap-1">
            <MonoLabel className="text-dim">{section.role}</MonoLabel>
            <Link
              href={section.href}
              className="w-fit font-semibold text-foreground hover:text-accent transition-colors"
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
