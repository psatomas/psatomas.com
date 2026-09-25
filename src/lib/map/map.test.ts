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
]);

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
  // new L1 and 61 new L2 concepts.
  assert.equal(ids.length, 27 + 11 + 6 + 40 + 7 + 38 + 9 + 58 + 7 + 56 + 10 + 55 + 7 + 46 + 8 + 47 + 6 + 43 + 11 + 61);
});

test("the Phase 1 proof fixture is re-homed beneath its L0 domains with stable placement IDs", () => {
  const parents = Object.fromEntries(
    mapKnowledge.placements
      .filter((placement) => placement.parentPlacementId && !AUTHORED_TOPICS.has(placement.id))
      .map((placement) => [placement.id, placement.parentPlacementId]),
  );
  assert.deepEqual(parents, {
    scaling: "scaling-modular-systems",
    rollups: "scaling",
    "finality-in-rollups": "rollups",
    "ai-agent": "ai-intelligent-systems",
  });
  // Settlement and Economic Agency stay deliberately unplaced.
  assert.deepEqual(resolver.getPlacementsForConcept("settlement"), []);
  assert.deepEqual(resolver.getPlacementsForConcept("economic-agency"), []);
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
  const placementsOf = (conceptId: string) => resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
  assert.deepEqual(placementsOf("state"), ["state-in-protocols", "state-in-state-machines"]);
  assert.equal(resolver.getConcept("state")?.preferredPlacementId, "state-in-state-machines");
  assert.deepEqual(placementsOf("protocol-properties"), ["protocol-properties", "protocol-properties-in-protocols"]);
  assert.equal(resolver.getConcept("protocol-properties")?.preferredPlacementId, "protocol-properties");
  // Children belong to placements: only the L1 occurrence carries the properties.
  assert.equal(resolver.getChildren("protocol-properties").length, 7);
  assert.deepEqual(resolver.getChildren("protocol-properties-in-protocols"), []);
  // Finality is the existing canonical concept: one content record for every placement.
  assert.deepEqual(placementsOf("finality"), ["finality-in-consensus", "finality-in-protocol-properties", "finality-in-rollups"]);
  assert.equal(resolver.getConcept("finality")?.preferredPlacementId, "finality-in-consensus");
  assert.equal(mapKnowledge.content.filter((content) => content.conceptId === "finality").length, 1);

  // Same wording, different concepts: message exchange between processes is
  // not participants exchanging information and intent to coordinate.
  const communication = mapKnowledge.concepts.filter((concept) => concept.title === "Communication");
  assert.deepEqual(communication.map((concept) => concept.id), ["communication", "coordination-communication"]);
  assert.deepEqual(placementsOf("communication"), ["communication"]);
  assert.deepEqual(placementsOf("coordination-communication"), ["coordination-communication"]);
  assert.equal(resolver.getAncestors("communication").at(-1)?.id, "distributed-systems");
  assert.equal(resolver.getAncestors("coordination-communication").at(-1)?.id, "coordination");

  // Every other L2 topic is a new concept placed once here (Verification is
  // also placed in Computation & Execution), and none has exposition yet.
  const reused = new Set(["state", "protocol-properties", "finality"]);
  const placedElsewhere: Record<string, string[]> = {
    verification: ["verification-in-verifiable-computation"],
    transitions: ["transitions-in-state-data"],
    "censorship-resistance": ["censorship-resistance-in-consensus-ordering"],
    "fault-tolerance": ["fault-tolerance-in-distributed-storage"],
    "trust-assumptions": ["trust-assumptions-in-oracle-problem"],
    collusion: ["collusion-in-oracle-security"],
  };
  for (const [id, conceptId] of FOUNDATIONS_L2) {
    if (reused.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id, ...(placedElsewhere[conceptId] ?? [])].sort(), conceptId);
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
  const placementsOf = (conceptId: string) => resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
  // Checking a computation's proof is Foundations' Verification: one concept, two placements.
  assert.equal(resolver.getPlacement("verification-in-verifiable-computation")?.conceptId, "verification");
  assert.deepEqual(placementsOf("verification"), ["verification", "verification-in-verifiable-computation"]);
  assert.equal(resolver.getConcept("verification")?.preferredPlacementId, "verification");
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
    // Later domains place some of these again.
    const elsewhere: Record<string, string[]> = {
      "transaction-ordering": ["transaction-ordering-in-block-building"],
      "verifiable-computation": ["verifiable-computation-in-cryptography-proofs"],
      "computation-proofs": ["computation-proofs-in-cryptography-proofs"],
    };
    assert.deepEqual(placementsOf(conceptId), [id, ...(elsewhere[conceptId] ?? [])].sort(), conceptId);
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
  const placementsOf = (conceptId: string) => resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
  // State Roots: one concept in two contexts, preferred where it is taught as a commitment.
  assert.deepEqual(placementsOf("state-roots"), ["state-roots-in-state-commitments", "state-roots-in-state-representation"]);
  assert.equal(resolver.getConcept("state-roots")?.preferredPlacementId, "state-roots-in-state-commitments");
  // State Transitions (L1) is Foundations' Transitions in contextual wording; children belong to the placement.
  assert.deepEqual(placementsOf("transitions"), ["transitions", "transitions-in-state-data"]);
  assert.equal(resolver.getConcept("transitions")?.title, "Transitions");
  assert.equal(resolver.getConcept("transitions")?.preferredPlacementId, "transitions");
  assert.deepEqual(resolver.getChildren("transitions"), []);
  assert.equal(resolver.getChildren("transitions-in-state-data").length, 6);
  // Checkpoints is State Checkpoints; the bare term is Consensus & Ordering's
  // consensus checkpoints, a different concept.
  assert.equal(resolver.getConcept("state-checkpoints")?.title, "State Checkpoints");
  assert.notEqual(resolver.getPlacement("state-checkpoints")?.conceptId, resolver.getPlacement("checkpoints")?.conceptId);
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
  // Also placed in Networks & Infrastructure.
  const placedElsewhere: Record<string, string[]> = {
    synchronization: ["synchronization-in-nodes"],
    "reorganization-handling": ["reorganization-handling-in-indexers"],
    "commitment-schemes": ["commitment-schemes-in-cryptographic-commitments"],
    "content-addressing": ["content-addressing-in-storage-availability"],
    attestations: ["attestations-in-identity"],
    provenance: ["provenance-in-oracles-external-reality"],
    "external-data": ["external-data-in-oracle-problem"],
    authenticity: ["authenticity-in-oracle-problem"],
    lineage: ["lineage-in-oracles-external-reality"],
    attribution: ["attribution-in-oracles-external-reality"],
  };
  for (const [id, conceptId] of [...STATE_DATA_LAYER, ...STATE_DATA_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id, ...(placedElsewhere[conceptId] ?? [])].sort(), conceptId);
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
  const placementsOf = (conceptId: string) => resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
  // Finality: the fixture placement keeps its ID and preferred role, now an L1 topic with its own layer.
  assert.equal(resolver.getPlacement("finality-in-consensus")?.parentPlacementId, "consensus-ordering");
  assert.equal(resolver.getConcept("finality")?.preferredPlacementId, "finality-in-consensus");
  assert.deepEqual(placementsOf("finality"), ["finality-in-consensus", "finality-in-protocol-properties", "finality-in-rollups"]);
  assert.equal(resolver.getChildren("finality-in-consensus").length, 6);
  assert.deepEqual(resolver.getChildren("finality-in-rollups"), []);
  // Censorship Resistance: Foundations' property, taught here through inclusion; preferred here.
  assert.deepEqual(placementsOf("censorship-resistance"), ["censorship-resistance", "censorship-resistance-in-consensus-ordering"]);
  assert.equal(resolver.getConcept("censorship-resistance")?.preferredPlacementId, "censorship-resistance-in-consensus-ordering");
  assert.deepEqual(resolver.getChildren("censorship-resistance"), []);
  // Transaction Ordering: 02's concept, also under Block Building; preferred in the ordering domain.
  assert.deepEqual(placementsOf("transaction-ordering"), ["transaction-ordering", "transaction-ordering-in-block-building"]);
  assert.equal(resolver.getConcept("transaction-ordering")?.preferredPlacementId, "transaction-ordering-in-block-building");
  // Proposers: one role under Validators and Proposer-Builder Separation.
  assert.deepEqual(placementsOf("proposers"), ["proposers-in-proposer-builder-separation", "proposers-in-validators"]);
  assert.equal(resolver.getConcept("proposers")?.preferredPlacementId, "proposers-in-validators");
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
  const placementsOf = (conceptId: string) => resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
  // Node Synchronization is State & Data's Synchronization in contextual wording; preferred there.
  assert.deepEqual(placementsOf("synchronization"), ["synchronization", "synchronization-in-nodes"]);
  assert.equal(resolver.getConcept("synchronization")?.preferredPlacementId, "synchronization");
  assert.deepEqual(resolver.getChildren("synchronization-in-nodes"), []);
  assert.equal(resolver.getChildren("synchronization").length, 6);
  // Reorganization Handling: one concept under Indexing (03) and Indexers (05).
  assert.deepEqual(placementsOf("reorganization-handling"), ["reorganization-handling", "reorganization-handling-in-indexers"]);
  assert.equal(resolver.getConcept("reorganization-handling")?.preferredPlacementId, "reorganization-handling");
  // Keeper Networks is Automation Networks under Keepers.
  assert.deepEqual(placementsOf("automation-networks"), ["automation-networks", "automation-networks-in-keepers"]);
  assert.equal(resolver.getConcept("automation-networks")?.preferredPlacementId, "automation-networks");
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
  // Also placed in Storage & Availability.
  const placedElsewhere: Record<string, string[]> = {
    "archive-nodes": ["archive-nodes-in-archival-storage"],
    "transaction-submission": ["transaction-submission-in-wallets"],
  };
  for (const [id, conceptId] of [...NETWORKS_LAYER, ...NETWORKS_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id, ...(placedElsewhere[conceptId] ?? [])].sort(), conceptId);
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
  const placementsOf = (conceptId: string) => resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
  // Verifiable Computation: one concept, an L1 topic in 02 and 06; each placement owns its layer.
  assert.deepEqual(placementsOf("verifiable-computation"), ["verifiable-computation", "verifiable-computation-in-cryptography-proofs"]);
  assert.equal(resolver.getConcept("verifiable-computation")?.preferredPlacementId, "verifiable-computation-in-cryptography-proofs");
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
  assert.equal(resolver.getConcept("computation-proofs")?.preferredPlacementId, "computation-proofs-in-cryptography-proofs");
  assert.deepEqual(placementsOf("commitment-schemes"), ["commitment-schemes", "commitment-schemes-in-cryptographic-commitments"]);
  assert.equal(resolver.getConcept("commitment-schemes")?.preferredPlacementId, "commitment-schemes-in-cryptographic-commitments");
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
  // Also placed in Storage & Availability.
  const placedElsewhere: Record<string, string[]> = {
    "proof-generation": ["proof-generation-in-storage-proofs"],
    "proof-verification": ["proof-verification-in-storage-proofs"],
    signing: ["signing-in-wallets"],
  };
  for (const [id, conceptId] of [...CRYPTOGRAPHY_LAYER, ...CRYPTOGRAPHY_L2]) {
    assert.equal(resolver.getContentForConcept(conceptId), undefined, conceptId);
    if (shared.has(conceptId)) continue;
    assert.equal(id, conceptId);
    assert.deepEqual(placementsOf(conceptId), [id, ...(placedElsewhere[conceptId] ?? [])].sort(), conceptId);
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
  const placementsOf = (conceptId: string) => resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
  // Content Addressing: 03's concept, an L1 topic here with its own layer; preferred here.
  assert.deepEqual(placementsOf("content-addressing"), ["content-addressing", "content-addressing-in-storage-availability"]);
  assert.equal(resolver.getConcept("content-addressing")?.preferredPlacementId, "content-addressing-in-storage-availability");
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
    assert.equal(resolver.getConcept(conceptId)?.preferredPlacementId, home, conceptId);
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
  const placementsOf = (conceptId: string) => resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
  // The fixture's placements keep their IDs; Agent Identity now sits under Machine Identity.
  assert.equal(resolver.getPlacement("agent-identity")?.parentPlacementId, "machine-identity");
  assert.equal(resolver.getPlacement("identity")?.parentPlacementId, "identity-accounts-authority");
  assert.equal(resolver.getPlacement("authority")?.parentPlacementId, "identity-accounts-authority");
  assert.deepEqual(placementsOf("agent-identity"), ["agent-identity"]);
  // Attestations: 03's concept, preferred here; Signing and Transaction Submission stay preferred at home.
  assert.deepEqual(placementsOf("attestations"), ["attestations", "attestations-in-identity"]);
  assert.equal(resolver.getConcept("attestations")?.preferredPlacementId, "attestations-in-identity");
  assert.deepEqual(placementsOf("signing"), ["signing", "signing-in-wallets"]);
  assert.equal(resolver.getConcept("signing")?.preferredPlacementId, "signing");
  assert.deepEqual(placementsOf("transaction-submission"), ["transaction-submission", "transaction-submission-in-wallets"]);
  assert.equal(resolver.getConcept("transaction-submission")?.preferredPlacementId, "transaction-submission");
  // General concepts for later reuse (Credentials is already placed again by
  // Oracles & External Reality), and agent/machine topics kept as their own concepts.
  assert.deepEqual(placementsOf("credentials"), ["credentials", "credentials-in-real-world-attestations"]);
  for (const conceptId of ["reputation", "ownership", "delegation", "roles", "capabilities"]) {
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
  const shared = new Set(["attestations", "signing", "transaction-submission", "credentials"]);
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
  const placementsOf = (conceptId: string) => resolver.getPlacementsForConcept(conceptId).map((placement) => placement.id).sort();
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
    assert.equal(resolver.getConcept(conceptId)?.preferredPlacementId, conceptId, conceptId);
  }
  assert.deepEqual(placementsOf("consensus"), ["consensus", "consensus-in-oracle-networks"]);
  assert.equal(resolver.getConcept("consensus")?.preferredPlacementId, "consensus");
  // Provenance owns a layer in each domain.
  assert.equal(resolver.getChildren("provenance").length, 6);
  assert.equal(resolver.getChildren("provenance-in-oracles-external-reality").length, 5);
  // APIs and External APIs are one concept within this domain.
  assert.deepEqual(placementsOf("external-apis"), ["external-apis", "external-apis-in-data-sources"]);
  assert.equal(resolver.getConcept("external-apis")?.preferredPlacementId, "external-apis");
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
    ["finality-in-consensus", "finality-in-protocol-properties", "finality-in-rollups"],
  );
  assert.deepEqual(
    resolver.getAncestors("finality-in-rollups").map((placement) => placement.id),
    ["scaling-modular-systems", "scaling", "rollups"],
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
  assert.equal(resolver.getConcept("economic-agency")?.title, "Economic Agency");
  assert.deepEqual(resolver.getPlacementsForConcept("economic-agency"), []);
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
