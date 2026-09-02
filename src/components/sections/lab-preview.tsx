import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { SectionIntro, SectionLink } from "@/components/sections/section-intro";
import { experiments } from "@/lib/experiments/registry";

const PREVIEW_COUNT = 3;

// Reads the same registry /lab reads — no homepage-specific experiment
// list. `enabled` is respected (a disabled experiment never appears here,
// matching /lab and /lab/[id]'s own behavior), and the slice is a fixed
// cap independent of how large the registry grows: adding a 21st
// experiment should not automatically bump it onto the homepage, only
// into /lab's own full index.
//
// Deliberately not interactive here — the accordion that used to live at
// this spot on the homepage now lives at /lab and /lab/[id], where an
// experiment can be linked to, shared, and indexed on its own. This keeps
// the homepage server-rendered and stops Lab from being most of the page.
export function LabPreview() {
  const featured = experiments.filter((experiment) => experiment.enabled).slice(0, PREVIEW_COUNT);

  return (
    <section aria-labelledby="lab-heading" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="flex flex-col gap-8 border-t border-border pt-16 md:pt-20">
        <SectionIntro
          id="lab-heading"
          role="What I explore"
          heading="Lab"
          description="Bounded, interactive experiments — each one a different kind of proof, none of them importing another."
        />

        <ul className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3">
          {featured.map((experiment) => (
            <li key={experiment.id} className="bg-background">
              <Link
                href={`/lab/${experiment.id}`}
                className="group flex h-full flex-col gap-2 p-6 transition-colors hover:bg-surface-hover"
              >
                <MonoLabel className="text-accent">{experiment.index}</MonoLabel>
                <span className="font-mono text-base font-semibold tracking-tight text-foreground group-hover:text-accent transition-colors">
                  {experiment.title}
                </span>
                <MonoLabel className="text-dim">{experiment.subtitle}</MonoLabel>
              </Link>
            </li>
          ))}
        </ul>

        <SectionLink href="/lab">Explore the Lab</SectionLink>
      </div>
    </section>
  );
}
