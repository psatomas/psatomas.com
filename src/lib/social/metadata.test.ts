import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSocialMetadata, canonicalUrl, socialImageUrl, socialImageAlt, missingSocialMetadata } from "./metadata.ts";
import { staticSocial, articleSocial } from "./content.ts";

test("canonical and image URLs remain on the portfolio origin", () => {
  assert.equal(canonicalUrl("/"), "https://psatomas.com/");
  assert.equal(canonicalUrl("/systems/exekpro"), "https://psatomas.com/systems/exekpro");
  assert.equal(socialImageUrl("/"), "https://psatomas.com/opengraph-image");
  assert.equal(socialImageUrl("/lab/oracle"), "https://psatomas.com/og/lab/oracle");
  for (const path of ["https://evil.test", "//evil.test", "/../about", "/about?text=bad", "/about#x", "/%2f%2fevil.test", "/about\\x"]) {
    assert.throws(() => canonicalUrl(path));
    assert.throws(() => socialImageUrl(path));
  }
});

test("metadata emits complete independent Open Graph and Twitter objects", () => {
  const descriptor = staticSocial.systems;
  const metadata = buildSocialMetadata(descriptor);
  const alt = socialImageAlt(descriptor);
  assert.equal(metadata.title, "Systems");
  assert.equal(metadata.description, descriptor.description);
  assert.deepEqual(metadata.alternates, { canonical: "https://psatomas.com/systems" });
  assert.deepEqual(metadata.openGraph, {
    title: "Systems", description: descriptor.description, url: "https://psatomas.com/systems",
    siteName: "Tomás Araújo", type: "website",
    images: [{ url: "https://psatomas.com/og/systems", width: 1200, height: 630, type: "image/png", alt }],
  });
  assert.deepEqual(metadata.twitter, {
    card: "summary_large_image", title: "Systems", description: descriptor.description,
    images: [{ url: "https://psatomas.com/og/systems", alt }],
  });
});

test("home preserves its absolute browser title; About retains profile", () => {
  assert.deepEqual(buildSocialMetadata(staticSocial.home).title, { absolute: "Tomás Araújo — Protocol Engineer" });
  const about = buildSocialMetadata(staticSocial.about).openGraph;
  assert.ok(about && "type" in about);
  assert.equal(about.type, "profile");
});

test("Research article metadata preserves publication precision, section and tags", () => {
  const metadata = buildSocialMetadata(articleSocial({ slug: "new-article", title: "New article",
    description: "Actual excerpt", category: "EVM", publishedAt: "2026-09-18", tags: ["Execution"], readingMinutes: 3 }));
  assert.deepEqual(metadata.openGraph, {
    title: "New article", description: "Actual excerpt", url: "https://psatomas.com/research/new-article",
    siteName: "Tomás Araújo", type: "article", publishedTime: "2026-09-18", section: "EVM", tags: ["Execution"],
    images: [{ url: "https://psatomas.com/og/research/new-article", width: 1200, height: 630,
      type: "image/png", alt: "New article — RESEARCH | Tomás Araújo" }],
  });
  assert.equal("modifiedTime" in metadata.openGraph!, false);
});


test("missing content explicitly clears canonical and inherited social images", () => {
  const metadata = missingSocialMetadata("Research article");
  assert.equal(metadata.title, "Research article not found");
  assert.deepEqual(metadata.alternates, { canonical: null });
  assert.deepEqual(metadata.openGraph?.images, []);
  assert.deepEqual(metadata.twitter?.images, []);
});
