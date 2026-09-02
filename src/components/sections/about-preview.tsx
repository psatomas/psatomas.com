import { SectionIntro, SectionLink } from "@/components/sections/section-intro";

// A short introduction to the person, not a restatement of the site's
// own structure — that framing is exactly what the audit flagged as
// wrong here. The full version (why this problem space, how the work
// gets approached) lives at /about; this is the two-sentence version
// that should make someone want to open it.
export function AboutPreview() {
  return (
    <section
      aria-labelledby="about-heading"
      className="mx-auto flex max-w-6xl flex-col gap-6 border-t border-border px-6 pt-14 md:pt-16"
    >
      <SectionIntro id="about-heading" role="Who I am" heading="About" />
      <p className="max-w-xl text-muted">
        Protocol engineer drawn to the layer where a system&apos;s design
        has to be exactly right — state transitions, execution
        guarantees, consistency under load. Most of what&apos;s below is
        that work, worked through directly.
      </p>
      <SectionLink href="/about">Read more</SectionLink>
    </section>
  );
}
