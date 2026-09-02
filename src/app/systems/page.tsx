import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Tag } from "@/components/ui/tag";
import { getAllSystems } from "@/lib/systems";

const description =
  "Protocol engineering, smart contract, and blockchain infrastructure systems.";

export const metadata: Metadata = {
  title: "Systems",
  description,
  alternates: {
    canonical: "/systems",
  },
  openGraph: {
    title: "Systems",
    description,
    url: "/systems",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Systems",
    description,
  },
};

export default function SystemsPage() {
  const systems = getAllSystems();

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Systems
        </h1>
        <p className="max-w-xl text-muted">
          Protocol engineering, smart contracts, and blockchain
          infrastructure — the systems I&apos;ve built and am building.
        </p>
      </div>

      <ul className="flex flex-col gap-10">
        {systems.map((system) => (
          <li key={system.slug} className="flex flex-col gap-2">
            <Link
              href={`/systems/${system.slug}`}
              className="w-fit text-lg font-medium hover:text-accent transition-colors"
            >
              {system.name}
            </Link>
            <p className="text-sm text-muted">{system.tagline}</p>
            <p className="max-w-xl text-muted">{system.summary}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {system.stack.map((tech) => (
                <Tag key={tech}>{tech}</Tag>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Container>
  );
}
