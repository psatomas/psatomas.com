import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { siteConfig, socialLinks } from "@/lib/site";

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

// The other three sections, described in exactly the terms this site
// already uses for them (see the Research/Lab case-study copy and the
// site's own IA) — this page's job is to say who's behind the other
// three, and point at them, not to restate their content.
const sections = [
  {
    label: "Systems",
    href: "/systems",
    role: "What I build",
    body: "Protocol engineering, smart contracts, and blockchain infrastructure — shipped and in progress, not case studies written after the fact.",
  },
  {
    label: "Research",
    href: "/research",
    role: "How I think",
    body: "Dense, single-thesis technical writing on execution models, protocol design, and distributed systems — published from a Cloudflare D1-backed system I built and write through myself.",
  },
  {
    label: "Lab",
    href: "/lab",
    role: "What I explore",
    body: "Bounded, interactive experiments — a static deep dive, a live simulation, and a real external system observed honestly, failures included.",
  },
];

export default function AboutPage() {
  return (
    <Container as="main" className="flex flex-1 flex-col gap-14 py-16">
      <div className="flex flex-col gap-4">
        <MonoLabel>ABOUT</MonoLabel>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {siteConfig.name}
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Protocol Engineer. I build and investigate blockchain protocols,
          execution environments, and distributed infrastructure.
        </p>
        <MonoLabel className="text-dim">
          EVM · SOLIDITY · PROTOCOL DESIGN · DISTRIBUTED SYSTEMS
        </MonoLabel>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-10">
        <p className="max-w-xl text-muted">
          This site is organized around four things, each with its own
          section:
        </p>

        <ul className="mt-4 flex flex-col">
          {sections.map((section) => (
            <li
              key={section.href}
              className="flex flex-col gap-1 border-t border-border py-6 first:border-t-0 first:pt-0"
            >
              <div className="flex items-baseline gap-3">
                <MonoLabel className="text-dim">{section.role}</MonoLabel>
              </div>
              <Link
                href={section.href}
                className="w-fit text-xl font-semibold text-foreground hover:text-accent transition-colors"
              >
                {section.label}
              </Link>
              <p className="max-w-xl text-muted">{section.body}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-10">
        <MonoLabel className="text-dim">ELSEWHERE</MonoLabel>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="font-mono text-xs tracking-[0.08em] text-muted hover:text-accent transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </Container>
  );
}
