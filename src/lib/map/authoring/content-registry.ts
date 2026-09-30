/**
 * The registry of intentionally authored canonical exposition: every concept
 * that owns content, and nothing else. Today that is the L0 introductions and
 * the Phase 1 fixture's content. Authoring a concept's exposition adds it here
 * (docs/map-authoring/authoring-workflow.md); structural taxonomy work never
 * does. The ontology tests (src/lib/map/map.test.ts) assert that content exists
 * exactly for these concepts, and map:inspect reads it to guide authors.
 * Order is not significant. Development tooling only: never imported by the
 * MAP runtime.
 */
export const AUTHORED_CONTENT_CONCEPTS: readonly string[] = [
  "foundations",
  "computation-execution",
  "state-data",
  "consensus-ordering",
  "networks-infrastructure",
  "cryptography-proofs",
  "storage-availability",
  "identity-accounts-authority",
  "oracles-external-reality",
  "economics-mechanism-design",
  "markets-financial-protocols",
  "mev-execution-markets",
  "intents-coordination",
  "governance-institutions",
  "scaling-modular-systems",
  "security-correctness-resilience",
  "interoperability-abstraction",
  "protocol-architecture",
  "protocol-design-lifecycle",
  "ai-intelligent-systems",
  "machine-economy",
  "autonomous-coordination",
  "autonomous-execution",
  "autonomous-organizations",
  "autonomous-protocols",
  "autonomous-economy",
  "frontier-systems",
  "finality",
  "agent-identity",
  "distributed-systems",
  "protocol-properties",
  "state-machines",
  "trust-models",
  "coordination",
  "protocols",
  "adversarial-environments",
  "execution-models",
  "transactions",
  "virtual-machines",
  "smart-contracts",
  "off-chain-computation",
  "resource-accounting",
];
