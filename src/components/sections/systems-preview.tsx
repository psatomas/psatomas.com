import Link from "next/link";
import { SectionIntro, SectionLink } from "@/components/sections/section-intro";
import { getAllSystems } from "@/lib/systems";

// Reads the same getAllSystems() the full /systems page reads — no
// homepage-specific systems list. Every system gets one compact line
// (name + tagline only, no summary/stack/description) so the page makes
// it obvious there are several of them without becoming a second copy of
// /systems's content.
export function SystemsPreview() {
  const systems = getAllSystems();

  return (
    <section
      aria-labelledby="systems-heading"
      className="mx-auto flex max-w-6xl flex-col gap-8 border-t border-border px-6 pt-14 md:pt-16"
    >
      <SectionIntro
        id="systems-heading"
        role="What I build"
        heading="Systems"
      />

      <ul className="flex flex-col">
        {systems.map((system) => (
          <li key={system.slug} className="border-t border-border first:border-t-0">
            <Link
              href={`/systems/${system.slug}`}
              className="group flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <span className="font-medium text-foreground group-hover:text-accent transition-colors">
                {system.name}
              </span>
              <span className="font-mono text-xs tracking-[0.04em] text-dim">
                {system.tagline}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <SectionLink href="/systems">View all systems</SectionLink>
    </section>
  );
}
