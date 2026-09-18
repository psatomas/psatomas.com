import type { Metadata } from "next";
import { siteConfig } from "../site.ts";

export type SocialDescriptor = {
  path: string;
  title: string;
  description: string;
  environment: string;
  category: string;
  supporting?: string;
  imageTitle?: string;
  type: "website" | "profile" | "article";
  publishedAt?: string;
  tags?: string[];
};

export const socialImageSize = { width: 1200, height: 630 };

/** Internal paths only: never allow URL resolution to change the origin. */
export function canonicalUrl(path: string): string {
  if (path !== "/" && !/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(path)) {
    throw new Error("Invalid public social path");
  }
  return new URL(path, siteConfig.url).href;
}

export function socialImageUrl(path: string): string {
  canonicalUrl(path);
  return new URL(path === "/" ? "/opengraph-image" : `/og${path}`, siteConfig.url).href;
}

export function socialImageAlt(descriptor: SocialDescriptor): string {
  return `${descriptor.title} — ${descriptor.environment} | ${siteConfig.name}`;
}

export function buildSocialMetadata(descriptor: SocialDescriptor): Metadata {
  const image = {
    url: socialImageUrl(descriptor.path),
    ...socialImageSize,
    type: "image/png",
    alt: socialImageAlt(descriptor),
  };
  return {
    title: descriptor.path === "/" ? { absolute: descriptor.title } : descriptor.title,
    description: descriptor.description,
    alternates: { canonical: canonicalUrl(descriptor.path) },
    openGraph: {
      title: descriptor.title,
      description: descriptor.description,
      url: canonicalUrl(descriptor.path),
      siteName: siteConfig.name,
      images: [image],
      ...(descriptor.type === "article"
        ? { type: "article", publishedTime: descriptor.publishedAt,
            section: descriptor.category, tags: descriptor.tags }
        : { type: descriptor.type }),
    },
    twitter: {
      card: "summary_large_image",
      title: descriptor.title,
      description: descriptor.description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}

/** The page still calls notFound(). Explicit empty image arrays prevent the
 * root file convention from advertising portfolio identity on a content 404. */
export function missingSocialMetadata(environment: string): Metadata {
  const title = `${environment} not found`;
  const description = "The requested content is not available.";
  return {
    title, description, alternates: { canonical: null },
    openGraph: { title, description, images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}
