/**
 * A small synthetic L2 world for the L2 tooling tests. Test support only.
 */
import type { MapConceptContent, MapKnowledgeModel } from "../../types.ts";
import { planSkeleton, type L2GroupFile, type L2Hazards } from "./territory.ts";

/**
 * Domain One: group g1 holds a and b (owned), s-in-g1 (s, owned by g2) and
 * u-in-g1 (u, owned by g2, already authored). Domain Two: group g2 holds s,
 * t, u (owned) and g1-in-g2 (g1, dual-role). Hazards: a ~ t are
 * near-synonyms; s is a category of t.
 */
export function model(content: MapConceptContent[] = []): MapKnowledgeModel {
  const titles: Record<string, string> = { d1: "Domain One", d2: "Domain Two", g1: "Group One", g2: "Group Two", a: "Alpha", b: "Beta", s: "Shared", t: "Tango", u: "Uniform" };
  const placements = [
    { id: "d1", conceptId: "d1", order: 0 },
    { id: "d2", conceptId: "d2", order: 1 },
    { id: "g1", conceptId: "g1", parentPlacementId: "d1", order: 0 },
    { id: "g2", conceptId: "g2", parentPlacementId: "d2", order: 0 },
    { id: "a", conceptId: "a", parentPlacementId: "g1", order: 0 },
    { id: "b", conceptId: "b", parentPlacementId: "g1", order: 1 },
    { id: "s-in-g1", conceptId: "s", parentPlacementId: "g1", order: 2 },
    { id: "u-in-g1", conceptId: "u", parentPlacementId: "g1", order: 3 },
    { id: "s", conceptId: "s", parentPlacementId: "g2", order: 0 },
    { id: "t", conceptId: "t", parentPlacementId: "g2", order: 1 },
    { id: "u", conceptId: "u", parentPlacementId: "g2", order: 2 },
    { id: "g1-in-g2", conceptId: "g1", parentPlacementId: "g2", order: 3 },
  ];
  const preferred: Record<string, string> = { s: "s", u: "u", g1: "g1" };
  return {
    concepts: Object.entries(titles).map(([id, title]) => ({ id, slug: id, title, ...(preferred[id] ? { preferredPlacementId: preferred[id] } : {}) })),
    placements,
    relationships: [],
    content: [
      { id: "d1-content", conceptId: "d1", definition: "Domain One is a domain.", body: [{ kind: "paragraph", text: "Alpha matters here. Nothing else does." }, { kind: "terms", terms: ["Alpha", "Beta"] }] },
      { id: "g1-content", conceptId: "g1", definition: "Group One groups things.", body: [{ kind: "paragraph", text: "Alphas come first. Betas follow them. Shared things are elsewhere." }] },
      { id: "u-content", conceptId: "u", definition: "Uniform is authored." },
      ...content,
    ],
    mechanisms: [],
    knowledgePaths: [],
  };
}
export const HAZARDS: L2Hazards = {
  nearSynonyms: [{ concepts: ["a", "t"], note: "close" }],
  categoryMembers: [{ category: "s", members: ["t"], scope: "cross group" }],
  multiAxisGroups: [],
  facetWatch: [],
  stateCandidates: { strong: ["b"], moderate: [] },
  verticalBoundary: [],
};
export const REGISTRY = ["d1", "g1", "u"];
export const options = { registry: REGISTRY, hazards: HAZARDS };

export function filledG1(m = model()): L2GroupFile {
  const plan = planSkeleton(m, "g1", options);
  plan.members.find((member) => member.conceptId === "a")!.claims = ["how alpha starts"];
  plan.members.find((member) => member.conceptId === "b")!.claims = ["how beta follows"];
  plan.members.find((member) => member.conceptId === "s")!.reserved = ["what shared things share"];
  plan.splits = [{ concepts: ["a", "t"], split: "alpha is the start; tango is the dance" }];
  return plan;
}
export function filledG2(m = model()): L2GroupFile {
  const plan = planSkeleton(m, "g2", options);
  plan.members.find((member) => member.conceptId === "s")!.claims = ["what shared things share"];
  plan.members.find((member) => member.conceptId === "t")!.claims = ["how tango moves"];
  plan.splits = plan.splits.map((entry) => ({ ...entry, split: "the category names its members; each member owns its mechanism" }));
  return plan;
}
