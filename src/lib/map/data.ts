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
  // 04 Consensus & Ordering
  consensus: ["consensus-models", "consensus-participants", "consensus-rules", "agreement", "quorums", "fault-assumptions"],
  validators: [
    "validator-selection",
    "validator-sets",
    { placementId: "proposers-in-validators", conceptId: "proposers" },
    "attesters",
    "validator-duties",
    "validator-incentives",
  ],
  "fork-choice": ["fork-choice-rules", "chain-selection", "competing-forks", "reorganizations", "head-selection"],
  "finality-in-consensus": [
    "probabilistic-finality",
    "deterministic-finality",
    "finality-gadgets",
    "checkpoints",
    "justification",
    "finalization",
  ],
  mempools: [
    "transaction-admission",
    "transaction-propagation",
    "transaction-prioritization",
    "mempool-policies",
    "private-mempools",
    "mempool-synchronization",
  ],
  sequencing: [
    "transaction-sequencing",
    "sequencing-rules",
    "centralized-sequencing",
    "decentralized-sequencing",
    "shared-sequencing",
    "sequencer-rotation",
  ],
  "block-building": [
    "block-construction",
    "transaction-selection",
    { placementId: "transaction-ordering-in-block-building", conceptId: "transaction-ordering" },
    "block-proposals",
    "block-validation",
    "block-production",
  ],
  "proposer-builder-separation": [
    { placementId: "proposers-in-proposer-builder-separation", conceptId: "proposers" },
    "builders",
    "builder-markets",
    "block-bids",
    "relays",
    "builder-selection",
  ],
  preconfirmations: [
    "execution-preconfirmations",
    "inclusion-preconfirmations",
    "preconfirmation-commitments",
    "preconfirmation-providers",
    "preconfirmation-guarantees",
  ],
  "censorship-resistance-in-consensus-ordering": [
    "transaction-inclusion",
    "inclusion-lists",
    "forced-inclusion",
    "censorship-detection",
    "censorship-recovery",
    "inclusion-guarantees",
  ],
  // 05 Networks & Infrastructure
  "p2p-networks": ["peer-discovery", "peer-connections", "network-topology", "peer-management", "gossip", "network-partitions"],
  "message-propagation": [
    "message-dissemination",
    "gossip-propagation",
    "propagation-latency",
    "message-validation",
    "duplicate-suppression",
    "flooding",
  ],
  nodes: [
    "full-nodes",
    "light-nodes",
    "archive-nodes",
    "validator-nodes",
    "bootnodes",
    { placementId: "synchronization-in-nodes", conceptId: "synchronization", contextualLabel: "Node Synchronization" },
  ],
  rpc: ["rpc-interfaces", "rpc-methods", "rpc-providers", "rpc-endpoints", "request-routing", "rate-limiting"],
  indexers: [
    "chain-indexers",
    "event-indexing",
    "state-indexing",
    "indexer-pipelines",
    "query-services",
    { placementId: "reorganization-handling-in-indexers", conceptId: "reorganization-handling" },
  ],
  relayers: ["transaction-relaying", "message-relaying", "relay-networks", "relay-policies", "relay-incentives"],
  keepers: [
    "condition-monitoring",
    "trigger-evaluation",
    "transaction-submission",
    { placementId: "automation-networks-in-keepers", conceptId: "automation-networks", contextualLabel: "Keeper Networks" },
    "keeper-incentives",
  ],
  bots: ["event-driven-bots", "trading-bots", "liquidation-bots", "arbitrage-bots", "governance-bots", "execution-bots"],
  monitoring: [
    "metrics",
    { placementId: "system-logs", conceptId: "system-logs", contextualLabel: "Logs" },
    { placementId: "distributed-traces", conceptId: "distributed-traces", contextualLabel: "Traces" },
    "health-checks",
    "alerting",
    "observability",
  ],
  automation: [
    "triggers",
    "scheduled-execution",
    "event-driven-execution",
    "conditional-execution",
    "automation-policies",
    "automation-networks",
  ],
  // 06 Cryptography & Proofs
  "hash-functions": [
    "cryptographic-hash-functions",
    "hash-properties",
    "collision-resistance",
    "preimage-resistance",
    "domain-separation",
    "hash-based-data-structures",
  ],
  "digital-signatures": [
    "key-pairs",
    "signing",
    "signature-verification",
    "signature-schemes",
    "signature-aggregation",
    "multisignatures",
  ],
  "cryptographic-commitments": [
    { placementId: "commitment-schemes-in-cryptographic-commitments", conceptId: "commitment-schemes" },
    "hiding",
    "binding",
    "opening",
    "polynomial-commitments",
    "vector-commitments",
  ],
  "threshold-cryptography": [
    "secret-sharing",
    "threshold-signatures",
    "distributed-key-generation",
    "threshold-decryption",
    "multi-party-computation",
    "quorum-cryptography",
  ],
  "zero-knowledge-proofs": ["zero-knowledge", "completeness", "soundness", "provers", "verifiers", "witnesses"],
  "proof-systems": [
    "interactive-proofs",
    "non-interactive-proofs",
    "snarks",
    "starks",
    "recursive-proofs",
    "proof-composition",
  ],
  "verifiable-computation-in-cryptography-proofs": [
    { placementId: "computation-proofs-in-cryptography-proofs", conceptId: "computation-proofs" },
    "verifiable-execution",
    "proof-generation",
    "proof-verification",
    "succinct-verification",
    "proof-carrying-computation",
  ],
  privacy: [
    "confidentiality",
    "anonymity",
    "unlinkability",
    "selective-disclosure",
    "private-computation",
    "privacy-preserving-protocols",
  ],
  // 07 Storage & Availability
  "on-chain-storage": [
    "persistent-storage",
    "storage-layout",
    "storage-slots",
    "storage-costs",
    "state-storage",
    "storage-optimization",
  ],
  "distributed-storage": [
    "storage-nodes",
    "data-replication",
    "data-distribution",
    "redundancy",
    { placementId: "fault-tolerance-in-distributed-storage", conceptId: "fault-tolerance" },
    "storage-networks",
  ],
  "content-addressing-in-storage-availability": [
    "content-identifiers",
    "content-hashing",
    "immutable-references",
    "address-resolution",
    "content-retrieval",
  ],
  "archival-storage": [
    "historical-data",
    "long-term-storage",
    { placementId: "archive-nodes-in-archival-storage", conceptId: "archive-nodes" },
    "data-retention",
    "data-pruning",
    "state-archiving",
  ],
  "data-availability": [
    "availability-guarantees",
    "data-publication",
    "data-retrieval",
    "availability-verification",
    "data-withholding",
    "availability-committees",
  ],
  "erasure-coding": [
    "data-shards",
    "redundant-encoding",
    { placementId: "data-reconstruction", conceptId: "data-reconstruction", contextualLabel: "Reconstruction" },
    "coding-parameters",
    "fault-recovery",
  ],
  blobs: ["blob-data", "blob-transactions", "blob-commitments", "blob-propagation", "blob-retention", "blob-pricing"],
  "data-availability-sampling": [
    "sampling",
    "random-sampling",
    "sample-verification",
    "availability-confidence",
    "light-client-sampling",
  ],
  "storage-proofs": [
    "proof-of-storage",
    "proof-of-replication",
    "proof-of-space",
    "proof-of-retrievability",
    { placementId: "proof-generation-in-storage-proofs", conceptId: "proof-generation" },
    { placementId: "proof-verification-in-storage-proofs", conceptId: "proof-verification" },
  ],
  // 08 Identity, Accounts & Authority
  identity: [
    "addresses",
    "decentralized-identifiers",
    "credentials",
    { placementId: "attestations-in-identity", conceptId: "attestations" },
    "reputation",
  ],
  accounts: [
    "externally-owned-accounts",
    "contract-accounts",
    "account-state",
    "account-nonces",
    "account-permissions",
    "account-recovery",
  ],
  wallets: [
    "key-management",
    { placementId: "signing-in-wallets", conceptId: "signing" },
    "transaction-construction",
    { placementId: "transaction-submission-in-wallets", conceptId: "transaction-submission" },
    "wallet-recovery",
    "wallet-security",
  ],
  "smart-accounts": [
    "programmable-accounts",
    "validation-logic",
    "execution-logic",
    "recovery-logic",
    "session-keys",
    "modular-accounts",
  ],
  "account-abstraction": [
    "user-operations",
    "bundlers",
    "entry-points",
    "paymasters",
    "alternative-mempools",
    "gas-abstraction",
  ],
  authentication: [
    "authentication-factors",
    "signature-authentication",
    "challenge-response",
    "session-authentication",
    "credential-authentication",
    "authentication-policies",
  ],
  authority: ["ownership", "roles", "capabilities", "delegation", "permission-models", "authority-boundaries"],
  // Agent Identity is the Phase 1 fixture's placement (ID unchanged), moved
  // from Identity to Machine Identity.
  "machine-identity": [
    "agent-identity",
    "agent-credentials",
    "agent-reputation",
    "agent-authorization",
    "machine-credentials",
    "machine-authentication",
  ],
  // 09 Oracles & External Reality
  "oracle-problem": [
    { placementId: "external-data-in-oracle-problem", conceptId: "external-data", contextualLabel: "External Information" },
    { placementId: "trust-assumptions-in-oracle-problem", conceptId: "trust-assumptions" },
    "verification-limits",
    { placementId: "authenticity-in-oracle-problem", conceptId: "authenticity", contextualLabel: "Data Authenticity" },
    { placementId: "external-data-availability", conceptId: "external-data-availability", contextualLabel: "Data Availability" },
    "oracle-failure",
  ],
  "data-sources": [
    "primary-sources",
    "secondary-sources",
    { placementId: "external-apis-in-data-sources", conceptId: "external-apis", contextualLabel: "APIs" },
    "market-data",
    "sensor-data",
    "source-diversity",
  ],
  "oracle-networks": [
    "oracle-nodes",
    "node-selection",
    "data-collection",
    "data-reporting",
    { placementId: "consensus-in-oracle-networks", conceptId: "consensus" },
    "oracle-incentives",
  ],
  "push-pull-oracles": ["push-oracles", "pull-oracles", "update-models", "request-response", "on-demand-updates"],
  "oracle-aggregation": [
    "data-aggregation",
    "medianization",
    "weighted-aggregation",
    "outlier-filtering",
    "quorum-aggregation",
    "aggregation-rules",
  ],
  freshness: [
    "update-frequency",
    "staleness",
    "timestamps",
    "freshness-thresholds",
    "heartbeats",
    "deviation-thresholds",
  ],
  "provenance-in-oracles-external-reality": [
    "source-provenance",
    { placementId: "lineage-in-oracles-external-reality", conceptId: "lineage", contextualLabel: "Data Lineage" },
    { placementId: "attribution-in-oracles-external-reality", conceptId: "attribution", contextualLabel: "Source Attribution" },
    "transformation-history",
    "provenance-verification",
  ],
  "oracle-security": [
    "oracle-manipulation",
    "data-poisoning",
    "source-compromise",
    "sybil-attacks",
    { placementId: "collusion-in-oracle-security", conceptId: "collusion" },
    "economic-attacks",
  ],
  "machine-readable-reality": [
    "structured-data",
    "semantic-data",
    "machine-readable-claims",
    "verifiable-claims",
    "data-schemas",
    "reality-interfaces",
  ],
  "sensors-external-systems": [
    "sensors",
    "iot-devices",
    "external-apis",
    "trusted-hardware",
    "physical-events",
    "cyber-physical-interfaces",
  ],
  "ai-interpreted-data": [
    "unstructured-data",
    { placementId: "information-extraction", conceptId: "information-extraction", contextualLabel: "Data Extraction" },
    "classification",
    "ai-inference",
    { placementId: "inference-confidence", conceptId: "inference-confidence", contextualLabel: "Confidence" },
    "interpretation-verification",
  ],
  "real-world-attestations": [
    { placementId: "real-world-attesters", conceptId: "real-world-attesters", contextualLabel: "Attesters" },
    "claims",
    "evidence",
    { placementId: "credentials-in-real-world-attestations", conceptId: "credentials" },
    "attestation-verification",
    "revocation",
  ],
  // 10 Economics & Mechanism Design
  incentives: [
    "incentive-alignment",
    "positive-incentives",
    "negative-incentives",
    "rewards",
    "penalties",
    "incentive-compatibility",
  ],
  "mechanism-design": [
    "mechanisms",
    { placementId: "mechanism-objectives", conceptId: "mechanism-objectives", contextualLabel: "Objectives" },
    { placementId: "mechanism-constraints", conceptId: "mechanism-constraints", contextualLabel: "Constraints" },
    "allocation-rules",
    "payment-rules",
    "mechanism-properties",
  ],
  "game-theory": ["players", "strategies", "payoffs", "best-responses", "dominant-strategies", "nash-equilibrium"],
  "strategic-behavior-in-economics-mechanism-design": [
    "rational-behavior",
    "deviations",
    "manipulation",
    "free-riding",
    "griefing",
    "bribery",
  ],
  "token-economics": ["token-supply", "token-distribution", "issuance", "emissions", "burns", "token-utility"],
  fees: ["transaction-fees", "fee-markets", "fee-calculation", "fee-allocation", "priority-fees", "congestion-pricing"],
  auctions: [
    "bids",
    "first-price-auctions",
    "second-price-auctions",
    "sealed-bid-auctions",
    "batch-auctions",
    "auction-clearing",
  ],
  "resource-allocation": [
    "scarce-resources",
    "resource-pricing",
    "capacity-allocation",
    "allocation-efficiency",
    "congestion",
    "rationing",
  ],
  "staking-economics": [
    "stake",
    "staking-rewards",
    "slashing",
    "validator-economics",
    "delegated-stake",
    "economic-security",
  ],
  "security-budgets": [
    "security-expenditure",
    "issuance-funded-security",
    "fee-funded-security",
    "security-subsidies",
    "attack-cost",
    "cost-of-corruption",
  ],
  "cryptoeconomic-security": [
    "economic-guarantees",
    "economic-finality",
    "incentive-attacks",
    "stake-based-security",
    { placementId: "penalties-in-cryptoeconomic-security", conceptId: "penalties", contextualLabel: "Economic Penalties" },
    "cryptoeconomic-assumptions",
  ],
  // 11 Markets & Financial Protocols
  assets: [
    "fungible-assets",
    "non-fungible-assets",
    "native-assets",
    "tokenized-assets",
    "synthetic-assets",
    "asset-properties",
  ],
  markets: ["market-participants", "buyers", "sellers", "market-prices", "market-efficiency", "market-structure"],
  liquidity: [
    "liquidity-providers",
    "liquidity-provision",
    "liquidity-depth",
    "liquidity-fragmentation",
    "capital-efficiency",
    { placementId: "liquidity-risk-in-liquidity", conceptId: "liquidity-risk" },
  ],
  "automated-market-makers": [
    "liquidity-pools",
    "constant-product",
    "invariant-functions",
    "pool-reserves",
    "lp-tokens",
    "impermanent-loss",
  ],
  "order-books": [
    "orders",
    "limit-orders",
    "market-orders",
    { placementId: "bids-in-order-books", conceptId: "bids" },
    "asks",
    "order-matching",
  ],
  "lending-borrowing": ["lending-markets", "borrowers", "lenders", "interest-rates", "utilization", "repayment"],
  collateral: [
    "collateralization",
    "collateral-ratios",
    "overcollateralization",
    "undercollateralization",
    "collateral-valuation",
    "collateral-risk",
  ],
  liquidations: [
    "liquidation-thresholds",
    "liquidators",
    "liquidation-incentives",
    "liquidation-penalties",
    "liquidation-auctions",
    "bad-debt",
  ],
  stablecoins: [
    "fiat-backed-stablecoins",
    "crypto-backed-stablecoins",
    "algorithmic-stablecoins",
    "pegs",
    "peg-stability",
    "depegging",
  ],
  derivatives: ["futures", "options", "perpetuals", "derivative-pricing", "margin", "settlement"],
  risk: [
    "market-risk",
    "credit-risk",
    { placementId: "liquidity-risk-in-risk", conceptId: "liquidity-risk" },
    "counterparty-risk",
    "systemic-risk",
    "risk-parameters",
  ],
  solvency: [
    "assets-and-liabilities",
    "reserves",
    "capitalization",
    "insolvency",
    "solvency-constraints",
    "loss-absorption",
  ],
  // 12 MEV & Execution Markets
  mev: ["mev-sources", "mev-opportunities", "mev-extraction", "mev-supply-chain", "toxic-mev", "non-toxic-mev"],
  searchers: [
    "search-strategies",
    "opportunity-detection",
    "transaction-simulation",
    "bundle-construction",
    "searcher-infrastructure",
    "searcher-competition",
  ],
  arbitrage: [
    "dex-arbitrage",
    "cross-market-arbitrage",
    "triangular-arbitrage",
    "atomic-arbitrage",
    "arbitrage-paths",
    "arbitrage-profit",
  ],
  "liquidation-mev": [
    "liquidation-opportunities",
    "liquidation-searchers",
    "liquidation-transactions",
    "liquidation-competition",
    "liquidation-profit",
    "liquidation-risk",
  ],
  sandwiching: [
    "sandwich-attacks",
    "front-running",
    "back-running",
    "victim-transactions",
    "price-impact",
    "slippage-exploitation",
  ],
  "transaction-ordering-in-mev-execution-markets": [
    "ordering-rights",
    "ordering-policies",
    "priority-ordering",
    "time-ordering",
    "fair-ordering",
    "ordering-manipulation",
  ],
  bundles: [
    "transaction-bundles",
    "bundle-ordering",
    "bundle-atomicity",
    "bundle-simulation",
    "bundle-submission",
    "bundle-inclusion",
  ],
  "builders-in-mev-execution-markets": [
    { placementId: "block-construction-in-builders", conceptId: "block-construction" },
    { placementId: "transaction-selection-in-builders", conceptId: "transaction-selection" },
    "bundle-selection",
    "block-optimization",
    "builder-strategies",
    "builder-competition",
  ],
  "blockspace-markets": [
    "blockspace",
    "blockspace-demand",
    "blockspace-supply",
    "blockspace-pricing",
    "priority-auctions",
    "inclusion-markets",
  ],
  "order-flow": [
    "public-order-flow",
    "private-order-flow",
    "order-flow-auctions",
    "order-flow-payments",
    "exclusive-order-flow",
    "order-flow-competition",
  ],
  "mev-auctions": [
    "mev-bids",
    "builder-auctions",
    "auction-participants",
    "auction-rules",
    { placementId: "auction-clearing-in-mev-auctions", conceptId: "auction-clearing" },
    "auction-revenue",
  ],
  "private-execution": [
    "private-transactions",
    { placementId: "private-mempools-in-private-execution", conceptId: "private-mempools" },
    "private-relays",
    "protected-order-flow",
    "mev-protection",
    "execution-privacy",
  ],
  "mev-mitigation": [
    "mev-redistribution",
    "mev-smoothing",
    "encrypted-mempools",
    "commit-reveal",
    "batch-execution",
    { placementId: "inclusion-guarantees-in-mev-mitigation", conceptId: "inclusion-guarantees" },
    "ordering-guarantees",
  ],
  // 13 Intents & Coordination
  intents: [
    "declarative-execution",
    "intent-expression",
    "intent-languages",
    "intent-standards",
    { placementId: "delegation-in-intents", conceptId: "delegation" },
    "intent-lifecycle",
  ],
  "intent-specification": [
    "intent-constraints",
    "user-preferences",
    "outcome-conditions",
    "validity-windows",
    "limit-prices",
    "partial-fills",
  ],
  "intent-discovery": [
    "intent-pools",
    "intent-propagation",
    "intent-visibility",
    "intent-privacy",
    "intent-aggregation",
    "solver-access",
  ],
  solvers: ["solver-networks", "solution-search", "solver-strategies", "solver-liquidity", "solver-bonds", "solver-reputation"],
  "solver-competition": [
    "solver-auctions",
    "solution-scoring",
    "winner-selection",
    { placementId: "batch-auctions-in-solver-competition", conceptId: "batch-auctions" },
    { placementId: "order-flow-auctions-in-solver-competition", conceptId: "order-flow-auctions" },
    "surplus-maximization",
  ],
  "intent-matching": [
    "coincidence-of-wants",
    "ring-trades",
    "batch-matching",
    "partial-matching",
    "peer-to-peer-matching",
    "matching-efficiency",
  ],
  "intent-resolution": [
    "solution-validity",
    "execution-paths",
    "execution-selection",
    "fulfillment",
    "fulfillment-verification",
    "failed-intents",
  ],
  "execution-routing": [
    "order-routing",
    "liquidity-routing",
    "route-optimization",
    "split-routing",
    "dex-aggregation",
    "cross-venue-routing",
  ],
  "intent-commitments": [
    "solver-commitments",
    "execution-guarantees",
    "price-guarantees",
    { placementId: "preconfirmations-in-intent-commitments", conceptId: "preconfirmations" },
    "intent-cancellation",
    "commitment-enforcement",
  ],
  "intent-settlement": [
    { placementId: "settlement-in-intent-settlement", conceptId: "settlement" },
    "atomic-settlement",
    "settlement-contracts",
    "batch-settlement",
    "net-settlement",
    "settlement-failure",
  ],
  "multi-party-coordination": [
    "multi-party-intents",
    "joint-execution",
    "coordination-mechanisms",
    { placementId: "collective-action-in-multi-party-coordination", conceptId: "collective-action" },
    "commitment-devices",
    "coordination-failures",
  ],
  "cross-domain-coordination": [
    "cross-chain-intents",
    "cross-domain-execution",
    "cross-domain-settlement",
    { placementId: "shared-sequencing-in-cross-domain-coordination", conceptId: "shared-sequencing" },
    "cross-domain-atomicity",
  ],
  // 14 Governance & Institutions
  "governance-models": [
    "on-chain-governance",
    "off-chain-governance",
    "token-based-governance",
    "reputation-based-governance",
    "futarchy",
    "governance-minimization",
  ],
  "governance-participants": [
    "token-holders",
    "voters",
    "delegates",
    "stewards",
    "stakeholders",
    "voter-participation",
  ],
  proposals: [
    "proposal-lifecycle",
    "proposal-submission",
    "proposal-thresholds",
    "deliberation",
    "signaling-votes",
    "proposal-review",
  ],
  voting: [
    "voting-mechanisms",
    "token-weighted-voting",
    "quadratic-voting",
    "conviction-voting",
    "optimistic-governance",
    "vote-privacy",
  ],
  representation: [
    { placementId: "delegation-in-representation", conceptId: "delegation" },
    "liquid-democracy",
    "delegate-incentives",
    "delegate-accountability",
    "constituencies",
    "representative-bodies",
  ],
  "decision-rules": [
    "majority-rule",
    "supermajority",
    "quorum-requirements",
    "approval-thresholds",
    "veto-rights",
    "tie-breaking",
  ],
  "governance-execution": [
    "proposal-execution",
    "timelocks",
    "parameter-changes",
    "protocol-upgrades",
    "execution-authority",
  ],
  "councils-committees": [
    "security-councils",
    "working-groups",
    "committee-selection",
    "mandates",
    "term-limits",
    "signer-sets",
  ],
  "treasury-governance": [
    "treasuries",
    "treasury-management",
    "budget-allocation",
    "grants",
    "public-goods-funding",
    "spending-controls",
  ],
  "constitutional-rules": [
    "constitutions",
    "rule-changes",
    "amendment-processes",
    "immutability",
    "governance-scope",
    "social-consensus",
  ],
  "checks-balances": [
    "separation-of-powers",
    "oversight",
    "accountability",
    "transparency",
    "exit-rights",
    "minority-protection",
  ],
  "dispute-resolution": [
    "arbitration",
    "appeals",
    "decentralized-courts",
    { placementId: "evidence-in-dispute-resolution", conceptId: "evidence" },
    "juror-selection",
    "ruling-enforcement",
  ],
  "emergency-governance": [
    "emergency-powers",
    "pause-mechanisms",
    "guardians",
    "emergency-upgrades",
    "circuit-breakers",
    "incident-response",
  ],
  "governance-attacks": [
    "governance-capture",
    "vote-buying",
    "borrowed-voting-power",
    "voter-apathy",
    "plutocracy",
    "hostile-takeovers",
  ],
  "institutional-design": [
    "institutions",
    "legitimacy",
    "credible-neutrality",
    { placementId: "incentive-alignment-in-institutional-design", conceptId: "incentive-alignment" },
    "path-dependence",
    "institutional-evolution",
  ],
  // 15 Scaling & Modular Systems (Rollups' Finality is the fixture's placement, order 5)
  scaling: [
    "vertical-scaling",
    "horizontal-scaling",
    "execution-scaling",
    "state-growth",
    "scaling-bottlenecks",
    "layer-2-scaling",
  ],
  rollups: ["rollup-architecture", "based-rollups", "sovereign-rollups", "rollup-state", "rollup-interoperability"],
  "optimistic-rollups": [
    "fraud-proofs",
    "challenge-periods",
    "interactive-fraud-proofs",
    "dispute-games",
    "state-proposers",
    "withdrawal-delays",
  ],
  "zk-rollups": [
    "validity-proofs",
    { placementId: "provers-in-zk-rollups", conceptId: "provers" },
    "proof-aggregation",
    { placementId: "recursive-proofs-in-zk-rollups", conceptId: "recursive-proofs" },
    "proving-costs",
    "zkevms",
  ],
  "off-chain-scaling": [
    "sidechains",
    "state-channels",
    "payment-channels",
    "plasma",
    "validiums",
    { placementId: "off-chain-execution-in-off-chain-scaling", conceptId: "off-chain-execution" },
  ],
  modularity: [
    "modular-blockchains",
    "monolithic-blockchains",
    "layer-separation",
    "component-interfaces",
    "unbundling",
    "modular-tradeoffs",
  ],
  "execution-layers": [
    "evm-equivalence",
    "evm-compatibility",
    { placementId: "parallel-execution-in-execution-layers", conceptId: "parallel-execution" },
    { placementId: "transition-functions-in-execution-layers", conceptId: "transition-functions" },
    "execution-clients",
    "alternative-vms",
  ],
  "settlement-layers": [
    "rollup-settlement",
    "rollup-finality",
    { placementId: "state-commitments-in-settlement-layers", conceptId: "state-commitments" },
    "withdrawals",
    "forced-withdrawals",
    "withdrawal-proofs",
  ],
  "data-availability-layers": [
    { placementId: "data-availability-in-data-availability-layers", conceptId: "data-availability" },
    { placementId: "blobs-in-data-availability-layers", conceptId: "blobs" },
    { placementId: "data-availability-sampling-in-data-availability-layers", conceptId: "data-availability-sampling" },
    { placementId: "availability-committees-in-data-availability-layers", conceptId: "availability-committees" },
    { placementId: "calldata-in-data-availability-layers", conceptId: "calldata" },
    "alternative-data-availability",
  ],
  "consensus-layers": ["base-layers", "shared-security", "restaking", "layer-coupling"],
  "rollup-sequencing": [
    "sequencers",
    { placementId: "centralized-sequencing-in-rollup-sequencing", conceptId: "centralized-sequencing" },
    { placementId: "decentralized-sequencing-in-rollup-sequencing", conceptId: "decentralized-sequencing" },
    { placementId: "shared-sequencing-in-rollup-sequencing", conceptId: "shared-sequencing" },
    "based-sequencing",
    "sequencer-liveness",
  ],
  "batching-compression": [
    "transaction-batching",
    "batch-posting",
    "data-compression",
    "state-diffs",
    "cost-amortization",
  ],
  "scaling-tradeoffs": [
    "throughput",
    "confirmation-latency",
    "scaling-costs",
    "decentralization",
    "scalability-trilemma",
  ],
  "rollup-security": [
    "security-inheritance",
    "rollup-maturity-stages",
    "upgrade-keys",
    "escape-hatches",
    "sequencer-censorship",
    { placementId: "trust-assumptions-in-rollup-security", conceptId: "trust-assumptions" },
  ],
  // 16 Interoperability & Abstraction
  "interoperability-models": [
    "native-interoperability",
    "trusted-interoperability",
    "trust-minimized-interoperability",
    "hub-and-spoke-interoperability",
    "point-to-point-interoperability",
    "cross-chain-composability",
  ],
  "cross-chain-messaging": [
    "cross-chain-messages",
    "message-delivery",
    "message-ordering",
    "replay-protection",
    "message-authentication",
    { placementId: "relayers-in-cross-chain-messaging", conceptId: "relayers" },
  ],
  "bridges": [
    "bridge-contracts",
    "bridge-operators",
    "bridge-custody",
    "canonical-bridges",
    "third-party-bridges",
    "bridge-upgradeability",
  ],
  "asset-bridging": [
    "lock-and-mint",
    "burn-and-mint",
    "liquidity-based-bridging",
    "wrapped-assets",
    "canonical-assets",
    "bridged-asset-risk",
  ],
  "cross-chain-state": [
    "remote-state",
    { placementId: "state-proofs-in-cross-chain-state", conceptId: "state-proofs" },
    { placementId: "state-roots-in-cross-chain-state", conceptId: "state-roots" },
    "cross-chain-queries",
    "header-relaying",
    "cross-chain-state-sync",
  ],
  "cross-chain-verification": [
    "light-client-verification",
    "zk-verification",
    "optimistic-verification",
    "committee-verification",
    { placementId: "finality-in-cross-chain-verification", conceptId: "finality" },
    "verification-latency",
  ],
  "interoperability-protocols": [
    "interoperability-standards",
    "messaging-protocols",
    "inter-blockchain-communication",
    "cross-chain-token-standards",
    "protocol-adapters",
    "interoperability-layers",
  ],
  "cross-domain-execution-in-interoperability-abstraction": [
    "cross-chain-transactions",
    "cross-chain-calls",
    "remote-execution",
    "execution-callbacks",
    { placementId: "cross-chain-intents-in-cross-chain-execution", conceptId: "cross-chain-intents" },
    "execution-failure-handling",
  ],
  "cross-domain-settlement-in-interoperability-abstraction": [
    "settlement-latency",
    "settlement-proofs",
    "rebalancing",
    "solver-repayment",
    "reorg-risk",
  ],
  "cross-domain-atomicity-in-interoperability-abstraction": [
    "atomic-swaps",
    "hashed-timelock-contracts",
    "two-phase-commit",
    { placementId: "shared-sequencing-in-cross-chain-atomicity", conceptId: "shared-sequencing" },
    "partial-failures",
    "atomicity-guarantees",
  ],
  "chain-abstraction": [
    "unified-accounts",
    "unified-balances",
    "chain-agnostic-interfaces",
    "chain-routing",
    "resource-locks",
    { placementId: "account-abstraction-in-chain-abstraction", conceptId: "account-abstraction" },
  ],
  "abstraction-layers": [
    "asset-abstraction",
    { placementId: "gas-abstraction-in-abstraction-layers", conceptId: "gas-abstraction" },
    "liquidity-abstraction",
    "intent-based-abstraction",
    "execution-abstraction",
  ],
  "interoperability-security": [
    "bridge-security",
    "bridge-exploits",
    "verifier-compromise",
    "message-forgery",
    "replay-attacks",
    "transfer-limits",
  ],
  "trust-failure-modes": [
    { placementId: "trust-assumptions-in-trust-failure-modes", conceptId: "trust-assumptions" },
    "liveness-failures",
    "safety-failures",
    "failure-isolation",
    "contagion-risk",
    { placementId: "pause-mechanisms-in-trust-failure-modes", conceptId: "pause-mechanisms" },
  ],
  // 17 Security, Correctness & Resilience
  "security-models": [
    { placementId: "threat-models-in-security-models", conceptId: "threat-models" },
    { placementId: "adversaries-in-security-models", conceptId: "adversaries" },
    { placementId: "byzantine-behavior-in-security-models", conceptId: "byzantine-behavior" },
    { placementId: "trust-boundaries-in-security-models", conceptId: "trust-boundaries" },
    "security-assumptions",
    "defense-in-depth",
  ],
  "security-properties": [
    { placementId: "safety-in-security-properties", conceptId: "safety" },
    { placementId: "liveness-in-security-properties", conceptId: "liveness" },
    "integrity",
    { placementId: "confidentiality-in-security-properties", conceptId: "confidentiality" },
    { placementId: "availability-in-security-properties", conceptId: "availability" },
    { placementId: "censorship-resistance-in-security-properties", conceptId: "censorship-resistance" },
  ],
  "threat-modeling": [
    "attack-surfaces",
    "attack-vectors",
    "threat-analysis",
    "risk-assessment",
    "attack-trees",
    "security-requirements",
  ],
  "attack-classes": [
    "denial-of-service-attacks",
    { placementId: "sybil-attacks-in-attack-classes", conceptId: "sybil-attacks" },
    "eclipse-attacks",
    { placementId: "replay-attacks-in-attack-classes", conceptId: "replay-attacks" },
    { placementId: "collusion-in-attack-classes", conceptId: "collusion" },
    { placementId: "griefing-in-attack-classes", conceptId: "griefing" },
  ],
  "vulnerabilities-exploits": [
    "vulnerabilities",
    "exploits",
    "vulnerability-classes",
    "zero-day-vulnerabilities",
    "vulnerability-disclosure",
    "bug-bounties",
  ],
  "smart-contract-security": [
    "reentrancy",
    "arithmetic-errors",
    "access-control-flaws",
    "unchecked-external-calls",
    "flash-loan-attacks",
    { placementId: "oracle-manipulation-in-smart-contract-security", conceptId: "oracle-manipulation" },
  ],
  "protocol-security": [
    "execution-security",
    "consensus-attacks",
    "network-attacks",
    "cryptographic-failures",
    "data-integrity-attacks",
    "identity-attacks",
    { placementId: "economic-attacks-in-protocol-security", conceptId: "economic-attacks" },
  ],
  correctness: [
    "specifications",
    "invariants",
    "functional-correctness",
    "validation",
    { placementId: "verification-in-correctness", conceptId: "verification" },
    "correctness-proofs",
  ],
  "formal-methods": [
    "formal-verification",
    "model-checking",
    "theorem-proving",
    "symbolic-execution",
    "static-analysis",
    "formal-specifications",
  ],
  testing: [
    "unit-testing",
    "integration-testing",
    "fuzzing",
    "property-based-testing",
    "invariant-testing",
    "adversarial-testing",
  ],
  auditing: ["security-audits", "code-review", "audit-scope", "audit-findings", "remediation", "continuous-auditing"],
  "access-control": [
    { placementId: "authentication-in-access-control", conceptId: "authentication" },
    "authorization",
    { placementId: "permission-models-in-access-control", conceptId: "permission-models" },
    "least-privilege",
    "privilege-escalation",
    "role-based-access-control",
  ],
  "key-security": [
    "key-compromise",
    "key-custody",
    "key-rotation",
    "hardware-security-modules",
    "blind-signing",
    "social-engineering",
  ],
  "operational-security": [
    "infrastructure-security",
    "deployment-security",
    "configuration-errors",
    "supply-chain-security",
    "insider-threats",
    "operational-failures",
  ],
  "security-monitoring": [
    "threat-detection",
    "anomaly-detection",
    { placementId: "alerting-in-security-monitoring", conceptId: "alerting" },
    "on-chain-monitoring",
    "security-telemetry",
    "forensics",
  ],
  "incident-response-in-security-correctness-resilience": [
    "containment",
    { placementId: "pause-mechanisms-in-incident-response", conceptId: "pause-mechanisms" },
    { placementId: "circuit-breakers-in-incident-response", conceptId: "circuit-breakers" },
    "response-coordination",
    "post-mortems",
    "incident-disclosure",
  ],
  resilience: [
    { placementId: "fault-tolerance-in-resilience", conceptId: "fault-tolerance" },
    { placementId: "redundancy-in-resilience", conceptId: "redundancy" },
    "graceful-degradation",
    { placementId: "failure-isolation-in-resilience", conceptId: "failure-isolation" },
    "recovery",
    "disaster-recovery",
  ],
  "security-economics": [
    { placementId: "economic-security-in-security-economics", conceptId: "economic-security" },
    "cryptographic-security",
    { placementId: "attack-cost-in-security-economics", conceptId: "attack-cost" },
    { placementId: "cost-of-corruption-in-security-economics", conceptId: "cost-of-corruption" },
    { placementId: "security-inheritance-in-security-economics", conceptId: "security-inheritance" },
  ],
  "upgrade-security": [
    { placementId: "upgrade-keys-in-upgrade-security", conceptId: "upgrade-keys" },
    { placementId: "timelocks-in-upgrade-security", conceptId: "timelocks" },
    "proxy-upgrade-risks",
    "upgrade-verification",
    { placementId: "emergency-upgrades-in-upgrade-security", conceptId: "emergency-upgrades" },
  ],
  "domain-specific-security": [
    { placementId: "oracle-security-in-domain-specific-security", conceptId: "oracle-security" },
    { placementId: "governance-attacks-in-domain-specific-security", conceptId: "governance-attacks" },
    { placementId: "rollup-security-in-domain-specific-security", conceptId: "rollup-security" },
    { placementId: "bridge-security-in-domain-specific-security", conceptId: "bridge-security" },
    { placementId: "mev-protection-in-domain-specific-security", conceptId: "mev-protection" },
    { placementId: "wallet-security-in-domain-specific-security", conceptId: "wallet-security" },
  ],
  // 18 Protocol Architecture
  "architectural-principles": [
    "separation-of-concerns",
    "abstraction-boundaries",
    "protocol-minimalism",
    { placementId: "credible-neutrality-in-architectural-principles", conceptId: "credible-neutrality" },
    { placementId: "decentralization-in-architectural-principles", conceptId: "decentralization" },
  ],
  "protocol-layers": [
    "layered-architecture",
    "protocol-stack",
    "layer-responsibilities",
    "cross-layer-dependencies",
    { placementId: "modularity-in-protocol-layers", conceptId: "modularity" },
    { placementId: "layer-separation-in-protocol-layers", conceptId: "layer-separation" },
  ],
  "components-interfaces": [
    "protocol-components",
    { placementId: "component-interfaces-in-components-interfaces", conceptId: "component-interfaces" },
    "protocol-standards",
    "component-dependencies",
    "extension-points",
    "protocol-hooks",
  ],
  "state-architecture": [
    { placementId: "state-models-in-state-architecture", conceptId: "state-models" },
    "state-ownership",
    "state-partitioning",
    "state-access-patterns",
    "shared-state",
    "state-isolation",
  ],
  "execution-architecture": [
    { placementId: "execution-models-in-execution-architecture", conceptId: "execution-models" },
    "execution-pipelines",
    "execution-scheduling",
    "execution-boundaries",
    "call-graphs",
    "concurrency-models",
  ],
  "contract-architecture": [
    "contract-systems",
    "proxy-patterns",
    "factory-patterns",
    "contract-libraries",
    "singleton-contracts",
    "contract-registries",
  ],
  "client-architecture": [
    { placementId: "execution-clients-in-client-architecture", conceptId: "execution-clients" },
    "consensus-clients",
    "client-diversity",
    "client-separation",
    "node-roles",
    "client-interfaces",
  ],
  "network-architecture": [
    { placementId: "network-topology-in-network-architecture", conceptId: "network-topology" },
    "overlay-networks",
    "network-layers",
    "peer-roles",
    "network-segmentation",
  ],
  "data-architecture": [
    "data-models",
    "data-placement",
    "storage-architecture",
    "data-flows",
    { placementId: "data-schemas-in-data-architecture", conceptId: "data-schemas" },
  ],
  "trust-architecture": [
    { placementId: "trust-boundaries-in-trust-architecture", conceptId: "trust-boundaries" },
    "trusted-components",
    "trusted-computing-base",
    { placementId: "trust-minimization-in-trust-architecture", conceptId: "trust-minimization" },
    "trust-dependencies",
  ],
  composability: [
    "synchronous-composability",
    "asynchronous-composability",
    "atomic-composability",
    { placementId: "cross-chain-composability-in-composability", conceptId: "cross-chain-composability" },
    "protocol-integrations",
    "composability-risks",
  ],
  "architectural-tradeoffs": [
    "coupling",
    "cohesion",
    "architectural-complexity",
    "extensibility",
    "technical-debt",
    { placementId: "immutability-in-architectural-tradeoffs", conceptId: "immutability" },
  ],
  // 19 Protocol Design & Lifecycle
  "protocol-requirements": [
    "problem-definition",
    { placementId: "stakeholders-in-protocol-requirements", conceptId: "stakeholders" },
    "functional-requirements",
    "non-functional-requirements",
    { placementId: "security-requirements-in-protocol-requirements", conceptId: "security-requirements" },
    "requirements-traceability",
  ],
  "design-goals-constraints": [
    "design-goals",
    "non-goals",
    "design-constraints",
    "design-assumptions",
    "success-criteria",
    { placementId: "invariants-in-design-goals-constraints", conceptId: "invariants" },
  ],
  "protocol-specification": [
    { placementId: "specifications-in-protocol-specification", conceptId: "specifications" },
    { placementId: "formal-specifications-in-protocol-specification", conceptId: "formal-specifications" },
    "specification-languages",
    { placementId: "rules-in-protocol-specification", conceptId: "rules" },
    "specification-ambiguity",
  ],
  "protocol-modeling": [
    "reference-models",
    { placementId: "state-machines-in-protocol-modeling", conceptId: "state-machines" },
    { placementId: "mechanism-design-in-protocol-modeling", conceptId: "mechanism-design" },
    "economic-modeling",
    { placementId: "threat-modeling-in-protocol-modeling", conceptId: "threat-modeling" },
    "agent-based-modeling",
  ],
  "prototyping-simulation": [
    "prototyping",
    "protocol-simulation",
    "proof-of-concepts",
    "devnets",
    "testnets",
    "shadow-forks",
  ],
  "protocol-implementation": [
    "reference-implementations",
    "production-implementations",
    { placementId: "client-diversity-in-protocol-implementation", conceptId: "client-diversity" },
    "specification-conformance",
    "conformance-testing",
    "implementation-drift",
  ],
  "pre-launch-validation": [
    { placementId: "validation-in-pre-launch-validation", conceptId: "validation" },
    { placementId: "testing-in-pre-launch-validation", conceptId: "testing" },
    { placementId: "formal-methods-in-pre-launch-validation", conceptId: "formal-methods" },
    { placementId: "auditing-in-pre-launch-validation", conceptId: "auditing" },
    { placementId: "bug-bounties-in-pre-launch-validation", conceptId: "bug-bounties" },
    "launch-readiness",
  ],
  "deployment-launch": [
    "protocol-deployment",
    "genesis",
    { placementId: "deployment-security-in-deployment-launch", conceptId: "deployment-security" },
    "protocol-launch",
    "protocol-bootstrapping",
    "phased-rollouts",
  ],
  parameterization: [
    "protocol-parameters",
    "initial-parameters",
    "parameter-tuning",
    "parameter-bounds",
    { placementId: "parameter-changes-in-parameterization", conceptId: "parameter-changes" },
    "configuration-management",
  ],
  "protocol-operations": [
    "post-launch-monitoring",
    "maintenance-releases",
    "client-updates",
    "operational-runbooks",
    { placementId: "incident-response-in-protocol-operations", conceptId: "incident-response" },
    "network-health",
  ],
  "change-management": [
    "improvement-proposals",
    { placementId: "protocol-upgrades-in-change-management", conceptId: "protocol-upgrades" },
    "hard-forks",
    "soft-forks",
    { placementId: "rule-changes-in-change-management", conceptId: "rule-changes" },
    "upgrade-coordination",
  ],
  "versioning-compatibility": [
    "protocol-versioning",
    "backward-compatibility",
    "forward-compatibility",
    "migrations",
    "state-migrations",
    "breaking-changes",
  ],
  "protocol-evolution": [
    "evolutionary-paths",
    "progressive-decentralization",
    "ossification",
    { placementId: "technical-debt-in-protocol-evolution", conceptId: "technical-debt" },
    "lifecycle-risks",
  ],
  "deprecation-retirement": [
    "deprecation",
    "protocol-sunsetting",
    "protocol-retirement",
    "migration-paths",
    "legacy-support",
  ],
  // 20 AI & Intelligent Systems
  "ai-models": [
    "training-data",
    "model-training",
    "model-weights",
    "foundation-models",
    "fine-tuning",
    "model-capabilities",
  ],
  "ai-inference-in-ai-intelligent-systems": [
    "model-inputs",
    "model-outputs",
    "decoding",
    "inference-reproducibility",
    "inference-cost",
    "inference-providers",
  ],
  reasoning: ["reasoning-traces", "test-time-compute", "self-correction", "reasoning-faithfulness", "world-models"],
  "goals-planning": ["goals", "task-decomposition", "plans", "planning-horizons", "replanning"],
  "memory-context": [
    "context-windows",
    "context-management",
    "long-term-memory",
    "embeddings",
    "retrieval-augmented-generation",
  ],
  "tool-use": ["tools", "tool-calling", "tool-schemas", "tool-results", "tool-selection", "tool-protocols"],
  "ai-agent": [
    "principals",
    "agent-loops",
    "agent-actions",
    "autonomy-levels",
    { placementId: "delegation-in-ai-agents", conceptId: "delegation" },
    { placementId: "agent-identity-in-ai-agents", conceptId: "agent-identity" },
  ],
  "uncertainty-reliability": [
    "model-uncertainty",
    "model-calibration",
    { placementId: "inference-confidence-in-uncertainty-reliability", conceptId: "inference-confidence" },
    "hallucinations",
    "model-robustness",
    "distribution-shift",
  ],
  "ai-evaluation": [
    "benchmarks",
    "capability-evaluations",
    "safety-evaluations",
    "red-teaming",
    "benchmark-contamination",
    "model-graded-evaluation",
  ],
  "alignment-control": [
    "goal-specification",
    "specification-gaming",
    "guardrails",
    "human-oversight",
    "interpretability",
    "corrigibility",
  ],
  "ai-security": [
    "prompt-injection",
    "jailbreaks",
    "adversarial-examples",
    "training-data-poisoning",
    "model-backdoors",
    "model-extraction",
  ],
  "verifiable-ai": [
    "verifiable-inference",
    "zkml",
    { placementId: "trusted-execution-in-verifiable-ai", conceptId: "trusted-execution" },
    "model-commitments",
    "model-provenance",
    "verifiable-agents",
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
 * L2 topics of Computation & Execution, State & Data, Consensus & Ordering,
 * Networks & Infrastructure, Cryptography & Proofs, Storage & Availability,
 * Identity, Accounts & Authority, Oracles & External Reality, Economics &
 * Mechanism Design, Markets & Financial Protocols, MEV & Execution Markets,
 * Intents & Coordination, Governance & Institutions, Scaling & Modular
 * Systems, Interoperability & Abstraction, Security, Correctness &
 * Resilience, Protocol Architecture, Protocol Design & Lifecycle, and AI &
 * Intelligent Systems; and a deliberately small Phase 1 proof fixture
 * re-homed beneath its L0 domains.
 */
export const mapKnowledge: MapKnowledgeModel = {
  concepts: [
    ...l0Concepts,
    // Foundations' conceptual layer (Distributed Systems is shared with the fixture).
    { id: "protocols", slug: "protocols", title: "Protocols" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "state-machines", slug: "state-machines", title: "State Machines", preferredPlacementId: "state-machines" },
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
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "rules", slug: "rules", title: "Rules", preferredPlacementId: "rules" },
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
    // Also placed under 09's Oracle Problem; this placement is preferred.
    { id: "trust-assumptions", slug: "trust-assumptions", title: "Trust Assumptions", preferredPlacementId: "trust-assumptions" },
    { id: "trusted-parties", slug: "trusted-parties", title: "Trusted Parties" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "trust-boundaries",
      slug: "trust-boundaries",
      title: "Trust Boundaries",
      preferredPlacementId: "trust-boundaries",
    },
    // Also placed under Verifiable Computation: checking a computation's proof
    // is the same act as checking any claim instead of trusting its source.
    { id: "verification", slug: "verification", title: "Verification", preferredPlacementId: "verification" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    {
      id: "trust-minimization",
      slug: "trust-minimization",
      title: "Trust Minimization",
      preferredPlacementId: "trust-minimization",
    },
    { id: "trust-distribution", slug: "trust-distribution", title: "Trust Distribution" },
    { id: "coordination-models", slug: "coordination-models", title: "Coordination Models" },
    { id: "information", slug: "information", title: "Information" },
    { id: "coordination-communication", slug: "coordination-communication", title: "Communication" },
    { id: "cooperation", slug: "cooperation", title: "Cooperation" },
    { id: "competition", slug: "competition", title: "Competition" },
    // Also placed under 13's Multi-Party Coordination; this placement is preferred.
    { id: "collective-action", slug: "collective-action", title: "Collective Action", preferredPlacementId: "collective-action" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "adversaries", slug: "adversaries", title: "Adversaries", preferredPlacementId: "adversaries" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "threat-models", slug: "threat-models", title: "Threat Models", preferredPlacementId: "threat-models" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "byzantine-behavior",
      slug: "byzantine-behavior",
      title: "Byzantine Behavior",
      preferredPlacementId: "byzantine-behavior",
    },
    { id: "censorship", slug: "censorship", title: "Censorship" },
    // Also placed under 09's Oracle Security; this placement is preferred.
    { id: "collusion", slug: "collusion", title: "Collusion", preferredPlacementId: "collusion" },
    // Participants acting in their own interest; also an L1 topic of 10
    // Economics & Mechanism Design, its game-theoretic home, preferred there.
    {
      id: "strategic-behavior",
      slug: "strategic-behavior",
      title: "Strategic Behavior",
      preferredPlacementId: "strategic-behavior-in-economics-mechanism-design",
    },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "safety", slug: "safety", title: "Safety", preferredPlacementId: "safety" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "liveness", slug: "liveness", title: "Liveness", preferredPlacementId: "liveness" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "availability", slug: "availability", title: "Availability", preferredPlacementId: "availability" },
    { id: "consistency", slug: "consistency", title: "Consistency" },
    // Also placed under 07's Distributed Storage; this placement is preferred.
    { id: "fault-tolerance", slug: "fault-tolerance", title: "Fault Tolerance", preferredPlacementId: "fault-tolerance" },
    // Also 04 Consensus & Ordering's L1 topic, where the property is taught
    // through its inclusion mechanisms; that placement is preferred.
    {
      id: "censorship-resistance",
      slug: "censorship-resistance",
      title: "Censorship Resistance",
      preferredPlacementId: "censorship-resistance-in-consensus-ordering",
    },
    // 02 Computation & Execution: L1 topics.
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    {
      id: "execution-models",
      slug: "execution-models",
      title: "Execution Models",
      preferredPlacementId: "execution-models",
    },
    { id: "transactions", slug: "transactions", title: "Transactions" },
    { id: "virtual-machines", slug: "virtual-machines", title: "Virtual Machines" },
    { id: "smart-contracts", slug: "smart-contracts", title: "Smart Contracts" },
    // Also an L1 topic of 06 Cryptography & Proofs, the home of proofs; preferred there.
    {
      id: "verifiable-computation",
      slug: "verifiable-computation",
      title: "Verifiable Computation",
      preferredPlacementId: "verifiable-computation-in-cryptography-proofs",
    },
    { id: "off-chain-computation", slug: "off-chain-computation", title: "Off-Chain Computation" },
    { id: "resource-accounting", slug: "resource-accounting", title: "Resource Accounting" },
    // L2 topics (placements in L2_TOPICS). Deterministic Execution is an
    // execution model, not Foundations' Determinism (the property it relies on).
    { id: "deterministic-execution", slug: "deterministic-execution", title: "Deterministic Execution" },
    { id: "non-deterministic-execution", slug: "non-deterministic-execution", title: "Non-Deterministic Execution" },
    { id: "sequential-execution", slug: "sequential-execution", title: "Sequential Execution" },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "parallel-execution",
      slug: "parallel-execution",
      title: "Parallel Execution",
      preferredPlacementId: "parallel-execution",
    },
    { id: "optimistic-execution", slug: "optimistic-execution", title: "Optimistic Execution" },
    { id: "speculative-execution", slug: "speculative-execution", title: "Speculative Execution" },
    { id: "transaction-lifecycle", slug: "transaction-lifecycle", title: "Transaction Lifecycle" },
    { id: "transaction-structure", slug: "transaction-structure", title: "Transaction Structure" },
    // Also placed under 04's Block Building, the domain of ordering, and as an L1
    // topic of 12 MEV & Execution Markets; preferred in 04.
    {
      id: "transaction-ordering",
      slug: "transaction-ordering",
      title: "Transaction Ordering",
      preferredPlacementId: "transaction-ordering-in-block-building",
    },
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
    // Also under 06's Verifiable Computation; preferred there.
    {
      id: "computation-proofs",
      slug: "computation-proofs",
      title: "Computation Proofs",
      preferredPlacementId: "computation-proofs-in-cryptography-proofs",
    },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "off-chain-execution",
      slug: "off-chain-execution",
      title: "Off-Chain Execution",
      preferredPlacementId: "off-chain-execution",
    },
    { id: "on-chain-verification", slug: "on-chain-verification", title: "On-Chain Verification" },
    // Also placed under 20's Verifiable AI (inference run in an enclave); this
    // placement is preferred.
    { id: "trusted-execution", slug: "trusted-execution", title: "Trusted Execution", preferredPlacementId: "trusted-execution" },
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
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "state-commitments",
      slug: "state-commitments",
      title: "State Commitments",
      preferredPlacementId: "state-commitments",
    },
    { id: "historical-state", slug: "historical-state", title: "Historical State" },
    // A node bringing itself up to date with the network; also placed as 05's
    // "Node Synchronization". This placement is preferred.
    { id: "synchronization", slug: "synchronization", title: "Synchronization", preferredPlacementId: "synchronization" },
    { id: "on-chain-data", slug: "on-chain-data", title: "On-Chain Data" },
    { id: "off-chain-data", slug: "off-chain-data", title: "Off-Chain Data" },
    { id: "data-integrity", slug: "data-integrity", title: "Data Integrity" },
    // The origin and history of data; also an L1 topic of 09 Oracles & External
    // Reality with its own layer. This placement is preferred.
    { id: "provenance", slug: "provenance", title: "Provenance", preferredPlacementId: "provenance" },
    { id: "indexing", slug: "indexing", title: "Indexing" },
    // L2 topics (placements in L2_TOPICS).
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    { id: "state-models", slug: "state-models", title: "State Models", preferredPlacementId: "state-models" },
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
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "transition-functions",
      slug: "transition-functions",
      title: "Transition Functions",
      preferredPlacementId: "transition-functions",
    },
    { id: "valid-transitions", slug: "valid-transitions", title: "Valid Transitions" },
    { id: "invalid-transitions", slug: "invalid-transitions", title: "Invalid Transitions" },
    { id: "transition-preconditions", slug: "transition-preconditions", title: "Transition Preconditions" },
    { id: "transition-effects", slug: "transition-effects", title: "Transition Effects" },
    { id: "atomic-state-transitions", slug: "atomic-state-transitions", title: "Atomic State Transitions" },
    { id: "merkle-trees", slug: "merkle-trees", title: "Merkle Trees" },
    { id: "merkle-patricia-tries", slug: "merkle-patricia-tries", title: "Merkle Patricia Tries" },
    { id: "verkle-trees", slug: "verkle-trees", title: "Verkle Trees" },
    // The cryptographic primitive; also under 06's Commitments, preferred there.
    {
      id: "commitment-schemes",
      slug: "commitment-schemes",
      title: "Commitment Schemes",
      preferredPlacementId: "commitment-schemes-in-cryptographic-commitments",
    },
    // Also placed under 16's Cross-Chain State; this placement is preferred.
    { id: "state-proofs", slug: "state-proofs", title: "State Proofs", preferredPlacementId: "state-proofs" },
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
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    { id: "calldata", slug: "calldata", title: "Calldata", preferredPlacementId: "calldata" },
    { id: "logs", slug: "logs", title: "Logs" },
    { id: "events", slug: "events", title: "Events" },
    { id: "transaction-data", slug: "transaction-data", title: "Transaction Data" },
    { id: "block-data", slug: "block-data", title: "Block Data" },
    { id: "protocol-state", slug: "protocol-state", title: "Protocol State" },
    // Also placed as 09's "External Information" (what an oracle brings on
    // chain); this placement is preferred.
    { id: "external-data", slug: "external-data", title: "External Data", preferredPlacementId: "external-data" },
    { id: "metadata", slug: "metadata", title: "Metadata" },
    { id: "off-chain-state", slug: "off-chain-state", title: "Off-Chain State" },
    { id: "data-references", slug: "data-references", title: "Data References" },
    // Also an L1 topic of 07 Storage & Availability, where it is taught; preferred there.
    {
      id: "content-addressing",
      slug: "content-addressing",
      title: "Content Addressing",
      preferredPlacementId: "content-addressing-in-storage-availability",
    },
    { id: "integrity-guarantees", slug: "integrity-guarantees", title: "Integrity Guarantees" },
    { id: "data-hashing", slug: "data-hashing", title: "Data Hashing" },
    { id: "data-commitments", slug: "data-commitments", title: "Data Commitments" },
    { id: "integrity-verification", slug: "integrity-verification", title: "Integrity Verification" },
    { id: "tamper-evidence", slug: "tamper-evidence", title: "Tamper Evidence" },
    // Also placed as 09's "Data Authenticity"; this placement is preferred.
    { id: "authenticity", slug: "authenticity", title: "Authenticity", preferredPlacementId: "authenticity" },
    { id: "data-origin", slug: "data-origin", title: "Data Origin" },
    // Also placed as 09's "Data Lineage"; this placement is preferred.
    { id: "lineage", slug: "lineage", title: "Lineage", preferredPlacementId: "lineage" },
    // Also placed as 09's "Source Attribution"; this placement is preferred.
    { id: "attribution", slug: "attribution", title: "Attribution", preferredPlacementId: "attribution" },
    { id: "provenance-records", slug: "provenance-records", title: "Provenance Records" },
    // A signed statement by an identifiable party vouching for a claim; also
    // under 08's Identity, its main home, and preferred there.
    { id: "attestations", slug: "attestations", title: "Attestations", preferredPlacementId: "attestations-in-identity" },
    { id: "traceability", slug: "traceability", title: "Traceability" },
    // Extracting chain data for indexing, not 09's Information Extraction.
    { id: "data-extraction", slug: "data-extraction", title: "Data Extraction" },
    { id: "data-transformation", slug: "data-transformation", title: "Data Transformation" },
    { id: "derived-state", slug: "derived-state", title: "Derived State" },
    { id: "index-construction", slug: "index-construction", title: "Index Construction" },
    { id: "query-models", slug: "query-models", title: "Query Models" },
    // Also placed under 05's Indexers: the same handling of reorgs in derived data.
    {
      id: "reorganization-handling",
      slug: "reorganization-handling",
      title: "Reorganization Handling",
      preferredPlacementId: "reorganization-handling",
    },
    // 04 Consensus & Ordering: L1 topics (Consensus, Finality and Censorship
    // Resistance are existing concepts).
    { id: "validators", slug: "validators", title: "Validators" },
    { id: "fork-choice", slug: "fork-choice", title: "Fork Choice" },
    { id: "mempools", slug: "mempools", title: "Mempools" },
    { id: "sequencing", slug: "sequencing", title: "Sequencing" },
    { id: "block-building", slug: "block-building", title: "Block Building" },
    { id: "proposer-builder-separation", slug: "proposer-builder-separation", title: "Proposer-Builder Separation" },
    // Also placed under 13's Commitments (a solver's pre-inclusion commitment);
    // this placement is preferred.
    { id: "preconfirmations", slug: "preconfirmations", title: "Preconfirmations", preferredPlacementId: "preconfirmations" },
    // L2 topics (placements in L2_TOPICS). Fault Assumptions (what a protocol
    // assumes about how many and which faults occur) is not Foundations' Fault
    // Models (the kinds of fault); Consensus Participants and Consensus Rules
    // are specific to consensus.
    { id: "consensus-models", slug: "consensus-models", title: "Consensus Models" },
    { id: "consensus-participants", slug: "consensus-participants", title: "Consensus Participants" },
    { id: "consensus-rules", slug: "consensus-rules", title: "Consensus Rules" },
    { id: "agreement", slug: "agreement", title: "Agreement" },
    { id: "quorums", slug: "quorums", title: "Quorums" },
    { id: "fault-assumptions", slug: "fault-assumptions", title: "Fault Assumptions" },
    { id: "validator-selection", slug: "validator-selection", title: "Validator Selection" },
    { id: "validator-sets", slug: "validator-sets", title: "Validator Sets" },
    // One role under Validators and Proposer-Builder Separation; preferred where
    // it is defined, among the validators.
    { id: "proposers", slug: "proposers", title: "Proposers", preferredPlacementId: "proposers-in-validators" },
    // Validators attesting to the chain, not 09's Real-World Attesters.
    { id: "attesters", slug: "attesters", title: "Attesters" },
    { id: "validator-duties", slug: "validator-duties", title: "Validator Duties" },
    { id: "validator-incentives", slug: "validator-incentives", title: "Validator Incentives" },
    { id: "fork-choice-rules", slug: "fork-choice-rules", title: "Fork Choice Rules" },
    { id: "chain-selection", slug: "chain-selection", title: "Chain Selection" },
    { id: "competing-forks", slug: "competing-forks", title: "Competing Forks" },
    { id: "reorganizations", slug: "reorganizations", title: "Reorganizations" },
    { id: "head-selection", slug: "head-selection", title: "Head Selection" },
    { id: "probabilistic-finality", slug: "probabilistic-finality", title: "Probabilistic Finality" },
    { id: "deterministic-finality", slug: "deterministic-finality", title: "Deterministic Finality" },
    { id: "finality-gadgets", slug: "finality-gadgets", title: "Finality Gadgets" },
    // Consensus checkpoints (the blocks justification and finalization act on),
    // not State & Data's State Checkpoints (stored state to restore from).
    { id: "checkpoints", slug: "checkpoints", title: "Checkpoints" },
    // Finalization is the process; Finality is the property it establishes.
    { id: "justification", slug: "justification", title: "Justification" },
    { id: "finalization", slug: "finalization", title: "Finalization" },
    { id: "transaction-admission", slug: "transaction-admission", title: "Transaction Admission" },
    { id: "transaction-propagation", slug: "transaction-propagation", title: "Transaction Propagation" },
    { id: "transaction-prioritization", slug: "transaction-prioritization", title: "Transaction Prioritization" },
    { id: "mempool-policies", slug: "mempool-policies", title: "Mempool Policies" },
    // Also placed under 12's Private Execution; this placement is preferred.
    { id: "private-mempools", slug: "private-mempools", title: "Private Mempools", preferredPlacementId: "private-mempools" },
    { id: "mempool-synchronization", slug: "mempool-synchronization", title: "Mempool Synchronization" },
    // A sequencer's act of fixing an order, not the order itself (Transaction Ordering).
    { id: "transaction-sequencing", slug: "transaction-sequencing", title: "Transaction Sequencing" },
    { id: "sequencing-rules", slug: "sequencing-rules", title: "Sequencing Rules" },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "centralized-sequencing",
      slug: "centralized-sequencing",
      title: "Centralized Sequencing",
      preferredPlacementId: "centralized-sequencing",
    },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "decentralized-sequencing",
      slug: "decentralized-sequencing",
      title: "Decentralized Sequencing",
      preferredPlacementId: "decentralized-sequencing",
    },
    // Also placed under 13's Cross-Domain Coordination; this placement is preferred.
    { id: "shared-sequencing", slug: "shared-sequencing", title: "Shared Sequencing", preferredPlacementId: "shared-sequencing" },
    { id: "sequencer-rotation", slug: "sequencer-rotation", title: "Sequencer Rotation" },
    // Also placed under 12's Builders; this placement is preferred.
    { id: "block-construction", slug: "block-construction", title: "Block Construction", preferredPlacementId: "block-construction" },
    // Also placed under 12's Builders; this placement is preferred.
    { id: "transaction-selection", slug: "transaction-selection", title: "Transaction Selection", preferredPlacementId: "transaction-selection" },
    { id: "block-proposals", slug: "block-proposals", title: "Block Proposals" },
    { id: "block-validation", slug: "block-validation", title: "Block Validation" },
    { id: "block-production", slug: "block-production", title: "Block Production" },
    // Block builders; also an L1 topic of 12 MEV & Execution Markets with its own
    // layer. PBS, where the role is defined, stays preferred.
    { id: "builders", slug: "builders", title: "Builders", preferredPlacementId: "builders" },
    { id: "builder-markets", slug: "builder-markets", title: "Builder Markets" },
    { id: "block-bids", slug: "block-bids", title: "Block Bids" },
    // PBS relays: trusted escrow between builders and proposers, not 05's
    // Relayers (parties forwarding transactions and messages for others).
    { id: "relays", slug: "relays", title: "Relays" },
    { id: "builder-selection", slug: "builder-selection", title: "Builder Selection" },
    { id: "execution-preconfirmations", slug: "execution-preconfirmations", title: "Execution Preconfirmations" },
    { id: "inclusion-preconfirmations", slug: "inclusion-preconfirmations", title: "Inclusion Preconfirmations" },
    { id: "preconfirmation-commitments", slug: "preconfirmation-commitments", title: "Preconfirmation Commitments" },
    { id: "preconfirmation-providers", slug: "preconfirmation-providers", title: "Preconfirmation Providers" },
    { id: "preconfirmation-guarantees", slug: "preconfirmation-guarantees", title: "Preconfirmation Guarantees" },
    { id: "transaction-inclusion", slug: "transaction-inclusion", title: "Transaction Inclusion" },
    { id: "inclusion-lists", slug: "inclusion-lists", title: "Inclusion Lists" },
    { id: "forced-inclusion", slug: "forced-inclusion", title: "Forced Inclusion" },
    { id: "censorship-detection", slug: "censorship-detection", title: "Censorship Detection" },
    { id: "censorship-recovery", slug: "censorship-recovery", title: "Censorship Recovery" },
    // Also placed under 12's MEV Mitigation; this placement is preferred.
    { id: "inclusion-guarantees", slug: "inclusion-guarantees", title: "Inclusion Guarantees", preferredPlacementId: "inclusion-guarantees" },
    // 05 Networks & Infrastructure: L1 topics. Indexers (the infrastructure) is
    // not 03's Indexing (the process).
    { id: "p2p-networks", slug: "p2p-networks", title: "P2P Networks" },
    { id: "message-propagation", slug: "message-propagation", title: "Message Propagation" },
    { id: "nodes", slug: "nodes", title: "Nodes" },
    { id: "rpc", slug: "rpc", title: "RPC" },
    { id: "indexers", slug: "indexers", title: "Indexers" },
    // Also placed under 16's Cross-Chain Messaging; this placement is preferred.
    { id: "relayers", slug: "relayers", title: "Relayers", preferredPlacementId: "relayers" },
    { id: "keepers", slug: "keepers", title: "Keepers" },
    { id: "bots", slug: "bots", title: "Bots" },
    { id: "monitoring", slug: "monitoring", title: "Monitoring" },
    { id: "automation", slug: "automation", title: "Automation" },
    // L2 topics (placements in L2_TOPICS). Gossip is the peer-to-peer mechanism;
    // Gossip Propagation is how messages spread through it. Propagation Latency
    // is specific to dissemination, not Foundations' Latency.
    { id: "peer-discovery", slug: "peer-discovery", title: "Peer Discovery" },
    { id: "peer-connections", slug: "peer-connections", title: "Peer Connections" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    {
      id: "network-topology",
      slug: "network-topology",
      title: "Network Topology",
      preferredPlacementId: "network-topology",
    },
    { id: "peer-management", slug: "peer-management", title: "Peer Management" },
    { id: "gossip", slug: "gossip", title: "Gossip" },
    { id: "network-partitions", slug: "network-partitions", title: "Network Partitions" },
    { id: "message-dissemination", slug: "message-dissemination", title: "Message Dissemination" },
    { id: "gossip-propagation", slug: "gossip-propagation", title: "Gossip Propagation" },
    { id: "propagation-latency", slug: "propagation-latency", title: "Propagation Latency" },
    { id: "message-validation", slug: "message-validation", title: "Message Validation" },
    { id: "duplicate-suppression", slug: "duplicate-suppression", title: "Duplicate Suppression" },
    { id: "flooding", slug: "flooding", title: "Flooding" },
    // Validator Nodes are the infrastructure running 04's Validators (a role).
    { id: "full-nodes", slug: "full-nodes", title: "Full Nodes" },
    { id: "light-nodes", slug: "light-nodes", title: "Light Nodes" },
    // Also placed under 07's Archival Storage; this placement is preferred.
    { id: "archive-nodes", slug: "archive-nodes", title: "Archive Nodes", preferredPlacementId: "archive-nodes" },
    { id: "validator-nodes", slug: "validator-nodes", title: "Validator Nodes" },
    { id: "bootnodes", slug: "bootnodes", title: "Bootnodes" },
    { id: "rpc-interfaces", slug: "rpc-interfaces", title: "RPC Interfaces" },
    { id: "rpc-methods", slug: "rpc-methods", title: "RPC Methods" },
    { id: "rpc-providers", slug: "rpc-providers", title: "RPC Providers" },
    { id: "rpc-endpoints", slug: "rpc-endpoints", title: "RPC Endpoints" },
    { id: "request-routing", slug: "request-routing", title: "Request Routing" },
    { id: "rate-limiting", slug: "rate-limiting", title: "Rate Limiting" },
    { id: "chain-indexers", slug: "chain-indexers", title: "Chain Indexers" },
    { id: "event-indexing", slug: "event-indexing", title: "Event Indexing" },
    { id: "state-indexing", slug: "state-indexing", title: "State Indexing" },
    { id: "indexer-pipelines", slug: "indexer-pipelines", title: "Indexer Pipelines" },
    { id: "query-services", slug: "query-services", title: "Query Services" },
    // Transaction Relaying (submitting on someone's behalf) is not 04's
    // Transaction Propagation (gossip through mempools).
    { id: "transaction-relaying", slug: "transaction-relaying", title: "Transaction Relaying" },
    { id: "message-relaying", slug: "message-relaying", title: "Message Relaying" },
    { id: "relay-networks", slug: "relay-networks", title: "Relay Networks" },
    { id: "relay-policies", slug: "relay-policies", title: "Relay Policies" },
    { id: "relay-incentives", slug: "relay-incentives", title: "Relay Incentives" },
    { id: "condition-monitoring", slug: "condition-monitoring", title: "Condition Monitoring" },
    { id: "trigger-evaluation", slug: "trigger-evaluation", title: "Trigger Evaluation" },
    // Also placed under 08's Wallets; this placement is preferred.
    {
      id: "transaction-submission",
      slug: "transaction-submission",
      title: "Transaction Submission",
      preferredPlacementId: "transaction-submission",
    },
    { id: "keeper-incentives", slug: "keeper-incentives", title: "Keeper Incentives" },
    { id: "event-driven-bots", slug: "event-driven-bots", title: "Event-Driven Bots" },
    { id: "trading-bots", slug: "trading-bots", title: "Trading Bots" },
    { id: "liquidation-bots", slug: "liquidation-bots", title: "Liquidation Bots" },
    { id: "arbitrage-bots", slug: "arbitrage-bots", title: "Arbitrage Bots" },
    { id: "governance-bots", slug: "governance-bots", title: "Governance Bots" },
    { id: "execution-bots", slug: "execution-bots", title: "Execution Bots" },
    { id: "metrics", slug: "metrics", title: "Metrics" },
    // Observability data, shown as "Logs" and "Traces" under Monitoring: not
    // 03's Logs (EVM receipt logs) or 02's Execution Traces.
    { id: "system-logs", slug: "system-logs", title: "System Logs" },
    { id: "distributed-traces", slug: "distributed-traces", title: "Distributed Traces" },
    { id: "health-checks", slug: "health-checks", title: "Health Checks" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "alerting", slug: "alerting", title: "Alerting", preferredPlacementId: "alerting" },
    { id: "observability", slug: "observability", title: "Observability" },
    { id: "triggers", slug: "triggers", title: "Triggers" },
    { id: "scheduled-execution", slug: "scheduled-execution", title: "Scheduled Execution" },
    { id: "event-driven-execution", slug: "event-driven-execution", title: "Event-Driven Execution" },
    { id: "conditional-execution", slug: "conditional-execution", title: "Conditional Execution" },
    { id: "automation-policies", slug: "automation-policies", title: "Automation Policies" },
    // Networks of nodes that watch conditions and submit transactions: one
    // concept, also placed as "Keeper Networks" under Keepers.
    { id: "automation-networks", slug: "automation-networks", title: "Automation Networks", preferredPlacementId: "automation-networks" },
    // 06 Cryptography & Proofs: L1 topics (Verifiable Computation is 02's concept).
    { id: "hash-functions", slug: "hash-functions", title: "Hash Functions" },
    { id: "digital-signatures", slug: "digital-signatures", title: "Digital Signatures" },
    // Shown as "Commitments"; the bare term also names credible commitment in
    // mechanism design and 04's preconfirmation commitments.
    { id: "cryptographic-commitments", slug: "cryptographic-commitments", title: "Cryptographic Commitments" },
    { id: "threshold-cryptography", slug: "threshold-cryptography", title: "Threshold Cryptography" },
    { id: "zero-knowledge-proofs", slug: "zero-knowledge-proofs", title: "Zero-Knowledge Proofs" },
    { id: "proof-systems", slug: "proof-systems", title: "Proof Systems" },
    { id: "privacy", slug: "privacy", title: "Privacy" },
    // L2 topics (placements in L2_TOPICS). Cryptographic Hash Functions is the
    // family with security properties, within the general Hash Functions.
    { id: "cryptographic-hash-functions", slug: "cryptographic-hash-functions", title: "Cryptographic Hash Functions" },
    { id: "hash-properties", slug: "hash-properties", title: "Hash Properties" },
    { id: "collision-resistance", slug: "collision-resistance", title: "Collision Resistance" },
    { id: "preimage-resistance", slug: "preimage-resistance", title: "Preimage Resistance" },
    { id: "domain-separation", slug: "domain-separation", title: "Domain Separation" },
    { id: "hash-based-data-structures", slug: "hash-based-data-structures", title: "Hash-Based Data Structures" },
    // Signature, Proof and Succinct Verification are specific checks, not
    // Foundations' Verification (checking a claim instead of trusting).
    { id: "key-pairs", slug: "key-pairs", title: "Key Pairs" },
    // Also placed under 08's Wallets; this placement is preferred.
    { id: "signing", slug: "signing", title: "Signing", preferredPlacementId: "signing" },
    { id: "signature-verification", slug: "signature-verification", title: "Signature Verification" },
    { id: "signature-schemes", slug: "signature-schemes", title: "Signature Schemes" },
    { id: "signature-aggregation", slug: "signature-aggregation", title: "Signature Aggregation" },
    { id: "multisignatures", slug: "multisignatures", title: "Multisignatures" },
    { id: "hiding", slug: "hiding", title: "Hiding" },
    { id: "binding", slug: "binding", title: "Binding" },
    { id: "opening", slug: "opening", title: "Opening" },
    { id: "polynomial-commitments", slug: "polynomial-commitments", title: "Polynomial Commitments" },
    { id: "vector-commitments", slug: "vector-commitments", title: "Vector Commitments" },
    // Quorum Cryptography (a quorum of key holders) is not 04's Quorums.
    { id: "secret-sharing", slug: "secret-sharing", title: "Secret Sharing" },
    { id: "threshold-signatures", slug: "threshold-signatures", title: "Threshold Signatures" },
    { id: "distributed-key-generation", slug: "distributed-key-generation", title: "Distributed Key Generation" },
    { id: "threshold-decryption", slug: "threshold-decryption", title: "Threshold Decryption" },
    { id: "multi-party-computation", slug: "multi-party-computation", title: "Multi-Party Computation" },
    { id: "quorum-cryptography", slug: "quorum-cryptography", title: "Quorum Cryptography" },
    // Zero-Knowledge is the property; Zero-Knowledge Proofs have it. Verifiers
    // are a role, not the act of Verification.
    { id: "zero-knowledge", slug: "zero-knowledge", title: "Zero-Knowledge" },
    { id: "completeness", slug: "completeness", title: "Completeness" },
    { id: "soundness", slug: "soundness", title: "Soundness" },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    { id: "provers", slug: "provers", title: "Provers", preferredPlacementId: "provers" },
    { id: "verifiers", slug: "verifiers", title: "Verifiers" },
    { id: "witnesses", slug: "witnesses", title: "Witnesses" },
    { id: "interactive-proofs", slug: "interactive-proofs", title: "Interactive Proofs" },
    { id: "non-interactive-proofs", slug: "non-interactive-proofs", title: "Non-Interactive Proofs" },
    { id: "snarks", slug: "snarks", title: "SNARKs" },
    { id: "starks", slug: "starks", title: "STARKs" },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "recursive-proofs",
      slug: "recursive-proofs",
      title: "Recursive Proofs",
      preferredPlacementId: "recursive-proofs",
    },
    { id: "proof-composition", slug: "proof-composition", title: "Proof Composition" },
    { id: "verifiable-execution", slug: "verifiable-execution", title: "Verifiable Execution" },
    // Producing and checking a proof; also placed under 07's Storage Proofs.
    { id: "proof-generation", slug: "proof-generation", title: "Proof Generation", preferredPlacementId: "proof-generation" },
    { id: "proof-verification", slug: "proof-verification", title: "Proof Verification", preferredPlacementId: "proof-verification" },
    { id: "succinct-verification", slug: "succinct-verification", title: "Succinct Verification" },
    { id: "proof-carrying-computation", slug: "proof-carrying-computation", title: "Proof-Carrying Computation" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "confidentiality",
      slug: "confidentiality",
      title: "Confidentiality",
      preferredPlacementId: "confidentiality",
    },
    { id: "anonymity", slug: "anonymity", title: "Anonymity" },
    { id: "unlinkability", slug: "unlinkability", title: "Unlinkability" },
    { id: "selective-disclosure", slug: "selective-disclosure", title: "Selective Disclosure" },
    { id: "private-computation", slug: "private-computation", title: "Private Computation" },
    { id: "privacy-preserving-protocols", slug: "privacy-preserving-protocols", title: "Privacy-Preserving Protocols" },
    // 07 Storage & Availability: L1 topics (Content Addressing is 03's concept).
    // Data Availability (published data can be downloaded) is not Foundations'
    // Availability (a system keeps serving).
    { id: "on-chain-storage", slug: "on-chain-storage", title: "On-Chain Storage" },
    { id: "distributed-storage", slug: "distributed-storage", title: "Distributed Storage" },
    { id: "archival-storage", slug: "archival-storage", title: "Archival Storage" },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "data-availability",
      slug: "data-availability",
      title: "Data Availability",
      preferredPlacementId: "data-availability",
    },
    { id: "erasure-coding", slug: "erasure-coding", title: "Erasure Coding" },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    { id: "blobs", slug: "blobs", title: "Blobs", preferredPlacementId: "blobs" },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "data-availability-sampling",
      slug: "data-availability-sampling",
      title: "Data Availability Sampling",
      preferredPlacementId: "data-availability-sampling",
    },
    { id: "storage-proofs", slug: "storage-proofs", title: "Storage Proofs" },
    // L2 topics (placements in L2_TOPICS). Storage Layout (a contract's storage
    // slots) is not 03's State Layout; State Storage (where state is persisted)
    // is not Contract State or State.
    { id: "persistent-storage", slug: "persistent-storage", title: "Persistent Storage" },
    { id: "storage-layout", slug: "storage-layout", title: "Storage Layout" },
    { id: "storage-slots", slug: "storage-slots", title: "Storage Slots" },
    { id: "storage-costs", slug: "storage-costs", title: "Storage Costs" },
    { id: "state-storage", slug: "state-storage", title: "State Storage" },
    { id: "storage-optimization", slug: "storage-optimization", title: "Storage Optimization" },
    { id: "storage-nodes", slug: "storage-nodes", title: "Storage Nodes" },
    { id: "data-replication", slug: "data-replication", title: "Data Replication" },
    { id: "data-distribution", slug: "data-distribution", title: "Data Distribution" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "redundancy", slug: "redundancy", title: "Redundancy", preferredPlacementId: "redundancy" },
    { id: "storage-networks", slug: "storage-networks", title: "Storage Networks" },
    // Content Hashing derives an address from content, not 03's Data Hashing (an
    // integrity fingerprint); Immutable References are not Data References.
    { id: "content-identifiers", slug: "content-identifiers", title: "Content Identifiers" },
    { id: "content-hashing", slug: "content-hashing", title: "Content Hashing" },
    { id: "immutable-references", slug: "immutable-references", title: "Immutable References" },
    { id: "address-resolution", slug: "address-resolution", title: "Address Resolution" },
    { id: "content-retrieval", slug: "content-retrieval", title: "Content Retrieval" },
    // State Archiving is the process; 03's Archival State is the retained data.
    { id: "historical-data", slug: "historical-data", title: "Historical Data" },
    { id: "long-term-storage", slug: "long-term-storage", title: "Long-Term Storage" },
    { id: "data-retention", slug: "data-retention", title: "Data Retention" },
    { id: "data-pruning", slug: "data-pruning", title: "Data Pruning" },
    { id: "state-archiving", slug: "state-archiving", title: "State Archiving" },
    { id: "availability-guarantees", slug: "availability-guarantees", title: "Availability Guarantees" },
    { id: "data-publication", slug: "data-publication", title: "Data Publication" },
    { id: "data-retrieval", slug: "data-retrieval", title: "Data Retrieval" },
    { id: "availability-verification", slug: "availability-verification", title: "Availability Verification" },
    { id: "data-withholding", slug: "data-withholding", title: "Data Withholding" },
    // Also placed in 15 Scaling & Modular Systems; this placement is preferred.
    {
      id: "availability-committees",
      slug: "availability-committees",
      title: "Availability Committees",
      preferredPlacementId: "availability-committees",
    },
    { id: "data-shards", slug: "data-shards", title: "Data Shards" },
    { id: "redundant-encoding", slug: "redundant-encoding", title: "Redundant Encoding" },
    // Recovering data from coded shards, shown as "Reconstruction"; not 03's
    // State Reconstruction (rebuilding state from history).
    { id: "data-reconstruction", slug: "data-reconstruction", title: "Data Reconstruction" },
    { id: "coding-parameters", slug: "coding-parameters", title: "Coding Parameters" },
    { id: "fault-recovery", slug: "fault-recovery", title: "Fault Recovery" },
    { id: "blob-data", slug: "blob-data", title: "Blob Data" },
    { id: "blob-transactions", slug: "blob-transactions", title: "Blob Transactions" },
    { id: "blob-commitments", slug: "blob-commitments", title: "Blob Commitments" },
    { id: "blob-propagation", slug: "blob-propagation", title: "Blob Propagation" },
    { id: "blob-retention", slug: "blob-retention", title: "Blob Retention" },
    { id: "blob-pricing", slug: "blob-pricing", title: "Blob Pricing" },
    { id: "sampling", slug: "sampling", title: "Sampling" },
    { id: "random-sampling", slug: "random-sampling", title: "Random Sampling" },
    { id: "sample-verification", slug: "sample-verification", title: "Sample Verification" },
    { id: "availability-confidence", slug: "availability-confidence", title: "Availability Confidence" },
    { id: "light-client-sampling", slug: "light-client-sampling", title: "Light-Client Sampling" },
    { id: "proof-of-storage", slug: "proof-of-storage", title: "Proof of Storage" },
    { id: "proof-of-replication", slug: "proof-of-replication", title: "Proof of Replication" },
    { id: "proof-of-space", slug: "proof-of-space", title: "Proof of Space" },
    { id: "proof-of-retrievability", slug: "proof-of-retrievability", title: "Proof of Retrievability" },
    // 08 Identity, Accounts & Authority: L1 topics (Identity and Authority are
    // the fixture's concepts, below).
    { id: "accounts", slug: "accounts", title: "Accounts" },
    { id: "wallets", slug: "wallets", title: "Wallets" },
    { id: "smart-accounts", slug: "smart-accounts", title: "Smart Accounts" },
    // Also placed under 16's Chain Abstraction; this placement is preferred.
    {
      id: "account-abstraction",
      slug: "account-abstraction",
      title: "Account Abstraction",
      preferredPlacementId: "account-abstraction",
    },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "authentication", slug: "authentication", title: "Authentication", preferredPlacementId: "authentication" },
    { id: "machine-identity", slug: "machine-identity", title: "Machine Identity" },
    // L2 topics (placements in L2_TOPICS). Credentials, Reputation, Ownership,
    // Delegation, Roles and Capabilities are general concepts, for reuse by later
    // domains.
    { id: "addresses", slug: "addresses", title: "Addresses" },
    { id: "decentralized-identifiers", slug: "decentralized-identifiers", title: "Decentralized Identifiers" },
    // Also placed under 09's Real-World Attestations; this placement is preferred.
    { id: "credentials", slug: "credentials", title: "Credentials", preferredPlacementId: "credentials" },
    { id: "reputation", slug: "reputation", title: "Reputation" },
    // Account State (an account's balance, nonce, code and storage root) is not
    // Contract State. Account, Wallet and Recovery Logic recovery differ:
    // regaining an account, restoring key material, the code implementing it.
    { id: "externally-owned-accounts", slug: "externally-owned-accounts", title: "Externally Owned Accounts" },
    { id: "contract-accounts", slug: "contract-accounts", title: "Contract Accounts" },
    { id: "account-state", slug: "account-state", title: "Account State" },
    { id: "account-nonces", slug: "account-nonces", title: "Account Nonces" },
    { id: "account-permissions", slug: "account-permissions", title: "Account Permissions" },
    { id: "account-recovery", slug: "account-recovery", title: "Account Recovery" },
    { id: "key-management", slug: "key-management", title: "Key Management" },
    { id: "transaction-construction", slug: "transaction-construction", title: "Transaction Construction" },
    { id: "wallet-recovery", slug: "wallet-recovery", title: "Wallet Recovery" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "wallet-security",
      slug: "wallet-security",
      title: "Wallet Security",
      preferredPlacementId: "wallet-security",
    },
    // Programmable Accounts is the property; Smart Accounts are the account type.
    { id: "programmable-accounts", slug: "programmable-accounts", title: "Programmable Accounts" },
    { id: "validation-logic", slug: "validation-logic", title: "Validation Logic" },
    { id: "execution-logic", slug: "execution-logic", title: "Execution Logic" },
    { id: "recovery-logic", slug: "recovery-logic", title: "Recovery Logic" },
    { id: "session-keys", slug: "session-keys", title: "Session Keys" },
    { id: "modular-accounts", slug: "modular-accounts", title: "Modular Accounts" },
    { id: "user-operations", slug: "user-operations", title: "User Operations" },
    { id: "bundlers", slug: "bundlers", title: "Bundlers" },
    { id: "entry-points", slug: "entry-points", title: "Entry Points" },
    { id: "paymasters", slug: "paymasters", title: "Paymasters" },
    { id: "alternative-mempools", slug: "alternative-mempools", title: "Alternative Mempools" },
    // Also placed under 16's Abstraction Layers; this placement is preferred.
    {
      id: "gas-abstraction",
      slug: "gas-abstraction",
      title: "Gas Abstraction",
      preferredPlacementId: "gas-abstraction",
    },
    // Signature Authentication proves control of a key; it is not 06's
    // Signature Verification.
    { id: "authentication-factors", slug: "authentication-factors", title: "Authentication Factors" },
    { id: "signature-authentication", slug: "signature-authentication", title: "Signature Authentication" },
    { id: "challenge-response", slug: "challenge-response", title: "Challenge-Response" },
    { id: "session-authentication", slug: "session-authentication", title: "Session Authentication" },
    { id: "credential-authentication", slug: "credential-authentication", title: "Credential Authentication" },
    { id: "authentication-policies", slug: "authentication-policies", title: "Authentication Policies" },
    { id: "ownership", slug: "ownership", title: "Ownership" },
    { id: "roles", slug: "roles", title: "Roles" },
    { id: "capabilities", slug: "capabilities", title: "Capabilities" },
    // Also placed under 13's Intents (an intent delegates execution), 14's
    // Representation (delegating votes) and 20's AI Agents (an agent acting on
    // its principal's authority); this placement is preferred.
    { id: "delegation", slug: "delegation", title: "Delegation", preferredPlacementId: "delegation" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "permission-models",
      slug: "permission-models",
      title: "Permission Models",
      preferredPlacementId: "permission-models",
    },
    { id: "authority-boundaries", slug: "authority-boundaries", title: "Authority Boundaries" },
    // Agent and machine subjects are taught as their own topics, like the
    // fixture's Agent Identity; merging them into the general concepts would put
    // two rows of one concept side by side under Machine Identity.
    { id: "agent-credentials", slug: "agent-credentials", title: "Agent Credentials" },
    { id: "agent-reputation", slug: "agent-reputation", title: "Agent Reputation" },
    { id: "agent-authorization", slug: "agent-authorization", title: "Agent Authorization" },
    { id: "machine-credentials", slug: "machine-credentials", title: "Machine Credentials" },
    { id: "machine-authentication", slug: "machine-authentication", title: "Machine Authentication" },
    // 09 Oracles & External Reality: L1 topics (Provenance is 03's concept).
    { id: "oracle-problem", slug: "oracle-problem", title: "Oracle Problem" },
    { id: "data-sources", slug: "data-sources", title: "Data Sources" },
    { id: "oracle-networks", slug: "oracle-networks", title: "Oracle Networks" },
    { id: "push-pull-oracles", slug: "push-pull-oracles", title: "Push / Pull Oracles" },
    // Shown as "Aggregation"; the bare term also names signature and liquidity
    // aggregation.
    { id: "oracle-aggregation", slug: "oracle-aggregation", title: "Oracle Aggregation" },
    // Real-World Attestations are attestations about the physical world, taught
    // with their own layer; the general Attestations concept is 03's.
    { id: "freshness", slug: "freshness", title: "Freshness" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "oracle-security",
      slug: "oracle-security",
      title: "Oracle Security",
      preferredPlacementId: "oracle-security",
    },
    { id: "machine-readable-reality", slug: "machine-readable-reality", title: "Machine-Readable Reality" },
    { id: "sensors-external-systems", slug: "sensors-external-systems", title: "Sensors & External Systems" },
    { id: "ai-interpreted-data", slug: "ai-interpreted-data", title: "AI-Interpreted Data" },
    { id: "real-world-attestations", slug: "real-world-attestations", title: "Real-World Attestations" },
    // L2 topics (placements in L2_TOPICS).
    { id: "verification-limits", slug: "verification-limits", title: "Verification Limits" },
    // Whether an external source's data is there when needed, shown as "Data
    // Availability"; not 07's Data Availability (published block data).
    { id: "external-data-availability", slug: "external-data-availability", title: "External Data Availability" },
    { id: "oracle-failure", slug: "oracle-failure", title: "Oracle Failure" },
    { id: "primary-sources", slug: "primary-sources", title: "Primary Sources" },
    { id: "secondary-sources", slug: "secondary-sources", title: "Secondary Sources" },
    // Off-chain systems' interfaces: shown as "APIs" under Data Sources, and
    // preferred under Sensors & External Systems.
    { id: "external-apis", slug: "external-apis", title: "External APIs", preferredPlacementId: "external-apis" },
    // Node Selection (choosing oracle nodes) is not 04's Validator Selection.
    { id: "market-data", slug: "market-data", title: "Market Data" },
    { id: "sensor-data", slug: "sensor-data", title: "Sensor Data" },
    { id: "source-diversity", slug: "source-diversity", title: "Source Diversity" },
    { id: "oracle-nodes", slug: "oracle-nodes", title: "Oracle Nodes" },
    { id: "node-selection", slug: "node-selection", title: "Node Selection" },
    { id: "data-collection", slug: "data-collection", title: "Data Collection" },
    { id: "data-reporting", slug: "data-reporting", title: "Data Reporting" },
    { id: "oracle-incentives", slug: "oracle-incentives", title: "Oracle Incentives" },
    { id: "push-oracles", slug: "push-oracles", title: "Push Oracles" },
    { id: "pull-oracles", slug: "pull-oracles", title: "Pull Oracles" },
    { id: "update-models", slug: "update-models", title: "Update Models" },
    { id: "request-response", slug: "request-response", title: "Request-Response" },
    { id: "on-demand-updates", slug: "on-demand-updates", title: "On-Demand Updates" },
    { id: "data-aggregation", slug: "data-aggregation", title: "Data Aggregation" },
    { id: "medianization", slug: "medianization", title: "Medianization" },
    { id: "weighted-aggregation", slug: "weighted-aggregation", title: "Weighted Aggregation" },
    { id: "outlier-filtering", slug: "outlier-filtering", title: "Outlier Filtering" },
    { id: "quorum-aggregation", slug: "quorum-aggregation", title: "Quorum Aggregation" },
    { id: "aggregation-rules", slug: "aggregation-rules", title: "Aggregation Rules" },
    // Heartbeats are scheduled oracle updates, not 05's Health Checks.
    { id: "update-frequency", slug: "update-frequency", title: "Update Frequency" },
    { id: "staleness", slug: "staleness", title: "Staleness" },
    { id: "timestamps", slug: "timestamps", title: "Timestamps" },
    { id: "freshness-thresholds", slug: "freshness-thresholds", title: "Freshness Thresholds" },
    { id: "heartbeats", slug: "heartbeats", title: "Heartbeats" },
    { id: "deviation-thresholds", slug: "deviation-thresholds", title: "Deviation Thresholds" },
    // Source Provenance (the origin record of a source's data) is not 03's Data
    // Origin; Transformation History is one part of Lineage.
    { id: "source-provenance", slug: "source-provenance", title: "Source Provenance" },
    { id: "transformation-history", slug: "transformation-history", title: "Transformation History" },
    { id: "provenance-verification", slug: "provenance-verification", title: "Provenance Verification" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "oracle-manipulation",
      slug: "oracle-manipulation",
      title: "Oracle Manipulation",
      preferredPlacementId: "oracle-manipulation",
    },
    { id: "data-poisoning", slug: "data-poisoning", title: "Data Poisoning" },
    { id: "source-compromise", slug: "source-compromise", title: "Source Compromise" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "sybil-attacks", slug: "sybil-attacks", title: "Sybil Attacks", preferredPlacementId: "sybil-attacks" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "economic-attacks",
      slug: "economic-attacks",
      title: "Economic Attacks",
      preferredPlacementId: "economic-attacks",
    },
    // Claims, Machine-Readable Claims and Verifiable Claims are distinct: a
    // statement about a subject, in machine-readable form, and cryptographically
    // checkable.
    { id: "structured-data", slug: "structured-data", title: "Structured Data" },
    { id: "semantic-data", slug: "semantic-data", title: "Semantic Data" },
    { id: "machine-readable-claims", slug: "machine-readable-claims", title: "Machine-Readable Claims" },
    { id: "verifiable-claims", slug: "verifiable-claims", title: "Verifiable Claims" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    { id: "data-schemas", slug: "data-schemas", title: "Data Schemas", preferredPlacementId: "data-schemas" },
    { id: "reality-interfaces", slug: "reality-interfaces", title: "Reality Interfaces" },
    // Trusted Hardware (a hardware root of trust) is not 02's Trusted Execution.
    { id: "sensors", slug: "sensors", title: "Sensors" },
    { id: "iot-devices", slug: "iot-devices", title: "IoT Devices" },
    { id: "trusted-hardware", slug: "trusted-hardware", title: "Trusted Hardware" },
    { id: "physical-events", slug: "physical-events", title: "Physical Events" },
    { id: "cyber-physical-interfaces", slug: "cyber-physical-interfaces", title: "Cyber-Physical Interfaces" },
    { id: "unstructured-data", slug: "unstructured-data", title: "Unstructured Data" },
    // Pulling facts from unstructured data, shown as "Data Extraction"; not 03's
    // Data Extraction (indexing). Inference Confidence is a model's, shown as
    // "Confidence"; not 07's statistical Availability Confidence.
    { id: "information-extraction", slug: "information-extraction", title: "Information Extraction" },
    { id: "classification", slug: "classification", title: "Classification" },
    // AI Inference and Inference Confidence are consumed here to interpret
    // external reality; 20 AI & Intelligent Systems, their conceptual home,
    // places them again and is preferred.
    {
      id: "ai-inference",
      slug: "ai-inference",
      title: "AI Inference",
      preferredPlacementId: "ai-inference-in-ai-intelligent-systems",
    },
    {
      id: "inference-confidence",
      slug: "inference-confidence",
      title: "Inference Confidence",
      preferredPlacementId: "inference-confidence-in-uncertainty-reliability",
    },
    { id: "interpretation-verification", slug: "interpretation-verification", title: "Interpretation Verification" },
    // Parties attesting to real-world facts, shown as "Attesters"; not 04's
    // Attesters (validators).
    { id: "real-world-attesters", slug: "real-world-attesters", title: "Real-World Attesters" },
    { id: "claims", slug: "claims", title: "Claims" },
    // Also placed under 14's Dispute Resolution; this placement is preferred.
    { id: "evidence", slug: "evidence", title: "Evidence", preferredPlacementId: "evidence" },
    { id: "attestation-verification", slug: "attestation-verification", title: "Attestation Verification" },
    { id: "revocation", slug: "revocation", title: "Revocation" },
    // 10 Economics & Mechanism Design: L1 topics (Strategic Behavior is
    // Foundations' concept). Incentives, Mechanism Design, Game Theory, Fees and
    // Auctions are general concepts for reuse by later domains; Cryptoeconomic
    // Security (the approach) is not its L2 Economic Security (the measure).
    { id: "incentives", slug: "incentives", title: "Incentives" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    {
      id: "mechanism-design",
      slug: "mechanism-design",
      title: "Mechanism Design",
      preferredPlacementId: "mechanism-design",
    },
    { id: "game-theory", slug: "game-theory", title: "Game Theory" },
    { id: "token-economics", slug: "token-economics", title: "Token Economics" },
    { id: "fees", slug: "fees", title: "Fees" },
    { id: "auctions", slug: "auctions", title: "Auctions" },
    { id: "resource-allocation", slug: "resource-allocation", title: "Resource Allocation" },
    { id: "staking-economics", slug: "staking-economics", title: "Staking Economics" },
    { id: "security-budgets", slug: "security-budgets", title: "Security Budgets" },
    { id: "cryptoeconomic-security", slug: "cryptoeconomic-security", title: "Cryptoeconomic Security" },
    // L2 topics (placements in L2_TOPICS). Negative Incentives are any
    // discouragement; Penalties are explicit punishment, also placed as
    // "Economic Penalties" under Cryptoeconomic Security.
    // Also placed under 14's Institutional Design; this placement is preferred.
    { id: "incentive-alignment", slug: "incentive-alignment", title: "Incentive Alignment", preferredPlacementId: "incentive-alignment" },
    { id: "positive-incentives", slug: "positive-incentives", title: "Positive Incentives" },
    { id: "negative-incentives", slug: "negative-incentives", title: "Negative Incentives" },
    { id: "rewards", slug: "rewards", title: "Rewards" },
    { id: "penalties", slug: "penalties", title: "Penalties", preferredPlacementId: "penalties" },
    { id: "incentive-compatibility", slug: "incentive-compatibility", title: "Incentive Compatibility" },
    { id: "mechanisms", slug: "mechanisms", title: "Mechanisms" },
    // A mechanism's objectives and constraints, shown as "Objectives" and
    // "Constraints"; the bare terms name other things elsewhere (an agent's
    // objectives, resource constraints).
    { id: "mechanism-objectives", slug: "mechanism-objectives", title: "Mechanism Objectives" },
    { id: "mechanism-constraints", slug: "mechanism-constraints", title: "Mechanism Constraints" },
    // Mechanism Properties are not Foundations' Protocol Properties; Players (a
    // game's agents) are not Foundations' Participants.
    { id: "allocation-rules", slug: "allocation-rules", title: "Allocation Rules" },
    { id: "payment-rules", slug: "payment-rules", title: "Payment Rules" },
    { id: "mechanism-properties", slug: "mechanism-properties", title: "Mechanism Properties" },
    { id: "players", slug: "players", title: "Players" },
    { id: "strategies", slug: "strategies", title: "Strategies" },
    { id: "payoffs", slug: "payoffs", title: "Payoffs" },
    { id: "best-responses", slug: "best-responses", title: "Best Responses" },
    { id: "dominant-strategies", slug: "dominant-strategies", title: "Dominant Strategies" },
    { id: "nash-equilibrium", slug: "nash-equilibrium", title: "Nash Equilibrium" },
    // Manipulation in general, not 09's Oracle Manipulation.
    { id: "rational-behavior", slug: "rational-behavior", title: "Rational Behavior" },
    { id: "deviations", slug: "deviations", title: "Deviations" },
    { id: "manipulation", slug: "manipulation", title: "Manipulation" },
    { id: "free-riding", slug: "free-riding", title: "Free Riding" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "griefing", slug: "griefing", title: "Griefing", preferredPlacementId: "griefing" },
    { id: "bribery", slug: "bribery", title: "Bribery" },
    { id: "token-supply", slug: "token-supply", title: "Token Supply" },
    { id: "token-distribution", slug: "token-distribution", title: "Token Distribution" },
    { id: "issuance", slug: "issuance", title: "Issuance" },
    { id: "emissions", slug: "emissions", title: "Emissions" },
    { id: "burns", slug: "burns", title: "Burns" },
    { id: "token-utility", slug: "token-utility", title: "Token Utility" },
    // Transaction Fees and Fee Calculation are what a user pays and its
    // formula, not 02's Execution Cost and Fee Accounting (charging during
    // execution). Priority Fees are not 04's Transaction Prioritization.
    { id: "transaction-fees", slug: "transaction-fees", title: "Transaction Fees" },
    { id: "fee-markets", slug: "fee-markets", title: "Fee Markets" },
    { id: "fee-calculation", slug: "fee-calculation", title: "Fee Calculation" },
    { id: "fee-allocation", slug: "fee-allocation", title: "Fee Allocation" },
    { id: "priority-fees", slug: "priority-fees", title: "Priority Fees" },
    { id: "congestion-pricing", slug: "congestion-pricing", title: "Congestion Pricing" },
    // Bids in general, not 04's Block Bids.
    // An offer to buy or pay at a stated price; also placed under 11's Order
    // Books. This placement is preferred.
    { id: "bids", slug: "bids", title: "Bids", preferredPlacementId: "bids" },
    { id: "first-price-auctions", slug: "first-price-auctions", title: "First-Price Auctions" },
    { id: "second-price-auctions", slug: "second-price-auctions", title: "Second-Price Auctions" },
    { id: "sealed-bid-auctions", slug: "sealed-bid-auctions", title: "Sealed-Bid Auctions" },
    // Also placed under 13's Solver Competition; this placement is preferred.
    { id: "batch-auctions", slug: "batch-auctions", title: "Batch Auctions", preferredPlacementId: "batch-auctions" },
    // Also placed under 12's MEV Auctions; this placement is preferred.
    { id: "auction-clearing", slug: "auction-clearing", title: "Auction Clearing", preferredPlacementId: "auction-clearing" },
    { id: "scarce-resources", slug: "scarce-resources", title: "Scarce Resources" },
    { id: "resource-pricing", slug: "resource-pricing", title: "Resource Pricing" },
    { id: "capacity-allocation", slug: "capacity-allocation", title: "Capacity Allocation" },
    { id: "allocation-efficiency", slug: "allocation-efficiency", title: "Allocation Efficiency" },
    { id: "congestion", slug: "congestion", title: "Congestion" },
    { id: "rationing", slug: "rationing", title: "Rationing" },
    // Validator Economics (a validator's revenues and costs) is not 04's
    // Validator Incentives; Delegated Stake is not 08's Delegation (of authority).
    { id: "stake", slug: "stake", title: "Stake" },
    { id: "staking-rewards", slug: "staking-rewards", title: "Staking Rewards" },
    { id: "slashing", slug: "slashing", title: "Slashing" },
    { id: "validator-economics", slug: "validator-economics", title: "Validator Economics" },
    { id: "delegated-stake", slug: "delegated-stake", title: "Delegated Stake" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "economic-security",
      slug: "economic-security",
      title: "Economic Security",
      preferredPlacementId: "economic-security",
    },
    { id: "security-expenditure", slug: "security-expenditure", title: "Security Expenditure" },
    { id: "issuance-funded-security", slug: "issuance-funded-security", title: "Issuance-Funded Security" },
    { id: "fee-funded-security", slug: "fee-funded-security", title: "Fee-Funded Security" },
    { id: "security-subsidies", slug: "security-subsidies", title: "Security Subsidies" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "attack-cost", slug: "attack-cost", title: "Attack Cost", preferredPlacementId: "attack-cost" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "cost-of-corruption",
      slug: "cost-of-corruption",
      title: "Cost of Corruption",
      preferredPlacementId: "cost-of-corruption",
    },
    // Economic Finality (reversal made costly) is a kind of finality, like 04's
    // Probabilistic and Deterministic Finality. Incentive Attacks are not 09's
    // Economic Attacks; Cryptoeconomic Assumptions are not Fault or Trust Assumptions.
    { id: "economic-guarantees", slug: "economic-guarantees", title: "Economic Guarantees" },
    { id: "economic-finality", slug: "economic-finality", title: "Economic Finality" },
    { id: "incentive-attacks", slug: "incentive-attacks", title: "Incentive Attacks" },
    { id: "stake-based-security", slug: "stake-based-security", title: "Stake-Based Security" },
    { id: "cryptoeconomic-assumptions", slug: "cryptoeconomic-assumptions", title: "Cryptoeconomic Assumptions" },
    // 11 Markets & Financial Protocols: L1 topics. Assets, Markets, Liquidity,
    // Collateral, Risk and Solvency are general concepts for reuse by later domains.
    { id: "assets", slug: "assets", title: "Assets" },
    { id: "markets", slug: "markets", title: "Markets" },
    { id: "liquidity", slug: "liquidity", title: "Liquidity" },
    { id: "automated-market-makers", slug: "automated-market-makers", title: "Automated Market Makers" },
    { id: "order-books", slug: "order-books", title: "Order Books" },
    { id: "lending-borrowing", slug: "lending-borrowing", title: "Lending & Borrowing" },
    { id: "collateral", slug: "collateral", title: "Collateral" },
    { id: "liquidations", slug: "liquidations", title: "Liquidations" },
    { id: "stablecoins", slug: "stablecoins", title: "Stablecoins" },
    { id: "derivatives", slug: "derivatives", title: "Derivatives" },
    { id: "risk", slug: "risk", title: "Risk" },
    { id: "solvency", slug: "solvency", title: "Solvency" },
    // L2 topics (placements in L2_TOPICS). Asset Properties are not Protocol or
    // Mechanism Properties.
    { id: "fungible-assets", slug: "fungible-assets", title: "Fungible Assets" },
    { id: "non-fungible-assets", slug: "non-fungible-assets", title: "Non-Fungible Assets" },
    { id: "native-assets", slug: "native-assets", title: "Native Assets" },
    { id: "tokenized-assets", slug: "tokenized-assets", title: "Tokenized Assets" },
    { id: "synthetic-assets", slug: "synthetic-assets", title: "Synthetic Assets" },
    { id: "asset-properties", slug: "asset-properties", title: "Asset Properties" },
    // Market Participants are not Foundations' Participants; Market Prices are
    // not 09's Market Data; Market and Capital Efficiency are not 10's
    // Allocation Efficiency.
    { id: "market-participants", slug: "market-participants", title: "Market Participants" },
    { id: "buyers", slug: "buyers", title: "Buyers" },
    { id: "sellers", slug: "sellers", title: "Sellers" },
    { id: "market-prices", slug: "market-prices", title: "Market Prices" },
    { id: "market-efficiency", slug: "market-efficiency", title: "Market Efficiency" },
    { id: "market-structure", slug: "market-structure", title: "Market Structure" },
    { id: "liquidity-providers", slug: "liquidity-providers", title: "Liquidity Providers" },
    { id: "liquidity-provision", slug: "liquidity-provision", title: "Liquidity Provision" },
    { id: "liquidity-depth", slug: "liquidity-depth", title: "Liquidity Depth" },
    { id: "liquidity-fragmentation", slug: "liquidity-fragmentation", title: "Liquidity Fragmentation" },
    { id: "capital-efficiency", slug: "capital-efficiency", title: "Capital Efficiency" },
    // One concept under Liquidity and Risk; preferred under Risk, as a kind of risk.
    { id: "liquidity-risk", slug: "liquidity-risk", title: "Liquidity Risk", preferredPlacementId: "liquidity-risk-in-risk" },
    // Pool Reserves (a pool's token balances) are not Solvency's Reserves (assets
    // backing liabilities).
    { id: "liquidity-pools", slug: "liquidity-pools", title: "Liquidity Pools" },
    { id: "constant-product", slug: "constant-product", title: "Constant Product" },
    { id: "invariant-functions", slug: "invariant-functions", title: "Invariant Functions" },
    { id: "pool-reserves", slug: "pool-reserves", title: "Pool Reserves" },
    { id: "lp-tokens", slug: "lp-tokens", title: "LP Tokens" },
    { id: "impermanent-loss", slug: "impermanent-loss", title: "Impermanent Loss" },
    // Order Matching is not 04's Transaction Ordering.
    { id: "orders", slug: "orders", title: "Orders" },
    { id: "limit-orders", slug: "limit-orders", title: "Limit Orders" },
    { id: "market-orders", slug: "market-orders", title: "Market Orders" },
    { id: "asks", slug: "asks", title: "Asks" },
    { id: "order-matching", slug: "order-matching", title: "Order Matching" },
    { id: "lending-markets", slug: "lending-markets", title: "Lending Markets" },
    { id: "borrowers", slug: "borrowers", title: "Borrowers" },
    { id: "lenders", slug: "lenders", title: "Lenders" },
    { id: "interest-rates", slug: "interest-rates", title: "Interest Rates" },
    { id: "utilization", slug: "utilization", title: "Utilization" },
    { id: "repayment", slug: "repayment", title: "Repayment" },
    { id: "collateralization", slug: "collateralization", title: "Collateralization" },
    { id: "collateral-ratios", slug: "collateral-ratios", title: "Collateral Ratios" },
    { id: "overcollateralization", slug: "overcollateralization", title: "Overcollateralization" },
    { id: "undercollateralization", slug: "undercollateralization", title: "Undercollateralization" },
    { id: "collateral-valuation", slug: "collateral-valuation", title: "Collateral Valuation" },
    { id: "collateral-risk", slug: "collateral-risk", title: "Collateral Risk" },
    // Liquidation mechanisms are taught as their own concepts, not collapsed into
    // 10's Incentives, Penalties and Auctions; Liquidators (a role) are not 05's
    // Liquidation Bots.
    { id: "liquidation-thresholds", slug: "liquidation-thresholds", title: "Liquidation Thresholds" },
    { id: "liquidators", slug: "liquidators", title: "Liquidators" },
    { id: "liquidation-incentives", slug: "liquidation-incentives", title: "Liquidation Incentives" },
    { id: "liquidation-penalties", slug: "liquidation-penalties", title: "Liquidation Penalties" },
    { id: "liquidation-auctions", slug: "liquidation-auctions", title: "Liquidation Auctions" },
    { id: "bad-debt", slug: "bad-debt", title: "Bad Debt" },
    { id: "fiat-backed-stablecoins", slug: "fiat-backed-stablecoins", title: "Fiat-Backed Stablecoins" },
    { id: "crypto-backed-stablecoins", slug: "crypto-backed-stablecoins", title: "Crypto-Backed Stablecoins" },
    { id: "algorithmic-stablecoins", slug: "algorithmic-stablecoins", title: "Algorithmic Stablecoins" },
    { id: "pegs", slug: "pegs", title: "Pegs" },
    { id: "peg-stability", slug: "peg-stability", title: "Peg Stability" },
    { id: "depegging", slug: "depegging", title: "Depegging" },
    { id: "futures", slug: "futures", title: "Futures" },
    { id: "options", slug: "options", title: "Options" },
    { id: "perpetuals", slug: "perpetuals", title: "Perpetuals" },
    { id: "derivative-pricing", slug: "derivative-pricing", title: "Derivative Pricing" },
    { id: "margin", slug: "margin", title: "Margin" },
    { id: "market-risk", slug: "market-risk", title: "Market Risk" },
    { id: "credit-risk", slug: "credit-risk", title: "Credit Risk" },
    { id: "counterparty-risk", slug: "counterparty-risk", title: "Counterparty Risk" },
    { id: "systemic-risk", slug: "systemic-risk", title: "Systemic Risk" },
    { id: "risk-parameters", slug: "risk-parameters", title: "Risk Parameters" },
    // Assets and Liabilities is the balance-sheet view, not Assets; Solvency
    // Constraints are not 10's Mechanism Constraints.
    { id: "assets-and-liabilities", slug: "assets-and-liabilities", title: "Assets and Liabilities" },
    { id: "reserves", slug: "reserves", title: "Reserves" },
    { id: "capitalization", slug: "capitalization", title: "Capitalization" },
    { id: "insolvency", slug: "insolvency", title: "Insolvency" },
    { id: "solvency-constraints", slug: "solvency-constraints", title: "Solvency Constraints" },
    { id: "loss-absorption", slug: "loss-absorption", title: "Loss Absorption" },
    // 12 MEV & Execution Markets: L1 topics (Transaction Ordering and Builders are
    // existing concepts). Liquidation MEV (value from liquidations) is not 11's
    // Liquidations (the mechanism); MEV Auctions are not 10's general Auctions;
    // Private Execution is not 02's Trusted or Off-Chain Execution. Arbitrage is
    // not 05's Arbitrage Bots.
    { id: "mev", slug: "mev", title: "MEV" },
    { id: "searchers", slug: "searchers", title: "Searchers" },
    { id: "arbitrage", slug: "arbitrage", title: "Arbitrage" },
    { id: "liquidation-mev", slug: "liquidation-mev", title: "Liquidation MEV" },
    { id: "sandwiching", slug: "sandwiching", title: "Sandwiching" },
    { id: "bundles", slug: "bundles", title: "Bundles" },
    { id: "blockspace-markets", slug: "blockspace-markets", title: "Blockspace Markets" },
    { id: "order-flow", slug: "order-flow", title: "Order Flow" },
    { id: "mev-auctions", slug: "mev-auctions", title: "MEV Auctions" },
    { id: "private-execution", slug: "private-execution", title: "Private Execution" },
    { id: "mev-mitigation", slug: "mev-mitigation", title: "MEV Mitigation" },
    // L2 topics (placements in L2_TOPICS). Transaction Simulation predicts one
    // transaction's outcome; Bundle Simulation checks an ordered, atomic set.
    { id: "mev-sources", slug: "mev-sources", title: "MEV Sources" },
    { id: "mev-opportunities", slug: "mev-opportunities", title: "MEV Opportunities" },
    { id: "mev-extraction", slug: "mev-extraction", title: "MEV Extraction" },
    { id: "mev-supply-chain", slug: "mev-supply-chain", title: "MEV Supply Chain" },
    { id: "toxic-mev", slug: "toxic-mev", title: "Toxic MEV" },
    { id: "non-toxic-mev", slug: "non-toxic-mev", title: "Non-Toxic MEV" },
    { id: "search-strategies", slug: "search-strategies", title: "Search Strategies" },
    { id: "opportunity-detection", slug: "opportunity-detection", title: "Opportunity Detection" },
    { id: "transaction-simulation", slug: "transaction-simulation", title: "Transaction Simulation" },
    { id: "bundle-construction", slug: "bundle-construction", title: "Bundle Construction" },
    { id: "searcher-infrastructure", slug: "searcher-infrastructure", title: "Searcher Infrastructure" },
    { id: "searcher-competition", slug: "searcher-competition", title: "Searcher Competition" },
    // Atomic Arbitrage is not 02's Transaction Atomicity.
    { id: "dex-arbitrage", slug: "dex-arbitrage", title: "DEX Arbitrage" },
    { id: "cross-market-arbitrage", slug: "cross-market-arbitrage", title: "Cross-Market Arbitrage" },
    { id: "triangular-arbitrage", slug: "triangular-arbitrage", title: "Triangular Arbitrage" },
    { id: "atomic-arbitrage", slug: "atomic-arbitrage", title: "Atomic Arbitrage" },
    { id: "arbitrage-paths", slug: "arbitrage-paths", title: "Arbitrage Paths" },
    { id: "arbitrage-profit", slug: "arbitrage-profit", title: "Arbitrage Profit" },
    // Liquidation Searchers compete for liquidation MEV; 11's Liquidators perform
    // liquidations. Liquidation Risk is not 11's Liquidity Risk.
    { id: "liquidation-opportunities", slug: "liquidation-opportunities", title: "Liquidation Opportunities" },
    { id: "liquidation-searchers", slug: "liquidation-searchers", title: "Liquidation Searchers" },
    { id: "liquidation-transactions", slug: "liquidation-transactions", title: "Liquidation Transactions" },
    { id: "liquidation-competition", slug: "liquidation-competition", title: "Liquidation Competition" },
    { id: "liquidation-profit", slug: "liquidation-profit", title: "Liquidation Profit" },
    { id: "liquidation-risk", slug: "liquidation-risk", title: "Liquidation Risk" },
    { id: "sandwich-attacks", slug: "sandwich-attacks", title: "Sandwich Attacks" },
    { id: "front-running", slug: "front-running", title: "Front-Running" },
    { id: "back-running", slug: "back-running", title: "Back-Running" },
    { id: "victim-transactions", slug: "victim-transactions", title: "Victim Transactions" },
    { id: "price-impact", slug: "price-impact", title: "Price Impact" },
    { id: "slippage-exploitation", slug: "slippage-exploitation", title: "Slippage Exploitation" },
    // Ordering Policies (any orderer's policy) are not 04's Sequencing Rules (a
    // sequencer's rules); Ordering Manipulation is not 10's general Manipulation.
    { id: "ordering-rights", slug: "ordering-rights", title: "Ordering Rights" },
    { id: "ordering-policies", slug: "ordering-policies", title: "Ordering Policies" },
    { id: "priority-ordering", slug: "priority-ordering", title: "Priority Ordering" },
    { id: "time-ordering", slug: "time-ordering", title: "Time Ordering" },
    { id: "fair-ordering", slug: "fair-ordering", title: "Fair Ordering" },
    { id: "ordering-manipulation", slug: "ordering-manipulation", title: "Ordering Manipulation" },
    // Transaction Bundles are the object; Bundles is the topic. Bundle Atomicity,
    // Submission and Inclusion are not the transaction-level concepts.
    { id: "transaction-bundles", slug: "transaction-bundles", title: "Transaction Bundles" },
    { id: "bundle-ordering", slug: "bundle-ordering", title: "Bundle Ordering" },
    { id: "bundle-atomicity", slug: "bundle-atomicity", title: "Bundle Atomicity" },
    { id: "bundle-simulation", slug: "bundle-simulation", title: "Bundle Simulation" },
    { id: "bundle-submission", slug: "bundle-submission", title: "Bundle Submission" },
    { id: "bundle-inclusion", slug: "bundle-inclusion", title: "Bundle Inclusion" },
    // Builder Competition is not 04's Builder Markets.
    { id: "bundle-selection", slug: "bundle-selection", title: "Bundle Selection" },
    { id: "block-optimization", slug: "block-optimization", title: "Block Optimization" },
    { id: "builder-strategies", slug: "builder-strategies", title: "Builder Strategies" },
    { id: "builder-competition", slug: "builder-competition", title: "Builder Competition" },
    // Priority Auctions are not 10's Priority Fees.
    { id: "blockspace", slug: "blockspace", title: "Blockspace" },
    { id: "blockspace-demand", slug: "blockspace-demand", title: "Blockspace Demand" },
    { id: "blockspace-supply", slug: "blockspace-supply", title: "Blockspace Supply" },
    { id: "blockspace-pricing", slug: "blockspace-pricing", title: "Blockspace Pricing" },
    { id: "priority-auctions", slug: "priority-auctions", title: "Priority Auctions" },
    { id: "inclusion-markets", slug: "inclusion-markets", title: "Inclusion Markets" },
    // Protected Order Flow carries protection guarantees; Private Order Flow is only
    // kept out of the public mempool.
    { id: "public-order-flow", slug: "public-order-flow", title: "Public Order Flow" },
    { id: "private-order-flow", slug: "private-order-flow", title: "Private Order Flow" },
    // Also placed under 13's Solver Competition; this placement is preferred.
    { id: "order-flow-auctions", slug: "order-flow-auctions", title: "Order Flow Auctions", preferredPlacementId: "order-flow-auctions" },
    { id: "order-flow-payments", slug: "order-flow-payments", title: "Order Flow Payments" },
    { id: "exclusive-order-flow", slug: "exclusive-order-flow", title: "Exclusive Order Flow" },
    { id: "order-flow-competition", slug: "order-flow-competition", title: "Order Flow Competition" },
    // MEV Bids are not 10's Bids or 04's Block Bids; Builder Auctions are not 04's
    // Builder Selection.
    { id: "mev-bids", slug: "mev-bids", title: "MEV Bids" },
    { id: "builder-auctions", slug: "builder-auctions", title: "Builder Auctions" },
    { id: "auction-participants", slug: "auction-participants", title: "Auction Participants" },
    { id: "auction-rules", slug: "auction-rules", title: "Auction Rules" },
    { id: "auction-revenue", slug: "auction-revenue", title: "Auction Revenue" },
    // Private Relays are not 04's PBS Relays or 05's Relayers; Execution Privacy
    // is not 06's Privacy.
    { id: "private-transactions", slug: "private-transactions", title: "Private Transactions" },
    { id: "private-relays", slug: "private-relays", title: "Private Relays" },
    { id: "protected-order-flow", slug: "protected-order-flow", title: "Protected Order Flow" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "mev-protection", slug: "mev-protection", title: "MEV Protection", preferredPlacementId: "mev-protection" },
    { id: "execution-privacy", slug: "execution-privacy", title: "Execution Privacy" },
    // Batch Execution is not 10's Batch Auctions.
    { id: "mev-redistribution", slug: "mev-redistribution", title: "MEV Redistribution" },
    { id: "mev-smoothing", slug: "mev-smoothing", title: "MEV Smoothing" },
    { id: "encrypted-mempools", slug: "encrypted-mempools", title: "Encrypted Mempools" },
    { id: "commit-reveal", slug: "commit-reveal", title: "Commit-Reveal" },
    { id: "batch-execution", slug: "batch-execution", title: "Batch Execution" },
    { id: "ordering-guarantees", slug: "ordering-guarantees", title: "Ordering Guarantees" },
    // 13 Intents & Coordination: L1 topics. Multi-Party Coordination (parties
    // jointly executing) is not Foundations' general Coordination.
    { id: "intents", slug: "intents", title: "Intents" },
    { id: "intent-specification", slug: "intent-specification", title: "Intent Specification" },
    { id: "intent-discovery", slug: "intent-discovery", title: "Intent Discovery" },
    { id: "solvers", slug: "solvers", title: "Solvers" },
    { id: "solver-competition", slug: "solver-competition", title: "Solver Competition" },
    // Matching compatible intents, shown as "Matching"; not 11's Order Matching
    // (bids against asks).
    { id: "intent-matching", slug: "intent-matching", title: "Intent Matching" },
    { id: "intent-resolution", slug: "intent-resolution", title: "Intent Resolution" },
    // Routing execution across venues, shown as "Routing"; not 05's Request
    // Routing (RPC).
    { id: "execution-routing", slug: "execution-routing", title: "Execution Routing" },
    // What solvers and systems commit to, shown as "Commitments"; not 06's
    // Cryptographic Commitments or 04's Preconfirmation Commitments.
    { id: "intent-commitments", slug: "intent-commitments", title: "Intent Commitments" },
    { id: "intent-settlement", slug: "intent-settlement", title: "Intent Settlement" },
    { id: "multi-party-coordination", slug: "multi-party-coordination", title: "Multi-Party Coordination" },
    { id: "cross-domain-coordination", slug: "cross-domain-coordination", title: "Cross-Domain Coordination" },
    // L2 topics (placements in L2_TOPICS). Declarative Execution (stating an
    // outcome) is not 02's Deterministic Execution.
    { id: "declarative-execution", slug: "declarative-execution", title: "Declarative Execution" },
    { id: "intent-expression", slug: "intent-expression", title: "Intent Expression" },
    { id: "intent-languages", slug: "intent-languages", title: "Intent Languages" },
    { id: "intent-standards", slug: "intent-standards", title: "Intent Standards" },
    { id: "intent-lifecycle", slug: "intent-lifecycle", title: "Intent Lifecycle" },
    // Intent Constraints are not 10's Mechanism or 11's Solvency Constraints.
    { id: "intent-constraints", slug: "intent-constraints", title: "Intent Constraints" },
    { id: "user-preferences", slug: "user-preferences", title: "User Preferences" },
    { id: "outcome-conditions", slug: "outcome-conditions", title: "Outcome Conditions" },
    { id: "validity-windows", slug: "validity-windows", title: "Validity Windows" },
    { id: "limit-prices", slug: "limit-prices", title: "Limit Prices" },
    { id: "partial-fills", slug: "partial-fills", title: "Partial Fills" },
    // Intent Pools are not 04's Mempools; Intent Privacy is not 12's Execution
    // Privacy.
    { id: "intent-pools", slug: "intent-pools", title: "Intent Pools" },
    { id: "intent-propagation", slug: "intent-propagation", title: "Intent Propagation" },
    { id: "intent-visibility", slug: "intent-visibility", title: "Intent Visibility" },
    { id: "intent-privacy", slug: "intent-privacy", title: "Intent Privacy" },
    { id: "intent-aggregation", slug: "intent-aggregation", title: "Intent Aggregation" },
    { id: "solver-access", slug: "solver-access", title: "Solver Access" },
    // Solver Networks are not 05's Automation Networks; Solver Bonds are not 10's
    // Stake; Solver Reputation is its own topic, like 08's Agent Reputation.
    { id: "solver-networks", slug: "solver-networks", title: "Solver Networks" },
    { id: "solution-search", slug: "solution-search", title: "Solution Search" },
    { id: "solver-strategies", slug: "solver-strategies", title: "Solver Strategies" },
    { id: "solver-liquidity", slug: "solver-liquidity", title: "Solver Liquidity" },
    { id: "solver-bonds", slug: "solver-bonds", title: "Solver Bonds" },
    { id: "solver-reputation", slug: "solver-reputation", title: "Solver Reputation" },
    // Solver Auctions are not 10's Auctions or 12's MEV Auctions.
    { id: "solver-auctions", slug: "solver-auctions", title: "Solver Auctions" },
    { id: "solution-scoring", slug: "solution-scoring", title: "Solution Scoring" },
    { id: "winner-selection", slug: "winner-selection", title: "Winner Selection" },
    { id: "surplus-maximization", slug: "surplus-maximization", title: "Surplus Maximization" },
    { id: "coincidence-of-wants", slug: "coincidence-of-wants", title: "Coincidence of Wants" },
    { id: "ring-trades", slug: "ring-trades", title: "Ring Trades" },
    { id: "batch-matching", slug: "batch-matching", title: "Batch Matching" },
    { id: "partial-matching", slug: "partial-matching", title: "Partial Matching" },
    { id: "peer-to-peer-matching", slug: "peer-to-peer-matching", title: "Peer-to-Peer Matching" },
    { id: "matching-efficiency", slug: "matching-efficiency", title: "Matching Efficiency" },
    // Execution Selection is not 04's Transaction Selection; Execution Paths are
    // not 12's Arbitrage Paths; Fulfillment Verification is a specific check,
    // not Foundations' Verification.
    { id: "solution-validity", slug: "solution-validity", title: "Solution Validity" },
    { id: "execution-paths", slug: "execution-paths", title: "Execution Paths" },
    { id: "execution-selection", slug: "execution-selection", title: "Execution Selection" },
    { id: "fulfillment", slug: "fulfillment", title: "Fulfillment" },
    { id: "fulfillment-verification", slug: "fulfillment-verification", title: "Fulfillment Verification" },
    { id: "failed-intents", slug: "failed-intents", title: "Failed Intents" },
    { id: "order-routing", slug: "order-routing", title: "Order Routing" },
    { id: "liquidity-routing", slug: "liquidity-routing", title: "Liquidity Routing" },
    { id: "route-optimization", slug: "route-optimization", title: "Route Optimization" },
    { id: "split-routing", slug: "split-routing", title: "Split Routing" },
    { id: "dex-aggregation", slug: "dex-aggregation", title: "DEX Aggregation" },
    { id: "cross-venue-routing", slug: "cross-venue-routing", title: "Cross-Venue Routing" },
    // Execution and Price Guarantees are not 04's Inclusion or 12's Ordering
    // Guarantees; Intent Cancellation is not 09's Revocation.
    { id: "solver-commitments", slug: "solver-commitments", title: "Solver Commitments" },
    { id: "execution-guarantees", slug: "execution-guarantees", title: "Execution Guarantees" },
    { id: "price-guarantees", slug: "price-guarantees", title: "Price Guarantees" },
    { id: "intent-cancellation", slug: "intent-cancellation", title: "Intent Cancellation" },
    { id: "commitment-enforcement", slug: "commitment-enforcement", title: "Commitment Enforcement" },
    // Atomic Settlement is not 03's Atomic State Transitions.
    { id: "atomic-settlement", slug: "atomic-settlement", title: "Atomic Settlement" },
    { id: "settlement-contracts", slug: "settlement-contracts", title: "Settlement Contracts" },
    { id: "batch-settlement", slug: "batch-settlement", title: "Batch Settlement" },
    { id: "net-settlement", slug: "net-settlement", title: "Net Settlement" },
    { id: "settlement-failure", slug: "settlement-failure", title: "Settlement Failure" },
    // Coordination Mechanisms are not Foundations' Coordination Models; Commitment
    // Devices (game-theoretic) are not Intent Commitments.
    { id: "multi-party-intents", slug: "multi-party-intents", title: "Multi-Party Intents" },
    { id: "joint-execution", slug: "joint-execution", title: "Joint Execution" },
    { id: "coordination-mechanisms", slug: "coordination-mechanisms", title: "Coordination Mechanisms" },
    { id: "commitment-devices", slug: "commitment-devices", title: "Commitment Devices" },
    { id: "coordination-failures", slug: "coordination-failures", title: "Coordination Failures" },
    // Cross-Domain Atomicity is not 02's Transaction or 12's Bundle Atomicity.
    // Also placed under 16's Cross-Chain Execution; this placement is preferred.
    {
      id: "cross-chain-intents",
      slug: "cross-chain-intents",
      title: "Cross-Chain Intents",
      preferredPlacementId: "cross-chain-intents",
    },
    // Also an L1 topic of 16, shown as "Cross-Chain Execution" (a chain is one
    // kind of domain); this placement is preferred.
    {
      id: "cross-domain-execution",
      slug: "cross-domain-execution",
      title: "Cross-Domain Execution",
      preferredPlacementId: "cross-domain-execution",
    },
    // Also an L1 topic of 16, shown as "Cross-Chain Settlement"; not 11's general
    // Settlement. This placement is preferred.
    {
      id: "cross-domain-settlement",
      slug: "cross-domain-settlement",
      title: "Cross-Domain Settlement",
      preferredPlacementId: "cross-domain-settlement",
    },
    // Also an L1 topic of 16, shown as "Cross-Chain Atomicity"; this placement is
    // preferred.
    {
      id: "cross-domain-atomicity",
      slug: "cross-domain-atomicity",
      title: "Cross-Domain Atomicity",
      preferredPlacementId: "cross-domain-atomicity",
    },
    // 14 Governance & Institutions: L1 topics. Governance mechanisms stay distinct
    // from technically similar ones: Voting is not 04's Agreement, Governance
    // Execution is not protocol execution, Decision Rules are not consensus rules.
    { id: "governance-models", slug: "governance-models", title: "Governance Models" },
    { id: "governance-participants", slug: "governance-participants", title: "Governance Participants" },
    { id: "proposals", slug: "proposals", title: "Proposals" },
    { id: "voting", slug: "voting", title: "Voting" },
    { id: "representation", slug: "representation", title: "Representation" },
    { id: "decision-rules", slug: "decision-rules", title: "Decision Rules" },
    { id: "governance-execution", slug: "governance-execution", title: "Governance Execution" },
    { id: "councils-committees", slug: "councils-committees", title: "Councils & Committees" },
    { id: "treasury-governance", slug: "treasury-governance", title: "Treasury Governance" },
    { id: "constitutional-rules", slug: "constitutional-rules", title: "Constitutional Rules" },
    { id: "checks-balances", slug: "checks-balances", title: "Checks & Balances" },
    { id: "dispute-resolution", slug: "dispute-resolution", title: "Dispute Resolution" },
    { id: "emergency-governance", slug: "emergency-governance", title: "Emergency Governance" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "governance-attacks",
      slug: "governance-attacks",
      title: "Governance Attacks",
      preferredPlacementId: "governance-attacks",
    },
    { id: "institutional-design", slug: "institutional-design", title: "Institutional Design" },
    { id: "on-chain-governance", slug: "on-chain-governance", title: "On-Chain Governance" },
    { id: "off-chain-governance", slug: "off-chain-governance", title: "Off-Chain Governance" },
    { id: "token-based-governance", slug: "token-based-governance", title: "Token-Based Governance" },
    { id: "reputation-based-governance", slug: "reputation-based-governance", title: "Reputation-Based Governance" },
    { id: "futarchy", slug: "futarchy", title: "Futarchy" },
    { id: "governance-minimization", slug: "governance-minimization", title: "Governance Minimization" },
    { id: "token-holders", slug: "token-holders", title: "Token Holders" },
    // L2 topics (placements in L2_TOPICS). Voters and Delegates are governance
    // roles, not 04's Validators; Stakeholders are not Foundations' Participants.
    { id: "voters", slug: "voters", title: "Voters" },
    { id: "delegates", slug: "delegates", title: "Delegates" },
    { id: "stewards", slug: "stewards", title: "Stewards" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "stakeholders", slug: "stakeholders", title: "Stakeholders", preferredPlacementId: "stakeholders" },
    { id: "voter-participation", slug: "voter-participation", title: "Voter Participation" },
    // Proposal Thresholds (to submit) are not Approval Thresholds (to pass) or
    // 06's Threshold Cryptography.
    { id: "proposal-lifecycle", slug: "proposal-lifecycle", title: "Proposal Lifecycle" },
    { id: "proposal-submission", slug: "proposal-submission", title: "Proposal Submission" },
    { id: "proposal-thresholds", slug: "proposal-thresholds", title: "Proposal Thresholds" },
    { id: "deliberation", slug: "deliberation", title: "Deliberation" },
    { id: "signaling-votes", slug: "signaling-votes", title: "Signaling Votes" },
    { id: "proposal-review", slug: "proposal-review", title: "Proposal Review" },
    { id: "voting-mechanisms", slug: "voting-mechanisms", title: "Voting Mechanisms" },
    { id: "token-weighted-voting", slug: "token-weighted-voting", title: "Token-Weighted Voting" },
    { id: "quadratic-voting", slug: "quadratic-voting", title: "Quadratic Voting" },
    { id: "conviction-voting", slug: "conviction-voting", title: "Conviction Voting" },
    { id: "optimistic-governance", slug: "optimistic-governance", title: "Optimistic Governance" },
    { id: "vote-privacy", slug: "vote-privacy", title: "Vote Privacy" },
    // Delegate Accountability and Incentives are specific to representatives.
    { id: "liquid-democracy", slug: "liquid-democracy", title: "Liquid Democracy" },
    { id: "delegate-incentives", slug: "delegate-incentives", title: "Delegate Incentives" },
    { id: "delegate-accountability", slug: "delegate-accountability", title: "Delegate Accountability" },
    { id: "constituencies", slug: "constituencies", title: "Constituencies" },
    { id: "representative-bodies", slug: "representative-bodies", title: "Representative Bodies" },
    // Quorum Requirements (minimum participation for a valid vote) are not 04's
    // Quorums (the node sets consensus needs).
    { id: "majority-rule", slug: "majority-rule", title: "Majority Rule" },
    { id: "supermajority", slug: "supermajority", title: "Supermajority" },
    { id: "quorum-requirements", slug: "quorum-requirements", title: "Quorum Requirements" },
    { id: "approval-thresholds", slug: "approval-thresholds", title: "Approval Thresholds" },
    { id: "veto-rights", slug: "veto-rights", title: "Veto Rights" },
    { id: "tie-breaking", slug: "tie-breaking", title: "Tie-Breaking" },
    // Proposal Execution and Execution Authority turn decisions into actions; not
    // 02's Transaction Execution or 08's Authority.
    { id: "proposal-execution", slug: "proposal-execution", title: "Proposal Execution" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "timelocks", slug: "timelocks", title: "Timelocks", preferredPlacementId: "timelocks" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    {
      id: "parameter-changes",
      slug: "parameter-changes",
      title: "Parameter Changes",
      preferredPlacementId: "parameter-changes",
    },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    {
      id: "protocol-upgrades",
      slug: "protocol-upgrades",
      title: "Protocol Upgrades",
      preferredPlacementId: "protocol-upgrades",
    },
    { id: "execution-authority", slug: "execution-authority", title: "Execution Authority" },
    // Security Councils and Committee Selection are not 07's Availability
    // Committees; Signer Sets are not 04's Validator Sets or 06's Multisignatures.
    { id: "security-councils", slug: "security-councils", title: "Security Councils" },
    { id: "working-groups", slug: "working-groups", title: "Working Groups" },
    { id: "committee-selection", slug: "committee-selection", title: "Committee Selection" },
    { id: "mandates", slug: "mandates", title: "Mandates" },
    { id: "term-limits", slug: "term-limits", title: "Term Limits" },
    { id: "signer-sets", slug: "signer-sets", title: "Signer Sets" },
    { id: "treasuries", slug: "treasuries", title: "Treasuries" },
    { id: "treasury-management", slug: "treasury-management", title: "Treasury Management" },
    { id: "budget-allocation", slug: "budget-allocation", title: "Budget Allocation" },
    { id: "grants", slug: "grants", title: "Grants" },
    { id: "public-goods-funding", slug: "public-goods-funding", title: "Public Goods Funding" },
    { id: "spending-controls", slug: "spending-controls", title: "Spending Controls" },
    // Social Consensus (a community's off-chain agreement) is not 04's Consensus.
    { id: "constitutions", slug: "constitutions", title: "Constitutions" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "rule-changes", slug: "rule-changes", title: "Rule Changes", preferredPlacementId: "rule-changes" },
    { id: "amendment-processes", slug: "amendment-processes", title: "Amendment Processes" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    { id: "immutability", slug: "immutability", title: "Immutability", preferredPlacementId: "immutability" },
    { id: "governance-scope", slug: "governance-scope", title: "Governance Scope" },
    { id: "social-consensus", slug: "social-consensus", title: "Social Consensus" },
    { id: "separation-of-powers", slug: "separation-of-powers", title: "Separation of Powers" },
    { id: "oversight", slug: "oversight", title: "Oversight" },
    { id: "accountability", slug: "accountability", title: "Accountability" },
    { id: "transparency", slug: "transparency", title: "Transparency" },
    { id: "exit-rights", slug: "exit-rights", title: "Exit Rights" },
    { id: "minority-protection", slug: "minority-protection", title: "Minority Protection" },
    // Dispute Resolution reuses 09's Evidence.
    { id: "arbitration", slug: "arbitration", title: "Arbitration" },
    { id: "appeals", slug: "appeals", title: "Appeals" },
    { id: "decentralized-courts", slug: "decentralized-courts", title: "Decentralized Courts" },
    { id: "juror-selection", slug: "juror-selection", title: "Juror Selection" },
    { id: "ruling-enforcement", slug: "ruling-enforcement", title: "Ruling Enforcement" },
    { id: "emergency-powers", slug: "emergency-powers", title: "Emergency Powers" },
    // Also placed under 16's Trust & Failure Modes (a bridge pause); this
    // placement is preferred.
    {
      id: "pause-mechanisms",
      slug: "pause-mechanisms",
      title: "Pause Mechanisms",
      preferredPlacementId: "pause-mechanisms",
    },
    { id: "guardians", slug: "guardians", title: "Guardians" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "emergency-upgrades",
      slug: "emergency-upgrades",
      title: "Emergency Upgrades",
      preferredPlacementId: "emergency-upgrades",
    },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "circuit-breakers",
      slug: "circuit-breakers",
      title: "Circuit Breakers",
      preferredPlacementId: "circuit-breakers",
    },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "incident-response",
      slug: "incident-response",
      title: "Incident Response",
      preferredPlacementId: "incident-response",
    },
    // Vote Buying is not 10's general Bribery.
    { id: "governance-capture", slug: "governance-capture", title: "Governance Capture" },
    { id: "vote-buying", slug: "vote-buying", title: "Vote Buying" },
    { id: "borrowed-voting-power", slug: "borrowed-voting-power", title: "Borrowed Voting Power" },
    { id: "voter-apathy", slug: "voter-apathy", title: "Voter Apathy" },
    { id: "plutocracy", slug: "plutocracy", title: "Plutocracy" },
    { id: "hostile-takeovers", slug: "hostile-takeovers", title: "Hostile Takeovers" },
    // Institutional Design reuses 10's Incentive Alignment.
    { id: "institutions", slug: "institutions", title: "Institutions" },
    { id: "legitimacy", slug: "legitimacy", title: "Legitimacy" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    {
      id: "credible-neutrality",
      slug: "credible-neutrality",
      title: "Credible Neutrality",
      preferredPlacementId: "credible-neutrality",
    },
    { id: "path-dependence", slug: "path-dependence", title: "Path Dependence" },
    { id: "institutional-evolution", slug: "institutional-evolution", title: "Institutional Evolution" },
    // 15 Scaling & Modular Systems: L1 topics (Scaling and Rollups are the fixture's
    // concepts). Scaling is not interoperability; Optimistic Rollups are not 02's
    // Optimistic Execution; ZK Rollups are not 06's Zero-Knowledge Proofs; Rollup
    // Sequencing is not 04's Sequencing; Settlement Layers are not 11's
    // Settlement; Data Availability Layers are not 07's State Storage; Rollup
    // Security (security inheritance) is not protocol security in general.
    { id: "optimistic-rollups", slug: "optimistic-rollups", title: "Optimistic Rollups" },
    { id: "zk-rollups", slug: "zk-rollups", title: "ZK Rollups" },
    { id: "off-chain-scaling", slug: "off-chain-scaling", title: "Off-Chain Scaling" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    { id: "modularity", slug: "modularity", title: "Modularity", preferredPlacementId: "modularity" },
    { id: "execution-layers", slug: "execution-layers", title: "Execution Layers" },
    { id: "settlement-layers", slug: "settlement-layers", title: "Settlement Layers" },
    { id: "data-availability-layers", slug: "data-availability-layers", title: "Data Availability Layers" },
    { id: "consensus-layers", slug: "consensus-layers", title: "Consensus Layers" },
    { id: "rollup-sequencing", slug: "rollup-sequencing", title: "Rollup Sequencing" },
    { id: "batching-compression", slug: "batching-compression", title: "Batching & Compression" },
    { id: "scaling-tradeoffs", slug: "scaling-tradeoffs", title: "Scaling Tradeoffs" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "rollup-security",
      slug: "rollup-security",
      title: "Rollup Security",
      preferredPlacementId: "rollup-security",
    },
    // L2 topics (placements in L2_TOPICS). Layer 2 Scaling is the approach;
    // Rollups are one kind of it, and Sidechains (own security) are not rollups.
    { id: "vertical-scaling", slug: "vertical-scaling", title: "Vertical Scaling" },
    { id: "horizontal-scaling", slug: "horizontal-scaling", title: "Horizontal Scaling" },
    { id: "execution-scaling", slug: "execution-scaling", title: "Execution Scaling" },
    { id: "state-growth", slug: "state-growth", title: "State Growth" },
    { id: "scaling-bottlenecks", slug: "scaling-bottlenecks", title: "Scaling Bottlenecks" },
    { id: "layer-2-scaling", slug: "layer-2-scaling", title: "Layer 2 Scaling" },
    { id: "rollup-architecture", slug: "rollup-architecture", title: "Rollup Architecture" },
    { id: "based-rollups", slug: "based-rollups", title: "Based Rollups" },
    { id: "sovereign-rollups", slug: "sovereign-rollups", title: "Sovereign Rollups" },
    { id: "rollup-state", slug: "rollup-state", title: "Rollup State" },
    { id: "rollup-interoperability", slug: "rollup-interoperability", title: "Rollup Interoperability" },
    // Fraud Proofs (showing a claimed result wrong) are not Validity Proofs
    // (showing it right), which are not 02's Computation Proofs; State Proposers
    // are not 04's Proposers.
    { id: "fraud-proofs", slug: "fraud-proofs", title: "Fraud Proofs" },
    { id: "challenge-periods", slug: "challenge-periods", title: "Challenge Periods" },
    { id: "interactive-fraud-proofs", slug: "interactive-fraud-proofs", title: "Interactive Fraud Proofs" },
    { id: "dispute-games", slug: "dispute-games", title: "Dispute Games" },
    { id: "state-proposers", slug: "state-proposers", title: "State Proposers" },
    { id: "withdrawal-delays", slug: "withdrawal-delays", title: "Withdrawal Delays" },
    { id: "validity-proofs", slug: "validity-proofs", title: "Validity Proofs" },
    // Proof Aggregation is not 06's Signature Aggregation; zkEVMs are not 02's
    // zkVMs.
    { id: "proof-aggregation", slug: "proof-aggregation", title: "Proof Aggregation" },
    { id: "proving-costs", slug: "proving-costs", title: "Proving Costs" },
    { id: "zkevms", slug: "zkevms", title: "zkEVMs" },
    { id: "sidechains", slug: "sidechains", title: "Sidechains" },
    { id: "state-channels", slug: "state-channels", title: "State Channels" },
    { id: "payment-channels", slug: "payment-channels", title: "Payment Channels" },
    { id: "plasma", slug: "plasma", title: "Plasma" },
    { id: "validiums", slug: "validiums", title: "Validiums" },
    { id: "modular-blockchains", slug: "modular-blockchains", title: "Modular Blockchains" },
    { id: "monolithic-blockchains", slug: "monolithic-blockchains", title: "Monolithic Blockchains" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    {
      id: "layer-separation",
      slug: "layer-separation",
      title: "Layer Separation",
      preferredPlacementId: "layer-separation",
    },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    {
      id: "component-interfaces",
      slug: "component-interfaces",
      title: "Component Interfaces",
      preferredPlacementId: "component-interfaces",
    },
    { id: "unbundling", slug: "unbundling", title: "Unbundling" },
    { id: "modular-tradeoffs", slug: "modular-tradeoffs", title: "Modular Tradeoffs" },
    // Execution Layers (a layer of a modular stack) are not execution
    // environments or 02's Execution Models.
    { id: "evm-equivalence", slug: "evm-equivalence", title: "EVM Equivalence" },
    { id: "evm-compatibility", slug: "evm-compatibility", title: "EVM Compatibility" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    {
      id: "execution-clients",
      slug: "execution-clients",
      title: "Execution Clients",
      preferredPlacementId: "execution-clients",
    },
    { id: "alternative-vms", slug: "alternative-vms", title: "Alternative VMs" },
    // Rollup Settlement is not 11's Settlement; Rollup Finality (soft, then
    // L1-finalized) is not consensus Finality; Forced Withdrawals are not 04's
    // Forced Inclusion.
    { id: "rollup-settlement", slug: "rollup-settlement", title: "Rollup Settlement" },
    { id: "rollup-finality", slug: "rollup-finality", title: "Rollup Finality" },
    { id: "withdrawals", slug: "withdrawals", title: "Withdrawals" },
    { id: "forced-withdrawals", slug: "forced-withdrawals", title: "Forced Withdrawals" },
    { id: "withdrawal-proofs", slug: "withdrawal-proofs", title: "Withdrawal Proofs" },
    { id: "alternative-data-availability", slug: "alternative-data-availability", title: "Alternative Data Availability" },
    { id: "base-layers", slug: "base-layers", title: "Base Layers" },
    { id: "shared-security", slug: "shared-security", title: "Shared Security" },
    // Shared Security is not 10's Economic Security; Restaking is not 10's Stake.
    { id: "restaking", slug: "restaking", title: "Restaking" },
    { id: "layer-coupling", slug: "layer-coupling", title: "Layer Coupling" },
    // Sequencers are the role; Based Sequencing (by L1 proposers) is not Based
    // Rollups; Sequencer Censorship is not Foundations' Censorship.
    { id: "sequencers", slug: "sequencers", title: "Sequencers" },
    { id: "based-sequencing", slug: "based-sequencing", title: "Based Sequencing" },
    { id: "sequencer-liveness", slug: "sequencer-liveness", title: "Sequencer Liveness" },
    // Transaction Batching is not 10's Batch Auctions, 12's Transaction Bundles
    // or 12's Batch Execution.
    { id: "transaction-batching", slug: "transaction-batching", title: "Transaction Batching" },
    { id: "batch-posting", slug: "batch-posting", title: "Batch Posting" },
    { id: "data-compression", slug: "data-compression", title: "Data Compression" },
    { id: "state-diffs", slug: "state-diffs", title: "State Diffs" },
    { id: "cost-amortization", slug: "cost-amortization", title: "Cost Amortization" },
    // Throughput is not Confirmation Latency, which is not Foundations' Latency.
    { id: "throughput", slug: "throughput", title: "Throughput" },
    { id: "confirmation-latency", slug: "confirmation-latency", title: "Confirmation Latency" },
    { id: "scaling-costs", slug: "scaling-costs", title: "Scaling Costs" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    {
      id: "decentralization",
      slug: "decentralization",
      title: "Decentralization",
      preferredPlacementId: "decentralization",
    },
    { id: "scalability-trilemma", slug: "scalability-trilemma", title: "Scalability Trilemma" },
    // Upgrade Keys are not 14's Protocol Upgrades; Escape Hatches let users exit
    // without the operator.
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "security-inheritance",
      slug: "security-inheritance",
      title: "Security Inheritance",
      preferredPlacementId: "security-inheritance",
    },
    { id: "rollup-maturity-stages", slug: "rollup-maturity-stages", title: "Rollup Maturity Stages" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "upgrade-keys", slug: "upgrade-keys", title: "Upgrade Keys", preferredPlacementId: "upgrade-keys" },
    { id: "escape-hatches", slug: "escape-hatches", title: "Escape Hatches" },
    { id: "sequencer-censorship", slug: "sequencer-censorship", title: "Sequencer Censorship" },
    // 16 Interoperability & Abstraction: L1 topics (Cross-Chain Execution,
    // Settlement and Atomicity are 13's cross-domain concepts). Interoperability
    // Protocols are not Foundations' Protocols; Cross-Chain Verification is not
    // Foundations' Verification; Chain Abstraction is not 08's Account
    // Abstraction; Asset Bridging (moving assets) is not Asset Abstraction.
    { id: "interoperability-models", slug: "interoperability-models", title: "Interoperability Models" },
    { id: "cross-chain-messaging", slug: "cross-chain-messaging", title: "Cross-Chain Messaging" },
    { id: "bridges", slug: "bridges", title: "Bridges" },
    { id: "asset-bridging", slug: "asset-bridging", title: "Asset Bridging" },
    { id: "cross-chain-state", slug: "cross-chain-state", title: "Cross-Chain State" },
    { id: "cross-chain-verification", slug: "cross-chain-verification", title: "Cross-Chain Verification" },
    { id: "interoperability-protocols", slug: "interoperability-protocols", title: "Interoperability Protocols" },
    { id: "chain-abstraction", slug: "chain-abstraction", title: "Chain Abstraction" },
    { id: "abstraction-layers", slug: "abstraction-layers", title: "Abstraction Layers" },
    { id: "interoperability-security", slug: "interoperability-security", title: "Interoperability Security" },
    { id: "trust-failure-modes", slug: "trust-failure-modes", title: "Trust & Failure Modes" },
    // L2 topics (placements in L2_TOPICS).
    { id: "native-interoperability", slug: "native-interoperability", title: "Native Interoperability" },
    { id: "trusted-interoperability", slug: "trusted-interoperability", title: "Trusted Interoperability" },
    { id: "trust-minimized-interoperability", slug: "trust-minimized-interoperability", title: "Trust-Minimized Interoperability" },
    { id: "hub-and-spoke-interoperability", slug: "hub-and-spoke-interoperability", title: "Hub-and-Spoke Interoperability" },
    { id: "point-to-point-interoperability", slug: "point-to-point-interoperability", title: "Point-to-Point Interoperability" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    {
      id: "cross-chain-composability",
      slug: "cross-chain-composability",
      title: "Cross-Chain Composability",
      preferredPlacementId: "cross-chain-composability",
    },
    // Cross-chain messaging is not 05's Message Propagation (gossip within a
    // network); Message Ordering is not 04's Transaction Ordering; Message
    // Authentication is not 08's Authentication; Replay Protection is the
    // defence against Replay Attacks.
    { id: "cross-chain-messages", slug: "cross-chain-messages", title: "Cross-Chain Messages" },
    { id: "message-delivery", slug: "message-delivery", title: "Message Delivery" },
    { id: "message-ordering", slug: "message-ordering", title: "Message Ordering" },
    { id: "replay-protection", slug: "replay-protection", title: "Replay Protection" },
    { id: "message-authentication", slug: "message-authentication", title: "Message Authentication" },
    // Bridges are one mechanism for cross-chain messaging, not messaging itself.
    { id: "bridge-contracts", slug: "bridge-contracts", title: "Bridge Contracts" },
    { id: "bridge-operators", slug: "bridge-operators", title: "Bridge Operators" },
    { id: "bridge-custody", slug: "bridge-custody", title: "Bridge Custody" },
    { id: "canonical-bridges", slug: "canonical-bridges", title: "Canonical Bridges" },
    { id: "third-party-bridges", slug: "third-party-bridges", title: "Third-Party Bridges" },
    { id: "bridge-upgradeability", slug: "bridge-upgradeability", title: "Bridge Upgradeability" },
    // Wrapped Assets are not 11's Tokenized or Synthetic Assets; Canonical Assets
    // are not 11's Native Assets.
    { id: "lock-and-mint", slug: "lock-and-mint", title: "Lock-and-Mint" },
    { id: "burn-and-mint", slug: "burn-and-mint", title: "Burn-and-Mint" },
    { id: "liquidity-based-bridging", slug: "liquidity-based-bridging", title: "Liquidity-Based Bridging" },
    { id: "wrapped-assets", slug: "wrapped-assets", title: "Wrapped Assets" },
    { id: "canonical-assets", slug: "canonical-assets", title: "Canonical Assets" },
    { id: "bridged-asset-risk", slug: "bridged-asset-risk", title: "Bridged Asset Risk" },
    // Remote State is another chain's state, not 03's Global State; Header
    // Relaying is not 05's Message Relaying; Cross-Chain State Sync is not 03's
    // Synchronization.
    { id: "remote-state", slug: "remote-state", title: "Remote State" },
    { id: "cross-chain-queries", slug: "cross-chain-queries", title: "Cross-Chain Queries" },
    { id: "header-relaying", slug: "header-relaying", title: "Header Relaying" },
    { id: "cross-chain-state-sync", slug: "cross-chain-state-sync", title: "Cross-Chain State Sync" },
    // ZK Verification of another chain is not 06's Proof Verification alone;
    // Committee Verification is not 07's Availability Committees.
    { id: "light-client-verification", slug: "light-client-verification", title: "Light-Client Verification" },
    { id: "zk-verification", slug: "zk-verification", title: "ZK Verification" },
    { id: "optimistic-verification", slug: "optimistic-verification", title: "Optimistic Verification" },
    { id: "committee-verification", slug: "committee-verification", title: "Committee Verification" },
    { id: "verification-latency", slug: "verification-latency", title: "Verification Latency" },
    { id: "interoperability-standards", slug: "interoperability-standards", title: "Interoperability Standards" },
    { id: "messaging-protocols", slug: "messaging-protocols", title: "Messaging Protocols" },
    { id: "inter-blockchain-communication", slug: "inter-blockchain-communication", title: "Inter-Blockchain Communication" },
    { id: "cross-chain-token-standards", slug: "cross-chain-token-standards", title: "Cross-Chain Token Standards" },
    { id: "protocol-adapters", slug: "protocol-adapters", title: "Protocol Adapters" },
    { id: "interoperability-layers", slug: "interoperability-layers", title: "Interoperability Layers" },
    // Execution Failure Handling concerns cross-chain calls that fail partway.
    { id: "cross-chain-transactions", slug: "cross-chain-transactions", title: "Cross-Chain Transactions" },
    { id: "cross-chain-calls", slug: "cross-chain-calls", title: "Cross-Chain Calls" },
    { id: "remote-execution", slug: "remote-execution", title: "Remote Execution" },
    { id: "execution-callbacks", slug: "execution-callbacks", title: "Execution Callbacks" },
    { id: "execution-failure-handling", slug: "execution-failure-handling", title: "Execution Failure Handling" },
    // Reorg Risk (a source chain reorganizing under a transfer) is not 04's
    // Reorganizations.
    { id: "settlement-latency", slug: "settlement-latency", title: "Settlement Latency" },
    { id: "settlement-proofs", slug: "settlement-proofs", title: "Settlement Proofs" },
    { id: "rebalancing", slug: "rebalancing", title: "Rebalancing" },
    { id: "solver-repayment", slug: "solver-repayment", title: "Solver Repayment" },
    { id: "reorg-risk", slug: "reorg-risk", title: "Reorg Risk" },
    // Atomic Swaps are not 13's Atomic Settlement.
    { id: "atomic-swaps", slug: "atomic-swaps", title: "Atomic Swaps" },
    { id: "hashed-timelock-contracts", slug: "hashed-timelock-contracts", title: "Hashed Timelock Contracts" },
    { id: "two-phase-commit", slug: "two-phase-commit", title: "Two-Phase Commit" },
    { id: "partial-failures", slug: "partial-failures", title: "Partial Failures" },
    { id: "atomicity-guarantees", slug: "atomicity-guarantees", title: "Atomicity Guarantees" },
    // Unified Accounts are not 08's Accounts; Chain Routing is not 13's Execution
    // Routing or 04's Chain Selection.
    { id: "unified-accounts", slug: "unified-accounts", title: "Unified Accounts" },
    { id: "unified-balances", slug: "unified-balances", title: "Unified Balances" },
    { id: "chain-agnostic-interfaces", slug: "chain-agnostic-interfaces", title: "Chain-Agnostic Interfaces" },
    { id: "chain-routing", slug: "chain-routing", title: "Chain Routing" },
    { id: "resource-locks", slug: "resource-locks", title: "Resource Locks" },
    { id: "asset-abstraction", slug: "asset-abstraction", title: "Asset Abstraction" },
    { id: "liquidity-abstraction", slug: "liquidity-abstraction", title: "Liquidity Abstraction" },
    { id: "intent-based-abstraction", slug: "intent-based-abstraction", title: "Intent-Based Abstraction" },
    { id: "execution-abstraction", slug: "execution-abstraction", title: "Execution Abstraction" },
    // Bridge Security is specific to bridges, not protocol security in general;
    // Verifier Compromise is not 09's Source Compromise; Transfer Limits (value
    // caps) are not 05's Rate Limiting.
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "bridge-security",
      slug: "bridge-security",
      title: "Bridge Security",
      preferredPlacementId: "bridge-security",
    },
    { id: "bridge-exploits", slug: "bridge-exploits", title: "Bridge Exploits" },
    { id: "verifier-compromise", slug: "verifier-compromise", title: "Verifier Compromise" },
    { id: "message-forgery", slug: "message-forgery", title: "Message Forgery" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "replay-attacks", slug: "replay-attacks", title: "Replay Attacks", preferredPlacementId: "replay-attacks" },
    { id: "transfer-limits", slug: "transfer-limits", title: "Transfer Limits" },
    // 17 Security, Correctness & Resilience: L1 topics (Incident Response is 14's
    // concept). Security (against adversaries), Correctness (doing what is
    // specified) and Resilience (continuing through failure) are distinct
    // concerns; Smart Contract Security is not Protocol Security; Access Control
    // is not 08's Authentication; Security Monitoring is not 05's Monitoring.
    { id: "security-models", slug: "security-models", title: "Security Models" },
    { id: "security-properties", slug: "security-properties", title: "Security Properties" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    {
      id: "threat-modeling",
      slug: "threat-modeling",
      title: "Threat Modeling",
      preferredPlacementId: "threat-modeling",
    },
    { id: "attack-classes", slug: "attack-classes", title: "Attack Classes" },
    { id: "vulnerabilities-exploits", slug: "vulnerabilities-exploits", title: "Vulnerabilities & Exploits" },
    { id: "smart-contract-security", slug: "smart-contract-security", title: "Smart Contract Security" },
    { id: "protocol-security", slug: "protocol-security", title: "Protocol Security" },
    { id: "correctness", slug: "correctness", title: "Correctness" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "formal-methods", slug: "formal-methods", title: "Formal Methods", preferredPlacementId: "formal-methods" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "testing", slug: "testing", title: "Testing", preferredPlacementId: "testing" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "auditing", slug: "auditing", title: "Auditing", preferredPlacementId: "auditing" },
    { id: "access-control", slug: "access-control", title: "Access Control" },
    { id: "key-security", slug: "key-security", title: "Key Security" },
    { id: "operational-security", slug: "operational-security", title: "Operational Security" },
    { id: "security-monitoring", slug: "security-monitoring", title: "Security Monitoring" },
    { id: "resilience", slug: "resilience", title: "Resilience" },
    { id: "security-economics", slug: "security-economics", title: "Security Economics" },
    { id: "upgrade-security", slug: "upgrade-security", title: "Upgrade Security" },
    { id: "domain-specific-security", slug: "domain-specific-security", title: "Domain-Specific Security" },
    // L2 topics (placements in L2_TOPICS). Security Assumptions are not
    // Foundations' Trust Assumptions; Defense in Depth layers independent controls.
    { id: "security-assumptions", slug: "security-assumptions", title: "Security Assumptions" },
    { id: "defense-in-depth", slug: "defense-in-depth", title: "Defense in Depth" },
    // Integrity (as a security property) is not 03's Integrity Guarantees.
    { id: "integrity", slug: "integrity", title: "Integrity" },
    // Attack Surfaces (what can be attacked) are not Foundations' Trust Boundaries;
    // Attack Vectors are not Threats; Risk Assessment is not 11's Risk.
    { id: "attack-surfaces", slug: "attack-surfaces", title: "Attack Surfaces" },
    { id: "attack-vectors", slug: "attack-vectors", title: "Attack Vectors" },
    { id: "threat-analysis", slug: "threat-analysis", title: "Threat Analysis" },
    { id: "risk-assessment", slug: "risk-assessment", title: "Risk Assessment" },
    { id: "attack-trees", slug: "attack-trees", title: "Attack Trees" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    {
      id: "security-requirements",
      slug: "security-requirements",
      title: "Security Requirements",
      preferredPlacementId: "security-requirements",
    },
    // Denial-of-Service Attacks are the attack; 02's Denial-of-Service Resistance
    // the defence. Eclipse Attacks isolate a node's view of the network.
    { id: "denial-of-service-attacks", slug: "denial-of-service-attacks", title: "Denial-of-Service Attacks" },
    { id: "eclipse-attacks", slug: "eclipse-attacks", title: "Eclipse Attacks" },
    // Vulnerabilities are weaknesses; Exploits make use of them.
    { id: "vulnerabilities", slug: "vulnerabilities", title: "Vulnerabilities" },
    { id: "exploits", slug: "exploits", title: "Exploits" },
    { id: "vulnerability-classes", slug: "vulnerability-classes", title: "Vulnerability Classes" },
    { id: "zero-day-vulnerabilities", slug: "zero-day-vulnerabilities", title: "Zero-Day Vulnerabilities" },
    { id: "vulnerability-disclosure", slug: "vulnerability-disclosure", title: "Vulnerability Disclosure" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "bug-bounties", slug: "bug-bounties", title: "Bug Bounties", preferredPlacementId: "bug-bounties" },
    // Flash Loan Attacks are not 14's Borrowed Voting Power.
    { id: "reentrancy", slug: "reentrancy", title: "Reentrancy" },
    { id: "arithmetic-errors", slug: "arithmetic-errors", title: "Arithmetic Errors" },
    { id: "access-control-flaws", slug: "access-control-flaws", title: "Access Control Flaws" },
    { id: "unchecked-external-calls", slug: "unchecked-external-calls", title: "Unchecked External Calls" },
    { id: "flash-loan-attacks", slug: "flash-loan-attacks", title: "Flash Loan Attacks" },
    // Protocol-level security by layer, each specialised further in its home
    // domain.
    { id: "execution-security", slug: "execution-security", title: "Execution Security" },
    { id: "consensus-attacks", slug: "consensus-attacks", title: "Consensus Attacks" },
    { id: "network-attacks", slug: "network-attacks", title: "Network Attacks" },
    { id: "cryptographic-failures", slug: "cryptographic-failures", title: "Cryptographic Failures" },
    { id: "data-integrity-attacks", slug: "data-integrity-attacks", title: "Data Integrity Attacks" },
    { id: "identity-attacks", slug: "identity-attacks", title: "Identity Attacks" },
    // Validation (building the right thing) is not Verification (building it
    // right), nor 02's Transaction Validation; Invariants are not Foundations'
    // Protocol Properties.
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "specifications", slug: "specifications", title: "Specifications", preferredPlacementId: "specifications" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "invariants", slug: "invariants", title: "Invariants", preferredPlacementId: "invariants" },
    { id: "functional-correctness", slug: "functional-correctness", title: "Functional Correctness" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "validation", slug: "validation", title: "Validation", preferredPlacementId: "validation" },
    { id: "correctness-proofs", slug: "correctness-proofs", title: "Correctness Proofs" },
    // Formal Methods, Testing and Auditing are distinct assurance activities.
    { id: "formal-verification", slug: "formal-verification", title: "Formal Verification" },
    { id: "model-checking", slug: "model-checking", title: "Model Checking" },
    { id: "theorem-proving", slug: "theorem-proving", title: "Theorem Proving" },
    { id: "symbolic-execution", slug: "symbolic-execution", title: "Symbolic Execution" },
    { id: "static-analysis", slug: "static-analysis", title: "Static Analysis" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    {
      id: "formal-specifications",
      slug: "formal-specifications",
      title: "Formal Specifications",
      preferredPlacementId: "formal-specifications",
    },
    { id: "unit-testing", slug: "unit-testing", title: "Unit Testing" },
    { id: "integration-testing", slug: "integration-testing", title: "Integration Testing" },
    { id: "fuzzing", slug: "fuzzing", title: "Fuzzing" },
    { id: "property-based-testing", slug: "property-based-testing", title: "Property-Based Testing" },
    { id: "invariant-testing", slug: "invariant-testing", title: "Invariant Testing" },
    { id: "adversarial-testing", slug: "adversarial-testing", title: "Adversarial Testing" },
    { id: "security-audits", slug: "security-audits", title: "Security Audits" },
    { id: "code-review", slug: "code-review", title: "Code Review" },
    { id: "audit-scope", slug: "audit-scope", title: "Audit Scope" },
    { id: "audit-findings", slug: "audit-findings", title: "Audit Findings" },
    { id: "remediation", slug: "remediation", title: "Remediation" },
    { id: "continuous-auditing", slug: "continuous-auditing", title: "Continuous Auditing" },
    // Authorization (what an authenticated party may do) is not 08's
    // Authentication or Authority.
    { id: "authorization", slug: "authorization", title: "Authorization" },
    { id: "least-privilege", slug: "least-privilege", title: "Least Privilege" },
    { id: "privilege-escalation", slug: "privilege-escalation", title: "Privilege Escalation" },
    { id: "role-based-access-control", slug: "role-based-access-control", title: "Role-Based Access Control" },
    // Key Custody is not 08's Key Management; Blind Signing is not 06's Signing.
    { id: "key-compromise", slug: "key-compromise", title: "Key Compromise" },
    { id: "key-custody", slug: "key-custody", title: "Key Custody" },
    { id: "key-rotation", slug: "key-rotation", title: "Key Rotation" },
    { id: "hardware-security-modules", slug: "hardware-security-modules", title: "Hardware Security Modules" },
    { id: "blind-signing", slug: "blind-signing", title: "Blind Signing" },
    { id: "social-engineering", slug: "social-engineering", title: "Social Engineering" },
    // Operational Failures (non-adversarial) are not adversarial attacks.
    { id: "infrastructure-security", slug: "infrastructure-security", title: "Infrastructure Security" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    {
      id: "deployment-security",
      slug: "deployment-security",
      title: "Deployment Security",
      preferredPlacementId: "deployment-security",
    },
    { id: "configuration-errors", slug: "configuration-errors", title: "Configuration Errors" },
    { id: "supply-chain-security", slug: "supply-chain-security", title: "Supply Chain Security" },
    { id: "insider-threats", slug: "insider-threats", title: "Insider Threats" },
    { id: "operational-failures", slug: "operational-failures", title: "Operational Failures" },
    // Anomaly Detection flags deviations from expected behaviour.
    { id: "threat-detection", slug: "threat-detection", title: "Threat Detection" },
    { id: "anomaly-detection", slug: "anomaly-detection", title: "Anomaly Detection" },
    { id: "on-chain-monitoring", slug: "on-chain-monitoring", title: "On-Chain Monitoring" },
    { id: "security-telemetry", slug: "security-telemetry", title: "Security Telemetry" },
    { id: "forensics", slug: "forensics", title: "Forensics" },
    // Incident Response is not 14's Emergency Governance.
    { id: "containment", slug: "containment", title: "Containment" },
    { id: "response-coordination", slug: "response-coordination", title: "Response Coordination" },
    { id: "post-mortems", slug: "post-mortems", title: "Post-Mortems" },
    { id: "incident-disclosure", slug: "incident-disclosure", title: "Incident Disclosure" },
    // Resilience is not Foundations' Fault Tolerance alone; Recovery is not 08's
    // Account or Wallet Recovery.
    { id: "graceful-degradation", slug: "graceful-degradation", title: "Graceful Degradation" },
    { id: "recovery", slug: "recovery", title: "Recovery" },
    { id: "disaster-recovery", slug: "disaster-recovery", title: "Disaster Recovery" },
    // Cryptographic Security is not 10's Economic Security.
    { id: "cryptographic-security", slug: "cryptographic-security", title: "Cryptographic Security" },
    // Upgrade Verification is not 14's Protocol Upgrades.
    { id: "proxy-upgrade-risks", slug: "proxy-upgrade-risks", title: "Proxy Upgrade Risks" },
    { id: "upgrade-verification", slug: "upgrade-verification", title: "Upgrade Verification" },
    // 18 Protocol Architecture: L1 topics. How protocol systems are structured,
    // across layers; the mechanics of each layer stay in their own domains (15
    // for modular layers), and design process and lifecycle belong to 19.
    { id: "architectural-principles", slug: "architectural-principles", title: "Architectural Principles" },
    { id: "protocol-layers", slug: "protocol-layers", title: "Protocol Layers" },
    { id: "components-interfaces", slug: "components-interfaces", title: "Components & Interfaces" },
    { id: "state-architecture", slug: "state-architecture", title: "State Architecture" },
    { id: "execution-architecture", slug: "execution-architecture", title: "Execution Architecture" },
    { id: "contract-architecture", slug: "contract-architecture", title: "Smart Contract Architecture" },
    { id: "client-architecture", slug: "client-architecture", title: "Client Architecture" },
    { id: "network-architecture", slug: "network-architecture", title: "Network Architecture" },
    { id: "data-architecture", slug: "data-architecture", title: "Data Architecture" },
    { id: "trust-architecture", slug: "trust-architecture", title: "Trust Architecture" },
    { id: "composability", slug: "composability", title: "Composability" },
    { id: "architectural-tradeoffs", slug: "architectural-tradeoffs", title: "Architectural Tradeoffs" },
    // L2 topics (placements in L2_TOPICS). Protocol Minimalism is not 14's
    // Governance Minimization.
    { id: "separation-of-concerns", slug: "separation-of-concerns", title: "Separation of Concerns" },
    { id: "abstraction-boundaries", slug: "abstraction-boundaries", title: "Abstraction Boundaries" },
    { id: "protocol-minimalism", slug: "protocol-minimalism", title: "Protocol Minimalism" },
    // Layered Architecture and the Protocol Stack are general; 15's Execution,
    // Settlement, Consensus and Data Availability Layers are its modular instance.
    { id: "layered-architecture", slug: "layered-architecture", title: "Layered Architecture" },
    { id: "protocol-stack", slug: "protocol-stack", title: "Protocol Stack" },
    { id: "layer-responsibilities", slug: "layer-responsibilities", title: "Layer Responsibilities" },
    { id: "cross-layer-dependencies", slug: "cross-layer-dependencies", title: "Cross-Layer Dependencies" },
    // Protocol Standards are not 16's Interoperability Standards; Protocol Hooks
    // are extension points in a protocol's own logic.
    { id: "protocol-components", slug: "protocol-components", title: "Protocol Components" },
    { id: "protocol-standards", slug: "protocol-standards", title: "Protocol Standards" },
    { id: "component-dependencies", slug: "component-dependencies", title: "Component Dependencies" },
    { id: "extension-points", slug: "extension-points", title: "Extension Points" },
    { id: "protocol-hooks", slug: "protocol-hooks", title: "Protocol Hooks" },
    // State Partitioning and Shared State are not 03's State Layout or Global
    // State.
    { id: "state-ownership", slug: "state-ownership", title: "State Ownership" },
    { id: "state-partitioning", slug: "state-partitioning", title: "State Partitioning" },
    { id: "state-access-patterns", slug: "state-access-patterns", title: "State Access Patterns" },
    { id: "shared-state", slug: "shared-state", title: "Shared State" },
    { id: "state-isolation", slug: "state-isolation", title: "State Isolation" },
    // Concurrency Models are not 02's Parallel Execution; Execution Boundaries
    // are not 08's Authority Boundaries.
    { id: "execution-pipelines", slug: "execution-pipelines", title: "Execution Pipelines" },
    { id: "execution-scheduling", slug: "execution-scheduling", title: "Execution Scheduling" },
    { id: "execution-boundaries", slug: "execution-boundaries", title: "Execution Boundaries" },
    { id: "call-graphs", slug: "call-graphs", title: "Call Graphs" },
    { id: "concurrency-models", slug: "concurrency-models", title: "Concurrency Models" },
    // Proxy Patterns (the architecture) are not 17's Proxy Upgrade Risks.
    { id: "contract-systems", slug: "contract-systems", title: "Contract Systems" },
    { id: "proxy-patterns", slug: "proxy-patterns", title: "Proxy Patterns" },
    { id: "factory-patterns", slug: "factory-patterns", title: "Factory Patterns" },
    { id: "contract-libraries", slug: "contract-libraries", title: "Contract Libraries" },
    { id: "singleton-contracts", slug: "singleton-contracts", title: "Singleton Contracts" },
    { id: "contract-registries", slug: "contract-registries", title: "Contract Registries" },
    // Client Diversity is not 16's Interoperability; Node Roles are not 05's node
    // types.
    { id: "consensus-clients", slug: "consensus-clients", title: "Consensus Clients" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    {
      id: "client-diversity",
      slug: "client-diversity",
      title: "Client Diversity",
      preferredPlacementId: "client-diversity",
    },
    { id: "client-separation", slug: "client-separation", title: "Client Separation" },
    { id: "node-roles", slug: "node-roles", title: "Node Roles" },
    { id: "client-interfaces", slug: "client-interfaces", title: "Client Interfaces" },
    // Network Layers are not Protocol Layers.
    { id: "overlay-networks", slug: "overlay-networks", title: "Overlay Networks" },
    { id: "network-layers", slug: "network-layers", title: "Network Layers" },
    { id: "peer-roles", slug: "peer-roles", title: "Peer Roles" },
    { id: "network-segmentation", slug: "network-segmentation", title: "Network Segmentation" },
    // Data Models are not 03's State Models; Storage Architecture is not 07's
    // Storage Layout.
    { id: "data-models", slug: "data-models", title: "Data Models" },
    { id: "data-placement", slug: "data-placement", title: "Data Placement" },
    { id: "storage-architecture", slug: "storage-architecture", title: "Storage Architecture" },
    { id: "data-flows", slug: "data-flows", title: "Data Flows" },
    // The Trusted Computing Base is not 09's Trusted Hardware.
    { id: "trusted-components", slug: "trusted-components", title: "Trusted Components" },
    { id: "trusted-computing-base", slug: "trusted-computing-base", title: "Trusted Computing Base" },
    { id: "trust-dependencies", slug: "trust-dependencies", title: "Trust Dependencies" },
    // Atomic Composability is not 02's Transaction Atomicity.
    { id: "synchronous-composability", slug: "synchronous-composability", title: "Synchronous Composability" },
    { id: "asynchronous-composability", slug: "asynchronous-composability", title: "Asynchronous Composability" },
    { id: "atomic-composability", slug: "atomic-composability", title: "Atomic Composability" },
    { id: "protocol-integrations", slug: "protocol-integrations", title: "Protocol Integrations" },
    { id: "composability-risks", slug: "composability-risks", title: "Composability Risks" },
    // Coupling is not 15's Layer Coupling.
    { id: "coupling", slug: "coupling", title: "Coupling" },
    { id: "cohesion", slug: "cohesion", title: "Cohesion" },
    { id: "architectural-complexity", slug: "architectural-complexity", title: "Architectural Complexity" },
    { id: "extensibility", slug: "extensibility", title: "Extensibility" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "technical-debt", slug: "technical-debt", title: "Technical Debt", preferredPlacementId: "technical-debt" },
    // 19 Protocol Design & Lifecycle: L1 topics. How protocols are conceived,
    // specified, designed, implemented, validated, launched, operated, changed and
    // retired; not 18's structure, 17's security, or organisational governance.
    // Change Management is not 14's Governance; Protocol Evolution is not 14's
    // Institutional Evolution; Pre-Launch Validation is not runtime Verification.
    { id: "protocol-requirements", slug: "protocol-requirements", title: "Protocol Requirements" },
    { id: "design-goals-constraints", slug: "design-goals-constraints", title: "Design Goals & Constraints" },
    { id: "protocol-specification", slug: "protocol-specification", title: "Protocol Specification" },
    { id: "protocol-modeling", slug: "protocol-modeling", title: "Protocol Modeling" },
    { id: "prototyping-simulation", slug: "prototyping-simulation", title: "Prototyping & Simulation" },
    { id: "protocol-implementation", slug: "protocol-implementation", title: "Protocol Implementation" },
    { id: "pre-launch-validation", slug: "pre-launch-validation", title: "Pre-Launch Validation" },
    { id: "deployment-launch", slug: "deployment-launch", title: "Deployment & Launch" },
    { id: "parameterization", slug: "parameterization", title: "Parameterization" },
    { id: "protocol-operations", slug: "protocol-operations", title: "Protocol Operations" },
    { id: "change-management", slug: "change-management", title: "Change Management" },
    { id: "versioning-compatibility", slug: "versioning-compatibility", title: "Versioning & Compatibility" },
    { id: "protocol-evolution", slug: "protocol-evolution", title: "Protocol Evolution" },
    { id: "deprecation-retirement", slug: "deprecation-retirement", title: "Deprecation & Retirement" },
    // L2 topics (placements in L2_TOPICS). Protocol Requirements are not 17's
    // Security Requirements, which are one kind of them.
    { id: "problem-definition", slug: "problem-definition", title: "Problem Definition" },
    { id: "functional-requirements", slug: "functional-requirements", title: "Functional Requirements" },
    { id: "non-functional-requirements", slug: "non-functional-requirements", title: "Non-Functional Requirements" },
    { id: "requirements-traceability", slug: "requirements-traceability", title: "Requirements Traceability" },
    // Design Goals are not 10's Mechanism Objectives; Design Constraints are not
    // 10's Mechanism Constraints; Design Assumptions are not Foundations' Trust
    // Assumptions or 17's Security Assumptions.
    { id: "design-goals", slug: "design-goals", title: "Design Goals" },
    { id: "non-goals", slug: "non-goals", title: "Non-Goals" },
    { id: "design-constraints", slug: "design-constraints", title: "Design Constraints" },
    { id: "design-assumptions", slug: "design-assumptions", title: "Design Assumptions" },
    { id: "success-criteria", slug: "success-criteria", title: "Success Criteria" },
    // Protocol rules are Foundations' Rules, placed under Protocol Specification.
    { id: "specification-languages", slug: "specification-languages", title: "Specification Languages" },
    { id: "specification-ambiguity", slug: "specification-ambiguity", title: "Specification Ambiguity" },
    // Protocol Modeling is not 03's State Models; Economic Modeling is not 10's
    // Mechanism Design.
    { id: "reference-models", slug: "reference-models", title: "Reference Models" },
    { id: "economic-modeling", slug: "economic-modeling", title: "Economic Modeling" },
    { id: "agent-based-modeling", slug: "agent-based-modeling", title: "Agent-Based Modeling" },
    // Prototyping is not Protocol Simulation (modelling system behaviour before
    // it exists); Devnets and Testnets are not production networks.
    { id: "prototyping", slug: "prototyping", title: "Prototyping" },
    { id: "protocol-simulation", slug: "protocol-simulation", title: "Protocol Simulation" },
    { id: "proof-of-concepts", slug: "proof-of-concepts", title: "Proof of Concepts" },
    { id: "devnets", slug: "devnets", title: "Devnets" },
    { id: "testnets", slug: "testnets", title: "Testnets" },
    { id: "shadow-forks", slug: "shadow-forks", title: "Shadow Forks" },
    // Reference Implementations are not Production Implementations.
    { id: "reference-implementations", slug: "reference-implementations", title: "Reference Implementations" },
    { id: "production-implementations", slug: "production-implementations", title: "Production Implementations" },
    { id: "specification-conformance", slug: "specification-conformance", title: "Specification Conformance" },
    { id: "conformance-testing", slug: "conformance-testing", title: "Conformance Testing" },
    { id: "implementation-drift", slug: "implementation-drift", title: "Implementation Drift" },
    { id: "launch-readiness", slug: "launch-readiness", title: "Launch Readiness" },
    // Protocol Deployment is not 02's Contract Deployment; Protocol Launch is not
    // deployment; Protocol Bootstrapping is not organisational bootstrapping.
    { id: "protocol-deployment", slug: "protocol-deployment", title: "Protocol Deployment" },
    { id: "genesis", slug: "genesis", title: "Genesis" },
    { id: "protocol-launch", slug: "protocol-launch", title: "Protocol Launch" },
    { id: "protocol-bootstrapping", slug: "protocol-bootstrapping", title: "Protocol Bootstrapping" },
    { id: "phased-rollouts", slug: "phased-rollouts", title: "Phased Rollouts" },
    // Protocol Parameters are not 14's Parameter Changes (changing them).
    { id: "protocol-parameters", slug: "protocol-parameters", title: "Protocol Parameters" },
    { id: "initial-parameters", slug: "initial-parameters", title: "Initial Parameters" },
    { id: "parameter-tuning", slug: "parameter-tuning", title: "Parameter Tuning" },
    { id: "parameter-bounds", slug: "parameter-bounds", title: "Parameter Bounds" },
    { id: "configuration-management", slug: "configuration-management", title: "Configuration Management" },
    // Protocol Operations (maintaining a live protocol) are not automated protocol
    // maintenance by agents.
    { id: "post-launch-monitoring", slug: "post-launch-monitoring", title: "Post-Launch Monitoring" },
    { id: "maintenance-releases", slug: "maintenance-releases", title: "Maintenance Releases" },
    { id: "client-updates", slug: "client-updates", title: "Client Updates" },
    { id: "operational-runbooks", slug: "operational-runbooks", title: "Operational Runbooks" },
    { id: "network-health", slug: "network-health", title: "Network Health" },
    // Hard and Soft Forks are protocol changes, not 04's Competing Forks.
    { id: "improvement-proposals", slug: "improvement-proposals", title: "Improvement Proposals" },
    { id: "hard-forks", slug: "hard-forks", title: "Hard Forks" },
    { id: "soft-forks", slug: "soft-forks", title: "Soft Forks" },
    { id: "upgrade-coordination", slug: "upgrade-coordination", title: "Upgrade Coordination" },
    // Migrations move state or users to a new version, not upgrades in place;
    // Backward Compatibility is not 16's interoperability.
    { id: "protocol-versioning", slug: "protocol-versioning", title: "Protocol Versioning" },
    { id: "backward-compatibility", slug: "backward-compatibility", title: "Backward Compatibility" },
    { id: "forward-compatibility", slug: "forward-compatibility", title: "Forward Compatibility" },
    { id: "migrations", slug: "migrations", title: "Migrations" },
    { id: "state-migrations", slug: "state-migrations", title: "State Migrations" },
    { id: "breaking-changes", slug: "breaking-changes", title: "Breaking Changes" },
    // Ossification is not 14's Governance Minimization; Lifecycle Risks are not
    // 18's Technical Debt.
    { id: "evolutionary-paths", slug: "evolutionary-paths", title: "Evolutionary Paths" },
    { id: "progressive-decentralization", slug: "progressive-decentralization", title: "Progressive Decentralization" },
    { id: "ossification", slug: "ossification", title: "Ossification" },
    { id: "lifecycle-risks", slug: "lifecycle-risks", title: "Lifecycle Risks" },
    // Deprecation (discouraging use) precedes Protocol Sunsetting (winding down);
    // Protocol Retirement is a planned end, not a failure.
    { id: "deprecation", slug: "deprecation", title: "Deprecation" },
    { id: "protocol-sunsetting", slug: "protocol-sunsetting", title: "Protocol Sunsetting" },
    { id: "protocol-retirement", slug: "protocol-retirement", title: "Protocol Retirement" },
    { id: "migration-paths", slug: "migration-paths", title: "Migration Paths" },
    { id: "legacy-support", slug: "legacy-support", title: "Legacy Support" },
    { id: "liveness-failures", slug: "liveness-failures", title: "Liveness Failures" },
    { id: "safety-failures", slug: "safety-failures", title: "Safety Failures" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "failure-isolation",
      slug: "failure-isolation",
      title: "Failure Isolation",
      preferredPlacementId: "failure-isolation",
    },
    { id: "contagion-risk", slug: "contagion-risk", title: "Contagion Risk" },
    // 20 AI & Intelligent Systems: L1 topics (AI Inference is 09's concept; AI
    // Agents is the fixture's AI Agent, below). Verifiable AI's home is here;
    // the proof primitives it builds on stay 06's. Economic agency, multi-agent
    // coordination, execution environments, organizations, autonomous protocols
    // and economies are 21–26's.
    { id: "ai-models", slug: "ai-models", title: "AI Models" },
    { id: "reasoning", slug: "reasoning", title: "Reasoning" },
    { id: "goals-planning", slug: "goals-planning", title: "Goals & Planning" },
    { id: "memory-context", slug: "memory-context", title: "Memory & Context" },
    { id: "tool-use", slug: "tool-use", title: "Tool Use" },
    { id: "uncertainty-reliability", slug: "uncertainty-reliability", title: "Uncertainty & Reliability" },
    { id: "ai-evaluation", slug: "ai-evaluation", title: "AI Evaluation" },
    // AI Alignment (a model's behaviour matching intent) is not 10's Incentive
    // Alignment; AI Security is not 17's system-wide security.
    { id: "alignment-control", slug: "alignment-control", title: "Alignment & Control" },
    { id: "ai-security", slug: "ai-security", title: "AI Security" },
    { id: "verifiable-ai", slug: "verifiable-ai", title: "Verifiable AI" },
    // L2 topics (placements in L2_TOPICS).
    { id: "training-data", slug: "training-data", title: "Training Data" },
    { id: "model-training", slug: "model-training", title: "Model Training" },
    { id: "model-weights", slug: "model-weights", title: "Model Weights" },
    { id: "foundation-models", slug: "foundation-models", title: "Foundation Models" },
    { id: "fine-tuning", slug: "fine-tuning", title: "Fine-Tuning" },
    { id: "model-capabilities", slug: "model-capabilities", title: "Model Capabilities" },
    // Decoding (choosing output tokens) is not 07's Sampling; Inference
    // Reproducibility (the same output across runs and hardware) is not
    // Foundations' Determinism or 02's Non-Deterministic Execution; Inference
    // Cost is not 02's Execution Cost.
    { id: "model-inputs", slug: "model-inputs", title: "Model Inputs" },
    { id: "model-outputs", slug: "model-outputs", title: "Model Outputs" },
    { id: "decoding", slug: "decoding", title: "Decoding" },
    { id: "inference-reproducibility", slug: "inference-reproducibility", title: "Inference Reproducibility" },
    { id: "inference-cost", slug: "inference-cost", title: "Inference Cost" },
    { id: "inference-providers", slug: "inference-providers", title: "Inference Providers" },
    // Reasoning Traces are not 02's Execution Traces or 05's Traces.
    { id: "reasoning-traces", slug: "reasoning-traces", title: "Reasoning Traces" },
    { id: "test-time-compute", slug: "test-time-compute", title: "Test-Time Compute" },
    { id: "self-correction", slug: "self-correction", title: "Self-Correction" },
    { id: "reasoning-faithfulness", slug: "reasoning-faithfulness", title: "Reasoning Faithfulness" },
    { id: "world-models", slug: "world-models", title: "World Models" },
    // An agent's Goals are not 10's Mechanism Objectives.
    { id: "goals", slug: "goals", title: "Goals" },
    { id: "task-decomposition", slug: "task-decomposition", title: "Task Decomposition" },
    { id: "plans", slug: "plans", title: "Plans" },
    { id: "planning-horizons", slug: "planning-horizons", title: "Planning Horizons" },
    { id: "replanning", slug: "replanning", title: "Replanning" },
    { id: "context-windows", slug: "context-windows", title: "Context Windows" },
    { id: "context-management", slug: "context-management", title: "Context Management" },
    { id: "long-term-memory", slug: "long-term-memory", title: "Long-Term Memory" },
    { id: "embeddings", slug: "embeddings", title: "Embeddings" },
    // Retrieving knowledge into a model's context, not 07's Data or Content Retrieval.
    { id: "retrieval-augmented-generation", slug: "retrieval-augmented-generation", title: "Retrieval-Augmented Generation" },
    // Tool Protocols (how models discover and call tools) are not Foundations' Protocols.
    { id: "tools", slug: "tools", title: "Tools" },
    { id: "tool-calling", slug: "tool-calling", title: "Tool Calling" },
    { id: "tool-schemas", slug: "tool-schemas", title: "Tool Schemas" },
    { id: "tool-results", slug: "tool-results", title: "Tool Results" },
    { id: "tool-selection", slug: "tool-selection", title: "Tool Selection" },
    { id: "tool-protocols", slug: "tool-protocols", title: "Tool Protocols" },
    // Principals (the party an agent acts for) are a general concept for later
    // authority, execution, organization and autonomy domains; not
    // Foundations' Participants or 10's Players. Autonomy Levels leaves the
    // general Autonomy to 22–26.
    { id: "principals", slug: "principals", title: "Principals" },
    { id: "agent-loops", slug: "agent-loops", title: "Agent Loops" },
    { id: "agent-actions", slug: "agent-actions", title: "Agent Actions" },
    { id: "autonomy-levels", slug: "autonomy-levels", title: "Autonomy Levels" },
    // Model Robustness is not Foundations' Fault Tolerance.
    { id: "model-uncertainty", slug: "model-uncertainty", title: "Model Uncertainty" },
    { id: "model-calibration", slug: "model-calibration", title: "Model Calibration" },
    { id: "hallucinations", slug: "hallucinations", title: "Hallucinations" },
    { id: "model-robustness", slug: "model-robustness", title: "Model Robustness" },
    { id: "distribution-shift", slug: "distribution-shift", title: "Distribution Shift" },
    { id: "benchmarks", slug: "benchmarks", title: "Benchmarks" },
    { id: "capability-evaluations", slug: "capability-evaluations", title: "Capability Evaluations" },
    { id: "safety-evaluations", slug: "safety-evaluations", title: "Safety Evaluations" },
    { id: "red-teaming", slug: "red-teaming", title: "Red Teaming" },
    { id: "benchmark-contamination", slug: "benchmark-contamination", title: "Benchmark Contamination" },
    { id: "model-graded-evaluation", slug: "model-graded-evaluation", title: "Model-Graded Evaluation" },
    // Specification Gaming is not 10's Manipulation. Guardrails constrain a
    // model's inputs and outputs, and Human Oversight is the general concept;
    // policy enforcement and human approval in execution are 23's.
    { id: "goal-specification", slug: "goal-specification", title: "Goal Specification" },
    { id: "specification-gaming", slug: "specification-gaming", title: "Specification Gaming" },
    { id: "guardrails", slug: "guardrails", title: "Guardrails" },
    { id: "human-oversight", slug: "human-oversight", title: "Human Oversight" },
    { id: "interpretability", slug: "interpretability", title: "Interpretability" },
    { id: "corrigibility", slug: "corrigibility", title: "Corrigibility" },
    // Training Data Poisoning (corrupting what a model learns from) is not 09's
    // Data Poisoning (corrupting an oracle's sources): different attack surfaces.
    { id: "prompt-injection", slug: "prompt-injection", title: "Prompt Injection" },
    { id: "jailbreaks", slug: "jailbreaks", title: "Jailbreaks" },
    { id: "adversarial-examples", slug: "adversarial-examples", title: "Adversarial Examples" },
    { id: "training-data-poisoning", slug: "training-data-poisoning", title: "Training Data Poisoning" },
    { id: "model-backdoors", slug: "model-backdoors", title: "Model Backdoors" },
    { id: "model-extraction", slug: "model-extraction", title: "Model Extraction" },
    // Verifiable Inference is not 06's Verifiable Execution or Computation
    // Proofs; Model Commitments are not Commitment Schemes; Model Provenance
    // is not 03's Provenance or 09's Source Provenance.
    { id: "verifiable-inference", slug: "verifiable-inference", title: "Verifiable Inference" },
    { id: "zkml", slug: "zkml", title: "zkML" },
    { id: "model-commitments", slug: "model-commitments", title: "Model Commitments" },
    { id: "model-provenance", slug: "model-provenance", title: "Model Provenance" },
    { id: "verifiable-agents", slug: "verifiable-agents", title: "Verifiable Agents" },
    // Also placed under 09's Oracle Networks (nodes agreeing on a reported
    // value); this placement is preferred.
    { id: "consensus", slug: "consensus", title: "Consensus", preferredPlacementId: "consensus" },
    {
      id: "finality",
      slug: "finality",
      title: "Finality",
      preferredPlacementId: "finality-in-consensus",
    },
    { id: "scaling", slug: "scaling", title: "Scaling" },
    { id: "rollups", slug: "rollups", title: "Rollups" },
    // The general concept (a transaction's obligations discharged and done): a
    // relationship target and mechanism step, placed under 11's Derivatives
    // (preferred) and 13's Intent Settlement.
    { id: "settlement", slug: "settlement", title: "Settlement", preferredPlacementId: "settlement" },
    { id: "identity", slug: "identity", title: "Identity" },
    // Also placed under 20's AI Agents; this placement (08's Machine Identity)
    // is preferred.
    { id: "agent-identity", slug: "agent-identity", title: "Agent Identity", preferredPlacementId: "agent-identity" },
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
    // 05 Networks & Infrastructure: L1 topics.
    { id: "p2p-networks", conceptId: "p2p-networks", parentPlacementId: "networks-infrastructure", order: 0 },
    { id: "message-propagation", conceptId: "message-propagation", parentPlacementId: "networks-infrastructure", order: 1 },
    { id: "nodes", conceptId: "nodes", parentPlacementId: "networks-infrastructure", order: 2 },
    { id: "rpc", conceptId: "rpc", parentPlacementId: "networks-infrastructure", order: 3 },
    { id: "indexers", conceptId: "indexers", parentPlacementId: "networks-infrastructure", order: 4 },
    { id: "relayers", conceptId: "relayers", parentPlacementId: "networks-infrastructure", order: 5 },
    { id: "keepers", conceptId: "keepers", parentPlacementId: "networks-infrastructure", order: 6 },
    { id: "bots", conceptId: "bots", parentPlacementId: "networks-infrastructure", order: 7 },
    { id: "monitoring", conceptId: "monitoring", parentPlacementId: "networks-infrastructure", order: 8 },
    { id: "automation", conceptId: "automation", parentPlacementId: "networks-infrastructure", order: 9 },
    // 06 Cryptography & Proofs: L1 topics.
    { id: "hash-functions", conceptId: "hash-functions", parentPlacementId: "cryptography-proofs", order: 0 },
    { id: "digital-signatures", conceptId: "digital-signatures", parentPlacementId: "cryptography-proofs", order: 1 },
    {
      id: "cryptographic-commitments",
      conceptId: "cryptographic-commitments",
      parentPlacementId: "cryptography-proofs",
      order: 2,
      contextualLabel: "Commitments",
    },
    { id: "threshold-cryptography", conceptId: "threshold-cryptography", parentPlacementId: "cryptography-proofs", order: 3 },
    { id: "zero-knowledge-proofs", conceptId: "zero-knowledge-proofs", parentPlacementId: "cryptography-proofs", order: 4 },
    { id: "proof-systems", conceptId: "proof-systems", parentPlacementId: "cryptography-proofs", order: 5 },
    {
      id: "verifiable-computation-in-cryptography-proofs",
      conceptId: "verifiable-computation",
      parentPlacementId: "cryptography-proofs",
      order: 6,
    },
    { id: "privacy", conceptId: "privacy", parentPlacementId: "cryptography-proofs", order: 7 },
    // 07 Storage & Availability: L1 topics.
    { id: "on-chain-storage", conceptId: "on-chain-storage", parentPlacementId: "storage-availability", order: 0 },
    { id: "distributed-storage", conceptId: "distributed-storage", parentPlacementId: "storage-availability", order: 1 },
    {
      id: "content-addressing-in-storage-availability",
      conceptId: "content-addressing",
      parentPlacementId: "storage-availability",
      order: 2,
    },
    { id: "archival-storage", conceptId: "archival-storage", parentPlacementId: "storage-availability", order: 3 },
    { id: "data-availability", conceptId: "data-availability", parentPlacementId: "storage-availability", order: 4 },
    { id: "erasure-coding", conceptId: "erasure-coding", parentPlacementId: "storage-availability", order: 5 },
    { id: "blobs", conceptId: "blobs", parentPlacementId: "storage-availability", order: 6 },
    { id: "data-availability-sampling", conceptId: "data-availability-sampling", parentPlacementId: "storage-availability", order: 7 },
    { id: "storage-proofs", conceptId: "storage-proofs", parentPlacementId: "storage-availability", order: 8 },
    // 08 Identity, Accounts & Authority: L1 topics. Identity and Authority are
    // the Phase 1 fixture's placements, keeping their IDs.
    { id: "identity", conceptId: "identity", parentPlacementId: "identity-accounts-authority", order: 0 },
    { id: "accounts", conceptId: "accounts", parentPlacementId: "identity-accounts-authority", order: 1 },
    { id: "wallets", conceptId: "wallets", parentPlacementId: "identity-accounts-authority", order: 2 },
    { id: "smart-accounts", conceptId: "smart-accounts", parentPlacementId: "identity-accounts-authority", order: 3 },
    { id: "account-abstraction", conceptId: "account-abstraction", parentPlacementId: "identity-accounts-authority", order: 4 },
    { id: "authentication", conceptId: "authentication", parentPlacementId: "identity-accounts-authority", order: 5 },
    { id: "authority", conceptId: "authority", parentPlacementId: "identity-accounts-authority", order: 6 },
    { id: "machine-identity", conceptId: "machine-identity", parentPlacementId: "identity-accounts-authority", order: 7 },
    // 09 Oracles & External Reality: L1 topics.
    { id: "oracle-problem", conceptId: "oracle-problem", parentPlacementId: "oracles-external-reality", order: 0 },
    { id: "data-sources", conceptId: "data-sources", parentPlacementId: "oracles-external-reality", order: 1 },
    { id: "oracle-networks", conceptId: "oracle-networks", parentPlacementId: "oracles-external-reality", order: 2 },
    { id: "push-pull-oracles", conceptId: "push-pull-oracles", parentPlacementId: "oracles-external-reality", order: 3 },
    {
      id: "oracle-aggregation",
      conceptId: "oracle-aggregation",
      parentPlacementId: "oracles-external-reality",
      order: 4,
      contextualLabel: "Aggregation",
    },
    { id: "freshness", conceptId: "freshness", parentPlacementId: "oracles-external-reality", order: 5 },
    {
      id: "provenance-in-oracles-external-reality",
      conceptId: "provenance",
      parentPlacementId: "oracles-external-reality",
      order: 6,
    },
    { id: "oracle-security", conceptId: "oracle-security", parentPlacementId: "oracles-external-reality", order: 7 },
    { id: "machine-readable-reality", conceptId: "machine-readable-reality", parentPlacementId: "oracles-external-reality", order: 8 },
    { id: "sensors-external-systems", conceptId: "sensors-external-systems", parentPlacementId: "oracles-external-reality", order: 9 },
    { id: "ai-interpreted-data", conceptId: "ai-interpreted-data", parentPlacementId: "oracles-external-reality", order: 10 },
    { id: "real-world-attestations", conceptId: "real-world-attestations", parentPlacementId: "oracles-external-reality", order: 11 },
    // 10 Economics & Mechanism Design: L1 topics.
    { id: "incentives", conceptId: "incentives", parentPlacementId: "economics-mechanism-design", order: 0 },
    { id: "mechanism-design", conceptId: "mechanism-design", parentPlacementId: "economics-mechanism-design", order: 1 },
    { id: "game-theory", conceptId: "game-theory", parentPlacementId: "economics-mechanism-design", order: 2 },
    {
      id: "strategic-behavior-in-economics-mechanism-design",
      conceptId: "strategic-behavior",
      parentPlacementId: "economics-mechanism-design",
      order: 3,
    },
    { id: "token-economics", conceptId: "token-economics", parentPlacementId: "economics-mechanism-design", order: 4 },
    { id: "fees", conceptId: "fees", parentPlacementId: "economics-mechanism-design", order: 5 },
    { id: "auctions", conceptId: "auctions", parentPlacementId: "economics-mechanism-design", order: 6 },
    { id: "resource-allocation", conceptId: "resource-allocation", parentPlacementId: "economics-mechanism-design", order: 7 },
    { id: "staking-economics", conceptId: "staking-economics", parentPlacementId: "economics-mechanism-design", order: 8 },
    { id: "security-budgets", conceptId: "security-budgets", parentPlacementId: "economics-mechanism-design", order: 9 },
    { id: "cryptoeconomic-security", conceptId: "cryptoeconomic-security", parentPlacementId: "economics-mechanism-design", order: 10 },
    // 11 Markets & Financial Protocols: L1 topics.
    { id: "assets", conceptId: "assets", parentPlacementId: "markets-financial-protocols", order: 0 },
    { id: "markets", conceptId: "markets", parentPlacementId: "markets-financial-protocols", order: 1 },
    { id: "liquidity", conceptId: "liquidity", parentPlacementId: "markets-financial-protocols", order: 2 },
    { id: "automated-market-makers", conceptId: "automated-market-makers", parentPlacementId: "markets-financial-protocols", order: 3 },
    { id: "order-books", conceptId: "order-books", parentPlacementId: "markets-financial-protocols", order: 4 },
    { id: "lending-borrowing", conceptId: "lending-borrowing", parentPlacementId: "markets-financial-protocols", order: 5 },
    { id: "collateral", conceptId: "collateral", parentPlacementId: "markets-financial-protocols", order: 6 },
    { id: "liquidations", conceptId: "liquidations", parentPlacementId: "markets-financial-protocols", order: 7 },
    { id: "stablecoins", conceptId: "stablecoins", parentPlacementId: "markets-financial-protocols", order: 8 },
    { id: "derivatives", conceptId: "derivatives", parentPlacementId: "markets-financial-protocols", order: 9 },
    { id: "risk", conceptId: "risk", parentPlacementId: "markets-financial-protocols", order: 10 },
    { id: "solvency", conceptId: "solvency", parentPlacementId: "markets-financial-protocols", order: 11 },
    // 12 MEV & Execution Markets: L1 topics.
    { id: "mev", conceptId: "mev", parentPlacementId: "mev-execution-markets", order: 0 },
    { id: "searchers", conceptId: "searchers", parentPlacementId: "mev-execution-markets", order: 1 },
    { id: "arbitrage", conceptId: "arbitrage", parentPlacementId: "mev-execution-markets", order: 2 },
    { id: "liquidation-mev", conceptId: "liquidation-mev", parentPlacementId: "mev-execution-markets", order: 3 },
    { id: "sandwiching", conceptId: "sandwiching", parentPlacementId: "mev-execution-markets", order: 4 },
    {
      id: "transaction-ordering-in-mev-execution-markets",
      conceptId: "transaction-ordering",
      parentPlacementId: "mev-execution-markets",
      order: 5,
    },
    { id: "bundles", conceptId: "bundles", parentPlacementId: "mev-execution-markets", order: 6 },
    {
      id: "builders-in-mev-execution-markets",
      conceptId: "builders",
      parentPlacementId: "mev-execution-markets",
      order: 7,
    },
    { id: "blockspace-markets", conceptId: "blockspace-markets", parentPlacementId: "mev-execution-markets", order: 8 },
    { id: "order-flow", conceptId: "order-flow", parentPlacementId: "mev-execution-markets", order: 9 },
    { id: "mev-auctions", conceptId: "mev-auctions", parentPlacementId: "mev-execution-markets", order: 10 },
    { id: "private-execution", conceptId: "private-execution", parentPlacementId: "mev-execution-markets", order: 11 },
    { id: "mev-mitigation", conceptId: "mev-mitigation", parentPlacementId: "mev-execution-markets", order: 12 },
    // 13 Intents & Coordination: L1 topics.
    { id: "intents", conceptId: "intents", parentPlacementId: "intents-coordination", order: 0 },
    { id: "intent-specification", conceptId: "intent-specification", parentPlacementId: "intents-coordination", order: 1 },
    { id: "intent-discovery", conceptId: "intent-discovery", parentPlacementId: "intents-coordination", order: 2 },
    { id: "solvers", conceptId: "solvers", parentPlacementId: "intents-coordination", order: 3 },
    { id: "solver-competition", conceptId: "solver-competition", parentPlacementId: "intents-coordination", order: 4 },
    {
      id: "intent-matching",
      conceptId: "intent-matching",
      parentPlacementId: "intents-coordination",
      order: 5,
      contextualLabel: "Matching",
    },
    { id: "intent-resolution", conceptId: "intent-resolution", parentPlacementId: "intents-coordination", order: 6 },
    {
      id: "execution-routing",
      conceptId: "execution-routing",
      parentPlacementId: "intents-coordination",
      order: 7,
      contextualLabel: "Routing",
    },
    {
      id: "intent-commitments",
      conceptId: "intent-commitments",
      parentPlacementId: "intents-coordination",
      order: 8,
      contextualLabel: "Commitments",
    },
    { id: "intent-settlement", conceptId: "intent-settlement", parentPlacementId: "intents-coordination", order: 9 },
    { id: "multi-party-coordination", conceptId: "multi-party-coordination", parentPlacementId: "intents-coordination", order: 10 },
    { id: "cross-domain-coordination", conceptId: "cross-domain-coordination", parentPlacementId: "intents-coordination", order: 11 },
    // 14 Governance & Institutions: L1 topics.
    { id: "governance-models", conceptId: "governance-models", parentPlacementId: "governance-institutions", order: 0 },
    {
      id: "governance-participants",
      conceptId: "governance-participants",
      parentPlacementId: "governance-institutions",
      order: 1,
    },
    { id: "proposals", conceptId: "proposals", parentPlacementId: "governance-institutions", order: 2 },
    { id: "voting", conceptId: "voting", parentPlacementId: "governance-institutions", order: 3 },
    { id: "representation", conceptId: "representation", parentPlacementId: "governance-institutions", order: 4 },
    { id: "decision-rules", conceptId: "decision-rules", parentPlacementId: "governance-institutions", order: 5 },
    {
      id: "governance-execution",
      conceptId: "governance-execution",
      parentPlacementId: "governance-institutions",
      order: 6,
    },
    {
      id: "councils-committees",
      conceptId: "councils-committees",
      parentPlacementId: "governance-institutions",
      order: 7,
    },
    {
      id: "treasury-governance",
      conceptId: "treasury-governance",
      parentPlacementId: "governance-institutions",
      order: 8,
    },
    {
      id: "constitutional-rules",
      conceptId: "constitutional-rules",
      parentPlacementId: "governance-institutions",
      order: 9,
    },
    { id: "checks-balances", conceptId: "checks-balances", parentPlacementId: "governance-institutions", order: 10 },
    {
      id: "dispute-resolution",
      conceptId: "dispute-resolution",
      parentPlacementId: "governance-institutions",
      order: 11,
    },
    {
      id: "emergency-governance",
      conceptId: "emergency-governance",
      parentPlacementId: "governance-institutions",
      order: 12,
    },
    {
      id: "governance-attacks",
      conceptId: "governance-attacks",
      parentPlacementId: "governance-institutions",
      order: 13,
    },
    {
      id: "institutional-design",
      conceptId: "institutional-design",
      parentPlacementId: "governance-institutions",
      order: 14,
    },
    // 16 Interoperability & Abstraction: L1 topics.
    {
      id: "interoperability-models",
      conceptId: "interoperability-models",
      parentPlacementId: "interoperability-abstraction",
      order: 0,
    },
    {
      id: "cross-chain-messaging",
      conceptId: "cross-chain-messaging",
      parentPlacementId: "interoperability-abstraction",
      order: 1,
    },
    { id: "bridges", conceptId: "bridges", parentPlacementId: "interoperability-abstraction", order: 2 },
    { id: "asset-bridging", conceptId: "asset-bridging", parentPlacementId: "interoperability-abstraction", order: 3 },
    {
      id: "cross-chain-state",
      conceptId: "cross-chain-state",
      parentPlacementId: "interoperability-abstraction",
      order: 4,
    },
    {
      id: "cross-chain-verification",
      conceptId: "cross-chain-verification",
      parentPlacementId: "interoperability-abstraction",
      order: 5,
    },
    {
      id: "interoperability-protocols",
      conceptId: "interoperability-protocols",
      parentPlacementId: "interoperability-abstraction",
      order: 6,
    },
    {
      id: "cross-domain-execution-in-interoperability-abstraction",
      conceptId: "cross-domain-execution",
      parentPlacementId: "interoperability-abstraction",
      order: 7,
      contextualLabel: "Cross-Chain Execution",
    },
    {
      id: "cross-domain-settlement-in-interoperability-abstraction",
      conceptId: "cross-domain-settlement",
      parentPlacementId: "interoperability-abstraction",
      order: 8,
      contextualLabel: "Cross-Chain Settlement",
    },
    {
      id: "cross-domain-atomicity-in-interoperability-abstraction",
      conceptId: "cross-domain-atomicity",
      parentPlacementId: "interoperability-abstraction",
      order: 9,
      contextualLabel: "Cross-Chain Atomicity",
    },
    {
      id: "chain-abstraction",
      conceptId: "chain-abstraction",
      parentPlacementId: "interoperability-abstraction",
      order: 10,
    },
    {
      id: "abstraction-layers",
      conceptId: "abstraction-layers",
      parentPlacementId: "interoperability-abstraction",
      order: 11,
    },
    {
      id: "interoperability-security",
      conceptId: "interoperability-security",
      parentPlacementId: "interoperability-abstraction",
      order: 12,
    },
    {
      id: "trust-failure-modes",
      conceptId: "trust-failure-modes",
      parentPlacementId: "interoperability-abstraction",
      order: 13,
    },
    // 17 Security, Correctness & Resilience: L1 topics.
    {
      id: "security-models",
      conceptId: "security-models",
      parentPlacementId: "security-correctness-resilience",
      order: 0,
    },
    {
      id: "security-properties",
      conceptId: "security-properties",
      parentPlacementId: "security-correctness-resilience",
      order: 1,
    },
    {
      id: "threat-modeling",
      conceptId: "threat-modeling",
      parentPlacementId: "security-correctness-resilience",
      order: 2,
    },
    {
      id: "attack-classes",
      conceptId: "attack-classes",
      parentPlacementId: "security-correctness-resilience",
      order: 3,
    },
    {
      id: "vulnerabilities-exploits",
      conceptId: "vulnerabilities-exploits",
      parentPlacementId: "security-correctness-resilience",
      order: 4,
    },
    {
      id: "smart-contract-security",
      conceptId: "smart-contract-security",
      parentPlacementId: "security-correctness-resilience",
      order: 5,
    },
    {
      id: "protocol-security",
      conceptId: "protocol-security",
      parentPlacementId: "security-correctness-resilience",
      order: 6,
    },
    { id: "correctness", conceptId: "correctness", parentPlacementId: "security-correctness-resilience", order: 7 },
    {
      id: "formal-methods",
      conceptId: "formal-methods",
      parentPlacementId: "security-correctness-resilience",
      order: 8,
    },
    { id: "testing", conceptId: "testing", parentPlacementId: "security-correctness-resilience", order: 9 },
    { id: "auditing", conceptId: "auditing", parentPlacementId: "security-correctness-resilience", order: 10 },
    {
      id: "access-control",
      conceptId: "access-control",
      parentPlacementId: "security-correctness-resilience",
      order: 11,
    },
    { id: "key-security", conceptId: "key-security", parentPlacementId: "security-correctness-resilience", order: 12 },
    {
      id: "operational-security",
      conceptId: "operational-security",
      parentPlacementId: "security-correctness-resilience",
      order: 13,
    },
    {
      id: "security-monitoring",
      conceptId: "security-monitoring",
      parentPlacementId: "security-correctness-resilience",
      order: 14,
    },
    {
      id: "incident-response-in-security-correctness-resilience",
      conceptId: "incident-response",
      parentPlacementId: "security-correctness-resilience",
      order: 15,
    },
    { id: "resilience", conceptId: "resilience", parentPlacementId: "security-correctness-resilience", order: 16 },
    {
      id: "security-economics",
      conceptId: "security-economics",
      parentPlacementId: "security-correctness-resilience",
      order: 17,
    },
    {
      id: "upgrade-security",
      conceptId: "upgrade-security",
      parentPlacementId: "security-correctness-resilience",
      order: 18,
    },
    {
      id: "domain-specific-security",
      conceptId: "domain-specific-security",
      parentPlacementId: "security-correctness-resilience",
      order: 19,
    },
    // 18 Protocol Architecture: L1 topics.
    {
      id: "architectural-principles",
      conceptId: "architectural-principles",
      parentPlacementId: "protocol-architecture",
      order: 0,
    },
    { id: "protocol-layers", conceptId: "protocol-layers", parentPlacementId: "protocol-architecture", order: 1 },
    {
      id: "components-interfaces",
      conceptId: "components-interfaces",
      parentPlacementId: "protocol-architecture",
      order: 2,
    },
    { id: "state-architecture", conceptId: "state-architecture", parentPlacementId: "protocol-architecture", order: 3 },
    {
      id: "execution-architecture",
      conceptId: "execution-architecture",
      parentPlacementId: "protocol-architecture",
      order: 4,
    },
    {
      id: "contract-architecture",
      conceptId: "contract-architecture",
      parentPlacementId: "protocol-architecture",
      order: 5,
    },
    {
      id: "client-architecture",
      conceptId: "client-architecture",
      parentPlacementId: "protocol-architecture",
      order: 6,
    },
    {
      id: "network-architecture",
      conceptId: "network-architecture",
      parentPlacementId: "protocol-architecture",
      order: 7,
    },
    { id: "data-architecture", conceptId: "data-architecture", parentPlacementId: "protocol-architecture", order: 8 },
    { id: "trust-architecture", conceptId: "trust-architecture", parentPlacementId: "protocol-architecture", order: 9 },
    { id: "composability", conceptId: "composability", parentPlacementId: "protocol-architecture", order: 10 },
    {
      id: "architectural-tradeoffs",
      conceptId: "architectural-tradeoffs",
      parentPlacementId: "protocol-architecture",
      order: 11,
    },
    // 19 Protocol Design & Lifecycle: L1 topics.
    {
      id: "protocol-requirements",
      conceptId: "protocol-requirements",
      parentPlacementId: "protocol-design-lifecycle",
      order: 0,
    },
    {
      id: "design-goals-constraints",
      conceptId: "design-goals-constraints",
      parentPlacementId: "protocol-design-lifecycle",
      order: 1,
    },
    {
      id: "protocol-specification",
      conceptId: "protocol-specification",
      parentPlacementId: "protocol-design-lifecycle",
      order: 2,
    },
    {
      id: "protocol-modeling",
      conceptId: "protocol-modeling",
      parentPlacementId: "protocol-design-lifecycle",
      order: 3,
    },
    {
      id: "prototyping-simulation",
      conceptId: "prototyping-simulation",
      parentPlacementId: "protocol-design-lifecycle",
      order: 4,
    },
    {
      id: "protocol-implementation",
      conceptId: "protocol-implementation",
      parentPlacementId: "protocol-design-lifecycle",
      order: 5,
    },
    {
      id: "pre-launch-validation",
      conceptId: "pre-launch-validation",
      parentPlacementId: "protocol-design-lifecycle",
      order: 6,
    },
    {
      id: "deployment-launch",
      conceptId: "deployment-launch",
      parentPlacementId: "protocol-design-lifecycle",
      order: 7,
    },
    { id: "parameterization", conceptId: "parameterization", parentPlacementId: "protocol-design-lifecycle", order: 8 },
    {
      id: "protocol-operations",
      conceptId: "protocol-operations",
      parentPlacementId: "protocol-design-lifecycle",
      order: 9,
    },
    {
      id: "change-management",
      conceptId: "change-management",
      parentPlacementId: "protocol-design-lifecycle",
      order: 10,
    },
    {
      id: "versioning-compatibility",
      conceptId: "versioning-compatibility",
      parentPlacementId: "protocol-design-lifecycle",
      order: 11,
    },
    {
      id: "protocol-evolution",
      conceptId: "protocol-evolution",
      parentPlacementId: "protocol-design-lifecycle",
      order: 12,
    },
    {
      id: "deprecation-retirement",
      conceptId: "deprecation-retirement",
      parentPlacementId: "protocol-design-lifecycle",
      order: 13,
    },
    // 20 AI & Intelligent Systems: L1 topics. AI Agents is the Phase 1
    // fixture's AI Agent placement, keeping its ID.
    { id: "ai-models", conceptId: "ai-models", parentPlacementId: "ai-intelligent-systems", order: 0 },
    {
      id: "ai-inference-in-ai-intelligent-systems",
      conceptId: "ai-inference",
      parentPlacementId: "ai-intelligent-systems",
      order: 1,
    },
    { id: "reasoning", conceptId: "reasoning", parentPlacementId: "ai-intelligent-systems", order: 2 },
    { id: "goals-planning", conceptId: "goals-planning", parentPlacementId: "ai-intelligent-systems", order: 3 },
    { id: "memory-context", conceptId: "memory-context", parentPlacementId: "ai-intelligent-systems", order: 4 },
    { id: "tool-use", conceptId: "tool-use", parentPlacementId: "ai-intelligent-systems", order: 5 },
    { id: "ai-agent", conceptId: "ai-agent", parentPlacementId: "ai-intelligent-systems", order: 6, contextualLabel: "AI Agents" },
    { id: "uncertainty-reliability", conceptId: "uncertainty-reliability", parentPlacementId: "ai-intelligent-systems", order: 7 },
    { id: "ai-evaluation", conceptId: "ai-evaluation", parentPlacementId: "ai-intelligent-systems", order: 8 },
    { id: "alignment-control", conceptId: "alignment-control", parentPlacementId: "ai-intelligent-systems", order: 9 },
    { id: "ai-security", conceptId: "ai-security", parentPlacementId: "ai-intelligent-systems", order: 10 },
    { id: "verifiable-ai", conceptId: "verifiable-ai", parentPlacementId: "ai-intelligent-systems", order: 11 },
    ...l2Placements,
    // 04 Consensus & Ordering: L1 topics. Consensus and Finality are the Phase
    // 1 fixture's placements, keeping their IDs; Finality is now an L1 topic
    // of its own rather than a child of Consensus.
    { id: "consensus", conceptId: "consensus", parentPlacementId: "consensus-ordering", order: 0 },
    { id: "validators", conceptId: "validators", parentPlacementId: "consensus-ordering", order: 1 },
    { id: "fork-choice", conceptId: "fork-choice", parentPlacementId: "consensus-ordering", order: 2 },
    {
      id: "finality-in-consensus",
      conceptId: "finality",
      parentPlacementId: "consensus-ordering",
      order: 3,
      contextualNote: "Finality as the point at which consensus no longer reverses a result.",
    },
    { id: "mempools", conceptId: "mempools", parentPlacementId: "consensus-ordering", order: 4 },
    { id: "sequencing", conceptId: "sequencing", parentPlacementId: "consensus-ordering", order: 5 },
    { id: "block-building", conceptId: "block-building", parentPlacementId: "consensus-ordering", order: 6 },
    { id: "proposer-builder-separation", conceptId: "proposer-builder-separation", parentPlacementId: "consensus-ordering", order: 7 },
    { id: "preconfirmations", conceptId: "preconfirmations", parentPlacementId: "consensus-ordering", order: 8 },
    {
      id: "censorship-resistance-in-consensus-ordering",
      conceptId: "censorship-resistance",
      parentPlacementId: "consensus-ordering",
      order: 9,
    },
    // 15 Scaling & Modular Systems: L1 topics. Scaling and Rollups are the Phase 1
    // fixture's placements (IDs unchanged); Rollups is now an L1 topic, and the
    // fixture's Finality beneath it an L2 topic (it closes Rollups' layer).
    { id: "scaling", conceptId: "scaling", parentPlacementId: "scaling-modular-systems", order: 0 },
    { id: "rollups", conceptId: "rollups", parentPlacementId: "scaling-modular-systems", order: 1 },
    {
      id: "optimistic-rollups",
      conceptId: "optimistic-rollups",
      parentPlacementId: "scaling-modular-systems",
      order: 2,
    },
    { id: "zk-rollups", conceptId: "zk-rollups", parentPlacementId: "scaling-modular-systems", order: 3 },
    { id: "off-chain-scaling", conceptId: "off-chain-scaling", parentPlacementId: "scaling-modular-systems", order: 4 },
    { id: "modularity", conceptId: "modularity", parentPlacementId: "scaling-modular-systems", order: 5 },
    { id: "execution-layers", conceptId: "execution-layers", parentPlacementId: "scaling-modular-systems", order: 6 },
    { id: "settlement-layers", conceptId: "settlement-layers", parentPlacementId: "scaling-modular-systems", order: 7 },
    {
      id: "data-availability-layers",
      conceptId: "data-availability-layers",
      parentPlacementId: "scaling-modular-systems",
      order: 8,
    },
    { id: "consensus-layers", conceptId: "consensus-layers", parentPlacementId: "scaling-modular-systems", order: 9 },
    {
      id: "rollup-sequencing",
      conceptId: "rollup-sequencing",
      parentPlacementId: "scaling-modular-systems",
      order: 10,
    },
    {
      id: "batching-compression",
      conceptId: "batching-compression",
      parentPlacementId: "scaling-modular-systems",
      order: 11,
    },
    {
      id: "scaling-tradeoffs",
      conceptId: "scaling-tradeoffs",
      parentPlacementId: "scaling-modular-systems",
      order: 12,
    },
    { id: "rollup-security", conceptId: "rollup-security", parentPlacementId: "scaling-modular-systems", order: 13 },
    {
      id: "finality-in-rollups",
      conceptId: "finality",
      parentPlacementId: "rollups",
      order: 5,
      contextualNote: "Finality as a settlement property relevant to rollup systems.",
    },
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
