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

/** An L2 topic whose placement differs from its concept: a further placement, or contextual wording. */
type L2Topic = { placementId: string; conceptId: string; contextualLabel?: string };

/**
 * The L2 layer beneath each authored L1 topic, keyed by L1 placement, in
 * sibling order. A plain entry is a concept taught only here (placement ID =
 * concept ID). An object is a further placement of a concept that already
 * has one (a repeated label is one canonical concept only where one
 * canonical exposition serves every context), or a placement whose wording
 * in context is shorter than the concept title.
 */
const L2_TOPICS: Readonly<Record<string, ReadonlyArray<string | L2Topic>>> = {
  // 01 Foundations
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
  // 02 Computation & Execution
  "execution-models": [
    "deterministic-execution",
    "non-deterministic-execution",
    "sequential-execution",
    "parallel-execution",
    "optimistic-execution",
    "speculative-execution",
  ],
  transactions: [
    "transaction-lifecycle",
    "transaction-structure",
    "transaction-ordering",
    "transaction-validation",
    "transaction-execution",
    "transaction-atomicity",
    "transaction-reversion",
  ],
  "virtual-machines": ["evm", "wasm", "zkvms"],
  "smart-contracts": [
    "contract-state",
    "contract-execution",
    "contract-calls",
    "message-calls",
    { placementId: "contract-deployment", conceptId: "contract-deployment", contextualLabel: "Deployment" },
    "execution-context",
    "contract-lifecycle",
  ],
  "verifiable-computation": [
    "computation-integrity",
    "execution-traces",
    "computation-commitments",
    "computation-proofs",
    { placementId: "verification-in-verifiable-computation", conceptId: "verification" },
  ],
  "off-chain-computation": [
    "off-chain-execution",
    "on-chain-verification",
    "trusted-execution",
    "untrusted-execution",
    "off-chain-workers",
  ],
  "resource-accounting": [
    "gas",
    "execution-cost",
    "metering",
    "resource-limits",
    "fee-accounting",
    "denial-of-service-resistance",
  ],
  // 03 State & Data
  "state-representation": [
    "state-models",
    "global-state",
    "local-state",
    "state-encoding",
    "state-layout",
    { placementId: "state-roots-in-state-representation", conceptId: "state-roots" },
  ],
  "transitions-in-state-data": [
    "transition-functions",
    "valid-transitions",
    "invalid-transitions",
    "transition-preconditions",
    "transition-effects",
    "atomic-state-transitions",
  ],
  "state-commitments": [
    "merkle-trees",
    "merkle-patricia-tries",
    "verkle-trees",
    "commitment-schemes",
    { placementId: "state-roots-in-state-commitments", conceptId: "state-roots" },
    "state-proofs",
  ],
  "historical-state": [
    "state-history",
    "historical-queries",
    "state-snapshots",
    { placementId: "state-checkpoints", conceptId: "state-checkpoints", contextualLabel: "Checkpoints" },
    "archival-state",
    "state-reconstruction",
  ],
  synchronization: [
    "initial-synchronization",
    "full-sync",
    "snap-sync",
    "state-sync",
    "incremental-synchronization",
    "synchronization-verification",
  ],
  "on-chain-data": ["calldata", "logs", "events", "transaction-data", "block-data", "protocol-state"],
  "off-chain-data": ["external-data", "metadata", "off-chain-state", "data-references", "content-addressing"],
  "data-integrity": [
    "integrity-guarantees",
    "data-hashing",
    "data-commitments",
    "integrity-verification",
    "tamper-evidence",
    "authenticity",
  ],
  provenance: ["data-origin", "lineage", "attribution", "provenance-records", "attestations", "traceability"],
  indexing: [
    "data-extraction",
    "data-transformation",
    "derived-state",
    "index-construction",
    "query-models",
    "reorganization-handling",
  ],
};

const l2Placements: MapPlacement[] = Object.entries(L2_TOPICS).flatMap(([parentPlacementId, children]) =>
  children.map((child, order) =>
    typeof child === "string"
      ? { id: child, conceptId: child, parentPlacementId, order }
      : { id: child.placementId, conceptId: child.conceptId, parentPlacementId, order, ...(child.contextualLabel ? { contextualLabel: child.contextualLabel } : {}) },
  ),
);

/**
 * The complete L0 layer; Foundations as the reference implementation of a
 * taught domain (canonical exposition plus its L1 and L2 topics); the L1 and
 * L2 topics of Computation & Execution and of State & Data; and a
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
    // Foundations' L2 layer (placements in L2_TOPICS). State is one
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
    // Also placed as 03 State & Data's "State Transitions": a ledger's state
    // transition is a state machine's transition.
    { id: "transitions", slug: "transitions", title: "Transitions", preferredPlacementId: "transitions" },
    { id: "transition-rules", slug: "transition-rules", title: "Transition Rules" },
    { id: "determinism", slug: "determinism", title: "Determinism" },
    { id: "state-machine-replication", slug: "state-machine-replication", title: "State Machine Replication" },
    { id: "trust-assumptions", slug: "trust-assumptions", title: "Trust Assumptions" },
    { id: "trusted-parties", slug: "trusted-parties", title: "Trusted Parties" },
    { id: "trust-boundaries", slug: "trust-boundaries", title: "Trust Boundaries" },
    // Also placed under Verifiable Computation: checking a computation's proof
    // is the same act as checking any claim instead of trusting its source.
    { id: "verification", slug: "verification", title: "Verification", preferredPlacementId: "verification" },
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
    // 02 Computation & Execution: L1 topics.
    { id: "execution-models", slug: "execution-models", title: "Execution Models" },
    { id: "transactions", slug: "transactions", title: "Transactions" },
    { id: "virtual-machines", slug: "virtual-machines", title: "Virtual Machines" },
    { id: "smart-contracts", slug: "smart-contracts", title: "Smart Contracts" },
    { id: "verifiable-computation", slug: "verifiable-computation", title: "Verifiable Computation" },
    { id: "off-chain-computation", slug: "off-chain-computation", title: "Off-Chain Computation" },
    { id: "resource-accounting", slug: "resource-accounting", title: "Resource Accounting" },
    // L2 topics (placements in L2_TOPICS). Deterministic Execution is an
    // execution model, not Foundations' Determinism (the property it relies on).
    { id: "deterministic-execution", slug: "deterministic-execution", title: "Deterministic Execution" },
    { id: "non-deterministic-execution", slug: "non-deterministic-execution", title: "Non-Deterministic Execution" },
    { id: "sequential-execution", slug: "sequential-execution", title: "Sequential Execution" },
    { id: "parallel-execution", slug: "parallel-execution", title: "Parallel Execution" },
    { id: "optimistic-execution", slug: "optimistic-execution", title: "Optimistic Execution" },
    { id: "speculative-execution", slug: "speculative-execution", title: "Speculative Execution" },
    { id: "transaction-lifecycle", slug: "transaction-lifecycle", title: "Transaction Lifecycle" },
    { id: "transaction-structure", slug: "transaction-structure", title: "Transaction Structure" },
    { id: "transaction-ordering", slug: "transaction-ordering", title: "Transaction Ordering" },
    { id: "transaction-validation", slug: "transaction-validation", title: "Transaction Validation" },
    { id: "transaction-execution", slug: "transaction-execution", title: "Transaction Execution" },
    { id: "transaction-atomicity", slug: "transaction-atomicity", title: "Transaction Atomicity" },
    { id: "transaction-reversion", slug: "transaction-reversion", title: "Transaction Reversion" },
    { id: "evm", slug: "evm", title: "EVM" },
    { id: "wasm", slug: "wasm", title: "WASM" },
    { id: "zkvms", slug: "zkvms", title: "zkVMs" },
    // Contract State is a contract's own persistent storage, not Foundations'
    // general State.
    { id: "contract-state", slug: "contract-state", title: "Contract State" },
    { id: "contract-execution", slug: "contract-execution", title: "Contract Execution" },
    { id: "contract-calls", slug: "contract-calls", title: "Contract Calls" },
    { id: "message-calls", slug: "message-calls", title: "Message Calls" },
    // Deploying a contract, shown as "Deployment" under Smart Contracts; the
    // generic word stays free for protocol deployment elsewhere.
    { id: "contract-deployment", slug: "contract-deployment", title: "Contract Deployment" },
    { id: "execution-context", slug: "execution-context", title: "Execution Context" },
    { id: "contract-lifecycle", slug: "contract-lifecycle", title: "Contract Lifecycle" },
    { id: "computation-integrity", slug: "computation-integrity", title: "Computation Integrity" },
    { id: "execution-traces", slug: "execution-traces", title: "Execution Traces" },
    { id: "computation-commitments", slug: "computation-commitments", title: "Computation Commitments" },
    { id: "computation-proofs", slug: "computation-proofs", title: "Computation Proofs" },
    { id: "off-chain-execution", slug: "off-chain-execution", title: "Off-Chain Execution" },
    { id: "on-chain-verification", slug: "on-chain-verification", title: "On-Chain Verification" },
    { id: "trusted-execution", slug: "trusted-execution", title: "Trusted Execution" },
    { id: "untrusted-execution", slug: "untrusted-execution", title: "Untrusted Execution" },
    { id: "off-chain-workers", slug: "off-chain-workers", title: "Off-Chain Workers" },
    { id: "gas", slug: "gas", title: "Gas" },
    { id: "execution-cost", slug: "execution-cost", title: "Execution Cost" },
    { id: "metering", slug: "metering", title: "Metering" },
    { id: "resource-limits", slug: "resource-limits", title: "Resource Limits" },
    { id: "fee-accounting", slug: "fee-accounting", title: "Fee Accounting" },
    { id: "denial-of-service-resistance", slug: "denial-of-service-resistance", title: "Denial-of-Service Resistance" },
    // 03 State & Data: L1 topics (State Transitions is Foundations' Transitions).
    { id: "state-representation", slug: "state-representation", title: "State Representation" },
    { id: "state-commitments", slug: "state-commitments", title: "State Commitments" },
    { id: "historical-state", slug: "historical-state", title: "Historical State" },
    { id: "synchronization", slug: "synchronization", title: "Synchronization" },
    { id: "on-chain-data", slug: "on-chain-data", title: "On-Chain Data" },
    { id: "off-chain-data", slug: "off-chain-data", title: "Off-Chain Data" },
    { id: "data-integrity", slug: "data-integrity", title: "Data Integrity" },
    { id: "provenance", slug: "provenance", title: "Provenance" },
    { id: "indexing", slug: "indexing", title: "Indexing" },
    // L2 topics (placements in L2_TOPICS).
    { id: "state-models", slug: "state-models", title: "State Models" },
    { id: "global-state", slug: "global-state", title: "Global State" },
    { id: "local-state", slug: "local-state", title: "Local State" },
    { id: "state-encoding", slug: "state-encoding", title: "State Encoding" },
    { id: "state-layout", slug: "state-layout", title: "State Layout" },
    // One concept under State Representation and State Commitments; a state
    // root is a commitment, so that placement is preferred.
    { id: "state-roots", slug: "state-roots", title: "State Roots", preferredPlacementId: "state-roots-in-state-commitments" },
    // Transition Functions compute a transition; Foundations' Transition Rules
    // govern which are allowed. Atomic State Transitions (indivisible state
    // change) is not Transaction Atomicity (a transaction's all-or-nothing effects).
    { id: "transition-functions", slug: "transition-functions", title: "Transition Functions" },
    { id: "valid-transitions", slug: "valid-transitions", title: "Valid Transitions" },
    { id: "invalid-transitions", slug: "invalid-transitions", title: "Invalid Transitions" },
    { id: "transition-preconditions", slug: "transition-preconditions", title: "Transition Preconditions" },
    { id: "transition-effects", slug: "transition-effects", title: "Transition Effects" },
    { id: "atomic-state-transitions", slug: "atomic-state-transitions", title: "Atomic State Transitions" },
    { id: "merkle-trees", slug: "merkle-trees", title: "Merkle Trees" },
    { id: "merkle-patricia-tries", slug: "merkle-patricia-tries", title: "Merkle Patricia Tries" },
    { id: "verkle-trees", slug: "verkle-trees", title: "Verkle Trees" },
    { id: "commitment-schemes", slug: "commitment-schemes", title: "Commitment Schemes" },
    { id: "state-proofs", slug: "state-proofs", title: "State Proofs" },
    { id: "state-history", slug: "state-history", title: "State History" },
    { id: "historical-queries", slug: "historical-queries", title: "Historical Queries" },
    { id: "state-snapshots", slug: "state-snapshots", title: "State Snapshots" },
    // Shown as "Checkpoints" under Historical State; the bare term's usual
    // protocol meaning, consensus and finality checkpoints, is a different concept.
    { id: "state-checkpoints", slug: "state-checkpoints", title: "State Checkpoints" },
    { id: "archival-state", slug: "archival-state", title: "Archival State" },
    { id: "state-reconstruction", slug: "state-reconstruction", title: "State Reconstruction" },
    { id: "initial-synchronization", slug: "initial-synchronization", title: "Initial Synchronization" },
    { id: "full-sync", slug: "full-sync", title: "Full Sync" },
    { id: "snap-sync", slug: "snap-sync", title: "Snap Sync" },
    { id: "state-sync", slug: "state-sync", title: "State Sync" },
    { id: "incremental-synchronization", slug: "incremental-synchronization", title: "Incremental Synchronization" },
    { id: "synchronization-verification", slug: "synchronization-verification", title: "Synchronization Verification" },
    { id: "calldata", slug: "calldata", title: "Calldata" },
    { id: "logs", slug: "logs", title: "Logs" },
    { id: "events", slug: "events", title: "Events" },
    { id: "transaction-data", slug: "transaction-data", title: "Transaction Data" },
    { id: "block-data", slug: "block-data", title: "Block Data" },
    { id: "protocol-state", slug: "protocol-state", title: "Protocol State" },
    { id: "external-data", slug: "external-data", title: "External Data" },
    { id: "metadata", slug: "metadata", title: "Metadata" },
    { id: "off-chain-state", slug: "off-chain-state", title: "Off-Chain State" },
    { id: "data-references", slug: "data-references", title: "Data References" },
    { id: "content-addressing", slug: "content-addressing", title: "Content Addressing" },
    { id: "integrity-guarantees", slug: "integrity-guarantees", title: "Integrity Guarantees" },
    { id: "data-hashing", slug: "data-hashing", title: "Data Hashing" },
    { id: "data-commitments", slug: "data-commitments", title: "Data Commitments" },
    { id: "integrity-verification", slug: "integrity-verification", title: "Integrity Verification" },
    { id: "tamper-evidence", slug: "tamper-evidence", title: "Tamper Evidence" },
    { id: "authenticity", slug: "authenticity", title: "Authenticity" },
    { id: "data-origin", slug: "data-origin", title: "Data Origin" },
    { id: "lineage", slug: "lineage", title: "Lineage" },
    { id: "attribution", slug: "attribution", title: "Attribution" },
    { id: "provenance-records", slug: "provenance-records", title: "Provenance Records" },
    { id: "attestations", slug: "attestations", title: "Attestations" },
    { id: "traceability", slug: "traceability", title: "Traceability" },
    { id: "data-extraction", slug: "data-extraction", title: "Data Extraction" },
    { id: "data-transformation", slug: "data-transformation", title: "Data Transformation" },
    { id: "derived-state", slug: "derived-state", title: "Derived State" },
    { id: "index-construction", slug: "index-construction", title: "Index Construction" },
    { id: "query-models", slug: "query-models", title: "Query Models" },
    { id: "reorganization-handling", slug: "reorganization-handling", title: "Reorganization Handling" },
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
    { id: "execution-models", conceptId: "execution-models", parentPlacementId: "computation-execution", order: 0 },
    { id: "transactions", conceptId: "transactions", parentPlacementId: "computation-execution", order: 1 },
    { id: "virtual-machines", conceptId: "virtual-machines", parentPlacementId: "computation-execution", order: 2 },
    { id: "smart-contracts", conceptId: "smart-contracts", parentPlacementId: "computation-execution", order: 3 },
    { id: "verifiable-computation", conceptId: "verifiable-computation", parentPlacementId: "computation-execution", order: 4 },
    { id: "off-chain-computation", conceptId: "off-chain-computation", parentPlacementId: "computation-execution", order: 5 },
    { id: "resource-accounting", conceptId: "resource-accounting", parentPlacementId: "computation-execution", order: 6 },
    { id: "state-representation", conceptId: "state-representation", parentPlacementId: "state-data", order: 0 },
    {
      id: "transitions-in-state-data",
      conceptId: "transitions",
      parentPlacementId: "state-data",
      order: 1,
      contextualLabel: "State Transitions",
    },
    { id: "state-commitments", conceptId: "state-commitments", parentPlacementId: "state-data", order: 2 },
    { id: "historical-state", conceptId: "historical-state", parentPlacementId: "state-data", order: 3 },
    { id: "synchronization", conceptId: "synchronization", parentPlacementId: "state-data", order: 4 },
    { id: "on-chain-data", conceptId: "on-chain-data", parentPlacementId: "state-data", order: 5 },
    { id: "off-chain-data", conceptId: "off-chain-data", parentPlacementId: "state-data", order: 6 },
    { id: "data-integrity", conceptId: "data-integrity", parentPlacementId: "state-data", order: 7 },
    { id: "provenance", conceptId: "provenance", parentPlacementId: "state-data", order: 8 },
    { id: "indexing", conceptId: "indexing", parentPlacementId: "state-data", order: 9 },
    ...l2Placements,
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
