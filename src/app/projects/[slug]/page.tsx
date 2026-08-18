import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Tag } from "@/components/ui/tag";
import { getAllProjects, getProjectBySlug } from "@/lib/projects";

export function generateStaticParams() {
  return getAllProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata(
  props: PageProps<"/projects/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const project = getProjectBySlug(slug);

  if (!project) {
    return {};
  }

  const url = `/projects/${project.slug}`;

  return {
    title: project.name,
    description: project.summary,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: project.name,
      description: project.summary,
      url,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: project.name,
      description: project.summary,
    },
  };
}

export default async function ProjectPage(
  props: PageProps<"/projects/[slug]">,
) {
  const { slug } = await props.params;
  const project = getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <Link
        href="/projects"
        className="w-fit text-sm text-muted hover:text-accent transition-colors"
      >
        ← Back to projects
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {project.name}
        </h1>
        <p className="text-muted">{project.tagline}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {project.stack.map((tech) => (
          <Tag key={tech}>{tech}</Tag>
        ))}
      </div>

      <div className="flex max-w-xl flex-col gap-4">
        {project.description.map((paragraph) => (
          <p key={paragraph} className="text-zinc-700 dark:text-zinc-300">
            {paragraph}
          </p>
        ))}
      </div>

      {project.sections?.map((section) => (
        <div key={section.heading} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            {section.heading}
          </h2>
          <ul className="flex max-w-xl flex-col gap-2 text-zinc-700 dark:text-zinc-300">
            {section.items.map((item) => (
              <li key={item} className="list-inside list-disc">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {project.repoUrl && (
        <a
          href={project.repoUrl}
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
