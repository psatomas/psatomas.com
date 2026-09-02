import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { experiments } from "@/lib/experiments/registry";

const description =
  "Bounded, interactive experiments in blockchain execution, MEV, and oracle infrastructure.";

export const metadata: Metadata = {
  title: "Lab",
  description,
  alternates: {
    canonical: "/lab",
  },
  openGraph: {
    title: "Lab",
    description,
    url: "/lab",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lab",
    description,
  },
};

// A public index over the same registry the homepage's interactive Lab
// section already reads (src/lib/experiments/registry.ts) — no second
// experiment list, no metadata duplicated here. This route exists so an
// experiment is individually linkable, shareable, and indexable, which
// the homepage's client-side accordion alone could never be.
export default function LabPage() {
  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Lab
        </h1>
        <p className="max-w-xl text-muted">
          Bounded technical experiments — each one built to test a single
          idea about how a protocol behaves, not to demonstrate a finished
          product.
        </p>
      </div>

      <ul className="flex flex-col border-t border-border">
        {experiments.map((experiment) => (
          <li key={experiment.id}>
            {experiment.enabled ? (
              <Link
                href={`/lab/${experiment.id}`}
                className="group flex flex-col gap-2 border-b border-border py-6 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MonoLabel className="text-accent">
                    {experiment.index}
                  </MonoLabel>
                  <span className="font-mono text-lg font-semibold tracking-tight text-foreground group-hover:text-accent transition-colors">
                    {experiment.title}
                  </span>
                </div>
                <MonoLabel className="text-dim">{experiment.subtitle}</MonoLabel>
              </Link>
            ) : (
              <div className="flex flex-col gap-2 border-b border-border py-6 opacity-45">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <MonoLabel>{experiment.index}</MonoLabel>
                    <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
                      {experiment.title}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-dim">
                    SOON
                  </span>
                </div>
                <MonoLabel className="text-dim">{experiment.subtitle}</MonoLabel>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Container>
  );
}
