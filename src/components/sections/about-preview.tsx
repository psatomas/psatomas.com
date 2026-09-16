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
// Active state (hover/focus-visible) inverts the whole Link to a
// light gray (#737982 — an inline value rather than a token: no
// existing color means "active light plane," and --muted/--foreground
// are both the wrong semantic role for it) with dark supporting text
// and a cyan heading — same signal as Systems/Research/Lab, tuned down
// from an earlier, too-bright near-white version. Unlike those three, there's no
// separate black content grid here to protect: About's entire visible
// environment IS the identity Link, so it legitimately goes light in
// full rather than partially, by construction rather than oversight.
export function AboutPreview() {
  return (
    <section
      aria-labelledby="about-heading"
      className="mx-auto flex max-w-6xl flex-col px-6 pt-14 md:pt-16"
    >
      <div className="border border-border bg-background">
        <Link
          href="/about"
          className="group flex flex-col gap-3 bg-surface p-6 transition-colors hover:bg-[#737982] focus-visible:bg-[#737982] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-8"
        >
          <MonoLabel className="transition-colors group-hover:text-background group-focus-visible:text-background">
            Who I am
          </MonoLabel>
          <h2
            id="about-heading"
            className="text-2xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent group-focus-visible:text-accent sm:text-3xl"
          >
            About
          </h2>
          <p className="max-w-xl text-muted transition-colors group-hover:text-background group-focus-visible:text-background">
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
