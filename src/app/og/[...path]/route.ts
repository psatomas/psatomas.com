import { renderSocialImage } from "@/components/social/og-image";
import { resolveSocialPath } from "@/lib/social/content";
import { getSystemBySlug } from "@/lib/systems";
import { experiments } from "@/lib/experiments/registry";
import { getPublishedArticle } from "@/lib/research/public-article";

// Research must be resolved at request time, never during a static build.
export const dynamic = "force-dynamic";

export async function GET(request: Request, props: RouteContext<"/og/[...path]">) {
  // No query-driven card customization or cache-busting request variants.
  if (new URL(request.url).search) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const { path } = await props.params;
  const descriptor = await resolveSocialPath(path, {
    system: getSystemBySlug,
    experiment: (id) => experiments.find((experiment) => experiment.id === id),
    publishedArticle: getPublishedArticle,
  });
  if (!descriptor) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return renderSocialImage(descriptor, descriptor.type === "article"
    ? "no-store"
    : "public, max-age=3600, s-maxage=3600");
}
