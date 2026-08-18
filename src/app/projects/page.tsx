import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Tag } from "@/components/ui/tag";
import { getAllProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects — Tomás Araújo",
  description:
    "Protocol engineering, smart contract, and blockchain infrastructure projects.",
};

export default function ProjectsPage() {
  const projects = getAllProjects();

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Projects
        </h1>
        <p className="max-w-xl text-muted">
          Protocol engineering, smart contracts, and blockchain
          infrastructure — the systems I&apos;ve built and am building.
        </p>
      </div>

      <ul className="flex flex-col gap-10">
        {projects.map((project) => (
          <li key={project.slug} className="flex flex-col gap-2">
            <Link
              href={`/projects/${project.slug}`}
              className="w-fit text-lg font-medium hover:text-accent transition-colors"
            >
              {project.name}
            </Link>
            <p className="text-sm text-muted">{project.tagline}</p>
            <p className="max-w-xl text-muted">{project.summary}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {project.stack.map((tech) => (
                <Tag key={tech}>{tech}</Tag>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Container>
  );
}
