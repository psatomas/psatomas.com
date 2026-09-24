import { siteConfig } from "../site.ts";
import type { System, ExperimentDefinition } from "../../types/index.ts";
import type { ResearchArticleMetadata } from "../research/domain.ts";
import type { SocialDescriptor } from "./metadata.ts";

export const staticSocial = {
  home: {
    path: "/", title: siteConfig.title, imageTitle: siteConfig.name,
    description: siteConfig.description, environment: "PORTFOLIO",
    category: "PROTOCOL ENGINEERING", type: "website",
    supporting: "EVM execution · Protocol design · Distributed systems",
  },
  about: {
    path: "/about", title: "About", environment: "ABOUT", category: siteConfig.name,
    description: "Blockchain developer working in Solidity, TypeScript, and the EVM, moving deeper into protocol-level engineering.",
    supporting: "Solidity · TypeScript · EVM", type: "profile",
  },
  map: {
    path: "/map", title: "Map", environment: "MAP", category: "PROTOCOL ENGINEERING",
    description: "A structured knowledge environment for understanding Protocol Engineering and the systems behind programmable digital economies.",
    supporting: "Foundations · Execution · Coordination · Autonomous systems", type: "website",
  },
  systems: {
    path: "/systems", title: "Systems", environment: "SYSTEMS", category: "PROTOCOLS / INFRASTRUCTURE",
    description: "Protocol engineering, smart contract, and blockchain infrastructure systems.",
    supporting: "Protocol engineering and blockchain infrastructure", type: "website",
  },
  research: {
    path: "/research", title: "Research", environment: "RESEARCH", category: "EVM / PROTOCOLS / DISTRIBUTED SYSTEMS",
    description: "Research by Tomás Araújo on EVM execution, protocol engineering, and distributed systems.",
    supporting: "EVM execution · Protocol engineering · Distributed systems", type: "website",
  },
  lab: {
    path: "/lab", title: "Lab", environment: "LAB", category: "INTERACTIVE EXPERIMENTS",
    description: "Bounded, interactive experiments in blockchain execution, MEV, and oracle infrastructure.",
    supporting: "Execution · MEV · Oracle infrastructure", type: "website",
  },
} satisfies Record<string, SocialDescriptor>;

export function systemSocial(system: System): SocialDescriptor {
  return { path: `/systems/${system.slug}`, title: system.name, description: system.summary,
    environment: "SYSTEMS", category: system.formalName ?? "PROTOCOLS / INFRASTRUCTURE",
    supporting: system.tagline, type: "website" };
}

export function experimentSocial(experiment: ExperimentDefinition): SocialDescriptor {
  return { path: `/lab/${experiment.id}`, title: experiment.title, description: experiment.description,
    environment: `LAB / EXP. ${experiment.index}`, category: experiment.subtitle,
    supporting: experiment.description, type: "website" };
}

export function articleSocial(article: ResearchArticleMetadata): SocialDescriptor {
  return { path: `/research/${article.slug}`, title: article.title, description: article.description,
    environment: "RESEARCH", category: article.category, supporting: article.description,
    type: "article", publishedAt: article.publishedAt, tags: article.tags };
}

type SocialSources = {
  system: (slug: string) => System | undefined;
  experiment: (id: string) => (ExperimentDefinition & { enabled: boolean }) | undefined;
  publishedArticle: (slug: string) => Promise<ResearchArticleMetadata | undefined>;
};

/** Resolve only public content. No arbitrary text, external URLs, or query inputs. */
export async function resolveSocialPath(
  segments: string[], sources: SocialSources,
): Promise<SocialDescriptor | undefined> {
  if (segments.length < 1 || segments.length > 2 ||
      segments.some((segment) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment))) return;
  const [environment, slug] = segments;
  if (segments.length === 1) {
    return Object.values(staticSocial).find((page) => page.path === `/${environment}`);
  }
  if (environment === "systems") {
    const system = sources.system(slug);
    return system ? systemSocial(system) : undefined;
  }
  if (environment === "lab") {
    const experiment = sources.experiment(slug);
    return experiment?.enabled ? experimentSocial(experiment) : undefined;
  }
  if (environment === "research") {
    const article = await sources.publishedArticle(slug);
    return article ? articleSocial(article) : undefined;
  }
}
