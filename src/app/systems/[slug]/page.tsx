import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Tag } from "@/components/ui/tag";
import { getAllSystems, getSystemBySlug } from "@/lib/systems";

export function generateStaticParams() {
  return getAllSystems().map((system) => ({ slug: system.slug }));
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
        <p className="text-muted">{system.tagline}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {system.stack.map((tech) => (
          <Tag key={tech}>{tech}</Tag>
        ))}
      </div>

      <div className="flex max-w-xl flex-col gap-4">
        {system.description.map((paragraph) => (
          <p key={paragraph} className="text-foreground">
            {paragraph}
          </p>
        ))}
      </div>

      {system.sections?.map((section) => (
        <div key={section.heading} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            {section.heading}
          </h2>
          <ul className="flex max-w-xl flex-col gap-2 text-foreground">
            {section.items.map((item) => (
              <li key={item} className="list-inside list-disc">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {system.repoUrl && (
        <a
          href={system.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-sm font-medium text-accent hover:underline"
        >
          View repository ↗
        </a>
      )}
    </Container>
  );
}
