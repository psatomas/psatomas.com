import { toMapConceptExposition } from "@/components/map/explorer-model";
import { createMapResolver, mapKnowledge } from "@/lib/map";

/**
 * Canonical exposition for one MAP concept, prerendered at build time (one
 * document per concept that has content) so it is served from the static
 * cache rather than rendered per request. The explorer fetches it only when a
 * reader opens the concept, which keeps exposition out of the /map payload
 * however large MAP grows. Unknown concepts are 404s, never rendered.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return mapKnowledge.content.map((content) => ({ conceptId: content.conceptId }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ conceptId: string }> }) {
  const { conceptId } = await params;
  const content = createMapResolver(mapKnowledge).getContentForConcept(conceptId);
  if (!content) return new Response(null, { status: 404 });
  return Response.json(toMapConceptExposition(content));
}
