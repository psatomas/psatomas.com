import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";

// A short introduction to the person, not a restatement of the site's
// own structure — that framing is exactly what the audit flagged as
// wrong here. The full version (why this problem space, how the work
// gets approached) lives at /about.
//
// One bordered environment, same family as Systems/Research/Lab, but
// simpler: About has no child collection underneath it, so the entire
// surface is just the /about Link itself — no divider, no grid, no
// wrapper beyond the border it needs for the hover/focus surface. A
// plain `group` is safe here for the same reason it is on the others:
// there's nothing else inside this environment for it to leak into.
export function AboutPreview() {
  return (
    <section
      aria-labelledby="about-heading"
      className="mx-auto flex max-w-6xl flex-col px-6 pt-14 md:pt-16"
    >
      <div className="border border-border bg-background">
        <Link
          href="/about"
          className="group flex flex-col gap-3 p-6 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-8"
        >
          <MonoLabel>Who I am</MonoLabel>
          <h2
            id="about-heading"
            className="text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl"
          >
            About
          </h2>
          <p className="max-w-xl text-muted">
            I work across the boundaries that determine whether a
            blockchain system stays correct: execution, state, authority,
            accounting, deployment, and the infrastructure around the
            contracts.
          </p>
        </Link>
      </div>
    </section>
  );
}
