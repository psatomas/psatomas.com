import { SectionIntro, SectionLink } from "@/components/sections/section-intro";

// An editorial excerpt, not the About page reproduced — the full version
// (career-agnostic identity statement, links to the other three sections,
// external profiles) lives at /about and stays the authoritative one. No
// biography is stated here beyond what's already established in the
// Hero/site config: the role, and that the rest of this site is the
// actual work, not a summary of it.
export function AboutPreview() {
  return (
    <section aria-labelledby="about-heading" className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <div className="flex flex-col gap-6 border-t border-border pt-16 md:pt-20">
        <SectionIntro id="about-heading" role="Who I am" heading="About" />
        <p className="max-w-xl text-muted">
          Protocol engineer working on blockchain execution environments,
          smart contracts, and distributed infrastructure. The systems,
          research, and experiments below are that work — not a summary
          written about it afterward.
        </p>
        <SectionLink href="/about">Read more</SectionLink>
      </div>
    </section>
  );
}
