import Link from "next/link";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { getAllProjects } from "@/lib/projects";

export default function Home() {
  const projects = getAllProjects();

  return (
    <Container as="main" className="flex flex-1 flex-col gap-20 py-16">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tomás Araújo — Protocol Engineer |{" "}
          <span className="text-accent">EVM &amp; SVM</span>
        </h1>
        <p className="max-w-xl text-lg text-muted">
          I build protocol infrastructure and smart contracts across the EVM
          and SVM ecosystems — blockchain, Web3, and the systems that hold
          them together.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>About</SectionHeading>
        <p className="max-w-xl text-zinc-700 dark:text-zinc-300">
          My work centers on protocol engineering: Solidity and EVM internals,
          smart contract systems, and the infrastructure that keeps
          decentralized protocols reliable. I write about what I build and
          learn along the way.
        </p>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading>Featured Work</SectionHeading>
        <ul className="flex flex-col gap-6">
          {projects.map((project) => (
            <li key={project.slug} className="flex flex-col gap-1">
              <Link
                href={`/projects/${project.slug}`}
                className="w-fit font-medium hover:text-accent transition-colors"
              >
                {project.name}
              </Link>
              <span className="text-muted">{project.summary}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/projects"
          className="w-fit text-sm font-medium text-accent hover:underline"
        >
          View all projects →
        </Link>
      </section>
    </Container>
  );
}
