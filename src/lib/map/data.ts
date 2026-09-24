import type { MapKnowledgeModel } from "./types.ts";

/**
 * Deliberately small Phase 1 fixture. It proves the model rather than
 * attempting to populate MAP's planned 27-region knowledge scope.
 */
export const mapKnowledge: MapKnowledgeModel = {
  concepts: [
    { id: "distributed-systems", slug: "distributed-systems", title: "Distributed Systems" },
    { id: "consensus", slug: "consensus", title: "Consensus" },
    {
      id: "finality",
      slug: "finality",
      title: "Finality",
      preferredPlacementId: "finality-in-consensus",
    },
    { id: "scaling", slug: "scaling", title: "Scaling" },
    { id: "rollups", slug: "rollups", title: "Rollups" },
    { id: "settlement", slug: "settlement", title: "Settlement" },
    { id: "identity", slug: "identity", title: "Identity" },
    { id: "agent-identity", slug: "agent-identity", title: "Agent Identity" },
    { id: "authority", slug: "authority", title: "Authority" },
    { id: "ai-agent", slug: "ai-agent", title: "AI Agent" },
    // Intentionally unplaced and without content: sparse/orphan concepts are valid.
    { id: "economic-agency", slug: "economic-agency", title: "Economic Agency" },
  ],
  placements: [
    { id: "distributed-systems", conceptId: "distributed-systems", order: 0 },
    { id: "consensus", conceptId: "consensus", parentPlacementId: "distributed-systems", order: 0 },
    {
      id: "finality-in-consensus",
      conceptId: "finality",
      parentPlacementId: "consensus",
      order: 0,
      contextualNote: "Finality as the point at which consensus no longer reverses a result.",
    },
    { id: "scaling", conceptId: "scaling", order: 1 },
    { id: "rollups", conceptId: "rollups", parentPlacementId: "scaling", order: 0 },
    {
      id: "finality-in-rollups",
      conceptId: "finality",
      parentPlacementId: "rollups",
      order: 0,
      contextualNote: "Finality as a settlement property relevant to rollup systems.",
    },
    { id: "identity", conceptId: "identity", order: 2 },
    {
      id: "agent-identity",
      conceptId: "agent-identity",
      parentPlacementId: "identity",
      order: 0,
    },
    { id: "authority", conceptId: "authority", order: 3 },
    { id: "ai-agent", conceptId: "ai-agent", order: 4 },
  ],
  relationships: [
    {
      id: "finality-finalizes-settlement",
      sourceConceptId: "finality",
      targetConceptId: "settlement",
      typeId: "finalizes",
    },
    {
      id: "rollups-depend-on-finality",
      sourceConceptId: "rollups",
      targetConceptId: "finality",
      typeId: "dependsOn",
    },
    {
      id: "agent-identity-authenticates-ai-agent",
      sourceConceptId: "agent-identity",
      targetConceptId: "ai-agent",
      typeId: "authenticates",
    },
    {
      id: "authority-constrains-ai-agent",
      sourceConceptId: "authority",
      targetConceptId: "ai-agent",
      typeId: "constrains",
    },
    {
      id: "agent-identity-enables-economic-agency",
      sourceConceptId: "agent-identity",
      targetConceptId: "economic-agency",
      typeId: "enables",
    },
  ],
  content: [
    {
      id: "finality-content",
      conceptId: "finality",
      definition: "The point at which a protocol treats a result as no longer practically reversible.",
      summary: "Finality turns agreement about ordering and execution into dependable settlement.",
      whyItMatters: "Systems need a clear boundary for when participants can rely on an outcome.",
    },
    {
      id: "agent-identity-content",
      conceptId: "agent-identity",
      definition: "The means by which an AI agent is distinguished and authenticated for protocol interaction.",
    },
  ],
  mechanisms: [
    {
      id: "consensus-to-finality",
      conceptId: "finality",
      title: "Consensus to Finality",
      summary: "A minimal conceptual progression from distributed coordination to dependable settlement.",
      steps: [
        { conceptId: "distributed-systems" },
        { conceptId: "consensus" },
        { conceptId: "finality" },
        { conceptId: "settlement" },
      ],
    },
  ],
  knowledgePaths: [
    {
      id: "distributed-systems-to-rollups",
      slug: "distributed-systems-to-rollups",
      title: "Distributed Systems to Rollups",
      summary: "A curated route that crosses taxonomy branches rather than mirroring one branch.",
      conceptIds: ["distributed-systems", "consensus", "finality", "scaling", "rollups"],
    },
  ],
} as const;
