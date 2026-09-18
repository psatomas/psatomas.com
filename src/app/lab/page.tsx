import { buildSocialMetadata } from "@/lib/social/metadata";
import { staticSocial } from "@/lib/social/content";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { FlowBox, FlowArrow } from "@/components/lab/flow";
import { FLOW_PREVIEW } from "@/components/lab/flow-preview";
import { experiments } from "@/lib/experiments/registry";

export const metadata: Metadata = buildSocialMetadata(staticSocial.lab);

// A public index over the same registry the homepage's Lab preview
// already reads (src/lib/experiments/registry.ts) — no second experiment
// list, no metadata duplicated here. This route exists so an experiment
// is individually linkable, shareable, and indexable.
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

      {/* Each experiment is its own independent two-plane technical
          object — identity (bg-surface) directly attached to its flow
          (bg-background) with a single divider, the same shape
          ObjectCard/Systems' own index already use for "this is one
          complete object," not a row in a shared table. Spacing between
          objects is the same gap-8 rhythm Systems' index uses for the
          same reason: negative space (not a hairline) signals
          "independent experiment." */}
      <ul className="flex flex-col gap-8">
        {experiments.map((experiment) => {
          const [first, second, third] = FLOW_PREVIEW[experiment.id];

          if (!experiment.enabled) {
            return (
              <li key={experiment.id}>
                <div className="border border-border opacity-45">
                  <div className="flex flex-col gap-3 bg-surface p-6 sm:p-8">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        {/* Not MonoLabel: see the enabled-card branch below
                            for why (MonoLabel's own text-muted always wins
                            the Tailwind v4 cascade over a passed text-accent
                            override). */}
                        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
                          {experiment.index}
                        </span>
                        <span className="font-mono text-[10px] tracking-[0.1em] text-dim">
                          SOON
                        </span>
                      </div>
                      <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
                        {experiment.title}
                      </span>
                      <MonoLabel className="text-dim">{experiment.subtitle}</MonoLabel>
                    </div>
                    <p className="max-w-xl text-muted">{experiment.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background p-6 sm:p-8">
                    <FlowBox>{first}</FlowBox>
                    <FlowArrow />
                    <FlowBox>{second}</FlowBox>
                    <FlowArrow />
                    <FlowBox emphasis>{third}</FlowBox>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={experiment.id}>
              {/* One <Link> is the entire object — identity plane and
                  flow plane are its direct children, so hover/focus on
                  either half activates the whole thing. Same interaction
                  language as /systems' own index: only the boundary
                  (-> border-white/60) and the title's own color respond;
                  both plane backgrounds stay exactly as they are at rest,
                  so this reads as "this object is targeted," not a
                  marketing-card hover. */}
              <Link
                href={`/lab/${experiment.id}`}
                className="group block border border-border transition-colors hover:border-white/60 focus-visible:border-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                <div className="flex flex-col gap-3 bg-surface p-6 sm:p-8">
                  <div className="flex flex-col gap-1">
                    {/* Not MonoLabel, deliberately: MonoLabel's own base
                        classString hardcodes text-muted, and Tailwind v4
                        emits utility rules in alphabetical-by-class-name
                        order, so a text-accent override can never win that
                        cascade regardless of class order (same fix as
                        ExperimentHeader and the Research article page).
                        Reproducing MonoLabel's exact typographic classes
                        directly here, with no competing color utility, is
                        what actually renders this cyan. */}
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
                      {experiment.index}
                    </span>
                    <span className="font-mono text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent">
                      {experiment.title}
                    </span>
                    <MonoLabel className="text-dim">{experiment.subtitle}</MonoLabel>
                  </div>
                  <p className="max-w-xl text-muted">{experiment.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background p-6 sm:p-8">
                  <FlowBox>{first}</FlowBox>
                  <FlowArrow />
                  <FlowBox>{second}</FlowBox>
                  <FlowArrow />
                  <FlowBox emphasis>{third}</FlowBox>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
