import type { MapConcept, MapKnowledgeModel, MapPlacement } from "./types.ts";

/**
 * MAP's 27 L0 domains (docs/map-spec.md §5), in pedagogical order. Each is a
 * canonical concept with one root placement sharing its identifier; list
 * position is the root placement's explicit sibling order, never part of the
 * identity. Deeper levels are authored beneath these roots incrementally.
 */
const L0_DOMAINS: ReadonlyArray<{ id: string; title: string }> = [
  { id: "foundations", title: "Foundations" },
  { id: "computation-execution", title: "Computation & Execution" },
  { id: "state-data", title: "State & Data" },
  { id: "consensus-ordering", title: "Consensus & Ordering" },
  { id: "networks-infrastructure", title: "Networks & Infrastructure" },
  { id: "cryptography-proofs", title: "Cryptography & Proofs" },
  { id: "storage-availability", title: "Storage & Availability" },
  { id: "identity-accounts-authority", title: "Identity, Accounts & Authority" },
  { id: "oracles-external-reality", title: "Oracles & External Reality" },
  { id: "economics-mechanism-design", title: "Economics & Mechanism Design" },
  { id: "markets-financial-protocols", title: "Markets & Financial Protocols" },
  { id: "mev-execution-markets", title: "MEV & Execution Markets" },
  { id: "intents-coordination", title: "Intents & Coordination" },
  { id: "governance-institutions", title: "Governance & Institutions" },
  { id: "scaling-modular-systems", title: "Scaling & Modular Systems" },
  { id: "interoperability-abstraction", title: "Interoperability & Abstraction" },
  { id: "security-correctness-resilience", title: "Security, Correctness & Resilience" },
  { id: "protocol-architecture", title: "Protocol Architecture" },
  { id: "protocol-design-lifecycle", title: "Protocol Design & Lifecycle" },
  { id: "ai-intelligent-systems", title: "AI & Intelligent Systems" },
  { id: "machine-economy", title: "Machine Economy" },
  { id: "autonomous-coordination", title: "Autonomous Coordination" },
  { id: "autonomous-execution", title: "Autonomous Execution" },
  { id: "autonomous-organizations", title: "Autonomous Organizations" },
  { id: "autonomous-protocols", title: "Autonomous Protocols" },
  { id: "autonomous-economy", title: "Autonomous Economy" },
  { id: "frontier-systems", title: "Frontier Systems" },
];

const l0Concepts: MapConcept[] = L0_DOMAINS.map(({ id, title }) => ({ id, slug: id, title }));
const l0Placements: MapPlacement[] = L0_DOMAINS.map(({ id }, order) => ({ id, conceptId: id, order }));

/**
 * Foundations' L2 layer, beneath each of its seven L1 topics, in sibling
 * order. A plain entry is a concept taught only here (placement ID = concept
 * ID); an object is a further placement of a concept that already has one,
 * so a repeated label is one canonical concept only where one canonical
 * exposition serves both contexts.
 */
const FOUNDATIONS_L2: Readonly<Record<string, ReadonlyArray<string | { placementId: string; conceptId: string }>>> = {
  protocols: [
    "rules",
    "participants",
    "interactions",
    "assumptions",
    { placementId: "state-in-protocols", conceptId: "state" },
    { placementId: "protocol-properties-in-protocols", conceptId: "protocol-properties" },
  ],
  "distributed-systems": ["processes", "communication", "partial-knowledge", "latency", "failures", "fault-models"],
  "state-machines": [
    { placementId: "state-in-state-machines", conceptId: "state" },
    "inputs",
    "transitions",
    "transition-rules",
    "determinism",
    "state-machine-replication",
  ],
  "trust-models": [
    "trust-assumptions",
    "trusted-parties",
    "trust-boundaries",
    "verification",
    "trust-minimization",
    "trust-distribution",
  ],
  coordination: [
    "coordination-models",
    "information",
    "coordination-communication",
    "cooperation",
    "competition",
    "collective-action",
  ],
  "adversarial-environments": [
    "adversaries",
    "threat-models",
    "byzantine-behavior",
    "censorship",
    "collusion",
    "strategic-behavior",
  ],
  "protocol-properties": [
    "safety",
    "liveness",
    { placementId: "finality-in-protocol-properties", conceptId: "finality" },
    "availability",
    "consistency",
    "fault-tolerance",
    "censorship-resistance",
  ],
};

const foundationsL2Placements: MapPlacement[] = Object.entries(FOUNDATIONS_L2).flatMap(([parentPlacementId, children]) =>
  children.map((child, order) =>
    typeof child === "string"
      ? { id: child, conceptId: child, parentPlacementId, order }
      : { id: child.placementId, conceptId: child.conceptId, parentPlacementId, order },
  ),
);

/**
 * The complete L0 layer, Foundations as the reference implementation of a
 * taught domain (canonical exposition plus its next conceptual layer), and a
 * deliberately small Phase 1 proof fixture re-homed beneath its L0 domains.
 */
export const mapKnowledge: MapKnowledgeModel = {
  concepts: [
    ...l0Concepts,
    // Foundations' conceptual layer (Distributed Systems is shared with the fixture).
    { id: "protocols", slug: "protocols", title: "Protocols" },
    { id: "state-machines", slug: "state-machines", title: "State Machines" },
    { id: "trust-models", slug: "trust-models", title: "Trust Models" },
    { id: "coordination", slug: "coordination", title: "Coordination" },
    { id: "adversarial-environments", slug: "adversarial-environments", title: "Adversarial Environments" },
    {
      id: "protocol-properties",
      slug: "protocol-properties",
      title: "Protocol Properties",
      preferredPlacementId: "protocol-properties",
    },
    { id: "distributed-systems", slug: "distributed-systems", title: "Distributed Systems" },
    // Foundations' L2 layer (placements in FOUNDATIONS_L2). State is one
    // concept placed under Protocols and State Machines; Protocol Properties
    // and Finality gain further placements.
    { id: "state", slug: "state", title: "State", preferredPlacementId: "state-in-state-machines" },
    { id: "rules", slug: "rules", title: "Rules" },
    { id: "participants", slug: "participants", title: "Participants" },
    { id: "interactions", slug: "interactions", title: "Interactions" },
    { id: "assumptions", slug: "assumptions", title: "Assumptions" },
    { id: "processes", slug: "processes", title: "Processes" },
    // Two concepts share the title "Communication": message exchange between
    // processes (channels, delivery, synchrony) is not participants exchanging
    // information and intent to align action (signalling, commitment), and
    // one canonical exposition could not teach both.
    { id: "communication", slug: "communication", title: "Communication" },
    { id: "partial-knowledge", slug: "partial-knowledge", title: "Partial Knowledge" },
    { id: "latency", slug: "latency", title: "Latency" },
    { id: "failures", slug: "failures", title: "Failures" },
    { id: "fault-models", slug: "fault-models", title: "Fault Models" },
    { id: "inputs", slug: "inputs", title: "Inputs" },
    { id: "transitions", slug: "transitions", title: "Transitions" },
    { id: "transition-rules", slug: "transition-rules", title: "Transition Rules" },
    { id: "determinism", slug: "determinism", title: "Determinism" },
    { id: "state-machine-replication", slug: "state-machine-replication", title: "State Machine Replication" },
    { id: "trust-assumptions", slug: "trust-assumptions", title: "Trust Assumptions" },
    { id: "trusted-parties", slug: "trusted-parties", title: "Trusted Parties" },
    { id: "trust-boundaries", slug: "trust-boundaries", title: "Trust Boundaries" },
    { id: "verification", slug: "verification", title: "Verification" },
    { id: "trust-minimization", slug: "trust-minimization", title: "Trust Minimization" },
    { id: "trust-distribution", slug: "trust-distribution", title: "Trust Distribution" },
    { id: "coordination-models", slug: "coordination-models", title: "Coordination Models" },
    { id: "information", slug: "information", title: "Information" },
    { id: "coordination-communication", slug: "coordination-communication", title: "Communication" },
    { id: "cooperation", slug: "cooperation", title: "Cooperation" },
    { id: "competition", slug: "competition", title: "Competition" },
    { id: "collective-action", slug: "collective-action", title: "Collective Action" },
    { id: "adversaries", slug: "adversaries", title: "Adversaries" },
    { id: "threat-models", slug: "threat-models", title: "Threat Models" },
    { id: "byzantine-behavior", slug: "byzantine-behavior", title: "Byzantine Behavior" },
    { id: "censorship", slug: "censorship", title: "Censorship" },
    { id: "collusion", slug: "collusion", title: "Collusion" },
    { id: "strategic-behavior", slug: "strategic-behavior", title: "Strategic Behavior" },
    { id: "safety", slug: "safety", title: "Safety" },
    { id: "liveness", slug: "liveness", title: "Liveness" },
    { id: "availability", slug: "availability", title: "Availability" },
    { id: "consistency", slug: "consistency", title: "Consistency" },
    { id: "fault-tolerance", slug: "fault-tolerance", title: "Fault Tolerance" },
    { id: "censorship-resistance", slug: "censorship-resistance", title: "Censorship Resistance" },
    { id: "consensus", slug: "consensus", title: "Consensus" },
    {
      id: "finality",
      slug: "finality",
      title: "Finality",
      preferredPlacementId: "finality-in-consensus",
    },
    { id: "scaling", slug: "scaling", title: "Scaling" },
    { id: "rollups", slug: "rollups", title: "Rollups" },
    // Intentionally unplaced for now: a relationship target and mechanism step
    // whose pedagogical homes are authored when its domains are populated.
    { id: "settlement", slug: "settlement", title: "Settlement" },
    { id: "identity", slug: "identity", title: "Identity" },
    { id: "agent-identity", slug: "agent-identity", title: "Agent Identity" },
    { id: "authority", slug: "authority", title: "Authority" },
    { id: "ai-agent", slug: "ai-agent", title: "AI Agent" },
    // Intentionally unplaced and without content: sparse/orphan concepts are valid.
    { id: "economic-agency", slug: "economic-agency", title: "Economic Agency" },
  ],
  placements: [
    ...l0Placements,
    { id: "protocols", conceptId: "protocols", parentPlacementId: "foundations", order: 0 },
    { id: "distributed-systems", conceptId: "distributed-systems", parentPlacementId: "foundations", order: 1 },
    { id: "state-machines", conceptId: "state-machines", parentPlacementId: "foundations", order: 2 },
    { id: "trust-models", conceptId: "trust-models", parentPlacementId: "foundations", order: 3 },
    { id: "coordination", conceptId: "coordination", parentPlacementId: "foundations", order: 4 },
    { id: "adversarial-environments", conceptId: "adversarial-environments", parentPlacementId: "foundations", order: 5 },
    { id: "protocol-properties", conceptId: "protocol-properties", parentPlacementId: "foundations", order: 6 },
    ...foundationsL2Placements,
    { id: "consensus", conceptId: "consensus", parentPlacementId: "consensus-ordering", order: 0 },
    {
      id: "finality-in-consensus",
      conceptId: "finality",
      parentPlacementId: "consensus",
      order: 0,
      contextualNote: "Finality as the point at which consensus no longer reverses a result.",
    },
    { id: "scaling", conceptId: "scaling", parentPlacementId: "scaling-modular-systems", order: 0 },
    { id: "rollups", conceptId: "rollups", parentPlacementId: "scaling", order: 0 },
    {
      id: "finality-in-rollups",
      conceptId: "finality",
      parentPlacementId: "rollups",
      order: 0,
      contextualNote: "Finality as a settlement property relevant to rollup systems.",
    },
    { id: "identity", conceptId: "identity", parentPlacementId: "identity-accounts-authority", order: 0 },
    {
      id: "agent-identity",
      conceptId: "agent-identity",
      parentPlacementId: "identity",
      order: 0,
    },
    { id: "authority", conceptId: "authority", parentPlacementId: "identity-accounts-authority", order: 1 },
    { id: "ai-agent", conceptId: "ai-agent", parentPlacementId: "ai-intelligent-systems", order: 0 },
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
      id: "foundations-content",
      conceptId: "foundations",
      definition:
        "Protocols begin before implementation. They define how independent participants interact, which actions are valid, how state can change, and which properties the system is expected to preserve.",
      body: [
        {
          kind: "paragraph",
          text: "At this level a protocol is not primarily code. It is a system of rules, participants, state, and assumptions whose interactions produce behavior.",
        },
        {
          kind: "flow",
          label: "How rules turn participant actions into system state",
          stages: [["Participants"], ["Rules"], ["Actions", "Messages"], ["State transitions"], ["System state"]],
        },
        {
          kind: "paragraph",
          text: "What emerges depends on more than the rules. Participants observe different information, communicate over unreliable networks, hold different incentives, exercise different authority, depend on external systems, fail, or act strategically against the protocol.",
        },
        {
          kind: "flow",
          label: "What system behavior is shaped by",
          stages: [
            ["Protocol"],
            ["Rules", "State", "Participants"],
            ["System behavior"],
            ["Trust", "Authority", "Incentives", "Dependencies", "Network", "Adversaries"],
          ],
        },
        { kind: "distinction", left: "Local correctness", right: "System correctness" },
        {
          kind: "paragraph",
          text: "A component can behave exactly as specified while the system around it produces an unintended outcome. Protocol properties emerge from interactions between mechanisms, participants, and assumptions, not from isolated components.",
        },
        {
          kind: "tensions",
          label: "Recurring tensions",
          pairs: [
            ["Safety", "Liveness"],
            ["Trust", "Verification"],
            ["Openness", "Control"],
            ["Coordination", "Autonomy"],
            ["Determinism", "External reality"],
            ["Local behavior", "System behavior"],
          ],
        },
        {
          kind: "paragraph",
          text: "Trust is rarely eliminated. It is moved, distributed, constrained, or replaced with mechanisms that make particular claims independently verifiable. Decentralization likewise does not remove coordination: it changes how coordination is achieved and which assumptions it requires.",
        },
        {
          kind: "paragraph",
          text: "Protocol Engineering is therefore concerned with more than implementing rules correctly. It examines how rules, state, participants, incentives, authority, dependencies, and failure interact, and which properties continue to hold when the environment stops being ideal.",
        },
      ],
    },
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
