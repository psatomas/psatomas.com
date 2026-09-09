import type { System } from "@/types";

const systems: System[] = [
  {
    // Portfolio identity is "ExeKPro" — the project's own public branding
    // at exekpro.com — with "Execution Kernel Protocol" kept as the
    // formal name (see System.formalName), not the primary label. The
    // slug moved from execution-kernel-protocol to exekpro to match; the
    // old path redirects permanently (see next.config.ts) rather than
    // 404ing for any existing link. GitHub repo name and internal package
    // names are unaffected — this is a portfolio-presentation rename
    // only, not a project rename.
    slug: "exekpro",
    name: "ExeKPro",
    formalName: "Execution Kernel Protocol",
    tagline: "Modular Blockchain Execution Infrastructure",
    summary:
      "Modular execution infrastructure for Web3 intents, with competing execution modules evaluated and selected through a deterministic scoring policy.",
    description: [
      "ExeKPro is an execution-selection protocol for Web3 intents. Instead of binding an intent to a single execution strategy, the kernel evaluates independently deployed execution modules and selects the highest-scoring valid candidate under a shared scoring policy.",
    ],
    sections: [
      {
        heading: "Execution Model",
        lede: "Every execution is one evaluation round: independently deployed modules compete for a single intent, and the highest-scoring valid candidate executes it. The current protocol selects exactly one winning module per execution.",
        flow: [
          "INTENT",
          "ELIGIBLE MODULES",
          "SIMULATION",
          "SCORE POLICY",
          "HIGHEST-SCORING MODULE",
          "EXECUTION",
        ],
      },
      {
        heading: "Architecture",
        groups: [
          {
            heading: "On-Chain Kernel",
            entries: [
              { term: "IntentRegistry", detail: "Defines and validates registered execution intents." },
              { term: "ModuleRegistry", detail: "Controls which execution modules are eligible for selection." },
              { term: "ExecutionEngine", detail: "Evaluates eligible modules under the active scoring policy and executes the selected candidate." },
              { term: "ScorePolicy", detail: "Provides the deterministic scoring mechanism used to compare candidates." },
              { term: "ProtocolRoles", detail: "Defines protocol ownership and administrative boundaries." },
            ],
          },
          {
            heading: "Execution Modules",
            entries: [
              { term: "RouterModule", detail: "An independently deployed routing strategy competing for selection." },
              { term: "MevProtectionModule", detail: "An independently deployed MEV-protection strategy competing for selection under the same policy." },
            ],
          },
          {
            heading: "Off-Chain Infrastructure",
            entries: [
              { term: "SDK", detail: "A TypeScript client built on viem, providing the primary integration surface for intents and execution." },
              { term: "Execution Node", detail: "Processes intents off-chain and prepares execution for submission through the SDK." },
              { term: "Indexer", detail: "Observes kernel events and derives execution and selection metrics." },
              { term: "API", detail: "A read-only Fastify service exposing registry state, predictions, and execution metrics." },
            ],
          },
          {
            heading: "Protocol Console",
            entries: [
              { term: "Console", detail: "A Next.js application, built on wagmi and viem, providing the interactive protocol interface and wallet-driven execution." },
            ],
          },
        ],
      },
      {
        heading: "System Boundaries",
        entries: [
          { term: "Ownership", detail: "Each kernel deployment has explicit protocol ownership through ProtocolRoles." },
          { term: "Deployment Isolation", detail: "Each deployment maintains its own protocol state and ownership boundary. The current architecture uses isolated kernel deployments because IntentRegistry does not provide tenant namespacing." },
          { term: "Execution", detail: "Execution is non-custodial. The console submits transactions through the connected user's own wallet. There is no hosted custody layer." },
          { term: "Separation of Concerns", detail: "Intent registration, module registration, execution policy, execution, indexing, and presentation are separated into distinct system boundaries." },
        ],
      },
      {
        heading: "Validation",
        items: [
          "43/43 contract tests passing",
          "Adversarial and fuzz validation",
          "3 implementation issues identified and resolved through adversarial testing",
          "Real browser E2E against the local protocol environment",
          "CI validation on every PR",
        ],
      },
      {
        heading: "Current State",
        lede: "ExeKPro is end-to-end validated against a local Anvil environment, with the protocol console publicly available at exekpro.com. A public testnet or mainnet deployment is not currently available.",
      },
      {
        heading: "Scope",
        items: [
          "Deterministic module selection",
          "One winning execution module per intent",
          "Registered execution modules",
          "Policy-driven scoring",
          "Isolated protocol deployments",
          "Non-custodial wallet execution",
          "Indexing and observability",
          "SDK, API, and console integration",
        ],
      },
      {
        heading: "Out of Scope",
        items: [
          "Multi-module execution graph chaining",
          "Permissionless module registration",
          "Governance timelocks",
          "Persistent indexer storage",
          "Hosted transaction submission or custody",
        ],
      },
    ],
    stack: ["Solidity", "Foundry", "TypeScript", "viem", "Node.js", "Next.js", "wagmi", "Fastify"],
    repoUrl: "https://github.com/psatomas/execution-kernel-protocol",
    liveUrl: "https://exekpro.com/",
  },
  {
    // Renamed from "Protocol Engineering Lab" — that name conflicted with
    // the site's own primary Lab section (interactive experiments under
    // /lab). "Lab" has exactly one meaning on this site now; this entry's
    // actual content — a personal notes/practice repository, not an
    // interactive experiment — is unchanged, only its public name is.
    slug: "protocol-engineering-lab",
    name: "Protocol Engineering Notes",
    tagline: "Research & Learning Repository",
    summary:
      "A repository documenting the journey to becoming a protocol engineer.",
    description: [
      "This repository documents my journey to becoming a protocol engineer.",
    ],
    sections: [
      {
        heading: "Focus areas",
        items: [
          "Blockchain protocol design",
          "Solidity smart contracts",
          "Distributed systems & cryptography",
        ],
      },
      {
        heading: "Structure",
        items: [
          "protocol-primitives — core blockchain components",
          "solidity-experiments — smart contract experiments",
          "rust-algorithms — data structures & algorithm practice in Rust",
          "notes — research and insights",
        ],
      },
    ],
    stack: ["Solidity", "Cryptography"],
  },
  {
    slug: "web3-status-registry",
    name: "Web3 Status Registry",
    tagline: "My First Blockchain Integration",
    summary:
      "A Web3 dApp to store and retrieve on-chain status updates using Solidity, React, and ethers.js.",
    description: [
      "A Decentralized Application (DApp) that demonstrates the integration between a React frontend and a smart contract deployed on the Ethereum Sepolia test network.",
      "Implements a hybrid smart contract architecture combining an on-chain status/audit logging system, ERC-20 token logic, and cryptographic hash verification — a simplified but realistic model of a modular decentralized application.",
    ],
    sections: [
      {
        heading: "Smart contract — Web3Registry",
        items: [
          "On-chain status registry with immutable event logging (updateStatus, getRecord, getTotalRecords)",
          "Cryptographic hash verification for file integrity (registerHash, verifyHash)",
          "ERC-20 token module — Web3Token (W3T)",
        ],
      },
    ],
    stack: [
      "Solidity",
      "React",
      "Vite",
      "TypeScript",
      "ethers.js",
      "OpenZeppelin",
      "Ethereum Sepolia",
    ],
    repoUrl: "https://github.com/psatomas/web3-status-registry-dapp",
  },
  {
    slug: "stakeverse-protocol",
    name: "StakeVerse Protocol",
    tagline: "Modular DeFi Governance System",
    summary:
      "A decentralized protocol MVP combining token economics, membership systems, staking mechanisms, and governance architecture.",
    description: [
      "A decentralized protocol MVP combining token economics, membership systems, staking mechanisms, and governance architecture.",
    ],
    sections: [
      {
        heading: "Components",
        items: [
          "ERC-20 utility token",
          "ERC-721 membership NFT",
          "Staking mechanisms",
          "Reward distribution",
          "DAO governance layer",
          "Oracle integration",
        ],
      },
      {
        heading: "Engineering",
        items: [
          "Modular smart contract architecture",
          "OpenZeppelin standards",
          "Automated contract testing",
          "Security analysis workflows",
          "Frontend wallet integration",
        ],
      },
    ],
    stack: [
      "Solidity",
      "Hardhat",
      "OpenZeppelin",
      "Chainlink",
      "React",
      "TypeScript",
      "Slither",
      "Mythril",
    ],
  },
  {
    slug: "provenance-registry",
    name: "Provenance Registry",
    tagline: "On-Chain Audit Provenance Layer",
    summary:
      "A blockchain-based provenance system designed to make software evolution and audit history cryptographically verifiable.",
    description: [
      "A blockchain-based provenance system designed to make software evolution and audit history cryptographically verifiable.",
      "The system creates immutable references between off-chain artifacts and blockchain records using cryptographic commitments.",
    ],
    sections: [
      {
        heading: "Features",
        items: [
          "On-chain protocol version registry",
          "Audit metadata storage",
          "Commit hash verification",
          "Timestamped blockchain records",
          "Cryptographic linking using keccak256",
        ],
      },
      {
        heading: "Web3 flow",
        items: [
          "User → Wallet Authentication → Transaction Signing → Smart Contract Execution → Blockchain State Update → Frontend Synchronization",
        ],
      },
    ],
    stack: [
      "Solidity",
      "Hardhat",
      "React",
      "TypeScript",
      "Vite",
      "Tailwind CSS",
      "ethers.js",
      "Ethereum Sepolia",
    ],
  },
];

export function getAllSystems(): System[] {
  return systems;
}

export function getSystemBySlug(slug: string): System | undefined {
  return systems.find((system) => system.slug === slug);
}
