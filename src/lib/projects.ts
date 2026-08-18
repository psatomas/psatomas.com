import type { Project } from "@/types";

const projects: Project[] = [
  {
    slug: "execution-kernel-protocol",
    name: "Execution Kernel Protocol",
    tagline: "Modular Blockchain Execution Infrastructure",
    summary:
      "A modular blockchain infrastructure project exploring intent-based execution systems and extensible protocol architectures.",
    description: [
      "A modular blockchain infrastructure project exploring intent-based execution systems and extensible protocol architectures.",
      "The project investigates how execution logic can be separated from application interfaces while maintaining deterministic state transitions and extensible protocol components.",
    ],
    sections: [
      {
        heading: "Architecture",
        items: [
          "Modular execution engine",
          "Pluggable execution modules",
          "Intent-based execution flows",
          "On-chain validation and configuration",
          "SDK-oriented integration layer",
          "Separation between canonical state and execution services",
        ],
      },
    ],
    stack: ["Solidity", "Foundry", "TypeScript", "Node.js", "ethers.js"],
  },
  {
    slug: "protocol-engineering-lab",
    name: "Protocol Engineering Lab",
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
          "Rust systems programming",
          "Blockchain protocol design",
          "Solidity smart contracts",
          "Distributed systems & cryptography",
        ],
      },
      {
        heading: "Structure",
        items: [
          "rust-algorithms — data structures & algorithm practice in Rust",
          "protocol-primitives — core blockchain components",
          "solidity-experiments — smart contract experiments",
          "notes — research and insights",
        ],
      },
    ],
    stack: ["Rust", "Solidity", "Cryptography"],
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

export function getAllProjects(): Project[] {
  return projects;
}

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
