import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ExperimentHeader } from "@/components/lab/experiment-header";
import { experiments, getExperiment } from "@/lib/experiments/registry";
import type { ExperimentId } from "@/types";

export function generateStaticParams() {
  return experiments
    .filter((experiment) => experiment.enabled)
    .map((experiment) => ({ id: experiment.id }));
}

export async function generateMetadata(
  props: PageProps<"/lab/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const experiment = getExperiment(id as ExperimentId);
  if (!experiment || !experiment.enabled) return {};

  const description = experiment.subtitle;
  const url = `/lab/${experiment.id}`;

  return {
    title: experiment.title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: experiment.title,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: experiment.title,
      description,
    },
  };
}

// A thin shell around the registry — this route resolves an id to an
// ExperimentEntry and renders its Component exactly as the homepage's
// interactive Lab section does (see src/components/lab/protocol-lab.tsx).
// No experiment logic lives here, and none is duplicated: the id is a
// route param, everything else — including the client/server boundary
// each experiment's own component already declares — comes from the
// registry unchanged.
export default async function LabExperimentPage(
  props: PageProps<"/lab/[id]">,
) {
  const { id } = await props.params;
  const experiment = getExperiment(id as ExperimentId);

  if (!experiment || !experiment.enabled) {
    notFound();
  }

  const { Component } = experiment;

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <Link
        href="/lab"
        className="w-fit text-sm text-muted hover:text-accent transition-colors"
      >
        ← All Lab experiments
      </Link>

      <ExperimentHeader
        index={experiment.index}
        title={experiment.title}
        subtitle={experiment.subtitle}
        designation={experiment.designation}
        excerpt={experiment.excerpt}
      />

      <Component />
    </Container>
  );
}
