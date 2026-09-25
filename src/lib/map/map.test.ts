import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mapKnowledge } from "./data.ts";
import { createMapResolver } from "./resolver.ts";
import { MapKnowledgeValidationError, validateMapKnowledge } from "./validation.ts";
import type { MapKnowledgeModel } from "./types.ts";
import { staticSocial } from "../social/content.ts";
import { buildSocialMetadata } from "../social/metadata.ts";

const resolver = createMapResolver(mapKnowledge);

// Foundations' intended L1 → L2 hierarchy, written out independently of the
// data: [placement ID, concept ID, title]. Repeated labels are listed with
// the concept they resolve to.
const FOUNDATIONS_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["protocols", [
    ["rules", "rules", "Rules"],
    ["participants", "participants", "Participants"],
    ["interactions", "interactions", "Interactions"],
    ["assumptions", "assumptions", "Assumptions"],
    ["state-in-protocols", "state", "State"],
    ["protocol-properties-in-protocols", "protocol-properties", "Protocol Properties"],
  ]],
  ["distributed-systems", [
    ["processes", "processes", "Processes"],
    ["communication", "communication", "Communication"],
    ["partial-knowledge", "partial-knowledge", "Partial Knowledge"],
    ["latency", "latency", "Latency"],
    ["failures", "failures", "Failures"],
    ["fault-models", "fault-models", "Fault Models"],
  ]],
  ["state-machines", [
    ["state-in-state-machines", "state", "State"],
    ["inputs", "inputs", "Inputs"],
    ["transitions", "transitions", "Transitions"],
    ["transition-rules", "transition-rules", "Transition Rules"],
    ["determinism", "determinism", "Determinism"],
    ["state-machine-replication", "state-machine-replication", "State Machine Replication"],
  ]],
  ["trust-models", [
    ["trust-assumptions", "trust-assumptions", "Trust Assumptions"],
    ["trusted-parties", "trusted-parties", "Trusted Parties"],
    ["trust-boundaries", "trust-boundaries", "Trust Boundaries"],
    ["verification", "verification", "Verification"],
    ["trust-minimization", "trust-minimization", "Trust Minimization"],
    ["trust-distribution", "trust-distribution", "Trust Distribution"],
  ]],
  ["coordination", [
    ["coordination-models", "coordination-models", "Coordination Models"],
    ["information", "information", "Information"],
    ["coordination-communication", "coordination-communication", "Communication"],
    ["cooperation", "cooperation", "Cooperation"],
    ["competition", "competition", "Competition"],
    ["collective-action", "collective-action", "Collective Action"],
  ]],
  ["adversarial-environments", [
    ["adversaries", "adversaries", "Adversaries"],
    ["threat-models", "threat-models", "Threat Models"],
    ["byzantine-behavior", "byzantine-behavior", "Byzantine Behavior"],
    ["censorship", "censorship", "Censorship"],
    ["collusion", "collusion", "Collusion"],
    ["strategic-behavior", "strategic-behavior", "Strategic Behavior"],
  ]],
  ["protocol-properties", [
    ["safety", "safety", "Safety"],
    ["liveness", "liveness", "Liveness"],
    ["finality-in-protocol-properties", "finality", "Finality"],
    ["availability", "availability", "Availability"],
    ["consistency", "consistency", "Consistency"],
    ["fault-tolerance", "fault-tolerance", "Fault Tolerance"],
    ["censorship-resistance", "censorship-resistance", "Censorship Resistance"],
  ]],
];
const FOUNDATIONS_LAYER = FOUNDATIONS_TREE.map(([id]) => id);
const FOUNDATIONS_L2 = FOUNDATIONS_TREE.flatMap(([, children]) => children);

// 02 Computation & Execution, in the same form. Deployment is the concept
// Contract Deployment in contextual wording; Verification is Foundations'.
const COMPUTATION_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["execution-models", [
    ["deterministic-execution", "deterministic-execution", "Deterministic Execution"],
    ["non-deterministic-execution", "non-deterministic-execution", "Non-Deterministic Execution"],
    ["sequential-execution", "sequential-execution", "Sequential Execution"],
    ["parallel-execution", "parallel-execution", "Parallel Execution"],
    ["optimistic-execution", "optimistic-execution", "Optimistic Execution"],
    ["speculative-execution", "speculative-execution", "Speculative Execution"],
  ]],
  ["transactions", [
    ["transaction-lifecycle", "transaction-lifecycle", "Transaction Lifecycle"],
    ["transaction-structure", "transaction-structure", "Transaction Structure"],
    ["transaction-ordering", "transaction-ordering", "Transaction Ordering"],
    ["transaction-validation", "transaction-validation", "Transaction Validation"],
    ["transaction-execution", "transaction-execution", "Transaction Execution"],
    ["transaction-atomicity", "transaction-atomicity", "Transaction Atomicity"],
    ["transaction-reversion", "transaction-reversion", "Transaction Reversion"],
  ]],
  ["virtual-machines", [
    ["evm", "evm", "EVM"],
    ["wasm", "wasm", "WASM"],
    ["zkvms", "zkvms", "zkVMs"],
  ]],
  ["smart-contracts", [
    ["contract-state", "contract-state", "Contract State"],
    ["contract-execution", "contract-execution", "Contract Execution"],
    ["contract-calls", "contract-calls", "Contract Calls"],
    ["message-calls", "message-calls", "Message Calls"],
    ["contract-deployment", "contract-deployment", "Deployment"],
    ["execution-context", "execution-context", "Execution Context"],
    ["contract-lifecycle", "contract-lifecycle", "Contract Lifecycle"],
  ]],
  ["verifiable-computation", [
    ["computation-integrity", "computation-integrity", "Computation Integrity"],
    ["execution-traces", "execution-traces", "Execution Traces"],
    ["computation-commitments", "computation-commitments", "Computation Commitments"],
    ["computation-proofs", "computation-proofs", "Computation Proofs"],
    ["verification-in-verifiable-computation", "verification", "Verification"],
  ]],
  ["off-chain-computation", [
    ["off-chain-execution", "off-chain-execution", "Off-Chain Execution"],
    ["on-chain-verification", "on-chain-verification", "On-Chain Verification"],
    ["trusted-execution", "trusted-execution", "Trusted Execution"],
    ["untrusted-execution", "untrusted-execution", "Untrusted Execution"],
    ["off-chain-workers", "off-chain-workers", "Off-Chain Workers"],
  ]],
  ["resource-accounting", [
    ["gas", "gas", "Gas"],
    ["execution-cost", "execution-cost", "Execution Cost"],
    ["metering", "metering", "Metering"],
    ["resource-limits", "resource-limits", "Resource Limits"],
    ["fee-accounting", "fee-accounting", "Fee Accounting"],
    ["denial-of-service-resistance", "denial-of-service-resistance", "Denial-of-Service Resistance"],
  ]],
];
const COMPUTATION_LAYER = COMPUTATION_TREE.map(([id]) => id);
const COMPUTATION_L2 = COMPUTATION_TREE.flatMap(([, children]) => children);
// 03 State & Data. Its L1 is written like its L2: [placement, concept, label].
// State Transitions is Foundations' Transitions; Checkpoints is State Checkpoints.
const STATE_DATA_LAYER: Array<[string, string, string]> = [
  ["state-representation", "state-representation", "State Representation"],
  ["transitions-in-state-data", "transitions", "State Transitions"],
  ["state-commitments", "state-commitments", "State Commitments"],
  ["historical-state", "historical-state", "Historical State"],
  ["synchronization", "synchronization", "Synchronization"],
  ["on-chain-data", "on-chain-data", "On-Chain Data"],
  ["off-chain-data", "off-chain-data", "Off-Chain Data"],
  ["data-integrity", "data-integrity", "Data Integrity"],
  ["provenance", "provenance", "Provenance"],
  ["indexing", "indexing", "Indexing"],
];
const STATE_DATA_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["state-representation", [
    ["state-models", "state-models", "State Models"],
    ["global-state", "global-state", "Global State"],
    ["local-state", "local-state", "Local State"],
    ["state-encoding", "state-encoding", "State Encoding"],
    ["state-layout", "state-layout", "State Layout"],
    ["state-roots-in-state-representation", "state-roots", "State Roots"],
  ]],
  ["transitions-in-state-data", [
    ["transition-functions", "transition-functions", "Transition Functions"],
    ["valid-transitions", "valid-transitions", "Valid Transitions"],
    ["invalid-transitions", "invalid-transitions", "Invalid Transitions"],
    ["transition-preconditions", "transition-preconditions", "Transition Preconditions"],
    ["transition-effects", "transition-effects", "Transition Effects"],
    ["atomic-state-transitions", "atomic-state-transitions", "Atomic State Transitions"],
  ]],
  ["state-commitments", [
    ["merkle-trees", "merkle-trees", "Merkle Trees"],
    ["merkle-patricia-tries", "merkle-patricia-tries", "Merkle Patricia Tries"],
    ["verkle-trees", "verkle-trees", "Verkle Trees"],
    ["commitment-schemes", "commitment-schemes", "Commitment Schemes"],
    ["state-roots-in-state-commitments", "state-roots", "State Roots"],
    ["state-proofs", "state-proofs", "State Proofs"],
  ]],
  ["historical-state", [
    ["state-history", "state-history", "State History"],
    ["historical-queries", "historical-queries", "Historical Queries"],
    ["state-snapshots", "state-snapshots", "State Snapshots"],
    ["state-checkpoints", "state-checkpoints", "Checkpoints"],
    ["archival-state", "archival-state", "Archival State"],
    ["state-reconstruction", "state-reconstruction", "State Reconstruction"],
  ]],
  ["synchronization", [
    ["initial-synchronization", "initial-synchronization", "Initial Synchronization"],
    ["full-sync", "full-sync", "Full Sync"],
    ["snap-sync", "snap-sync", "Snap Sync"],
    ["state-sync", "state-sync", "State Sync"],
    ["incremental-synchronization", "incremental-synchronization", "Incremental Synchronization"],
    ["synchronization-verification", "synchronization-verification", "Synchronization Verification"],
  ]],
  ["on-chain-data", [
    ["calldata", "calldata", "Calldata"],
    ["logs", "logs", "Logs"],
    ["events", "events", "Events"],
    ["transaction-data", "transaction-data", "Transaction Data"],
    ["block-data", "block-data", "Block Data"],
    ["protocol-state", "protocol-state", "Protocol State"],
  ]],
  ["off-chain-data", [
    ["external-data", "external-data", "External Data"],
    ["metadata", "metadata", "Metadata"],
    ["off-chain-state", "off-chain-state", "Off-Chain State"],
    ["data-references", "data-references", "Data References"],
    ["content-addressing", "content-addressing", "Content Addressing"],
  ]],
  ["data-integrity", [
    ["integrity-guarantees", "integrity-guarantees", "Integrity Guarantees"],
    ["data-hashing", "data-hashing", "Data Hashing"],
    ["data-commitments", "data-commitments", "Data Commitments"],
    ["integrity-verification", "integrity-verification", "Integrity Verification"],
    ["tamper-evidence", "tamper-evidence", "Tamper Evidence"],
    ["authenticity", "authenticity", "Authenticity"],
  ]],
  ["provenance", [
    ["data-origin", "data-origin", "Data Origin"],
    ["lineage", "lineage", "Lineage"],
    ["attribution", "attribution", "Attribution"],
    ["provenance-records", "provenance-records", "Provenance Records"],
    ["attestations", "attestations", "Attestations"],
    ["traceability", "traceability", "Traceability"],
  ]],
  ["indexing", [
    ["data-extraction", "data-extraction", "Data Extraction"],
    ["data-transformation", "data-transformation", "Data Transformation"],
    ["derived-state", "derived-state", "Derived State"],
    ["index-construction", "index-construction", "Index Construction"],
    ["query-models", "query-models", "Query Models"],
    ["reorganization-handling", "reorganization-handling", "Reorganization Handling"],
  ]],
];
const STATE_DATA_L2 = STATE_DATA_TREE.flatMap(([, children]) => children);

// 04 Consensus & Ordering. Consensus and Finality are the Phase 1 fixture's
// placements (IDs unchanged); Censorship Resistance is Foundations' concept.
const CONSENSUS_LAYER: Array<[string, string, string]> = [
  ["consensus", "consensus", "Consensus"],
  ["validators", "validators", "Validators"],
  ["fork-choice", "fork-choice", "Fork Choice"],
  ["finality-in-consensus", "finality", "Finality"],
  ["mempools", "mempools", "Mempools"],
  ["sequencing", "sequencing", "Sequencing"],
  ["block-building", "block-building", "Block Building"],
  ["proposer-builder-separation", "proposer-builder-separation", "Proposer-Builder Separation"],
  ["preconfirmations", "preconfirmations", "Preconfirmations"],
  ["censorship-resistance-in-consensus-ordering", "censorship-resistance", "Censorship Resistance"],
];
const CONSENSUS_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["consensus", [
    ["consensus-models", "consensus-models", "Consensus Models"],
    ["consensus-participants", "consensus-participants", "Consensus Participants"],
    ["consensus-rules", "consensus-rules", "Consensus Rules"],
    ["agreement", "agreement", "Agreement"],
    ["quorums", "quorums", "Quorums"],
    ["fault-assumptions", "fault-assumptions", "Fault Assumptions"],
  ]],
  ["validators", [
    ["validator-selection", "validator-selection", "Validator Selection"],
    ["validator-sets", "validator-sets", "Validator Sets"],
    ["proposers-in-validators", "proposers", "Proposers"],
    ["attesters", "attesters", "Attesters"],
    ["validator-duties", "validator-duties", "Validator Duties"],
    ["validator-incentives", "validator-incentives", "Validator Incentives"],
  ]],
  ["fork-choice", [
    ["fork-choice-rules", "fork-choice-rules", "Fork Choice Rules"],
    ["chain-selection", "chain-selection", "Chain Selection"],
    ["competing-forks", "competing-forks", "Competing Forks"],
    ["reorganizations", "reorganizations", "Reorganizations"],
    ["head-selection", "head-selection", "Head Selection"],
  ]],
  ["finality-in-consensus", [
    ["probabilistic-finality", "probabilistic-finality", "Probabilistic Finality"],
    ["deterministic-finality", "deterministic-finality", "Deterministic Finality"],
    ["finality-gadgets", "finality-gadgets", "Finality Gadgets"],
    ["checkpoints", "checkpoints", "Checkpoints"],
    ["justification", "justification", "Justification"],
    ["finalization", "finalization", "Finalization"],
  ]],
  ["mempools", [
    ["transaction-admission", "transaction-admission", "Transaction Admission"],
    ["transaction-propagation", "transaction-propagation", "Transaction Propagation"],
    ["transaction-prioritization", "transaction-prioritization", "Transaction Prioritization"],
    ["mempool-policies", "mempool-policies", "Mempool Policies"],
    ["private-mempools", "private-mempools", "Private Mempools"],
    ["mempool-synchronization", "mempool-synchronization", "Mempool Synchronization"],
  ]],
  ["sequencing", [
    ["transaction-sequencing", "transaction-sequencing", "Transaction Sequencing"],
    ["sequencing-rules", "sequencing-rules", "Sequencing Rules"],
    ["centralized-sequencing", "centralized-sequencing", "Centralized Sequencing"],
    ["decentralized-sequencing", "decentralized-sequencing", "Decentralized Sequencing"],
    ["shared-sequencing", "shared-sequencing", "Shared Sequencing"],
    ["sequencer-rotation", "sequencer-rotation", "Sequencer Rotation"],
  ]],
  ["block-building", [
    ["block-construction", "block-construction", "Block Construction"],
    ["transaction-selection", "transaction-selection", "Transaction Selection"],
    ["transaction-ordering-in-block-building", "transaction-ordering", "Transaction Ordering"],
    ["block-proposals", "block-proposals", "Block Proposals"],
    ["block-validation", "block-validation", "Block Validation"],
    ["block-production", "block-production", "Block Production"],
  ]],
  ["proposer-builder-separation", [
    ["proposers-in-proposer-builder-separation", "proposers", "Proposers"],
    ["builders", "builders", "Builders"],
    ["builder-markets", "builder-markets", "Builder Markets"],
    ["block-bids", "block-bids", "Block Bids"],
    ["relays", "relays", "Relays"],
    ["builder-selection", "builder-selection", "Builder Selection"],
  ]],
  ["preconfirmations", [
    ["execution-preconfirmations", "execution-preconfirmations", "Execution Preconfirmations"],
    ["inclusion-preconfirmations", "inclusion-preconfirmations", "Inclusion Preconfirmations"],
    ["preconfirmation-commitments", "preconfirmation-commitments", "Preconfirmation Commitments"],
    ["preconfirmation-providers", "preconfirmation-providers", "Preconfirmation Providers"],
    ["preconfirmation-guarantees", "preconfirmation-guarantees", "Preconfirmation Guarantees"],
  ]],
  ["censorship-resistance-in-consensus-ordering", [
    ["transaction-inclusion", "transaction-inclusion", "Transaction Inclusion"],
    ["inclusion-lists", "inclusion-lists", "Inclusion Lists"],
    ["forced-inclusion", "forced-inclusion", "Forced Inclusion"],
    ["censorship-detection", "censorship-detection", "Censorship Detection"],
    ["censorship-recovery", "censorship-recovery", "Censorship Recovery"],
    ["inclusion-guarantees", "inclusion-guarantees", "Inclusion Guarantees"],
  ]],
];
const CONSENSUS_L2 = CONSENSUS_TREE.flatMap(([, children]) => children);

// 05 Networks & Infrastructure. Node Synchronization and Reorganization
// Handling are State & Data's concepts; Keeper Networks is Automation Networks;
// Logs and Traces are the observability concepts System Logs and Distributed Traces.
const NETWORKS_LAYER: Array<[string, string, string]> = [
  ["p2p-networks", "p2p-networks", "P2P Networks"],
  ["message-propagation", "message-propagation", "Message Propagation"],
  ["nodes", "nodes", "Nodes"],
  ["rpc", "rpc", "RPC"],
  ["indexers", "indexers", "Indexers"],
  ["relayers", "relayers", "Relayers"],
  ["keepers", "keepers", "Keepers"],
  ["bots", "bots", "Bots"],
  ["monitoring", "monitoring", "Monitoring"],
  ["automation", "automation", "Automation"],
];
const NETWORKS_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["p2p-networks", [
    ["peer-discovery", "peer-discovery", "Peer Discovery"],
    ["peer-connections", "peer-connections", "Peer Connections"],
    ["network-topology", "network-topology", "Network Topology"],
    ["peer-management", "peer-management", "Peer Management"],
    ["gossip", "gossip", "Gossip"],
    ["network-partitions", "network-partitions", "Network Partitions"],
  ]],
  ["message-propagation", [
    ["message-dissemination", "message-dissemination", "Message Dissemination"],
    ["gossip-propagation", "gossip-propagation", "Gossip Propagation"],
    ["propagation-latency", "propagation-latency", "Propagation Latency"],
    ["message-validation", "message-validation", "Message Validation"],
    ["duplicate-suppression", "duplicate-suppression", "Duplicate Suppression"],
    ["flooding", "flooding", "Flooding"],
  ]],
  ["nodes", [
    ["full-nodes", "full-nodes", "Full Nodes"],
    ["light-nodes", "light-nodes", "Light Nodes"],
    ["archive-nodes", "archive-nodes", "Archive Nodes"],
    ["validator-nodes", "validator-nodes", "Validator Nodes"],
    ["bootnodes", "bootnodes", "Bootnodes"],
    ["synchronization-in-nodes", "synchronization", "Node Synchronization"],
  ]],
  ["rpc", [
    ["rpc-interfaces", "rpc-interfaces", "RPC Interfaces"],
    ["rpc-methods", "rpc-methods", "RPC Methods"],
    ["rpc-providers", "rpc-providers", "RPC Providers"],
    ["rpc-endpoints", "rpc-endpoints", "RPC Endpoints"],
    ["request-routing", "request-routing", "Request Routing"],
    ["rate-limiting", "rate-limiting", "Rate Limiting"],
  ]],
  ["indexers", [
    ["chain-indexers", "chain-indexers", "Chain Indexers"],
    ["event-indexing", "event-indexing", "Event Indexing"],
    ["state-indexing", "state-indexing", "State Indexing"],
    ["indexer-pipelines", "indexer-pipelines", "Indexer Pipelines"],
    ["query-services", "query-services", "Query Services"],
    ["reorganization-handling-in-indexers", "reorganization-handling", "Reorganization Handling"],
  ]],
  ["relayers", [
    ["transaction-relaying", "transaction-relaying", "Transaction Relaying"],
    ["message-relaying", "message-relaying", "Message Relaying"],
    ["relay-networks", "relay-networks", "Relay Networks"],
    ["relay-policies", "relay-policies", "Relay Policies"],
    ["relay-incentives", "relay-incentives", "Relay Incentives"],
  ]],
  ["keepers", [
    ["condition-monitoring", "condition-monitoring", "Condition Monitoring"],
    ["trigger-evaluation", "trigger-evaluation", "Trigger Evaluation"],
    ["transaction-submission", "transaction-submission", "Transaction Submission"],
    ["automation-networks-in-keepers", "automation-networks", "Keeper Networks"],
    ["keeper-incentives", "keeper-incentives", "Keeper Incentives"],
  ]],
  ["bots", [
    ["event-driven-bots", "event-driven-bots", "Event-Driven Bots"],
    ["trading-bots", "trading-bots", "Trading Bots"],
    ["liquidation-bots", "liquidation-bots", "Liquidation Bots"],
    ["arbitrage-bots", "arbitrage-bots", "Arbitrage Bots"],
    ["governance-bots", "governance-bots", "Governance Bots"],
    ["execution-bots", "execution-bots", "Execution Bots"],
  ]],
  ["monitoring", [
    ["metrics", "metrics", "Metrics"],
    ["system-logs", "system-logs", "Logs"],
    ["distributed-traces", "distributed-traces", "Traces"],
    ["health-checks", "health-checks", "Health Checks"],
    ["alerting", "alerting", "Alerting"],
    ["observability", "observability", "Observability"],
  ]],
  ["automation", [
    ["triggers", "triggers", "Triggers"],
    ["scheduled-execution", "scheduled-execution", "Scheduled Execution"],
    ["event-driven-execution", "event-driven-execution", "Event-Driven Execution"],
    ["conditional-execution", "conditional-execution", "Conditional Execution"],
    ["automation-policies", "automation-policies", "Automation Policies"],
    ["automation-networks", "automation-networks", "Automation Networks"],
  ]],
];
const NETWORKS_L2 = NETWORKS_TREE.flatMap(([, children]) => children);

// 06 Cryptography & Proofs. Verifiable Computation and Computation Proofs are
// 02's concepts, Commitment Schemes is 03's; Commitments is Cryptographic Commitments.
const CRYPTOGRAPHY_LAYER: Array<[string, string, string]> = [
  ["hash-functions", "hash-functions", "Hash Functions"],
  ["digital-signatures", "digital-signatures", "Digital Signatures"],
  ["cryptographic-commitments", "cryptographic-commitments", "Commitments"],
  ["threshold-cryptography", "threshold-cryptography", "Threshold Cryptography"],
  ["zero-knowledge-proofs", "zero-knowledge-proofs", "Zero-Knowledge Proofs"],
  ["proof-systems", "proof-systems", "Proof Systems"],
  ["verifiable-computation-in-cryptography-proofs", "verifiable-computation", "Verifiable Computation"],
  ["privacy", "privacy", "Privacy"],
];
const CRYPTOGRAPHY_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["hash-functions", [
    ["cryptographic-hash-functions", "cryptographic-hash-functions", "Cryptographic Hash Functions"],
    ["hash-properties", "hash-properties", "Hash Properties"],
    ["collision-resistance", "collision-resistance", "Collision Resistance"],
    ["preimage-resistance", "preimage-resistance", "Preimage Resistance"],
    ["domain-separation", "domain-separation", "Domain Separation"],
    ["hash-based-data-structures", "hash-based-data-structures", "Hash-Based Data Structures"],
  ]],
  ["digital-signatures", [
    ["key-pairs", "key-pairs", "Key Pairs"],
    ["signing", "signing", "Signing"],
    ["signature-verification", "signature-verification", "Signature Verification"],
    ["signature-schemes", "signature-schemes", "Signature Schemes"],
    ["signature-aggregation", "signature-aggregation", "Signature Aggregation"],
    ["multisignatures", "multisignatures", "Multisignatures"],
  ]],
  ["cryptographic-commitments", [
    ["commitment-schemes-in-cryptographic-commitments", "commitment-schemes", "Commitment Schemes"],
    ["hiding", "hiding", "Hiding"],
    ["binding", "binding", "Binding"],
    ["opening", "opening", "Opening"],
    ["polynomial-commitments", "polynomial-commitments", "Polynomial Commitments"],
    ["vector-commitments", "vector-commitments", "Vector Commitments"],
  ]],
  ["threshold-cryptography", [
    ["secret-sharing", "secret-sharing", "Secret Sharing"],
    ["threshold-signatures", "threshold-signatures", "Threshold Signatures"],
    ["distributed-key-generation", "distributed-key-generation", "Distributed Key Generation"],
    ["threshold-decryption", "threshold-decryption", "Threshold Decryption"],
    ["multi-party-computation", "multi-party-computation", "Multi-Party Computation"],
    ["quorum-cryptography", "quorum-cryptography", "Quorum Cryptography"],
  ]],
  ["zero-knowledge-proofs", [
    ["zero-knowledge", "zero-knowledge", "Zero-Knowledge"],
    ["completeness", "completeness", "Completeness"],
    ["soundness", "soundness", "Soundness"],
    ["provers", "provers", "Provers"],
    ["verifiers", "verifiers", "Verifiers"],
    ["witnesses", "witnesses", "Witnesses"],
  ]],
  ["proof-systems", [
    ["interactive-proofs", "interactive-proofs", "Interactive Proofs"],
    ["non-interactive-proofs", "non-interactive-proofs", "Non-Interactive Proofs"],
    ["snarks", "snarks", "SNARKs"],
    ["starks", "starks", "STARKs"],
    ["recursive-proofs", "recursive-proofs", "Recursive Proofs"],
    ["proof-composition", "proof-composition", "Proof Composition"],
  ]],
  ["verifiable-computation-in-cryptography-proofs", [
    ["computation-proofs-in-cryptography-proofs", "computation-proofs", "Computation Proofs"],
    ["verifiable-execution", "verifiable-execution", "Verifiable Execution"],
    ["proof-generation", "proof-generation", "Proof Generation"],
    ["proof-verification", "proof-verification", "Proof Verification"],
    ["succinct-verification", "succinct-verification", "Succinct Verification"],
    ["proof-carrying-computation", "proof-carrying-computation", "Proof-Carrying Computation"],
  ]],
  ["privacy", [
    ["confidentiality", "confidentiality", "Confidentiality"],
    ["anonymity", "anonymity", "Anonymity"],
    ["unlinkability", "unlinkability", "Unlinkability"],
    ["selective-disclosure", "selective-disclosure", "Selective Disclosure"],
    ["private-computation", "private-computation", "Private Computation"],
    ["privacy-preserving-protocols", "privacy-preserving-protocols", "Privacy-Preserving Protocols"],
  ]],
];
const CRYPTOGRAPHY_L2 = CRYPTOGRAPHY_TREE.flatMap(([, children]) => children);

// 07 Storage & Availability. Content Addressing is 03's concept, Fault Tolerance
// Foundations', Archive Nodes 05's, Proof Generation and Verification 06's;
// Reconstruction is Data Reconstruction.
const STORAGE_LAYER: Array<[string, string, string]> = [
  ["on-chain-storage", "on-chain-storage", "On-Chain Storage"],
  ["distributed-storage", "distributed-storage", "Distributed Storage"],
  ["content-addressing-in-storage-availability", "content-addressing", "Content Addressing"],
  ["archival-storage", "archival-storage", "Archival Storage"],
  ["data-availability", "data-availability", "Data Availability"],
  ["erasure-coding", "erasure-coding", "Erasure Coding"],
  ["blobs", "blobs", "Blobs"],
  ["data-availability-sampling", "data-availability-sampling", "Data Availability Sampling"],
  ["storage-proofs", "storage-proofs", "Storage Proofs"],
];
const STORAGE_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["on-chain-storage", [
    ["persistent-storage", "persistent-storage", "Persistent Storage"],
    ["storage-layout", "storage-layout", "Storage Layout"],
    ["storage-slots", "storage-slots", "Storage Slots"],
    ["storage-costs", "storage-costs", "Storage Costs"],
    ["state-storage", "state-storage", "State Storage"],
    ["storage-optimization", "storage-optimization", "Storage Optimization"],
  ]],
  ["distributed-storage", [
    ["storage-nodes", "storage-nodes", "Storage Nodes"],
    ["data-replication", "data-replication", "Data Replication"],
    ["data-distribution", "data-distribution", "Data Distribution"],
    ["redundancy", "redundancy", "Redundancy"],
    ["fault-tolerance-in-distributed-storage", "fault-tolerance", "Fault Tolerance"],
    ["storage-networks", "storage-networks", "Storage Networks"],
  ]],
  ["content-addressing-in-storage-availability", [
    ["content-identifiers", "content-identifiers", "Content Identifiers"],
    ["content-hashing", "content-hashing", "Content Hashing"],
    ["immutable-references", "immutable-references", "Immutable References"],
    ["address-resolution", "address-resolution", "Address Resolution"],
    ["content-retrieval", "content-retrieval", "Content Retrieval"],
  ]],
  ["archival-storage", [
    ["historical-data", "historical-data", "Historical Data"],
    ["long-term-storage", "long-term-storage", "Long-Term Storage"],
    ["archive-nodes-in-archival-storage", "archive-nodes", "Archive Nodes"],
    ["data-retention", "data-retention", "Data Retention"],
    ["data-pruning", "data-pruning", "Data Pruning"],
    ["state-archiving", "state-archiving", "State Archiving"],
  ]],
  ["data-availability", [
    ["availability-guarantees", "availability-guarantees", "Availability Guarantees"],
    ["data-publication", "data-publication", "Data Publication"],
    ["data-retrieval", "data-retrieval", "Data Retrieval"],
    ["availability-verification", "availability-verification", "Availability Verification"],
    ["data-withholding", "data-withholding", "Data Withholding"],
    ["availability-committees", "availability-committees", "Availability Committees"],
  ]],
  ["erasure-coding", [
    ["data-shards", "data-shards", "Data Shards"],
    ["redundant-encoding", "redundant-encoding", "Redundant Encoding"],
    ["data-reconstruction", "data-reconstruction", "Reconstruction"],
    ["coding-parameters", "coding-parameters", "Coding Parameters"],
    ["fault-recovery", "fault-recovery", "Fault Recovery"],
  ]],
  ["blobs", [
    ["blob-data", "blob-data", "Blob Data"],
    ["blob-transactions", "blob-transactions", "Blob Transactions"],
    ["blob-commitments", "blob-commitments", "Blob Commitments"],
    ["blob-propagation", "blob-propagation", "Blob Propagation"],
    ["blob-retention", "blob-retention", "Blob Retention"],
    ["blob-pricing", "blob-pricing", "Blob Pricing"],
  ]],
  ["data-availability-sampling", [
    ["sampling", "sampling", "Sampling"],
    ["random-sampling", "random-sampling", "Random Sampling"],
    ["sample-verification", "sample-verification", "Sample Verification"],
    ["availability-confidence", "availability-confidence", "Availability Confidence"],
    ["light-client-sampling", "light-client-sampling", "Light-Client Sampling"],
  ]],
  ["storage-proofs", [
    ["proof-of-storage", "proof-of-storage", "Proof of Storage"],
    ["proof-of-replication", "proof-of-replication", "Proof of Replication"],
    ["proof-of-space", "proof-of-space", "Proof of Space"],
    ["proof-of-retrievability", "proof-of-retrievability", "Proof of Retrievability"],
    ["proof-generation-in-storage-proofs", "proof-generation", "Proof Generation"],
    ["proof-verification-in-storage-proofs", "proof-verification", "Proof Verification"],
  ]],
];
const STORAGE_L2 = STORAGE_TREE.flatMap(([, children]) => children);

// 08 Identity, Accounts & Authority. Identity, Authority and Agent Identity
// are the Phase 1 fixture's placements (IDs unchanged); Attestations is 03's
// concept, Transaction Submission 05's, Signing 06's.
const IDENTITY_LAYER: Array<[string, string, string]> = [
  ["identity", "identity", "Identity"],
  ["accounts", "accounts", "Accounts"],
  ["wallets", "wallets", "Wallets"],
  ["smart-accounts", "smart-accounts", "Smart Accounts"],
  ["account-abstraction", "account-abstraction", "Account Abstraction"],
  ["authentication", "authentication", "Authentication"],
  ["authority", "authority", "Authority"],
  ["machine-identity", "machine-identity", "Machine Identity"],
];
const IDENTITY_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["identity", [
    ["addresses", "addresses", "Addresses"],
    ["decentralized-identifiers", "decentralized-identifiers", "Decentralized Identifiers"],
    ["credentials", "credentials", "Credentials"],
    ["attestations-in-identity", "attestations", "Attestations"],
    ["reputation", "reputation", "Reputation"],
  ]],
  ["accounts", [
    ["externally-owned-accounts", "externally-owned-accounts", "Externally Owned Accounts"],
    ["contract-accounts", "contract-accounts", "Contract Accounts"],
    ["account-state", "account-state", "Account State"],
    ["account-nonces", "account-nonces", "Account Nonces"],
    ["account-permissions", "account-permissions", "Account Permissions"],
    ["account-recovery", "account-recovery", "Account Recovery"],
  ]],
  ["wallets", [
    ["key-management", "key-management", "Key Management"],
    ["signing-in-wallets", "signing", "Signing"],
    ["transaction-construction", "transaction-construction", "Transaction Construction"],
    ["transaction-submission-in-wallets", "transaction-submission", "Transaction Submission"],
    ["wallet-recovery", "wallet-recovery", "Wallet Recovery"],
    ["wallet-security", "wallet-security", "Wallet Security"],
  ]],
  ["smart-accounts", [
    ["programmable-accounts", "programmable-accounts", "Programmable Accounts"],
    ["validation-logic", "validation-logic", "Validation Logic"],
    ["execution-logic", "execution-logic", "Execution Logic"],
    ["recovery-logic", "recovery-logic", "Recovery Logic"],
    ["session-keys", "session-keys", "Session Keys"],
    ["modular-accounts", "modular-accounts", "Modular Accounts"],
  ]],
  ["account-abstraction", [
    ["user-operations", "user-operations", "User Operations"],
    ["bundlers", "bundlers", "Bundlers"],
    ["entry-points", "entry-points", "Entry Points"],
    ["paymasters", "paymasters", "Paymasters"],
    ["alternative-mempools", "alternative-mempools", "Alternative Mempools"],
    ["gas-abstraction", "gas-abstraction", "Gas Abstraction"],
  ]],
  ["authentication", [
    ["authentication-factors", "authentication-factors", "Authentication Factors"],
    ["signature-authentication", "signature-authentication", "Signature Authentication"],
    ["challenge-response", "challenge-response", "Challenge-Response"],
    ["session-authentication", "session-authentication", "Session Authentication"],
    ["credential-authentication", "credential-authentication", "Credential Authentication"],
    ["authentication-policies", "authentication-policies", "Authentication Policies"],
  ]],
  ["authority", [
    ["ownership", "ownership", "Ownership"],
    ["roles", "roles", "Roles"],
    ["capabilities", "capabilities", "Capabilities"],
    ["delegation", "delegation", "Delegation"],
    ["permission-models", "permission-models", "Permission Models"],
    ["authority-boundaries", "authority-boundaries", "Authority Boundaries"],
  ]],
  ["machine-identity", [
    ["agent-identity", "agent-identity", "Agent Identity"],
    ["agent-credentials", "agent-credentials", "Agent Credentials"],
    ["agent-reputation", "agent-reputation", "Agent Reputation"],
    ["agent-authorization", "agent-authorization", "Agent Authorization"],
    ["machine-credentials", "machine-credentials", "Machine Credentials"],
    ["machine-authentication", "machine-authentication", "Machine Authentication"],
  ]],
];
const IDENTITY_L2 = IDENTITY_TREE.flatMap(([, children]) => children);

// 09 Oracles & External Reality. Provenance (03), Trust Assumptions and
// Collusion (01), Consensus (04) and Credentials (08) are reused as they are;
// External Data, Authenticity, Lineage and Attribution (03) in contextual
// wording; APIs is External APIs. Data Availability, Aggregation, Data
// Extraction, Confidence and Attesters are distinct concepts in contextual wording.
const ORACLES_LAYER: Array<[string, string, string]> = [
  ["oracle-problem", "oracle-problem", "Oracle Problem"],
  ["data-sources", "data-sources", "Data Sources"],
  ["oracle-networks", "oracle-networks", "Oracle Networks"],
  ["push-pull-oracles", "push-pull-oracles", "Push / Pull Oracles"],
  ["oracle-aggregation", "oracle-aggregation", "Aggregation"],
  ["freshness", "freshness", "Freshness"],
  ["provenance-in-oracles-external-reality", "provenance", "Provenance"],
  ["oracle-security", "oracle-security", "Oracle Security"],
  ["machine-readable-reality", "machine-readable-reality", "Machine-Readable Reality"],
  ["sensors-external-systems", "sensors-external-systems", "Sensors & External Systems"],
  ["ai-interpreted-data", "ai-interpreted-data", "AI-Interpreted Data"],
  ["real-world-attestations", "real-world-attestations", "Real-World Attestations"],
];
const ORACLES_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["oracle-problem", [
    ["external-data-in-oracle-problem", "external-data", "External Information"],
    ["trust-assumptions-in-oracle-problem", "trust-assumptions", "Trust Assumptions"],
    ["verification-limits", "verification-limits", "Verification Limits"],
    ["authenticity-in-oracle-problem", "authenticity", "Data Authenticity"],
    ["external-data-availability", "external-data-availability", "Data Availability"],
    ["oracle-failure", "oracle-failure", "Oracle Failure"],
  ]],
  ["data-sources", [
    ["primary-sources", "primary-sources", "Primary Sources"],
    ["secondary-sources", "secondary-sources", "Secondary Sources"],
    ["external-apis-in-data-sources", "external-apis", "APIs"],
    ["market-data", "market-data", "Market Data"],
    ["sensor-data", "sensor-data", "Sensor Data"],
    ["source-diversity", "source-diversity", "Source Diversity"],
  ]],
  ["oracle-networks", [
    ["oracle-nodes", "oracle-nodes", "Oracle Nodes"],
    ["node-selection", "node-selection", "Node Selection"],
    ["data-collection", "data-collection", "Data Collection"],
    ["data-reporting", "data-reporting", "Data Reporting"],
    ["consensus-in-oracle-networks", "consensus", "Consensus"],
    ["oracle-incentives", "oracle-incentives", "Oracle Incentives"],
  ]],
  ["push-pull-oracles", [
    ["push-oracles", "push-oracles", "Push Oracles"],
    ["pull-oracles", "pull-oracles", "Pull Oracles"],
    ["update-models", "update-models", "Update Models"],
    ["request-response", "request-response", "Request-Response"],
    ["on-demand-updates", "on-demand-updates", "On-Demand Updates"],
  ]],
  ["oracle-aggregation", [
    ["data-aggregation", "data-aggregation", "Data Aggregation"],
    ["medianization", "medianization", "Medianization"],
    ["weighted-aggregation", "weighted-aggregation", "Weighted Aggregation"],
    ["outlier-filtering", "outlier-filtering", "Outlier Filtering"],
    ["quorum-aggregation", "quorum-aggregation", "Quorum Aggregation"],
    ["aggregation-rules", "aggregation-rules", "Aggregation Rules"],
  ]],
  ["freshness", [
    ["update-frequency", "update-frequency", "Update Frequency"],
    ["staleness", "staleness", "Staleness"],
    ["timestamps", "timestamps", "Timestamps"],
    ["freshness-thresholds", "freshness-thresholds", "Freshness Thresholds"],
    ["heartbeats", "heartbeats", "Heartbeats"],
    ["deviation-thresholds", "deviation-thresholds", "Deviation Thresholds"],
  ]],
  ["provenance-in-oracles-external-reality", [
    ["source-provenance", "source-provenance", "Source Provenance"],
    ["lineage-in-oracles-external-reality", "lineage", "Data Lineage"],
    ["attribution-in-oracles-external-reality", "attribution", "Source Attribution"],
    ["transformation-history", "transformation-history", "Transformation History"],
    ["provenance-verification", "provenance-verification", "Provenance Verification"],
  ]],
  ["oracle-security", [
    ["oracle-manipulation", "oracle-manipulation", "Oracle Manipulation"],
    ["data-poisoning", "data-poisoning", "Data Poisoning"],
    ["source-compromise", "source-compromise", "Source Compromise"],
    ["sybil-attacks", "sybil-attacks", "Sybil Attacks"],
    ["collusion-in-oracle-security", "collusion", "Collusion"],
    ["economic-attacks", "economic-attacks", "Economic Attacks"],
  ]],
  ["machine-readable-reality", [
    ["structured-data", "structured-data", "Structured Data"],
    ["semantic-data", "semantic-data", "Semantic Data"],
    ["machine-readable-claims", "machine-readable-claims", "Machine-Readable Claims"],
    ["verifiable-claims", "verifiable-claims", "Verifiable Claims"],
    ["data-schemas", "data-schemas", "Data Schemas"],
    ["reality-interfaces", "reality-interfaces", "Reality Interfaces"],
  ]],
  ["sensors-external-systems", [
    ["sensors", "sensors", "Sensors"],
    ["iot-devices", "iot-devices", "IoT Devices"],
    ["external-apis", "external-apis", "External APIs"],
    ["trusted-hardware", "trusted-hardware", "Trusted Hardware"],
    ["physical-events", "physical-events", "Physical Events"],
    ["cyber-physical-interfaces", "cyber-physical-interfaces", "Cyber-Physical Interfaces"],
  ]],
  ["ai-interpreted-data", [
    ["unstructured-data", "unstructured-data", "Unstructured Data"],
    ["information-extraction", "information-extraction", "Data Extraction"],
    ["classification", "classification", "Classification"],
    ["ai-inference", "ai-inference", "AI Inference"],
    ["inference-confidence", "inference-confidence", "Confidence"],
    ["interpretation-verification", "interpretation-verification", "Interpretation Verification"],
  ]],
  ["real-world-attestations", [
    ["real-world-attesters", "real-world-attesters", "Attesters"],
    ["claims", "claims", "Claims"],
    ["evidence", "evidence", "Evidence"],
    ["credentials-in-real-world-attestations", "credentials", "Credentials"],
    ["attestation-verification", "attestation-verification", "Attestation Verification"],
    ["revocation", "revocation", "Revocation"],
  ]],
];
const ORACLES_L2 = ORACLES_TREE.flatMap(([, children]) => children);

// 10 Economics & Mechanism Design. Strategic Behavior is Foundations' concept;
// Economic Penalties is Penalties; Objectives and Constraints are Mechanism
// Objectives and Mechanism Constraints.
const ECONOMICS_LAYER: Array<[string, string, string]> = [
  ["incentives", "incentives", "Incentives"],
  ["mechanism-design", "mechanism-design", "Mechanism Design"],
  ["game-theory", "game-theory", "Game Theory"],
  ["strategic-behavior-in-economics-mechanism-design", "strategic-behavior", "Strategic Behavior"],
  ["token-economics", "token-economics", "Token Economics"],
  ["fees", "fees", "Fees"],
  ["auctions", "auctions", "Auctions"],
  ["resource-allocation", "resource-allocation", "Resource Allocation"],
  ["staking-economics", "staking-economics", "Staking Economics"],
  ["security-budgets", "security-budgets", "Security Budgets"],
  ["cryptoeconomic-security", "cryptoeconomic-security", "Cryptoeconomic Security"],
];
const ECONOMICS_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["incentives", [
    ["incentive-alignment", "incentive-alignment", "Incentive Alignment"],
    ["positive-incentives", "positive-incentives", "Positive Incentives"],
    ["negative-incentives", "negative-incentives", "Negative Incentives"],
    ["rewards", "rewards", "Rewards"],
    ["penalties", "penalties", "Penalties"],
    ["incentive-compatibility", "incentive-compatibility", "Incentive Compatibility"],
  ]],
  ["mechanism-design", [
    ["mechanisms", "mechanisms", "Mechanisms"],
    ["mechanism-objectives", "mechanism-objectives", "Objectives"],
    ["mechanism-constraints", "mechanism-constraints", "Constraints"],
    ["allocation-rules", "allocation-rules", "Allocation Rules"],
    ["payment-rules", "payment-rules", "Payment Rules"],
    ["mechanism-properties", "mechanism-properties", "Mechanism Properties"],
  ]],
  ["game-theory", [
    ["players", "players", "Players"],
    ["strategies", "strategies", "Strategies"],
    ["payoffs", "payoffs", "Payoffs"],
    ["best-responses", "best-responses", "Best Responses"],
    ["dominant-strategies", "dominant-strategies", "Dominant Strategies"],
    ["nash-equilibrium", "nash-equilibrium", "Nash Equilibrium"],
  ]],
  ["strategic-behavior-in-economics-mechanism-design", [
    ["rational-behavior", "rational-behavior", "Rational Behavior"],
    ["deviations", "deviations", "Deviations"],
    ["manipulation", "manipulation", "Manipulation"],
    ["free-riding", "free-riding", "Free Riding"],
    ["griefing", "griefing", "Griefing"],
    ["bribery", "bribery", "Bribery"],
  ]],
  ["token-economics", [
    ["token-supply", "token-supply", "Token Supply"],
    ["token-distribution", "token-distribution", "Token Distribution"],
    ["issuance", "issuance", "Issuance"],
    ["emissions", "emissions", "Emissions"],
    ["burns", "burns", "Burns"],
    ["token-utility", "token-utility", "Token Utility"],
  ]],
  ["fees", [
    ["transaction-fees", "transaction-fees", "Transaction Fees"],
    ["fee-markets", "fee-markets", "Fee Markets"],
    ["fee-calculation", "fee-calculation", "Fee Calculation"],
    ["fee-allocation", "fee-allocation", "Fee Allocation"],
    ["priority-fees", "priority-fees", "Priority Fees"],
    ["congestion-pricing", "congestion-pricing", "Congestion Pricing"],
  ]],
  ["auctions", [
    ["bids", "bids", "Bids"],
    ["first-price-auctions", "first-price-auctions", "First-Price Auctions"],
    ["second-price-auctions", "second-price-auctions", "Second-Price Auctions"],
    ["sealed-bid-auctions", "sealed-bid-auctions", "Sealed-Bid Auctions"],
    ["batch-auctions", "batch-auctions", "Batch Auctions"],
    ["auction-clearing", "auction-clearing", "Auction Clearing"],
  ]],
  ["resource-allocation", [
    ["scarce-resources", "scarce-resources", "Scarce Resources"],
    ["resource-pricing", "resource-pricing", "Resource Pricing"],
    ["capacity-allocation", "capacity-allocation", "Capacity Allocation"],
    ["allocation-efficiency", "allocation-efficiency", "Allocation Efficiency"],
    ["congestion", "congestion", "Congestion"],
    ["rationing", "rationing", "Rationing"],
  ]],
  ["staking-economics", [
    ["stake", "stake", "Stake"],
    ["staking-rewards", "staking-rewards", "Staking Rewards"],
    ["slashing", "slashing", "Slashing"],
    ["validator-economics", "validator-economics", "Validator Economics"],
    ["delegated-stake", "delegated-stake", "Delegated Stake"],
    ["economic-security", "economic-security", "Economic Security"],
  ]],
  ["security-budgets", [
    ["security-expenditure", "security-expenditure", "Security Expenditure"],
    ["issuance-funded-security", "issuance-funded-security", "Issuance-Funded Security"],
    ["fee-funded-security", "fee-funded-security", "Fee-Funded Security"],
    ["security-subsidies", "security-subsidies", "Security Subsidies"],
    ["attack-cost", "attack-cost", "Attack Cost"],
    ["cost-of-corruption", "cost-of-corruption", "Cost of Corruption"],
  ]],
  ["cryptoeconomic-security", [
    ["economic-guarantees", "economic-guarantees", "Economic Guarantees"],
    ["economic-finality", "economic-finality", "Economic Finality"],
    ["incentive-attacks", "incentive-attacks", "Incentive Attacks"],
    ["stake-based-security", "stake-based-security", "Stake-Based Security"],
    ["penalties-in-cryptoeconomic-security", "penalties", "Economic Penalties"],
    ["cryptoeconomic-assumptions", "cryptoeconomic-assumptions", "Cryptoeconomic Assumptions"],
  ]],
];
const ECONOMICS_L2 = ECONOMICS_TREE.flatMap(([, children]) => children);

// 11 Markets & Financial Protocols. Bids is 10's concept; Settlement is the
// fixture's general concept, first placed here; Liquidity Risk is one concept
// under Liquidity and Risk.
const MARKETS_LAYER: Array<[string, string, string]> = [
  ["assets", "assets", "Assets"],
  ["markets", "markets", "Markets"],
  ["liquidity", "liquidity", "Liquidity"],
  ["automated-market-makers", "automated-market-makers", "Automated Market Makers"],
  ["order-books", "order-books", "Order Books"],
  ["lending-borrowing", "lending-borrowing", "Lending & Borrowing"],
  ["collateral", "collateral", "Collateral"],
  ["liquidations", "liquidations", "Liquidations"],
  ["stablecoins", "stablecoins", "Stablecoins"],
  ["derivatives", "derivatives", "Derivatives"],
  ["risk", "risk", "Risk"],
  ["solvency", "solvency", "Solvency"],
];
const MARKETS_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["assets", [
    ["fungible-assets", "fungible-assets", "Fungible Assets"],
    ["non-fungible-assets", "non-fungible-assets", "Non-Fungible Assets"],
    ["native-assets", "native-assets", "Native Assets"],
    ["tokenized-assets", "tokenized-assets", "Tokenized Assets"],
    ["synthetic-assets", "synthetic-assets", "Synthetic Assets"],
    ["asset-properties", "asset-properties", "Asset Properties"],
  ]],
  ["markets", [
    ["market-participants", "market-participants", "Market Participants"],
    ["buyers", "buyers", "Buyers"],
    ["sellers", "sellers", "Sellers"],
    ["market-prices", "market-prices", "Market Prices"],
    ["market-efficiency", "market-efficiency", "Market Efficiency"],
    ["market-structure", "market-structure", "Market Structure"],
  ]],
  ["liquidity", [
    ["liquidity-providers", "liquidity-providers", "Liquidity Providers"],
    ["liquidity-provision", "liquidity-provision", "Liquidity Provision"],
    ["liquidity-depth", "liquidity-depth", "Liquidity Depth"],
    ["liquidity-fragmentation", "liquidity-fragmentation", "Liquidity Fragmentation"],
    ["capital-efficiency", "capital-efficiency", "Capital Efficiency"],
    ["liquidity-risk-in-liquidity", "liquidity-risk", "Liquidity Risk"],
  ]],
  ["automated-market-makers", [
    ["liquidity-pools", "liquidity-pools", "Liquidity Pools"],
    ["constant-product", "constant-product", "Constant Product"],
    ["invariant-functions", "invariant-functions", "Invariant Functions"],
    ["pool-reserves", "pool-reserves", "Pool Reserves"],
    ["lp-tokens", "lp-tokens", "LP Tokens"],
    ["impermanent-loss", "impermanent-loss", "Impermanent Loss"],
  ]],
  ["order-books", [
    ["orders", "orders", "Orders"],
    ["limit-orders", "limit-orders", "Limit Orders"],
    ["market-orders", "market-orders", "Market Orders"],
    ["bids-in-order-books", "bids", "Bids"],
    ["asks", "asks", "Asks"],
    ["order-matching", "order-matching", "Order Matching"],
  ]],
  ["lending-borrowing", [
    ["lending-markets", "lending-markets", "Lending Markets"],
    ["borrowers", "borrowers", "Borrowers"],
    ["lenders", "lenders", "Lenders"],
    ["interest-rates", "interest-rates", "Interest Rates"],
    ["utilization", "utilization", "Utilization"],
    ["repayment", "repayment", "Repayment"],
  ]],
  ["collateral", [
    ["collateralization", "collateralization", "Collateralization"],
    ["collateral-ratios", "collateral-ratios", "Collateral Ratios"],
    ["overcollateralization", "overcollateralization", "Overcollateralization"],
    ["undercollateralization", "undercollateralization", "Undercollateralization"],
    ["collateral-valuation", "collateral-valuation", "Collateral Valuation"],
    ["collateral-risk", "collateral-risk", "Collateral Risk"],
  ]],
  ["liquidations", [
    ["liquidation-thresholds", "liquidation-thresholds", "Liquidation Thresholds"],
    ["liquidators", "liquidators", "Liquidators"],
    ["liquidation-incentives", "liquidation-incentives", "Liquidation Incentives"],
    ["liquidation-penalties", "liquidation-penalties", "Liquidation Penalties"],
    ["liquidation-auctions", "liquidation-auctions", "Liquidation Auctions"],
    ["bad-debt", "bad-debt", "Bad Debt"],
  ]],
  ["stablecoins", [
    ["fiat-backed-stablecoins", "fiat-backed-stablecoins", "Fiat-Backed Stablecoins"],
    ["crypto-backed-stablecoins", "crypto-backed-stablecoins", "Crypto-Backed Stablecoins"],
    ["algorithmic-stablecoins", "algorithmic-stablecoins", "Algorithmic Stablecoins"],
    ["pegs", "pegs", "Pegs"],
    ["peg-stability", "peg-stability", "Peg Stability"],
    ["depegging", "depegging", "Depegging"],
  ]],
  ["derivatives", [
    ["futures", "futures", "Futures"],
    ["options", "options", "Options"],
    ["perpetuals", "perpetuals", "Perpetuals"],
    ["derivative-pricing", "derivative-pricing", "Derivative Pricing"],
    ["margin", "margin", "Margin"],
    ["settlement", "settlement", "Settlement"],
  ]],
  ["risk", [
    ["market-risk", "market-risk", "Market Risk"],
    ["credit-risk", "credit-risk", "Credit Risk"],
    ["liquidity-risk-in-risk", "liquidity-risk", "Liquidity Risk"],
    ["counterparty-risk", "counterparty-risk", "Counterparty Risk"],
    ["systemic-risk", "systemic-risk", "Systemic Risk"],
    ["risk-parameters", "risk-parameters", "Risk Parameters"],
  ]],
  ["solvency", [
    ["assets-and-liabilities", "assets-and-liabilities", "Assets and Liabilities"],
    ["reserves", "reserves", "Reserves"],
    ["capitalization", "capitalization", "Capitalization"],
    ["insolvency", "insolvency", "Insolvency"],
    ["solvency-constraints", "solvency-constraints", "Solvency Constraints"],
    ["loss-absorption", "loss-absorption", "Loss Absorption"],
  ]],
];
const MARKETS_L2 = MARKETS_TREE.flatMap(([, children]) => children);

// 12 MEV & Execution Markets. Transaction Ordering (02) and Builders (04) are
// L1 topics here too; Block Construction, Transaction Selection, Private
// Mempools and Inclusion Guarantees (04) and Auction Clearing (10) are placed again.
const MEV_LAYER: Array<[string, string, string]> = [
  ["mev", "mev", "MEV"],
  ["searchers", "searchers", "Searchers"],
  ["arbitrage", "arbitrage", "Arbitrage"],
  ["liquidation-mev", "liquidation-mev", "Liquidation MEV"],
  ["sandwiching", "sandwiching", "Sandwiching"],
  ["transaction-ordering-in-mev-execution-markets", "transaction-ordering", "Transaction Ordering"],
  ["bundles", "bundles", "Bundles"],
  ["builders-in-mev-execution-markets", "builders", "Builders"],
  ["blockspace-markets", "blockspace-markets", "Blockspace Markets"],
  ["order-flow", "order-flow", "Order Flow"],
  ["mev-auctions", "mev-auctions", "MEV Auctions"],
  ["private-execution", "private-execution", "Private Execution"],
  ["mev-mitigation", "mev-mitigation", "MEV Mitigation"],
];
const MEV_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["mev", [
    ["mev-sources", "mev-sources", "MEV Sources"],
    ["mev-opportunities", "mev-opportunities", "MEV Opportunities"],
    ["mev-extraction", "mev-extraction", "MEV Extraction"],
    ["mev-supply-chain", "mev-supply-chain", "MEV Supply Chain"],
    ["toxic-mev", "toxic-mev", "Toxic MEV"],
    ["non-toxic-mev", "non-toxic-mev", "Non-Toxic MEV"],
  ]],
  ["searchers", [
    ["search-strategies", "search-strategies", "Search Strategies"],
    ["opportunity-detection", "opportunity-detection", "Opportunity Detection"],
    ["transaction-simulation", "transaction-simulation", "Transaction Simulation"],
    ["bundle-construction", "bundle-construction", "Bundle Construction"],
    ["searcher-infrastructure", "searcher-infrastructure", "Searcher Infrastructure"],
    ["searcher-competition", "searcher-competition", "Searcher Competition"],
  ]],
  ["arbitrage", [
    ["dex-arbitrage", "dex-arbitrage", "DEX Arbitrage"],
    ["cross-market-arbitrage", "cross-market-arbitrage", "Cross-Market Arbitrage"],
    ["triangular-arbitrage", "triangular-arbitrage", "Triangular Arbitrage"],
    ["atomic-arbitrage", "atomic-arbitrage", "Atomic Arbitrage"],
    ["arbitrage-paths", "arbitrage-paths", "Arbitrage Paths"],
    ["arbitrage-profit", "arbitrage-profit", "Arbitrage Profit"],
  ]],
  ["liquidation-mev", [
    ["liquidation-opportunities", "liquidation-opportunities", "Liquidation Opportunities"],
    ["liquidation-searchers", "liquidation-searchers", "Liquidation Searchers"],
    ["liquidation-transactions", "liquidation-transactions", "Liquidation Transactions"],
    ["liquidation-competition", "liquidation-competition", "Liquidation Competition"],
    ["liquidation-profit", "liquidation-profit", "Liquidation Profit"],
    ["liquidation-risk", "liquidation-risk", "Liquidation Risk"],
  ]],
  ["sandwiching", [
    ["sandwich-attacks", "sandwich-attacks", "Sandwich Attacks"],
    ["front-running", "front-running", "Front-Running"],
    ["back-running", "back-running", "Back-Running"],
    ["victim-transactions", "victim-transactions", "Victim Transactions"],
    ["price-impact", "price-impact", "Price Impact"],
    ["slippage-exploitation", "slippage-exploitation", "Slippage Exploitation"],
  ]],
  ["transaction-ordering-in-mev-execution-markets", [
    ["ordering-rights", "ordering-rights", "Ordering Rights"],
    ["ordering-policies", "ordering-policies", "Ordering Policies"],
    ["priority-ordering", "priority-ordering", "Priority Ordering"],
    ["time-ordering", "time-ordering", "Time Ordering"],
    ["fair-ordering", "fair-ordering", "Fair Ordering"],
    ["ordering-manipulation", "ordering-manipulation", "Ordering Manipulation"],
  ]],
  ["bundles", [
    ["transaction-bundles", "transaction-bundles", "Transaction Bundles"],
    ["bundle-ordering", "bundle-ordering", "Bundle Ordering"],
    ["bundle-atomicity", "bundle-atomicity", "Bundle Atomicity"],
    ["bundle-simulation", "bundle-simulation", "Bundle Simulation"],
    ["bundle-submission", "bundle-submission", "Bundle Submission"],
    ["bundle-inclusion", "bundle-inclusion", "Bundle Inclusion"],
  ]],
  ["builders-in-mev-execution-markets", [
    ["block-construction-in-builders", "block-construction", "Block Construction"],
    ["transaction-selection-in-builders", "transaction-selection", "Transaction Selection"],
    ["bundle-selection", "bundle-selection", "Bundle Selection"],
    ["block-optimization", "block-optimization", "Block Optimization"],
    ["builder-strategies", "builder-strategies", "Builder Strategies"],
    ["builder-competition", "builder-competition", "Builder Competition"],
  ]],
  ["blockspace-markets", [
    ["blockspace", "blockspace", "Blockspace"],
    ["blockspace-demand", "blockspace-demand", "Blockspace Demand"],
    ["blockspace-supply", "blockspace-supply", "Blockspace Supply"],
    ["blockspace-pricing", "blockspace-pricing", "Blockspace Pricing"],
    ["priority-auctions", "priority-auctions", "Priority Auctions"],
    ["inclusion-markets", "inclusion-markets", "Inclusion Markets"],
  ]],
  ["order-flow", [
    ["public-order-flow", "public-order-flow", "Public Order Flow"],
    ["private-order-flow", "private-order-flow", "Private Order Flow"],
    ["order-flow-auctions", "order-flow-auctions", "Order Flow Auctions"],
    ["order-flow-payments", "order-flow-payments", "Order Flow Payments"],
    ["exclusive-order-flow", "exclusive-order-flow", "Exclusive Order Flow"],
    ["order-flow-competition", "order-flow-competition", "Order Flow Competition"],
  ]],
  ["mev-auctions", [
    ["mev-bids", "mev-bids", "MEV Bids"],
    ["builder-auctions", "builder-auctions", "Builder Auctions"],
    ["auction-participants", "auction-participants", "Auction Participants"],
    ["auction-rules", "auction-rules", "Auction Rules"],
    ["auction-clearing-in-mev-auctions", "auction-clearing", "Auction Clearing"],
    ["auction-revenue", "auction-revenue", "Auction Revenue"],
  ]],
  ["private-execution", [
    ["private-transactions", "private-transactions", "Private Transactions"],
    ["private-mempools-in-private-execution", "private-mempools", "Private Mempools"],
    ["private-relays", "private-relays", "Private Relays"],
    ["protected-order-flow", "protected-order-flow", "Protected Order Flow"],
    ["mev-protection", "mev-protection", "MEV Protection"],
    ["execution-privacy", "execution-privacy", "Execution Privacy"],
  ]],
  ["mev-mitigation", [
    ["mev-redistribution", "mev-redistribution", "MEV Redistribution"],
    ["mev-smoothing", "mev-smoothing", "MEV Smoothing"],
    ["encrypted-mempools", "encrypted-mempools", "Encrypted Mempools"],
    ["commit-reveal", "commit-reveal", "Commit-Reveal"],
    ["batch-execution", "batch-execution", "Batch Execution"],
    ["inclusion-guarantees-in-mev-mitigation", "inclusion-guarantees", "Inclusion Guarantees"],
    ["ordering-guarantees", "ordering-guarantees", "Ordering Guarantees"],
  ]],
];
const MEV_L2 = MEV_TREE.flatMap(([, children]) => children);

// 13 Intents & Coordination. Delegation (08), Batch Auctions (10), Order Flow
// Auctions (12), Preconfirmations (04), Settlement (11), Collective Action (01)
// and Shared Sequencing (04) are reused; Matching, Routing and Commitments are
// Intent Matching, Execution Routing and Intent Commitments.
const INTENTS_LAYER: Array<[string, string, string]> = [
  ["intents", "intents", "Intents"],
  ["intent-specification", "intent-specification", "Intent Specification"],
  ["intent-discovery", "intent-discovery", "Intent Discovery"],
  ["solvers", "solvers", "Solvers"],
  ["solver-competition", "solver-competition", "Solver Competition"],
  ["intent-matching", "intent-matching", "Matching"],
  ["intent-resolution", "intent-resolution", "Intent Resolution"],
  ["execution-routing", "execution-routing", "Routing"],
  ["intent-commitments", "intent-commitments", "Commitments"],
  ["intent-settlement", "intent-settlement", "Intent Settlement"],
  ["multi-party-coordination", "multi-party-coordination", "Multi-Party Coordination"],
  ["cross-domain-coordination", "cross-domain-coordination", "Cross-Domain Coordination"],
];
const INTENTS_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["intents", [
    ["declarative-execution", "declarative-execution", "Declarative Execution"],
    ["intent-expression", "intent-expression", "Intent Expression"],
    ["intent-languages", "intent-languages", "Intent Languages"],
    ["intent-standards", "intent-standards", "Intent Standards"],
    ["delegation-in-intents", "delegation", "Delegation"],
    ["intent-lifecycle", "intent-lifecycle", "Intent Lifecycle"],
  ]],
  ["intent-specification", [
    ["intent-constraints", "intent-constraints", "Intent Constraints"],
    ["user-preferences", "user-preferences", "User Preferences"],
    ["outcome-conditions", "outcome-conditions", "Outcome Conditions"],
    ["validity-windows", "validity-windows", "Validity Windows"],
    ["limit-prices", "limit-prices", "Limit Prices"],
    ["partial-fills", "partial-fills", "Partial Fills"],
  ]],
  ["intent-discovery", [
    ["intent-pools", "intent-pools", "Intent Pools"],
    ["intent-propagation", "intent-propagation", "Intent Propagation"],
    ["intent-visibility", "intent-visibility", "Intent Visibility"],
    ["intent-privacy", "intent-privacy", "Intent Privacy"],
    ["intent-aggregation", "intent-aggregation", "Intent Aggregation"],
    ["solver-access", "solver-access", "Solver Access"],
  ]],
  ["solvers", [
    ["solver-networks", "solver-networks", "Solver Networks"],
    ["solution-search", "solution-search", "Solution Search"],
    ["solver-strategies", "solver-strategies", "Solver Strategies"],
    ["solver-liquidity", "solver-liquidity", "Solver Liquidity"],
    ["solver-bonds", "solver-bonds", "Solver Bonds"],
    ["solver-reputation", "solver-reputation", "Solver Reputation"],
  ]],
  ["solver-competition", [
    ["solver-auctions", "solver-auctions", "Solver Auctions"],
    ["solution-scoring", "solution-scoring", "Solution Scoring"],
    ["winner-selection", "winner-selection", "Winner Selection"],
    ["batch-auctions-in-solver-competition", "batch-auctions", "Batch Auctions"],
    ["order-flow-auctions-in-solver-competition", "order-flow-auctions", "Order Flow Auctions"],
    ["surplus-maximization", "surplus-maximization", "Surplus Maximization"],
  ]],
  ["intent-matching", [
    ["coincidence-of-wants", "coincidence-of-wants", "Coincidence of Wants"],
    ["ring-trades", "ring-trades", "Ring Trades"],
    ["batch-matching", "batch-matching", "Batch Matching"],
    ["partial-matching", "partial-matching", "Partial Matching"],
    ["peer-to-peer-matching", "peer-to-peer-matching", "Peer-to-Peer Matching"],
    ["matching-efficiency", "matching-efficiency", "Matching Efficiency"],
  ]],
  ["intent-resolution", [
    ["solution-validity", "solution-validity", "Solution Validity"],
    ["execution-paths", "execution-paths", "Execution Paths"],
    ["execution-selection", "execution-selection", "Execution Selection"],
    ["fulfillment", "fulfillment", "Fulfillment"],
    ["fulfillment-verification", "fulfillment-verification", "Fulfillment Verification"],
    ["failed-intents", "failed-intents", "Failed Intents"],
  ]],
  ["execution-routing", [
    ["order-routing", "order-routing", "Order Routing"],
    ["liquidity-routing", "liquidity-routing", "Liquidity Routing"],
    ["route-optimization", "route-optimization", "Route Optimization"],
    ["split-routing", "split-routing", "Split Routing"],
    ["dex-aggregation", "dex-aggregation", "DEX Aggregation"],
    ["cross-venue-routing", "cross-venue-routing", "Cross-Venue Routing"],
  ]],
  ["intent-commitments", [
    ["solver-commitments", "solver-commitments", "Solver Commitments"],
    ["execution-guarantees", "execution-guarantees", "Execution Guarantees"],
    ["price-guarantees", "price-guarantees", "Price Guarantees"],
    ["preconfirmations-in-intent-commitments", "preconfirmations", "Preconfirmations"],
    ["intent-cancellation", "intent-cancellation", "Intent Cancellation"],
    ["commitment-enforcement", "commitment-enforcement", "Commitment Enforcement"],
  ]],
  ["intent-settlement", [
    ["settlement-in-intent-settlement", "settlement", "Settlement"],
    ["atomic-settlement", "atomic-settlement", "Atomic Settlement"],
    ["settlement-contracts", "settlement-contracts", "Settlement Contracts"],
    ["batch-settlement", "batch-settlement", "Batch Settlement"],
    ["net-settlement", "net-settlement", "Net Settlement"],
    ["settlement-failure", "settlement-failure", "Settlement Failure"],
  ]],
  ["multi-party-coordination", [
    ["multi-party-intents", "multi-party-intents", "Multi-Party Intents"],
    ["joint-execution", "joint-execution", "Joint Execution"],
    ["coordination-mechanisms", "coordination-mechanisms", "Coordination Mechanisms"],
    ["collective-action-in-multi-party-coordination", "collective-action", "Collective Action"],
    ["commitment-devices", "commitment-devices", "Commitment Devices"],
    ["coordination-failures", "coordination-failures", "Coordination Failures"],
  ]],
  ["cross-domain-coordination", [
    ["cross-chain-intents", "cross-chain-intents", "Cross-Chain Intents"],
    ["cross-domain-execution", "cross-domain-execution", "Cross-Domain Execution"],
    ["cross-domain-settlement", "cross-domain-settlement", "Cross-Domain Settlement"],
    ["shared-sequencing-in-cross-domain-coordination", "shared-sequencing", "Shared Sequencing"],
    ["cross-domain-atomicity", "cross-domain-atomicity", "Cross-Domain Atomicity"],
  ]],
];
const INTENTS_L2 = INTENTS_TREE.flatMap(([, children]) => children);

// 14 Governance & Institutions. Delegation (08), Evidence (09) and Incentive
// Alignment (10) are reused; governance mechanisms stay distinct from their
// technical look-alikes.
const GOVERNANCE_LAYER: Array<[string, string, string]> = [
  ["governance-models", "governance-models", "Governance Models"],
  ["governance-participants", "governance-participants", "Governance Participants"],
  ["proposals", "proposals", "Proposals"],
  ["voting", "voting", "Voting"],
  ["representation", "representation", "Representation"],
  ["decision-rules", "decision-rules", "Decision Rules"],
  ["governance-execution", "governance-execution", "Governance Execution"],
  ["councils-committees", "councils-committees", "Councils & Committees"],
  ["treasury-governance", "treasury-governance", "Treasury Governance"],
  ["constitutional-rules", "constitutional-rules", "Constitutional Rules"],
  ["checks-balances", "checks-balances", "Checks & Balances"],
  ["dispute-resolution", "dispute-resolution", "Dispute Resolution"],
  ["emergency-governance", "emergency-governance", "Emergency Governance"],
  ["governance-attacks", "governance-attacks", "Governance Attacks"],
  ["institutional-design", "institutional-design", "Institutional Design"],
];
const GOVERNANCE_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["governance-models", [
    ["on-chain-governance", "on-chain-governance", "On-Chain Governance"],
    ["off-chain-governance", "off-chain-governance", "Off-Chain Governance"],
    ["token-based-governance", "token-based-governance", "Token-Based Governance"],
    ["reputation-based-governance", "reputation-based-governance", "Reputation-Based Governance"],
    ["futarchy", "futarchy", "Futarchy"],
    ["governance-minimization", "governance-minimization", "Governance Minimization"],
  ]],
  ["governance-participants", [
    ["token-holders", "token-holders", "Token Holders"],
    ["voters", "voters", "Voters"],
    ["delegates", "delegates", "Delegates"],
    ["stewards", "stewards", "Stewards"],
    ["stakeholders", "stakeholders", "Stakeholders"],
    ["voter-participation", "voter-participation", "Voter Participation"],
  ]],
  ["proposals", [
    ["proposal-lifecycle", "proposal-lifecycle", "Proposal Lifecycle"],
    ["proposal-submission", "proposal-submission", "Proposal Submission"],
    ["proposal-thresholds", "proposal-thresholds", "Proposal Thresholds"],
    ["deliberation", "deliberation", "Deliberation"],
    ["signaling-votes", "signaling-votes", "Signaling Votes"],
    ["proposal-review", "proposal-review", "Proposal Review"],
  ]],
  ["voting", [
    ["voting-mechanisms", "voting-mechanisms", "Voting Mechanisms"],
    ["token-weighted-voting", "token-weighted-voting", "Token-Weighted Voting"],
    ["quadratic-voting", "quadratic-voting", "Quadratic Voting"],
    ["conviction-voting", "conviction-voting", "Conviction Voting"],
    ["optimistic-governance", "optimistic-governance", "Optimistic Governance"],
    ["vote-privacy", "vote-privacy", "Vote Privacy"],
  ]],
  ["representation", [
    ["delegation-in-representation", "delegation", "Delegation"],
    ["liquid-democracy", "liquid-democracy", "Liquid Democracy"],
    ["delegate-incentives", "delegate-incentives", "Delegate Incentives"],
    ["delegate-accountability", "delegate-accountability", "Delegate Accountability"],
    ["constituencies", "constituencies", "Constituencies"],
    ["representative-bodies", "representative-bodies", "Representative Bodies"],
  ]],
  ["decision-rules", [
    ["majority-rule", "majority-rule", "Majority Rule"],
    ["supermajority", "supermajority", "Supermajority"],
    ["quorum-requirements", "quorum-requirements", "Quorum Requirements"],
    ["approval-thresholds", "approval-thresholds", "Approval Thresholds"],
    ["veto-rights", "veto-rights", "Veto Rights"],
    ["tie-breaking", "tie-breaking", "Tie-Breaking"],
  ]],
  ["governance-execution", [
    ["proposal-execution", "proposal-execution", "Proposal Execution"],
    ["timelocks", "timelocks", "Timelocks"],
    ["parameter-changes", "parameter-changes", "Parameter Changes"],
    ["protocol-upgrades", "protocol-upgrades", "Protocol Upgrades"],
    ["execution-authority", "execution-authority", "Execution Authority"],
  ]],
  ["councils-committees", [
    ["security-councils", "security-councils", "Security Councils"],
    ["working-groups", "working-groups", "Working Groups"],
    ["committee-selection", "committee-selection", "Committee Selection"],
    ["mandates", "mandates", "Mandates"],
    ["term-limits", "term-limits", "Term Limits"],
    ["signer-sets", "signer-sets", "Signer Sets"],
  ]],
  ["treasury-governance", [
    ["treasuries", "treasuries", "Treasuries"],
    ["treasury-management", "treasury-management", "Treasury Management"],
    ["budget-allocation", "budget-allocation", "Budget Allocation"],
    ["grants", "grants", "Grants"],
    ["public-goods-funding", "public-goods-funding", "Public Goods Funding"],
    ["spending-controls", "spending-controls", "Spending Controls"],
  ]],
  ["constitutional-rules", [
    ["constitutions", "constitutions", "Constitutions"],
    ["rule-changes", "rule-changes", "Rule Changes"],
    ["amendment-processes", "amendment-processes", "Amendment Processes"],
    ["immutability", "immutability", "Immutability"],
    ["governance-scope", "governance-scope", "Governance Scope"],
    ["social-consensus", "social-consensus", "Social Consensus"],
  ]],
  ["checks-balances", [
    ["separation-of-powers", "separation-of-powers", "Separation of Powers"],
    ["oversight", "oversight", "Oversight"],
    ["accountability", "accountability", "Accountability"],
    ["transparency", "transparency", "Transparency"],
    ["exit-rights", "exit-rights", "Exit Rights"],
    ["minority-protection", "minority-protection", "Minority Protection"],
  ]],
  ["dispute-resolution", [
    ["arbitration", "arbitration", "Arbitration"],
    ["appeals", "appeals", "Appeals"],
    ["decentralized-courts", "decentralized-courts", "Decentralized Courts"],
    ["evidence-in-dispute-resolution", "evidence", "Evidence"],
    ["juror-selection", "juror-selection", "Juror Selection"],
    ["ruling-enforcement", "ruling-enforcement", "Ruling Enforcement"],
  ]],
  ["emergency-governance", [
    ["emergency-powers", "emergency-powers", "Emergency Powers"],
    ["pause-mechanisms", "pause-mechanisms", "Pause Mechanisms"],
    ["guardians", "guardians", "Guardians"],
    ["emergency-upgrades", "emergency-upgrades", "Emergency Upgrades"],
    ["circuit-breakers", "circuit-breakers", "Circuit Breakers"],
    ["incident-response", "incident-response", "Incident Response"],
  ]],
  ["governance-attacks", [
    ["governance-capture", "governance-capture", "Governance Capture"],
    ["vote-buying", "vote-buying", "Vote Buying"],
    ["borrowed-voting-power", "borrowed-voting-power", "Borrowed Voting Power"],
    ["voter-apathy", "voter-apathy", "Voter Apathy"],
    ["plutocracy", "plutocracy", "Plutocracy"],
    ["hostile-takeovers", "hostile-takeovers", "Hostile Takeovers"],
  ]],
  ["institutional-design", [
    ["institutions", "institutions", "Institutions"],
    ["legitimacy", "legitimacy", "Legitimacy"],
    ["credible-neutrality", "credible-neutrality", "Credible Neutrality"],
    ["incentive-alignment-in-institutional-design", "incentive-alignment", "Incentive Alignment"],
    ["path-dependence", "path-dependence", "Path Dependence"],
    ["institutional-evolution", "institutional-evolution", "Institutional Evolution"],
  ]],
];
const GOVERNANCE_L2 = GOVERNANCE_TREE.flatMap(([, children]) => children);

// 15 Scaling & Modular Systems. Scaling, Rollups and Rollups' Finality are the
// Phase 1 fixture's placements (IDs unchanged); fifteen further concepts are
// placed again at L2.
const SCALING_LAYER: Array<[string, string, string]> = [
  ["scaling", "scaling", "Scaling"],
  ["rollups", "rollups", "Rollups"],
  ["optimistic-rollups", "optimistic-rollups", "Optimistic Rollups"],
  ["zk-rollups", "zk-rollups", "ZK Rollups"],
  ["off-chain-scaling", "off-chain-scaling", "Off-Chain Scaling"],
  ["modularity", "modularity", "Modularity"],
  ["execution-layers", "execution-layers", "Execution Layers"],
  ["settlement-layers", "settlement-layers", "Settlement Layers"],
  ["data-availability-layers", "data-availability-layers", "Data Availability Layers"],
  ["consensus-layers", "consensus-layers", "Consensus Layers"],
  ["rollup-sequencing", "rollup-sequencing", "Rollup Sequencing"],
  ["batching-compression", "batching-compression", "Batching & Compression"],
  ["scaling-tradeoffs", "scaling-tradeoffs", "Scaling Tradeoffs"],
  ["rollup-security", "rollup-security", "Rollup Security"],
];
const SCALING_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["scaling", [
    ["vertical-scaling", "vertical-scaling", "Vertical Scaling"],
    ["horizontal-scaling", "horizontal-scaling", "Horizontal Scaling"],
    ["execution-scaling", "execution-scaling", "Execution Scaling"],
    ["state-growth", "state-growth", "State Growth"],
    ["scaling-bottlenecks", "scaling-bottlenecks", "Scaling Bottlenecks"],
    ["layer-2-scaling", "layer-2-scaling", "Layer 2 Scaling"],
  ]],
  ["rollups", [
    ["rollup-architecture", "rollup-architecture", "Rollup Architecture"],
    ["based-rollups", "based-rollups", "Based Rollups"],
    ["sovereign-rollups", "sovereign-rollups", "Sovereign Rollups"],
    ["rollup-state", "rollup-state", "Rollup State"],
    ["rollup-interoperability", "rollup-interoperability", "Rollup Interoperability"],
    ["finality-in-rollups", "finality", "Finality"],
  ]],
  ["optimistic-rollups", [
    ["fraud-proofs", "fraud-proofs", "Fraud Proofs"],
    ["challenge-periods", "challenge-periods", "Challenge Periods"],
    ["interactive-fraud-proofs", "interactive-fraud-proofs", "Interactive Fraud Proofs"],
    ["dispute-games", "dispute-games", "Dispute Games"],
    ["state-proposers", "state-proposers", "State Proposers"],
    ["withdrawal-delays", "withdrawal-delays", "Withdrawal Delays"],
  ]],
  ["zk-rollups", [
    ["validity-proofs", "validity-proofs", "Validity Proofs"],
    ["provers-in-zk-rollups", "provers", "Provers"],
    ["proof-aggregation", "proof-aggregation", "Proof Aggregation"],
    ["recursive-proofs-in-zk-rollups", "recursive-proofs", "Recursive Proofs"],
    ["proving-costs", "proving-costs", "Proving Costs"],
    ["zkevms", "zkevms", "zkEVMs"],
  ]],
  ["off-chain-scaling", [
    ["sidechains", "sidechains", "Sidechains"],
    ["state-channels", "state-channels", "State Channels"],
    ["payment-channels", "payment-channels", "Payment Channels"],
    ["plasma", "plasma", "Plasma"],
    ["validiums", "validiums", "Validiums"],
    ["off-chain-execution-in-off-chain-scaling", "off-chain-execution", "Off-Chain Execution"],
  ]],
  ["modularity", [
    ["modular-blockchains", "modular-blockchains", "Modular Blockchains"],
    ["monolithic-blockchains", "monolithic-blockchains", "Monolithic Blockchains"],
    ["layer-separation", "layer-separation", "Layer Separation"],
    ["component-interfaces", "component-interfaces", "Component Interfaces"],
    ["unbundling", "unbundling", "Unbundling"],
    ["modular-tradeoffs", "modular-tradeoffs", "Modular Tradeoffs"],
  ]],
  ["execution-layers", [
    ["evm-equivalence", "evm-equivalence", "EVM Equivalence"],
    ["evm-compatibility", "evm-compatibility", "EVM Compatibility"],
    ["parallel-execution-in-execution-layers", "parallel-execution", "Parallel Execution"],
    ["transition-functions-in-execution-layers", "transition-functions", "Transition Functions"],
    ["execution-clients", "execution-clients", "Execution Clients"],
    ["alternative-vms", "alternative-vms", "Alternative VMs"],
  ]],
  ["settlement-layers", [
    ["rollup-settlement", "rollup-settlement", "Rollup Settlement"],
    ["rollup-finality", "rollup-finality", "Rollup Finality"],
    ["state-commitments-in-settlement-layers", "state-commitments", "State Commitments"],
    ["withdrawals", "withdrawals", "Withdrawals"],
    ["forced-withdrawals", "forced-withdrawals", "Forced Withdrawals"],
    ["withdrawal-proofs", "withdrawal-proofs", "Withdrawal Proofs"],
  ]],
  ["data-availability-layers", [
    ["data-availability-in-data-availability-layers", "data-availability", "Data Availability"],
    ["blobs-in-data-availability-layers", "blobs", "Blobs"],
    ["data-availability-sampling-in-data-availability-layers", "data-availability-sampling", "Data Availability Sampling"],
    ["availability-committees-in-data-availability-layers", "availability-committees", "Availability Committees"],
    ["calldata-in-data-availability-layers", "calldata", "Calldata"],
    ["alternative-data-availability", "alternative-data-availability", "Alternative Data Availability"],
  ]],
  ["consensus-layers", [
    ["base-layers", "base-layers", "Base Layers"],
    ["shared-security", "shared-security", "Shared Security"],
    ["restaking", "restaking", "Restaking"],
    ["layer-coupling", "layer-coupling", "Layer Coupling"],
  ]],
  ["rollup-sequencing", [
    ["sequencers", "sequencers", "Sequencers"],
    ["centralized-sequencing-in-rollup-sequencing", "centralized-sequencing", "Centralized Sequencing"],
    ["decentralized-sequencing-in-rollup-sequencing", "decentralized-sequencing", "Decentralized Sequencing"],
    ["shared-sequencing-in-rollup-sequencing", "shared-sequencing", "Shared Sequencing"],
    ["based-sequencing", "based-sequencing", "Based Sequencing"],
    ["sequencer-liveness", "sequencer-liveness", "Sequencer Liveness"],
  ]],
  ["batching-compression", [
    ["transaction-batching", "transaction-batching", "Transaction Batching"],
    ["batch-posting", "batch-posting", "Batch Posting"],
    ["data-compression", "data-compression", "Data Compression"],
    ["state-diffs", "state-diffs", "State Diffs"],
    ["cost-amortization", "cost-amortization", "Cost Amortization"],
  ]],
  ["scaling-tradeoffs", [
    ["throughput", "throughput", "Throughput"],
    ["confirmation-latency", "confirmation-latency", "Confirmation Latency"],
    ["scaling-costs", "scaling-costs", "Scaling Costs"],
    ["decentralization", "decentralization", "Decentralization"],
    ["scalability-trilemma", "scalability-trilemma", "Scalability Trilemma"],
  ]],
  ["rollup-security", [
    ["security-inheritance", "security-inheritance", "Security Inheritance"],
    ["rollup-maturity-stages", "rollup-maturity-stages", "Rollup Maturity Stages"],
    ["upgrade-keys", "upgrade-keys", "Upgrade Keys"],
    ["escape-hatches", "escape-hatches", "Escape Hatches"],
    ["sequencer-censorship", "sequencer-censorship", "Sequencer Censorship"],
    ["trust-assumptions-in-rollup-security", "trust-assumptions", "Trust Assumptions"],
  ]],
];
const SCALING_L2 = SCALING_TREE.flatMap(([, children]) => children);

// 16 Interoperability & Abstraction. Cross-Domain Execution, Settlement and
// Atomicity (13) are L1 topics here in "Cross-Chain" wording; ten further
// concepts are placed again at L2.
const INTEROP_LAYER: Array<[string, string, string]> = [
  ["interoperability-models", "interoperability-models", "Interoperability Models"],
  ["cross-chain-messaging", "cross-chain-messaging", "Cross-Chain Messaging"],
  ["bridges", "bridges", "Bridges"],
  ["asset-bridging", "asset-bridging", "Asset Bridging"],
  ["cross-chain-state", "cross-chain-state", "Cross-Chain State"],
  ["cross-chain-verification", "cross-chain-verification", "Cross-Chain Verification"],
  ["interoperability-protocols", "interoperability-protocols", "Interoperability Protocols"],
  ["cross-domain-execution-in-interoperability-abstraction", "cross-domain-execution", "Cross-Chain Execution"],
  ["cross-domain-settlement-in-interoperability-abstraction", "cross-domain-settlement", "Cross-Chain Settlement"],
  ["cross-domain-atomicity-in-interoperability-abstraction", "cross-domain-atomicity", "Cross-Chain Atomicity"],
  ["chain-abstraction", "chain-abstraction", "Chain Abstraction"],
  ["abstraction-layers", "abstraction-layers", "Abstraction Layers"],
  ["interoperability-security", "interoperability-security", "Interoperability Security"],
  ["trust-failure-modes", "trust-failure-modes", "Trust & Failure Modes"],
];
const INTEROP_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["interoperability-models", [
    ["native-interoperability", "native-interoperability", "Native Interoperability"],
    ["trusted-interoperability", "trusted-interoperability", "Trusted Interoperability"],
    ["trust-minimized-interoperability", "trust-minimized-interoperability", "Trust-Minimized Interoperability"],
    ["hub-and-spoke-interoperability", "hub-and-spoke-interoperability", "Hub-and-Spoke Interoperability"],
    ["point-to-point-interoperability", "point-to-point-interoperability", "Point-to-Point Interoperability"],
    ["cross-chain-composability", "cross-chain-composability", "Cross-Chain Composability"],
  ]],
  ["cross-chain-messaging", [
    ["cross-chain-messages", "cross-chain-messages", "Cross-Chain Messages"],
    ["message-delivery", "message-delivery", "Message Delivery"],
    ["message-ordering", "message-ordering", "Message Ordering"],
    ["replay-protection", "replay-protection", "Replay Protection"],
    ["message-authentication", "message-authentication", "Message Authentication"],
    ["relayers-in-cross-chain-messaging", "relayers", "Relayers"],
  ]],
  ["bridges", [
    ["bridge-contracts", "bridge-contracts", "Bridge Contracts"],
    ["bridge-operators", "bridge-operators", "Bridge Operators"],
    ["bridge-custody", "bridge-custody", "Bridge Custody"],
    ["canonical-bridges", "canonical-bridges", "Canonical Bridges"],
    ["third-party-bridges", "third-party-bridges", "Third-Party Bridges"],
    ["bridge-upgradeability", "bridge-upgradeability", "Bridge Upgradeability"],
  ]],
  ["asset-bridging", [
    ["lock-and-mint", "lock-and-mint", "Lock-and-Mint"],
    ["burn-and-mint", "burn-and-mint", "Burn-and-Mint"],
    ["liquidity-based-bridging", "liquidity-based-bridging", "Liquidity-Based Bridging"],
    ["wrapped-assets", "wrapped-assets", "Wrapped Assets"],
    ["canonical-assets", "canonical-assets", "Canonical Assets"],
    ["bridged-asset-risk", "bridged-asset-risk", "Bridged Asset Risk"],
  ]],
  ["cross-chain-state", [
    ["remote-state", "remote-state", "Remote State"],
    ["state-proofs-in-cross-chain-state", "state-proofs", "State Proofs"],
    ["state-roots-in-cross-chain-state", "state-roots", "State Roots"],
    ["cross-chain-queries", "cross-chain-queries", "Cross-Chain Queries"],
    ["header-relaying", "header-relaying", "Header Relaying"],
    ["cross-chain-state-sync", "cross-chain-state-sync", "Cross-Chain State Sync"],
  ]],
  ["cross-chain-verification", [
    ["light-client-verification", "light-client-verification", "Light-Client Verification"],
    ["zk-verification", "zk-verification", "ZK Verification"],
    ["optimistic-verification", "optimistic-verification", "Optimistic Verification"],
    ["committee-verification", "committee-verification", "Committee Verification"],
    ["finality-in-cross-chain-verification", "finality", "Finality"],
    ["verification-latency", "verification-latency", "Verification Latency"],
  ]],
  ["interoperability-protocols", [
    ["interoperability-standards", "interoperability-standards", "Interoperability Standards"],
    ["messaging-protocols", "messaging-protocols", "Messaging Protocols"],
    ["inter-blockchain-communication", "inter-blockchain-communication", "Inter-Blockchain Communication"],
    ["cross-chain-token-standards", "cross-chain-token-standards", "Cross-Chain Token Standards"],
    ["protocol-adapters", "protocol-adapters", "Protocol Adapters"],
    ["interoperability-layers", "interoperability-layers", "Interoperability Layers"],
  ]],
  ["cross-domain-execution-in-interoperability-abstraction", [
    ["cross-chain-transactions", "cross-chain-transactions", "Cross-Chain Transactions"],
    ["cross-chain-calls", "cross-chain-calls", "Cross-Chain Calls"],
    ["remote-execution", "remote-execution", "Remote Execution"],
    ["execution-callbacks", "execution-callbacks", "Execution Callbacks"],
    ["cross-chain-intents-in-cross-chain-execution", "cross-chain-intents", "Cross-Chain Intents"],
    ["execution-failure-handling", "execution-failure-handling", "Execution Failure Handling"],
  ]],
  ["cross-domain-settlement-in-interoperability-abstraction", [
    ["settlement-latency", "settlement-latency", "Settlement Latency"],
    ["settlement-proofs", "settlement-proofs", "Settlement Proofs"],
    ["rebalancing", "rebalancing", "Rebalancing"],
    ["solver-repayment", "solver-repayment", "Solver Repayment"],
    ["reorg-risk", "reorg-risk", "Reorg Risk"],
  ]],
  ["cross-domain-atomicity-in-interoperability-abstraction", [
    ["atomic-swaps", "atomic-swaps", "Atomic Swaps"],
    ["hashed-timelock-contracts", "hashed-timelock-contracts", "Hashed Timelock Contracts"],
    ["two-phase-commit", "two-phase-commit", "Two-Phase Commit"],
    ["shared-sequencing-in-cross-chain-atomicity", "shared-sequencing", "Shared Sequencing"],
    ["partial-failures", "partial-failures", "Partial Failures"],
    ["atomicity-guarantees", "atomicity-guarantees", "Atomicity Guarantees"],
  ]],
  ["chain-abstraction", [
    ["unified-accounts", "unified-accounts", "Unified Accounts"],
    ["unified-balances", "unified-balances", "Unified Balances"],
    ["chain-agnostic-interfaces", "chain-agnostic-interfaces", "Chain-Agnostic Interfaces"],
    ["chain-routing", "chain-routing", "Chain Routing"],
    ["resource-locks", "resource-locks", "Resource Locks"],
    ["account-abstraction-in-chain-abstraction", "account-abstraction", "Account Abstraction"],
  ]],
  ["abstraction-layers", [
    ["asset-abstraction", "asset-abstraction", "Asset Abstraction"],
    ["gas-abstraction-in-abstraction-layers", "gas-abstraction", "Gas Abstraction"],
    ["liquidity-abstraction", "liquidity-abstraction", "Liquidity Abstraction"],
    ["intent-based-abstraction", "intent-based-abstraction", "Intent-Based Abstraction"],
    ["execution-abstraction", "execution-abstraction", "Execution Abstraction"],
  ]],
  ["interoperability-security", [
    ["bridge-security", "bridge-security", "Bridge Security"],
    ["bridge-exploits", "bridge-exploits", "Bridge Exploits"],
    ["verifier-compromise", "verifier-compromise", "Verifier Compromise"],
    ["message-forgery", "message-forgery", "Message Forgery"],
    ["replay-attacks", "replay-attacks", "Replay Attacks"],
    ["transfer-limits", "transfer-limits", "Transfer Limits"],
  ]],
  ["trust-failure-modes", [
    ["trust-assumptions-in-trust-failure-modes", "trust-assumptions", "Trust Assumptions"],
    ["liveness-failures", "liveness-failures", "Liveness Failures"],
    ["safety-failures", "safety-failures", "Safety Failures"],
    ["failure-isolation", "failure-isolation", "Failure Isolation"],
    ["contagion-risk", "contagion-risk", "Contagion Risk"],
    ["pause-mechanisms-in-trust-failure-modes", "pause-mechanisms", "Pause Mechanisms"],
  ]],
];
const INTEROP_L2 = INTEROP_TREE.flatMap(([, children]) => children);

// 17 Security, Correctness & Resilience. Incident Response (14) is an L1 topic
// here; 37 further concepts are placed again at L2, each preferred at its home.
const SECURITY_LAYER: Array<[string, string, string]> = [
  ["security-models", "security-models", "Security Models"],
  ["security-properties", "security-properties", "Security Properties"],
  ["threat-modeling", "threat-modeling", "Threat Modeling"],
  ["attack-classes", "attack-classes", "Attack Classes"],
  ["vulnerabilities-exploits", "vulnerabilities-exploits", "Vulnerabilities & Exploits"],
  ["smart-contract-security", "smart-contract-security", "Smart Contract Security"],
  ["protocol-security", "protocol-security", "Protocol Security"],
  ["correctness", "correctness", "Correctness"],
  ["formal-methods", "formal-methods", "Formal Methods"],
  ["testing", "testing", "Testing"],
  ["auditing", "auditing", "Auditing"],
  ["access-control", "access-control", "Access Control"],
  ["key-security", "key-security", "Key Security"],
  ["operational-security", "operational-security", "Operational Security"],
  ["security-monitoring", "security-monitoring", "Security Monitoring"],
  ["incident-response-in-security-correctness-resilience", "incident-response", "Incident Response"],
  ["resilience", "resilience", "Resilience"],
  ["security-economics", "security-economics", "Security Economics"],
  ["upgrade-security", "upgrade-security", "Upgrade Security"],
  ["domain-specific-security", "domain-specific-security", "Domain-Specific Security"],
];
const SECURITY_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["security-models", [
    ["threat-models-in-security-models", "threat-models", "Threat Models"],
    ["adversaries-in-security-models", "adversaries", "Adversaries"],
    ["byzantine-behavior-in-security-models", "byzantine-behavior", "Byzantine Behavior"],
    ["trust-boundaries-in-security-models", "trust-boundaries", "Trust Boundaries"],
    ["security-assumptions", "security-assumptions", "Security Assumptions"],
    ["defense-in-depth", "defense-in-depth", "Defense in Depth"],
  ]],
  ["security-properties", [
    ["safety-in-security-properties", "safety", "Safety"],
    ["liveness-in-security-properties", "liveness", "Liveness"],
    ["integrity", "integrity", "Integrity"],
    ["confidentiality-in-security-properties", "confidentiality", "Confidentiality"],
    ["availability-in-security-properties", "availability", "Availability"],
    ["censorship-resistance-in-security-properties", "censorship-resistance", "Censorship Resistance"],
  ]],
  ["threat-modeling", [
    ["attack-surfaces", "attack-surfaces", "Attack Surfaces"],
    ["attack-vectors", "attack-vectors", "Attack Vectors"],
    ["threat-analysis", "threat-analysis", "Threat Analysis"],
    ["risk-assessment", "risk-assessment", "Risk Assessment"],
    ["attack-trees", "attack-trees", "Attack Trees"],
    ["security-requirements", "security-requirements", "Security Requirements"],
  ]],
  ["attack-classes", [
    ["denial-of-service-attacks", "denial-of-service-attacks", "Denial-of-Service Attacks"],
    ["sybil-attacks-in-attack-classes", "sybil-attacks", "Sybil Attacks"],
    ["eclipse-attacks", "eclipse-attacks", "Eclipse Attacks"],
    ["replay-attacks-in-attack-classes", "replay-attacks", "Replay Attacks"],
    ["collusion-in-attack-classes", "collusion", "Collusion"],
    ["griefing-in-attack-classes", "griefing", "Griefing"],
  ]],
  ["vulnerabilities-exploits", [
    ["vulnerabilities", "vulnerabilities", "Vulnerabilities"],
    ["exploits", "exploits", "Exploits"],
    ["vulnerability-classes", "vulnerability-classes", "Vulnerability Classes"],
    ["zero-day-vulnerabilities", "zero-day-vulnerabilities", "Zero-Day Vulnerabilities"],
    ["vulnerability-disclosure", "vulnerability-disclosure", "Vulnerability Disclosure"],
    ["bug-bounties", "bug-bounties", "Bug Bounties"],
  ]],
  ["smart-contract-security", [
    ["reentrancy", "reentrancy", "Reentrancy"],
    ["arithmetic-errors", "arithmetic-errors", "Arithmetic Errors"],
    ["access-control-flaws", "access-control-flaws", "Access Control Flaws"],
    ["unchecked-external-calls", "unchecked-external-calls", "Unchecked External Calls"],
    ["flash-loan-attacks", "flash-loan-attacks", "Flash Loan Attacks"],
    ["oracle-manipulation-in-smart-contract-security", "oracle-manipulation", "Oracle Manipulation"],
  ]],
  ["protocol-security", [
    ["execution-security", "execution-security", "Execution Security"],
    ["consensus-attacks", "consensus-attacks", "Consensus Attacks"],
    ["network-attacks", "network-attacks", "Network Attacks"],
    ["cryptographic-failures", "cryptographic-failures", "Cryptographic Failures"],
    ["data-integrity-attacks", "data-integrity-attacks", "Data Integrity Attacks"],
    ["identity-attacks", "identity-attacks", "Identity Attacks"],
    ["economic-attacks-in-protocol-security", "economic-attacks", "Economic Attacks"],
  ]],
  ["correctness", [
    ["specifications", "specifications", "Specifications"],
    ["invariants", "invariants", "Invariants"],
    ["functional-correctness", "functional-correctness", "Functional Correctness"],
    ["validation", "validation", "Validation"],
    ["verification-in-correctness", "verification", "Verification"],
    ["correctness-proofs", "correctness-proofs", "Correctness Proofs"],
  ]],
  ["formal-methods", [
    ["formal-verification", "formal-verification", "Formal Verification"],
    ["model-checking", "model-checking", "Model Checking"],
    ["theorem-proving", "theorem-proving", "Theorem Proving"],
    ["symbolic-execution", "symbolic-execution", "Symbolic Execution"],
    ["static-analysis", "static-analysis", "Static Analysis"],
    ["formal-specifications", "formal-specifications", "Formal Specifications"],
  ]],
  ["testing", [
    ["unit-testing", "unit-testing", "Unit Testing"],
    ["integration-testing", "integration-testing", "Integration Testing"],
    ["fuzzing", "fuzzing", "Fuzzing"],
    ["property-based-testing", "property-based-testing", "Property-Based Testing"],
    ["invariant-testing", "invariant-testing", "Invariant Testing"],
    ["adversarial-testing", "adversarial-testing", "Adversarial Testing"],
  ]],
  ["auditing", [
    ["security-audits", "security-audits", "Security Audits"],
    ["code-review", "code-review", "Code Review"],
    ["audit-scope", "audit-scope", "Audit Scope"],
    ["audit-findings", "audit-findings", "Audit Findings"],
    ["remediation", "remediation", "Remediation"],
    ["continuous-auditing", "continuous-auditing", "Continuous Auditing"],
  ]],
  ["access-control", [
    ["authentication-in-access-control", "authentication", "Authentication"],
    ["authorization", "authorization", "Authorization"],
    ["permission-models-in-access-control", "permission-models", "Permission Models"],
    ["least-privilege", "least-privilege", "Least Privilege"],
    ["privilege-escalation", "privilege-escalation", "Privilege Escalation"],
    ["role-based-access-control", "role-based-access-control", "Role-Based Access Control"],
  ]],
  ["key-security", [
    ["key-compromise", "key-compromise", "Key Compromise"],
    ["key-custody", "key-custody", "Key Custody"],
    ["key-rotation", "key-rotation", "Key Rotation"],
    ["hardware-security-modules", "hardware-security-modules", "Hardware Security Modules"],
    ["blind-signing", "blind-signing", "Blind Signing"],
    ["social-engineering", "social-engineering", "Social Engineering"],
  ]],
  ["operational-security", [
    ["infrastructure-security", "infrastructure-security", "Infrastructure Security"],
    ["deployment-security", "deployment-security", "Deployment Security"],
    ["configuration-errors", "configuration-errors", "Configuration Errors"],
    ["supply-chain-security", "supply-chain-security", "Supply Chain Security"],
    ["insider-threats", "insider-threats", "Insider Threats"],
    ["operational-failures", "operational-failures", "Operational Failures"],
  ]],
  ["security-monitoring", [
    ["threat-detection", "threat-detection", "Threat Detection"],
    ["anomaly-detection", "anomaly-detection", "Anomaly Detection"],
    ["alerting-in-security-monitoring", "alerting", "Alerting"],
    ["on-chain-monitoring", "on-chain-monitoring", "On-Chain Monitoring"],
    ["security-telemetry", "security-telemetry", "Security Telemetry"],
    ["forensics", "forensics", "Forensics"],
  ]],
  ["incident-response-in-security-correctness-resilience", [
    ["containment", "containment", "Containment"],
    ["pause-mechanisms-in-incident-response", "pause-mechanisms", "Pause Mechanisms"],
    ["circuit-breakers-in-incident-response", "circuit-breakers", "Circuit Breakers"],
    ["response-coordination", "response-coordination", "Response Coordination"],
    ["post-mortems", "post-mortems", "Post-Mortems"],
    ["incident-disclosure", "incident-disclosure", "Incident Disclosure"],
  ]],
  ["resilience", [
    ["fault-tolerance-in-resilience", "fault-tolerance", "Fault Tolerance"],
    ["redundancy-in-resilience", "redundancy", "Redundancy"],
    ["graceful-degradation", "graceful-degradation", "Graceful Degradation"],
    ["failure-isolation-in-resilience", "failure-isolation", "Failure Isolation"],
    ["recovery", "recovery", "Recovery"],
    ["disaster-recovery", "disaster-recovery", "Disaster Recovery"],
  ]],
  ["security-economics", [
    ["economic-security-in-security-economics", "economic-security", "Economic Security"],
    ["cryptographic-security", "cryptographic-security", "Cryptographic Security"],
    ["attack-cost-in-security-economics", "attack-cost", "Attack Cost"],
    ["cost-of-corruption-in-security-economics", "cost-of-corruption", "Cost of Corruption"],
    ["security-inheritance-in-security-economics", "security-inheritance", "Security Inheritance"],
  ]],
  ["upgrade-security", [
    ["upgrade-keys-in-upgrade-security", "upgrade-keys", "Upgrade Keys"],
    ["timelocks-in-upgrade-security", "timelocks", "Timelocks"],
    ["proxy-upgrade-risks", "proxy-upgrade-risks", "Proxy Upgrade Risks"],
    ["upgrade-verification", "upgrade-verification", "Upgrade Verification"],
    ["emergency-upgrades-in-upgrade-security", "emergency-upgrades", "Emergency Upgrades"],
  ]],
  ["domain-specific-security", [
    ["oracle-security-in-domain-specific-security", "oracle-security", "Oracle Security"],
    ["governance-attacks-in-domain-specific-security", "governance-attacks", "Governance Attacks"],
    ["rollup-security-in-domain-specific-security", "rollup-security", "Rollup Security"],
    ["bridge-security-in-domain-specific-security", "bridge-security", "Bridge Security"],
    ["mev-protection-in-domain-specific-security", "mev-protection", "MEV Protection"],
    ["wallet-security-in-domain-specific-security", "wallet-security", "Wallet Security"],
  ]],
];
const SECURITY_L2 = SECURITY_TREE.flatMap(([, children]) => children);

// 18 Protocol Architecture. Fourteen concepts are placed again at L2, each
// preferred at its home.
const ARCHITECTURE_LAYER: Array<[string, string, string]> = [
  ["architectural-principles", "architectural-principles", "Architectural Principles"],
  ["protocol-layers", "protocol-layers", "Protocol Layers"],
  ["components-interfaces", "components-interfaces", "Components & Interfaces"],
  ["state-architecture", "state-architecture", "State Architecture"],
  ["execution-architecture", "execution-architecture", "Execution Architecture"],
  ["contract-architecture", "contract-architecture", "Smart Contract Architecture"],
  ["client-architecture", "client-architecture", "Client Architecture"],
  ["network-architecture", "network-architecture", "Network Architecture"],
  ["data-architecture", "data-architecture", "Data Architecture"],
  ["trust-architecture", "trust-architecture", "Trust Architecture"],
  ["composability", "composability", "Composability"],
  ["architectural-tradeoffs", "architectural-tradeoffs", "Architectural Tradeoffs"],
];
const ARCHITECTURE_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["architectural-principles", [
    ["separation-of-concerns", "separation-of-concerns", "Separation of Concerns"],
    ["abstraction-boundaries", "abstraction-boundaries", "Abstraction Boundaries"],
    ["protocol-minimalism", "protocol-minimalism", "Protocol Minimalism"],
    ["credible-neutrality-in-architectural-principles", "credible-neutrality", "Credible Neutrality"],
    ["decentralization-in-architectural-principles", "decentralization", "Decentralization"],
  ]],
  ["protocol-layers", [
    ["layered-architecture", "layered-architecture", "Layered Architecture"],
    ["protocol-stack", "protocol-stack", "Protocol Stack"],
    ["layer-responsibilities", "layer-responsibilities", "Layer Responsibilities"],
    ["cross-layer-dependencies", "cross-layer-dependencies", "Cross-Layer Dependencies"],
    ["modularity-in-protocol-layers", "modularity", "Modularity"],
    ["layer-separation-in-protocol-layers", "layer-separation", "Layer Separation"],
  ]],
  ["components-interfaces", [
    ["protocol-components", "protocol-components", "Protocol Components"],
    ["component-interfaces-in-components-interfaces", "component-interfaces", "Component Interfaces"],
    ["protocol-standards", "protocol-standards", "Protocol Standards"],
    ["component-dependencies", "component-dependencies", "Component Dependencies"],
    ["extension-points", "extension-points", "Extension Points"],
    ["protocol-hooks", "protocol-hooks", "Protocol Hooks"],
  ]],
  ["state-architecture", [
    ["state-models-in-state-architecture", "state-models", "State Models"],
    ["state-ownership", "state-ownership", "State Ownership"],
    ["state-partitioning", "state-partitioning", "State Partitioning"],
    ["state-access-patterns", "state-access-patterns", "State Access Patterns"],
    ["shared-state", "shared-state", "Shared State"],
    ["state-isolation", "state-isolation", "State Isolation"],
  ]],
  ["execution-architecture", [
    ["execution-models-in-execution-architecture", "execution-models", "Execution Models"],
    ["execution-pipelines", "execution-pipelines", "Execution Pipelines"],
    ["execution-scheduling", "execution-scheduling", "Execution Scheduling"],
    ["execution-boundaries", "execution-boundaries", "Execution Boundaries"],
    ["call-graphs", "call-graphs", "Call Graphs"],
    ["concurrency-models", "concurrency-models", "Concurrency Models"],
  ]],
  ["contract-architecture", [
    ["contract-systems", "contract-systems", "Contract Systems"],
    ["proxy-patterns", "proxy-patterns", "Proxy Patterns"],
    ["factory-patterns", "factory-patterns", "Factory Patterns"],
    ["contract-libraries", "contract-libraries", "Contract Libraries"],
    ["singleton-contracts", "singleton-contracts", "Singleton Contracts"],
    ["contract-registries", "contract-registries", "Contract Registries"],
  ]],
  ["client-architecture", [
    ["execution-clients-in-client-architecture", "execution-clients", "Execution Clients"],
    ["consensus-clients", "consensus-clients", "Consensus Clients"],
    ["client-diversity", "client-diversity", "Client Diversity"],
    ["client-separation", "client-separation", "Client Separation"],
    ["node-roles", "node-roles", "Node Roles"],
    ["client-interfaces", "client-interfaces", "Client Interfaces"],
  ]],
  ["network-architecture", [
    ["network-topology-in-network-architecture", "network-topology", "Network Topology"],
    ["overlay-networks", "overlay-networks", "Overlay Networks"],
    ["network-layers", "network-layers", "Network Layers"],
    ["peer-roles", "peer-roles", "Peer Roles"],
    ["network-segmentation", "network-segmentation", "Network Segmentation"],
  ]],
  ["data-architecture", [
    ["data-models", "data-models", "Data Models"],
    ["data-placement", "data-placement", "Data Placement"],
    ["storage-architecture", "storage-architecture", "Storage Architecture"],
    ["data-flows", "data-flows", "Data Flows"],
    ["data-schemas-in-data-architecture", "data-schemas", "Data Schemas"],
  ]],
  ["trust-architecture", [
    ["trust-boundaries-in-trust-architecture", "trust-boundaries", "Trust Boundaries"],
    ["trusted-components", "trusted-components", "Trusted Components"],
    ["trusted-computing-base", "trusted-computing-base", "Trusted Computing Base"],
    ["trust-minimization-in-trust-architecture", "trust-minimization", "Trust Minimization"],
    ["trust-dependencies", "trust-dependencies", "Trust Dependencies"],
  ]],
  ["composability", [
    ["synchronous-composability", "synchronous-composability", "Synchronous Composability"],
    ["asynchronous-composability", "asynchronous-composability", "Asynchronous Composability"],
    ["atomic-composability", "atomic-composability", "Atomic Composability"],
    ["cross-chain-composability-in-composability", "cross-chain-composability", "Cross-Chain Composability"],
    ["protocol-integrations", "protocol-integrations", "Protocol Integrations"],
    ["composability-risks", "composability-risks", "Composability Risks"],
  ]],
  ["architectural-tradeoffs", [
    ["coupling", "coupling", "Coupling"],
    ["cohesion", "cohesion", "Cohesion"],
    ["architectural-complexity", "architectural-complexity", "Architectural Complexity"],
    ["extensibility", "extensibility", "Extensibility"],
    ["technical-debt", "technical-debt", "Technical Debt"],
    ["immutability-in-architectural-tradeoffs", "immutability", "Immutability"],
  ]],
];
const ARCHITECTURE_L2 = ARCHITECTURE_TREE.flatMap(([, children]) => children);

// 19 Protocol Design & Lifecycle. Twenty-one concepts are placed again at L2,
// each preferred at its home.
const LIFECYCLE_LAYER: Array<[string, string, string]> = [
  ["protocol-requirements", "protocol-requirements", "Protocol Requirements"],
  ["design-goals-constraints", "design-goals-constraints", "Design Goals & Constraints"],
  ["protocol-specification", "protocol-specification", "Protocol Specification"],
  ["protocol-modeling", "protocol-modeling", "Protocol Modeling"],
  ["prototyping-simulation", "prototyping-simulation", "Prototyping & Simulation"],
  ["protocol-implementation", "protocol-implementation", "Protocol Implementation"],
  ["pre-launch-validation", "pre-launch-validation", "Pre-Launch Validation"],
  ["deployment-launch", "deployment-launch", "Deployment & Launch"],
  ["parameterization", "parameterization", "Parameterization"],
  ["protocol-operations", "protocol-operations", "Protocol Operations"],
  ["change-management", "change-management", "Change Management"],
  ["versioning-compatibility", "versioning-compatibility", "Versioning & Compatibility"],
  ["protocol-evolution", "protocol-evolution", "Protocol Evolution"],
  ["deprecation-retirement", "deprecation-retirement", "Deprecation & Retirement"],
];
const LIFECYCLE_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["protocol-requirements", [
    ["problem-definition", "problem-definition", "Problem Definition"],
    ["stakeholders-in-protocol-requirements", "stakeholders", "Stakeholders"],
    ["functional-requirements", "functional-requirements", "Functional Requirements"],
    ["non-functional-requirements", "non-functional-requirements", "Non-Functional Requirements"],
    ["security-requirements-in-protocol-requirements", "security-requirements", "Security Requirements"],
    ["requirements-traceability", "requirements-traceability", "Requirements Traceability"],
  ]],
  ["design-goals-constraints", [
    ["design-goals", "design-goals", "Design Goals"],
    ["non-goals", "non-goals", "Non-Goals"],
    ["design-constraints", "design-constraints", "Design Constraints"],
    ["design-assumptions", "design-assumptions", "Design Assumptions"],
    ["success-criteria", "success-criteria", "Success Criteria"],
    ["invariants-in-design-goals-constraints", "invariants", "Invariants"],
  ]],
  ["protocol-specification", [
    ["specifications-in-protocol-specification", "specifications", "Specifications"],
    ["formal-specifications-in-protocol-specification", "formal-specifications", "Formal Specifications"],
    ["specification-languages", "specification-languages", "Specification Languages"],
    ["rules-in-protocol-specification", "rules", "Rules"],
    ["specification-ambiguity", "specification-ambiguity", "Specification Ambiguity"],
  ]],
  ["protocol-modeling", [
    ["reference-models", "reference-models", "Reference Models"],
    ["state-machines-in-protocol-modeling", "state-machines", "State Machines"],
    ["mechanism-design-in-protocol-modeling", "mechanism-design", "Mechanism Design"],
    ["economic-modeling", "economic-modeling", "Economic Modeling"],
    ["threat-modeling-in-protocol-modeling", "threat-modeling", "Threat Modeling"],
    ["agent-based-modeling", "agent-based-modeling", "Agent-Based Modeling"],
  ]],
  ["prototyping-simulation", [
    ["prototyping", "prototyping", "Prototyping"],
    ["protocol-simulation", "protocol-simulation", "Protocol Simulation"],
    ["proof-of-concepts", "proof-of-concepts", "Proof of Concepts"],
    ["devnets", "devnets", "Devnets"],
    ["testnets", "testnets", "Testnets"],
    ["shadow-forks", "shadow-forks", "Shadow Forks"],
  ]],
  ["protocol-implementation", [
    ["reference-implementations", "reference-implementations", "Reference Implementations"],
    ["production-implementations", "production-implementations", "Production Implementations"],
    ["client-diversity-in-protocol-implementation", "client-diversity", "Client Diversity"],
    ["specification-conformance", "specification-conformance", "Specification Conformance"],
    ["conformance-testing", "conformance-testing", "Conformance Testing"],
    ["implementation-drift", "implementation-drift", "Implementation Drift"],
  ]],
  ["pre-launch-validation", [
    ["validation-in-pre-launch-validation", "validation", "Validation"],
    ["testing-in-pre-launch-validation", "testing", "Testing"],
    ["formal-methods-in-pre-launch-validation", "formal-methods", "Formal Methods"],
    ["auditing-in-pre-launch-validation", "auditing", "Auditing"],
    ["bug-bounties-in-pre-launch-validation", "bug-bounties", "Bug Bounties"],
    ["launch-readiness", "launch-readiness", "Launch Readiness"],
  ]],
  ["deployment-launch", [
    ["protocol-deployment", "protocol-deployment", "Protocol Deployment"],
    ["genesis", "genesis", "Genesis"],
    ["deployment-security-in-deployment-launch", "deployment-security", "Deployment Security"],
    ["protocol-launch", "protocol-launch", "Protocol Launch"],
    ["protocol-bootstrapping", "protocol-bootstrapping", "Protocol Bootstrapping"],
    ["phased-rollouts", "phased-rollouts", "Phased Rollouts"],
  ]],
  ["parameterization", [
    ["protocol-parameters", "protocol-parameters", "Protocol Parameters"],
    ["initial-parameters", "initial-parameters", "Initial Parameters"],
    ["parameter-tuning", "parameter-tuning", "Parameter Tuning"],
    ["parameter-bounds", "parameter-bounds", "Parameter Bounds"],
    ["parameter-changes-in-parameterization", "parameter-changes", "Parameter Changes"],
    ["configuration-management", "configuration-management", "Configuration Management"],
  ]],
  ["protocol-operations", [
    ["post-launch-monitoring", "post-launch-monitoring", "Post-Launch Monitoring"],
    ["maintenance-releases", "maintenance-releases", "Maintenance Releases"],
    ["client-updates", "client-updates", "Client Updates"],
    ["operational-runbooks", "operational-runbooks", "Operational Runbooks"],
    ["incident-response-in-protocol-operations", "incident-response", "Incident Response"],
    ["network-health", "network-health", "Network Health"],
  ]],
  ["change-management", [
    ["improvement-proposals", "improvement-proposals", "Improvement Proposals"],
    ["protocol-upgrades-in-change-management", "protocol-upgrades", "Protocol Upgrades"],
    ["hard-forks", "hard-forks", "Hard Forks"],
    ["soft-forks", "soft-forks", "Soft Forks"],
    ["rule-changes-in-change-management", "rule-changes", "Rule Changes"],
    ["upgrade-coordination", "upgrade-coordination", "Upgrade Coordination"],
  ]],
  ["versioning-compatibility", [
    ["protocol-versioning", "protocol-versioning", "Protocol Versioning"],
    ["backward-compatibility", "backward-compatibility", "Backward Compatibility"],
    ["forward-compatibility", "forward-compatibility", "Forward Compatibility"],
    ["migrations", "migrations", "Migrations"],
    ["state-migrations", "state-migrations", "State Migrations"],
    ["breaking-changes", "breaking-changes", "Breaking Changes"],
  ]],
  ["protocol-evolution", [
    ["evolutionary-paths", "evolutionary-paths", "Evolutionary Paths"],
    ["progressive-decentralization", "progressive-decentralization", "Progressive Decentralization"],
    ["ossification", "ossification", "Ossification"],
    ["technical-debt-in-protocol-evolution", "technical-debt", "Technical Debt"],
    ["lifecycle-risks", "lifecycle-risks", "Lifecycle Risks"],
  ]],
  ["deprecation-retirement", [
    ["deprecation", "deprecation", "Deprecation"],
    ["protocol-sunsetting", "protocol-sunsetting", "Protocol Sunsetting"],
    ["protocol-retirement", "protocol-retirement", "Protocol Retirement"],
    ["migration-paths", "migration-paths", "Migration Paths"],
    ["legacy-support", "legacy-support", "Legacy Support"],
  ]],
];
const LIFECYCLE_L2 = LIFECYCLE_TREE.flatMap(([, children]) => children);

// 20 AI & Intelligent Systems. AI Inference is 09's concept; AI Agents is the
// Phase 1 fixture's AI Agent placement; Delegation and Agent Identity are 08's,
// Inference Confidence 09's and Trusted Execution 02's.
const AI_LAYER: Array<[string, string, string]> = [
  ["ai-models", "ai-models", "AI Models"],
  ["ai-inference-in-ai-intelligent-systems", "ai-inference", "AI Inference"],
  ["reasoning", "reasoning", "Reasoning"],
  ["goals-planning", "goals-planning", "Goals & Planning"],
  ["memory-context", "memory-context", "Memory & Context"],
  ["tool-use", "tool-use", "Tool Use"],
  ["ai-agent", "ai-agent", "AI Agents"],
  ["uncertainty-reliability", "uncertainty-reliability", "Uncertainty & Reliability"],
  ["ai-evaluation", "ai-evaluation", "AI Evaluation"],
  ["alignment-control", "alignment-control", "Alignment & Control"],
  ["ai-security", "ai-security", "AI Security"],
  ["verifiable-ai", "verifiable-ai", "Verifiable AI"],
];
const AI_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["ai-models", [
    ["training-data", "training-data", "Training Data"],
    ["model-training", "model-training", "Model Training"],
    ["model-weights", "model-weights", "Model Weights"],
    ["foundation-models", "foundation-models", "Foundation Models"],
    ["fine-tuning", "fine-tuning", "Fine-Tuning"],
    ["model-capabilities", "model-capabilities", "Model Capabilities"],
  ]],
  ["ai-inference-in-ai-intelligent-systems", [
    ["model-inputs", "model-inputs", "Model Inputs"],
    ["model-outputs", "model-outputs", "Model Outputs"],
    ["decoding", "decoding", "Decoding"],
    ["inference-reproducibility", "inference-reproducibility", "Inference Reproducibility"],
    ["inference-cost", "inference-cost", "Inference Cost"],
    ["inference-providers", "inference-providers", "Inference Providers"],
  ]],
  ["reasoning", [
    ["reasoning-traces", "reasoning-traces", "Reasoning Traces"],
    ["test-time-compute", "test-time-compute", "Test-Time Compute"],
    ["self-correction", "self-correction", "Self-Correction"],
    ["reasoning-faithfulness", "reasoning-faithfulness", "Reasoning Faithfulness"],
    ["world-models", "world-models", "World Models"],
  ]],
  ["goals-planning", [
    ["goals", "goals", "Goals"],
    ["task-decomposition", "task-decomposition", "Task Decomposition"],
    ["plans", "plans", "Plans"],
    ["planning-horizons", "planning-horizons", "Planning Horizons"],
    ["replanning", "replanning", "Replanning"],
  ]],
  ["memory-context", [
    ["context-windows", "context-windows", "Context Windows"],
    ["context-management", "context-management", "Context Management"],
    ["long-term-memory", "long-term-memory", "Long-Term Memory"],
    ["embeddings", "embeddings", "Embeddings"],
    ["retrieval-augmented-generation", "retrieval-augmented-generation", "Retrieval-Augmented Generation"],
  ]],
  ["tool-use", [
    ["tools", "tools", "Tools"],
    ["tool-calling", "tool-calling", "Tool Calling"],
    ["tool-schemas", "tool-schemas", "Tool Schemas"],
    ["tool-results", "tool-results", "Tool Results"],
    ["tool-selection", "tool-selection", "Tool Selection"],
    ["tool-protocols", "tool-protocols", "Tool Protocols"],
  ]],
  ["ai-agent", [
    ["principals", "principals", "Principals"],
    ["agent-loops", "agent-loops", "Agent Loops"],
    ["agent-actions", "agent-actions", "Agent Actions"],
    ["autonomy-levels", "autonomy-levels", "Autonomy Levels"],
    ["delegation-in-ai-agents", "delegation", "Delegation"],
    ["agent-identity-in-ai-agents", "agent-identity", "Agent Identity"],
  ]],
  ["uncertainty-reliability", [
    ["model-uncertainty", "model-uncertainty", "Model Uncertainty"],
    ["model-calibration", "model-calibration", "Model Calibration"],
    ["inference-confidence-in-uncertainty-reliability", "inference-confidence", "Inference Confidence"],
    ["hallucinations", "hallucinations", "Hallucinations"],
    ["model-robustness", "model-robustness", "Model Robustness"],
    ["distribution-shift", "distribution-shift", "Distribution Shift"],
  ]],
  ["ai-evaluation", [
    ["benchmarks", "benchmarks", "Benchmarks"],
    ["capability-evaluations", "capability-evaluations", "Capability Evaluations"],
    ["safety-evaluations", "safety-evaluations", "Safety Evaluations"],
    ["red-teaming", "red-teaming", "Red Teaming"],
    ["benchmark-contamination", "benchmark-contamination", "Benchmark Contamination"],
    ["model-graded-evaluation", "model-graded-evaluation", "Model-Graded Evaluation"],
  ]],
  ["alignment-control", [
    ["goal-specification", "goal-specification", "Goal Specification"],
    ["specification-gaming", "specification-gaming", "Specification Gaming"],
    ["guardrails", "guardrails", "Guardrails"],
    ["human-oversight", "human-oversight", "Human Oversight"],
    ["interpretability", "interpretability", "Interpretability"],
    ["corrigibility", "corrigibility", "Corrigibility"],
  ]],
  ["ai-security", [
    ["prompt-injection", "prompt-injection", "Prompt Injection"],
    ["jailbreaks", "jailbreaks", "Jailbreaks"],
    ["adversarial-examples", "adversarial-examples", "Adversarial Examples"],
    ["training-data-poisoning", "training-data-poisoning", "Training Data Poisoning"],
    ["model-backdoors", "model-backdoors", "Model Backdoors"],
    ["model-extraction", "model-extraction", "Model Extraction"],
  ]],
  ["verifiable-ai", [
    ["verifiable-inference", "verifiable-inference", "Verifiable Inference"],
    ["zkml", "zkml", "zkML"],
    ["trusted-execution-in-verifiable-ai", "trusted-execution", "Trusted Execution"],
    ["model-commitments", "model-commitments", "Model Commitments"],
    ["model-provenance", "model-provenance", "Model Provenance"],
    ["verifiable-agents", "verifiable-agents", "Verifiable Agents"],
  ]],
];
const AI_L2 = AI_TREE.flatMap(([, children]) => children);

// 21 Machine Economy. Agent Identity and Agent Reputation are 08's concepts;
// AI Agents is 20's AI Agent; Protocols is Foundations'; the other reused
// topics are 03's, 08's, 09's, 10's and 11's.
const MACHINE_ECONOMY_LAYER: Array<[string, string, string]> = [
  ["economic-agents", "economic-agents", "Economic Agents"],
  ["agent-ownership", "agent-ownership", "Agent Ownership"],
  ["agent-identity-in-machine-economy", "agent-identity", "Agent Identity"],
  ["agent-wallets", "agent-wallets", "Agent Wallets"],
  ["agent-capital", "agent-capital", "Agent Capital"],
  ["agent-budgets", "agent-budgets", "Agent Budgets"],
  ["agent-permissions", "agent-permissions", "Agent Permissions"],
  ["machine-payments", "machine-payments", "Machine Payments"],
  ["machine-commerce", "machine-commerce", "Machine Commerce"],
  ["agent-markets", "agent-markets", "Agent Markets"],
  ["agent-reputation-in-machine-economy", "agent-reputation", "Agent Reputation"],
  ["agent-credit", "agent-credit", "Agent Credit"],
  ["agent-risk", "agent-risk", "Agent Risk"],
  ["agent-incentives", "agent-incentives", "Agent Incentives"],
];
const MACHINE_ECONOMY_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["economic-agents", [
    ["human-agents", "human-agents", "Human Agents"],
    ["software-agents", "software-agents", "Software Agents"],
    ["ai-agent-in-economic-agents", "ai-agent", "AI Agents"],
    ["organizations", "organizations", "Organizations"],
    ["protocols-in-economic-agents", "protocols", "Protocols"],
    ["hybrid-agents", "hybrid-agents", "Hybrid Agents"],
  ]],
  ["agent-ownership", [
    ["human-ownership", "human-ownership", "Human Ownership"],
    ["organizational-ownership", "organizational-ownership", "Organizational Ownership"],
    ["shared-ownership", "shared-ownership", "Shared Ownership"],
    ["protocol-ownership", "protocol-ownership", "Protocol Ownership"],
    ["beneficial-ownership", "beneficial-ownership", "Beneficial Ownership"],
    ["ownership-transfer", "ownership-transfer", "Ownership Transfer"],
  ]],
  ["agent-identity-in-machine-economy", [
    ["persistent-identity", "persistent-identity", "Persistent Identity"],
    ["agent-credentials-in-agent-identity", "agent-credentials", "Credentials"],
    ["machine-authentication-in-agent-identity", "machine-authentication", "Authentication"],
    ["agent-reputation-in-agent-identity", "agent-reputation", "Reputation"],
    ["identity-portability", "identity-portability", "Identity Portability"],
    ["identity-recovery", "identity-recovery", "Identity Recovery"],
  ]],
  ["agent-wallets", [
    ["agent-accounts", "agent-accounts", "Agent Accounts"],
    ["key-management-in-agent-wallets", "key-management", "Key Management"],
    ["smart-accounts-in-agent-wallets", "smart-accounts", "Smart Accounts"],
    ["session-authority", "session-authority", "Session Authority"],
    ["spending-authority", "spending-authority", "Spending Authority"],
    ["wallet-recovery-in-agent-wallets", "wallet-recovery", "Wallet Recovery"],
  ]],
  ["agent-capital", [
    ["assets-in-agent-capital", "assets", "Assets"],
    ["liquidity-in-agent-capital", "liquidity", "Liquidity"],
    ["revenue", "revenue", "Revenue"],
    ["capital-allocation", "capital-allocation", "Capital Allocation"],
    ["working-capital", "working-capital", "Working Capital"],
    ["capital-constraints", "capital-constraints", "Capital Constraints"],
  ]],
  ["agent-budgets", [
    ["spending-limits", "spending-limits", "Spending Limits"],
    ["allowances", "allowances", "Allowances"],
    ["resource-budgets", "resource-budgets", "Resource Budgets"],
    ["time-budgets", "time-budgets", "Time Budgets"],
    ["budget-policies", "budget-policies", "Budget Policies"],
    ["budget-enforcement", "budget-enforcement", "Budget Enforcement"],
  ]],
  ["agent-permissions", [
    ["capabilities-in-agent-permissions", "capabilities", "Capabilities"],
    ["delegation-in-agent-permissions", "delegation", "Delegation"],
    ["permission-models-in-agent-permissions", "permission-models", "Permission Models"],
    ["policy-constraints", "policy-constraints", "Policy Constraints"],
    ["revocation-in-agent-permissions", "revocation", "Revocation"],
    ["authority-escalation", "authority-escalation", "Escalation"],
  ]],
  ["machine-payments", [
    ["machine-to-machine-payments", "machine-to-machine-payments", "Machine-to-Machine Payments"],
    ["micropayments", "micropayments", "Micropayments"],
    ["streaming-payments", "streaming-payments", "Streaming Payments"],
    ["conditional-payments", "conditional-payments", "Conditional Payments"],
    ["payment-channels-in-machine-payments", "payment-channels", "Payment Channels"],
    ["automated-settlement", "automated-settlement", "Automated Settlement"],
  ]],
  ["machine-commerce", [
    ["service-discovery", "service-discovery", "Service Discovery"],
    ["price-discovery", "price-discovery", "Price Discovery"],
    ["negotiation", "negotiation", "Negotiation"],
    ["purchasing", "purchasing", "Purchasing"],
    ["subscriptions", "subscriptions", "Subscriptions"],
    ["settlement-in-machine-commerce", "settlement", "Settlement"],
  ]],
  ["agent-markets", [
    ["compute-markets", "compute-markets", "Compute Markets"],
    ["data-markets", "data-markets", "Data Markets"],
    ["model-markets", "model-markets", "Model Markets"],
    ["solver-markets", "solver-markets", "Solver Markets"],
    ["service-markets", "service-markets", "Service Markets"],
    ["information-markets", "information-markets", "Information Markets"],
  ]],
  ["agent-reputation-in-machine-economy", [
    ["performance-history", "performance-history", "Performance History"],
    ["attestations-in-agent-reputation", "attestations", "Attestations"],
    ["trust-scores", "trust-scores", "Trust Scores"],
    ["reputation-portability", "reputation-portability", "Reputation Portability"],
    ["reputation-decay", "reputation-decay", "Reputation Decay"],
    ["reputation-attacks", "reputation-attacks", "Reputation Attacks"],
  ]],
  ["agent-credit", [
    ["creditworthiness", "creditworthiness", "Creditworthiness"],
    ["credit-limits", "credit-limits", "Credit Limits"],
    ["collateral-in-agent-credit", "collateral", "Collateral"],
    ["unsecured-credit", "unsecured-credit", "Unsecured Credit"],
    ["repayment-in-agent-credit", "repayment", "Repayment"],
    ["credit-default", "credit-default", "Default"],
  ]],
  ["agent-risk", [
    ["operational-risk", "operational-risk", "Operational Risk"],
    ["financial-risk", "financial-risk", "Financial Risk"],
    ["counterparty-risk-in-agent-risk", "counterparty-risk", "Counterparty Risk"],
    ["policy-risk", "policy-risk", "Policy Risk"],
    ["model-risk", "model-risk", "Model Risk"],
    ["risk-limits", "risk-limits", "Risk Limits"],
  ]],
  ["agent-incentives", [
    ["agent-objectives", "agent-objectives", "Objectives"],
    ["rewards-in-agent-incentives", "rewards", "Rewards"],
    ["penalties-in-agent-incentives", "penalties", "Penalties"],
    ["incentive-alignment-in-agent-incentives", "incentive-alignment", "Incentive Alignment"],
    ["principal-agent-problems", "principal-agent-problems", "Principal-Agent Problems"],
    ["incentive-compatibility-in-agent-incentives", "incentive-compatibility", "Incentive Compatibility"],
  ]],
];
const MACHINE_ECONOMY_L2 = MACHINE_ECONOMY_TREE.flatMap(([, children]) => children);

// 22 Autonomous Coordination. Negotiation and Service Discovery are 21's
// concepts; Delegation 08's; Cooperation, Competition and Strategic Behavior
// Foundations'; Resource Allocation 10's; Revocation 09's; Capital Allocation 21's.
const COORDINATION_LAYER: Array<[string, string, string]> = [
  ["agent-to-agent-communication", "agent-to-agent-communication", "Agent-to-Agent Communication"],
  ["agent-discovery", "agent-discovery", "Agent Discovery"],
  ["negotiation-in-autonomous-coordination", "negotiation", "Negotiation"],
  ["delegation-in-autonomous-coordination", "delegation", "Delegation"],
  ["cooperation-in-autonomous-coordination", "cooperation", "Cooperation"],
  ["competition-in-autonomous-coordination", "competition", "Competition"],
  ["coalition-formation", "coalition-formation", "Coalition Formation"],
  ["resource-allocation-in-autonomous-coordination", "resource-allocation", "Resource Allocation"],
  ["task-markets", "task-markets", "Task Markets"],
  ["multi-agent-coordination", "multi-agent-coordination", "Multi-Agent Coordination"],
];
const COORDINATION_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["agent-to-agent-communication", [
    ["agent-messages", "agent-messages", "Agent Messages"],
    ["message-protocols", "message-protocols", "Message Protocols"],
    ["communication-semantics", "communication-semantics", "Communication Semantics"],
    ["secure-communication", "secure-communication", "Secure Communication"],
    ["message-routing", "message-routing", "Message Routing"],
    ["communication-policies", "communication-policies", "Communication Policies"],
  ]],
  ["agent-discovery", [
    ["agent-registries", "agent-registries", "Agent Registries"],
    ["capability-discovery", "capability-discovery", "Capability Discovery"],
    ["service-discovery-in-agent-discovery", "service-discovery", "Service Discovery"],
    ["discovery-protocols", "discovery-protocols", "Discovery Protocols"],
    ["matching", "matching", "Matching"],
    ["discovery-trust", "discovery-trust", "Discovery Trust"],
  ]],
  ["negotiation-in-autonomous-coordination", [
    ["offers", "offers", "Offers"],
    ["counteroffers", "counteroffers", "Counteroffers"],
    ["negotiation-constraints", "negotiation-constraints", "Negotiation Constraints"],
    ["negotiation-strategies", "negotiation-strategies", "Negotiation Strategies"],
    ["negotiated-agreement", "negotiated-agreement", "Agreement"],
    ["negotiation-failure", "negotiation-failure", "Negotiation Failure"],
  ]],
  ["delegation-in-autonomous-coordination", [
    ["task-delegation", "task-delegation", "Task Delegation"],
    ["authority-delegation", "authority-delegation", "Authority Delegation"],
    ["delegation-constraints", "delegation-constraints", "Delegation Constraints"],
    ["delegation-policies", "delegation-policies", "Delegation Policies"],
    ["delegation-chains", "delegation-chains", "Delegation Chains"],
    ["revocation-in-delegation", "revocation", "Revocation"],
  ]],
  ["cooperation-in-autonomous-coordination", [
    ["shared-objectives", "shared-objectives", "Shared Objectives"],
    ["task-sharing", "task-sharing", "Task Sharing"],
    ["resource-sharing", "resource-sharing", "Resource Sharing"],
    ["information-sharing", "information-sharing", "Information Sharing"],
    ["benefit-sharing", "benefit-sharing", "Benefit Sharing"],
    ["cooperative-strategies", "cooperative-strategies", "Cooperative Strategies"],
  ]],
  ["competition-in-autonomous-coordination", [
    ["competitive-strategies", "competitive-strategies", "Competitive Strategies"],
    ["bidding", "bidding", "Bidding"],
    ["competitive-selection", "competitive-selection", "Selection"],
    ["rivalry", "rivalry", "Rivalry"],
    ["strategic-behavior-in-competition", "strategic-behavior", "Strategic Behavior"],
    ["competitive-equilibria", "competitive-equilibria", "Competitive Equilibria"],
  ]],
  ["coalition-formation", [
    ["coalition-membership", "coalition-membership", "Coalition Membership"],
    ["coalition-objectives", "coalition-objectives", "Coalition Objectives"],
    ["coalition-rules", "coalition-rules", "Coalition Rules"],
    ["coalition-incentives", "coalition-incentives", "Coalition Incentives"],
    ["coalition-stability", "coalition-stability", "Coalition Stability"],
    ["coalition-dissolution", "coalition-dissolution", "Coalition Dissolution"],
  ]],
  ["resource-allocation-in-autonomous-coordination", [
    ["compute-allocation", "compute-allocation", "Compute Allocation"],
    ["capital-allocation-in-resource-allocation", "capital-allocation", "Capital Allocation"],
    ["data-allocation", "data-allocation", "Data Allocation"],
    ["service-allocation", "service-allocation", "Service Allocation"],
    ["allocation-policies", "allocation-policies", "Allocation Policies"],
    ["allocation-conflicts", "allocation-conflicts", "Allocation Conflicts"],
  ]],
  ["task-markets", [
    ["task-publication", "task-publication", "Task Publication"],
    ["task-discovery", "task-discovery", "Task Discovery"],
    ["task-providers", "task-providers", "Task Providers"],
    ["task-bidding", "task-bidding", "Task Bidding"],
    ["task-assignment", "task-assignment", "Task Assignment"],
    ["task-settlement", "task-settlement", "Task Settlement"],
  ]],
  ["multi-agent-coordination", [
    ["shared-plans", "shared-plans", "Shared Plans"],
    ["coordination-protocols", "coordination-protocols", "Coordination Protocols"],
    ["agent-synchronization", "agent-synchronization", "Synchronization"],
    ["conflict-resolution", "conflict-resolution", "Conflict Resolution"],
    ["collective-decision-making", "collective-decision-making", "Collective Decision-Making"],
    ["emergent-coordination", "emergent-coordination", "Emergent Coordination"],
  ]],
];
const COORDINATION_L2 = COORDINATION_TREE.flatMap(([, children]) => children);

// 23 Autonomous Execution. Goals, Plans, Replanning, Tool Selection, Agent
// Actions, Tool Calling and Human Oversight are 20's; Policy Constraints 21's;
// Capabilities and Transaction Construction 08's; Transaction Submission,
// Observability and Alerting 05's; Trusted Execution 02's; Verifiable
// Execution 06's; Settlement the general concept.
const EXECUTION_LAYER: Array<[string, string, string]> = [
  ["objectives-intents", "objectives-intents", "Objectives & Intents"],
  ["execution-planning", "execution-planning", "Execution Planning"],
  ["action-selection", "action-selection", "Action Selection"],
  ["simulation", "simulation", "Simulation"],
  ["execution-policies", "execution-policies", "Execution Policies"],
  ["execution-authorization", "execution-authorization", "Execution Authorization"],
  ["execution-environments", "execution-environments", "Execution Environments"],
  ["action-execution", "action-execution", "Action Execution"],
  ["verification-settlement", "verification-settlement", "Verification & Settlement"],
  ["execution-monitoring", "execution-monitoring", "Execution Monitoring"],
  ["execution-recovery", "execution-recovery", "Execution Recovery"],
];
const EXECUTION_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["objectives-intents", [
    ["goals-in-objectives-intents", "goals", "Goals"],
    ["execution-requests", "execution-requests", "Execution Requests"],
    ["objective-interpretation", "objective-interpretation", "Objective Interpretation"],
    ["intent-generation", "intent-generation", "Intent Generation"],
    ["success-criteria-in-objectives-intents", "success-criteria", "Success Criteria"],
    ["execution-constraints", "execution-constraints", "Execution Constraints"],
  ]],
  ["execution-planning", [
    ["plans-in-execution-planning", "plans", "Plans"],
    ["action-sequencing", "action-sequencing", "Action Sequencing"],
    ["action-dependencies", "action-dependencies", "Action Dependencies"],
    ["resource-estimation", "resource-estimation", "Resource Estimation"],
    ["contingency-planning", "contingency-planning", "Contingency Planning"],
    ["replanning-in-execution-planning", "replanning", "Replanning"],
  ]],
  ["action-selection", [
    ["candidate-generation", "candidate-generation", "Candidate Generation"],
    ["candidate-evaluation", "candidate-evaluation", "Candidate Evaluation"],
    ["cost-estimation", "cost-estimation", "Cost Estimation"],
    ["tool-selection-in-action-selection", "tool-selection", "Tool Selection"],
    ["execution-routing-in-action-selection", "execution-routing", "Execution Routing"],
    ["execution-optimization", "execution-optimization", "Execution Optimization"],
  ]],
  ["simulation", [
    ["transaction-simulation-in-simulation", "transaction-simulation", "Transaction Simulation"],
    ["state-forking", "state-forking", "State Forking"],
    ["dry-runs", "dry-runs", "Dry Runs"],
    ["outcome-prediction", "outcome-prediction", "Outcome Prediction"],
    ["simulation-fidelity", "simulation-fidelity", "Simulation Fidelity"],
    ["simulation-divergence", "simulation-divergence", "Simulation Divergence"],
  ]],
  ["execution-policies", [
    ["policy-constraints-in-execution-policies", "policy-constraints", "Policy Constraints"],
    ["policy-evaluation", "policy-evaluation", "Policy Evaluation"],
    ["policy-engines", "policy-engines", "Policy Engines"],
    ["policy-enforcement", "policy-enforcement", "Policy Enforcement"],
    ["policy-violations", "policy-violations", "Policy Violations"],
    ["risk-checks", "risk-checks", "Risk Checks"],
  ]],
  ["execution-authorization", [
    ["runtime-authorization", "runtime-authorization", "Runtime Authorization"],
    ["capabilities-in-execution-authorization", "capabilities", "Capabilities"],
    ["human-approval", "human-approval", "Human Approval"],
    ["action-approval-thresholds", "action-approval-thresholds", "Approval Thresholds"],
    ["multi-party-approval", "multi-party-approval", "Multi-Party Approval"],
    ["authorization-scopes", "authorization-scopes", "Authorization Scopes"],
  ]],
  ["execution-environments", [
    ["sandboxing", "sandboxing", "Sandboxing"],
    ["execution-isolation", "execution-isolation", "Execution Isolation"],
    ["trusted-execution-in-execution-environments", "trusted-execution", "Trusted Execution"],
    ["tool-permissions", "tool-permissions", "Tool Permissions"],
    ["environment-access", "environment-access", "Environment Access"],
    ["ephemeral-environments", "ephemeral-environments", "Ephemeral Environments"],
  ]],
  ["action-execution", [
    ["agent-actions-in-action-execution", "agent-actions", "Agent Actions"],
    ["tool-calling-in-action-execution", "tool-calling", "Tool Calling"],
    ["transaction-construction-in-action-execution", "transaction-construction", "Transaction Construction"],
    ["transaction-submission-in-action-execution", "transaction-submission", "Transaction Submission"],
    ["partial-execution", "partial-execution", "Partial Execution"],
    ["idempotency", "idempotency", "Idempotency"],
  ]],
  ["verification-settlement", [
    ["outcome-verification", "outcome-verification", "Outcome Verification"],
    ["postconditions", "postconditions", "Postconditions"],
    ["execution-receipts", "execution-receipts", "Execution Receipts"],
    ["verifiable-execution-in-verification-settlement", "verifiable-execution", "Verifiable Execution"],
    ["settlement-in-verification-settlement", "settlement", "Settlement"],
    ["execution-disputes", "execution-disputes", "Execution Disputes"],
  ]],
  ["execution-monitoring", [
    ["progress-tracking", "progress-tracking", "Progress Tracking"],
    ["observability-in-execution-monitoring", "observability", "Observability"],
    ["audit-trails", "audit-trails", "Audit Trails"],
    ["anomaly-detection-in-execution-monitoring", "anomaly-detection", "Anomaly Detection"],
    ["alerting-in-execution-monitoring", "alerting", "Alerting"],
    ["human-oversight-in-execution-monitoring", "human-oversight", "Human Oversight"],
  ]],
  ["execution-recovery", [
    ["execution-failures", "execution-failures", "Execution Failures"],
    ["retries", "retries", "Retries"],
    ["rollbacks", "rollbacks", "Rollbacks"],
    ["compensating-actions", "compensating-actions", "Compensating Actions"],
    ["circuit-breakers-in-execution-recovery", "circuit-breakers", "Circuit Breakers"],
    ["kill-switches", "kill-switches", "Kill Switches"],
  ]],
];
const EXECUTION_L2 = EXECUTION_TREE.flatMap(([, children]) => children);

// 24 Autonomous Organizations. Organizations (21) and Treasuries (14) are L1
// topics with their own layers; the other reused topics are 08's, 10's, 14's,
// 20's, 21's, 22's and 23's.
const ORGANIZATIONS_LAYER: Array<[string, string, string]> = [
  ["organizations-in-autonomous-organizations", "organizations", "Organizations"],
  ["organizational-membership", "organizational-membership", "Organizational Membership"],
  ["roles-authority", "roles-authority", "Roles & Authority"],
  ["organizational-structure", "organizational-structure", "Organizational Structure"],
  ["organizational-governance", "organizational-governance", "Organizational Governance"],
  ["organizational-decision-making", "organizational-decision-making", "Organizational Decision-Making"],
  ["organizational-policies", "organizational-policies", "Organizational Policies"],
  ["treasuries-in-autonomous-organizations", "treasuries", "Treasuries"],
  ["organizational-budgeting", "organizational-budgeting", "Organizational Budgeting"],
  ["organizational-workflows", "organizational-workflows", "Organizational Workflows"],
  ["autonomous-operations", "autonomous-operations", "Autonomous Operations"],
  ["accountability-auditability", "accountability-auditability", "Accountability & Auditability"],
  ["disputes-emergency-controls", "disputes-emergency-controls", "Disputes & Emergency Controls"],
  ["organizational-lifecycle", "organizational-lifecycle", "Organizational Lifecycle"],
  ["inter-organizational-coordination", "inter-organizational-coordination", "Inter-Organizational Coordination"],
];
const ORGANIZATIONS_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["organizations-in-autonomous-organizations", [
    ["decentralized-autonomous-organizations", "decentralized-autonomous-organizations", "Decentralized Autonomous Organizations"],
    ["organizational-identity", "organizational-identity", "Organizational Identity"],
    ["organizational-objectives", "organizational-objectives", "Organizational Objectives"],
    ["organizational-boundaries", "organizational-boundaries", "Organizational Boundaries"],
    ["legal-wrappers", "legal-wrappers", "Legal Wrappers"],
  ]],
  ["organizational-membership", [
    ["membership-criteria", "membership-criteria", "Membership Criteria"],
    ["member-admission", "member-admission", "Member Admission"],
    ["membership-rights", "membership-rights", "Membership Rights"],
    ["membership-obligations", "membership-obligations", "Membership Obligations"],
    ["membership-tokens", "membership-tokens", "Membership Tokens"],
    ["member-exit", "member-exit", "Member Exit"],
  ]],
  ["roles-authority", [
    ["roles-in-roles-authority", "roles", "Roles"],
    ["role-assignment", "role-assignment", "Role Assignment"],
    ["role-hierarchies", "role-hierarchies", "Role Hierarchies"],
    ["mandates-in-roles-authority", "mandates", "Mandates"],
    ["authority-boundaries-in-roles-authority", "authority-boundaries", "Authority Boundaries"],
    ["separation-of-powers-in-roles-authority", "separation-of-powers", "Separation of Powers"],
  ]],
  ["organizational-structure", [
    ["hierarchical-structures", "hierarchical-structures", "Hierarchical Structures"],
    ["flat-structures", "flat-structures", "Flat Structures"],
    ["sub-organizations", "sub-organizations", "Sub-Organizations"],
    ["working-groups-in-organizational-structure", "working-groups", "Working Groups"],
    ["councils-committees-in-organizational-structure", "councils-committees", "Councils & Committees"],
    ["reporting-lines", "reporting-lines", "Reporting Lines"],
  ]],
  ["organizational-governance", [
    ["governance-models-in-organizational-governance", "governance-models", "Governance Models"],
    ["constitutions-in-organizational-governance", "constitutions", "Constitutions"],
    ["proposals-in-organizational-governance", "proposals", "Proposals"],
    ["voting-in-organizational-governance", "voting", "Voting"],
    ["decision-rules-in-organizational-governance", "decision-rules", "Decision Rules"],
    ["hybrid-governance", "hybrid-governance", "Hybrid Governance"],
  ]],
  ["organizational-decision-making", [
    ["decision-rights", "decision-rights", "Decision Rights"],
    ["collective-decision-making-in-organizational-decision-making", "collective-decision-making", "Collective Decision-Making"],
    ["automated-decisions", "automated-decisions", "Automated Decisions"],
    ["authority-escalation-in-organizational-decision-making", "authority-escalation", "Escalation"],
    ["veto-rights-in-organizational-decision-making", "veto-rights", "Veto Rights"],
    ["decision-records", "decision-records", "Decision Records"],
  ]],
  ["organizational-policies", [
    ["policy-setting", "policy-setting", "Policy Setting"],
    ["policy-hierarchies", "policy-hierarchies", "Policy Hierarchies"],
    ["policy-constraints-in-organizational-policies", "policy-constraints", "Policy Constraints"],
    ["spending-controls-in-organizational-policies", "spending-controls", "Spending Controls"],
    ["organizational-compliance", "organizational-compliance", "Organizational Compliance"],
    ["policy-updates", "policy-updates", "Policy Updates"],
  ]],
  ["treasuries-in-autonomous-organizations", [
    ["treasury-management-in-treasuries-in-autonomous-organizations", "treasury-management", "Treasury Management"],
    ["treasury-custody", "treasury-custody", "Treasury Custody"],
    ["revenue-in-treasuries-in-autonomous-organizations", "revenue", "Revenue"],
    ["runway", "runway", "Runway"],
    ["treasury-diversification", "treasury-diversification", "Treasury Diversification"],
    ["capital-allocation-in-treasuries-in-autonomous-organizations", "capital-allocation", "Capital Allocation"],
  ]],
  ["organizational-budgeting", [
    ["budget-cycles", "budget-cycles", "Budget Cycles"],
    ["budget-allocation-in-organizational-budgeting", "budget-allocation", "Budget Allocation"],
    ["resource-allocation-in-organizational-budgeting", "resource-allocation", "Resource Allocation"],
    ["grants-in-organizational-budgeting", "grants", "Grants"],
    ["contributor-compensation", "contributor-compensation", "Contributor Compensation"],
    ["spending-approvals", "spending-approvals", "Spending Approvals"],
  ]],
  ["organizational-workflows", [
    ["workflow-definitions", "workflow-definitions", "Workflow Definitions"],
    ["task-assignment-in-organizational-workflows", "task-assignment", "Task Assignment"],
    ["approval-workflows", "approval-workflows", "Approval Workflows"],
    ["handoffs", "handoffs", "Handoffs"],
    ["workflow-automation", "workflow-automation", "Workflow Automation"],
    ["service-level-agreements", "service-level-agreements", "Service-Level Agreements"],
  ]],
  ["autonomous-operations", [
    ["organizational-autonomy", "organizational-autonomy", "Organizational Autonomy"],
    ["agent-workforces", "agent-workforces", "Agent Workforces"],
    ["operating-procedures", "operating-procedures", "Operating Procedures"],
    ["human-oversight-in-autonomous-operations", "human-oversight", "Human Oversight"],
    ["organizational-performance", "organizational-performance", "Organizational Performance"],
  ]],
  ["accountability-auditability", [
    ["accountability-in-accountability-auditability", "accountability", "Accountability"],
    ["responsibility-attribution", "responsibility-attribution", "Responsibility Attribution"],
    ["audit-trails-in-accountability-auditability", "audit-trails", "Audit Trails"],
    ["auditability", "auditability", "Auditability"],
    ["transparency-in-accountability-auditability", "transparency", "Transparency"],
    ["liability", "liability", "Liability"],
  ]],
  ["disputes-emergency-controls", [
    ["dispute-resolution-in-disputes-emergency-controls", "dispute-resolution", "Dispute Resolution"],
    ["conflict-resolution-in-disputes-emergency-controls", "conflict-resolution", "Conflict Resolution"],
    ["emergency-powers-in-disputes-emergency-controls", "emergency-powers", "Emergency Powers"],
    ["pause-mechanisms-in-disputes-emergency-controls", "pause-mechanisms", "Pause Mechanisms"],
    ["guardians-in-disputes-emergency-controls", "guardians", "Guardians"],
    ["incident-response-in-disputes-emergency-controls", "incident-response", "Incident Response"],
  ]],
  ["organizational-lifecycle", [
    ["organization-formation", "organization-formation", "Organization Formation"],
    ["organizational-bootstrapping", "organizational-bootstrapping", "Organizational Bootstrapping"],
    ["restructuring", "restructuring", "Restructuring"],
    ["organizational-mergers", "organizational-mergers", "Organizational Mergers"],
    ["succession", "succession", "Succession"],
    ["organizational-dissolution", "organizational-dissolution", "Organizational Dissolution"],
  ]],
  ["inter-organizational-coordination", [
    ["organizational-alliances", "organizational-alliances", "Organizational Alliances"],
    ["federations", "federations", "Federations"],
    ["negotiated-agreement-in-inter-organizational-coordination", "negotiated-agreement", "Negotiated Agreement"],
    ["joint-ventures", "joint-ventures", "Joint Ventures"],
    ["shared-services", "shared-services", "Shared Services"],
    ["cross-organizational-governance", "cross-organizational-governance", "Cross-Organizational Governance"],
  ]],
];
const ORGANIZATIONS_L2 = ORGANIZATIONS_TREE.flatMap(([, children]) => children);

// 25 Autonomous Protocols. Reused topics keep their homes: 02's, 03's, 05's,
// 06's, 10's, 11's, 14's, 20's, 21's, 23's and 24's.
const PROTOCOLS_LAYER: Array<[string, string, string]> = [
  ["protocol-autonomy", "protocol-autonomy", "Protocol Autonomy"],
  ["protocol-objectives", "protocol-objectives", "Protocol Objectives"],
  ["protocol-monitoring", "protocol-monitoring", "Protocol Monitoring"],
  ["control-loops", "control-loops", "Control Loops"],
  ["adaptive-parameters", "adaptive-parameters", "Adaptive Parameters"],
  ["protocol-policies", "protocol-policies", "Protocol Policies"],
  ["protocol-agents", "protocol-agents", "Protocol Agents"],
  ["protocol-maintenance", "protocol-maintenance", "Protocol Maintenance"],
  ["protocol-adaptation", "protocol-adaptation", "Protocol Adaptation"],
  ["self-healing", "self-healing", "Self-Healing"],
  ["autonomous-security-responses", "autonomous-security-responses", "Autonomous Security Responses"],
  ["protocol-owned-resources", "protocol-owned-resources", "Protocol-Owned Resources"],
  ["autonomous-liquidity-management", "autonomous-liquidity-management", "Autonomous Liquidity Management"],
  ["autonomous-risk-management", "autonomous-risk-management", "Autonomous Risk Management"],
  ["governance-human-override", "governance-human-override", "Governance & Human Override"],
  ["verifiable-autonomous-operation", "verifiable-autonomous-operation", "Verifiable Autonomous Operation"],
  ["protocol-lifecycle-automation", "protocol-lifecycle-automation", "Protocol Lifecycle Automation"],
];
const PROTOCOLS_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["protocol-autonomy", [
    ["bounded-autonomy", "bounded-autonomy", "Bounded Autonomy"],
    ["protocol-autonomy-levels", "protocol-autonomy-levels", "Protocol Autonomy Levels"],
    ["self-management", "self-management", "Self-Management"],
    ["protocol-invariants", "protocol-invariants", "Protocol Invariants"],
    ["governance-minimization-in-protocol-autonomy", "governance-minimization", "Governance Minimization"],
  ]],
  ["protocol-objectives", [
    ["objective-functions", "objective-functions", "Objective Functions"],
    ["setpoints", "setpoints", "Setpoints"],
    ["protocol-health", "protocol-health", "Protocol Health"],
    ["objective-trade-offs", "objective-trade-offs", "Objective Trade-offs"],
    ["objective-drift", "objective-drift", "Objective Drift"],
  ]],
  ["protocol-monitoring", [
    ["protocol-state-in-protocol-monitoring", "protocol-state", "Protocol State"],
    ["protocol-telemetry", "protocol-telemetry", "Protocol Telemetry"],
    ["state-estimation", "state-estimation", "State Estimation"],
    ["condition-monitoring-in-protocol-monitoring", "condition-monitoring", "Condition Monitoring"],
    ["invariant-monitoring", "invariant-monitoring", "Invariant Monitoring"],
    ["anomaly-detection-in-protocol-monitoring", "anomaly-detection", "Anomaly Detection"],
  ]],
  ["control-loops", [
    ["feedback-loops", "feedback-loops", "Feedback Loops"],
    ["feedback-controllers", "feedback-controllers", "Feedback Controllers"],
    ["pid-control", "pid-control", "PID Control"],
    ["triggers-in-control-loops", "triggers", "Triggers"],
    ["control-stability", "control-stability", "Control Stability"],
    ["control-latency", "control-latency", "Control Latency"],
  ]],
  ["adaptive-parameters", [
    ["adjustment-rules", "adjustment-rules", "Adjustment Rules"],
    ["parameter-bounds-in-adaptive-parameters", "parameter-bounds", "Parameter Bounds"],
    ["adjustment-rate-limits", "adjustment-rate-limits", "Adjustment Rate Limits"],
    ["dynamic-fees", "dynamic-fees", "Dynamic Fees"],
    ["adaptive-interest-rates", "adaptive-interest-rates", "Adaptive Interest Rates"],
    ["parameter-sensitivity", "parameter-sensitivity", "Parameter Sensitivity"],
  ]],
  ["protocol-policies", [
    ["policy-driven-operation", "policy-driven-operation", "Policy-Driven Operation"],
    ["operating-envelopes", "operating-envelopes", "Operating Envelopes"],
    ["policy-constraints-in-protocol-policies", "policy-constraints", "Policy Constraints"],
    ["policy-evaluation-in-protocol-policies", "policy-evaluation", "Policy Evaluation"],
    ["response-policies", "response-policies", "Response Policies"],
    ["authority-escalation-in-protocol-policies", "authority-escalation", "Escalation"],
  ]],
  ["protocol-agents", [
    ["on-chain-agents", "on-chain-agents", "On-Chain Agents"],
    ["ai-operated-protocols", "ai-operated-protocols", "AI-Operated Protocols"],
    ["automation-networks-in-protocol-agents", "automation-networks", "Automation Networks"],
    ["execution-bots-in-protocol-agents", "execution-bots", "Execution Bots"],
    ["off-chain-workers-in-protocol-agents", "off-chain-workers", "Off-Chain Workers"],
  ]],
  ["protocol-maintenance", [
    ["maintenance-tasks", "maintenance-tasks", "Maintenance Tasks"],
    ["keepers-in-protocol-maintenance", "keepers", "Keepers"],
    ["keeper-incentives-in-protocol-maintenance", "keeper-incentives", "Keeper Incentives"],
    ["scheduled-execution-in-protocol-maintenance", "scheduled-execution", "Scheduled Execution"],
    ["state-cleanup", "state-cleanup", "State Cleanup"],
    ["dependency-management", "dependency-management", "Dependency Management"],
  ]],
  ["protocol-adaptation", [
    ["adaptive-mechanisms", "adaptive-mechanisms", "Adaptive Mechanisms"],
    ["regime-detection", "regime-detection", "Regime Detection"],
    ["mode-switching", "mode-switching", "Mode Switching"],
    ["learning-mechanisms", "learning-mechanisms", "Learning Mechanisms"],
    ["adaptation-limits", "adaptation-limits", "Adaptation Limits"],
    ["adaptation-evaluation", "adaptation-evaluation", "Adaptation Evaluation"],
  ]],
  ["self-healing", [
    ["fault-detection", "fault-detection", "Fault Detection"],
    ["automatic-failover", "automatic-failover", "Automatic Failover"],
    ["graceful-degradation-in-self-healing", "graceful-degradation", "Graceful Degradation"],
    ["recovery-modes", "recovery-modes", "Recovery Modes"],
    ["state-repair", "state-repair", "State Repair"],
    ["fault-tolerance-in-self-healing", "fault-tolerance", "Fault Tolerance"],
  ]],
  ["autonomous-security-responses", [
    ["exploit-detection", "exploit-detection", "Exploit Detection"],
    ["automated-containment", "automated-containment", "Automated Containment"],
    ["circuit-breakers-in-autonomous-security-responses", "circuit-breakers", "Circuit Breakers"],
    ["pause-mechanisms-in-autonomous-security-responses", "pause-mechanisms", "Pause Mechanisms"],
    ["outflow-limits", "outflow-limits", "Outflow Limits"],
    ["incident-response-in-autonomous-security-responses", "incident-response", "Incident Response"],
  ]],
  ["protocol-owned-resources", [
    ["protocol-owned-liquidity", "protocol-owned-liquidity", "Protocol-Owned Liquidity"],
    ["reserves-in-protocol-owned-resources", "reserves", "Reserves"],
    ["insurance-funds", "insurance-funds", "Insurance Funds"],
    ["revenue-in-protocol-owned-resources", "revenue", "Revenue"],
    ["buybacks", "buybacks", "Buybacks"],
    ["resource-allocation-in-protocol-owned-resources", "resource-allocation", "Resource Allocation"],
  ]],
  ["autonomous-liquidity-management", [
    ["liquidity-targets", "liquidity-targets", "Liquidity Targets"],
    ["liquidity-rebalancing", "liquidity-rebalancing", "Liquidity Rebalancing"],
    ["liquidity-range-management", "liquidity-range-management", "Liquidity Range Management"],
    ["liquidity-incentive-adjustment", "liquidity-incentive-adjustment", "Liquidity Incentive Adjustment"],
    ["peg-defense", "peg-defense", "Peg Defense"],
    ["liquidity-provision-in-autonomous-liquidity-management", "liquidity-provision", "Liquidity Provision"],
  ]],
  ["autonomous-risk-management", [
    ["risk-models", "risk-models", "Risk Models"],
    ["risk-parameters-in-autonomous-risk-management", "risk-parameters", "Risk Parameters"],
    ["dynamic-risk-parameters", "dynamic-risk-parameters", "Dynamic Risk Parameters"],
    ["risk-limits-in-autonomous-risk-management", "risk-limits", "Risk Limits"],
    ["stress-testing", "stress-testing", "Stress Testing"],
    ["automated-deleveraging", "automated-deleveraging", "Automated Deleveraging"],
  ]],
  ["governance-human-override", [
    ["automatic-enactment", "automatic-enactment", "Automatic Enactment"],
    ["proposal-execution-in-governance-human-override", "proposal-execution", "Proposal Execution"],
    ["parameter-changes-in-governance-human-override", "parameter-changes", "Parameter Changes"],
    ["human-oversight-in-governance-human-override", "human-oversight", "Human Oversight"],
    ["override-mechanisms", "override-mechanisms", "Override Mechanisms"],
    ["kill-switches-in-governance-human-override", "kill-switches", "Kill Switches"],
  ]],
  ["verifiable-autonomous-operation", [
    ["verifiable-execution-in-verifiable-autonomous-operation", "verifiable-execution", "Verifiable Execution"],
    ["operation-proofs", "operation-proofs", "Operation Proofs"],
    ["invariant-verification", "invariant-verification", "Invariant Verification"],
    ["audit-trails-in-verifiable-autonomous-operation", "audit-trails", "Audit Trails"],
    ["decision-records-in-verifiable-autonomous-operation", "decision-records", "Decision Records"],
    ["transparency-in-verifiable-autonomous-operation", "transparency", "Transparency"],
  ]],
  ["protocol-lifecycle-automation", [
    ["protocol-bootstrapping-in-protocol-lifecycle-automation", "protocol-bootstrapping", "Protocol Bootstrapping"],
    ["progressive-decentralization-in-protocol-lifecycle-automation", "progressive-decentralization", "Progressive Decentralization"],
    ["automated-upgrades", "automated-upgrades", "Automated Upgrades"],
    ["protocol-upgrades-in-protocol-lifecycle-automation", "protocol-upgrades", "Protocol Upgrades"],
    ["ossification-in-protocol-lifecycle-automation", "ossification", "Ossification"],
    ["protocol-sunsetting-in-protocol-lifecycle-automation", "protocol-sunsetting", "Protocol Sunsetting"],
  ]],
];
const PROTOCOLS_L2 = PROTOCOLS_TREE.flatMap(([, children]) => children);

// 26 Autonomous Economy. Economic Agency is first placed here; the other
// reused topics keep their homes: 10's, 11's, 14's, 20's, 21's, 22's and 25's.
const ECONOMY_LAYER: Array<[string, string, string]> = [
  ["autonomous-economic-actors", "autonomous-economic-actors", "Autonomous Economic Actors"],
  ["autonomous-ownership-structures", "autonomous-ownership-structures", "Autonomous Ownership Structures"],
  ["autonomous-markets", "autonomous-markets", "Autonomous Markets"],
  ["autonomous-commerce", "autonomous-commerce", "Autonomous Commerce"],
  ["autonomous-production", "autonomous-production", "Autonomous Production"],
  ["economic-sectors", "economic-sectors", "Economic Sectors"],
  ["capital-payment-flows", "capital-payment-flows", "Capital & Payment Flows"],
  ["economy-wide-allocation", "economy-wide-allocation", "Economy-Wide Allocation"],
  ["autonomous-credit-systems", "autonomous-credit-systems", "Autonomous Credit Systems"],
  ["monetary-systems", "monetary-systems", "Monetary Systems"],
  ["economic-institutions", "economic-institutions", "Economic Institutions"],
  ["economic-governance", "economic-governance", "Economic Governance"],
  ["market-power", "market-power", "Market Power"],
  ["economic-stability", "economic-stability", "Economic Stability"],
  ["economic-resilience", "economic-resilience", "Economic Resilience"],
  ["economic-dynamics", "economic-dynamics", "Economic Dynamics"],
  ["human-machine-economic-interaction", "human-machine-economic-interaction", "Human–Machine Economic Interaction"],
];
const ECONOMY_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["autonomous-economic-actors", [
    ["economic-agency", "economic-agency", "Economic Agency"],
    ["economic-agents-in-autonomous-economic-actors", "economic-agents", "Economic Agents"],
    ["actor-populations", "actor-populations", "Actor Populations"],
    ["actor-heterogeneity", "actor-heterogeneity", "Actor Heterogeneity"],
    ["actor-specialization", "actor-specialization", "Actor Specialization"],
    ["actor-entry-exit", "actor-entry-exit", "Actor Entry & Exit"],
  ]],
  ["autonomous-ownership-structures", [
    ["machine-owned-assets", "machine-owned-assets", "Machine-Owned Assets"],
    ["ownership-chains", "ownership-chains", "Ownership Chains"],
    ["protocol-owned-resources-in-autonomous-ownership-structures", "protocol-owned-resources", "Protocol-Owned Resources"],
    ["organizational-ownership-in-autonomous-ownership-structures", "organizational-ownership", "Organizational Ownership"],
    ["beneficial-ownership-in-autonomous-ownership-structures", "beneficial-ownership", "Beneficial Ownership"],
    ["ownership-concentration", "ownership-concentration", "Ownership Concentration"],
  ]],
  ["autonomous-markets", [
    ["market-formation", "market-formation", "Market Formation"],
    ["autonomous-supply-demand", "autonomous-supply-demand", "Autonomous Supply & Demand"],
    ["autonomous-pricing", "autonomous-pricing", "Autonomous Pricing"],
    ["price-discovery-in-autonomous-markets", "price-discovery", "Price Discovery"],
    ["market-clearing", "market-clearing", "Market Clearing"],
    ["autonomous-market-making", "autonomous-market-making", "Autonomous Market Making"],
  ]],
  ["autonomous-commerce", [
    ["autonomous-contracting", "autonomous-contracting", "Autonomous Contracting"],
    ["contract-enforcement", "contract-enforcement", "Contract Enforcement"],
    ["machine-commerce-in-autonomous-commerce", "machine-commerce", "Machine Commerce"],
    ["autonomous-supply-chains", "autonomous-supply-chains", "Autonomous Supply Chains"],
    ["commerce-networks", "commerce-networks", "Commerce Networks"],
    ["settlement-in-autonomous-commerce", "settlement", "Settlement"],
  ]],
  ["autonomous-production", [
    ["autonomous-services", "autonomous-services", "Autonomous Services"],
    ["service-composition", "service-composition", "Service Composition"],
    ["value-chains", "value-chains", "Value Chains"],
    ["production-coordination", "production-coordination", "Production Coordination"],
    ["task-markets-in-autonomous-production", "task-markets", "Task Markets"],
    ["machine-productivity", "machine-productivity", "Machine Productivity"],
  ]],
  ["economic-sectors", [
    ["agent-economies", "agent-economies", "Agent Economies"],
    ["protocol-economies", "protocol-economies", "Protocol Economies"],
    ["inter-protocol-economies", "inter-protocol-economies", "Inter-Protocol Economies"],
    ["data-economies", "data-economies", "Data Economies"],
    ["compute-economies", "compute-economies", "Compute Economies"],
    ["model-economies", "model-economies", "Model Economies"],
    ["solver-economies", "solver-economies", "Solver Economies"],
  ]],
  ["capital-payment-flows", [
    ["capital-flows", "capital-flows", "Capital Flows"],
    ["payment-flows", "payment-flows", "Payment Flows"],
    ["liquidity-networks", "liquidity-networks", "Liquidity Networks"],
    ["systemic-liquidity", "systemic-liquidity", "Systemic Liquidity"],
    ["liquidity-fragmentation-in-capital-payment-flows", "liquidity-fragmentation", "Liquidity Fragmentation"],
    ["capital-mobility", "capital-mobility", "Capital Mobility"],
  ]],
  ["economy-wide-allocation", [
    ["autonomous-capital-allocation", "autonomous-capital-allocation", "Autonomous Capital Allocation"],
    ["economy-wide-resource-allocation", "economy-wide-resource-allocation", "Economy-Wide Resource Allocation"],
    ["capital-formation", "capital-formation", "Capital Formation"],
    ["allocation-efficiency-in-economy-wide-allocation", "allocation-efficiency", "Allocation Efficiency"],
    ["public-goods-funding-in-economy-wide-allocation", "public-goods-funding", "Public Goods Funding"],
  ]],
  ["autonomous-credit-systems", [
    ["credit-networks", "credit-networks", "Credit Networks"],
    ["credit-creation", "credit-creation", "Credit Creation"],
    ["agent-credit-in-autonomous-credit-systems", "agent-credit", "Agent Credit"],
    ["lending-markets-in-autonomous-credit-systems", "lending-markets", "Lending Markets"],
    ["creditworthiness-in-autonomous-credit-systems", "creditworthiness", "Creditworthiness"],
    ["systemic-leverage", "systemic-leverage", "Systemic Leverage"],
  ]],
  ["monetary-systems", [
    ["machine-money", "machine-money", "Machine Money"],
    ["unit-of-account", "unit-of-account", "Unit of Account"],
    ["stablecoins-in-monetary-systems", "stablecoins", "Stablecoins"],
    ["money-supply", "money-supply", "Money Supply"],
    ["money-velocity", "money-velocity", "Money Velocity"],
    ["monetary-policy", "monetary-policy", "Monetary Policy"],
  ]],
  ["economic-institutions", [
    ["institutions-in-economic-institutions", "institutions", "Institutions"],
    ["property-rights", "property-rights", "Property Rights"],
    ["reputation-systems", "reputation-systems", "Reputation Systems"],
    ["trust-infrastructure", "trust-infrastructure", "Trust Infrastructure"],
    ["credible-neutrality-in-economic-institutions", "credible-neutrality", "Credible Neutrality"],
    ["dispute-resolution-in-economic-institutions", "dispute-resolution", "Dispute Resolution"],
  ]],
  ["economic-governance", [
    ["economic-policy", "economic-policy", "Economic Policy"],
    ["incentives-in-economic-governance", "incentives", "Incentives"],
    ["fees-in-economic-governance", "fees", "Fees"],
    ["taxation", "taxation", "Taxation"],
    ["rent-extraction", "rent-extraction", "Rent Extraction"],
    ["redistribution", "redistribution", "Redistribution"],
  ]],
  ["market-power", [
    ["competition-in-market-power", "competition", "Competition"],
    ["market-concentration", "market-concentration", "Market Concentration"],
    ["network-effects", "network-effects", "Network Effects"],
    ["barriers-to-entry", "barriers-to-entry", "Barriers to Entry"],
    ["collusion-in-market-power", "collusion", "Collusion"],
    ["algorithmic-collusion", "algorithmic-collusion", "Algorithmic Collusion"],
  ]],
  ["economic-stability", [
    ["systemic-risk-in-economic-stability", "systemic-risk", "Systemic Risk"],
    ["contagion", "contagion", "Contagion"],
    ["economic-shocks", "economic-shocks", "Economic Shocks"],
    ["procyclicality", "procyclicality", "Procyclicality"],
    ["flash-crashes", "flash-crashes", "Flash Crashes"],
    ["automatic-stabilizers", "automatic-stabilizers", "Automatic Stabilizers"],
  ]],
  ["economic-resilience", [
    ["shock-absorption", "shock-absorption", "Shock Absorption"],
    ["economic-diversification", "economic-diversification", "Economic Diversification"],
    ["backstops", "backstops", "Backstops"],
    ["circuit-breakers-in-economic-resilience", "circuit-breakers", "Circuit Breakers"],
    ["stress-testing-in-economic-resilience", "stress-testing", "Stress Testing"],
    ["economic-recovery", "economic-recovery", "Economic Recovery"],
  ]],
  ["economic-dynamics", [
    ["economic-feedback-loops", "economic-feedback-loops", "Economic Feedback Loops"],
    ["emergent-economic-behavior", "emergent-economic-behavior", "Emergent Economic Behavior"],
    ["competitive-equilibria-in-economic-dynamics", "competitive-equilibria", "Competitive Equilibria"],
    ["market-cycles", "market-cycles", "Market Cycles"],
    ["economic-growth", "economic-growth", "Economic Growth"],
    ["economic-adaptation", "economic-adaptation", "Economic Adaptation"],
  ]],
  ["human-machine-economic-interaction", [
    ["principals-in-human-machine-economic-interaction", "principals", "Principals"],
    ["human-oversight-in-human-machine-economic-interaction", "human-oversight", "Human Oversight"],
    ["labor-substitution", "labor-substitution", "Labor Substitution"],
    ["economic-alignment", "economic-alignment", "Economic Alignment"],
    ["consumer-protection", "consumer-protection", "Consumer Protection"],
    ["value-distribution", "value-distribution", "Value Distribution"],
  ]],
];
const ECONOMY_L2 = ECONOMY_TREE.flatMap(([, children]) => children);

// 27 Frontier Systems. Reused topics keep their homes: 09's, 14's, 20's,
// 22's, 24's and 26's.
const FRONTIER_LAYER: Array<[string, string, string]> = [
  ["machine-native-ownership", "machine-native-ownership", "Machine-Native Ownership"],
  ["autonomous-legal-entities", "autonomous-legal-entities", "Autonomous Legal Entities"],
  ["machine-native-monetary-systems", "machine-native-monetary-systems", "Machine-Native Monetary Systems"],
  ["programmable-law", "programmable-law", "Programmable Law"],
  ["machine-constitutions", "machine-constitutions", "Machine Constitutions"],
  ["synthetic-institutions", "synthetic-institutions", "Synthetic Institutions"],
  ["ai-mediated-governance", "ai-mediated-governance", "AI-Mediated Governance"],
  ["digital-polities", "digital-polities", "Digital Polities"],
  ["agent-societies", "agent-societies", "Agent Societies"],
  ["machine-mediated-commons", "machine-mediated-commons", "Machine-Mediated Commons"],
  ["recursive-autonomy", "recursive-autonomy", "Recursive Autonomy"],
  ["self-modifying-systems", "self-modifying-systems", "Self-Modifying Systems"],
  ["protocol-ecologies", "protocol-ecologies", "Protocol Ecologies"],
  ["autonomous-infrastructure", "autonomous-infrastructure", "Autonomous Infrastructure"],
  ["cyber-physical-autonomous-systems", "cyber-physical-autonomous-systems", "Cyber-Physical Autonomous Systems"],
  ["autonomous-science-systems", "autonomous-science-systems", "Autonomous Science Systems"],
];
const FRONTIER_TREE: Array<[string, Array<[string, string, string]>]> = [
  ["machine-native-ownership", [
    ["self-owning-agents", "self-owning-agents", "Self-Owning Agents"],
    ["self-sovereign-machines", "self-sovereign-machines", "Self-Sovereign Machines"],
    ["programmable-ownership", "programmable-ownership", "Programmable Ownership"],
    ["machine-native-property", "machine-native-property", "Machine-Native Property"],
    ["economic-agency-in-machine-native-ownership", "economic-agency", "Economic Agency"],
  ]],
  ["autonomous-legal-entities", [
    ["agent-legal-personhood", "agent-legal-personhood", "Agent Legal Personhood"],
    ["algorithmic-entities", "algorithmic-entities", "Algorithmic Entities"],
    ["autonomous-liability", "autonomous-liability", "Autonomous Liability"],
    ["machine-legal-contracting", "machine-legal-contracting", "Machine Legal Contracting"],
    ["legal-wrappers-in-autonomous-legal-entities", "legal-wrappers", "Legal Wrappers"],
  ]],
  ["machine-native-monetary-systems", [
    ["machine-native-money", "machine-native-money", "Machine-Native Money"],
    ["agent-issued-currencies", "agent-issued-currencies", "Agent-Issued Currencies"],
    ["compute-backed-money", "compute-backed-money", "Compute-Backed Money"],
    ["autonomous-monetary-authorities", "autonomous-monetary-authorities", "Autonomous Monetary Authorities"],
    ["autonomous-capital-formation", "autonomous-capital-formation", "Autonomous Capital Formation"],
    ["monetary-systems-in-machine-native-monetary-systems", "monetary-systems", "Monetary Systems"],
  ]],
  ["programmable-law", [
    ["machine-executable-law", "machine-executable-law", "Machine-Executable Law"],
    ["computable-contracts", "computable-contracts", "Computable Contracts"],
    ["automated-regulation", "automated-regulation", "Automated Regulation"],
    ["embedded-compliance", "embedded-compliance", "Embedded Compliance"],
    ["legal-oracles", "legal-oracles", "Legal Oracles"],
    ["code-as-law", "code-as-law", "Code as Law"],
  ]],
  ["machine-constitutions", [
    ["constitutions-in-machine-constitutions", "constitutions", "Constitutions"],
    ["agent-constitutions", "agent-constitutions", "Agent Constitutions"],
    ["adaptive-constitutions", "adaptive-constitutions", "Adaptive Constitutions"],
    ["machine-enforced-constitutions", "machine-enforced-constitutions", "Machine-Enforced Constitutions"],
    ["constitutional-verification", "constitutional-verification", "Constitutional Verification"],
  ]],
  ["synthetic-institutions", [
    ["institutions-in-synthetic-institutions", "institutions", "Institutions"],
    ["agent-native-institutions", "agent-native-institutions", "Agent-Native Institutions"],
    ["programmable-institutions", "programmable-institutions", "Programmable Institutions"],
    ["emergent-institutions", "emergent-institutions", "Emergent Institutions"],
    ["machine-arbitration", "machine-arbitration", "Machine Arbitration"],
    ["institutional-composability", "institutional-composability", "Institutional Composability"],
  ]],
  ["ai-mediated-governance", [
    ["ai-delegates", "ai-delegates", "AI Delegates"],
    ["verifiable-governance-agents", "verifiable-governance-agents", "Verifiable Governance Agents"],
    ["ai-deliberation", "ai-deliberation", "AI Deliberation"],
    ["ai-preference-aggregation", "ai-preference-aggregation", "AI Preference Aggregation"],
    ["governance-simulation", "governance-simulation", "Governance Simulation"],
    ["human-oversight-in-ai-mediated-governance", "human-oversight", "Human Oversight"],
  ]],
  ["digital-polities", [
    ["autonomous-jurisdictions", "autonomous-jurisdictions", "Autonomous Jurisdictions"],
    ["network-states", "network-states", "Network States"],
    ["protocol-native-societies", "protocol-native-societies", "Protocol-Native Societies"],
    ["digital-citizenship", "digital-citizenship", "Digital Citizenship"],
    ["digital-sovereignty", "digital-sovereignty", "Digital Sovereignty"],
    ["exit-rights-in-digital-polities", "exit-rights", "Exit Rights"],
  ]],
  ["agent-societies", [
    ["open-agent-societies", "open-agent-societies", "Open Agent Societies"],
    ["mixed-human-machine-societies", "mixed-human-machine-societies", "Mixed Human–Machine Societies"],
    ["agent-social-norms", "agent-social-norms", "Agent Social Norms"],
    ["emergent-conventions", "emergent-conventions", "Emergent Conventions"],
    ["planetary-scale-coordination", "planetary-scale-coordination", "Planetary-Scale Coordination"],
    ["collective-decision-making-in-agent-societies", "collective-decision-making", "Collective Decision-Making"],
  ]],
  ["machine-mediated-commons", [
    ["commons-governance", "commons-governance", "Commons Governance"],
    ["autonomous-public-goods", "autonomous-public-goods", "Autonomous Public Goods"],
    ["commons-stewards", "commons-stewards", "Commons Stewards"],
    ["commons-dilemmas", "commons-dilemmas", "Commons Dilemmas"],
    ["public-goods-funding-in-machine-mediated-commons", "public-goods-funding", "Public Goods Funding"],
  ]],
  ["recursive-autonomy", [
    ["recursive-organizations", "recursive-organizations", "Recursive Organizations"],
    ["recursively-autonomous-systems", "recursively-autonomous-systems", "Recursively Autonomous Systems"],
    ["agent-spawning", "agent-spawning", "Agent Spawning"],
    ["nested-autonomy", "nested-autonomy", "Nested Autonomy"],
    ["recursion-limits", "recursion-limits", "Recursion Limits"],
  ]],
  ["self-modifying-systems", [
    ["self-modifying-protocols", "self-modifying-protocols", "Self-Modifying Protocols"],
    ["self-improving-agents", "self-improving-agents", "Self-Improving Agents"],
    ["self-improving-protocols", "self-improving-protocols", "Self-Improving Protocols"],
    ["self-modification-safeguards", "self-modification-safeguards", "Self-Modification Safeguards"],
    ["verifiable-self-modification", "verifiable-self-modification", "Verifiable Self-Modification"],
    ["corrigibility-in-self-modifying-systems", "corrigibility", "Corrigibility"],
  ]],
  ["protocol-ecologies", [
    ["evolutionary-protocols", "evolutionary-protocols", "Evolutionary Protocols"],
    ["protocol-selection-pressure", "protocol-selection-pressure", "Protocol Selection Pressure"],
    ["multi-protocol-ecosystems", "multi-protocol-ecosystems", "Multi-Protocol Ecosystems"],
    ["protocol-symbiosis", "protocol-symbiosis", "Protocol Symbiosis"],
    ["ecosystem-dynamics", "ecosystem-dynamics", "Ecosystem Dynamics"],
  ]],
  ["autonomous-infrastructure", [
    ["decentralized-ai-infrastructure", "decentralized-ai-infrastructure", "Decentralized AI Infrastructure"],
    ["verifiable-agent-networks", "verifiable-agent-networks", "Verifiable Agent Networks"],
    ["verifiable-agents-in-autonomous-infrastructure", "verifiable-agents", "Verifiable Agents"],
    ["self-provisioning-infrastructure", "self-provisioning-infrastructure", "Self-Provisioning Infrastructure"],
    ["self-maintaining-infrastructure", "self-maintaining-infrastructure", "Self-Maintaining Infrastructure"],
  ]],
  ["cyber-physical-autonomous-systems", [
    ["autonomous-robotics", "autonomous-robotics", "Autonomous Robotics"],
    ["autonomous-fleets", "autonomous-fleets", "Autonomous Fleets"],
    ["physical-actuation", "physical-actuation", "Physical Actuation"],
    ["cyber-physical-interfaces-in-cyber-physical-autonomous-systems", "cyber-physical-interfaces", "Cyber-Physical Interfaces"],
    ["decentralized-physical-infrastructure", "decentralized-physical-infrastructure", "Decentralized Physical Infrastructure"],
    ["physical-safety-constraints", "physical-safety-constraints", "Physical Safety Constraints"],
  ]],
  ["autonomous-science-systems", [
    ["autonomous-research-agents", "autonomous-research-agents", "Autonomous Research Agents"],
    ["automated-experimentation", "automated-experimentation", "Automated Experimentation"],
    ["self-driving-laboratories", "self-driving-laboratories", "Self-Driving Laboratories"],
    ["machine-discovery", "machine-discovery", "Machine Discovery"],
    ["verifiable-research", "verifiable-research", "Verifiable Research"],
    ["open-science-protocols", "open-science-protocols", "Open Science Protocols"],
  ]],
];
const FRONTIER_L2 = FRONTIER_TREE.flatMap(([, children]) => children);

// The authored L1/L2 trees are asserted on their own; the fixture test covers the rest.
const AUTHORED_TOPICS = new Set([
  ...FOUNDATIONS_LAYER,
  ...FOUNDATIONS_L2.map(([id]) => id),
  ...COMPUTATION_LAYER,
  ...COMPUTATION_L2.map(([id]) => id),
  ...STATE_DATA_LAYER.map(([id]) => id),
  ...STATE_DATA_L2.map(([id]) => id),
  ...CONSENSUS_LAYER.map(([id]) => id),
  ...CONSENSUS_L2.map(([id]) => id),
  ...NETWORKS_LAYER.map(([id]) => id),
  ...NETWORKS_L2.map(([id]) => id),
  ...CRYPTOGRAPHY_LAYER.map(([id]) => id),
  ...CRYPTOGRAPHY_L2.map(([id]) => id),
  ...STORAGE_LAYER.map(([id]) => id),
  ...STORAGE_L2.map(([id]) => id),
  ...IDENTITY_LAYER.map(([id]) => id),
  ...IDENTITY_L2.map(([id]) => id),
  ...ORACLES_LAYER.map(([id]) => id),
  ...ORACLES_L2.map(([id]) => id),
  ...ECONOMICS_LAYER.map(([id]) => id),
  ...ECONOMICS_L2.map(([id]) => id),
  ...MARKETS_LAYER.map(([id]) => id),
  ...MARKETS_L2.map(([id]) => id),
  ...MEV_LAYER.map(([id]) => id),
  ...MEV_L2.map(([id]) => id),
  ...INTENTS_LAYER.map(([id]) => id),
  ...INTENTS_L2.map(([id]) => id),
  ...GOVERNANCE_LAYER.map(([id]) => id),
  ...GOVERNANCE_L2.map(([id]) => id),
  ...SCALING_LAYER.map(([id]) => id),
  ...SCALING_L2.map(([id]) => id),
  ...INTEROP_LAYER.map(([id]) => id),
  ...INTEROP_L2.map(([id]) => id),
  ...SECURITY_LAYER.map(([id]) => id),
  ...SECURITY_L2.map(([id]) => id),
  ...ARCHITECTURE_LAYER.map(([id]) => id),
  ...ARCHITECTURE_L2.map(([id]) => id),
  ...LIFECYCLE_LAYER.map(([id]) => id),
  ...LIFECYCLE_L2.map(([id]) => id),
  ...AI_LAYER.map(([id]) => id),
  ...AI_L2.map(([id]) => id),
  ...MACHINE_ECONOMY_LAYER.map(([id]) => id),
  ...MACHINE_ECONOMY_L2.map(([id]) => id),
  ...COORDINATION_LAYER.map(([id]) => id),
  ...COORDINATION_L2.map(([id]) => id),
  ...EXECUTION_LAYER.map(([id]) => id),
  ...EXECUTION_L2.map(([id]) => id),
  ...ORGANIZATIONS_LAYER.map(([id]) => id),
  ...ORGANIZATIONS_L2.map(([id]) => id),
  ...PROTOCOLS_LAYER.map(([id]) => id),
  ...PROTOCOLS_L2.map(([id]) => id),
  ...ECONOMY_LAYER.map(([id]) => id),
  ...ECONOMY_L2.map(([id]) => id),
  ...FRONTIER_LAYER.map(([id]) => id),
  ...FRONTIER_L2.map(([id]) => id),
]);

// Each domain's tests see the stack as it stood when that domain was authored:
// placements in that L0 domain or an earlier one. A later domain that places a
// concept again asserts that placement, and any preference it moves, in its own
// tests, so earlier domains' tests never change. Cross-domain invariants are
// asserted once, globally.
function l0Order(l0: string): number {
  const order = L0_DOMAINS.findIndex(([id]) => id === l0);
  assert.ok(order >= 0, `${l0} is an L0 domain`);
  return order;
}

function containingL0(placementId: string): string {
  return resolver.getAncestors(placementId)[0]?.id ?? placementId;
}

function withinL0(placementId: string, l0: string): boolean {
  return l0Order(containingL0(placementId)) <= l0Order(l0);
}

/** A concept's placement IDs in the given L0 domain or earlier ones, sorted. */
function placementsThrough(l0: string, conceptId: string): string[] {
  return resolver
    .getPlacementsForConcept(conceptId)
    .filter((placement) => withinL0(placement.id, l0))
    .map((placement) => placement.id)
    .sort();
}

/**
 * The domain's own preferred-placement decision: while the concept's preferred
 * placement lies in this domain or an earlier one, it is the expected one and
 * the resolver's default. A later domain that takes the preference over asserts
 * that itself.
 */
function assertPreferredThrough(l0: string, conceptId: string, expected: string | undefined) {
  const preferred = resolver.getConcept(conceptId)?.preferredPlacementId;
  if (preferred && !withinL0(preferred, l0)) return;
  assert.equal(preferred, expected, conceptId);
  if (expected) assert.equal(resolver.getPreferredPlacementForConcept(conceptId)?.id, expected, conceptId);
}

// A placement's label as the explorer shows it: contextual wording, else the concept title.
function placementLabel(placementId: string): string | undefined {
  const placement = resolver.getPlacement(placementId);
  return placement && (placement.contextualLabel ?? resolver.getConcept(placement.conceptId)?.title);
}

function errorsFor(mutator: (model: MapKnowledgeModel) => MapKnowledgeModel): string[] {
  return validateMapKnowledge(mutator(mapKnowledge));
}

const L0_DOMAINS: Array<[string, string]> = [
  ["foundations", "Foundations"],
  ["computation-execution", "Computation & Execution"],
  ["state-data", "State & Data"],
  ["consensus-ordering", "Consensus & Ordering"],
  ["networks-infrastructure", "Networks & Infrastructure"],
  ["cryptography-proofs", "Cryptography & Proofs"],
  ["storage-availability", "Storage & Availability"],
  ["identity-accounts-authority", "Identity, Accounts & Authority"],
  ["oracles-external-reality", "Oracles & External Reality"],
  ["economics-mechanism-design", "Economics & Mechanism Design"],
  ["markets-financial-protocols", "Markets & Financial Protocols"],
  ["mev-execution-markets", "MEV & Execution Markets"],
  ["intents-coordination", "Intents & Coordination"],
  ["governance-institutions", "Governance & Institutions"],
  ["scaling-modular-systems", "Scaling & Modular Systems"],
  ["interoperability-abstraction", "Interoperability & Abstraction"],
  ["security-correctness-resilience", "Security, Correctness & Resilience"],
  ["protocol-architecture", "Protocol Architecture"],
  ["protocol-design-lifecycle", "Protocol Design & Lifecycle"],
  ["ai-intelligent-systems", "AI & Intelligent Systems"],
  ["machine-economy", "Machine Economy"],
  ["autonomous-coordination", "Autonomous Coordination"],
  ["autonomous-execution", "Autonomous Execution"],
  ["autonomous-organizations", "Autonomous Organizations"],
  ["autonomous-protocols", "Autonomous Protocols"],
  ["autonomous-economy", "Autonomous Economy"],
  ["frontier-systems", "Frontier Systems"],
];

test("the taxonomy root is exactly the 27 L0 domains in agreed order", () => {
  const roots = resolver.getRootPlacements();
  assert.deepEqual(roots.map((placement) => placement.id), L0_DOMAINS.map(([id]) => id));
  assert.deepEqual(roots.map((placement) => placement.order), L0_DOMAINS.map((_, index) => index));
  for (const [id, title] of L0_DOMAINS) {
    const placement = resolver.getPlacement(id);
    assert.equal(placement?.conceptId, id);
    assert.equal(resolver.getConcept(id)?.title, title);
    assert.deepEqual(resolver.getPlacementsForConcept(id).map((entry) => entry.id), [id]);
  }
});

test("the root taxonomy agrees with the L0 domains in the MAP specification", () => {
  const spec = readFileSync(new URL("../../../docs/map-spec.md", import.meta.url), "utf8");
  const scope = spec.slice(spec.indexOf("## 5. Long-term knowledge scope"), spec.indexOf("## 6."));
  const specDomains = [...scope.matchAll(/^\d+\. (.+)$/gm)].map((match) => match[1]);

  assert.deepEqual(specDomains, L0_DOMAINS.map(([, title]) => title));
});

test("/map canonical metadata is the environment URL, never a context query", () => {
  const metadata = buildSocialMetadata(staticSocial.map);
  assert.equal(metadata.alternates?.canonical, "https://psatomas.com/map");
  assert.equal(metadata.openGraph?.url, "https://psatomas.com/map");
});

test("canonical concept identities stay unique after adding the L0 layer", () => {
  const ids = mapKnowledge.concepts.map((concept) => concept.id);
  assert.equal(new Set(ids).size, ids.length);
  // L0, the Phase 1 fixture, Foundations' L1 layer and its 40 new L2
  // concepts, Computation & Execution's 7 L1 and 38 new L2 concepts, then
  // State & Data's 9 new L1 and 58 new L2 concepts, then Consensus &
  // Ordering's 7 new L1 and 56 new L2 concepts, then Networks &
  // Infrastructure's 10 new L1 and 55 new L2 concepts, then Cryptography &
  // Proofs' 7 new L1 and 46 new L2 concepts, then Storage & Availability's
  // 8 new L1 and 47 new L2 concepts, then Identity, Accounts & Authority's
  // 6 new L1 and 43 new L2 concepts, then Oracles & External Reality's 11
  // new L1 and 61 new L2 concepts, then Economics & Mechanism Design's 10 new
  // L1 and 65 new L2 concepts, then Markets & Financial Protocols' 12 new L1
  // and 69 new L2 concepts, then MEV & Execution Markets' 11 new L1 and 74
  // new L2 concepts, then Intents & Coordination's 12 new L1 and 64 new L2
  // concepts, then Governance & Institutions' 15 new L1 and 86 new L2 concepts,
  // then Scaling & Modular Systems' 12 new L1 and 64 new L2 concepts, then
  // Interoperability & Abstraction's 11 new L1 and 72 new L2 concepts, then
  // Security, Correctness & Resilience's 19 new L1 and 82 new L2 concepts, then
  // Protocol Architecture's 12 new L1 and 54 new L2 concepts, then Protocol
  // Design & Lifecycle's 14 new L1 and 60 new L2 concepts, then AI &
  // Intelligent Systems' 10 new L1 and 65 new L2 concepts, then Machine
  // Economy's 12 new L1 and 60 new L2 concepts, then Autonomous
  // Coordination's 5 new L1 and 56 new L2 concepts, then Autonomous
  // Execution's 11 new L1 and 45 new L2 concepts, then Autonomous
  // Organizations' 13 new L1 and 54 new L2 concepts, then Autonomous
  // Protocols' 17 new L1 and 60 new L2 concepts, then Autonomous
  // Economy's 17 new L1 and 73 new L2 concepts, then Frontier Systems'
  // 16 new L1 and 77 new L2 concepts.
  assert.equal(ids.length, 27 + 11 + 6 + 40 + 7 + 38 + 9 + 58 + 7 + 56 + 10 + 55 + 7 + 46 + 8 + 47 + 6 + 43 + 11 + 61 + 10 + 65 + 12 + 69 + 11 + 74 + 12 + 64 + 15 + 86 + 12 + 64 + 11 + 72 + 19 + 82 + 12 + 54 + 14 + 60 + 10 + 65 + 12 + 60 + 5 + 56 + 11 + 45 + 13 + 54 + 17 + 60 + 17 + 73 + 16 + 77);
});

test("the Phase 1 proof fixture is re-homed beneath its L0 domains with stable placement IDs", () => {
  const parents = Object.fromEntries(
    mapKnowledge.placements
      .filter((placement) => placement.parentPlacementId && !AUTHORED_TOPICS.has(placement.id))
      .map((placement) => [placement.id, placement.parentPlacementId]),
  );
  // Every fixture placement is now part of an authored tree.
  assert.deepEqual(parents, {});
  // AI Agent is now an authored L1 topic of AI & Intelligent Systems, keeping
  // its placement ID. Settlement's and Economic Agency's placements are asserted
  // by the domains that decide them (11 and 21).
  assert.equal(resolver.getPlacement("ai-agent")?.parentPlacementId, "ai-intelligent-systems");
});

test("re-homing changes no relationship, content, mechanism, or path record", () => {
  assert.deepEqual(mapKnowledge.relationships.map((relationship) => relationship.id), [
    "finality-finalizes-settlement",
    "rollups-depend-on-finality",
    "agent-identity-authenticates-ai-agent",
    "authority-constrains-ai-agent",
    "agent-identity-enables-economic-agency",
  ]);
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  assert.deepEqual(mapKnowledge.mechanisms.map((mechanism) => mechanism.id), ["consensus-to-finality"]);
  assert.deepEqual(mapKnowledge.knowledgePaths.map((path) => path.id), ["distributed-systems-to-rollups"]);
  // L0 domains may own canonical content, but taxonomy creates no semantic
  // edges, mechanism steps, or path steps for them.
  const l0 = new Set(L0_DOMAINS.map(([id]) => id));
  const referenced = [
    ...mapKnowledge.relationships.flatMap((relationship) => [relationship.sourceConceptId, relationship.targetConceptId]),
    ...mapKnowledge.mechanisms.flatMap((mechanism) => [mechanism.conceptId, ...mechanism.steps.map((step) => step.conceptId)]),
    ...mapKnowledge.knowledgePaths.flatMap((path) => path.conceptIds),
  ];
  assert.deepEqual(referenced.filter((conceptId) => l0.has(conceptId)), []);
});

test("Foundations owns exactly one canonical content record, which its placement does not duplicate", () => {
  const owned = mapKnowledge.content.filter((content) => content.conceptId === "foundations");
  assert.equal(owned.length, 1);
  assert.equal(resolver.getContentForConcept("foundations"), owned[0]);
  assert.ok(owned[0].definition.startsWith("Protocols begin before implementation."));
  assert.ok((owned[0].body?.length ?? 0) > 0);

  // Placements carry identity and context only; no placement repeats exposition text.
  const texts = mapKnowledge.content.flatMap((content) => [
    content.definition,
    ...(content.body ?? []).flatMap((block) => (block.kind === "paragraph" ? [block.text] : [])),
  ]);
  for (const placement of mapKnowledge.placements) {
    assert.deepEqual(
      Object.keys(placement).filter((key) => !["id", "conceptId", "parentPlacementId", "order", "contextualLabel", "contextualNote"].includes(key)),
      [],
      placement.id,
    );
    assert.ok(!texts.some((text) => placement.contextualNote && text.includes(placement.contextualNote)), placement.id);
  }
});

test("Foundations' next conceptual layer is its seven child placements, each its own concept", () => {
  assert.deepEqual(resolver.getChildren("foundations").map((placement) => placement.id), FOUNDATIONS_LAYER);
  for (const id of FOUNDATIONS_LAYER) {
    assert.equal(resolver.getPlacement(id)?.conceptId, id);
    assert.ok(resolver.getConcept(id));
    // Structure only: the L1 topics carry no exposition yet.
    assert.equal(resolver.getContentForConcept(id), undefined);
  }
});

test("every Foundations L1 topic has exactly its intended L2 placements, in order, and nothing deeper", () => {
  for (const [parent, children] of FOUNDATIONS_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, resolver.getConcept(placement.conceptId)?.title]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of FOUNDATIONS_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  // No placement anywhere else lands in the Foundations subtree.
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "foundations")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...FOUNDATIONS_LAYER, ...FOUNDATIONS_L2.map(([id]) => id)].sort());
  assert.equal(FOUNDATIONS_L2.length, 43);
});

test("repeated Foundations labels reuse a canonical concept only where one exposition serves both", () => {
  // Same concept, distinct placements.
  // Sorted: placements of one concept under different parents have no mutual order.
  const placementsOf = (conceptId: string) => placementsThrough("foundations", conceptId);
  assert.deepEqual(placementsOf("state"), ["state-in-protocols", "state-in-state-machines"]);
  assertPreferredThrough("foundations", "state", "state-in-state-machines");
  assert.deepEqual(placementsOf("protocol-properties"), ["protocol-properties", "protocol-properties-in-protocols"]);
  assertPreferredThrough("foundations", "protocol-properties", "protocol-properties");
  // Children belong to placements: only the L1 occurrence carries the properties.
  assert.equal(resolver.getChildren("protocol-properties").length, 7);
  assert.deepEqual(resolver.getChildren("protocol-properties-in-protocols"), []);
  // Finality is the existing canonical concept: one content record for every
  // placement. Within Foundations it is placed once; its preferred placement is
  // Consensus & Ordering's, asserted there.
  assert.deepEqual(placementsOf("finality"), ["finality-in-protocol-properties"]);
  assert.equal(mapKnowledge.content.filter((content) => content.conceptId === "finality").length, 1);

  // Same wording, different concepts: message exchange between processes is
  // not participants exchanging information and intent to coordinate.
  const communication = mapKnowledge.concepts.filter((concept) => concept.title === "Communication");
  assert.deepEqual(communication.map((concept) => concept.id), ["communication", "coordination-communication"]);
  assert.deepEqual(placementsOf("communication"), ["communication"]);
  assert.deepEqual(placementsOf("coordination-communication"), ["coordination-communication"]);
  assert.equal(resolver.getAncestors("communication").at(-1)?.id, "distributed-systems");
  assert.equal(resolver.getAncestors("coordination-communication").at(-1)?.id, "coordination");

  // Every other L2 topic is a new concept placed once, and none has exposition yet.
  const reused = new Set(["state", "protocol-properties", "finality"]);
  for (const [id, conceptId] of FOUNDATIONS_L2) {
    if (reused.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
  }
  assert.equal(resolver.getContentForConcept("state"), undefined);
  // Placement identity stays unique across the repeated labels.
  const ids = FOUNDATIONS_L2.map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Foundations exposition is canonical data: models, a distinction, and tensions", () => {
  const body = resolver.getContentForConcept("foundations")?.body ?? [];
  assert.deepEqual(body.map((block) => block.kind), [
    "paragraph", "flow", "paragraph", "flow", "distinction", "paragraph", "tensions", "paragraph", "paragraph",
  ]);
  const flows = body.filter((block) => block.kind === "flow");
  assert.deepEqual(flows[0].stages, [["Participants"], ["Rules"], ["Actions", "Messages"], ["State transitions"], ["System state"]]);
  assert.deepEqual(body.find((block) => block.kind === "distinction"), { kind: "distinction", left: "Local correctness", right: "System correctness" });
  // No markup or styling leaks into the text values.
  const strings: string[] = [];
  JSON.stringify(body, (_key, value) => (typeof value === "string" && strings.push(value), value));
  assert.ok(strings.length > 0 && strings.every((text) => !/[<>{}]|className|style=/.test(text)));
});

test("Computation & Execution has exactly its seven L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(resolver.getChildren("computation-execution").map((placement) => placement.id), COMPUTATION_LAYER);
  for (const id of COMPUTATION_LAYER) {
    assert.equal(resolver.getPlacement(id)?.conceptId, id);
    assert.equal(resolver.getContentForConcept(id), undefined);
  }
  const label = (placementId: string) => {
    const placement = resolver.getPlacement(placementId)!;
    return placement.contextualLabel ?? resolver.getConcept(placement.conceptId)?.title;
  };
  for (const [parent, children] of COMPUTATION_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, label(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of COMPUTATION_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "computation-execution")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...COMPUTATION_LAYER, ...COMPUTATION_L2.map(([id]) => id)].sort());
  assert.equal(COMPUTATION_L2.length, 39);
});

test("Computation & Execution reuses Verification and keeps overlapping labels distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("computation-execution", conceptId);
  // Checking a computation's proof is Foundations' Verification: one concept, two placements.
  assert.equal(resolver.getPlacement("verification-in-verifiable-computation")?.conceptId, "verification");
  assert.deepEqual(placementsOf("verification"), ["verification", "verification-in-verifiable-computation"]);
  assertPreferredThrough("computation-execution", "verification", "verification");
  // Related but distinct: an execution model is not the property, contract
  // storage is not State, validating a transaction or verifying on chain is
  // not Verification itself, trusted execution is not a trusted party.
  for (const [placementId, foundations] of [
    ["deterministic-execution", "determinism"],
    ["contract-state", "state"],
    ["transaction-validation", "verification"],
    ["on-chain-verification", "verification"],
    ["trusted-execution", "trusted-parties"],
    ["denial-of-service-resistance", "censorship-resistance"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(foundations), foundations);
    assert.notEqual(conceptId, foundations, placementId);
  }
  // Contextual wording: Contract Deployment is shown as "Deployment" under Smart Contracts.
  assert.equal(resolver.getConcept("contract-deployment")?.title, "Contract Deployment");
  assert.equal(resolver.getPlacement("contract-deployment")?.contextualLabel, "Deployment");
  assert.equal(resolver.getConcept("deployment"), undefined);
  // Every other topic is a new concept placed once, without exposition; placement IDs are unique.
  for (const [id, conceptId] of [...COMPUTATION_TREE.map(([id]): [string, string, string] => [id, id, ""]), ...COMPUTATION_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (conceptId === "verification") continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...COMPUTATION_LAYER, ...COMPUTATION_L2.map(([id]) => id)];
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => !FOUNDATIONS_L2.some(([foundationsId]) => foundationsId === id)));
});

test("State & Data has exactly its ten L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("state-data").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    STATE_DATA_LAYER,
  );
  for (const [parent, children] of STATE_DATA_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of STATE_DATA_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "state-data")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...STATE_DATA_LAYER.map(([id]) => id), ...STATE_DATA_L2.map(([id]) => id)].sort());
  assert.equal(STATE_DATA_L2.length, 59);
});

test("State & Data reuses State Roots and Transitions and keeps overlapping labels distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("state-data", conceptId);
  // State Roots: one concept in two contexts, preferred where it is taught as a commitment.
  assert.deepEqual(placementsOf("state-roots"), ["state-roots-in-state-commitments", "state-roots-in-state-representation"]);
  assertPreferredThrough("state-data", "state-roots", "state-roots-in-state-commitments");
  // State Transitions (L1) is Foundations' Transitions in contextual wording; children belong to the placement.
  assert.deepEqual(placementsOf("transitions"), ["transitions", "transitions-in-state-data"]);
  assert.equal(resolver.getConcept("transitions")?.title, "Transitions");
  assertPreferredThrough("state-data", "transitions", "transitions");
  assert.deepEqual(resolver.getChildren("transitions"), []);
  assert.equal(resolver.getChildren("transitions-in-state-data").length, 6);
  // Checkpoints is State Checkpoints; the bare term stays free for consensus checkpoints.
  assert.equal(resolver.getConcept("state-checkpoints")?.title, "State Checkpoints");
  assert.notEqual(resolver.getPlacement("state-checkpoints")?.conceptId, "checkpoints");
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["transition-functions", "transition-rules"],
    ["atomic-state-transitions", "transaction-atomicity"],
    ["integrity-verification", "verification"],
    ["synchronization-verification", "verification"],
    ["local-state", "contract-state"],
    ["protocol-state", "state"],
    ["commitment-schemes", "computation-commitments"],
    ["data-commitments", "commitment-schemes"],
    ["state-proofs", "computation-proofs"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition; placement IDs are unique.
  const shared = new Set(["transitions", "state-roots"]);
  for (const [id, conceptId] of [...STATE_DATA_LAYER, ...STATE_DATA_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...STATE_DATA_LAYER, ...STATE_DATA_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("preceding domain hierarchies are unchanged by later domains", () => {
  // Foundations and Computation & Execution keep exactly their authored subtrees.
  const subtreeOf = (root: string) => mapKnowledge.placements.filter((placement) => resolver.getAncestors(placement.id)[0]?.id === root).length;
  assert.equal(subtreeOf("foundations"), 7 + 43);
  assert.equal(subtreeOf("computation-execution"), 7 + 39);
  assert.equal(subtreeOf("state-data"), 10 + 59);
  assert.equal(subtreeOf("consensus-ordering"), 10 + 58);
  assert.equal(subtreeOf("networks-infrastructure"), 10 + 58);
  assert.equal(subtreeOf("cryptography-proofs"), 8 + 48);
  assert.equal(subtreeOf("storage-availability"), 9 + 51);
  assert.equal(subtreeOf("identity-accounts-authority"), 8 + 47);
  assert.equal(subtreeOf("oracles-external-reality"), 12 + 70);
  assert.equal(subtreeOf("economics-mechanism-design"), 11 + 66);
  assert.equal(subtreeOf("markets-financial-protocols"), 12 + 72);
  assert.equal(subtreeOf("mev-execution-markets"), 13 + 79);
  assert.equal(subtreeOf("intents-coordination"), 12 + 71);
  assert.equal(subtreeOf("governance-institutions"), 15 + 89);
  assert.equal(subtreeOf("scaling-modular-systems"), 14 + 80);
  assert.equal(subtreeOf("interoperability-abstraction"), 14 + 82);
  assert.equal(subtreeOf("security-correctness-resilience"), 20 + 119);
  assert.equal(subtreeOf("protocol-architecture"), 12 + 68);
  assert.equal(subtreeOf("ai-intelligent-systems"), 12 + 69);
  assert.equal(subtreeOf("machine-economy"), 14 + 84);
  assert.equal(subtreeOf("autonomous-coordination"), 10 + 60);
  assert.equal(subtreeOf("governance-institutions"), GOVERNANCE_LAYER.length + GOVERNANCE_L2.length);
  assert.equal(subtreeOf("autonomous-execution"), EXECUTION_LAYER.length + EXECUTION_L2.length);
  assert.equal(subtreeOf("autonomous-organizations"), ORGANIZATIONS_LAYER.length + ORGANIZATIONS_L2.length);
  assert.equal(subtreeOf("autonomous-protocols"), PROTOCOLS_LAYER.length + PROTOCOLS_L2.length);
  assert.equal(subtreeOf("autonomous-economy"), ECONOMY_LAYER.length + ECONOMY_L2.length);
  assert.equal(placementLabel("transitions"), "Transitions");
  assert.equal(resolver.getAncestors("transitions").map((placement) => placement.id).join("/"), "foundations/state-machines");
});

test("Consensus & Ordering has exactly its ten L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("consensus-ordering").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    CONSENSUS_LAYER,
  );
  for (const [parent, children] of CONSENSUS_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of CONSENSUS_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "consensus-ordering")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...CONSENSUS_LAYER.map(([id]) => id), ...CONSENSUS_L2.map(([id]) => id)].sort());
  assert.equal(CONSENSUS_L2.length, 58);
});

test("Consensus & Ordering reuses Finality, Censorship Resistance, Transaction Ordering and Proposers", () => {
  const placementsOf = (conceptId: string) => placementsThrough("consensus-ordering", conceptId);
  // Finality: the fixture placement keeps its ID and preferred role, now an L1 topic with its own layer.
  assert.equal(resolver.getPlacement("finality-in-consensus")?.parentPlacementId, "consensus-ordering");
  assertPreferredThrough("consensus-ordering", "finality", "finality-in-consensus");
  assert.deepEqual(placementsOf("finality"), ["finality-in-consensus", "finality-in-protocol-properties"]);
  assert.equal(resolver.getChildren("finality-in-consensus").length, 6);
  assert.deepEqual(resolver.getChildren("finality-in-rollups"), []);
  // Censorship Resistance: Foundations' property, taught here through inclusion; preferred here.
  assert.deepEqual(placementsOf("censorship-resistance"), ["censorship-resistance", "censorship-resistance-in-consensus-ordering"]);
  assertPreferredThrough("consensus-ordering", "censorship-resistance", "censorship-resistance-in-consensus-ordering");
  assert.deepEqual(resolver.getChildren("censorship-resistance"), []);
  // Transaction Ordering: 02's concept, also under Block Building; preferred in the ordering domain.
  assert.deepEqual(placementsOf("transaction-ordering"), ["transaction-ordering", "transaction-ordering-in-block-building"]);
  assertPreferredThrough("consensus-ordering", "transaction-ordering", "transaction-ordering-in-block-building");
  // Proposers: one role under Validators and Proposer-Builder Separation.
  assert.deepEqual(placementsOf("proposers"), ["proposers-in-proposer-builder-separation", "proposers-in-validators"]);
  assertPreferredThrough("consensus-ordering", "proposers", "proposers-in-validators");
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["checkpoints", "state-checkpoints"],
    ["transaction-sequencing", "transaction-ordering"],
    ["fault-assumptions", "fault-models"],
    ["consensus-participants", "participants"],
    ["consensus-rules", "rules"],
    ["finalization", "finality"],
    ["reorganizations", "reorganization-handling"],
    ["mempool-synchronization", "synchronization"],
    ["block-validation", "transaction-validation"],
    ["censorship-detection", "censorship"],
    ["inclusion-guarantees", "preconfirmation-guarantees"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once; none gains exposition (Finality keeps its own).
  const shared = new Set(["consensus", "finality", "censorship-resistance", "transaction-ordering", "proposers"]);
  for (const [id, conceptId] of [...CONSENSUS_LAYER, ...CONSENSUS_L2]) {
    if (conceptId !== "finality") assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...CONSENSUS_LAYER, ...CONSENSUS_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Networks & Infrastructure has exactly its ten L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("networks-infrastructure").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    NETWORKS_LAYER,
  );
  for (const [parent, children] of NETWORKS_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of NETWORKS_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "networks-infrastructure")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...NETWORKS_LAYER.map(([id]) => id), ...NETWORKS_L2.map(([id]) => id)].sort());
  assert.equal(NETWORKS_L2.length, 58);
});

test("Networks & Infrastructure reuses Synchronization, Reorganization Handling and Automation Networks", () => {
  const placementsOf = (conceptId: string) => placementsThrough("networks-infrastructure", conceptId);
  // Node Synchronization is State & Data's Synchronization in contextual wording; preferred there.
  assert.deepEqual(placementsOf("synchronization"), ["synchronization", "synchronization-in-nodes"]);
  assertPreferredThrough("networks-infrastructure", "synchronization", "synchronization");
  assert.deepEqual(resolver.getChildren("synchronization-in-nodes"), []);
  assert.equal(resolver.getChildren("synchronization").length, 6);
  // Reorganization Handling: one concept under Indexing (03) and Indexers (05).
  assert.deepEqual(placementsOf("reorganization-handling"), ["reorganization-handling", "reorganization-handling-in-indexers"]);
  assertPreferredThrough("networks-infrastructure", "reorganization-handling", "reorganization-handling");
  // Keeper Networks is Automation Networks under Keepers.
  assert.deepEqual(placementsOf("automation-networks"), ["automation-networks", "automation-networks-in-keepers"]);
  assertPreferredThrough("networks-infrastructure", "automation-networks", "automation-networks");
  assert.equal(resolver.getConcept("keeper-networks"), undefined);
  // Observability Logs and Traces are their own concepts in contextual wording.
  assert.equal(resolver.getConcept("system-logs")?.title, "System Logs");
  assert.equal(resolver.getConcept("distributed-traces")?.title, "Distributed Traces");
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["relayers", "relays"],
    ["relay-networks", "relays"],
    ["system-logs", "logs"],
    ["distributed-traces", "execution-traces"],
    ["indexers", "indexing"],
    ["gossip-propagation", "gossip"],
    ["propagation-latency", "latency"],
    ["message-validation", "transaction-validation"],
    ["validator-nodes", "validators"],
    ["archive-nodes", "archival-state"],
    ["query-services", "query-models"],
    ["transaction-relaying", "transaction-propagation"],
    ["rate-limiting", "denial-of-service-resistance"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["synchronization", "reorganization-handling", "automation-networks"]);
  for (const [id, conceptId] of [...NETWORKS_LAYER, ...NETWORKS_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...NETWORKS_LAYER, ...NETWORKS_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Cryptography & Proofs has exactly its eight L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("cryptography-proofs").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    CRYPTOGRAPHY_LAYER,
  );
  for (const [parent, children] of CRYPTOGRAPHY_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of CRYPTOGRAPHY_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "cryptography-proofs")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...CRYPTOGRAPHY_LAYER.map(([id]) => id), ...CRYPTOGRAPHY_L2.map(([id]) => id)].sort());
  assert.equal(CRYPTOGRAPHY_L2.length, 48);
});

test("Cryptography & Proofs reuses Verifiable Computation, Computation Proofs and Commitment Schemes", () => {
  const placementsOf = (conceptId: string) => placementsThrough("cryptography-proofs", conceptId);
  // Verifiable Computation: one concept, an L1 topic in 02 and 06; each placement owns its layer.
  assert.deepEqual(placementsOf("verifiable-computation"), ["verifiable-computation", "verifiable-computation-in-cryptography-proofs"]);
  assertPreferredThrough("cryptography-proofs", "verifiable-computation", "verifiable-computation-in-cryptography-proofs");
  assert.deepEqual(resolver.getChildren("verifiable-computation").map((placement) => placement.id), [
    "computation-integrity",
    "execution-traces",
    "computation-commitments",
    "computation-proofs",
    "verification-in-verifiable-computation",
  ]);
  assert.equal(resolver.getChildren("verifiable-computation-in-cryptography-proofs").length, 6);
  // Computation Proofs and Commitment Schemes: one concept each, placed again here and preferred here.
  assert.deepEqual(placementsOf("computation-proofs"), ["computation-proofs", "computation-proofs-in-cryptography-proofs"]);
  assertPreferredThrough("cryptography-proofs", "computation-proofs", "computation-proofs-in-cryptography-proofs");
  assert.deepEqual(placementsOf("commitment-schemes"), ["commitment-schemes", "commitment-schemes-in-cryptographic-commitments"]);
  assertPreferredThrough("cryptography-proofs", "commitment-schemes", "commitment-schemes-in-cryptographic-commitments");
  // Commitments is Cryptographic Commitments in contextual wording.
  assert.equal(resolver.getConcept("cryptographic-commitments")?.title, "Cryptographic Commitments");
  assert.equal(resolver.getConcept("commitments"), undefined);
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["proof-verification", "verification"],
    ["signature-verification", "verification"],
    ["succinct-verification", "verification"],
    ["verifiers", "verification"],
    ["quorum-cryptography", "quorums"],
    ["cryptographic-hash-functions", "hash-functions"],
    ["zero-knowledge", "zero-knowledge-proofs"],
    ["verifiable-execution", "verifiable-computation"],
    ["multi-party-computation", "private-computation"],
    ["polynomial-commitments", "data-commitments"],
    ["vector-commitments", "computation-commitments"],
    ["hash-based-data-structures", "merkle-trees"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["verifiable-computation", "computation-proofs", "commitment-schemes"]);
  for (const [id, conceptId] of [...CRYPTOGRAPHY_LAYER, ...CRYPTOGRAPHY_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...CRYPTOGRAPHY_LAYER, ...CRYPTOGRAPHY_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Storage & Availability has exactly its nine L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("storage-availability").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    STORAGE_LAYER,
  );
  for (const [parent, children] of STORAGE_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of STORAGE_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "storage-availability")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...STORAGE_LAYER.map(([id]) => id), ...STORAGE_L2.map(([id]) => id)].sort());
  assert.equal(STORAGE_L2.length, 51);
});

test("Storage & Availability reuses Content Addressing, Fault Tolerance, Archive Nodes and proof concepts", () => {
  const placementsOf = (conceptId: string) => placementsThrough("storage-availability", conceptId);
  // Content Addressing: 03's concept, an L1 topic here with its own layer; preferred here.
  assert.deepEqual(placementsOf("content-addressing"), ["content-addressing", "content-addressing-in-storage-availability"]);
  assertPreferredThrough("storage-availability", "content-addressing", "content-addressing-in-storage-availability");
  assert.deepEqual(resolver.getChildren("content-addressing"), []);
  assert.equal(resolver.getChildren("content-addressing-in-storage-availability").length, 5);
  // Fault Tolerance, Archive Nodes, Proof Generation and Proof Verification: placed again, preferred at home.
  for (const [conceptId, home, here] of [
    ["fault-tolerance", "fault-tolerance", "fault-tolerance-in-distributed-storage"],
    ["archive-nodes", "archive-nodes", "archive-nodes-in-archival-storage"],
    ["proof-generation", "proof-generation", "proof-generation-in-storage-proofs"],
    ["proof-verification", "proof-verification", "proof-verification-in-storage-proofs"],
  ]) {
    assert.deepEqual(placementsOf(conceptId), [home, here].sort(), conceptId);
    assertPreferredThrough("storage-availability", conceptId, home);
  }
  // Reconstruction is Data Reconstruction in contextual wording.
  assert.equal(resolver.getConcept("data-reconstruction")?.title, "Data Reconstruction");
  assert.equal(resolver.getConcept("reconstruction"), undefined);
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["state-archiving", "archival-state"],
    ["storage-layout", "state-layout"],
    ["state-storage", "contract-state"],
    ["state-storage", "state"],
    ["content-hashing", "data-hashing"],
    ["immutable-references", "data-references"],
    ["historical-data", "state-history"],
    ["data-availability", "availability"],
    ["redundant-encoding", "redundancy"],
    ["blob-retention", "data-retention"],
    ["light-client-sampling", "light-nodes"],
    ["storage-proofs", "state-proofs"],
    ["data-reconstruction", "state-reconstruction"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["content-addressing", "fault-tolerance", "archive-nodes", "proof-generation", "proof-verification"]);
  for (const [id, conceptId] of [...STORAGE_LAYER, ...STORAGE_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...STORAGE_LAYER, ...STORAGE_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Identity, Accounts & Authority has exactly its eight L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("identity-accounts-authority").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    IDENTITY_LAYER,
  );
  for (const [parent, children] of IDENTITY_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of IDENTITY_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "identity-accounts-authority")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...IDENTITY_LAYER.map(([id]) => id), ...IDENTITY_L2.map(([id]) => id)].sort());
  assert.equal(IDENTITY_L2.length, 47);
});

test("Identity, Accounts & Authority reuses Attestations, Signing and Transaction Submission", () => {
  const placementsOf = (conceptId: string) => placementsThrough("identity-accounts-authority", conceptId);
  // The fixture's placements keep their IDs; Agent Identity now sits under Machine Identity.
  assert.equal(resolver.getPlacement("agent-identity")?.parentPlacementId, "machine-identity");
  assert.equal(resolver.getPlacement("identity")?.parentPlacementId, "identity-accounts-authority");
  assert.equal(resolver.getPlacement("authority")?.parentPlacementId, "identity-accounts-authority");
  assert.deepEqual(placementsOf("agent-identity"), ["agent-identity"]);
  // Attestations: 03's concept, preferred here; Signing and Transaction Submission stay preferred at home.
  assert.deepEqual(placementsOf("attestations"), ["attestations", "attestations-in-identity"]);
  assertPreferredThrough("identity-accounts-authority", "attestations", "attestations-in-identity");
  assert.deepEqual(placementsOf("signing"), ["signing", "signing-in-wallets"]);
  assertPreferredThrough("identity-accounts-authority", "signing", "signing");
  assert.deepEqual(placementsOf("transaction-submission"), ["transaction-submission", "transaction-submission-in-wallets"]);
  assertPreferredThrough("identity-accounts-authority", "transaction-submission", "transaction-submission");
  // General concepts for later reuse, and agent/machine topics kept as their own concepts.
  for (const conceptId of ["credentials", "reputation", "ownership", "delegation", "roles", "capabilities"]) {
    assert.deepEqual(placementsOf(conceptId), [conceptId], conceptId);
  }
  for (const [placementId, related] of [
    ["agent-credentials", "credentials"],
    ["machine-credentials", "credentials"],
    ["agent-reputation", "reputation"],
    ["machine-authentication", "authentication"],
    ["agent-identity", "identity"],
    ["account-recovery", "wallet-recovery"],
    ["recovery-logic", "account-recovery"],
    ["programmable-accounts", "smart-accounts"],
    ["account-state", "contract-state"],
    ["key-management", "key-pairs"],
    ["signature-authentication", "signature-verification"],
    ["alternative-mempools", "private-mempools"],
    ["gas-abstraction", "gas"],
    ["authority-boundaries", "trust-boundaries"],
    ["account-permissions", "permission-models"],
    ["session-authentication", "session-keys"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once; only Agent Identity keeps its existing content.
  const shared = new Set(["attestations", "signing", "transaction-submission"]);
  for (const [id, conceptId] of [...IDENTITY_LAYER, ...IDENTITY_L2]) {
    if (conceptId !== "agent-identity") assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...IDENTITY_LAYER, ...IDENTITY_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Oracles & External Reality has exactly its twelve L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("oracles-external-reality").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    ORACLES_LAYER,
  );
  for (const [parent, children] of ORACLES_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of ORACLES_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "oracles-external-reality")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...ORACLES_LAYER.map(([id]) => id), ...ORACLES_L2.map(([id]) => id)].sort());
  assert.equal(ORACLES_L2.length, 70);
});

test("Oracles & External Reality reuses existing concepts where the meaning is the same", () => {
  const placementsOf = (conceptId: string) => placementsThrough("oracles-external-reality", conceptId);
  // Existing concepts placed again, each preferred at its home.
  for (const [conceptId, here] of [
    ["provenance", "provenance-in-oracles-external-reality"],
    ["trust-assumptions", "trust-assumptions-in-oracle-problem"],
    ["collusion", "collusion-in-oracle-security"],
    ["credentials", "credentials-in-real-world-attestations"],
    ["external-data", "external-data-in-oracle-problem"],
    ["authenticity", "authenticity-in-oracle-problem"],
    ["lineage", "lineage-in-oracles-external-reality"],
    ["attribution", "attribution-in-oracles-external-reality"],
  ]) {
    assert.deepEqual(placementsOf(conceptId), [conceptId, here].sort(), conceptId);
    assertPreferredThrough("oracles-external-reality", conceptId, conceptId);
  }
  assert.deepEqual(placementsOf("consensus"), ["consensus", "consensus-in-oracle-networks"]);
  assertPreferredThrough("oracles-external-reality", "consensus", "consensus");
  // Provenance owns a layer in each domain.
  assert.equal(resolver.getChildren("provenance").length, 6);
  assert.equal(resolver.getChildren("provenance-in-oracles-external-reality").length, 5);
  // APIs and External APIs are one concept within this domain.
  assert.deepEqual(placementsOf("external-apis"), ["external-apis", "external-apis-in-data-sources"]);
  assertPreferredThrough("oracles-external-reality", "external-apis", "external-apis");
  // Same wording, different concepts: distinct concepts shown with the given labels.
  for (const [placementId, title, existing] of [
    ["external-data-availability", "External Data Availability", "data-availability"],
    ["oracle-aggregation", "Oracle Aggregation", "signature-aggregation"],
    ["information-extraction", "Information Extraction", "data-extraction"],
    ["inference-confidence", "Inference Confidence", "availability-confidence"],
    ["real-world-attesters", "Real-World Attesters", "attesters"],
  ]) {
    assert.equal(resolver.getConcept(placementId)?.title, title);
    assert.ok(resolver.getPlacement(placementId)?.contextualLabel, placementId);
    assert.ok(resolver.getConcept(existing), existing);
    assert.notEqual(placementId, existing);
  }
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["real-world-attestations", "attestations"],
    ["source-provenance", "data-origin"],
    ["transformation-history", "lineage"],
    ["transformation-history", "data-transformation"],
    ["verifiable-claims", "credentials"],
    ["machine-readable-claims", "claims"],
    ["trusted-hardware", "trusted-execution"],
    ["quorum-aggregation", "quorums"],
    ["heartbeats", "health-checks"],
    ["node-selection", "validator-selection"],
    ["request-response", "challenge-response"],
    ["sensor-data", "sensors"],
    ["attestation-verification", "verification"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["provenance", "trust-assumptions", "collusion", "credentials", "external-data", "authenticity", "lineage", "attribution", "consensus", "external-apis"]);
  for (const [id, conceptId] of [...ORACLES_LAYER, ...ORACLES_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...ORACLES_LAYER, ...ORACLES_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Economics & Mechanism Design has exactly its eleven L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("economics-mechanism-design").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    ECONOMICS_LAYER,
  );
  for (const [parent, children] of ECONOMICS_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of ECONOMICS_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "economics-mechanism-design")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...ECONOMICS_LAYER.map(([id]) => id), ...ECONOMICS_L2.map(([id]) => id)].sort());
  assert.equal(ECONOMICS_L2.length, 66);
});

test("Economics & Mechanism Design reuses Strategic Behavior and Penalties and keeps related concepts distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("economics-mechanism-design", conceptId);
  // Strategic Behavior: Foundations' concept, an L1 topic here with its own layer; preferred here.
  assert.deepEqual(placementsOf("strategic-behavior"), ["strategic-behavior", "strategic-behavior-in-economics-mechanism-design"]);
  assertPreferredThrough("economics-mechanism-design", "strategic-behavior", "strategic-behavior-in-economics-mechanism-design");
  assert.deepEqual(resolver.getChildren("strategic-behavior"), []);
  assert.equal(resolver.getChildren("strategic-behavior-in-economics-mechanism-design").length, 6);
  // Economic Penalties is Penalties in contextual wording, within this domain.
  assert.deepEqual(placementsOf("penalties"), ["penalties", "penalties-in-cryptoeconomic-security"]);
  assertPreferredThrough("economics-mechanism-design", "penalties", "penalties");
  // Objectives and Constraints are the mechanism's, in contextual wording.
  assert.equal(resolver.getConcept("mechanism-objectives")?.title, "Mechanism Objectives");
  assert.equal(resolver.getConcept("mechanism-constraints")?.title, "Mechanism Constraints");
  assert.equal(resolver.getConcept("objectives"), undefined);
  assert.equal(resolver.getConcept("constraints"), undefined);
  // General concepts, each placed once for now, available to later domains.
  for (const conceptId of ["incentives", "mechanism-design", "game-theory", "auctions", "fees", "stake", "slashing", "economic-security", "attack-cost", "cost-of-corruption"]) {
    assert.deepEqual(placementsOf(conceptId), [conceptId], conceptId);
  }
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["incentives", "validator-incentives"],
    ["incentives", "oracle-incentives"],
    ["incentives", "keeper-incentives"],
    ["incentives", "relay-incentives"],
    ["validator-economics", "validator-incentives"],
    ["transaction-fees", "execution-cost"],
    ["fee-calculation", "fee-accounting"],
    ["bids", "block-bids"],
    ["economic-finality", "finality"],
    ["economic-finality", "probabilistic-finality"],
    ["cryptoeconomic-assumptions", "fault-assumptions"],
    ["cryptoeconomic-assumptions", "trust-assumptions"],
    ["incentive-attacks", "economic-attacks"],
    ["manipulation", "oracle-manipulation"],
    ["players", "participants"],
    ["delegated-stake", "delegation"],
    ["priority-fees", "transaction-prioritization"],
    ["mechanism-properties", "protocol-properties"],
    ["stake-based-security", "economic-security"],
    ["cryptoeconomic-security", "economic-security"],
    ["negative-incentives", "penalties"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["strategic-behavior", "penalties"]);
  for (const [id, conceptId] of [...ECONOMICS_LAYER, ...ECONOMICS_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...ECONOMICS_LAYER, ...ECONOMICS_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Markets & Financial Protocols has exactly its twelve L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("markets-financial-protocols").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    MARKETS_LAYER,
  );
  for (const [parent, children] of MARKETS_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of MARKETS_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "markets-financial-protocols")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...MARKETS_LAYER.map(([id]) => id), ...MARKETS_L2.map(([id]) => id)].sort());
  assert.equal(MARKETS_L2.length, 72);
});

test("Markets & Financial Protocols reuses Bids, Settlement and Liquidity Risk and keeps financial mechanisms distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("markets-financial-protocols", conceptId);
  // Bids: 10's concept, placed again under Order Books; 10 stays preferred.
  assert.deepEqual(placementsOf("bids"), ["bids", "bids-in-order-books"]);
  assertPreferredThrough("markets-financial-protocols", "bids", "bids");
  // Settlement: the fixture's general concept, first placed here; its relationship and mechanism step are unchanged.
  assert.deepEqual(placementsOf("settlement"), ["settlement"]);
  assert.equal(resolver.getPlacement("settlement")?.parentPlacementId, "derivatives");
  assert.deepEqual(resolver.getRelationshipsTo("settlement").map((relationship) => relationship.id), ["finality-finalizes-settlement"]);
  // Liquidity Risk: one concept under Liquidity and Risk; preferred under Risk.
  assert.deepEqual(placementsOf("liquidity-risk"), ["liquidity-risk-in-liquidity", "liquidity-risk-in-risk"]);
  assertPreferredThrough("markets-financial-protocols", "liquidity-risk", "liquidity-risk-in-risk");
  // General concepts, each placed once for now, available to later domains.
  for (const conceptId of ["assets", "markets", "liquidity", "collateral", "risk", "reserves", "solvency"]) {
    assert.deepEqual(placementsOf(conceptId), [conceptId], conceptId);
  }
  // Financial mechanisms stay distinct from their general economic primitives, and other near pairs.
  for (const [placementId, related] of [
    ["liquidation-incentives", "incentives"],
    ["liquidation-penalties", "penalties"],
    ["liquidation-auctions", "auctions"],
    ["pool-reserves", "reserves"],
    ["market-prices", "market-data"],
    ["market-efficiency", "allocation-efficiency"],
    ["capital-efficiency", "allocation-efficiency"],
    ["market-participants", "participants"],
    ["liquidators", "liquidation-bots"],
    ["order-matching", "transaction-ordering"],
    ["solvency-constraints", "mechanism-constraints"],
    ["asset-properties", "protocol-properties"],
    ["assets-and-liabilities", "assets"],
    ["collateral-risk", "credit-risk"],
    ["interest-rates", "payment-rules"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["bids", "liquidity-risk"]);
  for (const [id, conceptId] of [...MARKETS_LAYER, ...MARKETS_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...MARKETS_LAYER, ...MARKETS_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("MEV & Execution Markets has exactly its thirteen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("mev-execution-markets").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    MEV_LAYER,
  );
  for (const [parent, children] of MEV_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of MEV_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "mev-execution-markets")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...MEV_LAYER.map(([id]) => id), ...MEV_L2.map(([id]) => id)].sort());
  assert.equal(MEV_L2.length, 79);
});

test("MEV & Execution Markets reuses ordering, building and auction concepts and keeps MEV-specific ones distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("mev-execution-markets", conceptId);
  // L1 reuse: each placement owns its own layer; preferred placements are unchanged.
  assertPreferredThrough("mev-execution-markets", "transaction-ordering", "transaction-ordering-in-block-building");
  assert.deepEqual(resolver.getChildren("transaction-ordering-in-block-building"), []);
  assert.equal(resolver.getChildren("transaction-ordering-in-mev-execution-markets").length, 6);
  assert.deepEqual(placementsOf("builders"), ["builders", "builders-in-mev-execution-markets"]);
  assertPreferredThrough("mev-execution-markets", "builders", "builders");
  assert.deepEqual(resolver.getChildren("builders"), []);
  assert.equal(resolver.getChildren("builders-in-mev-execution-markets").length, 6);
  // L2 reuse: placed again here, preferred at home.
  for (const [conceptId, here] of [
    ["block-construction", "block-construction-in-builders"],
    ["transaction-selection", "transaction-selection-in-builders"],
    ["private-mempools", "private-mempools-in-private-execution"],
    ["inclusion-guarantees", "inclusion-guarantees-in-mev-mitigation"],
    ["auction-clearing", "auction-clearing-in-mev-auctions"],
  ]) {
    assert.deepEqual(placementsOf(conceptId), [conceptId, here].sort(), conceptId);
    assertPreferredThrough("mev-execution-markets", conceptId, conceptId);
  }
  // Narrower MEV concepts stay distinct where one exposition would mislead.
  for (const [placementId, related] of [
    ["mev-auctions", "auctions"],
    ["mev-bids", "bids"],
    ["mev-bids", "block-bids"],
    ["liquidation-mev", "liquidations"],
    ["liquidation-searchers", "liquidators"],
    ["liquidation-risk", "liquidity-risk"],
    ["private-execution", "trusted-execution"],
    ["private-execution", "off-chain-execution"],
    ["bundle-atomicity", "transaction-atomicity"],
    ["atomic-arbitrage", "transaction-atomicity"],
    ["execution-privacy", "privacy"],
    ["private-relays", "relays"],
    ["private-relays", "relayers"],
    ["ordering-manipulation", "manipulation"],
    ["priority-auctions", "priority-fees"],
    ["batch-execution", "batch-auctions"],
    ["ordering-policies", "sequencing-rules"],
    ["bundle-simulation", "transaction-simulation"],
    ["bundle-submission", "transaction-submission"],
    ["bundle-inclusion", "transaction-inclusion"],
    ["builder-competition", "builder-markets"],
    ["builder-auctions", "builder-selection"],
    ["protected-order-flow", "private-order-flow"],
    ["arbitrage", "arbitrage-bots"],
    ["transaction-bundles", "bundles"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["transaction-ordering", "builders", "block-construction", "transaction-selection", "private-mempools", "inclusion-guarantees", "auction-clearing"]);
  for (const [id, conceptId] of [...MEV_LAYER, ...MEV_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...MEV_LAYER, ...MEV_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Intents & Coordination has exactly its twelve L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("intents-coordination").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    INTENTS_LAYER,
  );
  for (const [parent, children] of INTENTS_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of INTENTS_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "intents-coordination")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...INTENTS_LAYER.map(([id]) => id), ...INTENTS_L2.map(([id]) => id)].sort());
  assert.equal(INTENTS_L2.length, 71);
});

test("Intents & Coordination reuses existing concepts without moving their preferred placements", () => {
  const placementsOf = (conceptId: string) => placementsThrough("intents-coordination", conceptId);
  // Each reused concept is placed again here; its existing home stays preferred.
  for (const [conceptId, here] of [
    ["delegation", "delegation-in-intents"],
    ["batch-auctions", "batch-auctions-in-solver-competition"],
    ["order-flow-auctions", "order-flow-auctions-in-solver-competition"],
    ["preconfirmations", "preconfirmations-in-intent-commitments"],
    ["settlement", "settlement-in-intent-settlement"],
    ["collective-action", "collective-action-in-multi-party-coordination"],
    ["shared-sequencing", "shared-sequencing-in-cross-domain-coordination"],
  ]) {
    assert.deepEqual(placementsOf(conceptId), [conceptId, here].sort(), conceptId);
    assertPreferredThrough("intents-coordination", conceptId, conceptId);
    assertPreferredThrough("intents-coordination", conceptId, conceptId);
  }
  // Preconfirmations keeps its own layer only where it is an L1 topic.
  assert.equal(resolver.getChildren("preconfirmations").length, 5);
  assert.deepEqual(resolver.getChildren("preconfirmations-in-intent-commitments"), []);
  // Matching, Routing and Commitments are precise concepts in contextual wording.
  for (const [placementId, title] of [["intent-matching", "Intent Matching"], ["execution-routing", "Execution Routing"], ["intent-commitments", "Intent Commitments"]]) {
    assert.equal(resolver.getConcept(placementId)?.title, title);
    assert.ok(resolver.getPlacement(placementId)?.contextualLabel, placementId);
  }
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["intent-matching", "order-matching"],
    ["execution-routing", "request-routing"],
    ["intent-commitments", "cryptographic-commitments"],
    ["intent-commitments", "preconfirmation-commitments"],
    ["multi-party-coordination", "coordination"],
    ["coordination-mechanisms", "coordination-models"],
    ["declarative-execution", "deterministic-execution"],
    ["intent-constraints", "mechanism-constraints"],
    ["intent-pools", "mempools"],
    ["intent-privacy", "execution-privacy"],
    ["solver-networks", "automation-networks"],
    ["solver-bonds", "stake"],
    ["solver-reputation", "reputation"],
    ["solver-auctions", "auctions"],
    ["solver-auctions", "mev-auctions"],
    ["execution-selection", "transaction-selection"],
    ["execution-paths", "arbitrage-paths"],
    ["fulfillment-verification", "verification"],
    ["execution-guarantees", "inclusion-guarantees"],
    ["price-guarantees", "ordering-guarantees"],
    ["intent-cancellation", "revocation"],
    ["atomic-settlement", "atomic-state-transitions"],
    ["commitment-devices", "intent-commitments"],
    ["cross-domain-atomicity", "transaction-atomicity"],
    ["cross-domain-atomicity", "bundle-atomicity"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["delegation", "batch-auctions", "order-flow-auctions", "preconfirmations", "settlement", "collective-action", "shared-sequencing"]);
  for (const [id, conceptId] of [...INTENTS_LAYER, ...INTENTS_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...INTENTS_LAYER, ...INTENTS_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Governance & Institutions has exactly its fifteen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("governance-institutions").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    GOVERNANCE_LAYER,
  );
  for (const [parent, children] of GOVERNANCE_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of GOVERNANCE_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "governance-institutions")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...GOVERNANCE_LAYER.map(([id]) => id), ...GOVERNANCE_L2.map(([id]) => id)].sort());
  assert.equal(GOVERNANCE_L2.length, 89);
});

test("Governance & Institutions reuses Delegation, Evidence and Incentive Alignment and keeps governance mechanisms distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("governance-institutions", conceptId);
  // Reused concepts keep their existing home as the preferred placement.
  assert.deepEqual(placementsOf("delegation"), ["delegation", "delegation-in-intents", "delegation-in-representation"]);
  for (const [conceptId, here] of [
    ["evidence", "evidence-in-dispute-resolution"],
    ["incentive-alignment", "incentive-alignment-in-institutional-design"],
  ]) {
    assert.deepEqual(placementsOf(conceptId), [conceptId, here].sort(), conceptId);
  }
  for (const conceptId of ["delegation", "evidence", "incentive-alignment"]) {
    assertPreferredThrough("governance-institutions", conceptId, conceptId);
  }
  // Governance mechanisms stay distinct from technically similar ones.
  for (const [placementId, related] of [
    ["voting", "agreement"],
    ["voters", "validators"],
    ["delegates", "delegation"],
    ["stakeholders", "participants"],
    ["quorum-requirements", "quorums"],
    ["approval-thresholds", "threshold-cryptography"],
    ["approval-thresholds", "threshold-signatures"],
    ["proposal-thresholds", "approval-thresholds"],
    ["governance-execution", "transaction-execution"],
    ["proposal-execution", "contract-execution"],
    ["execution-authority", "authority"],
    ["decision-rules", "consensus-rules"],
    ["social-consensus", "consensus"],
    ["vote-buying", "bribery"],
    ["signer-sets", "validator-sets"],
    ["signer-sets", "multisignatures"],
    ["security-councils", "availability-committees"],
    ["delegate-incentives", "incentives"],
    ["delegate-accountability", "accountability"],
    ["vote-privacy", "privacy"],
    ["emergency-upgrades", "protocol-upgrades"],
    ["representation", "multi-party-coordination"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["delegation", "evidence", "incentive-alignment"]);
  for (const [id, conceptId] of [...GOVERNANCE_LAYER, ...GOVERNANCE_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...GOVERNANCE_LAYER, ...GOVERNANCE_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Scaling & Modular Systems has exactly its fourteen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("scaling-modular-systems").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    SCALING_LAYER,
  );
  for (const [parent, children] of SCALING_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of SCALING_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "scaling-modular-systems")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...SCALING_LAYER.map(([id]) => id), ...SCALING_L2.map(([id]) => id)].sort());
  assert.equal(SCALING_L2.length, 80);
});

test("Scaling & Modular Systems reuses existing concepts and keeps scaling-specific concepts distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("scaling-modular-systems", conceptId);
  // The fixture's placements keep their IDs; Rollups is an L1 topic and its Finality an L2 topic.
  assert.equal(resolver.getPlacement("rollups")?.parentPlacementId, "scaling-modular-systems");
  assert.equal(resolver.getPlacement("finality-in-rollups")?.parentPlacementId, "rollups");
  assertPreferredThrough("scaling-modular-systems", "finality", "finality-in-consensus");
  assert.deepEqual(resolver.getRelationshipsTo("finality").map((relationship) => relationship.id), ["rollups-depend-on-finality"]);
  // Reused concepts are placed again here; their existing home stays preferred.
  for (const [conceptId, here] of [
    ["provers", "provers-in-zk-rollups"],
    ["recursive-proofs", "recursive-proofs-in-zk-rollups"],
    ["off-chain-execution", "off-chain-execution-in-off-chain-scaling"],
    ["parallel-execution", "parallel-execution-in-execution-layers"],
    ["transition-functions", "transition-functions-in-execution-layers"],
    ["state-commitments", "state-commitments-in-settlement-layers"],
    ["data-availability", "data-availability-in-data-availability-layers"],
    ["blobs", "blobs-in-data-availability-layers"],
    ["data-availability-sampling", "data-availability-sampling-in-data-availability-layers"],
    ["availability-committees", "availability-committees-in-data-availability-layers"],
    ["calldata", "calldata-in-data-availability-layers"],
    ["centralized-sequencing", "centralized-sequencing-in-rollup-sequencing"],
    ["decentralized-sequencing", "decentralized-sequencing-in-rollup-sequencing"],
    ["shared-sequencing", "shared-sequencing-in-rollup-sequencing"],
    ["trust-assumptions", "trust-assumptions-in-rollup-security"],
  ]) {
    assert.ok(placementsOf(conceptId).includes(here), `${conceptId} placed at ${here}`);
    assert.equal(resolver.getPlacement(here)?.conceptId, conceptId);
    assert.notEqual(resolver.getPreferredPlacementForConcept(conceptId)?.id, here, conceptId);
  }
  // Scaling-specific concepts stay distinct from their general or neighbouring counterparts.
  for (const [placementId, related] of [
    ["scaling", "cross-domain-coordination"],
    ["sidechains", "rollups"],
    ["optimistic-rollups", "optimistic-execution"],
    ["zk-rollups", "zero-knowledge-proofs"],
    ["validity-proofs", "computation-proofs"],
    ["fraud-proofs", "validity-proofs"],
    ["rollup-sequencing", "sequencing"],
    ["sequencers", "proposers"],
    ["state-proposers", "proposers"],
    ["rollup-settlement", "settlement"],
    ["settlement-layers", "settlement"],
    ["rollup-finality", "finality"],
    ["data-availability-layers", "state-storage"],
    ["execution-layers", "execution-models"],
    ["security-inheritance", "economic-security"],
    ["shared-security", "economic-security"],
    ["restaking", "stake"],
    ["throughput", "confirmation-latency"],
    ["confirmation-latency", "latency"],
    ["transaction-batching", "batch-auctions"],
    ["transaction-batching", "transaction-bundles"],
    ["transaction-batching", "batch-execution"],
    ["proof-aggregation", "signature-aggregation"],
    ["zkevms", "zkvms"],
    ["forced-withdrawals", "forced-inclusion"],
    ["upgrade-keys", "protocol-upgrades"],
    ["sequencer-censorship", "censorship"],
    ["based-sequencing", "based-rollups"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition (Finality keeps its own).
  const shared = new Set(["scaling", "rollups", "finality", "provers", "recursive-proofs", "off-chain-execution", "parallel-execution", "transition-functions", "state-commitments", "data-availability", "blobs", "data-availability-sampling", "availability-committees", "calldata", "centralized-sequencing", "decentralized-sequencing", "shared-sequencing", "trust-assumptions"]);
  for (const [id, conceptId] of [...SCALING_LAYER, ...SCALING_L2]) {
    if (conceptId !== "finality") assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...SCALING_LAYER, ...SCALING_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Interoperability & Abstraction has exactly its fourteen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("interoperability-abstraction").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    INTEROP_LAYER,
  );
  for (const [parent, children] of INTEROP_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of INTEROP_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "interoperability-abstraction")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...INTEROP_LAYER.map(([id]) => id), ...INTEROP_L2.map(([id]) => id)].sort());
  assert.equal(INTEROP_L2.length, 82);
});

test("Interoperability & Abstraction reuses existing concepts without moving their preferred placements", () => {
  const placementsOf = (conceptId: string) => placementsThrough("interoperability-abstraction", conceptId);
  // [concept, placement here, preferred placement (unchanged home)]
  for (const [conceptId, here, preferred] of [
    ["cross-domain-execution", "cross-domain-execution-in-interoperability-abstraction", "cross-domain-execution"],
    ["cross-domain-settlement", "cross-domain-settlement-in-interoperability-abstraction", "cross-domain-settlement"],
    ["cross-domain-atomicity", "cross-domain-atomicity-in-interoperability-abstraction", "cross-domain-atomicity"],
    ["relayers", "relayers-in-cross-chain-messaging", "relayers"],
    ["state-proofs", "state-proofs-in-cross-chain-state", "state-proofs"],
    ["state-roots", "state-roots-in-cross-chain-state", "state-roots-in-state-commitments"],
    ["finality", "finality-in-cross-chain-verification", "finality-in-consensus"],
    ["cross-chain-intents", "cross-chain-intents-in-cross-chain-execution", "cross-chain-intents"],
    ["shared-sequencing", "shared-sequencing-in-cross-chain-atomicity", "shared-sequencing"],
    ["account-abstraction", "account-abstraction-in-chain-abstraction", "account-abstraction"],
    ["gas-abstraction", "gas-abstraction-in-abstraction-layers", "gas-abstraction"],
    ["trust-assumptions", "trust-assumptions-in-trust-failure-modes", "trust-assumptions"],
    ["pause-mechanisms", "pause-mechanisms-in-trust-failure-modes", "pause-mechanisms"],
  ]) {
    assert.ok(placementsOf(conceptId).includes(here), `${conceptId} placed at ${here}`);
    assert.equal(resolver.getPlacement(here)?.conceptId, conceptId);
    assertPreferredThrough("interoperability-abstraction", conceptId, preferred);
  }
  // The cross-domain concepts are L1 topics here, each owning its own layer, in "Cross-Chain" wording.
  for (const [placementId, label] of [
    ["cross-domain-execution-in-interoperability-abstraction", "Cross-Chain Execution"],
    ["cross-domain-settlement-in-interoperability-abstraction", "Cross-Chain Settlement"],
    ["cross-domain-atomicity-in-interoperability-abstraction", "Cross-Chain Atomicity"],
  ]) {
    assert.equal(placementLabel(placementId), label);
    assert.ok(resolver.getChildren(placementId).length >= 5, placementId);
  }
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["bridges", "cross-chain-messaging"],
    ["cross-chain-verification", "verification"],
    ["bridge-security", "interoperability-security"],
    ["asset-bridging", "asset-abstraction"],
    ["chain-abstraction", "account-abstraction"],
    ["interoperability-protocols", "protocols"],
    ["cross-chain-messages", "message-propagation"],
    ["message-ordering", "transaction-ordering"],
    ["message-authentication", "authentication"],
    ["replay-protection", "replay-attacks"],
    ["wrapped-assets", "tokenized-assets"],
    ["canonical-assets", "native-assets"],
    ["remote-state", "global-state"],
    ["header-relaying", "message-relaying"],
    ["cross-chain-state-sync", "synchronization"],
    ["zk-verification", "proof-verification"],
    ["committee-verification", "availability-committees"],
    ["reorg-risk", "reorganizations"],
    ["atomic-swaps", "atomic-settlement"],
    ["unified-accounts", "accounts"],
    ["chain-routing", "execution-routing"],
    ["chain-routing", "chain-selection"],
    ["verifier-compromise", "source-compromise"],
    ["transfer-limits", "rate-limiting"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Cross-chain settlement and atomicity stay distinct from the generic concepts.
  assert.notEqual(resolver.getPlacement("cross-domain-settlement-in-interoperability-abstraction")?.conceptId, "settlement");
  assert.notEqual(resolver.getPlacement("cross-domain-atomicity-in-interoperability-abstraction")?.conceptId, "transaction-atomicity");
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["cross-domain-execution", "cross-domain-settlement", "cross-domain-atomicity", "relayers", "state-proofs", "state-roots", "finality", "cross-chain-intents", "shared-sequencing", "account-abstraction", "gas-abstraction", "trust-assumptions", "pause-mechanisms"]);
  for (const [id, conceptId] of [...INTEROP_LAYER, ...INTEROP_L2]) {
    if (conceptId !== "finality") assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...INTEROP_LAYER, ...INTEROP_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Security, Correctness & Resilience has exactly its twenty L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("security-correctness-resilience").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    SECURITY_LAYER,
  );
  for (const [parent, children] of SECURITY_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of SECURITY_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "security-correctness-resilience")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...SECURITY_LAYER.map(([id]) => id), ...SECURITY_L2.map(([id]) => id)].sort());
  assert.equal(SECURITY_L2.length, 119);
});

test("Security, Correctness & Resilience reuses existing concepts without moving their preferred placements", () => {
  const placementsOf = (conceptId: string) => placementsThrough("security-correctness-resilience", conceptId);
  // [concept, placement here, preferred placement (its home, unchanged)]
  for (const [conceptId, here, home] of [
    ["threat-models", "threat-models-in-security-models", "threat-models"],
    ["adversaries", "adversaries-in-security-models", "adversaries"],
    ["byzantine-behavior", "byzantine-behavior-in-security-models", "byzantine-behavior"],
    ["trust-boundaries", "trust-boundaries-in-security-models", "trust-boundaries"],
    ["safety", "safety-in-security-properties", "safety"],
    ["liveness", "liveness-in-security-properties", "liveness"],
    ["confidentiality", "confidentiality-in-security-properties", "confidentiality"],
    ["availability", "availability-in-security-properties", "availability"],
    ["censorship-resistance", "censorship-resistance-in-security-properties", "censorship-resistance-in-consensus-ordering"],
    ["sybil-attacks", "sybil-attacks-in-attack-classes", "sybil-attacks"],
    ["replay-attacks", "replay-attacks-in-attack-classes", "replay-attacks"],
    ["collusion", "collusion-in-attack-classes", "collusion"],
    ["griefing", "griefing-in-attack-classes", "griefing"],
    ["oracle-manipulation", "oracle-manipulation-in-smart-contract-security", "oracle-manipulation"],
    ["economic-attacks", "economic-attacks-in-protocol-security", "economic-attacks"],
    ["verification", "verification-in-correctness", "verification"],
    ["authentication", "authentication-in-access-control", "authentication"],
    ["permission-models", "permission-models-in-access-control", "permission-models"],
    ["alerting", "alerting-in-security-monitoring", "alerting"],
    ["pause-mechanisms", "pause-mechanisms-in-incident-response", "pause-mechanisms"],
    ["circuit-breakers", "circuit-breakers-in-incident-response", "circuit-breakers"],
    ["fault-tolerance", "fault-tolerance-in-resilience", "fault-tolerance"],
    ["redundancy", "redundancy-in-resilience", "redundancy"],
    ["failure-isolation", "failure-isolation-in-resilience", "failure-isolation"],
    ["economic-security", "economic-security-in-security-economics", "economic-security"],
    ["attack-cost", "attack-cost-in-security-economics", "attack-cost"],
    ["cost-of-corruption", "cost-of-corruption-in-security-economics", "cost-of-corruption"],
    ["security-inheritance", "security-inheritance-in-security-economics", "security-inheritance"],
    ["upgrade-keys", "upgrade-keys-in-upgrade-security", "upgrade-keys"],
    ["timelocks", "timelocks-in-upgrade-security", "timelocks"],
    ["emergency-upgrades", "emergency-upgrades-in-upgrade-security", "emergency-upgrades"],
    ["oracle-security", "oracle-security-in-domain-specific-security", "oracle-security"],
    ["governance-attacks", "governance-attacks-in-domain-specific-security", "governance-attacks"],
    ["rollup-security", "rollup-security-in-domain-specific-security", "rollup-security"],
    ["bridge-security", "bridge-security-in-domain-specific-security", "bridge-security"],
    ["mev-protection", "mev-protection-in-domain-specific-security", "mev-protection"],
    ["wallet-security", "wallet-security-in-domain-specific-security", "wallet-security"],
    ["incident-response", "incident-response-in-security-correctness-resilience", "incident-response"],
  ]) {
    assert.ok(placementsOf(conceptId).includes(here), `${conceptId} placed at ${here}`);
    assert.equal(resolver.getPlacement(here)?.conceptId, conceptId);
    assertPreferredThrough("security-correctness-resilience", conceptId, home);
    assert.notEqual(home, here, conceptId);
  }
  // Incident Response is an L1 topic here with its own layer; Emergency Governance stays 14's.
  assert.equal(resolver.getChildren("incident-response-in-security-correctness-resilience").length, 6);
  assert.deepEqual(resolver.getChildren("incident-response"), []);
  // Distinctions the taxonomy keeps explicit.
  for (const [placementId, related] of [
    ["security-models", "correctness"],
    ["correctness", "resilience"],
    ["security-properties", "protocol-properties"],
    ["correctness", "verification"],
    ["validation", "verification"],
    ["validation", "transaction-validation"],
    ["testing", "auditing"],
    ["auditing", "formal-verification"],
    ["vulnerabilities", "exploits"],
    ["threat-analysis", "attack-vectors"],
    ["attack-surfaces", "trust-boundaries"],
    ["threat-detection", "containment"],
    ["containment", "recovery"],
    ["resilience", "fault-tolerance"],
    ["protocol-security", "smart-contract-security"],
    ["cryptographic-security", "economic-security"],
    ["access-control", "authentication"],
    ["authorization", "authentication"],
    ["authorization", "authority"],
    ["incident-response", "emergency-governance"],
    ["invariants", "protocol-properties"],
    ["security-monitoring", "monitoring"],
    ["operational-failures", "network-attacks"],
    ["integrity", "integrity-guarantees"],
    ["security-assumptions", "trust-assumptions"],
    ["denial-of-service-attacks", "denial-of-service-resistance"],
    ["flash-loan-attacks", "borrowed-voting-power"],
    ["key-custody", "key-management"],
    ["recovery", "account-recovery"],
    ["upgrade-verification", "protocol-upgrades"],
    ["risk-assessment", "risk"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["threat-models", "adversaries", "byzantine-behavior", "trust-boundaries", "safety", "liveness", "confidentiality", "availability", "censorship-resistance", "sybil-attacks", "replay-attacks", "collusion", "griefing", "oracle-manipulation", "economic-attacks", "verification", "authentication", "permission-models", "alerting", "pause-mechanisms", "circuit-breakers", "fault-tolerance", "redundancy", "failure-isolation", "economic-security", "attack-cost", "cost-of-corruption", "security-inheritance", "upgrade-keys", "timelocks", "emergency-upgrades", "oracle-security", "governance-attacks", "rollup-security", "bridge-security", "mev-protection", "wallet-security", "incident-response"]);
  for (const [id, conceptId] of [...SECURITY_LAYER, ...SECURITY_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    // A concept can be placed twice within 17 itself.
    const alsoHere = [...SECURITY_LAYER, ...SECURITY_L2].filter(([other, concept]) => concept === conceptId && other !== concept).map(([other]) => other);
    assert.deepEqual([...placementsOf(conceptId)].sort(), [id, ...alsoHere].sort(), conceptId);
  }
  const ids = [...SECURITY_LAYER, ...SECURITY_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Protocol Architecture has exactly its twelve L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("protocol-architecture").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    ARCHITECTURE_LAYER,
  );
  for (const [parent, children] of ARCHITECTURE_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of ARCHITECTURE_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "protocol-architecture")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...ARCHITECTURE_LAYER.map(([id]) => id), ...ARCHITECTURE_L2.map(([id]) => id)].sort());
  assert.equal(ARCHITECTURE_L2.length, 68);
});

test("Protocol Architecture reuses existing concepts without moving their preferred placements", () => {
  const placementsOf = (conceptId: string) => placementsThrough("protocol-architecture", conceptId);
  // [concept, placement here, preferred placement (its home, unchanged)]
  for (const [conceptId, here, home] of [
    ["credible-neutrality", "credible-neutrality-in-architectural-principles", "credible-neutrality"],
    ["decentralization", "decentralization-in-architectural-principles", "decentralization"],
    ["modularity", "modularity-in-protocol-layers", "modularity"],
    ["layer-separation", "layer-separation-in-protocol-layers", "layer-separation"],
    ["component-interfaces", "component-interfaces-in-components-interfaces", "component-interfaces"],
    ["state-models", "state-models-in-state-architecture", "state-models"],
    ["execution-models", "execution-models-in-execution-architecture", "execution-models"],
    ["execution-clients", "execution-clients-in-client-architecture", "execution-clients"],
    ["network-topology", "network-topology-in-network-architecture", "network-topology"],
    ["data-schemas", "data-schemas-in-data-architecture", "data-schemas"],
    ["trust-boundaries", "trust-boundaries-in-trust-architecture", "trust-boundaries"],
    ["trust-minimization", "trust-minimization-in-trust-architecture", "trust-minimization"],
    ["cross-chain-composability", "cross-chain-composability-in-composability", "cross-chain-composability"],
    ["immutability", "immutability-in-architectural-tradeoffs", "immutability"],
  ]) {
    assert.ok(placementsOf(conceptId).includes(here), `${conceptId} placed at ${here}`);
    assert.equal(resolver.getPlacement(here)?.conceptId, conceptId);
    assertPreferredThrough("protocol-architecture", conceptId, home);
    assert.notEqual(home, here, conceptId);
  }
  // Architecture concepts stay distinct from the layer mechanics and neighbouring concepts.
  for (const [placementId, related] of [
    ["layered-architecture", "layer-separation"],
    ["protocol-stack", "modularity"],
    ["protocol-minimalism", "governance-minimization"],
    ["protocol-standards", "interoperability-standards"],
    ["state-partitioning", "state-layout"],
    ["shared-state", "global-state"],
    ["concurrency-models", "parallel-execution"],
    ["execution-boundaries", "authority-boundaries"],
    ["proxy-patterns", "proxy-upgrade-risks"],
    ["network-layers", "protocol-layers"],
    ["data-models", "state-models"],
    ["storage-architecture", "storage-layout"],
    ["trusted-computing-base", "trusted-hardware"],
    ["atomic-composability", "transaction-atomicity"],
    ["coupling", "layer-coupling"],
    ["protocol-components", "component-interfaces"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["credible-neutrality", "decentralization", "modularity", "layer-separation", "component-interfaces", "state-models", "execution-models", "execution-clients", "network-topology", "data-schemas", "trust-boundaries", "trust-minimization", "cross-chain-composability", "immutability"]);
  for (const [id, conceptId] of [...ARCHITECTURE_LAYER, ...ARCHITECTURE_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  const ids = [...ARCHITECTURE_LAYER, ...ARCHITECTURE_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Protocol Design & Lifecycle has exactly its fourteen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("protocol-design-lifecycle").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    LIFECYCLE_LAYER,
  );
  for (const [parent, children] of LIFECYCLE_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of LIFECYCLE_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "protocol-design-lifecycle")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...LIFECYCLE_LAYER.map(([id]) => id), ...LIFECYCLE_L2.map(([id]) => id)].sort());
  assert.equal(LIFECYCLE_L2.length, 81);
});

test("Protocol Design & Lifecycle reuses existing concepts without moving their preferred placements", () => {
  const placementsOf = (conceptId: string) => placementsThrough("protocol-design-lifecycle", conceptId);
  // [concept, placement here, preferred placement (its home, unchanged)]
  for (const [conceptId, here, home] of [
    ["stakeholders", "stakeholders-in-protocol-requirements", "stakeholders"],
    ["security-requirements", "security-requirements-in-protocol-requirements", "security-requirements"],
    ["invariants", "invariants-in-design-goals-constraints", "invariants"],
    ["specifications", "specifications-in-protocol-specification", "specifications"],
    ["formal-specifications", "formal-specifications-in-protocol-specification", "formal-specifications"],
    ["rules", "rules-in-protocol-specification", "rules"],
    ["state-machines", "state-machines-in-protocol-modeling", "state-machines"],
    ["mechanism-design", "mechanism-design-in-protocol-modeling", "mechanism-design"],
    ["threat-modeling", "threat-modeling-in-protocol-modeling", "threat-modeling"],
    ["client-diversity", "client-diversity-in-protocol-implementation", "client-diversity"],
    ["validation", "validation-in-pre-launch-validation", "validation"],
    ["testing", "testing-in-pre-launch-validation", "testing"],
    ["formal-methods", "formal-methods-in-pre-launch-validation", "formal-methods"],
    ["auditing", "auditing-in-pre-launch-validation", "auditing"],
    ["bug-bounties", "bug-bounties-in-pre-launch-validation", "bug-bounties"],
    ["deployment-security", "deployment-security-in-deployment-launch", "deployment-security"],
    ["parameter-changes", "parameter-changes-in-parameterization", "parameter-changes"],
    ["incident-response", "incident-response-in-protocol-operations", "incident-response"],
    ["protocol-upgrades", "protocol-upgrades-in-change-management", "protocol-upgrades"],
    ["rule-changes", "rule-changes-in-change-management", "rule-changes"],
    ["technical-debt", "technical-debt-in-protocol-evolution", "technical-debt"],
  ]) {
    assert.ok(placementsOf(conceptId).includes(here), `${conceptId} placed at ${here}`);
    assert.equal(resolver.getPlacement(here)?.conceptId, conceptId);
    assertPreferredThrough("protocol-design-lifecycle", conceptId, home);
    assert.notEqual(home, here, conceptId);
  }
  // Lifecycle concepts stay distinct from the design-time, architecture, security and governance ones they sit near.
  for (const [placementId, related] of [
    ["protocol-design-lifecycle", "protocol-architecture"],
    ["protocol-requirements", "security-requirements"],
    ["design-goals", "mechanism-objectives"],
    ["design-constraints", "mechanism-constraints"],
    ["design-assumptions", "trust-assumptions"],
    ["design-assumptions", "security-assumptions"],
    ["protocol-specification", "specifications"],
    ["protocol-modeling", "state-models"],
    ["economic-modeling", "mechanism-design"],
    ["prototyping", "protocol-simulation"],
    ["reference-implementations", "production-implementations"],
    ["protocol-deployment", "contract-deployment"],
    ["protocol-launch", "protocol-deployment"],
    ["protocol-parameters", "parameter-changes"],
    ["change-management", "governance-institutions"],
    ["protocol-evolution", "institutional-evolution"],
    ["protocol-versioning", "protocol-upgrades"],
    ["migrations", "protocol-upgrades"],
    ["backward-compatibility", "interoperability-models"],
    ["deprecation", "protocol-sunsetting"],
    ["ossification", "governance-minimization"],
    ["protocol-retirement", "operational-failures"],
    ["pre-launch-validation", "verification"],
    ["lifecycle-risks", "technical-debt"],
    ["hard-forks", "competing-forks"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Protocol rules are Foundations' Rules, not a lifecycle-qualified duplicate.
  assert.equal(resolver.getConcept("protocol-rules"), undefined);
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["stakeholders", "security-requirements", "invariants", "specifications", "formal-specifications", "rules", "state-machines", "mechanism-design", "threat-modeling", "client-diversity", "validation", "testing", "formal-methods", "auditing", "bug-bounties", "deployment-security", "parameter-changes", "incident-response", "protocol-upgrades", "rule-changes", "technical-debt"]);
  for (const [id, conceptId] of [...LIFECYCLE_LAYER, ...LIFECYCLE_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual([...placementsOf(conceptId)].sort(), [id].sort(), conceptId);
  }
  const ids = [...LIFECYCLE_LAYER, ...LIFECYCLE_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("AI & Intelligent Systems has exactly its twelve L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("ai-intelligent-systems").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    AI_LAYER,
  );
  assert.deepEqual(resolver.getChildren("ai-intelligent-systems").map((placement) => placement.order), AI_LAYER.map((_, order) => order));
  for (const [parent, children] of AI_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of AI_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "ai-intelligent-systems")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...AI_LAYER.map(([id]) => id), ...AI_L2.map(([id]) => id)].sort());
  assert.equal(AI_L2.length, 69);
  // Ancestry runs through the L1 placement to the L0 domain.
  assert.deepEqual(resolver.getAncestors("zkml").map((placement) => placement.id), ["ai-intelligent-systems", "verifiable-ai"]);
  assert.deepEqual(resolver.getAncestors("delegation-in-ai-agents").map((placement) => placement.id), ["ai-intelligent-systems", "ai-agent"]);
  assert.deepEqual(resolver.getAncestors("model-inputs").map((placement) => placement.id), ["ai-intelligent-systems", "ai-inference-in-ai-intelligent-systems"]);
});

test("AI & Intelligent Systems reuses existing concepts where the meaning is the same and keeps related concepts distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("ai-intelligent-systems", conceptId);
  // AI Inference and Inference Confidence: 09's concepts, preferred here, their conceptual home.
  assert.deepEqual(placementsOf("ai-inference"), ["ai-inference", "ai-inference-in-ai-intelligent-systems"]);
  assertPreferredThrough("ai-intelligent-systems", "ai-inference", "ai-inference-in-ai-intelligent-systems");
  assert.equal(resolver.getChildren("ai-inference-in-ai-intelligent-systems").length, 6);
  assert.deepEqual(resolver.getChildren("ai-inference"), []);
  assert.deepEqual(placementsOf("inference-confidence"), ["inference-confidence", "inference-confidence-in-uncertainty-reliability"]);
  assertPreferredThrough("ai-intelligent-systems", "inference-confidence", "inference-confidence-in-uncertainty-reliability");
  // 09 keeps its contextual wording; here the concept title is shown.
  assert.equal(placementLabel("inference-confidence"), "Confidence");
  assert.equal(placementLabel("inference-confidence-in-uncertainty-reliability"), "Inference Confidence");
  // Delegation, Agent Identity and Trusted Execution stay preferred at home
  // (13 and 14 also place Delegation).
  for (const [conceptId, here] of [
    ["delegation", "delegation-in-ai-agents"],
    ["agent-identity", "agent-identity-in-ai-agents"],
    ["trusted-execution", "trusted-execution-in-verifiable-ai"],
  ]) {
    const earlier = conceptId === "delegation" ? ["delegation-in-intents", "delegation-in-representation"] : [];
    assert.deepEqual(placementsOf(conceptId), [conceptId, here, ...earlier].sort(), conceptId);
    assertPreferredThrough("ai-intelligent-systems", conceptId, conceptId);
  }
  // Principals is a general concept, titled without an AI qualifier.
  assert.equal(resolver.getConcept("principals")?.title, "Principals");
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["training-data-poisoning", "data-poisoning"],
    ["reasoning-traces", "execution-traces"],
    ["reasoning-traces", "distributed-traces"],
    ["decoding", "sampling"],
    ["inference-reproducibility", "determinism"],
    ["inference-reproducibility", "non-deterministic-execution"],
    ["inference-cost", "execution-cost"],
    ["goals", "mechanism-objectives"],
    ["goal-specification", "mechanism-objectives"],
    ["alignment-control", "incentive-alignment"],
    ["specification-gaming", "manipulation"],
    ["principals", "participants"],
    ["principals", "players"],
    ["model-robustness", "fault-tolerance"],
    ["model-provenance", "provenance"],
    ["model-provenance", "source-provenance"],
    ["model-commitments", "commitment-schemes"],
    ["verifiable-inference", "verifiable-execution"],
    ["verifiable-inference", "computation-proofs"],
    ["retrieval-augmented-generation", "data-retrieval"],
    ["retrieval-augmented-generation", "content-retrieval"],
    ["tool-protocols", "protocols"],
    ["verifiable-agents", "agent-identity"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition; only
  // Agent Identity keeps its existing content.
  const shared = new Set(["ai-inference", "ai-agent", "delegation", "agent-identity", "inference-confidence", "trusted-execution"]);
  for (const [id, conceptId] of [...AI_LAYER, ...AI_L2]) {
    if (conceptId !== "agent-identity") assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...AI_LAYER, ...AI_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("AI & Intelligent Systems keeps the fixture's AI Agent", () => {
  // The fixture's concept, placement ID and relationships are unchanged; only
  // its position and contextual wording change.
  assert.equal(resolver.getConcept("ai-agent")?.title, "AI Agent");
  assert.deepEqual(placementsOf("ai-agent"), ["ai-agent"]);
  const placement = resolver.getPlacement("ai-agent");
  assert.equal(placement?.parentPlacementId, "ai-intelligent-systems");
  assert.equal(placement?.order, 6);
  assert.equal(placement?.contextualLabel, "AI Agents");
  assert.equal(resolver.getContentForConcept("ai-agent"), undefined);
  assert.deepEqual(
    resolver.getRelationshipsTo("ai-agent").map((relationship) => [relationship.id, relationship.sourceConceptId, relationship.typeId]),
    [
      ["agent-identity-authenticates-ai-agent", "agent-identity", "authenticates"],
      ["authority-constrains-ai-agent", "authority", "constrains"],
    ],
  );
  assertPreferredThrough("ai-intelligent-systems", "ai-agent", "ai-agent");
  // Economic Agency is left to Machine Economy.
  assert.deepEqual(placementsOf("economic-agency"), []);

  function placementsOf(conceptId: string) {
    return placementsThrough("ai-intelligent-systems", conceptId);
  }
});

test("Machine Economy has exactly its fourteen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("machine-economy").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    MACHINE_ECONOMY_LAYER,
  );
  assert.deepEqual(resolver.getChildren("machine-economy").map((placement) => placement.order), MACHINE_ECONOMY_LAYER.map((_, order) => order));
  for (const [parent, children] of MACHINE_ECONOMY_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of MACHINE_ECONOMY_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "machine-economy")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...MACHINE_ECONOMY_LAYER.map(([id]) => id), ...MACHINE_ECONOMY_L2.map(([id]) => id)].sort());
  assert.equal(MACHINE_ECONOMY_L2.length, 84);
  // Ancestry runs through the L1 placement to the L0 domain.
  assert.deepEqual(resolver.getAncestors("micropayments").map((placement) => placement.id), ["machine-economy", "machine-payments"]);
  assert.deepEqual(resolver.getAncestors("agent-credentials-in-agent-identity").map((placement) => placement.id), ["machine-economy", "agent-identity-in-machine-economy"]);
  assert.deepEqual(resolver.getAncestors("ai-agent-in-economic-agents").map((placement) => placement.id), ["machine-economy", "economic-agents"]);
});

test("Machine Economy reuses existing concepts where the meaning is the same and keeps related concepts distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("machine-economy", conceptId);
  // Agent Identity: 08's concept (with its exposition), an L1 topic here with its own layer; 08 stays preferred.
  assert.deepEqual(placementsOf("agent-identity"), ["agent-identity", "agent-identity-in-ai-agents", "agent-identity-in-machine-economy"]);
  assertPreferredThrough("machine-economy", "agent-identity", "agent-identity");
  assert.equal(resolver.getChildren("agent-identity-in-machine-economy").length, 6);
  assert.deepEqual(resolver.getChildren("agent-identity"), []);
  // Agent Reputation: 08's concept, an L1 topic here with its own layer and
  // Agent Identity's "Reputation"; preferred here, where it is taught.
  assert.deepEqual(placementsOf("agent-reputation"), ["agent-reputation", "agent-reputation-in-agent-identity", "agent-reputation-in-machine-economy"]);
  assertPreferredThrough("machine-economy", "agent-reputation", "agent-reputation-in-machine-economy");
  assert.equal(resolver.getChildren("agent-reputation-in-machine-economy").length, 6);
  assert.deepEqual(resolver.getChildren("agent-reputation-in-agent-identity"), []);
  // Every other reused concept stays preferred at its home.
  const reused: Array<[string, string]> = [
    ["ai-agent", "ai-agent"],
    ["protocols", "protocols"],
    ["agent-credentials", "agent-credentials"],
    ["machine-authentication", "machine-authentication"],
    ["key-management", "key-management"],
    ["smart-accounts", "smart-accounts"],
    ["wallet-recovery", "wallet-recovery"],
    ["assets", "assets"],
    ["liquidity", "liquidity"],
    ["capabilities", "capabilities"],
    ["delegation", "delegation"],
    ["permission-models", "permission-models"],
    ["revocation", "revocation"],
    ["settlement", "settlement"],
    ["attestations", "attestations-in-identity"],
    ["collateral", "collateral"],
    ["repayment", "repayment"],
    ["counterparty-risk", "counterparty-risk"],
    ["payment-channels", "payment-channels"],
    ["rewards", "rewards"],
    ["penalties", "penalties"],
    ["incentive-alignment", "incentive-alignment"],
    ["incentive-compatibility", "incentive-compatibility"],
  ];
  const here = new Map(MACHINE_ECONOMY_L2.map(([id, conceptId]) => [conceptId, id]));
  for (const [conceptId, preferred] of reused) {
    assert.ok(placementsOf(conceptId).includes(here.get(conceptId)!), conceptId);
    assert.notEqual(here.get(conceptId), conceptId, `${conceptId} keeps a distinct placement identity here`);
    assertPreferredThrough("machine-economy", conceptId, preferred);
    assertPreferredThrough("machine-economy", conceptId, preferred);
  }
  // Contextual wording over reused and new concepts.
  assert.equal(resolver.getConcept("ai-agent")?.title, "AI Agent");
  assert.equal(resolver.getConcept("agent-credentials")?.title, "Agent Credentials");
  assert.equal(resolver.getConcept("machine-authentication")?.title, "Machine Authentication");
  assert.equal(resolver.getConcept("authority-escalation")?.title, "Authority Escalation");
  assert.equal(resolver.getConcept("credit-default")?.title, "Credit Default");
  assert.equal(resolver.getConcept("agent-objectives")?.title, "Agent Objectives");
  for (const bare of ["objectives", "default", "escalation", "economic-agent"]) assert.equal(resolver.getConcept(bare), undefined, bare);
  // Related but distinct concepts.
  for (const [placementId, related] of [
    ["economic-agents", "economic-agency"],
    ["agent-permissions", "agent-authorization"],
    ["agent-permissions", "account-permissions"],
    ["agent-wallets", "wallets"],
    ["agent-accounts", "accounts"],
    ["agent-ownership", "ownership"],
    ["agent-risk", "risk"],
    ["agent-incentives", "incentives"],
    ["agent-markets", "markets"],
    ["session-authority", "session-keys"],
    ["identity-recovery", "account-recovery"],
    ["identity-recovery", "wallet-recovery"],
    ["resource-budgets", "resource-limits"],
    ["capital-constraints", "solvency-constraints"],
    ["capital-allocation", "capacity-allocation"],
    ["policy-constraints", "mechanism-constraints"],
    ["automated-settlement", "settlement"],
    ["price-discovery", "market-prices"],
    ["trust-scores", "trust-models"],
    ["reputation-attacks", "sybil-attacks"],
    ["credit-default", "bad-debt"],
    ["credit-default", "insolvency"],
    ["creditworthiness", "credit-risk"],
    ["risk-limits", "risk-parameters"],
    ["model-risk", "model-uncertainty"],
    ["agent-objectives", "goals"],
    ["agent-objectives", "mechanism-objectives"],
    ["principal-agent-problems", "principals"],
    ["human-agents", "participants"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition; only
  // Agent Identity keeps its existing content.
  const shared = new Set(["agent-identity", "agent-reputation", ...reused.map(([conceptId]) => conceptId)]);
  for (const [id, conceptId] of [...MACHINE_ECONOMY_LAYER, ...MACHINE_ECONOMY_L2]) {
    if (conceptId !== "agent-identity") assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...MACHINE_ECONOMY_LAYER, ...MACHINE_ECONOMY_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Machine Economy leaves Economic Agency unplaced and 20 unchanged", () => {
  // Economic Agency (the capacity to act economically) is not Economic Agents
  // (the kinds of actor); its relationship from Agent Identity is unchanged.
  assert.deepEqual(placementsThrough("machine-economy", "economic-agency"), []);
  assert.equal(resolver.getContentForConcept("economic-agency"), undefined);
  assert.deepEqual(resolver.getRelationshipsTo("economic-agency").map((relationship) => relationship.id), ["agent-identity-enables-economic-agency"]);
  // 20's tree is exactly as authored.
  assert.deepEqual(resolver.getChildren("ai-intelligent-systems").map((placement) => placement.id), AI_LAYER.map(([id]) => id));
  for (const [parent, children] of AI_TREE) {
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.id), children.map(([id]) => id), parent);
  }
  assert.equal(placementLabel("ai-agent"), "AI Agents");
});

test("Autonomous Coordination has exactly its ten L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("autonomous-coordination").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    COORDINATION_LAYER,
  );
  assert.deepEqual(resolver.getChildren("autonomous-coordination").map((placement) => placement.order), COORDINATION_LAYER.map((_, order) => order));
  for (const [parent, children] of COORDINATION_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of COORDINATION_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "autonomous-coordination")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...COORDINATION_LAYER.map(([id]) => id), ...COORDINATION_L2.map(([id]) => id)].sort());
  assert.equal(COORDINATION_L2.length, 60);
  // Ancestry runs through the L1 placement to the L0 domain.
  assert.deepEqual(resolver.getAncestors("task-bidding").map((placement) => placement.id), ["autonomous-coordination", "task-markets"]);
  assert.deepEqual(resolver.getAncestors("revocation-in-delegation").map((placement) => placement.id), ["autonomous-coordination", "delegation-in-autonomous-coordination"]);
  assert.deepEqual(resolver.getAncestors("agent-synchronization").map((placement) => placement.id), ["autonomous-coordination", "multi-agent-coordination"]);
});

test("Autonomous Coordination reuses existing concepts where the meaning is the same and keeps narrower concepts distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("autonomous-coordination", conceptId);
  // L1 topics that are existing concepts, each with its own layer here. Taught
  // here, Negotiation, Delegation, Cooperation and Competition are preferred
  // here; Resource Allocation stays preferred in 10, its economic home.
  for (const [conceptId, elsewhere, preferred] of [
    ["negotiation", ["negotiation"], "negotiation-in-autonomous-coordination"],
    ["delegation", ["delegation", "delegation-in-intents", "delegation-in-representation", "delegation-in-ai-agents", "delegation-in-agent-permissions"], "delegation-in-autonomous-coordination"],
    ["cooperation", ["cooperation"], "cooperation-in-autonomous-coordination"],
    ["competition", ["competition"], "competition-in-autonomous-coordination"],
    ["resource-allocation", ["resource-allocation"], "resource-allocation"],
  ] as const) {
    const here = `${conceptId}-in-autonomous-coordination`;
    assert.deepEqual(placementsOf(conceptId), [...elsewhere, here].sort(), conceptId);
    assertPreferredThrough("autonomous-coordination", conceptId, preferred);
    assertPreferredThrough("autonomous-coordination", conceptId, preferred);
    assert.equal(resolver.getChildren(here).length, 6, here);
  }
  // The same concepts elsewhere keep their own (empty or separate) layers.
  assert.deepEqual(resolver.getChildren("negotiation"), []);
  assert.deepEqual(resolver.getChildren("delegation"), []);
  assert.deepEqual(resolver.getChildren("cooperation"), []);
  assert.equal(resolver.getChildren("resource-allocation").length, 6);
  // L2 topics that are existing concepts.
  for (const [conceptId, here, preferred] of [
    ["service-discovery", "service-discovery-in-agent-discovery", "service-discovery-in-agent-discovery"],
    ["revocation", "revocation-in-delegation", "revocation"],
    ["strategic-behavior", "strategic-behavior-in-competition", "strategic-behavior-in-economics-mechanism-design"],
    ["capital-allocation", "capital-allocation-in-resource-allocation", "capital-allocation"],
  ]) {
    assert.ok(placementsOf(conceptId).includes(here), conceptId);
    assertPreferredThrough("autonomous-coordination", conceptId, preferred);
  }
  // Contextual wording over new concepts, leaving the bare terms free.
  assert.equal(resolver.getConcept("negotiated-agreement")?.title, "Negotiated Agreement");
  assert.equal(resolver.getConcept("competitive-selection")?.title, "Competitive Selection");
  assert.equal(resolver.getConcept("agent-synchronization")?.title, "Agent Synchronization");
  for (const bare of ["selection", "messages", "discovery", "coordination-protocol"]) assert.equal(resolver.getConcept(bare), undefined, bare);
  // Narrower coordination concepts kept distinct from the general ones, and other near pairs.
  for (const [placementId, related] of [
    ["task-delegation", "delegation"],
    ["authority-delegation", "delegation"],
    ["capability-discovery", "capabilities"],
    ["message-protocols", "protocols"],
    ["message-protocols", "tool-protocols"],
    ["coordination-protocols", "protocols"],
    ["competitive-strategies", "strategies"],
    ["cooperative-strategies", "strategies"],
    ["negotiation-strategies", "strategies"],
    ["coalition-incentives", "incentives"],
    ["bidding", "bids"],
    ["task-bidding", "bids"],
    ["task-bidding", "bidding"],
    ["task-settlement", "settlement"],
    ["emergent-coordination", "coordination"],
    ["multi-agent-coordination", "coordination"],
    ["agent-to-agent-communication", "coordination-communication"],
    ["agent-to-agent-communication", "communication"],
    ["agent-discovery", "peer-discovery"],
    ["message-routing", "request-routing"],
    ["negotiated-agreement", "agreement"],
    ["offers", "bids"],
    ["matching", "order-matching"],
    ["agent-synchronization", "synchronization"],
    ["competitive-selection", "validator-selection"],
    ["competitive-equilibria", "nash-equilibrium"],
    ["collective-decision-making", "consensus"],
    ["collective-decision-making", "collective-action"],
    ["shared-plans", "plans"],
    ["shared-objectives", "agent-objectives"],
    ["information-sharing", "information"],
    ["coalition-formation", "collusion"],
    ["compute-allocation", "capacity-allocation"],
    ["task-discovery", "service-discovery"],
    ["task-assignment", "task-decomposition"],
    ["task-markets", "service-markets"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  const shared = new Set(["negotiation", "delegation", "cooperation", "competition", "resource-allocation", "service-discovery", "revocation", "strategic-behavior", "capital-allocation"]);
  for (const [id, conceptId] of [...COORDINATION_LAYER, ...COORDINATION_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...COORDINATION_LAYER, ...COORDINATION_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Autonomous Coordination leaves 20 and 21 unchanged", () => {
  for (const [root, layer, tree] of [
    ["ai-intelligent-systems", AI_LAYER, AI_TREE],
    ["machine-economy", MACHINE_ECONOMY_LAYER, MACHINE_ECONOMY_TREE],
  ] as const) {
    assert.deepEqual(resolver.getChildren(root).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), layer, root);
    for (const [parent, children] of tree) {
      assert.deepEqual(resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), children, parent);
    }
  }
});

test("Autonomous Execution has exactly its eleven L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("autonomous-execution").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    EXECUTION_LAYER,
  );
  assert.deepEqual(resolver.getChildren("autonomous-execution").map((placement) => placement.order), EXECUTION_LAYER.map((_, order) => order));
  for (const [parent, children] of EXECUTION_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of EXECUTION_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "autonomous-execution")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...EXECUTION_LAYER.map(([id]) => id), ...EXECUTION_L2.map(([id]) => id)].sort());
  assert.equal(EXECUTION_L2.length, 66);
  assert.deepEqual(resolver.getAncestors("human-approval").map((placement) => placement.id), ["autonomous-execution", "execution-authorization"]);
  assert.deepEqual(resolver.getAncestors("settlement-in-verification-settlement").map((placement) => placement.id), ["autonomous-execution", "verification-settlement"]);
});

test("Autonomous Execution reuses existing concepts at their homes and keeps execution-time controls distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("autonomous-execution", conceptId);
  // Each reused concept gains exactly this placement here and stays preferred at its home.
  const reused = EXECUTION_L2.filter(([id, conceptId]) => id !== conceptId);
  assert.deepEqual(reused.map(([, conceptId]) => conceptId), [
    "goals", "success-criteria", "plans", "replanning", "tool-selection", "execution-routing", "transaction-simulation", "policy-constraints",
    "capabilities", "trusted-execution", "agent-actions", "tool-calling", "transaction-construction", "transaction-submission",
    "verifiable-execution", "settlement", "observability", "anomaly-detection", "alerting", "human-oversight", "circuit-breakers",
  ]);
  for (const [id, conceptId] of reused) {
    assert.equal(id, `${conceptId}-in-${resolver.getPlacement(id)?.parentPlacementId}`, id);
    assert.ok(placementsOf(conceptId).includes(id), id);
    const preferred = resolver.getConcept(conceptId)?.preferredPlacementId;
    assert.ok(preferred && resolver.getAncestors(preferred)[0]?.id !== "autonomous-execution", `${conceptId} stays preferred at home`);
    assertPreferredThrough("autonomous-execution", conceptId, preferred);
  }
  // Simulation is a new general concept, an L1 topic here; Intent Generation
  // leaves Intents to 13, and Approval Thresholds here are not 14's.
  assert.equal(resolver.getConcept("simulation")?.title, "Simulation");
  assert.equal(resolver.getConcept("action-approval-thresholds")?.title, "Action Approval Thresholds");
  // Execution-specific concepts kept distinct from the concepts they sit near.
  for (const [placementId, related] of [
    ["intent-generation", "intents"],
    ["action-approval-thresholds", "approval-thresholds"],
    ["runtime-authorization", "agent-authorization"],
    ["runtime-authorization", "spending-authority"],
    ["authorization-scopes", "agent-permissions"],
    ["multi-party-approval", "multisignatures"],
    ["human-approval", "human-oversight"],
    ["policy-enforcement", "budget-enforcement"],
    ["risk-checks", "risk-limits"],
    ["execution-constraints", "policy-constraints"],
    ["execution-constraints", "mechanism-constraints"],
    ["success-criteria", "goal-specification"],
    ["action-dependencies", "delegation-chains"],
    ["resource-estimation", "resource-budgets"],
    ["cost-estimation", "inference-cost"],
    ["cost-estimation", "execution-cost"],
    ["candidate-evaluation", "ai-evaluation"],
    ["state-forking", "competing-forks"],
    ["simulation-divergence", "distribution-shift"],
    ["tool-permissions", "agent-permissions"],
    ["execution-isolation", "execution-context"],
    ["partial-execution", "transaction-atomicity"],
    ["rollbacks", "transaction-reversion"],
    ["rollbacks", "reorganizations"],
    ["outcome-verification", "verification"],
    ["execution-receipts", "logs"],
    ["audit-trails", "traceability"],
    ["execution-failures", "failures"],
    ["kill-switches", "circuit-breakers"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  for (const [id, conceptId] of [...EXECUTION_LAYER, ...EXECUTION_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (id !== conceptId) continue;
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...EXECUTION_LAYER, ...EXECUTION_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Autonomous Execution leaves 20–22 unchanged", () => {
  for (const [root, layer, tree] of [
    ["ai-intelligent-systems", AI_LAYER, AI_TREE],
    ["machine-economy", MACHINE_ECONOMY_LAYER, MACHINE_ECONOMY_TREE],
    ["autonomous-coordination", COORDINATION_LAYER, COORDINATION_TREE],
  ] as const) {
    assert.deepEqual(resolver.getChildren(root).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), layer, root);
    for (const [parent, children] of tree) {
      assert.deepEqual(resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), children, parent);
    }
  }
});

test("Autonomous Organizations has exactly its fifteen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("autonomous-organizations").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    ORGANIZATIONS_LAYER,
  );
  assert.deepEqual(resolver.getChildren("autonomous-organizations").map((placement) => placement.order), ORGANIZATIONS_LAYER.map((_, order) => order));
  for (const [parent, children] of ORGANIZATIONS_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of ORGANIZATIONS_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "autonomous-organizations")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...ORGANIZATIONS_LAYER.map(([id]) => id), ...ORGANIZATIONS_L2.map(([id]) => id)].sort());
  assert.equal(ORGANIZATIONS_L2.length, 88);
  assert.deepEqual(resolver.getAncestors("treasury-custody").map((placement) => placement.id), ["autonomous-organizations", "treasuries-in-autonomous-organizations"]);
  assert.deepEqual(resolver.getAncestors("voting-in-organizational-governance").map((placement) => placement.id), ["autonomous-organizations", "organizational-governance"]);
});

test("Autonomous Organizations reuses existing concepts where the meaning is the same and keeps organization-level concepts distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("autonomous-organizations", conceptId);
  // Organizations (21) and Treasuries (14) are L1 topics here with their own
  // layers; preferred here, where they are taught.
  for (const [conceptId, home] of [
    ["organizations", "organizations"],
    ["treasuries", "treasuries"],
  ]) {
    const here = `${conceptId}-in-autonomous-organizations`;
    assert.deepEqual(placementsOf(conceptId), [home, here].sort(), conceptId);
    assertPreferredThrough("autonomous-organizations", conceptId, here);
    assert.equal(resolver.getChildren(here).length, conceptId === "organizations" ? 5 : 6, here);
    assert.deepEqual(resolver.getChildren(home), [], home);
  }
  // Every other reused concept gains this placement here and stays preferred at its home.
  const reused = ORGANIZATIONS_L2.filter(([id, conceptId]) => id !== conceptId);
  assert.equal(reused.length, 34);
  for (const [id, conceptId] of reused) {
    assert.equal(id, `${conceptId}-in-${resolver.getPlacement(id)?.parentPlacementId}`, id);
    assert.ok(placementsOf(conceptId).includes(id), id);
    const preferred = resolver.getConcept(conceptId)?.preferredPlacementId;
    assert.ok(preferred && preferred !== id, `${conceptId} stays preferred at its home`);
    assertPreferredThrough("autonomous-organizations", conceptId, preferred);
  }
  // Organization-level concepts kept distinct from the concepts they sit near.
  for (const [placementId, related] of [
    ["organizational-membership", "coalition-membership"],
    ["organizational-governance", "governance-models"],
    ["hybrid-governance", "governance-models"],
    ["cross-organizational-governance", "organizational-governance"],
    ["organizational-policies", "execution-policies"],
    ["organizational-workflows", "execution-planning"],
    ["workflow-definitions", "plans"],
    ["accountability-auditability", "accountability"],
    ["liability", "accountability"],
    ["auditability", "audit-trails"],
    ["responsibility-attribution", "attribution"],
    ["treasury-custody", "key-management"],
    ["runway", "solvency"],
    ["organizational-autonomy", "autonomy-levels"],
    ["organizational-lifecycle", "contract-lifecycle"],
    ["organizational-dissolution", "coalition-dissolution"],
    ["organization-formation", "coalition-formation"],
    ["organizational-alliances", "coalition-formation"],
    ["federations", "councils-committees"],
    ["sub-organizations", "working-groups"],
    ["organizational-identity", "identity"],
    ["organizational-identity", "agent-identity"],
    ["organizational-objectives", "shared-objectives"],
    ["organizational-objectives", "agent-objectives"],
    ["membership-tokens", "token-holders"],
    ["member-exit", "exit-rights"],
    ["decision-rights", "capabilities"],
    ["automated-decisions", "collective-decision-making"],
    ["organizational-compliance", "policy-constraints"],
    ["policy-updates", "rule-changes"],
    ["budget-cycles", "budget-allocation"],
    ["contributor-compensation", "rewards"],
    ["spending-approvals", "human-approval"],
    ["approval-workflows", "multi-party-approval"],
    ["handoffs", "task-delegation"],
    ["workflow-automation", "automation"],
    ["service-level-agreements", "negotiated-agreement"],
    ["agent-workforces", "economic-agents"],
    ["operating-procedures", "execution-policies"],
    ["organizational-performance", "metrics"],
    ["restructuring", "reorganizations"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  for (const [id, conceptId] of [...ORGANIZATIONS_LAYER, ...ORGANIZATIONS_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (id !== conceptId) continue;
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...ORGANIZATIONS_LAYER, ...ORGANIZATIONS_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Autonomous Organizations leaves 20–23 unchanged", () => {
  for (const [root, layer, tree] of [
    ["ai-intelligent-systems", AI_LAYER, AI_TREE],
    ["machine-economy", MACHINE_ECONOMY_LAYER, MACHINE_ECONOMY_TREE],
    ["autonomous-coordination", COORDINATION_LAYER, COORDINATION_TREE],
    ["autonomous-execution", EXECUTION_LAYER, EXECUTION_TREE],
  ] as const) {
    assert.deepEqual(resolver.getChildren(root).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), layer, root);
    for (const [parent, children] of tree) {
      assert.deepEqual(resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), children, parent);
    }
  }
});

test("Autonomous Protocols has exactly its seventeen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("autonomous-protocols").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    PROTOCOLS_LAYER,
  );
  assert.deepEqual(resolver.getChildren("autonomous-protocols").map((placement) => placement.order), PROTOCOLS_LAYER.map((_, order) => order));
  for (const [parent, children] of PROTOCOLS_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of PROTOCOLS_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "autonomous-protocols")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...PROTOCOLS_LAYER.map(([id]) => id), ...PROTOCOLS_L2.map(([id]) => id)].sort());
  assert.equal(PROTOCOLS_L2.length, 99);
  assert.deepEqual(resolver.getAncestors("pid-control").map((placement) => placement.id), ["autonomous-protocols", "control-loops"]);
  assert.deepEqual(resolver.getAncestors("keepers-in-protocol-maintenance").map((placement) => placement.id), ["autonomous-protocols", "protocol-maintenance"]);
});

test("Autonomous Protocols reuses existing concepts at their homes and keeps protocol autonomy distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("autonomous-protocols", conceptId);
  // Every L1 topic is a new concept; each reused concept gains exactly this
  // placement here and stays preferred at its home.
  assert.ok(PROTOCOLS_LAYER.every(([id, conceptId]) => id === conceptId));
  const reused = PROTOCOLS_L2.filter(([id, conceptId]) => id !== conceptId);
  assert.equal(reused.length, 39);
  for (const [id, conceptId] of reused) {
    assert.equal(id, `${conceptId}-in-${resolver.getPlacement(id)?.parentPlacementId}`, id);
    assert.ok(placementsOf(conceptId).includes(id), id);
    const preferred = resolver.getConcept(conceptId)?.preferredPlacementId;
    assert.ok(preferred && containingL0(preferred) !== "autonomous-protocols", `${conceptId} stays preferred at its home`);
    assertPreferredThrough("autonomous-protocols", conceptId, preferred);
  }
  // Governance stays 14's: its concepts are placed here, not moved.
  for (const conceptId of ["proposal-execution", "parameter-changes", "protocol-upgrades", "governance-minimization", "circuit-breakers", "pause-mechanisms", "incident-response"]) {
    assert.equal(containingL0(resolver.getConcept(conceptId)!.preferredPlacementId!), "governance-institutions", conceptId);
  }
  // Protocol autonomy kept distinct from the concepts it sits near.
  for (const [placementId, related] of [
    ["protocol-autonomy", "autonomous-organizations"],
    ["protocol-autonomy", "organizational-autonomy"],
    ["protocol-autonomy-levels", "autonomy-levels"],
    ["protocol-objectives", "mechanism-objectives"],
    ["protocol-objectives", "agent-objectives"],
    ["objective-functions", "mechanism-objectives"],
    ["protocol-monitoring", "monitoring"],
    ["protocol-telemetry", "metrics"],
    ["protocol-health", "health-checks"],
    ["protocol-policies", "organizational-policies"],
    ["protocol-policies", "execution-policies"],
    ["adaptive-parameters", "parameter-changes"],
    ["automated-upgrades", "protocol-upgrades"],
    ["self-healing", "execution-recovery"],
    ["recovery-modes", "incident-response"],
    ["autonomous-security-responses", "emergency-governance"],
    ["protocol-owned-resources", "treasuries"],
    ["autonomous-liquidity-management", "liquidity"],
    ["liquidity-rebalancing", "liquidity-provision"],
    ["peg-defense", "peg-stability"],
    ["autonomous-risk-management", "risk"],
    ["dynamic-risk-parameters", "risk-parameters"],
    ["autonomous-risk-management", "risk-checks"],
    ["protocol-adaptation", "protocol-upgrades"],
    ["adaptive-mechanisms", "protocol-upgrades"],
    ["feedback-loops", "update-models"],
    ["feedback-loops", "heartbeats"],
    ["bounded-autonomy", "human-oversight"],
    ["protocol-agents", "ai-agent"],
    ["on-chain-agents", "ai-agent"],
    ["protocol-maintenance", "protocol-lifecycle-automation"],
    ["protocol-lifecycle-automation", "contract-lifecycle"],
    ["protocol-lifecycle-automation", "organizational-lifecycle"],
    ["protocol-bootstrapping", "organizational-bootstrapping"],
    ["protocol-invariants", "safety"],
    ["protocol-invariants", "invariant-functions"],
    ["dynamic-fees", "congestion-pricing"],
    ["adaptive-interest-rates", "interest-rates"],
    ["state-estimation", "state-reconstruction"],
    ["state-repair", "state-reconstruction"],
    ["fault-detection", "failures"],
    ["outflow-limits", "spending-limits"],
    ["operating-envelopes", "risk-limits"],
    ["override-mechanisms", "veto-rights"],
    ["automated-deleveraging", "liquidations"],
    ["stress-testing", "simulation"],
    ["buybacks", "burns"],
    ["insurance-funds", "loss-absorption"],
    ["operation-proofs", "computation-proofs"],
    ["invariant-verification", "verification"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  for (const [id, conceptId] of [...PROTOCOLS_LAYER, ...PROTOCOLS_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (id !== conceptId) continue;
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...PROTOCOLS_LAYER, ...PROTOCOLS_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Autonomous Protocols leaves 20–24 unchanged", () => {
  for (const [root, layer, tree] of [
    ["ai-intelligent-systems", AI_LAYER, AI_TREE],
    ["machine-economy", MACHINE_ECONOMY_LAYER, MACHINE_ECONOMY_TREE],
    ["autonomous-coordination", COORDINATION_LAYER, COORDINATION_TREE],
    ["autonomous-execution", EXECUTION_LAYER, EXECUTION_TREE],
    ["autonomous-organizations", ORGANIZATIONS_LAYER, ORGANIZATIONS_TREE],
  ] as const) {
    assert.deepEqual(resolver.getChildren(root).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), layer, root);
    for (const [parent, children] of tree) {
      assert.deepEqual(resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), children, parent);
    }
  }
});

test("Autonomous Economy has exactly its seventeen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("autonomous-economy").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    ECONOMY_LAYER,
  );
  assert.deepEqual(resolver.getChildren("autonomous-economy").map((placement) => placement.order), ECONOMY_LAYER.map((_, order) => order));
  for (const [parent, children] of ECONOMY_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of ECONOMY_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "autonomous-economy")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...ECONOMY_LAYER.map(([id]) => id), ...ECONOMY_L2.map(([id]) => id)].sort());
  assert.equal(ECONOMY_L2.length, 102);
  assert.deepEqual(resolver.getAncestors("contagion").map((placement) => placement.id), ["autonomous-economy", "economic-stability"]);
  assert.deepEqual(resolver.getAncestors("economic-agency").map((placement) => placement.id), ["autonomous-economy", "autonomous-economic-actors"]);
});

test("Autonomous Economy places Economic Agency, reuses existing concepts at their homes and keeps economy-level concepts distinct", () => {
  const placementsOf = (conceptId: string) => placementsThrough("autonomous-economy", conceptId);
  // Economic Agency, unplaced until now, is placed here once, keeping its ID and relationship.
  assert.deepEqual(placementsOf("economic-agency"), ["economic-agency"]);
  assert.equal(resolver.getPreferredPlacementForConcept("economic-agency")?.id, "economic-agency");
  assert.deepEqual(resolver.getRelationshipsTo("economic-agency").map((relationship) => relationship.id), ["agent-identity-enables-economic-agency"]);
  // Every L1 topic is a new concept; every other reused concept gains exactly
  // this placement here and stays preferred at its home.
  assert.ok(ECONOMY_LAYER.every(([id, conceptId]) => id === conceptId));
  const reused = ECONOMY_L2.filter(([id, conceptId]) => id !== conceptId);
  assert.equal(reused.length, 28);
  for (const [id, conceptId] of reused) {
    assert.equal(id, `${conceptId}-in-${resolver.getPlacement(id)?.parentPlacementId}`, id);
    assert.ok(placementsOf(conceptId).includes(id), id);
    const preferred = resolver.getConcept(conceptId)?.preferredPlacementId;
    assert.ok(preferred && containingL0(preferred) !== "autonomous-economy", `${conceptId} stays preferred at its home`);
    assertPreferredThrough("autonomous-economy", conceptId, preferred);
  }
  // Economy-level concepts kept distinct from the concepts they sit near.
  for (const [placementId, related] of [
    ["autonomous-markets", "markets"],
    ["autonomous-markets", "agent-markets"],
    ["autonomous-commerce", "machine-commerce"],
    ["protocol-economies", "protocol-owned-resources"],
    ["autonomous-capital-allocation", "capital-allocation"],
    ["economy-wide-resource-allocation", "resource-allocation"],
    ["production-coordination", "multi-agent-coordination"],
    ["market-formation", "markets"],
    ["systemic-liquidity", "liquidity"],
    ["capital-flows", "machine-payments"],
    ["payment-flows", "machine-payments"],
    ["credit-networks", "agent-credit"],
    ["economic-institutions", "autonomous-organizations"],
    ["economic-institutions", "institutions"],
    ["economic-governance", "governance-institutions"],
    ["economic-policy", "governance-models"],
    ["monetary-systems", "token-economics"],
    ["money-supply", "token-supply"],
    ["monetary-policy", "issuance"],
    ["economic-stability", "control-stability"],
    ["contagion", "counterparty-risk"],
    ["economic-stability", "agent-risk"],
    ["economic-stability", "autonomous-risk-management"],
    ["economic-resilience", "execution-recovery"],
    ["economic-resilience", "self-healing"],
    ["economic-recovery", "execution-recovery"],
    ["emergent-economic-behavior", "emergent-coordination"],
    ["economic-feedback-loops", "feedback-loops"],
    ["autonomous-ownership-structures", "agent-ownership"],
    ["ownership-concentration", "market-concentration"],
    ["autonomous-production", "action-execution"],
    ["autonomous-services", "service-markets"],
    ["compute-economies", "compute-markets"],
    ["solver-economies", "solver-markets"],
    ["autonomous-pricing", "market-prices"],
    ["market-clearing", "auction-clearing"],
    ["autonomous-market-making", "automated-market-makers"],
    ["autonomous-contracting", "negotiation"],
    ["contract-enforcement", "ruling-enforcement"],
    ["reputation-systems", "agent-reputation"],
    ["trust-infrastructure", "trust-models"],
    ["taxation", "fees"],
    ["redistribution", "mev-redistribution"],
    ["algorithmic-collusion", "collusion"],
    ["backstops", "loss-absorption"],
    ["automatic-stabilizers", "feedback-controllers"],
    ["economic-alignment", "incentive-alignment"],
    ["actor-specialization", "task-sharing"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  for (const [id, conceptId] of [...ECONOMY_LAYER, ...ECONOMY_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (id !== conceptId) continue;
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...ECONOMY_LAYER, ...ECONOMY_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Autonomous Economy leaves 20–25 unchanged", () => {
  for (const [root, layer, tree] of [
    ["ai-intelligent-systems", AI_LAYER, AI_TREE],
    ["machine-economy", MACHINE_ECONOMY_LAYER, MACHINE_ECONOMY_TREE],
    ["autonomous-coordination", COORDINATION_LAYER, COORDINATION_TREE],
    ["autonomous-execution", EXECUTION_LAYER, EXECUTION_TREE],
    ["autonomous-organizations", ORGANIZATIONS_LAYER, ORGANIZATIONS_TREE],
    ["autonomous-protocols", PROTOCOLS_LAYER, PROTOCOLS_TREE],
  ] as const) {
    assert.deepEqual(resolver.getChildren(root).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), layer, root);
    for (const [parent, children] of tree) {
      assert.deepEqual(resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), children, parent);
    }
  }
});

test("Frontier Systems has exactly its sixteen L1 topics and their L2 placements, in order, and nothing deeper", () => {
  assert.deepEqual(
    resolver.getChildren("frontier-systems").map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
    FRONTIER_LAYER,
  );
  assert.deepEqual(resolver.getChildren("frontier-systems").map((placement) => placement.order), FRONTIER_LAYER.map((_, order) => order));
  for (const [parent, children] of FRONTIER_TREE) {
    assert.deepEqual(
      resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]),
      children,
      parent,
    );
    assert.deepEqual(resolver.getChildren(parent).map((placement) => placement.order), children.map((_, order) => order), parent);
  }
  for (const [id] of FRONTIER_L2) assert.deepEqual(resolver.getChildren(id), [], `${id} has no L3`);
  const subtree = mapKnowledge.placements
    .filter((placement) => resolver.getAncestors(placement.id)[0]?.id === "frontier-systems")
    .map((placement) => placement.id)
    .sort();
  assert.deepEqual(subtree, [...FRONTIER_LAYER.map(([id]) => id), ...FRONTIER_L2.map(([id]) => id)].sort());
  assert.equal(FRONTIER_L2.length, 89);
  assert.deepEqual(resolver.getAncestors("self-owning-agents").map((placement) => placement.id), ["frontier-systems", "machine-native-ownership"]);
  assert.deepEqual(resolver.getAncestors("corrigibility-in-self-modifying-systems").map((placement) => placement.id), ["frontier-systems", "self-modifying-systems"]);
});

test("Frontier Systems reuses established concepts at their homes and keeps frontier concepts distinct from them", () => {
  const placementsOf = (conceptId: string) => placementsThrough("frontier-systems", conceptId);
  // Every L1 topic is a new concept; every reused concept gains exactly this
  // placement here and stays preferred at its (established) home.
  assert.ok(FRONTIER_LAYER.every(([id, conceptId]) => id === conceptId));
  const reused = FRONTIER_L2.filter(([id, conceptId]) => id !== conceptId);
  assert.deepEqual(reused.map(([, conceptId]) => conceptId), [
    "economic-agency", "legal-wrappers", "monetary-systems", "constitutions", "institutions", "human-oversight",
    "exit-rights", "collective-decision-making", "public-goods-funding", "corrigibility", "verifiable-agents", "cyber-physical-interfaces",
  ]);
  for (const [id, conceptId] of reused) {
    assert.equal(id, `${conceptId}-in-${resolver.getPlacement(id)?.parentPlacementId}`, id);
    assert.ok(placementsOf(conceptId).includes(id), id);
    const preferred = resolver.getConcept(conceptId)?.preferredPlacementId;
    assert.ok(preferred && containingL0(preferred) !== "frontier-systems", `${conceptId} stays preferred at its home`);
    assertPreferredThrough("frontier-systems", conceptId, preferred);
  }
  // Economic Agency stays preferred at its first placement, in 26.
  assertPreferredThrough("frontier-systems", "economic-agency", "economic-agency");
  // Frontier concepts kept distinct from the established concepts they extend.
  for (const [placementId, related] of [
    ["self-owning-agents", "agent-ownership"],
    ["programmable-ownership", "ownership"],
    ["machine-native-property", "machine-owned-assets"],
    ["agent-native-institutions", "economic-institutions"],
    ["synthetic-institutions", "institutions"],
    ["emergent-institutions", "institutional-evolution"],
    ["machine-arbitration", "arbitration"],
    ["autonomous-jurisdictions", "autonomous-organizations"],
    ["digital-citizenship", "organizational-membership"],
    ["machine-constitutions", "constitutions"],
    ["adaptive-constitutions", "amendment-processes"],
    ["ai-mediated-governance", "governance-models"],
    ["ai-delegates", "delegates"],
    ["ai-deliberation", "deliberation"],
    ["governance-simulation", "simulation"],
    ["recursive-organizations", "role-hierarchies"],
    ["recursive-organizations", "sub-organizations"],
    ["agent-spawning", "task-delegation"],
    ["self-modifying-protocols", "protocol-upgrades"],
    ["self-improving-protocols", "protocol-adaptation"],
    ["self-improving-agents", "self-correction"],
    ["evolutionary-protocols", "adaptive-mechanisms"],
    ["multi-protocol-ecosystems", "inter-protocol-economies"],
    ["autonomous-infrastructure", "automation-networks"],
    ["self-maintaining-infrastructure", "protocol-maintenance"],
    ["verifiable-agent-networks", "verifiable-agents"],
    ["agent-societies", "multi-agent-coordination"],
    ["emergent-conventions", "emergent-coordination"],
    ["planetary-scale-coordination", "coordination"],
    ["mixed-human-machine-societies", "human-machine-economic-interaction"],
    ["machine-native-money", "machine-money"],
    ["machine-native-monetary-systems", "monetary-systems"],
    ["autonomous-capital-formation", "capital-formation"],
    ["autonomous-monetary-authorities", "monetary-policy"],
    ["programmable-law", "rules"],
    ["computable-contracts", "smart-contracts"],
    ["embedded-compliance", "organizational-compliance"],
    ["legal-oracles", "oracle-networks"],
    ["autonomous-liability", "liability"],
    ["machine-legal-contracting", "autonomous-contracting"],
    ["commons-governance", "governance-models"],
    ["autonomous-public-goods", "public-goods-funding"],
    ["commons-dilemmas", "collective-action"],
    ["cyber-physical-autonomous-systems", "sensors-external-systems"],
    ["decentralized-physical-infrastructure", "sensors"],
    ["physical-actuation", "physical-events"],
    ["autonomous-science-systems", "task-markets"],
    ["autonomous-science-systems", "service-markets"],
    ["automated-experimentation", "dry-runs"],
    ["verifiable-research", "verifiable-inference"],
  ]) {
    const conceptId = resolver.getPlacement(placementId)?.conceptId;
    assert.equal(conceptId, placementId);
    assert.ok(resolver.getConcept(related), related);
    assert.notEqual(conceptId, related, placementId);
  }
  // Every other topic is a new concept placed once, without exposition.
  for (const [id, conceptId] of [...FRONTIER_LAYER, ...FRONTIER_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (id !== conceptId) continue;
    assert.deepEqual(placementsOf(conceptId), [id], conceptId);
  }
  assert.deepEqual(mapKnowledge.content.map((content) => content.conceptId), ["foundations", "finality", "agent-identity"]);
  const ids = [...FRONTIER_LAYER, ...FRONTIER_L2].map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("Frontier Systems leaves 20–26 unchanged", () => {
  for (const [root, layer, tree] of [
    ["ai-intelligent-systems", AI_LAYER, AI_TREE],
    ["machine-economy", MACHINE_ECONOMY_LAYER, MACHINE_ECONOMY_TREE],
    ["autonomous-coordination", COORDINATION_LAYER, COORDINATION_TREE],
    ["autonomous-execution", EXECUTION_LAYER, EXECUTION_TREE],
    ["autonomous-organizations", ORGANIZATIONS_LAYER, ORGANIZATIONS_TREE],
    ["autonomous-protocols", PROTOCOLS_LAYER, PROTOCOLS_TREE],
    ["autonomous-economy", ECONOMY_LAYER, ECONOMY_TREE],
  ] as const) {
    assert.deepEqual(resolver.getChildren(root).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), layer, root);
    for (const [parent, children] of tree) {
      assert.deepEqual(resolver.getChildren(parent).map((placement) => [placement.id, placement.conceptId, placementLabel(placement.id)]), children, parent);
    }
  }
});

// Cross-domain invariants, asserted once for the whole stack rather than in each
// domain's own tests.
test("a concept has an explicit preferred placement exactly when it is placed more than once, and resolves to it", () => {
  for (const concept of mapKnowledge.concepts) {
    const placements = resolver.getPlacementsForConcept(concept.id).map((placement) => placement.id);
    if (placements.length > 1) {
      assert.ok(concept.preferredPlacementId && placements.includes(concept.preferredPlacementId), concept.id);
      assert.equal(resolver.getPreferredPlacementForConcept(concept.id)?.id, concept.preferredPlacementId, concept.id);
    } else {
      assert.equal(concept.preferredPlacementId, undefined, concept.id);
    }
  }
});

test("placement IDs are unique, and a further placement never takes another concept's ID", () => {
  const ids = mapKnowledge.placements.map((placement) => placement.id);
  assert.equal(new Set(ids).size, ids.length);
  const conceptIds = new Set(mapKnowledge.concepts.map((concept) => concept.id));
  for (const placement of mapKnowledge.placements) {
    if (placement.id !== placement.conceptId) assert.ok(!conceptIds.has(placement.id), placement.id);
  }
});

// L0 domains with authored topics. Each newly authored domain adds itself here.
const POPULATED_L0 = [
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
  "interoperability-abstraction",
  "security-correctness-resilience",
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
];

test("L0 domains without authored topics stay empty", () => {
  for (const [l0] of L0_DOMAINS) {
    assert.equal(resolver.getChildren(l0).length > 0, POPULATED_L0.includes(l0), l0);
  }
});

test("one canonical Finality concept resolves through independent placements", () => {
  const consensusFinality = resolver.getPlacement("finality-in-consensus");
  const rollupFinality = resolver.getPlacement("finality-in-rollups");

  assert.ok(consensusFinality);
  assert.ok(rollupFinality);
  assert.notEqual(consensusFinality.id, rollupFinality.id);
  assert.equal(consensusFinality.conceptId, "finality");
  assert.equal(rollupFinality.conceptId, "finality");
  assert.equal(resolver.getConcept(consensusFinality.conceptId), resolver.getConcept(rollupFinality.conceptId));
  assert.deepEqual(
    resolver.getPlacementsForConcept("finality").map((placement) => placement.id).sort(),
    ["finality-in-consensus", "finality-in-cross-chain-verification", "finality-in-protocol-properties", "finality-in-rollups"],
  );
  assert.deepEqual(
    resolver.getAncestors("finality-in-rollups").map((placement) => placement.id),
    ["scaling-modular-systems", "rollups"],
  );
});

test("taxonomy nesting does not create semantic relationships", () => {
  assert.deepEqual(resolver.getChildren("consensus").map((placement) => placement.conceptId), CONSENSUS_TREE[0][1].map(([, conceptId]) => conceptId));
  assert.deepEqual(resolver.getChildren("consensus-ordering").map((placement) => placement.conceptId), CONSENSUS_LAYER.map(([, conceptId]) => conceptId));
  assert.deepEqual(resolver.getRelationshipsFrom("consensus-ordering"), []);
  assert.deepEqual(resolver.getRelationshipsTo("consensus"), []);
  assert.deepEqual(resolver.getRelationshipsFrom("consensus"), []);
  assert.deepEqual(resolver.getRelationshipsTo("finality").map((relationship) => relationship.id), [
    "rollups-depend-on-finality",
  ]);
});

test("knowledge paths use independent curated order", () => {
  const path = resolver.getKnowledgePath("distributed-systems-to-rollups");
  assert.ok(path);
  assert.deepEqual(path.conceptIds, ["distributed-systems", "consensus", "finality", "scaling", "rollups"]);
  assert.notEqual(path.conceptIds.join("/"), "distributed-systems/consensus/finality");
});

test("canonical content is owned once despite multiple placements", () => {
  assert.equal(resolver.getContentForConcept("finality")?.definition, "The point at which a protocol treats a result as no longer practically reversible.");
  assert.equal(mapKnowledge.content.filter((content) => content.conceptId === "finality").length, 1);
  assert.equal(resolver.getPlacement("finality-in-consensus")?.contextualNote?.includes("consensus"), true);
  assert.equal(resolver.getPlacement("finality-in-rollups")?.contextualNote?.includes("rollup"), true);
});

test("agentic concepts use the same concepts, placements, relationships, and resolver", () => {
  assert.equal(resolver.getConcept("ai-agent")?.title, "AI Agent");
  assert.equal(resolver.getPlacement("agent-identity")?.conceptId, "agent-identity");
  assert.deepEqual(resolver.getRelationshipsTo("ai-agent").map((relationship) => relationship.typeId), [
    "authenticates",
    "constrains",
  ]);
  assert.deepEqual(resolver.getRelationshipsFrom("agent-identity").map((relationship) => relationship.targetConceptId), [
    "ai-agent",
    "economic-agency",
  ]);
});

test("sparse and orphan concepts remain valid", () => {
  // Every authored concept is now placed (Economic Agency, the last orphan, is
  // placed by Autonomous Economy), so an orphan with a relationship but no
  // placement or content is added to the real model.
  const withOrphan = createMapResolver({
    ...mapKnowledge,
    concepts: [...mapKnowledge.concepts, { id: "unplaced-concept", slug: "unplaced-concept", title: "Unplaced Concept" }],
    relationships: [
      ...mapKnowledge.relationships,
      { id: "agent-identity-enables-unplaced-concept", sourceConceptId: "agent-identity", targetConceptId: "unplaced-concept", typeId: "enables" },
    ],
  });
  assert.equal(withOrphan.getConcept("unplaced-concept")?.title, "Unplaced Concept");
  assert.deepEqual(withOrphan.getPlacementsForConcept("unplaced-concept"), []);
  assert.equal(withOrphan.getContentForConcept("unplaced-concept"), undefined);
  assert.deepEqual(withOrphan.getRelationshipsTo("unplaced-concept").map((relationship) => relationship.typeId), ["enables"]);
  // Economic Agency itself stays without content, with its relationship unchanged.
  assert.equal(resolver.getContentForConcept("economic-agency"), undefined);
  assert.deepEqual(resolver.getRelationshipsTo("economic-agency").map((relationship) => relationship.typeId), ["enables"]);
});

test("validation rejects malformed references, cycles, and semantic edges", () => {
  const cases: Array<[string, string[], string]> = [
    [
      "duplicate concept",
      errorsFor((model) => ({ ...model, concepts: [...model.concepts, model.concepts[0]] })),
      'Duplicate concept identifier "foundations"',
    ],
    [
      "dangling placement concept",
      errorsFor((model) => ({
        ...model,
        placements: [...model.placements, { id: "dangling-placement", conceptId: "missing", order: 5 }],
      })),
      'Placement "dangling-placement" references missing concept "missing"',
    ],
    [
      "placement cycle",
      errorsFor((model) => ({
        ...model,
        placements: model.placements.map((placement) =>
          placement.id === "foundations" ? { ...placement, parentPlacementId: "distributed-systems" } : placement,
        ),
      })),
      'Placement hierarchy contains cycle at "foundations"',
    ],
    [
      "dangling relationship target",
      errorsFor((model) => ({
        ...model,
        relationships: [...model.relationships, {
          id: "dangling-target", sourceConceptId: "finality", targetConceptId: "missing", typeId: "finalizes",
        }],
      })),
      'Relationship "dangling-target" references missing target concept "missing"',
    ],
    [
      "unknown relationship type",
      errorsFor((model) => ({
        ...model,
        relationships: [...model.relationships, {
          id: "unknown-type", sourceConceptId: "finality", targetConceptId: "settlement", typeId: "unknown" as never,
        }],
      })),
      'Relationship "unknown-type" uses unregistered type "unknown"',
    ],
    [
      "duplicate semantic edge",
      errorsFor((model) => ({
        ...model,
        relationships: [...model.relationships, {
          ...model.relationships[0], id: "duplicate-finality-edge",
        }],
      })),
      'Duplicate semantic relationship edge "finality" -> "settlement" (finalizes)',
    ],
    [
      "invalid self edge",
      errorsFor((model) => ({
        ...model,
        relationships: [...model.relationships, {
          id: "self-edge", sourceConceptId: "finality", targetConceptId: "finality", typeId: "finalizes",
        }],
      })),
      'Relationship "self-edge" prohibits self-edge for type "finalizes"',
    ],
    [
      "dangling content",
      errorsFor((model) => ({
        ...model,
        content: [...model.content, { id: "dangling-content", conceptId: "missing", definition: "Missing." }],
      })),
      'Content "dangling-content" references missing concept "missing"',
    ],
    [
      "dangling mechanism step",
      errorsFor((model) => ({
        ...model,
        mechanisms: [...model.mechanisms, {
          id: "dangling-mechanism", conceptId: "finality", title: "Broken", steps: [{ conceptId: "finality" }, { conceptId: "missing" }],
        }],
      })),
      'Mechanism "dangling-mechanism" references missing step concept "missing"',
    ],
    [
      "dangling knowledge path",
      errorsFor((model) => ({
        ...model,
        knowledgePaths: [...model.knowledgePaths, {
          id: "dangling-path", slug: "dangling-path", title: "Broken", summary: "Broken.", conceptIds: ["finality", "missing"],
        }],
      })),
      'Knowledge path "dangling-path" references missing concept "missing"',
    ],
  ];

  for (const [name, errors, expected] of cases) {
    assert.ok(errors.includes(expected), `${name}: expected ${expected}; got ${errors.join("; ")}`);
  }
});

test("exposition validation reports every malformed block", () => {
  const errors = errorsFor((model) => ({
    ...model,
    content: [...model.content, {
      id: "malformed-exposition", conceptId: "economic-agency", definition: "Defined.",
      body: [
        { kind: "paragraph", text: "  " },
        { kind: "flow", label: "One stage", stages: [["Only"]] },
        { kind: "distinction", left: "Local", right: "" },
        { kind: "tensions", label: "Pairs", pairs: [["Safety", ""]] },
        { kind: "flow", label: "Ambiguous", stages: [["A"], ["B", "C"], ["D", "E"]] },
      ],
    }],
  }));
  assert.deepEqual(errors.filter((error) => error.startsWith('Content "malformed-exposition"')), [
    'Content "malformed-exposition" block 0 (paragraph) is empty',
    'Content "malformed-exposition" block 1 (flow) must contain at least two stages',
    'Content "malformed-exposition" block 2 (distinction) must name both sides',
    'Content "malformed-exposition" block 3 (tensions) has an incomplete pair',
    'Content "malformed-exposition" block 4 (flow) has consecutive parallel stages',
  ]);
});

test("resolver rejects invalid models rather than repairing them", () => {
  const invalid = { ...mapKnowledge, concepts: [...mapKnowledge.concepts, mapKnowledge.concepts[0]] };
  assert.throws(() => createMapResolver(invalid), MapKnowledgeValidationError);
});
