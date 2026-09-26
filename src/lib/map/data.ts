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
  // 21 Machine Economy
  "economic-agents": [
    "human-agents",
    "software-agents",
    { placementId: "ai-agent-in-economic-agents", conceptId: "ai-agent", contextualLabel: "AI Agents" },
    "organizations",
    { placementId: "protocols-in-economic-agents", conceptId: "protocols" },
    "hybrid-agents",
  ],
  "agent-ownership": [
    "human-ownership",
    "organizational-ownership",
    "shared-ownership",
    "protocol-ownership",
    "beneficial-ownership",
    "ownership-transfer",
  ],
  "agent-identity-in-machine-economy": [
    "persistent-identity",
    { placementId: "agent-credentials-in-agent-identity", conceptId: "agent-credentials", contextualLabel: "Credentials" },
    { placementId: "machine-authentication-in-agent-identity", conceptId: "machine-authentication", contextualLabel: "Authentication" },
    { placementId: "agent-reputation-in-agent-identity", conceptId: "agent-reputation", contextualLabel: "Reputation" },
    "identity-portability",
    "identity-recovery",
  ],
  "agent-wallets": [
    "agent-accounts",
    { placementId: "key-management-in-agent-wallets", conceptId: "key-management" },
    { placementId: "smart-accounts-in-agent-wallets", conceptId: "smart-accounts" },
    "session-authority",
    "spending-authority",
    { placementId: "wallet-recovery-in-agent-wallets", conceptId: "wallet-recovery" },
  ],
  "agent-capital": [
    { placementId: "assets-in-agent-capital", conceptId: "assets" },
    { placementId: "liquidity-in-agent-capital", conceptId: "liquidity" },
    "revenue",
    "capital-allocation",
    "working-capital",
    "capital-constraints",
  ],
  "agent-budgets": [
    "spending-limits",
    "allowances",
    "resource-budgets",
    "time-budgets",
    "budget-policies",
    "budget-enforcement",
  ],
  "agent-permissions": [
    { placementId: "capabilities-in-agent-permissions", conceptId: "capabilities" },
    { placementId: "delegation-in-agent-permissions", conceptId: "delegation" },
    { placementId: "permission-models-in-agent-permissions", conceptId: "permission-models" },
    "policy-constraints",
    { placementId: "revocation-in-agent-permissions", conceptId: "revocation" },
    { placementId: "authority-escalation", conceptId: "authority-escalation", contextualLabel: "Escalation" },
  ],
  "machine-payments": [
    "machine-to-machine-payments",
    "micropayments",
    "streaming-payments",
    "conditional-payments",
    { placementId: "payment-channels-in-machine-payments", conceptId: "payment-channels" },
    "automated-settlement",
  ],
  "machine-commerce": [
    "service-discovery",
    "price-discovery",
    "negotiation",
    "purchasing",
    "subscriptions",
    { placementId: "settlement-in-machine-commerce", conceptId: "settlement" },
  ],
  "agent-markets": [
    "compute-markets",
    "data-markets",
    "model-markets",
    "solver-markets",
    "service-markets",
    "information-markets",
  ],
  "agent-reputation-in-machine-economy": [
    "performance-history",
    { placementId: "attestations-in-agent-reputation", conceptId: "attestations" },
    "trust-scores",
    "reputation-portability",
    "reputation-decay",
    "reputation-attacks",
  ],
  "agent-credit": [
    "creditworthiness",
    "credit-limits",
    { placementId: "collateral-in-agent-credit", conceptId: "collateral" },
    "unsecured-credit",
    { placementId: "repayment-in-agent-credit", conceptId: "repayment" },
    { placementId: "credit-default", conceptId: "credit-default", contextualLabel: "Default" },
  ],
  "agent-risk": [
    "operational-risk",
    "financial-risk",
    { placementId: "counterparty-risk-in-agent-risk", conceptId: "counterparty-risk" },
    "policy-risk",
    "model-risk",
    "risk-limits",
  ],
  "agent-incentives": [
    { placementId: "agent-objectives", conceptId: "agent-objectives", contextualLabel: "Objectives" },
    { placementId: "rewards-in-agent-incentives", conceptId: "rewards" },
    { placementId: "penalties-in-agent-incentives", conceptId: "penalties" },
    { placementId: "incentive-alignment-in-agent-incentives", conceptId: "incentive-alignment" },
    "principal-agent-problems",
    { placementId: "incentive-compatibility-in-agent-incentives", conceptId: "incentive-compatibility" },
  ],
  // 22 Autonomous Coordination
  "agent-to-agent-communication": [
    "agent-messages",
    "message-protocols",
    "communication-semantics",
    "secure-communication",
    "message-routing",
    "communication-policies",
  ],
  "agent-discovery": [
    "agent-registries",
    "capability-discovery",
    { placementId: "service-discovery-in-agent-discovery", conceptId: "service-discovery" },
    "discovery-protocols",
    "matching",
    "discovery-trust",
  ],
  "negotiation-in-autonomous-coordination": [
    "offers",
    "counteroffers",
    "negotiation-constraints",
    "negotiation-strategies",
    { placementId: "negotiated-agreement", conceptId: "negotiated-agreement", contextualLabel: "Agreement" },
    "negotiation-failure",
  ],
  "delegation-in-autonomous-coordination": [
    "task-delegation",
    "authority-delegation",
    "delegation-constraints",
    "delegation-policies",
    "delegation-chains",
    { placementId: "revocation-in-delegation", conceptId: "revocation" },
  ],
  "cooperation-in-autonomous-coordination": [
    "shared-objectives",
    "task-sharing",
    "resource-sharing",
    "information-sharing",
    "benefit-sharing",
    "cooperative-strategies",
  ],
  "competition-in-autonomous-coordination": [
    "competitive-strategies",
    "bidding",
    { placementId: "competitive-selection", conceptId: "competitive-selection", contextualLabel: "Selection" },
    "rivalry",
    { placementId: "strategic-behavior-in-competition", conceptId: "strategic-behavior" },
    "competitive-equilibria",
  ],
  "coalition-formation": [
    "coalition-membership",
    "coalition-objectives",
    "coalition-rules",
    "coalition-incentives",
    "coalition-stability",
    "coalition-dissolution",
  ],
  "resource-allocation-in-autonomous-coordination": [
    "compute-allocation",
    { placementId: "capital-allocation-in-resource-allocation", conceptId: "capital-allocation" },
    "data-allocation",
    "service-allocation",
    "allocation-policies",
    "allocation-conflicts",
  ],
  "task-markets": [
    "task-publication",
    "task-discovery",
    "task-providers",
    "task-bidding",
    "task-assignment",
    "task-settlement",
  ],
  "multi-agent-coordination": [
    "shared-plans",
    "coordination-protocols",
    { placementId: "agent-synchronization", conceptId: "agent-synchronization", contextualLabel: "Synchronization" },
    "conflict-resolution",
    "collective-decision-making",
    "emergent-coordination",
  ],
  // 23 Autonomous Execution
  "objectives-intents": [
    { placementId: "goals-in-objectives-intents", conceptId: "goals" },
    "execution-requests",
    "objective-interpretation",
    "intent-generation",
    { placementId: "success-criteria-in-objectives-intents", conceptId: "success-criteria" },
    "execution-constraints",
  ],
  "execution-planning": [
    { placementId: "plans-in-execution-planning", conceptId: "plans" },
    "action-sequencing",
    "action-dependencies",
    "resource-estimation",
    "contingency-planning",
    { placementId: "replanning-in-execution-planning", conceptId: "replanning" },
  ],
  "action-selection": [
    "candidate-generation",
    "candidate-evaluation",
    "cost-estimation",
    { placementId: "tool-selection-in-action-selection", conceptId: "tool-selection" },
    { placementId: "execution-routing-in-action-selection", conceptId: "execution-routing" },
    "execution-optimization",
  ],
  simulation: [
    { placementId: "transaction-simulation-in-simulation", conceptId: "transaction-simulation" },
    "state-forking",
    "dry-runs",
    "outcome-prediction",
    "simulation-fidelity",
    "simulation-divergence",
  ],
  "execution-policies": [
    { placementId: "policy-constraints-in-execution-policies", conceptId: "policy-constraints" },
    "policy-evaluation",
    "policy-engines",
    "policy-enforcement",
    "policy-violations",
    "risk-checks",
  ],
  "execution-authorization": [
    { placementId: "authorization-in-execution-authorization", conceptId: "authorization", contextualLabel: "Runtime Authorization" },
    { placementId: "capabilities-in-execution-authorization", conceptId: "capabilities" },
    "human-approval",
    { placementId: "action-approval-thresholds", conceptId: "action-approval-thresholds", contextualLabel: "Approval Thresholds" },
    "multi-party-approval",
    "authorization-scopes",
  ],
  "execution-environments": [
    "sandboxing",
    "execution-isolation",
    { placementId: "trusted-execution-in-execution-environments", conceptId: "trusted-execution" },
    "tool-permissions",
    "environment-access",
    "ephemeral-environments",
  ],
  "action-execution": [
    { placementId: "agent-actions-in-action-execution", conceptId: "agent-actions" },
    { placementId: "tool-calling-in-action-execution", conceptId: "tool-calling" },
    { placementId: "transaction-construction-in-action-execution", conceptId: "transaction-construction" },
    { placementId: "transaction-submission-in-action-execution", conceptId: "transaction-submission" },
    "partial-execution",
    "idempotency",
  ],
  "verification-settlement": [
    "outcome-verification",
    "postconditions",
    "execution-receipts",
    { placementId: "verifiable-execution-in-verification-settlement", conceptId: "verifiable-execution" },
    { placementId: "settlement-in-verification-settlement", conceptId: "settlement" },
    "execution-disputes",
  ],
  "execution-monitoring": [
    "progress-tracking",
    { placementId: "observability-in-execution-monitoring", conceptId: "observability" },
    "audit-trails",
    { placementId: "anomaly-detection-in-execution-monitoring", conceptId: "anomaly-detection" },
    { placementId: "alerting-in-execution-monitoring", conceptId: "alerting" },
    { placementId: "human-oversight-in-execution-monitoring", conceptId: "human-oversight" },
  ],
  "execution-recovery": [
    "execution-failures",
    "retries",
    "rollbacks",
    "compensating-actions",
    { placementId: "circuit-breakers-in-execution-recovery", conceptId: "circuit-breakers" },
    "kill-switches",
  ],
  // 24 Autonomous Organizations
  "organizations-in-autonomous-organizations": [
    "decentralized-autonomous-organizations",
    "organizational-identity",
    "organizational-objectives",
    "organizational-boundaries",
    "legal-wrappers",
  ],
  "organizational-membership": [
    "membership-criteria",
    "member-admission",
    "membership-rights",
    "membership-obligations",
    "membership-tokens",
    "member-exit",
  ],
  "roles-authority": [
    { placementId: "roles-in-roles-authority", conceptId: "roles" },
    "role-assignment",
    "role-hierarchies",
    { placementId: "mandates-in-roles-authority", conceptId: "mandates" },
    { placementId: "authority-boundaries-in-roles-authority", conceptId: "authority-boundaries" },
    { placementId: "separation-of-powers-in-roles-authority", conceptId: "separation-of-powers" },
  ],
  "organizational-structure": [
    "hierarchical-structures",
    "flat-structures",
    "sub-organizations",
    { placementId: "working-groups-in-organizational-structure", conceptId: "working-groups" },
    { placementId: "councils-committees-in-organizational-structure", conceptId: "councils-committees" },
    "reporting-lines",
  ],
  "organizational-governance": [
    { placementId: "governance-models-in-organizational-governance", conceptId: "governance-models" },
    { placementId: "constitutions-in-organizational-governance", conceptId: "constitutions" },
    { placementId: "proposals-in-organizational-governance", conceptId: "proposals" },
    { placementId: "voting-in-organizational-governance", conceptId: "voting" },
    { placementId: "decision-rules-in-organizational-governance", conceptId: "decision-rules" },
    "hybrid-governance",
  ],
  "organizational-decision-making": [
    "decision-rights",
    { placementId: "collective-decision-making-in-organizational-decision-making", conceptId: "collective-decision-making" },
    "automated-decisions",
    { placementId: "authority-escalation-in-organizational-decision-making", conceptId: "authority-escalation", contextualLabel: "Escalation" },
    { placementId: "veto-rights-in-organizational-decision-making", conceptId: "veto-rights" },
    "decision-records",
  ],
  "organizational-policies": [
    "policy-setting",
    "policy-hierarchies",
    { placementId: "policy-constraints-in-organizational-policies", conceptId: "policy-constraints" },
    { placementId: "spending-controls-in-organizational-policies", conceptId: "spending-controls" },
    "organizational-compliance",
    "policy-updates",
  ],
  "treasuries-in-autonomous-organizations": [
    { placementId: "treasury-management-in-treasuries-in-autonomous-organizations", conceptId: "treasury-management" },
    "treasury-custody",
    { placementId: "revenue-in-treasuries-in-autonomous-organizations", conceptId: "revenue" },
    "runway",
    "treasury-diversification",
    { placementId: "capital-allocation-in-treasuries-in-autonomous-organizations", conceptId: "capital-allocation" },
  ],
  "organizational-budgeting": [
    "budget-cycles",
    { placementId: "budget-allocation-in-organizational-budgeting", conceptId: "budget-allocation" },
    { placementId: "resource-allocation-in-organizational-budgeting", conceptId: "resource-allocation" },
    { placementId: "grants-in-organizational-budgeting", conceptId: "grants" },
    "contributor-compensation",
    "spending-approvals",
  ],
  "organizational-workflows": [
    "workflow-definitions",
    { placementId: "task-assignment-in-organizational-workflows", conceptId: "task-assignment" },
    "approval-workflows",
    "handoffs",
    "workflow-automation",
    "service-level-agreements",
  ],
  "autonomous-operations": [
    "organizational-autonomy",
    "agent-workforces",
    "operating-procedures",
    { placementId: "human-oversight-in-autonomous-operations", conceptId: "human-oversight" },
    "organizational-performance",
  ],
  "accountability-auditability": [
    { placementId: "accountability-in-accountability-auditability", conceptId: "accountability" },
    "responsibility-attribution",
    { placementId: "audit-trails-in-accountability-auditability", conceptId: "audit-trails" },
    "auditability",
    { placementId: "transparency-in-accountability-auditability", conceptId: "transparency" },
    "liability",
  ],
  "disputes-emergency-controls": [
    { placementId: "dispute-resolution-in-disputes-emergency-controls", conceptId: "dispute-resolution" },
    { placementId: "conflict-resolution-in-disputes-emergency-controls", conceptId: "conflict-resolution" },
    { placementId: "emergency-powers-in-disputes-emergency-controls", conceptId: "emergency-powers" },
    { placementId: "pause-mechanisms-in-disputes-emergency-controls", conceptId: "pause-mechanisms" },
    { placementId: "guardians-in-disputes-emergency-controls", conceptId: "guardians" },
    { placementId: "incident-response-in-disputes-emergency-controls", conceptId: "incident-response" },
  ],
  "organizational-lifecycle": [
    "organization-formation",
    "organizational-bootstrapping",
    "restructuring",
    "organizational-mergers",
    "succession",
    "organizational-dissolution",
  ],
  "inter-organizational-coordination": [
    "organizational-alliances",
    "federations",
    { placementId: "negotiated-agreement-in-inter-organizational-coordination", conceptId: "negotiated-agreement" },
    "joint-ventures",
    "shared-services",
    "cross-organizational-governance",
  ],
  // 25 Autonomous Protocols
  "protocol-autonomy": [
    "bounded-autonomy",
    "protocol-autonomy-levels",
    "self-management",
    { placementId: "invariants-in-protocol-autonomy", conceptId: "invariants", contextualLabel: "Protocol Invariants" },
    { placementId: "governance-minimization-in-protocol-autonomy", conceptId: "governance-minimization" },
  ],
  "protocol-objectives": [
    "objective-functions",
    "setpoints",
    "protocol-health",
    "objective-trade-offs",
    "objective-drift",
  ],
  "protocol-monitoring": [
    { placementId: "protocol-state-in-protocol-monitoring", conceptId: "protocol-state" },
    "protocol-telemetry",
    "state-estimation",
    { placementId: "condition-monitoring-in-protocol-monitoring", conceptId: "condition-monitoring" },
    "invariant-monitoring",
    { placementId: "anomaly-detection-in-protocol-monitoring", conceptId: "anomaly-detection" },
  ],
  "control-loops": [
    "feedback-loops",
    "feedback-controllers",
    "pid-control",
    { placementId: "triggers-in-control-loops", conceptId: "triggers" },
    "control-stability",
    "control-latency",
  ],
  "adaptive-parameters": [
    "adjustment-rules",
    { placementId: "parameter-bounds-in-adaptive-parameters", conceptId: "parameter-bounds" },
    "adjustment-rate-limits",
    "dynamic-fees",
    "adaptive-interest-rates",
    "parameter-sensitivity",
  ],
  "protocol-policies": [
    "policy-driven-operation",
    "operating-envelopes",
    { placementId: "policy-constraints-in-protocol-policies", conceptId: "policy-constraints" },
    { placementId: "policy-evaluation-in-protocol-policies", conceptId: "policy-evaluation" },
    "response-policies",
    { placementId: "authority-escalation-in-protocol-policies", conceptId: "authority-escalation", contextualLabel: "Escalation" },
  ],
  "protocol-agents": [
    "on-chain-agents",
    "ai-operated-protocols",
    { placementId: "automation-networks-in-protocol-agents", conceptId: "automation-networks" },
    { placementId: "execution-bots-in-protocol-agents", conceptId: "execution-bots" },
    { placementId: "off-chain-workers-in-protocol-agents", conceptId: "off-chain-workers" },
  ],
  "protocol-maintenance": [
    "maintenance-tasks",
    { placementId: "keepers-in-protocol-maintenance", conceptId: "keepers" },
    { placementId: "keeper-incentives-in-protocol-maintenance", conceptId: "keeper-incentives" },
    { placementId: "scheduled-execution-in-protocol-maintenance", conceptId: "scheduled-execution" },
    "state-cleanup",
    "dependency-management",
  ],
  "protocol-adaptation": [
    "adaptive-mechanisms",
    "regime-detection",
    "mode-switching",
    "learning-mechanisms",
    "adaptation-limits",
    "adaptation-evaluation",
  ],
  "self-healing": [
    "fault-detection",
    "automatic-failover",
    { placementId: "graceful-degradation-in-self-healing", conceptId: "graceful-degradation" },
    "recovery-modes",
    "state-repair",
    { placementId: "fault-tolerance-in-self-healing", conceptId: "fault-tolerance" },
  ],
  "autonomous-security-responses": [
    "exploit-detection",
    { placementId: "containment-in-autonomous-security-responses", conceptId: "containment", contextualLabel: "Automated Containment" },
    { placementId: "circuit-breakers-in-autonomous-security-responses", conceptId: "circuit-breakers" },
    { placementId: "pause-mechanisms-in-autonomous-security-responses", conceptId: "pause-mechanisms" },
    "outflow-limits",
    { placementId: "incident-response-in-autonomous-security-responses", conceptId: "incident-response" },
  ],
  "protocol-owned-resources": [
    "protocol-owned-liquidity",
    { placementId: "reserves-in-protocol-owned-resources", conceptId: "reserves" },
    "insurance-funds",
    { placementId: "revenue-in-protocol-owned-resources", conceptId: "revenue" },
    "buybacks",
    { placementId: "resource-allocation-in-protocol-owned-resources", conceptId: "resource-allocation" },
  ],
  "autonomous-liquidity-management": [
    "liquidity-targets",
    { placementId: "rebalancing-in-autonomous-liquidity-management", conceptId: "rebalancing", contextualLabel: "Liquidity Rebalancing" },
    "liquidity-range-management",
    "liquidity-incentive-adjustment",
    "peg-defense",
    { placementId: "liquidity-provision-in-autonomous-liquidity-management", conceptId: "liquidity-provision" },
  ],
  "autonomous-risk-management": [
    "risk-models",
    { placementId: "risk-parameters-in-autonomous-risk-management", conceptId: "risk-parameters" },
    "dynamic-risk-parameters",
    { placementId: "risk-limits-in-autonomous-risk-management", conceptId: "risk-limits" },
    "stress-testing",
    "automated-deleveraging",
  ],
  "governance-human-override": [
    "automatic-enactment",
    { placementId: "proposal-execution-in-governance-human-override", conceptId: "proposal-execution" },
    { placementId: "parameter-changes-in-governance-human-override", conceptId: "parameter-changes" },
    { placementId: "human-oversight-in-governance-human-override", conceptId: "human-oversight" },
    "override-mechanisms",
    { placementId: "kill-switches-in-governance-human-override", conceptId: "kill-switches" },
  ],
  "verifiable-autonomous-operation": [
    { placementId: "verifiable-execution-in-verifiable-autonomous-operation", conceptId: "verifiable-execution" },
    "operation-proofs",
    "invariant-verification",
    { placementId: "audit-trails-in-verifiable-autonomous-operation", conceptId: "audit-trails" },
    { placementId: "decision-records-in-verifiable-autonomous-operation", conceptId: "decision-records" },
    { placementId: "transparency-in-verifiable-autonomous-operation", conceptId: "transparency" },
  ],
  "protocol-lifecycle-automation": [
    { placementId: "protocol-bootstrapping-in-protocol-lifecycle-automation", conceptId: "protocol-bootstrapping" },
    { placementId: "progressive-decentralization-in-protocol-lifecycle-automation", conceptId: "progressive-decentralization" },
    "automated-upgrades",
    { placementId: "protocol-upgrades-in-protocol-lifecycle-automation", conceptId: "protocol-upgrades" },
    { placementId: "ossification-in-protocol-lifecycle-automation", conceptId: "ossification" },
    { placementId: "protocol-sunsetting-in-protocol-lifecycle-automation", conceptId: "protocol-sunsetting" },
  ],
  // 26 Autonomous Economy
  "autonomous-economic-actors": [
    "economic-agency",
    { placementId: "economic-agents-in-autonomous-economic-actors", conceptId: "economic-agents" },
    "actor-populations",
    "actor-heterogeneity",
    "actor-specialization",
    "actor-entry-exit",
  ],
  "autonomous-ownership-structures": [
    "machine-owned-assets",
    "ownership-chains",
    { placementId: "protocol-owned-resources-in-autonomous-ownership-structures", conceptId: "protocol-owned-resources" },
    { placementId: "organizational-ownership-in-autonomous-ownership-structures", conceptId: "organizational-ownership" },
    { placementId: "beneficial-ownership-in-autonomous-ownership-structures", conceptId: "beneficial-ownership" },
    "ownership-concentration",
  ],
  "autonomous-markets": [
    "market-formation",
    "autonomous-supply-demand",
    "autonomous-pricing",
    { placementId: "price-discovery-in-autonomous-markets", conceptId: "price-discovery" },
    "market-clearing",
    "autonomous-market-making",
  ],
  "autonomous-commerce": [
    "autonomous-contracting",
    "contract-enforcement",
    { placementId: "machine-commerce-in-autonomous-commerce", conceptId: "machine-commerce" },
    "autonomous-supply-chains",
    "commerce-networks",
    { placementId: "settlement-in-autonomous-commerce", conceptId: "settlement" },
  ],
  "autonomous-production": [
    "autonomous-services",
    "service-composition",
    "value-chains",
    "production-coordination",
    { placementId: "task-markets-in-autonomous-production", conceptId: "task-markets" },
    "machine-productivity",
  ],
  "economic-sectors": [
    "agent-economies",
    "protocol-economies",
    "inter-protocol-economies",
    "data-economies",
    "compute-economies",
    "model-economies",
    "solver-economies",
  ],
  "capital-payment-flows": [
    "capital-flows",
    "payment-flows",
    "liquidity-networks",
    "systemic-liquidity",
    { placementId: "liquidity-fragmentation-in-capital-payment-flows", conceptId: "liquidity-fragmentation" },
    "capital-mobility",
  ],
  "economy-wide-allocation": [
    "autonomous-capital-allocation",
    "economy-wide-resource-allocation",
    "capital-formation",
    { placementId: "allocation-efficiency-in-economy-wide-allocation", conceptId: "allocation-efficiency" },
    { placementId: "public-goods-funding-in-economy-wide-allocation", conceptId: "public-goods-funding" },
  ],
  "autonomous-credit-systems": [
    "credit-networks",
    "credit-creation",
    { placementId: "agent-credit-in-autonomous-credit-systems", conceptId: "agent-credit" },
    { placementId: "lending-markets-in-autonomous-credit-systems", conceptId: "lending-markets" },
    { placementId: "creditworthiness-in-autonomous-credit-systems", conceptId: "creditworthiness" },
    "systemic-leverage",
  ],
  "monetary-systems": [
    "machine-money",
    "unit-of-account",
    { placementId: "stablecoins-in-monetary-systems", conceptId: "stablecoins" },
    "money-supply",
    "money-velocity",
    "monetary-policy",
  ],
  "economic-institutions": [
    { placementId: "institutions-in-economic-institutions", conceptId: "institutions" },
    "property-rights",
    "reputation-systems",
    "trust-infrastructure",
    { placementId: "credible-neutrality-in-economic-institutions", conceptId: "credible-neutrality" },
    { placementId: "dispute-resolution-in-economic-institutions", conceptId: "dispute-resolution" },
  ],
  "economic-governance": [
    "economic-policy",
    { placementId: "incentives-in-economic-governance", conceptId: "incentives" },
    { placementId: "fees-in-economic-governance", conceptId: "fees" },
    "taxation",
    "rent-extraction",
    "redistribution",
  ],
  "market-power": [
    { placementId: "competition-in-market-power", conceptId: "competition" },
    "market-concentration",
    "network-effects",
    "barriers-to-entry",
    { placementId: "collusion-in-market-power", conceptId: "collusion" },
    "algorithmic-collusion",
  ],
  "economic-stability": [
    { placementId: "systemic-risk-in-economic-stability", conceptId: "systemic-risk" },
    "contagion",
    "economic-shocks",
    "procyclicality",
    "flash-crashes",
    "automatic-stabilizers",
  ],
  "economic-resilience": [
    "shock-absorption",
    "economic-diversification",
    "backstops",
    { placementId: "circuit-breakers-in-economic-resilience", conceptId: "circuit-breakers" },
    { placementId: "stress-testing-in-economic-resilience", conceptId: "stress-testing" },
    "economic-recovery",
  ],
  "economic-dynamics": [
    "economic-feedback-loops",
    "emergent-economic-behavior",
    { placementId: "competitive-equilibria-in-economic-dynamics", conceptId: "competitive-equilibria" },
    "market-cycles",
    "economic-growth",
    "economic-adaptation",
  ],
  "human-machine-economic-interaction": [
    { placementId: "principals-in-human-machine-economic-interaction", conceptId: "principals" },
    { placementId: "human-oversight-in-human-machine-economic-interaction", conceptId: "human-oversight" },
    "labor-substitution",
    "economic-alignment",
    "consumer-protection",
    "value-distribution",
  ],
  // 27 Frontier Systems
  "machine-native-ownership": [
    "self-owning-agents",
    "self-sovereign-machines",
    "programmable-ownership",
    "machine-native-property",
    { placementId: "economic-agency-in-machine-native-ownership", conceptId: "economic-agency" },
  ],
  "autonomous-legal-entities": [
    "agent-legal-personhood",
    "algorithmic-entities",
    "autonomous-liability",
    "machine-legal-contracting",
    { placementId: "legal-wrappers-in-autonomous-legal-entities", conceptId: "legal-wrappers" },
  ],
  "machine-native-monetary-systems": [
    "machine-native-money",
    "agent-issued-currencies",
    "compute-backed-money",
    "autonomous-monetary-authorities",
    "autonomous-capital-formation",
    { placementId: "monetary-systems-in-machine-native-monetary-systems", conceptId: "monetary-systems" },
  ],
  "programmable-law": [
    "machine-executable-law",
    "computable-contracts",
    "automated-regulation",
    "embedded-compliance",
    "legal-oracles",
    "code-as-law",
  ],
  "machine-constitutions": [
    { placementId: "constitutions-in-machine-constitutions", conceptId: "constitutions" },
    "agent-constitutions",
    "adaptive-constitutions",
    "machine-enforced-constitutions",
    "constitutional-verification",
  ],
  "synthetic-institutions": [
    { placementId: "institutions-in-synthetic-institutions", conceptId: "institutions" },
    "agent-native-institutions",
    "programmable-institutions",
    "emergent-institutions",
    "machine-arbitration",
    "institutional-composability",
  ],
  "ai-mediated-governance": [
    "ai-delegates",
    "verifiable-governance-agents",
    "ai-deliberation",
    "ai-preference-aggregation",
    "governance-simulation",
    { placementId: "human-oversight-in-ai-mediated-governance", conceptId: "human-oversight" },
  ],
  "digital-polities": [
    "autonomous-jurisdictions",
    "network-states",
    "protocol-native-societies",
    "digital-citizenship",
    "digital-sovereignty",
    { placementId: "exit-rights-in-digital-polities", conceptId: "exit-rights" },
  ],
  "agent-societies": [
    "open-agent-societies",
    "mixed-human-machine-societies",
    "agent-social-norms",
    "emergent-conventions",
    "planetary-scale-coordination",
    { placementId: "collective-decision-making-in-agent-societies", conceptId: "collective-decision-making" },
  ],
  "machine-mediated-commons": [
    "commons-governance",
    "autonomous-public-goods",
    "commons-stewards",
    "commons-dilemmas",
    { placementId: "public-goods-funding-in-machine-mediated-commons", conceptId: "public-goods-funding" },
  ],
  "recursive-autonomy": [
    "recursive-organizations",
    "recursively-autonomous-systems",
    "agent-spawning",
    "nested-autonomy",
    "recursion-limits",
  ],
  "self-modifying-systems": [
    "self-modifying-protocols",
    "self-improving-agents",
    "self-improving-protocols",
    "self-modification-safeguards",
    "verifiable-self-modification",
    { placementId: "corrigibility-in-self-modifying-systems", conceptId: "corrigibility" },
  ],
  "protocol-ecologies": [
    "evolutionary-protocols",
    "protocol-selection-pressure",
    "multi-protocol-ecosystems",
    "protocol-symbiosis",
    "ecosystem-dynamics",
  ],
  "autonomous-infrastructure": [
    "decentralized-ai-infrastructure",
    "verifiable-agent-networks",
    { placementId: "verifiable-agents-in-autonomous-infrastructure", conceptId: "verifiable-agents" },
    "self-provisioning-infrastructure",
    "self-maintaining-infrastructure",
  ],
  "cyber-physical-autonomous-systems": [
    "autonomous-robotics",
    "autonomous-fleets",
    "physical-actuation",
    { placementId: "cyber-physical-interfaces-in-cyber-physical-autonomous-systems", conceptId: "cyber-physical-interfaces" },
    "decentralized-physical-infrastructure",
    "physical-safety-constraints",
  ],
  "autonomous-science-systems": [
    "autonomous-research-agents",
    "automated-experimentation",
    "self-driving-laboratories",
    "machine-discovery",
    "verifiable-research",
    "open-science-protocols",
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
 * Resilience, Protocol Architecture, Protocol Design & Lifecycle, AI &
 * Intelligent Systems, Machine Economy, Autonomous Coordination, Autonomous
 * Execution, Autonomous Organizations, Autonomous Protocols, Autonomous
 * Economy, and Frontier Systems; and a deliberately small Phase 1 proof
 * fixture re-homed beneath its L0 domains.
 */
export const mapKnowledge: MapKnowledgeModel = {
  concepts: [
    ...l0Concepts,
    // Foundations' conceptual layer (Distributed Systems is shared with the fixture).
    // Also placed under 21's Economic Agents (protocols as economic actors); preferred here.
    { id: "protocols", slug: "protocols", title: "Protocols", preferredPlacementId: "protocols" },
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
    // Cooperation and Competition are also 22 Autonomous Coordination's L1
    // topics, each with its own layer; preferred there.
    {
      id: "cooperation",
      slug: "cooperation",
      title: "Cooperation",
      preferredPlacementId: "cooperation-in-autonomous-coordination",
    },
    {
      id: "competition",
      slug: "competition",
      title: "Competition",
      preferredPlacementId: "competition-in-autonomous-coordination",
    },
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
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "off-chain-workers", slug: "off-chain-workers", title: "Off-Chain Workers", preferredPlacementId: "off-chain-workers" },
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
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "protocol-state", slug: "protocol-state", title: "Protocol State", preferredPlacementId: "protocol-state" },
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
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "keepers", slug: "keepers", title: "Keepers", preferredPlacementId: "keepers" },
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
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "condition-monitoring", slug: "condition-monitoring", title: "Condition Monitoring", preferredPlacementId: "condition-monitoring" },
    { id: "trigger-evaluation", slug: "trigger-evaluation", title: "Trigger Evaluation" },
    // Also placed under 08's Wallets; this placement is preferred.
    {
      id: "transaction-submission",
      slug: "transaction-submission",
      title: "Transaction Submission",
      preferredPlacementId: "transaction-submission",
    },
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "keeper-incentives", slug: "keeper-incentives", title: "Keeper Incentives", preferredPlacementId: "keeper-incentives" },
    { id: "event-driven-bots", slug: "event-driven-bots", title: "Event-Driven Bots" },
    { id: "trading-bots", slug: "trading-bots", title: "Trading Bots" },
    { id: "liquidation-bots", slug: "liquidation-bots", title: "Liquidation Bots" },
    { id: "arbitrage-bots", slug: "arbitrage-bots", title: "Arbitrage Bots" },
    { id: "governance-bots", slug: "governance-bots", title: "Governance Bots" },
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "execution-bots", slug: "execution-bots", title: "Execution Bots", preferredPlacementId: "execution-bots" },
    { id: "metrics", slug: "metrics", title: "Metrics" },
    // Observability data, shown as "Logs" and "Traces" under Monitoring: not
    // 03's Logs (EVM receipt logs) or 02's Execution Traces.
    { id: "system-logs", slug: "system-logs", title: "System Logs" },
    { id: "distributed-traces", slug: "distributed-traces", title: "Distributed Traces" },
    { id: "health-checks", slug: "health-checks", title: "Health Checks" },
    // Also placed in 17 Security, Correctness & Resilience and under 23 Autonomous
    // Execution; this placement is preferred.
    { id: "alerting", slug: "alerting", title: "Alerting", preferredPlacementId: "alerting" },
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "observability", slug: "observability", title: "Observability", preferredPlacementId: "observability" },
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "triggers", slug: "triggers", title: "Triggers", preferredPlacementId: "triggers" },
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "scheduled-execution", slug: "scheduled-execution", title: "Scheduled Execution", preferredPlacementId: "scheduled-execution" },
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
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "verifiable-execution", slug: "verifiable-execution", title: "Verifiable Execution", preferredPlacementId: "verifiable-execution" },
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
    // Also placed under 21's Agent Wallets; this placement is preferred.
    { id: "smart-accounts", slug: "smart-accounts", title: "Smart Accounts", preferredPlacementId: "smart-accounts" },
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
    // Also placed under 21's Agent Wallets; this placement is preferred.
    { id: "key-management", slug: "key-management", title: "Key Management", preferredPlacementId: "key-management" },
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "transaction-construction", slug: "transaction-construction", title: "Transaction Construction", preferredPlacementId: "transaction-construction" },
    // Also placed under 21's Agent Wallets; this placement is preferred.
    { id: "wallet-recovery", slug: "wallet-recovery", title: "Wallet Recovery", preferredPlacementId: "wallet-recovery" },
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
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "roles", slug: "roles", title: "Roles", preferredPlacementId: "roles" },
    // Also placed under 21's Agent Permissions; this placement is preferred.
    { id: "capabilities", slug: "capabilities", title: "Capabilities", preferredPlacementId: "capabilities" },
    // One party entrusting another to act on its behalf. Also placed under 13's
    // Intents, 14's Representation, 20's AI Agents and 21's Agent Permissions,
    // and 22 Autonomous Coordination's L1 topic with its own layer (Task and
    // Authority Delegation are its narrower kinds); preferred there.
    {
      id: "delegation",
      slug: "delegation",
      title: "Delegation",
      preferredPlacementId: "delegation-in-autonomous-coordination",
    },
    // Also placed in 17 Security, Correctness & Resilience and under 21's Agent
    // Permissions and under 21's Agent Permissions; this placement is preferred.
    {
      id: "permission-models",
      slug: "permission-models",
      title: "Permission Models",
      preferredPlacementId: "permission-models",
    },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "authority-boundaries", slug: "authority-boundaries", title: "Authority Boundaries", preferredPlacementId: "authority-boundaries" },
    // Agent and machine subjects are taught as their own topics, like the
    // fixture's Agent Identity; merging them into the general concepts would put
    // two rows of one concept side by side under Machine Identity.
    // Also placed as 21's "Credentials" under Agent Identity; this placement is preferred.
    { id: "agent-credentials", slug: "agent-credentials", title: "Agent Credentials", preferredPlacementId: "agent-credentials" },
    // Also 21 Machine Economy's L1 topic, with its own layer, and its "Reputation"
    // under Agent Identity; the L1 placement is preferred.
    {
      id: "agent-reputation",
      slug: "agent-reputation",
      title: "Agent Reputation",
      preferredPlacementId: "agent-reputation-in-machine-economy",
    },
    { id: "agent-authorization", slug: "agent-authorization", title: "Agent Authorization" },
    { id: "machine-credentials", slug: "machine-credentials", title: "Machine Credentials" },
    // Also placed as 21's "Authentication" under Agent Identity; this placement is preferred.
    { id: "machine-authentication", slug: "machine-authentication", title: "Machine Authentication", preferredPlacementId: "machine-authentication" },
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
    // Also placed under 27 Frontier Systems; this placement is preferred.
    { id: "cyber-physical-interfaces", slug: "cyber-physical-interfaces", title: "Cyber-Physical Interfaces", preferredPlacementId: "cyber-physical-interfaces" },
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
    // Withdrawing something issued or granted before it expires; also under 21's
    // Agent Permissions and 22's Delegation. Preferred here.
    { id: "revocation", slug: "revocation", title: "Revocation", preferredPlacementId: "revocation" },
    // 10 Economics & Mechanism Design: L1 topics (Strategic Behavior is
    // Foundations' concept). Incentives, Mechanism Design, Game Theory, Fees and
    // Auctions are general concepts for reuse by later domains; Cryptoeconomic
    // Security (the approach) is not its L2 Economic Security (the measure).
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "incentives", slug: "incentives", title: "Incentives", preferredPlacementId: "incentives" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    {
      id: "mechanism-design",
      slug: "mechanism-design",
      title: "Mechanism Design",
      preferredPlacementId: "mechanism-design",
    },
    { id: "game-theory", slug: "game-theory", title: "Game Theory" },
    { id: "token-economics", slug: "token-economics", title: "Token Economics" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "fees", slug: "fees", title: "Fees", preferredPlacementId: "fees" },
    { id: "auctions", slug: "auctions", title: "Auctions" },
    // Also 22 Autonomous Coordination's L1 topic, allocating among agents, with
    // its own layer; this placement is preferred.
    { id: "resource-allocation", slug: "resource-allocation", title: "Resource Allocation", preferredPlacementId: "resource-allocation" },
    { id: "staking-economics", slug: "staking-economics", title: "Staking Economics" },
    { id: "security-budgets", slug: "security-budgets", title: "Security Budgets" },
    { id: "cryptoeconomic-security", slug: "cryptoeconomic-security", title: "Cryptoeconomic Security" },
    // L2 topics (placements in L2_TOPICS). Negative Incentives are any
    // discouragement; Penalties are explicit punishment, also placed as
    // "Economic Penalties" under Cryptoeconomic Security.
    // Also placed under 14's Institutional Design and 21's Agent Incentives; this
    // placement is preferred.
    { id: "incentive-alignment", slug: "incentive-alignment", title: "Incentive Alignment", preferredPlacementId: "incentive-alignment" },
    { id: "positive-incentives", slug: "positive-incentives", title: "Positive Incentives" },
    { id: "negative-incentives", slug: "negative-incentives", title: "Negative Incentives" },
    // Also placed under 21's Agent Incentives; this placement is preferred.
    { id: "rewards", slug: "rewards", title: "Rewards", preferredPlacementId: "rewards" },
    { id: "penalties", slug: "penalties", title: "Penalties", preferredPlacementId: "penalties" },
    // Also placed under 21's Agent Incentives; this placement is preferred.
    { id: "incentive-compatibility", slug: "incentive-compatibility", title: "Incentive Compatibility", preferredPlacementId: "incentive-compatibility" },
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
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "allocation-efficiency", slug: "allocation-efficiency", title: "Allocation Efficiency", preferredPlacementId: "allocation-efficiency" },
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
    // Also placed under 21's Agent Capital; this placement is preferred.
    { id: "assets", slug: "assets", title: "Assets", preferredPlacementId: "assets" },
    { id: "markets", slug: "markets", title: "Markets" },
    // Also placed under 21's Agent Capital; this placement is preferred.
    { id: "liquidity", slug: "liquidity", title: "Liquidity", preferredPlacementId: "liquidity" },
    { id: "automated-market-makers", slug: "automated-market-makers", title: "Automated Market Makers" },
    { id: "order-books", slug: "order-books", title: "Order Books" },
    { id: "lending-borrowing", slug: "lending-borrowing", title: "Lending & Borrowing" },
    // Also placed under 21's Agent Credit; this placement is preferred.
    { id: "collateral", slug: "collateral", title: "Collateral", preferredPlacementId: "collateral" },
    { id: "liquidations", slug: "liquidations", title: "Liquidations" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "stablecoins", slug: "stablecoins", title: "Stablecoins", preferredPlacementId: "stablecoins" },
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
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "liquidity-provision", slug: "liquidity-provision", title: "Liquidity Provision", preferredPlacementId: "liquidity-provision" },
    { id: "liquidity-depth", slug: "liquidity-depth", title: "Liquidity Depth" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "liquidity-fragmentation", slug: "liquidity-fragmentation", title: "Liquidity Fragmentation", preferredPlacementId: "liquidity-fragmentation" },
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
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "lending-markets", slug: "lending-markets", title: "Lending Markets", preferredPlacementId: "lending-markets" },
    { id: "borrowers", slug: "borrowers", title: "Borrowers" },
    { id: "lenders", slug: "lenders", title: "Lenders" },
    { id: "interest-rates", slug: "interest-rates", title: "Interest Rates" },
    { id: "utilization", slug: "utilization", title: "Utilization" },
    // Also placed under 21's Agent Credit; this placement is preferred.
    { id: "repayment", slug: "repayment", title: "Repayment", preferredPlacementId: "repayment" },
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
    // Also placed under 21's Agent Risk; this placement is preferred.
    { id: "counterparty-risk", slug: "counterparty-risk", title: "Counterparty Risk", preferredPlacementId: "counterparty-risk" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "systemic-risk", slug: "systemic-risk", title: "Systemic Risk", preferredPlacementId: "systemic-risk" },
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "risk-parameters", slug: "risk-parameters", title: "Risk Parameters", preferredPlacementId: "risk-parameters" },
    // Assets and Liabilities is the balance-sheet view, not Assets; Solvency
    // Constraints are not 10's Mechanism Constraints.
    { id: "assets-and-liabilities", slug: "assets-and-liabilities", title: "Assets and Liabilities" },
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "reserves", slug: "reserves", title: "Reserves", preferredPlacementId: "reserves" },
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
    // Also placed under 23's Simulation; this placement is preferred.
    { id: "transaction-simulation", slug: "transaction-simulation", title: "Transaction Simulation", preferredPlacementId: "transaction-simulation" },
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
    // Routing (RPC). Also placed under 23's Action Selection; this placement is preferred.
    { id: "execution-routing", slug: "execution-routing", title: "Execution Routing", preferredPlacementId: "execution-routing" },
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
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "governance-models", slug: "governance-models", title: "Governance Models", preferredPlacementId: "governance-models" },
    { id: "governance-participants", slug: "governance-participants", title: "Governance Participants" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "proposals", slug: "proposals", title: "Proposals", preferredPlacementId: "proposals" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "voting", slug: "voting", title: "Voting", preferredPlacementId: "voting" },
    { id: "representation", slug: "representation", title: "Representation" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "decision-rules", slug: "decision-rules", title: "Decision Rules", preferredPlacementId: "decision-rules" },
    { id: "governance-execution", slug: "governance-execution", title: "Governance Execution" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "councils-committees", slug: "councils-committees", title: "Councils & Committees", preferredPlacementId: "councils-committees" },
    { id: "treasury-governance", slug: "treasury-governance", title: "Treasury Governance" },
    { id: "constitutional-rules", slug: "constitutional-rules", title: "Constitutional Rules" },
    { id: "checks-balances", slug: "checks-balances", title: "Checks & Balances" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "dispute-resolution", slug: "dispute-resolution", title: "Dispute Resolution", preferredPlacementId: "dispute-resolution" },
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
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "governance-minimization", slug: "governance-minimization", title: "Governance Minimization", preferredPlacementId: "governance-minimization" },
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
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "veto-rights", slug: "veto-rights", title: "Veto Rights", preferredPlacementId: "veto-rights" },
    { id: "tie-breaking", slug: "tie-breaking", title: "Tie-Breaking" },
    // Proposal Execution and Execution Authority turn decisions into actions; not
    // 02's Transaction Execution or 08's Authority.
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "proposal-execution", slug: "proposal-execution", title: "Proposal Execution", preferredPlacementId: "proposal-execution" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    { id: "timelocks", slug: "timelocks", title: "Timelocks", preferredPlacementId: "timelocks" },
    // Also placed in 19 Protocol Design & Lifecycle and under 25 Autonomous Protocols;
    // this placement is preferred.
    {
      id: "parameter-changes",
      slug: "parameter-changes",
      title: "Parameter Changes",
      preferredPlacementId: "parameter-changes",
    },
    // Also placed in 19 Protocol Design & Lifecycle and under 25 Autonomous Protocols;
    // this placement is preferred.
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
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "working-groups", slug: "working-groups", title: "Working Groups", preferredPlacementId: "working-groups" },
    { id: "committee-selection", slug: "committee-selection", title: "Committee Selection" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "mandates", slug: "mandates", title: "Mandates", preferredPlacementId: "mandates" },
    { id: "term-limits", slug: "term-limits", title: "Term Limits" },
    { id: "signer-sets", slug: "signer-sets", title: "Signer Sets" },
    // Also 24 Autonomous Organizations' L1 topic, with its own layer; preferred there.
    { id: "treasuries", slug: "treasuries", title: "Treasuries", preferredPlacementId: "treasuries-in-autonomous-organizations" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "treasury-management", slug: "treasury-management", title: "Treasury Management", preferredPlacementId: "treasury-management" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "budget-allocation", slug: "budget-allocation", title: "Budget Allocation", preferredPlacementId: "budget-allocation" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "grants", slug: "grants", title: "Grants", preferredPlacementId: "grants" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "public-goods-funding", slug: "public-goods-funding", title: "Public Goods Funding", preferredPlacementId: "public-goods-funding" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "spending-controls", slug: "spending-controls", title: "Spending Controls", preferredPlacementId: "spending-controls" },
    // Social Consensus (a community's off-chain agreement) is not 04's Consensus.
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "constitutions", slug: "constitutions", title: "Constitutions", preferredPlacementId: "constitutions" },
    // Also placed in 19 Protocol Design & Lifecycle; this placement is preferred.
    { id: "rule-changes", slug: "rule-changes", title: "Rule Changes", preferredPlacementId: "rule-changes" },
    { id: "amendment-processes", slug: "amendment-processes", title: "Amendment Processes" },
    // Also placed in 18 Protocol Architecture; this placement is preferred.
    { id: "immutability", slug: "immutability", title: "Immutability", preferredPlacementId: "immutability" },
    { id: "governance-scope", slug: "governance-scope", title: "Governance Scope" },
    { id: "social-consensus", slug: "social-consensus", title: "Social Consensus" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "separation-of-powers", slug: "separation-of-powers", title: "Separation of Powers", preferredPlacementId: "separation-of-powers" },
    { id: "oversight", slug: "oversight", title: "Oversight" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "accountability", slug: "accountability", title: "Accountability", preferredPlacementId: "accountability" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "transparency", slug: "transparency", title: "Transparency", preferredPlacementId: "transparency" },
    // Also placed under 27 Frontier Systems; this placement is preferred.
    { id: "exit-rights", slug: "exit-rights", title: "Exit Rights", preferredPlacementId: "exit-rights" },
    { id: "minority-protection", slug: "minority-protection", title: "Minority Protection" },
    // Dispute Resolution reuses 09's Evidence.
    { id: "arbitration", slug: "arbitration", title: "Arbitration" },
    { id: "appeals", slug: "appeals", title: "Appeals" },
    { id: "decentralized-courts", slug: "decentralized-courts", title: "Decentralized Courts" },
    { id: "juror-selection", slug: "juror-selection", title: "Juror Selection" },
    { id: "ruling-enforcement", slug: "ruling-enforcement", title: "Ruling Enforcement" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "emergency-powers", slug: "emergency-powers", title: "Emergency Powers", preferredPlacementId: "emergency-powers" },
    // Also placed under 16's Trust & Failure Modes (a bridge pause) and under 24
    // Autonomous Organizations; this placement is preferred.
    {
      id: "pause-mechanisms",
      slug: "pause-mechanisms",
      title: "Pause Mechanisms",
      preferredPlacementId: "pause-mechanisms",
    },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "guardians", slug: "guardians", title: "Guardians", preferredPlacementId: "guardians" },
    // Also placed in 17 Security, Correctness & Resilience; this placement is preferred.
    {
      id: "emergency-upgrades",
      slug: "emergency-upgrades",
      title: "Emergency Upgrades",
      preferredPlacementId: "emergency-upgrades",
    },
    // Also placed in 17 Security, Correctness & Resilience and under 23's Execution
    // Recovery and under 23's Execution Recovery; this placement is preferred.
    {
      id: "circuit-breakers",
      slug: "circuit-breakers",
      title: "Circuit Breakers",
      preferredPlacementId: "circuit-breakers",
    },
    // Also placed in 17 Security, Correctness & Resilience and under 24 Autonomous
    // Organizations; this placement is preferred.
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
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "institutions", slug: "institutions", title: "Institutions", preferredPlacementId: "institutions" },
    { id: "legitimacy", slug: "legitimacy", title: "Legitimacy" },
    // Also placed in 18 Protocol Architecture and under 26 Autonomous Economy; this
    // placement is preferred.
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
    // Also placed under 21's Machine Payments; this placement, beside State
    // Channels, is preferred.
    { id: "payment-channels", slug: "payment-channels", title: "Payment Channels", preferredPlacementId: "payment-channels" },
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
    // Also placed as 25's "Liquidity Rebalancing"; this placement is preferred.
    { id: "rebalancing", slug: "rebalancing", title: "Rebalancing", preferredPlacementId: "rebalancing" },
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
    // Also placed in 19 Protocol Design & Lifecycle and as 25's "Protocol
    // Invariants"; this placement is preferred.
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
    // Also placed as 23's "Runtime Authorization"; this placement is preferred.
    { id: "authorization", slug: "authorization", title: "Authorization", preferredPlacementId: "authorization" },
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
    // Also placed under 23's Execution Monitoring and 25's Protocol Monitoring; this
    // placement is preferred.
    { id: "anomaly-detection", slug: "anomaly-detection", title: "Anomaly Detection", preferredPlacementId: "anomaly-detection" },
    { id: "on-chain-monitoring", slug: "on-chain-monitoring", title: "On-Chain Monitoring" },
    { id: "security-telemetry", slug: "security-telemetry", title: "Security Telemetry" },
    { id: "forensics", slug: "forensics", title: "Forensics" },
    // Incident Response is not 14's Emergency Governance.
    // Also placed as 25's "Automated Containment"; this placement is preferred.
    { id: "containment", slug: "containment", title: "Containment", preferredPlacementId: "containment" },
    { id: "response-coordination", slug: "response-coordination", title: "Response Coordination" },
    { id: "post-mortems", slug: "post-mortems", title: "Post-Mortems" },
    { id: "incident-disclosure", slug: "incident-disclosure", title: "Incident Disclosure" },
    // Resilience is not Foundations' Fault Tolerance alone; Recovery is not 08's
    // Account or Wallet Recovery.
    // Also placed under 25's Self-Healing; this placement is preferred.
    { id: "graceful-degradation", slug: "graceful-degradation", title: "Graceful Degradation", preferredPlacementId: "graceful-degradation" },
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
    // Also placed under 23's Objectives & Intents; this placement is preferred.
    { id: "success-criteria", slug: "success-criteria", title: "Success Criteria", preferredPlacementId: "success-criteria" },
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
    // Also placed under 25's Protocol Lifecycle Automation; this placement is preferred.
    { id: "protocol-bootstrapping", slug: "protocol-bootstrapping", title: "Protocol Bootstrapping", preferredPlacementId: "protocol-bootstrapping" },
    { id: "phased-rollouts", slug: "phased-rollouts", title: "Phased Rollouts" },
    // Protocol Parameters are not 14's Parameter Changes (changing them).
    { id: "protocol-parameters", slug: "protocol-parameters", title: "Protocol Parameters" },
    { id: "initial-parameters", slug: "initial-parameters", title: "Initial Parameters" },
    { id: "parameter-tuning", slug: "parameter-tuning", title: "Parameter Tuning" },
    // Also placed under 25's Adaptive Parameters; this placement is preferred.
    { id: "parameter-bounds", slug: "parameter-bounds", title: "Parameter Bounds", preferredPlacementId: "parameter-bounds" },
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
    // Also placed under 25's Protocol Lifecycle Automation; this placement is preferred.
    { id: "progressive-decentralization", slug: "progressive-decentralization", title: "Progressive Decentralization", preferredPlacementId: "progressive-decentralization" },
    // Also placed under 25's Protocol Lifecycle Automation; this placement is preferred.
    { id: "ossification", slug: "ossification", title: "Ossification", preferredPlacementId: "ossification" },
    { id: "lifecycle-risks", slug: "lifecycle-risks", title: "Lifecycle Risks" },
    // Deprecation (discouraging use) precedes Protocol Sunsetting (winding down);
    // Protocol Retirement is a planned end, not a failure.
    { id: "deprecation", slug: "deprecation", title: "Deprecation" },
    // Also placed under 25's Protocol Lifecycle Automation; this placement is preferred.
    { id: "protocol-sunsetting", slug: "protocol-sunsetting", title: "Protocol Sunsetting", preferredPlacementId: "protocol-sunsetting" },
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
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "goals", slug: "goals", title: "Goals", preferredPlacementId: "goals" },
    { id: "task-decomposition", slug: "task-decomposition", title: "Task Decomposition" },
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "plans", slug: "plans", title: "Plans", preferredPlacementId: "plans" },
    { id: "planning-horizons", slug: "planning-horizons", title: "Planning Horizons" },
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "replanning", slug: "replanning", title: "Replanning", preferredPlacementId: "replanning" },
    { id: "context-windows", slug: "context-windows", title: "Context Windows" },
    { id: "context-management", slug: "context-management", title: "Context Management" },
    { id: "long-term-memory", slug: "long-term-memory", title: "Long-Term Memory" },
    { id: "embeddings", slug: "embeddings", title: "Embeddings" },
    // Retrieving knowledge into a model's context, not 07's Data or Content Retrieval.
    { id: "retrieval-augmented-generation", slug: "retrieval-augmented-generation", title: "Retrieval-Augmented Generation" },
    // Tool Protocols (how models discover and call tools) are not Foundations' Protocols.
    { id: "tools", slug: "tools", title: "Tools" },
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "tool-calling", slug: "tool-calling", title: "Tool Calling", preferredPlacementId: "tool-calling" },
    { id: "tool-schemas", slug: "tool-schemas", title: "Tool Schemas" },
    { id: "tool-results", slug: "tool-results", title: "Tool Results" },
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "tool-selection", slug: "tool-selection", title: "Tool Selection", preferredPlacementId: "tool-selection" },
    { id: "tool-protocols", slug: "tool-protocols", title: "Tool Protocols" },
    // Principals (the party an agent acts for) are a general concept for later
    // authority, execution, organization and autonomy domains; not
    // Foundations' Participants or 10's Players. Autonomy Levels leaves the
    // general Autonomy to 22–26.
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "principals", slug: "principals", title: "Principals", preferredPlacementId: "principals" },
    { id: "agent-loops", slug: "agent-loops", title: "Agent Loops" },
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "agent-actions", slug: "agent-actions", title: "Agent Actions", preferredPlacementId: "agent-actions" },
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
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "human-oversight", slug: "human-oversight", title: "Human Oversight", preferredPlacementId: "human-oversight" },
    { id: "interpretability", slug: "interpretability", title: "Interpretability" },
    // Also placed under 27 Frontier Systems; this placement is preferred.
    { id: "corrigibility", slug: "corrigibility", title: "Corrigibility", preferredPlacementId: "corrigibility" },
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
    // Also placed under 27 Frontier Systems; this placement is preferred.
    { id: "verifiable-agents", slug: "verifiable-agents", title: "Verifiable Agents", preferredPlacementId: "verifiable-agents" },
    // 21 Machine Economy: L1 topics (Agent Identity and Agent Reputation are 08's
    // concepts). Agent Wallets, Agent Capital, Agent Budgets, Machine Payments,
    // Machine Commerce, Agent Markets, Agent Credit and Agent Risk are general
    // concepts for reuse by 22–26. Agent Wallets are not 08's Wallets; Agent
    // Permissions (the grants an agent holds) are not 08's Agent Authorization
    // (deciding what an authenticated agent may do); Agent Risk and Agent
    // Incentives are not 11's Risk or 10's Incentives.
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "economic-agents", slug: "economic-agents", title: "Economic Agents", preferredPlacementId: "economic-agents" },
    { id: "agent-ownership", slug: "agent-ownership", title: "Agent Ownership" },
    { id: "agent-wallets", slug: "agent-wallets", title: "Agent Wallets" },
    { id: "agent-capital", slug: "agent-capital", title: "Agent Capital" },
    { id: "agent-budgets", slug: "agent-budgets", title: "Agent Budgets" },
    { id: "agent-permissions", slug: "agent-permissions", title: "Agent Permissions" },
    { id: "machine-payments", slug: "machine-payments", title: "Machine Payments" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "machine-commerce", slug: "machine-commerce", title: "Machine Commerce", preferredPlacementId: "machine-commerce" },
    { id: "agent-markets", slug: "agent-markets", title: "Agent Markets" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "agent-credit", slug: "agent-credit", title: "Agent Credit", preferredPlacementId: "agent-credit" },
    { id: "agent-risk", slug: "agent-risk", title: "Agent Risk" },
    { id: "agent-incentives", slug: "agent-incentives", title: "Agent Incentives" },
    // L2 topics (placements in L2_TOPICS). AI Agents is 20's AI Agent and
    // Protocols is Foundations' concept; Organizations is a general concept for
    // 14 and 24.
    { id: "human-agents", slug: "human-agents", title: "Human Agents" },
    { id: "software-agents", slug: "software-agents", title: "Software Agents" },
    // Also 24 Autonomous Organizations' L1 topic, with its own layer; preferred there.
    { id: "organizations", slug: "organizations", title: "Organizations", preferredPlacementId: "organizations-in-autonomous-organizations" },
    { id: "hybrid-agents", slug: "hybrid-agents", title: "Hybrid Agents" },
    // Kinds of owner of an agent, not 08's Ownership (control of an asset or
    // contract) in general.
    { id: "human-ownership", slug: "human-ownership", title: "Human Ownership" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "organizational-ownership", slug: "organizational-ownership", title: "Organizational Ownership", preferredPlacementId: "organizational-ownership" },
    { id: "shared-ownership", slug: "shared-ownership", title: "Shared Ownership" },
    { id: "protocol-ownership", slug: "protocol-ownership", title: "Protocol Ownership" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "beneficial-ownership", slug: "beneficial-ownership", title: "Beneficial Ownership", preferredPlacementId: "beneficial-ownership" },
    { id: "ownership-transfer", slug: "ownership-transfer", title: "Ownership Transfer" },
    // Identity Recovery (regaining control of an identity) is not 08's Account
    // or Wallet Recovery.
    { id: "persistent-identity", slug: "persistent-identity", title: "Persistent Identity" },
    { id: "identity-portability", slug: "identity-portability", title: "Identity Portability" },
    { id: "identity-recovery", slug: "identity-recovery", title: "Identity Recovery" },
    // Session Authority (the bounded authority granted for a session) is not
    // 08's Session Keys (one mechanism that carries it); Agent Accounts are not
    // 08's Accounts in general.
    { id: "agent-accounts", slug: "agent-accounts", title: "Agent Accounts" },
    { id: "session-authority", slug: "session-authority", title: "Session Authority" },
    { id: "spending-authority", slug: "spending-authority", title: "Spending Authority" },
    // Capital Constraints are not 11's Solvency Constraints; Capital Allocation
    // is not 10's Capacity Allocation.
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "revenue", slug: "revenue", title: "Revenue", preferredPlacementId: "revenue" },
    // Also placed under 22's Resource Allocation; this placement is preferred.
    { id: "capital-allocation", slug: "capital-allocation", title: "Capital Allocation", preferredPlacementId: "capital-allocation" },
    { id: "working-capital", slug: "working-capital", title: "Working Capital" },
    { id: "capital-constraints", slug: "capital-constraints", title: "Capital Constraints" },
    // Resource Budgets are not 02's Resource Limits (per-transaction execution limits).
    { id: "spending-limits", slug: "spending-limits", title: "Spending Limits" },
    { id: "allowances", slug: "allowances", title: "Allowances" },
    { id: "resource-budgets", slug: "resource-budgets", title: "Resource Budgets" },
    { id: "time-budgets", slug: "time-budgets", title: "Time Budgets" },
    { id: "budget-policies", slug: "budget-policies", title: "Budget Policies" },
    { id: "budget-enforcement", slug: "budget-enforcement", title: "Budget Enforcement" },
    // Referring a request beyond a grant to a higher authority, shown as
    // "Escalation"; not privilege escalation (an attack). Policy Constraints are
    // not 10's Mechanism Constraints; policy enforcement in execution is 23's.
    // Also placed under 23 Autonomous Execution; this placement is preferred.
    { id: "policy-constraints", slug: "policy-constraints", title: "Policy Constraints", preferredPlacementId: "policy-constraints" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "authority-escalation", slug: "authority-escalation", title: "Authority Escalation", preferredPlacementId: "authority-escalation" },
    // Automated Settlement (settling without a human step) is not Settlement itself.
    // Payment Channels are 15's (a state channel specialized for payments), placed
    // again here as a machine-payment rail.
    { id: "machine-to-machine-payments", slug: "machine-to-machine-payments", title: "Machine-to-Machine Payments" },
    { id: "micropayments", slug: "micropayments", title: "Micropayments" },
    { id: "streaming-payments", slug: "streaming-payments", title: "Streaming Payments" },
    { id: "conditional-payments", slug: "conditional-payments", title: "Conditional Payments" },
    { id: "automated-settlement", slug: "automated-settlement", title: "Automated Settlement" },
    // Service Discovery, Price Discovery and Negotiation are general concepts for
    // 22; Price Discovery is not 11's Market Prices (its result).
    // Service Discovery is also placed under 22's Agent Discovery, and
    // Negotiation is 22's L1 topic with its own layer; each is preferred in 22,
    // where discovery and negotiation are taught.
    {
      id: "service-discovery",
      slug: "service-discovery",
      title: "Service Discovery",
      preferredPlacementId: "service-discovery-in-agent-discovery",
    },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "price-discovery", slug: "price-discovery", title: "Price Discovery", preferredPlacementId: "price-discovery" },
    {
      id: "negotiation",
      slug: "negotiation",
      title: "Negotiation",
      preferredPlacementId: "negotiation-in-autonomous-coordination",
    },
    { id: "purchasing", slug: "purchasing", title: "Purchasing" },
    { id: "subscriptions", slug: "subscriptions", title: "Subscriptions" },
    // Markets in what agents buy and sell, each a kind of 11's Markets.
    { id: "compute-markets", slug: "compute-markets", title: "Compute Markets" },
    { id: "data-markets", slug: "data-markets", title: "Data Markets" },
    { id: "model-markets", slug: "model-markets", title: "Model Markets" },
    { id: "solver-markets", slug: "solver-markets", title: "Solver Markets" },
    { id: "service-markets", slug: "service-markets", title: "Service Markets" },
    { id: "information-markets", slug: "information-markets", title: "Information Markets" },
    // Trust Scores are not 01's Trust Models; Reputation Attacks are not 09's
    // Sybil Attacks (one way to mount them).
    { id: "performance-history", slug: "performance-history", title: "Performance History" },
    { id: "trust-scores", slug: "trust-scores", title: "Trust Scores" },
    { id: "reputation-portability", slug: "reputation-portability", title: "Reputation Portability" },
    { id: "reputation-decay", slug: "reputation-decay", title: "Reputation Decay" },
    { id: "reputation-attacks", slug: "reputation-attacks", title: "Reputation Attacks" },
    // A borrower failing to repay, shown as "Default"; not 11's Bad Debt (the
    // loss left behind) or Insolvency. Creditworthiness is not 11's Credit Risk.
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "creditworthiness", slug: "creditworthiness", title: "Creditworthiness", preferredPlacementId: "creditworthiness" },
    { id: "credit-limits", slug: "credit-limits", title: "Credit Limits" },
    { id: "unsecured-credit", slug: "unsecured-credit", title: "Unsecured Credit" },
    { id: "credit-default", slug: "credit-default", title: "Credit Default" },
    // Model Risk is not 20's Model Uncertainty; Risk Limits (bounds on an
    // agent's exposure) are not 11's Risk Parameters (a protocol's settings).
    { id: "operational-risk", slug: "operational-risk", title: "Operational Risk" },
    { id: "financial-risk", slug: "financial-risk", title: "Financial Risk" },
    { id: "policy-risk", slug: "policy-risk", title: "Policy Risk" },
    { id: "model-risk", slug: "model-risk", title: "Model Risk" },
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "risk-limits", slug: "risk-limits", title: "Risk Limits", preferredPlacementId: "risk-limits" },
    // What an economic agent optimizes, shown as "Objectives": not 20's Goals
    // (what a plan pursues) or 10's Mechanism Objectives. Principal-Agent
    // Problems build on 20's Principals.
    { id: "agent-objectives", slug: "agent-objectives", title: "Agent Objectives" },
    { id: "principal-agent-problems", slug: "principal-agent-problems", title: "Principal-Agent Problems" },
    // 22 Autonomous Coordination: L1 topics (Negotiation is 21's concept;
    // Delegation 08's; Cooperation and Competition Foundations'; Resource
    // Allocation 10's). Agent-to-Agent Communication is not Foundations'
    // Communication (participants signalling to align action) in general; Agent
    // Discovery is not 05's Peer Discovery; Multi-Agent Coordination is not
    // Foundations' Coordination; Task Markets (allocating work) are not 21's
    // Service Markets. Executing a coordinated task is 23's.
    { id: "agent-to-agent-communication", slug: "agent-to-agent-communication", title: "Agent-to-Agent Communication" },
    { id: "agent-discovery", slug: "agent-discovery", title: "Agent Discovery" },
    { id: "coalition-formation", slug: "coalition-formation", title: "Coalition Formation" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "task-markets", slug: "task-markets", title: "Task Markets", preferredPlacementId: "task-markets" },
    { id: "multi-agent-coordination", slug: "multi-agent-coordination", title: "Multi-Agent Coordination" },
    // L2 topics (placements in L2_TOPICS). Message Protocols are not
    // Foundations' Protocols or 20's Tool Protocols; Message Routing is not 05's
    // Request Routing or Message Propagation; Secure Communication is not 06's
    // Confidentiality.
    { id: "agent-messages", slug: "agent-messages", title: "Agent Messages" },
    { id: "message-protocols", slug: "message-protocols", title: "Message Protocols" },
    { id: "communication-semantics", slug: "communication-semantics", title: "Communication Semantics" },
    { id: "secure-communication", slug: "secure-communication", title: "Secure Communication" },
    { id: "message-routing", slug: "message-routing", title: "Message Routing" },
    { id: "communication-policies", slug: "communication-policies", title: "Communication Policies" },
    // Capability Discovery (finding what an agent can do) is not 08's
    // Capabilities (rights conferred); Matching (pairing requesters with
    // providers) is not 11's Order Matching.
    { id: "agent-registries", slug: "agent-registries", title: "Agent Registries" },
    { id: "capability-discovery", slug: "capability-discovery", title: "Capability Discovery" },
    { id: "discovery-protocols", slug: "discovery-protocols", title: "Discovery Protocols" },
    { id: "matching", slug: "matching", title: "Matching" },
    { id: "discovery-trust", slug: "discovery-trust", title: "Discovery Trust" },
    // Offers (proposed terms) are not 10's Bids. Terms two parties accept, shown
    // as "Agreement"; not 04's Agreement (nodes deciding one value).
    { id: "offers", slug: "offers", title: "Offers" },
    { id: "counteroffers", slug: "counteroffers", title: "Counteroffers" },
    { id: "negotiation-constraints", slug: "negotiation-constraints", title: "Negotiation Constraints" },
    { id: "negotiation-strategies", slug: "negotiation-strategies", title: "Negotiation Strategies" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "negotiated-agreement", slug: "negotiated-agreement", title: "Negotiated Agreement", preferredPlacementId: "negotiated-agreement" },
    { id: "negotiation-failure", slug: "negotiation-failure", title: "Negotiation Failure" },
    // Task Delegation (handing over work) and Authority Delegation (handing
    // over rights) are the narrower kinds of Delegation.
    { id: "task-delegation", slug: "task-delegation", title: "Task Delegation" },
    { id: "authority-delegation", slug: "authority-delegation", title: "Authority Delegation" },
    { id: "delegation-constraints", slug: "delegation-constraints", title: "Delegation Constraints" },
    { id: "delegation-policies", slug: "delegation-policies", title: "Delegation Policies" },
    { id: "delegation-chains", slug: "delegation-chains", title: "Delegation Chains" },
    // Shared Objectives are not 21's Agent Objectives (one agent's); Information
    // Sharing is not Foundations' Information.
    { id: "shared-objectives", slug: "shared-objectives", title: "Shared Objectives" },
    { id: "task-sharing", slug: "task-sharing", title: "Task Sharing" },
    { id: "resource-sharing", slug: "resource-sharing", title: "Resource Sharing" },
    { id: "information-sharing", slug: "information-sharing", title: "Information Sharing" },
    { id: "benefit-sharing", slug: "benefit-sharing", title: "Benefit Sharing" },
    { id: "cooperative-strategies", slug: "cooperative-strategies", title: "Cooperative Strategies" },
    // Competitive Strategies are not 10's Strategies; Bidding (competing through
    // bids) is not 10's Bids (the offers); Competitive Equilibria are not 10's
    // Nash Equilibrium. Choosing among competing agents, shown as "Selection";
    // not 04's Validator or Builder Selection.
    { id: "competitive-strategies", slug: "competitive-strategies", title: "Competitive Strategies" },
    { id: "bidding", slug: "bidding", title: "Bidding" },
    { id: "competitive-selection", slug: "competitive-selection", title: "Competitive Selection" },
    { id: "rivalry", slug: "rivalry", title: "Rivalry" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "competitive-equilibria", slug: "competitive-equilibria", title: "Competitive Equilibria", preferredPlacementId: "competitive-equilibria" },
    // Coalitions agents form deliberately, not Foundations' Collusion; Coalition
    // Incentives are not 10's Incentives.
    { id: "coalition-membership", slug: "coalition-membership", title: "Coalition Membership" },
    { id: "coalition-objectives", slug: "coalition-objectives", title: "Coalition Objectives" },
    { id: "coalition-rules", slug: "coalition-rules", title: "Coalition Rules" },
    { id: "coalition-incentives", slug: "coalition-incentives", title: "Coalition Incentives" },
    { id: "coalition-stability", slug: "coalition-stability", title: "Coalition Stability" },
    { id: "coalition-dissolution", slug: "coalition-dissolution", title: "Coalition Dissolution" },
    // Compute Allocation is not 10's Capacity Allocation (blockspace).
    { id: "compute-allocation", slug: "compute-allocation", title: "Compute Allocation" },
    { id: "data-allocation", slug: "data-allocation", title: "Data Allocation" },
    { id: "service-allocation", slug: "service-allocation", title: "Service Allocation" },
    { id: "allocation-policies", slug: "allocation-policies", title: "Allocation Policies" },
    { id: "allocation-conflicts", slug: "allocation-conflicts", title: "Allocation Conflicts" },
    // Task Discovery is not Service Discovery; Task Bidding is not Bidding or
    // Bids; Task Settlement is not Settlement; Task Assignment is not 20's Task
    // Decomposition.
    { id: "task-publication", slug: "task-publication", title: "Task Publication" },
    { id: "task-discovery", slug: "task-discovery", title: "Task Discovery" },
    { id: "task-providers", slug: "task-providers", title: "Task Providers" },
    { id: "task-bidding", slug: "task-bidding", title: "Task Bidding" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "task-assignment", slug: "task-assignment", title: "Task Assignment", preferredPlacementId: "task-assignment" },
    { id: "task-settlement", slug: "task-settlement", title: "Task Settlement" },
    // Shared Plans are not 20's Plans (one agent's); Coordination Protocols are
    // not Protocols. Agents aligning their timing and actions, shown as
    // "Synchronization"; not 03's Synchronization (a node catching up on state).
    // Collective Decision-Making is not 04's Consensus or Foundations'
    // Collective Action; Emergent Coordination is not Coordination.
    { id: "shared-plans", slug: "shared-plans", title: "Shared Plans" },
    { id: "coordination-protocols", slug: "coordination-protocols", title: "Coordination Protocols" },
    { id: "agent-synchronization", slug: "agent-synchronization", title: "Agent Synchronization" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "conflict-resolution", slug: "conflict-resolution", title: "Conflict Resolution", preferredPlacementId: "conflict-resolution" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "collective-decision-making", slug: "collective-decision-making", title: "Collective Decision-Making", preferredPlacementId: "collective-decision-making" },
    { id: "emergent-coordination", slug: "emergent-coordination", title: "Emergent Coordination" },
    // 23 Autonomous Execution: L1 topics, the lifecycle of carrying out one
    // autonomous action. Simulation is the general concept (not only pre-trade
    // simulation). Execution Policies, Authorization and Environments are the
    // execution-time control plane: 21 defines an agent's permissions and
    // budgets, 22 how agents delegate and coordinate, and 24–26 organization-,
    // protocol- and economy-level autonomy.
    { id: "objectives-intents", slug: "objectives-intents", title: "Objectives & Intents" },
    { id: "execution-planning", slug: "execution-planning", title: "Execution Planning" },
    { id: "action-selection", slug: "action-selection", title: "Action Selection" },
    { id: "simulation", slug: "simulation", title: "Simulation" },
    { id: "execution-policies", slug: "execution-policies", title: "Execution Policies" },
    { id: "execution-authorization", slug: "execution-authorization", title: "Execution Authorization" },
    { id: "execution-environments", slug: "execution-environments", title: "Execution Environments" },
    { id: "action-execution", slug: "action-execution", title: "Action Execution" },
    { id: "verification-settlement", slug: "verification-settlement", title: "Verification & Settlement" },
    { id: "execution-monitoring", slug: "execution-monitoring", title: "Execution Monitoring" },
    { id: "execution-recovery", slug: "execution-recovery", title: "Execution Recovery" },
    // L2 topics (placements in L2_TOPICS). Goals are 20's. Intent Generation
    // (turning an objective into a declarative intent) leaves Intents to 13;
    // Execution Constraints are not 10's Mechanism, 21's Policy or 22's
    // Negotiation Constraints. Success Criteria are 19's (measurable conditions for
    // judging an objective achieved), not 20's Goal Specification.
    { id: "execution-requests", slug: "execution-requests", title: "Execution Requests" },
    { id: "objective-interpretation", slug: "objective-interpretation", title: "Objective Interpretation" },
    { id: "intent-generation", slug: "intent-generation", title: "Intent Generation" },
    { id: "execution-constraints", slug: "execution-constraints", title: "Execution Constraints" },
    // Plans and Replanning are 20's. Action Dependencies are not 22's Delegation
    // Chains; Resource Estimation is not 21's Resource Budgets.
    { id: "action-sequencing", slug: "action-sequencing", title: "Action Sequencing" },
    { id: "action-dependencies", slug: "action-dependencies", title: "Action Dependencies" },
    { id: "resource-estimation", slug: "resource-estimation", title: "Resource Estimation" },
    { id: "contingency-planning", slug: "contingency-planning", title: "Contingency Planning" },
    // Tool Selection is 20's and Execution Routing 13's. Cost Estimation is not
    // 20's Inference Cost or 02's Execution Cost; Candidate Evaluation is not
    // 20's AI Evaluation.
    { id: "candidate-generation", slug: "candidate-generation", title: "Candidate Generation" },
    { id: "candidate-evaluation", slug: "candidate-evaluation", title: "Candidate Evaluation" },
    { id: "cost-estimation", slug: "cost-estimation", title: "Cost Estimation" },
    { id: "execution-optimization", slug: "execution-optimization", title: "Execution Optimization" },
    // State Forking (running against a copy of live state) is not 04's Competing
    // Forks; Simulation Divergence (simulated and real outcomes differing) is
    // not 20's Distribution Shift.
    { id: "state-forking", slug: "state-forking", title: "State Forking" },
    { id: "dry-runs", slug: "dry-runs", title: "Dry Runs" },
    { id: "outcome-prediction", slug: "outcome-prediction", title: "Outcome Prediction" },
    { id: "simulation-fidelity", slug: "simulation-fidelity", title: "Simulation Fidelity" },
    { id: "simulation-divergence", slug: "simulation-divergence", title: "Simulation Divergence" },
    // Policy Constraints are 21's. Policy Enforcement at execution is not 21's
    // Budget Enforcement; Risk Checks apply 21's Risk Limits and are not them.
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "policy-evaluation", slug: "policy-evaluation", title: "Policy Evaluation", preferredPlacementId: "policy-evaluation" },
    { id: "policy-engines", slug: "policy-engines", title: "Policy Engines" },
    { id: "policy-enforcement", slug: "policy-enforcement", title: "Policy Enforcement" },
    { id: "policy-violations", slug: "policy-violations", title: "Policy Violations" },
    { id: "risk-checks", slug: "risk-checks", title: "Risk Checks" },
    // Runtime Authorization is 17's Authorization (what an authenticated party may
    // do), applied to one action as it runs: not 08's Agent Authorization or 21's
    // Spending and Session Authority; Multi-Party Approval
    // is not 06's Multisignatures; Authorization Scopes are not 21's Agent
    // Permissions. Capabilities are 08's. The limits beyond which an action needs
    // approval, shown as "Approval Thresholds"; not 14's Approval Thresholds (the
    // share of votes a decision needs).
    { id: "human-approval", slug: "human-approval", title: "Human Approval" },
    { id: "action-approval-thresholds", slug: "action-approval-thresholds", title: "Action Approval Thresholds" },
    { id: "multi-party-approval", slug: "multi-party-approval", title: "Multi-Party Approval" },
    { id: "authorization-scopes", slug: "authorization-scopes", title: "Authorization Scopes" },
    // Trusted Execution is 02's. Tool Permissions are not 21's Agent Permissions
    // in general; Execution Isolation is not 02's Execution Context.
    { id: "sandboxing", slug: "sandboxing", title: "Sandboxing" },
    { id: "execution-isolation", slug: "execution-isolation", title: "Execution Isolation" },
    { id: "tool-permissions", slug: "tool-permissions", title: "Tool Permissions" },
    { id: "environment-access", slug: "environment-access", title: "Environment Access" },
    { id: "ephemeral-environments", slug: "ephemeral-environments", title: "Ephemeral Environments" },
    // Agent Actions and Tool Calling are 20's; Transaction Construction and
    // Submission 08's and 05's. Partial Execution (some steps done, others not)
    // is not 02's Transaction Atomicity or Reversion.
    { id: "partial-execution", slug: "partial-execution", title: "Partial Execution" },
    { id: "idempotency", slug: "idempotency", title: "Idempotency" },
    // Verifiable Execution is 06's and Settlement the general concept. Outcome
    // Verification (the result meets the success criteria) is not Foundations'
    // Verification in general; Execution Receipts are not 03's Logs.
    { id: "outcome-verification", slug: "outcome-verification", title: "Outcome Verification" },
    { id: "postconditions", slug: "postconditions", title: "Postconditions" },
    { id: "execution-receipts", slug: "execution-receipts", title: "Execution Receipts" },
    { id: "execution-disputes", slug: "execution-disputes", title: "Execution Disputes" },
    // Observability and Alerting are 05's, Anomaly Detection 17's and Human
    // Oversight 20's. Audit Trails (a record of what an agent did and why) are not
    // 03's Traceability.
    { id: "progress-tracking", slug: "progress-tracking", title: "Progress Tracking" },
    // Also placed under 24 Autonomous Organizations; this placement is preferred.
    { id: "audit-trails", slug: "audit-trails", title: "Audit Trails", preferredPlacementId: "audit-trails" },
    // Execution Failures are not Foundations' Failures (process faults);
    // Rollbacks are not 02's Transaction Reversion or 04's Reorganizations.
    // Circuit Breakers are 14's (automatic halts on a condition), not Kill
    // Switches (a deliberate stop).
    { id: "execution-failures", slug: "execution-failures", title: "Execution Failures" },
    { id: "retries", slug: "retries", title: "Retries" },
    { id: "rollbacks", slug: "rollbacks", title: "Rollbacks" },
    { id: "compensating-actions", slug: "compensating-actions", title: "Compensating Actions" },
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "kill-switches", slug: "kill-switches", title: "Kill Switches", preferredPlacementId: "kill-switches" },
    // 24 Autonomous Organizations: L1 topics. Organizations (21's concept) and
    // Treasuries (14's) are L1 topics here with their own layers, preferred here.
    // Organizational Governance, Policies and Workflows are an organization's
    // own, not 14's governance in general, 23's Execution Policies or 23's
    // Execution Planning. Operating protocols themselves is 25's; economy-level
    // systems are 26's.
    { id: "organizational-membership", slug: "organizational-membership", title: "Organizational Membership" },
    { id: "roles-authority", slug: "roles-authority", title: "Roles & Authority" },
    { id: "organizational-structure", slug: "organizational-structure", title: "Organizational Structure" },
    { id: "organizational-governance", slug: "organizational-governance", title: "Organizational Governance" },
    { id: "organizational-decision-making", slug: "organizational-decision-making", title: "Organizational Decision-Making" },
    { id: "organizational-policies", slug: "organizational-policies", title: "Organizational Policies" },
    { id: "organizational-budgeting", slug: "organizational-budgeting", title: "Organizational Budgeting" },
    { id: "organizational-workflows", slug: "organizational-workflows", title: "Organizational Workflows" },
    { id: "autonomous-operations", slug: "autonomous-operations", title: "Autonomous Operations" },
    { id: "accountability-auditability", slug: "accountability-auditability", title: "Accountability & Auditability" },
    { id: "disputes-emergency-controls", slug: "disputes-emergency-controls", title: "Disputes & Emergency Controls" },
    { id: "organizational-lifecycle", slug: "organizational-lifecycle", title: "Organizational Lifecycle" },
    { id: "inter-organizational-coordination", slug: "inter-organizational-coordination", title: "Inter-Organizational Coordination" },
    // L2 topics (placements in L2_TOPICS). Organizational Identity is not 08's
    // Identity or Agent Identity; Organizational Objectives are not 22's Shared
    // or 21's Agent Objectives.
    { id: "decentralized-autonomous-organizations", slug: "decentralized-autonomous-organizations", title: "Decentralized Autonomous Organizations" },
    { id: "organizational-identity", slug: "organizational-identity", title: "Organizational Identity" },
    { id: "organizational-objectives", slug: "organizational-objectives", title: "Organizational Objectives" },
    { id: "organizational-boundaries", slug: "organizational-boundaries", title: "Organizational Boundaries" },
    // Also placed under 27 Frontier Systems; this placement is preferred.
    { id: "legal-wrappers", slug: "legal-wrappers", title: "Legal Wrappers", preferredPlacementId: "legal-wrappers" },
    // Organizational Membership is not 22's Coalition Membership; Membership
    // Tokens are not 14's Token Holders; Member Exit (leaving) is not 14's Exit
    // Rights (the right to leave with one's share).
    { id: "membership-criteria", slug: "membership-criteria", title: "Membership Criteria" },
    { id: "member-admission", slug: "member-admission", title: "Member Admission" },
    { id: "membership-rights", slug: "membership-rights", title: "Membership Rights" },
    { id: "membership-obligations", slug: "membership-obligations", title: "Membership Obligations" },
    { id: "membership-tokens", slug: "membership-tokens", title: "Membership Tokens" },
    { id: "member-exit", slug: "member-exit", title: "Member Exit" },
    // Roles, Authority Boundaries (08), Mandates and Separation of Powers (14)
    // are placed again.
    { id: "role-assignment", slug: "role-assignment", title: "Role Assignment" },
    { id: "role-hierarchies", slug: "role-hierarchies", title: "Role Hierarchies" },
    // Sub-Organizations are not 14's Working Groups; Reporting Lines are not
    // Role Hierarchies.
    { id: "hierarchical-structures", slug: "hierarchical-structures", title: "Hierarchical Structures" },
    { id: "flat-structures", slug: "flat-structures", title: "Flat Structures" },
    { id: "sub-organizations", slug: "sub-organizations", title: "Sub-Organizations" },
    { id: "reporting-lines", slug: "reporting-lines", title: "Reporting Lines" },
    // Governance by humans and autonomous agents together; not 14's Governance
    // Models in general.
    { id: "hybrid-governance", slug: "hybrid-governance", title: "Hybrid Governance" },
    // Decision Rights (who may decide what) are not 08's Capabilities; Automated
    // Decisions (taken by agents within a mandate) are not 22's Collective
    // Decision-Making.
    { id: "decision-rights", slug: "decision-rights", title: "Decision Rights" },
    { id: "automated-decisions", slug: "automated-decisions", title: "Automated Decisions" },
    // Also placed under 25 Autonomous Protocols; this placement is preferred.
    { id: "decision-records", slug: "decision-records", title: "Decision Records", preferredPlacementId: "decision-records" },
    // Organizational Compliance is not 21's Policy Constraints; Policy Updates
    // are not 14's Rule Changes (to constitutional rules).
    { id: "policy-setting", slug: "policy-setting", title: "Policy Setting" },
    { id: "policy-hierarchies", slug: "policy-hierarchies", title: "Policy Hierarchies" },
    { id: "organizational-compliance", slug: "organizational-compliance", title: "Organizational Compliance" },
    { id: "policy-updates", slug: "policy-updates", title: "Policy Updates" },
    // Treasury Custody (who holds the keys) is not 08's Key Management; Runway
    // and Treasury Diversification are not 11's Solvency or Reserves.
    { id: "treasury-custody", slug: "treasury-custody", title: "Treasury Custody" },
    { id: "runway", slug: "runway", title: "Runway" },
    { id: "treasury-diversification", slug: "treasury-diversification", title: "Treasury Diversification" },
    // Budget Cycles are not 14's Budget Allocation; Contributor Compensation is
    // not 10's Rewards; Spending Approvals are not 23's Human Approval.
    { id: "budget-cycles", slug: "budget-cycles", title: "Budget Cycles" },
    { id: "contributor-compensation", slug: "contributor-compensation", title: "Contributor Compensation" },
    { id: "spending-approvals", slug: "spending-approvals", title: "Spending Approvals" },
    // Workflow Definitions (an organization's repeatable processes) are not 23's
    // or 20's Plans; Approval Workflows are not 23's Multi-Party Approval;
    // Handoffs (between humans and agents) are not 22's Task Delegation;
    // Workflow Automation is not 05's Automation; Service-Level Agreements are
    // not 22's Negotiated Agreement.
    { id: "workflow-definitions", slug: "workflow-definitions", title: "Workflow Definitions" },
    { id: "approval-workflows", slug: "approval-workflows", title: "Approval Workflows" },
    { id: "handoffs", slug: "handoffs", title: "Handoffs" },
    { id: "workflow-automation", slug: "workflow-automation", title: "Workflow Automation" },
    { id: "service-level-agreements", slug: "service-level-agreements", title: "Service-Level Agreements" },
    // Organizational Autonomy is not 20's Autonomy Levels (one agent's); Agent
    // Workforces are not 21's Economic Agents; Operating Procedures are not 23's
    // Execution Policies; Organizational Performance is not 05's Metrics.
    { id: "organizational-autonomy", slug: "organizational-autonomy", title: "Organizational Autonomy" },
    { id: "agent-workforces", slug: "agent-workforces", title: "Agent Workforces" },
    { id: "operating-procedures", slug: "operating-procedures", title: "Operating Procedures" },
    { id: "organizational-performance", slug: "organizational-performance", title: "Organizational Performance" },
    // Accountability and Transparency are 14's and Audit Trails 23's.
    // Responsibility Attribution is not 03's Attribution; Liability is not
    // Accountability; Auditability is the property, Audit Trails the record.
    { id: "responsibility-attribution", slug: "responsibility-attribution", title: "Responsibility Attribution" },
    { id: "auditability", slug: "auditability", title: "Auditability" },
    { id: "liability", slug: "liability", title: "Liability" },
    // Organizational Lifecycle is not 02's Contract Lifecycle; Organization
    // Formation is not 22's Coalition Formation; Restructuring is not 04's
    // Reorganizations; Organizational Dissolution is not 22's Coalition
    // Dissolution.
    { id: "organization-formation", slug: "organization-formation", title: "Organization Formation" },
    { id: "organizational-bootstrapping", slug: "organizational-bootstrapping", title: "Organizational Bootstrapping" },
    { id: "restructuring", slug: "restructuring", title: "Restructuring" },
    { id: "organizational-mergers", slug: "organizational-mergers", title: "Organizational Mergers" },
    { id: "succession", slug: "succession", title: "Succession" },
    { id: "organizational-dissolution", slug: "organizational-dissolution", title: "Organizational Dissolution" },
    // Organizational Alliances are not 22's Coalition Formation (among agents);
    // Federations are not 14's Councils & Committees; Cross-Organizational
    // Governance is not Organizational Governance.
    { id: "organizational-alliances", slug: "organizational-alliances", title: "Organizational Alliances" },
    { id: "federations", slug: "federations", title: "Federations" },
    { id: "joint-ventures", slug: "joint-ventures", title: "Joint Ventures" },
    { id: "shared-services", slug: "shared-services", title: "Shared Services" },
    { id: "cross-organizational-governance", slug: "cross-organizational-governance", title: "Cross-Organizational Governance" },
    // 25 Autonomous Protocols: L1 topics. A protocol whose own operation is
    // closed-loop or policy-driven: it observes itself, decides within bounds,
    // acts and adapts with reduced human intervention. Not 23's execution of one
    // action, 24's organizations, or 26's economy-level systems; governance stays
    // 14's. Protocol Autonomy is not 20's Autonomy Levels or 24's Organizational
    // Autonomy; Protocol Objectives are not 10's Mechanism or 21's Agent
    // Objectives; Protocol Monitoring is not 05's Monitoring; Protocol Policies
    // are not 24's Organizational or 23's Execution Policies; Protocol Agents are
    // not 20's AI Agents; Self-Healing is not 23's Execution Recovery; Autonomous
    // Security Responses are not 14's Emergency Governance; Protocol-Owned
    // Resources are not Treasuries; Autonomous Liquidity and Risk Management are
    // not 11's Liquidity and Risk; Protocol Maintenance is not Protocol Lifecycle
    // Automation.
    { id: "protocol-autonomy", slug: "protocol-autonomy", title: "Protocol Autonomy" },
    { id: "protocol-objectives", slug: "protocol-objectives", title: "Protocol Objectives" },
    { id: "protocol-monitoring", slug: "protocol-monitoring", title: "Protocol Monitoring" },
    { id: "control-loops", slug: "control-loops", title: "Control Loops" },
    { id: "adaptive-parameters", slug: "adaptive-parameters", title: "Adaptive Parameters" },
    { id: "protocol-policies", slug: "protocol-policies", title: "Protocol Policies" },
    { id: "protocol-agents", slug: "protocol-agents", title: "Protocol Agents" },
    { id: "protocol-maintenance", slug: "protocol-maintenance", title: "Protocol Maintenance" },
    { id: "protocol-adaptation", slug: "protocol-adaptation", title: "Protocol Adaptation" },
    { id: "self-healing", slug: "self-healing", title: "Self-Healing" },
    { id: "autonomous-security-responses", slug: "autonomous-security-responses", title: "Autonomous Security Responses" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "protocol-owned-resources", slug: "protocol-owned-resources", title: "Protocol-Owned Resources", preferredPlacementId: "protocol-owned-resources" },
    { id: "autonomous-liquidity-management", slug: "autonomous-liquidity-management", title: "Autonomous Liquidity Management" },
    { id: "autonomous-risk-management", slug: "autonomous-risk-management", title: "Autonomous Risk Management" },
    { id: "governance-human-override", slug: "governance-human-override", title: "Governance & Human Override" },
    { id: "verifiable-autonomous-operation", slug: "verifiable-autonomous-operation", title: "Verifiable Autonomous Operation" },
    { id: "protocol-lifecycle-automation", slug: "protocol-lifecycle-automation", title: "Protocol Lifecycle Automation" },
    // L2 topics (placements in L2_TOPICS). Bounded Autonomy (hard limits on what
    // a protocol may do by itself) is not 20's Human Oversight. Protocol
    // Invariants are 17's Invariants, not Foundations' Safety or 11's Invariant
    // Functions.
    { id: "bounded-autonomy", slug: "bounded-autonomy", title: "Bounded Autonomy" },
    { id: "protocol-autonomy-levels", slug: "protocol-autonomy-levels", title: "Protocol Autonomy Levels" },
    { id: "self-management", slug: "self-management", title: "Self-Management" },
    // Objective Functions are not 10's Mechanism Objectives; Setpoints are the
    // target values a controller holds; Protocol Health is not 05's Health Checks.
    { id: "objective-functions", slug: "objective-functions", title: "Objective Functions" },
    { id: "setpoints", slug: "setpoints", title: "Setpoints" },
    { id: "protocol-health", slug: "protocol-health", title: "Protocol Health" },
    { id: "objective-trade-offs", slug: "objective-trade-offs", title: "Objective Trade-offs" },
    { id: "objective-drift", slug: "objective-drift", title: "Objective Drift" },
    // Protocol State (03), Condition Monitoring (05) and Anomaly Detection (23)
    // are placed again. Protocol Telemetry is not 05's Metrics; State Estimation
    // is not 03's State Reconstruction; Invariant Monitoring is not 05's Health
    // Checks.
    { id: "protocol-telemetry", slug: "protocol-telemetry", title: "Protocol Telemetry" },
    { id: "state-estimation", slug: "state-estimation", title: "State Estimation" },
    { id: "invariant-monitoring", slug: "invariant-monitoring", title: "Invariant Monitoring" },
    // Feedback Loops (a protocol reacting to its own outputs) are not 09's Update
    // Models or Heartbeats (oracle updates); Control Latency is not Foundations'
    // Latency.
    { id: "feedback-loops", slug: "feedback-loops", title: "Feedback Loops" },
    { id: "feedback-controllers", slug: "feedback-controllers", title: "Feedback Controllers" },
    { id: "pid-control", slug: "pid-control", title: "PID Control" },
    { id: "control-stability", slug: "control-stability", title: "Control Stability" },
    { id: "control-latency", slug: "control-latency", title: "Control Latency" },
    // Adaptive parameters change by rule within bounds, not by vote: not 14's
    // Parameter Changes. Parameter Bounds are 19's (a parameter's permitted range,
    // whoever or whatever sets it). Dynamic Fees are not 10's Congestion Pricing; Adaptive
    // Interest Rates are not 11's Interest Rates; Adjustment Rate Limits are not
    // 05's Rate Limiting.
    { id: "adjustment-rules", slug: "adjustment-rules", title: "Adjustment Rules" },
    { id: "adjustment-rate-limits", slug: "adjustment-rate-limits", title: "Adjustment Rate Limits" },
    { id: "dynamic-fees", slug: "dynamic-fees", title: "Dynamic Fees" },
    { id: "adaptive-interest-rates", slug: "adaptive-interest-rates", title: "Adaptive Interest Rates" },
    { id: "parameter-sensitivity", slug: "parameter-sensitivity", title: "Parameter Sensitivity" },
    // Policy Constraints (21), Policy Evaluation (23) and Escalation (21) are
    // placed again. Operating Envelopes are not 21's Risk Limits; Response
    // Policies are not 14's Incident Response.
    { id: "policy-driven-operation", slug: "policy-driven-operation", title: "Policy-Driven Operation" },
    { id: "operating-envelopes", slug: "operating-envelopes", title: "Operating Envelopes" },
    { id: "response-policies", slug: "response-policies", title: "Response Policies" },
    // On-Chain Agents (agent logic executed by the protocol) are not 20's AI
    // Agents; AI-Operated Protocols are not 20's AI Agents either.
    { id: "on-chain-agents", slug: "on-chain-agents", title: "On-Chain Agents" },
    { id: "ai-operated-protocols", slug: "ai-operated-protocols", title: "AI-Operated Protocols" },
    // Keepers, Keeper Incentives and Scheduled Execution are 05's. State Cleanup
    // is not 07's Data Pruning; Dependency Management (the contracts and feeds a
    // protocol relies on) is not 02's Contract Calls.
    { id: "maintenance-tasks", slug: "maintenance-tasks", title: "Maintenance Tasks" },
    { id: "state-cleanup", slug: "state-cleanup", title: "State Cleanup" },
    { id: "dependency-management", slug: "dependency-management", title: "Dependency Management" },
    // Adaptation (behaviour changing with conditions) is not an upgrade (changed
    // code); Regime Detection is not 20's Distribution Shift; Learning
    // Mechanisms are not 20's Model Training.
    { id: "adaptive-mechanisms", slug: "adaptive-mechanisms", title: "Adaptive Mechanisms" },
    { id: "regime-detection", slug: "regime-detection", title: "Regime Detection" },
    { id: "mode-switching", slug: "mode-switching", title: "Mode Switching" },
    { id: "learning-mechanisms", slug: "learning-mechanisms", title: "Learning Mechanisms" },
    { id: "adaptation-limits", slug: "adaptation-limits", title: "Adaptation Limits" },
    { id: "adaptation-evaluation", slug: "adaptation-evaluation", title: "Adaptation Evaluation" },
    // Self-healing restores the protocol's own operation: not 23's Execution
    // Recovery (one action) or 14's Incident Response. Graceful Degradation is
    // 17's. Fault Detection is not
    // Foundations' Failures; State Repair is not 03's State Reconstruction;
    // Automatic Failover is not 04's Sequencer Rotation.
    { id: "fault-detection", slug: "fault-detection", title: "Fault Detection" },
    { id: "automatic-failover", slug: "automatic-failover", title: "Automatic Failover" },
    { id: "recovery-modes", slug: "recovery-modes", title: "Recovery Modes" },
    { id: "state-repair", slug: "state-repair", title: "State Repair" },
    // Responses the protocol takes itself, not 14's Emergency Powers or
    // Guardians. Automated Containment is 17's Containment. Circuit Breakers and Pause Mechanisms are 14's, Incident
    // Response the hand-off to it. Outflow Limits are not 21's Spending Limits.
    { id: "exploit-detection", slug: "exploit-detection", title: "Exploit Detection" },
    { id: "outflow-limits", slug: "outflow-limits", title: "Outflow Limits" },
    // Reserves (11), Revenue (21) and Resource Allocation (10) are placed again.
    // Insurance Funds are not 11's Loss Absorption; Buybacks are not 10's Burns.
    { id: "protocol-owned-liquidity", slug: "protocol-owned-liquidity", title: "Protocol-Owned Liquidity" },
    { id: "insurance-funds", slug: "insurance-funds", title: "Insurance Funds" },
    { id: "buybacks", slug: "buybacks", title: "Buybacks" },
    // Managing liquidity, not 11's Liquidity itself; Peg Defense is not 11's
    // Peg Stability; Liquidity Rebalancing is 16's Rebalancing, not 11's
    // Liquidity Provision.
    { id: "liquidity-targets", slug: "liquidity-targets", title: "Liquidity Targets" },
    { id: "liquidity-range-management", slug: "liquidity-range-management", title: "Liquidity Range Management" },
    { id: "liquidity-incentive-adjustment", slug: "liquidity-incentive-adjustment", title: "Liquidity Incentive Adjustment" },
    { id: "peg-defense", slug: "peg-defense", title: "Peg Defense" },
    // Dynamic Risk Parameters are 11's Risk Parameters adjusted by rule; Stress
    // Testing is not 23's Simulation; Automated Deleveraging is not 11's
    // Liquidations.
    { id: "risk-models", slug: "risk-models", title: "Risk Models" },
    { id: "dynamic-risk-parameters", slug: "dynamic-risk-parameters", title: "Dynamic Risk Parameters" },
    // Also placed under 26 Autonomous Economy; this placement is preferred.
    { id: "stress-testing", slug: "stress-testing", title: "Stress Testing", preferredPlacementId: "stress-testing" },
    { id: "automated-deleveraging", slug: "automated-deleveraging", title: "Automated Deleveraging" },
    // Governance decides in 14; here its decisions take effect without a human
    // executor, and humans can override autonomous operation. Override
    // Mechanisms are not 14's Veto Rights.
    { id: "automatic-enactment", slug: "automatic-enactment", title: "Automatic Enactment" },
    { id: "override-mechanisms", slug: "override-mechanisms", title: "Override Mechanisms" },
    // Operation Proofs are not 06's Computation Proofs in general; Invariant
    // Verification is not Foundations' Verification.
    { id: "operation-proofs", slug: "operation-proofs", title: "Operation Proofs" },
    { id: "invariant-verification", slug: "invariant-verification", title: "Invariant Verification" },
    // Protocol Lifecycle Automation is not 02's Contract Lifecycle or 24's
    // Organizational Lifecycle. Protocol Bootstrapping, Progressive
    // Decentralization, Ossification and Protocol Sunsetting are 19's, here as
    // automated lifecycle stages; Automated Upgrades are not 14's Protocol Upgrades
    // (decided by governance); Protocol Bootstrapping is not 24's Organizational
    // Bootstrapping.
    { id: "automated-upgrades", slug: "automated-upgrades", title: "Automated Upgrades" },
    // 26 Autonomous Economy: L1 topics. The economy that emerges when many
    // autonomous agents, organizations and protocols own assets, transact,
    // coordinate, compete and form institutions: not 21's Machine Economy (one
    // agent's economic capabilities), 22's coordination, 24's organizations or
    // 25's single self-managing protocol. Autonomous Markets are not 11's Markets
    // or 21's Agent Markets; Autonomous Commerce is not 21's Machine Commerce;
    // Economy-Wide Allocation is not 10's Resource or 21's Capital Allocation;
    // Autonomous Credit Systems are not 21's Agent Credit; Economic Institutions
    // are not 24's Autonomous Organizations; Economic Governance is not 14's;
    // Monetary Systems are not 10's Token Economics; Economic Stability is not
    // 25's Control Stability; Economic Resilience is not 23's Execution Recovery
    // or 25's Self-Healing; Autonomous Ownership Structures are not 21's Agent
    // Ownership.
    { id: "autonomous-economic-actors", slug: "autonomous-economic-actors", title: "Autonomous Economic Actors" },
    { id: "autonomous-ownership-structures", slug: "autonomous-ownership-structures", title: "Autonomous Ownership Structures" },
    { id: "autonomous-markets", slug: "autonomous-markets", title: "Autonomous Markets" },
    { id: "autonomous-commerce", slug: "autonomous-commerce", title: "Autonomous Commerce" },
    { id: "autonomous-production", slug: "autonomous-production", title: "Autonomous Production" },
    { id: "economic-sectors", slug: "economic-sectors", title: "Economic Sectors" },
    { id: "capital-payment-flows", slug: "capital-payment-flows", title: "Capital & Payment Flows" },
    { id: "economy-wide-allocation", slug: "economy-wide-allocation", title: "Economy-Wide Allocation" },
    { id: "autonomous-credit-systems", slug: "autonomous-credit-systems", title: "Autonomous Credit Systems" },
    // Also placed under 27 Frontier Systems; this placement is preferred.
    { id: "monetary-systems", slug: "monetary-systems", title: "Monetary Systems", preferredPlacementId: "monetary-systems" },
    { id: "economic-institutions", slug: "economic-institutions", title: "Economic Institutions" },
    { id: "economic-governance", slug: "economic-governance", title: "Economic Governance" },
    { id: "market-power", slug: "market-power", title: "Market Power" },
    { id: "economic-stability", slug: "economic-stability", title: "Economic Stability" },
    { id: "economic-resilience", slug: "economic-resilience", title: "Economic Resilience" },
    { id: "economic-dynamics", slug: "economic-dynamics", title: "Economic Dynamics" },
    { id: "human-machine-economic-interaction", slug: "human-machine-economic-interaction", title: "Human–Machine Economic Interaction" },
    // L2 topics (placements in L2_TOPICS). Economic Agency (the capacity to act
    // economically) is first placed here; Economic Agents are 21's. Actor
    // Specialization is not 22's Task Sharing.
    { id: "actor-populations", slug: "actor-populations", title: "Actor Populations" },
    { id: "actor-heterogeneity", slug: "actor-heterogeneity", title: "Actor Heterogeneity" },
    { id: "actor-specialization", slug: "actor-specialization", title: "Actor Specialization" },
    { id: "actor-entry-exit", slug: "actor-entry-exit", title: "Actor Entry & Exit" },
    // Protocol-Owned Resources (25) and Organizational and Beneficial Ownership
    // (21) are placed again. Ownership Concentration is not Market
    // Concentration.
    { id: "machine-owned-assets", slug: "machine-owned-assets", title: "Machine-Owned Assets" },
    { id: "ownership-chains", slug: "ownership-chains", title: "Ownership Chains" },
    { id: "ownership-concentration", slug: "ownership-concentration", title: "Ownership Concentration" },
    // Market Formation (markets arising among autonomous actors) is not 11's
    // Markets; Autonomous Pricing is not 11's Market Prices; Market Clearing is
    // not 10's Auction Clearing; Autonomous Market Making is not 11's Automated
    // Market Makers.
    { id: "market-formation", slug: "market-formation", title: "Market Formation" },
    { id: "autonomous-supply-demand", slug: "autonomous-supply-demand", title: "Autonomous Supply & Demand" },
    { id: "autonomous-pricing", slug: "autonomous-pricing", title: "Autonomous Pricing" },
    { id: "market-clearing", slug: "market-clearing", title: "Market Clearing" },
    { id: "autonomous-market-making", slug: "autonomous-market-making", title: "Autonomous Market Making" },
    // Autonomous Contracting is not 22's Negotiation; Contract Enforcement is
    // not 14's Ruling Enforcement; Commerce Networks are not 22's Agent
    // Discovery.
    { id: "autonomous-contracting", slug: "autonomous-contracting", title: "Autonomous Contracting" },
    { id: "contract-enforcement", slug: "contract-enforcement", title: "Contract Enforcement" },
    { id: "autonomous-supply-chains", slug: "autonomous-supply-chains", title: "Autonomous Supply Chains" },
    { id: "commerce-networks", slug: "commerce-networks", title: "Commerce Networks" },
    // Autonomous production is not 23's execution of one task: Autonomous
    // Services are not 21's Service Markets; Production Coordination is not 22's
    // Multi-Agent Coordination.
    { id: "autonomous-services", slug: "autonomous-services", title: "Autonomous Services" },
    { id: "service-composition", slug: "service-composition", title: "Service Composition" },
    { id: "value-chains", slug: "value-chains", title: "Value Chains" },
    { id: "production-coordination", slug: "production-coordination", title: "Production Coordination" },
    { id: "machine-productivity", slug: "machine-productivity", title: "Machine Productivity" },
    // Whole economies, not 21's Compute, Data, Model or Solver Markets; Protocol
    // Economies are not 25's Protocol-Owned Resources.
    { id: "agent-economies", slug: "agent-economies", title: "Agent Economies" },
    { id: "protocol-economies", slug: "protocol-economies", title: "Protocol Economies" },
    { id: "inter-protocol-economies", slug: "inter-protocol-economies", title: "Inter-Protocol Economies" },
    { id: "data-economies", slug: "data-economies", title: "Data Economies" },
    { id: "compute-economies", slug: "compute-economies", title: "Compute Economies" },
    { id: "model-economies", slug: "model-economies", title: "Model Economies" },
    { id: "solver-economies", slug: "solver-economies", title: "Solver Economies" },
    // Capital Flows are not 21's Machine Payments; Payment Flows are not 21's
    // Streaming Payments; Systemic Liquidity is not 11's Liquidity; Liquidity
    // Networks are not 11's Liquidity Pools.
    { id: "capital-flows", slug: "capital-flows", title: "Capital Flows" },
    { id: "payment-flows", slug: "payment-flows", title: "Payment Flows" },
    { id: "liquidity-networks", slug: "liquidity-networks", title: "Liquidity Networks" },
    { id: "systemic-liquidity", slug: "systemic-liquidity", title: "Systemic Liquidity" },
    { id: "capital-mobility", slug: "capital-mobility", title: "Capital Mobility" },
    // Economy-wide, not 21's Capital Allocation or 10's Resource Allocation;
    // Capital Formation is not 24's Organizational Bootstrapping.
    { id: "autonomous-capital-allocation", slug: "autonomous-capital-allocation", title: "Autonomous Capital Allocation" },
    { id: "economy-wide-resource-allocation", slug: "economy-wide-resource-allocation", title: "Economy-Wide Resource Allocation" },
    { id: "capital-formation", slug: "capital-formation", title: "Capital Formation" },
    // Credit Networks are not 21's Agent Credit; Systemic Leverage is not 11's
    // Collateral Ratios.
    { id: "credit-networks", slug: "credit-networks", title: "Credit Networks" },
    { id: "credit-creation", slug: "credit-creation", title: "Credit Creation" },
    { id: "systemic-leverage", slug: "systemic-leverage", title: "Systemic Leverage" },
    // Money Supply is not 10's Token Supply; Monetary Policy is not 10's
    // Issuance; Unit of Account is not 11's Market Prices.
    { id: "machine-money", slug: "machine-money", title: "Machine Money" },
    { id: "unit-of-account", slug: "unit-of-account", title: "Unit of Account" },
    { id: "money-supply", slug: "money-supply", title: "Money Supply" },
    { id: "money-velocity", slug: "money-velocity", title: "Money Velocity" },
    { id: "monetary-policy", slug: "monetary-policy", title: "Monetary Policy" },
    // Institutions, Credible Neutrality and Dispute Resolution are 14's.
    // Reputation Systems are not 08's Reputation or 21's Agent Reputation; Trust
    // Infrastructure is not Foundations' Trust Models.
    { id: "property-rights", slug: "property-rights", title: "Property Rights" },
    { id: "reputation-systems", slug: "reputation-systems", title: "Reputation Systems" },
    { id: "trust-infrastructure", slug: "trust-infrastructure", title: "Trust Infrastructure" },
    // Economic Policy is not 14's Governance Models; Taxation is not 10's Fees;
    // Redistribution is not 12's MEV Redistribution; Rent Extraction is not 12's
    // MEV Extraction.
    { id: "economic-policy", slug: "economic-policy", title: "Economic Policy" },
    { id: "taxation", slug: "taxation", title: "Taxation" },
    { id: "rent-extraction", slug: "rent-extraction", title: "Rent Extraction" },
    { id: "redistribution", slug: "redistribution", title: "Redistribution" },
    // Algorithmic Collusion (arising among autonomous pricing agents without an
    // agreement) is not Foundations' Collusion.
    { id: "market-concentration", slug: "market-concentration", title: "Market Concentration" },
    { id: "network-effects", slug: "network-effects", title: "Network Effects" },
    { id: "barriers-to-entry", slug: "barriers-to-entry", title: "Barriers to Entry" },
    { id: "algorithmic-collusion", slug: "algorithmic-collusion", title: "Algorithmic Collusion" },
    // Contagion is not 11's Counterparty Risk; Flash Crashes are not 11's
    // Depegging; Automatic Stabilizers are not 25's Feedback Controllers.
    { id: "contagion", slug: "contagion", title: "Contagion" },
    { id: "economic-shocks", slug: "economic-shocks", title: "Economic Shocks" },
    { id: "procyclicality", slug: "procyclicality", title: "Procyclicality" },
    { id: "flash-crashes", slug: "flash-crashes", title: "Flash Crashes" },
    { id: "automatic-stabilizers", slug: "automatic-stabilizers", title: "Automatic Stabilizers" },
    // Circuit Breakers are 14's and Stress Testing 25's. Backstops are not 11's
    // Loss Absorption; Economic Recovery is not 23's Execution Recovery.
    { id: "shock-absorption", slug: "shock-absorption", title: "Shock Absorption" },
    { id: "economic-diversification", slug: "economic-diversification", title: "Economic Diversification" },
    { id: "backstops", slug: "backstops", title: "Backstops" },
    { id: "economic-recovery", slug: "economic-recovery", title: "Economic Recovery" },
    // Economic Feedback Loops are not 25's Feedback Loops (one protocol's
    // control); Emergent Economic Behavior is not 22's Emergent Coordination.
    { id: "economic-feedback-loops", slug: "economic-feedback-loops", title: "Economic Feedback Loops" },
    { id: "emergent-economic-behavior", slug: "emergent-economic-behavior", title: "Emergent Economic Behavior" },
    { id: "market-cycles", slug: "market-cycles", title: "Market Cycles" },
    { id: "economic-growth", slug: "economic-growth", title: "Economic Growth" },
    { id: "economic-adaptation", slug: "economic-adaptation", title: "Economic Adaptation" },
    // Principals and Human Oversight are 20's. Economic Alignment is not 10's
    // Incentive Alignment.
    { id: "labor-substitution", slug: "labor-substitution", title: "Labor Substitution" },
    { id: "economic-alignment", slug: "economic-alignment", title: "Economic Alignment" },
    { id: "consumer-protection", slug: "consumer-protection", title: "Consumer Protection" },
    { id: "value-distribution", slug: "value-distribution", title: "Value Distribution" },
    // 27 Frontier Systems: L1 topics. Emerging architectures beyond the
    // established scope of 20–26: machine-native ownership, law, money and
    // institutions; agent societies and commons; recursive, self-modifying and
    // evolving systems; autonomous infrastructure, cyber-physical systems and
    // science. Machine-Native Monetary Systems are not 26's Monetary Systems;
    // Machine Constitutions are not 14's Constitutions; Synthetic Institutions
    // are not 14's Institutions or 26's Economic Institutions; AI-Mediated
    // Governance is not 14's Governance Models; Digital Polities are not 24's
    // Autonomous Organizations; Agent Societies are not 22's Multi-Agent
    // Coordination; Machine-Mediated Commons are not 14's governance in general;
    // Protocol Ecologies are not 16's interoperability; Autonomous Infrastructure
    // is not 05's Automation Networks; Cyber-Physical Autonomous Systems are not
    // 09's Sensors & External Systems; Autonomous Science Systems are not 22's
    // Task Markets or 21's Service Markets.
    { id: "machine-native-ownership", slug: "machine-native-ownership", title: "Machine-Native Ownership" },
    { id: "autonomous-legal-entities", slug: "autonomous-legal-entities", title: "Autonomous Legal Entities" },
    { id: "machine-native-monetary-systems", slug: "machine-native-monetary-systems", title: "Machine-Native Monetary Systems" },
    { id: "programmable-law", slug: "programmable-law", title: "Programmable Law" },
    { id: "machine-constitutions", slug: "machine-constitutions", title: "Machine Constitutions" },
    { id: "synthetic-institutions", slug: "synthetic-institutions", title: "Synthetic Institutions" },
    { id: "ai-mediated-governance", slug: "ai-mediated-governance", title: "AI-Mediated Governance" },
    { id: "digital-polities", slug: "digital-polities", title: "Digital Polities" },
    { id: "agent-societies", slug: "agent-societies", title: "Agent Societies" },
    { id: "machine-mediated-commons", slug: "machine-mediated-commons", title: "Machine-Mediated Commons" },
    { id: "recursive-autonomy", slug: "recursive-autonomy", title: "Recursive Autonomy" },
    { id: "self-modifying-systems", slug: "self-modifying-systems", title: "Self-Modifying Systems" },
    { id: "protocol-ecologies", slug: "protocol-ecologies", title: "Protocol Ecologies" },
    { id: "autonomous-infrastructure", slug: "autonomous-infrastructure", title: "Autonomous Infrastructure" },
    { id: "cyber-physical-autonomous-systems", slug: "cyber-physical-autonomous-systems", title: "Cyber-Physical Autonomous Systems" },
    { id: "autonomous-science-systems", slug: "autonomous-science-systems", title: "Autonomous Science Systems" },
    // L2 topics (placements in L2_TOPICS). Self-Owning Agents (owned by no
    // principal) are not 21's Agent Ownership; Programmable Ownership is not
    // 08's Ownership; Machine-Native Property is not 26's Machine-Owned Assets.
    // Economic Agency is 26's.
    { id: "self-owning-agents", slug: "self-owning-agents", title: "Self-Owning Agents" },
    { id: "self-sovereign-machines", slug: "self-sovereign-machines", title: "Self-Sovereign Machines" },
    { id: "programmable-ownership", slug: "programmable-ownership", title: "Programmable Ownership" },
    { id: "machine-native-property", slug: "machine-native-property", title: "Machine-Native Property" },
    // Autonomous Liability is not 24's Liability; Machine Legal Contracting is
    // not 26's Autonomous Contracting. Legal Wrappers are 24's.
    { id: "agent-legal-personhood", slug: "agent-legal-personhood", title: "Agent Legal Personhood" },
    { id: "algorithmic-entities", slug: "algorithmic-entities", title: "Algorithmic Entities" },
    { id: "autonomous-liability", slug: "autonomous-liability", title: "Autonomous Liability" },
    { id: "machine-legal-contracting", slug: "machine-legal-contracting", title: "Machine Legal Contracting" },
    // Machine-Native Money is not 26's Machine Money; Autonomous Capital
    // Formation is not 26's Capital Formation; Autonomous Monetary Authorities
    // are not 26's Monetary Policy.
    { id: "machine-native-money", slug: "machine-native-money", title: "Machine-Native Money" },
    { id: "agent-issued-currencies", slug: "agent-issued-currencies", title: "Agent-Issued Currencies" },
    { id: "compute-backed-money", slug: "compute-backed-money", title: "Compute-Backed Money" },
    { id: "autonomous-monetary-authorities", slug: "autonomous-monetary-authorities", title: "Autonomous Monetary Authorities" },
    { id: "autonomous-capital-formation", slug: "autonomous-capital-formation", title: "Autonomous Capital Formation" },
    // Programmable Law is not Foundations' Rules (a protocol's rules);
    // Computable Contracts are not 02's Smart Contracts; Embedded Compliance is
    // not 24's Organizational Compliance; Legal Oracles are not 09's Oracle
    // Networks.
    { id: "machine-executable-law", slug: "machine-executable-law", title: "Machine-Executable Law" },
    { id: "computable-contracts", slug: "computable-contracts", title: "Computable Contracts" },
    { id: "automated-regulation", slug: "automated-regulation", title: "Automated Regulation" },
    { id: "embedded-compliance", slug: "embedded-compliance", title: "Embedded Compliance" },
    { id: "legal-oracles", slug: "legal-oracles", title: "Legal Oracles" },
    { id: "code-as-law", slug: "code-as-law", title: "Code as Law" },
    // Constitutions are 14's. Adaptive Constitutions are not 14's Amendment
    // Processes.
    { id: "agent-constitutions", slug: "agent-constitutions", title: "Agent Constitutions" },
    { id: "adaptive-constitutions", slug: "adaptive-constitutions", title: "Adaptive Constitutions" },
    { id: "machine-enforced-constitutions", slug: "machine-enforced-constitutions", title: "Machine-Enforced Constitutions" },
    { id: "constitutional-verification", slug: "constitutional-verification", title: "Constitutional Verification" },
    // Institutions are 14's. Emergent Institutions (arising undesigned among
    // agents) are not 14's Institutional Evolution; Machine Arbitration is not
    // 14's Arbitration.
    { id: "agent-native-institutions", slug: "agent-native-institutions", title: "Agent-Native Institutions" },
    { id: "programmable-institutions", slug: "programmable-institutions", title: "Programmable Institutions" },
    { id: "emergent-institutions", slug: "emergent-institutions", title: "Emergent Institutions" },
    { id: "machine-arbitration", slug: "machine-arbitration", title: "Machine Arbitration" },
    { id: "institutional-composability", slug: "institutional-composability", title: "Institutional Composability" },
    // AI Delegates are not 14's Delegates; AI Deliberation is not 14's
    // Deliberation; Governance Simulation is not 23's Simulation. Human
    // Oversight is 20's.
    { id: "ai-delegates", slug: "ai-delegates", title: "AI Delegates" },
    { id: "verifiable-governance-agents", slug: "verifiable-governance-agents", title: "Verifiable Governance Agents" },
    { id: "ai-deliberation", slug: "ai-deliberation", title: "AI Deliberation" },
    { id: "ai-preference-aggregation", slug: "ai-preference-aggregation", title: "AI Preference Aggregation" },
    { id: "governance-simulation", slug: "governance-simulation", title: "Governance Simulation" },
    // Autonomous Jurisdictions are not 24's Autonomous Organizations; Digital
    // Citizenship is not 24's Organizational Membership. Exit Rights are 14's.
    { id: "autonomous-jurisdictions", slug: "autonomous-jurisdictions", title: "Autonomous Jurisdictions" },
    { id: "network-states", slug: "network-states", title: "Network States" },
    { id: "protocol-native-societies", slug: "protocol-native-societies", title: "Protocol-Native Societies" },
    { id: "digital-citizenship", slug: "digital-citizenship", title: "Digital Citizenship" },
    { id: "digital-sovereignty", slug: "digital-sovereignty", title: "Digital Sovereignty" },
    // Mixed Human–Machine Societies are not 26's Human–Machine Economic
    // Interaction; Emergent Conventions are not 22's Emergent Coordination;
    // Planetary-Scale Coordination is not Foundations' Coordination.
    { id: "open-agent-societies", slug: "open-agent-societies", title: "Open Agent Societies" },
    { id: "mixed-human-machine-societies", slug: "mixed-human-machine-societies", title: "Mixed Human–Machine Societies" },
    { id: "agent-social-norms", slug: "agent-social-norms", title: "Agent Social Norms" },
    { id: "emergent-conventions", slug: "emergent-conventions", title: "Emergent Conventions" },
    { id: "planetary-scale-coordination", slug: "planetary-scale-coordination", title: "Planetary-Scale Coordination" },
    // Commons Governance is not 14's Governance Models; Autonomous Public Goods
    // are not 14's Public Goods Funding; Commons Dilemmas are not Foundations'
    // Collective Action.
    { id: "commons-governance", slug: "commons-governance", title: "Commons Governance" },
    { id: "autonomous-public-goods", slug: "autonomous-public-goods", title: "Autonomous Public Goods" },
    { id: "commons-stewards", slug: "commons-stewards", title: "Commons Stewards" },
    { id: "commons-dilemmas", slug: "commons-dilemmas", title: "Commons Dilemmas" },
    // Recursive Organizations (organizations of organizations, all the way
    // down) are not 24's Role Hierarchies or Sub-Organizations; Agent Spawning
    // is not 22's Task Delegation.
    { id: "recursive-organizations", slug: "recursive-organizations", title: "Recursive Organizations" },
    { id: "recursively-autonomous-systems", slug: "recursively-autonomous-systems", title: "Recursively Autonomous Systems" },
    { id: "agent-spawning", slug: "agent-spawning", title: "Agent Spawning" },
    { id: "nested-autonomy", slug: "nested-autonomy", title: "Nested Autonomy" },
    { id: "recursion-limits", slug: "recursion-limits", title: "Recursion Limits" },
    // Self-Modifying Protocols are not 14's Protocol Upgrades; Self-Improving
    // Protocols are not 25's Protocol Adaptation; Self-Improving Agents are not
    // 20's Self-Correction. Corrigibility is 20's.
    { id: "self-modifying-protocols", slug: "self-modifying-protocols", title: "Self-Modifying Protocols" },
    { id: "self-improving-agents", slug: "self-improving-agents", title: "Self-Improving Agents" },
    { id: "self-improving-protocols", slug: "self-improving-protocols", title: "Self-Improving Protocols" },
    { id: "self-modification-safeguards", slug: "self-modification-safeguards", title: "Self-Modification Safeguards" },
    { id: "verifiable-self-modification", slug: "verifiable-self-modification", title: "Verifiable Self-Modification" },
    // Evolutionary Protocols (variation and selection across protocols) are not
    // 25's Adaptive Mechanisms; Multi-Protocol Ecosystems are not 26's
    // Inter-Protocol Economies.
    { id: "evolutionary-protocols", slug: "evolutionary-protocols", title: "Evolutionary Protocols" },
    { id: "protocol-selection-pressure", slug: "protocol-selection-pressure", title: "Protocol Selection Pressure" },
    { id: "multi-protocol-ecosystems", slug: "multi-protocol-ecosystems", title: "Multi-Protocol Ecosystems" },
    { id: "protocol-symbiosis", slug: "protocol-symbiosis", title: "Protocol Symbiosis" },
    { id: "ecosystem-dynamics", slug: "ecosystem-dynamics", title: "Ecosystem Dynamics" },
    // Verifiable Agent Networks are not 20's Verifiable Agents (placed here);
    // Self-Maintaining Infrastructure is not 25's Protocol Maintenance.
    { id: "decentralized-ai-infrastructure", slug: "decentralized-ai-infrastructure", title: "Decentralized AI Infrastructure" },
    { id: "verifiable-agent-networks", slug: "verifiable-agent-networks", title: "Verifiable Agent Networks" },
    { id: "self-provisioning-infrastructure", slug: "self-provisioning-infrastructure", title: "Self-Provisioning Infrastructure" },
    { id: "self-maintaining-infrastructure", slug: "self-maintaining-infrastructure", title: "Self-Maintaining Infrastructure" },
    // Cyber-Physical Interfaces are 09's. Physical Actuation is not 09's
    // Physical Events; Decentralized Physical Infrastructure is not 09's
    // Sensors.
    { id: "autonomous-robotics", slug: "autonomous-robotics", title: "Autonomous Robotics" },
    { id: "autonomous-fleets", slug: "autonomous-fleets", title: "Autonomous Fleets" },
    { id: "physical-actuation", slug: "physical-actuation", title: "Physical Actuation" },
    { id: "decentralized-physical-infrastructure", slug: "decentralized-physical-infrastructure", title: "Decentralized Physical Infrastructure" },
    { id: "physical-safety-constraints", slug: "physical-safety-constraints", title: "Physical Safety Constraints" },
    // Automated Experimentation is not 23's Dry Runs; Verifiable Research is
    // not 20's Verifiable Inference.
    { id: "autonomous-research-agents", slug: "autonomous-research-agents", title: "Autonomous Research Agents" },
    { id: "automated-experimentation", slug: "automated-experimentation", title: "Automated Experimentation" },
    { id: "self-driving-laboratories", slug: "self-driving-laboratories", title: "Self-Driving Laboratories" },
    { id: "machine-discovery", slug: "machine-discovery", title: "Machine Discovery" },
    { id: "verifiable-research", slug: "verifiable-research", title: "Verifiable Research" },
    { id: "open-science-protocols", slug: "open-science-protocols", title: "Open Science Protocols" },
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
    // (preferred), 13's Intent Settlement and 21's Machine Commerce.
    { id: "settlement", slug: "settlement", title: "Settlement", preferredPlacementId: "settlement" },
    { id: "identity", slug: "identity", title: "Identity" },
    // Also placed under 20's AI Agents; this placement (08's Machine Identity)
    // is preferred.
    { id: "agent-identity", slug: "agent-identity", title: "Agent Identity", preferredPlacementId: "agent-identity" },
    { id: "authority", slug: "authority", title: "Authority" },
    // Also placed as 21's "AI Agents" under Economic Agents; 20's placement is preferred.
    { id: "ai-agent", slug: "ai-agent", title: "AI Agent", preferredPlacementId: "ai-agent" },
    // The capacity to act economically, not 21's Economic Agents (the kinds of
    // actor that exercise it); first placed under 26's Autonomous Economic
    // Actors (preferred) and again under 27's Machine-Native Ownership. Without
    // content.
    // Also placed under 27 Frontier Systems; this placement is preferred.
    { id: "economic-agency", slug: "economic-agency", title: "Economic Agency", preferredPlacementId: "economic-agency" },
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
    // 21 Machine Economy: L1 topics.
    { id: "economic-agents", conceptId: "economic-agents", parentPlacementId: "machine-economy", order: 0 },
    { id: "agent-ownership", conceptId: "agent-ownership", parentPlacementId: "machine-economy", order: 1 },
    { id: "agent-identity-in-machine-economy", conceptId: "agent-identity", parentPlacementId: "machine-economy", order: 2 },
    { id: "agent-wallets", conceptId: "agent-wallets", parentPlacementId: "machine-economy", order: 3 },
    { id: "agent-capital", conceptId: "agent-capital", parentPlacementId: "machine-economy", order: 4 },
    { id: "agent-budgets", conceptId: "agent-budgets", parentPlacementId: "machine-economy", order: 5 },
    { id: "agent-permissions", conceptId: "agent-permissions", parentPlacementId: "machine-economy", order: 6 },
    { id: "machine-payments", conceptId: "machine-payments", parentPlacementId: "machine-economy", order: 7 },
    { id: "machine-commerce", conceptId: "machine-commerce", parentPlacementId: "machine-economy", order: 8 },
    { id: "agent-markets", conceptId: "agent-markets", parentPlacementId: "machine-economy", order: 9 },
    { id: "agent-reputation-in-machine-economy", conceptId: "agent-reputation", parentPlacementId: "machine-economy", order: 10 },
    { id: "agent-credit", conceptId: "agent-credit", parentPlacementId: "machine-economy", order: 11 },
    { id: "agent-risk", conceptId: "agent-risk", parentPlacementId: "machine-economy", order: 12 },
    { id: "agent-incentives", conceptId: "agent-incentives", parentPlacementId: "machine-economy", order: 13 },
    // 22 Autonomous Coordination: L1 topics.
    { id: "agent-to-agent-communication", conceptId: "agent-to-agent-communication", parentPlacementId: "autonomous-coordination", order: 0 },
    { id: "agent-discovery", conceptId: "agent-discovery", parentPlacementId: "autonomous-coordination", order: 1 },
    { id: "negotiation-in-autonomous-coordination", conceptId: "negotiation", parentPlacementId: "autonomous-coordination", order: 2 },
    { id: "delegation-in-autonomous-coordination", conceptId: "delegation", parentPlacementId: "autonomous-coordination", order: 3 },
    { id: "cooperation-in-autonomous-coordination", conceptId: "cooperation", parentPlacementId: "autonomous-coordination", order: 4 },
    { id: "competition-in-autonomous-coordination", conceptId: "competition", parentPlacementId: "autonomous-coordination", order: 5 },
    { id: "coalition-formation", conceptId: "coalition-formation", parentPlacementId: "autonomous-coordination", order: 6 },
    {
      id: "resource-allocation-in-autonomous-coordination",
      conceptId: "resource-allocation",
      parentPlacementId: "autonomous-coordination",
      order: 7,
    },
    { id: "task-markets", conceptId: "task-markets", parentPlacementId: "autonomous-coordination", order: 8 },
    { id: "multi-agent-coordination", conceptId: "multi-agent-coordination", parentPlacementId: "autonomous-coordination", order: 9 },
    // 23 Autonomous Execution: L1 topics.
    { id: "objectives-intents", conceptId: "objectives-intents", parentPlacementId: "autonomous-execution", order: 0 },
    { id: "execution-planning", conceptId: "execution-planning", parentPlacementId: "autonomous-execution", order: 1 },
    { id: "action-selection", conceptId: "action-selection", parentPlacementId: "autonomous-execution", order: 2 },
    { id: "simulation", conceptId: "simulation", parentPlacementId: "autonomous-execution", order: 3 },
    { id: "execution-policies", conceptId: "execution-policies", parentPlacementId: "autonomous-execution", order: 4 },
    { id: "execution-authorization", conceptId: "execution-authorization", parentPlacementId: "autonomous-execution", order: 5 },
    { id: "execution-environments", conceptId: "execution-environments", parentPlacementId: "autonomous-execution", order: 6 },
    { id: "action-execution", conceptId: "action-execution", parentPlacementId: "autonomous-execution", order: 7 },
    { id: "verification-settlement", conceptId: "verification-settlement", parentPlacementId: "autonomous-execution", order: 8 },
    { id: "execution-monitoring", conceptId: "execution-monitoring", parentPlacementId: "autonomous-execution", order: 9 },
    { id: "execution-recovery", conceptId: "execution-recovery", parentPlacementId: "autonomous-execution", order: 10 },
    // 24 Autonomous Organizations: L1 topics.
    { id: "organizations-in-autonomous-organizations", conceptId: "organizations", parentPlacementId: "autonomous-organizations", order: 0 },
    { id: "organizational-membership", conceptId: "organizational-membership", parentPlacementId: "autonomous-organizations", order: 1 },
    { id: "roles-authority", conceptId: "roles-authority", parentPlacementId: "autonomous-organizations", order: 2 },
    { id: "organizational-structure", conceptId: "organizational-structure", parentPlacementId: "autonomous-organizations", order: 3 },
    { id: "organizational-governance", conceptId: "organizational-governance", parentPlacementId: "autonomous-organizations", order: 4 },
    { id: "organizational-decision-making", conceptId: "organizational-decision-making", parentPlacementId: "autonomous-organizations", order: 5 },
    { id: "organizational-policies", conceptId: "organizational-policies", parentPlacementId: "autonomous-organizations", order: 6 },
    { id: "treasuries-in-autonomous-organizations", conceptId: "treasuries", parentPlacementId: "autonomous-organizations", order: 7 },
    { id: "organizational-budgeting", conceptId: "organizational-budgeting", parentPlacementId: "autonomous-organizations", order: 8 },
    { id: "organizational-workflows", conceptId: "organizational-workflows", parentPlacementId: "autonomous-organizations", order: 9 },
    { id: "autonomous-operations", conceptId: "autonomous-operations", parentPlacementId: "autonomous-organizations", order: 10 },
    { id: "accountability-auditability", conceptId: "accountability-auditability", parentPlacementId: "autonomous-organizations", order: 11 },
    { id: "disputes-emergency-controls", conceptId: "disputes-emergency-controls", parentPlacementId: "autonomous-organizations", order: 12 },
    { id: "organizational-lifecycle", conceptId: "organizational-lifecycle", parentPlacementId: "autonomous-organizations", order: 13 },
    { id: "inter-organizational-coordination", conceptId: "inter-organizational-coordination", parentPlacementId: "autonomous-organizations", order: 14 },
    // 25 Autonomous Protocols: L1 topics.
    { id: "protocol-autonomy", conceptId: "protocol-autonomy", parentPlacementId: "autonomous-protocols", order: 0 },
    { id: "protocol-objectives", conceptId: "protocol-objectives", parentPlacementId: "autonomous-protocols", order: 1 },
    { id: "protocol-monitoring", conceptId: "protocol-monitoring", parentPlacementId: "autonomous-protocols", order: 2 },
    { id: "control-loops", conceptId: "control-loops", parentPlacementId: "autonomous-protocols", order: 3 },
    { id: "adaptive-parameters", conceptId: "adaptive-parameters", parentPlacementId: "autonomous-protocols", order: 4 },
    { id: "protocol-policies", conceptId: "protocol-policies", parentPlacementId: "autonomous-protocols", order: 5 },
    { id: "protocol-agents", conceptId: "protocol-agents", parentPlacementId: "autonomous-protocols", order: 6 },
    { id: "protocol-maintenance", conceptId: "protocol-maintenance", parentPlacementId: "autonomous-protocols", order: 7 },
    { id: "protocol-adaptation", conceptId: "protocol-adaptation", parentPlacementId: "autonomous-protocols", order: 8 },
    { id: "self-healing", conceptId: "self-healing", parentPlacementId: "autonomous-protocols", order: 9 },
    { id: "autonomous-security-responses", conceptId: "autonomous-security-responses", parentPlacementId: "autonomous-protocols", order: 10 },
    { id: "protocol-owned-resources", conceptId: "protocol-owned-resources", parentPlacementId: "autonomous-protocols", order: 11 },
    { id: "autonomous-liquidity-management", conceptId: "autonomous-liquidity-management", parentPlacementId: "autonomous-protocols", order: 12 },
    { id: "autonomous-risk-management", conceptId: "autonomous-risk-management", parentPlacementId: "autonomous-protocols", order: 13 },
    { id: "governance-human-override", conceptId: "governance-human-override", parentPlacementId: "autonomous-protocols", order: 14 },
    { id: "verifiable-autonomous-operation", conceptId: "verifiable-autonomous-operation", parentPlacementId: "autonomous-protocols", order: 15 },
    { id: "protocol-lifecycle-automation", conceptId: "protocol-lifecycle-automation", parentPlacementId: "autonomous-protocols", order: 16 },
    // 26 Autonomous Economy: L1 topics.
    { id: "autonomous-economic-actors", conceptId: "autonomous-economic-actors", parentPlacementId: "autonomous-economy", order: 0 },
    { id: "autonomous-ownership-structures", conceptId: "autonomous-ownership-structures", parentPlacementId: "autonomous-economy", order: 1 },
    { id: "autonomous-markets", conceptId: "autonomous-markets", parentPlacementId: "autonomous-economy", order: 2 },
    { id: "autonomous-commerce", conceptId: "autonomous-commerce", parentPlacementId: "autonomous-economy", order: 3 },
    { id: "autonomous-production", conceptId: "autonomous-production", parentPlacementId: "autonomous-economy", order: 4 },
    { id: "economic-sectors", conceptId: "economic-sectors", parentPlacementId: "autonomous-economy", order: 5 },
    { id: "capital-payment-flows", conceptId: "capital-payment-flows", parentPlacementId: "autonomous-economy", order: 6 },
    { id: "economy-wide-allocation", conceptId: "economy-wide-allocation", parentPlacementId: "autonomous-economy", order: 7 },
    { id: "autonomous-credit-systems", conceptId: "autonomous-credit-systems", parentPlacementId: "autonomous-economy", order: 8 },
    { id: "monetary-systems", conceptId: "monetary-systems", parentPlacementId: "autonomous-economy", order: 9 },
    { id: "economic-institutions", conceptId: "economic-institutions", parentPlacementId: "autonomous-economy", order: 10 },
    { id: "economic-governance", conceptId: "economic-governance", parentPlacementId: "autonomous-economy", order: 11 },
    { id: "market-power", conceptId: "market-power", parentPlacementId: "autonomous-economy", order: 12 },
    { id: "economic-stability", conceptId: "economic-stability", parentPlacementId: "autonomous-economy", order: 13 },
    { id: "economic-resilience", conceptId: "economic-resilience", parentPlacementId: "autonomous-economy", order: 14 },
    { id: "economic-dynamics", conceptId: "economic-dynamics", parentPlacementId: "autonomous-economy", order: 15 },
    { id: "human-machine-economic-interaction", conceptId: "human-machine-economic-interaction", parentPlacementId: "autonomous-economy", order: 16 },
    // 27 Frontier Systems: L1 topics.
    { id: "machine-native-ownership", conceptId: "machine-native-ownership", parentPlacementId: "frontier-systems", order: 0 },
    { id: "autonomous-legal-entities", conceptId: "autonomous-legal-entities", parentPlacementId: "frontier-systems", order: 1 },
    { id: "machine-native-monetary-systems", conceptId: "machine-native-monetary-systems", parentPlacementId: "frontier-systems", order: 2 },
    { id: "programmable-law", conceptId: "programmable-law", parentPlacementId: "frontier-systems", order: 3 },
    { id: "machine-constitutions", conceptId: "machine-constitutions", parentPlacementId: "frontier-systems", order: 4 },
    { id: "synthetic-institutions", conceptId: "synthetic-institutions", parentPlacementId: "frontier-systems", order: 5 },
    { id: "ai-mediated-governance", conceptId: "ai-mediated-governance", parentPlacementId: "frontier-systems", order: 6 },
    { id: "digital-polities", conceptId: "digital-polities", parentPlacementId: "frontier-systems", order: 7 },
    { id: "agent-societies", conceptId: "agent-societies", parentPlacementId: "frontier-systems", order: 8 },
    { id: "machine-mediated-commons", conceptId: "machine-mediated-commons", parentPlacementId: "frontier-systems", order: 9 },
    { id: "recursive-autonomy", conceptId: "recursive-autonomy", parentPlacementId: "frontier-systems", order: 10 },
    { id: "self-modifying-systems", conceptId: "self-modifying-systems", parentPlacementId: "frontier-systems", order: 11 },
    { id: "protocol-ecologies", conceptId: "protocol-ecologies", parentPlacementId: "frontier-systems", order: 12 },
    { id: "autonomous-infrastructure", conceptId: "autonomous-infrastructure", parentPlacementId: "frontier-systems", order: 13 },
    { id: "cyber-physical-autonomous-systems", conceptId: "cyber-physical-autonomous-systems", parentPlacementId: "frontier-systems", order: 14 },
    { id: "autonomous-science-systems", conceptId: "autonomous-science-systems", parentPlacementId: "frontier-systems", order: 15 },
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
