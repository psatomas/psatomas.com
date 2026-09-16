import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { MonoLabel } from "@/components/ui/mono-label";
import { Tag } from "@/components/ui/tag";
import { FlowBox, FlowArrow } from "@/components/lab/flow";
import { getAllSystems, getSystemBySlug } from "@/lib/systems";
import type { System, SystemSectionEntry } from "@/types";

// "exekpro" is excluded: it now has its own dedicated literal route
// (src/app/systems/exekpro/page.tsx) for a bespoke presentation that this
// shared, data-driven template can't express. Next.js always resolves a
// literal segment before a dynamic one, so that route already wins at
// request time regardless of this list — excluding it here just stops
// this dynamic route from also statically generating a second, dead
// /systems/exekpro output that would otherwise collide with the literal
// route's own build. StakeVerse and Provenance Registry are unaffected.
export function generateStaticParams() {
  return getAllSystems()
    .filter((system) => system.slug !== "exekpro")
    .map((system) => ({ slug: system.slug }));
}

export async function generateMetadata(
  props: PageProps<"/systems/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const system = getSystemBySlug(slug);

  if (!system) {
    return {};
  }

  const url = `/systems/${system.slug}`;

  return {
    title: system.name,
    description: system.summary,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: system.name,
      description: system.summary,
      url,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: system.name,
      description: system.summary,
    },
  };
}

// The top row prioritizes the live interface; the bottom keeps GitHub first.
function SystemLinks({
  system,
  placement,
}: {
  system: Pick<System, "name" | "liveUrl" | "repoUrl">;
  placement: "top" | "bottom";
}) {
  const live = { href: system.liveUrl, label: `Visit ${system.name} ↗` };
  const repo = { href: system.repoUrl, label: "GitHub ↗" };
  const links = (placement === "top" ? [live, repo] : [repo, live]).filter(
    (link): link is { href: string; label: string } => Boolean(link.href),
  );

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {links.map((link, index) => {
        const primary = placement === "top" ? index === 0 : link === repo;

        return (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex min-h-6 w-fit items-center text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
              primary
                ? "font-medium text-accent hover:underline"
                : "text-muted hover:text-accent transition-colors"
            }`}
          >
            {link.label}
          </a>
        );
      })}
    </div>
  );
}

// A term/detail pair — e.g. "IntentRegistry" / "Defines and validates
// registered execution intents." Used both directly (SystemSection.entries)
// and nested under a named sub-group (SystemSection.groups), so it's its
// own small component rather than inlined twice.
function EntryList({ entries }: { entries: SystemSectionEntry[] }) {
  return (
    <dl className="flex max-w-xl flex-col gap-3">
      {entries.map((entry) => (
        <div key={entry.term} className="flex flex-col gap-0.5">
          <dt className="font-mono text-sm font-medium text-foreground">
            {entry.term}
          </dt>
          <dd className="text-sm text-muted">{entry.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function SystemPage(
  props: PageProps<"/systems/[slug]">,
) {
  const { slug } = await props.params;
  const system = getSystemBySlug(slug);

  if (!system) {
    notFound();
  }

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <Link
        href="/systems"
        className="w-fit text-sm text-muted hover:text-accent transition-colors"
      >
        ← Back to systems
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {system.name}
        </h1>
        {system.formalName && <MonoLabel>{system.formalName}</MonoLabel>}
        <p className="text-muted">{system.tagline}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {system.stack.map((tech) => (
          <Tag key={tech}>{tech}</Tag>
        ))}
      </div>

      <SystemLinks system={system} placement="top" />

      <div className="flex max-w-xl flex-col gap-4">
        {system.description.map((paragraph) => (
          <p key={paragraph} className="text-foreground">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Each section can combine a lede paragraph with exactly one of:
          a short labeled flow (FlowBox/FlowArrow, the same primitive Lab
          uses), a flat bullet list (the original, still the most common
          shape), a flat term/detail list, or that same term/detail list
          split into named sub-groups — see SystemSection in src/types. */}
      {system.sections?.map((section) => (
        <div key={section.heading} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            {section.heading}
          </h2>

          {section.lede && (
            <p className="max-w-xl text-foreground">{section.lede}</p>
          )}

          {section.flow && (
            <div className="flex flex-wrap items-center gap-1.5">
              {section.flow.map((step, i) => (
                <span key={step} className="flex items-center gap-1.5">
                  {i > 0 && <FlowArrow />}
                  <FlowBox emphasis={i === section.flow!.length - 1}>
                    {step}
                  </FlowBox>
                </span>
              ))}
            </div>
          )}

          {section.items && (
            <ul className="flex max-w-xl flex-col gap-2 text-foreground">
              {section.items.map((item) => (
                <li key={item} className="list-inside list-disc">
                  {item}
                </li>
              ))}
            </ul>
          )}

          {section.entries && <EntryList entries={section.entries} />}

          {section.groups && (
            <div className="flex flex-col gap-5">
              {section.groups.map((group) => (
                <div key={group.heading} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {group.heading}
                  </h3>
                  <EntryList entries={group.entries} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <SystemLinks system={system} placement="bottom" />
    </Container>
  );
}
