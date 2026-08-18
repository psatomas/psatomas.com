import type { MetadataRoute } from "next";
import { getAllProjects } from "@/lib/projects";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const projectEntries: MetadataRoute.Sitemap = getAllProjects().map(
    (project) => ({
      url: `${siteConfig.url}/projects/${project.slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    }),
  );

  return [
    {
      url: siteConfig.url,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/projects`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...projectEntries,
  ];
}
