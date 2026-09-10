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
    // Positioning matches the system's actual center of gravity: DAO
    // ownership, historical voting power, and protected reward
    // accounting — not a generic "DeFi governance" label. Sepolia/testnet
    // status stays explicit throughout (Deployment + Current State below)
    // rather than implied-but-unstated, and known gaps between what the
    // contracts support and what the frontend currently exposes (no
    // unstake button, hardcoded oracle display) are named directly
    // rather than omitted — all traced to the repository's own README,
    // which is equally direct about them.
    slug: "stakeverse-protocol",
    name: "StakeVerse Protocol",
    tagline: "Security-Hardened Governance & Staking Protocol",
    summary:
      "DAO-governed staking protocol built on historical voting power, protected reward accounting, and DAO-controlled administrative authority — hardened through a structured security remediation process.",
    description: [
      "StakeVerse is an on-chain governance and staking protocol centered on DAO-controlled authority. A token supplies historical voting power to a DAO that governs protocol administration through on-chain proposals, while a separate staking contract maintains its own protected reward accounting.",
    ],
    sections: [
      {
        heading: "System Model",
        entries: [
          { term: "Governance", detail: "StakeVerseDAO holds administrative authority over the protocol, including itself." },
          { term: "Token / Voting Power", detail: "StakeVerseToken supplies historical voting power to governance through delegated ERC20Votes checkpoints." },
          { term: "Staking / Reward Accounting", detail: "StakeVerseStaking runs a fixed-rate reward pool with principal and reward liquidity tracked separately." },
          { term: "Membership NFT", detail: "StakeVerseNFT is a DAO-minted ERC-721 membership badge; it does not currently gate staking or governance." },
          { term: "Oracle Boundary", detail: "PriceOracleConsumer validates Chainlink price data as a standalone contract, not yet consumed by the core protocol." },
        ],
      },
      {
        heading: "Architecture",
        lede: "StakeVerseDAO is the root administrative authority: it owns the token, staking, and NFT contracts, and owns itself. Governance therefore controls every protocol-level administrative action, including its own rules.",
        flow: ["DAO", "TOKEN, STAKING, NFT, DAO (ITSELF)"],
        groups: [
          {
            heading: "Governance",
            entries: [
              { term: "StakeVerseDAO", detail: "Root administrative authority. Owns Token, Staking, NFT, and itself; executes protocol-level actions through successful proposals." },
            ],
          },
          {
            heading: "Token / Voting Power",
            entries: [
              { term: "StakeVerseToken", detail: "ERC-20 utility and governance token (OpenZeppelin ERC20Votes, timestamp-based voting clock). DAO-controlled minting, DAO-owned. Voting power comes from delegated checkpoints — staking does not add voting weight." },
            ],
          },
          {
            heading: "Staking / Reward Accounting",
            entries: [
              { term: "StakeVerseStaking", detail: "Single fixed-rate staking pool. Principal and reward liquidity are tracked separately; reward claims are bounded by a funded reward reserve." },
            ],
          },
          {
            heading: "Membership NFT",
            entries: [
              { term: "StakeVerseNFT", detail: "ERC-721 membership badge, DAO-minted. Currently non-scarce and does not gate staking or governance." },
            ],
          },
          {
            heading: "Oracle Boundary",
            entries: [
              { term: "PriceOracleConsumer", detail: "Chainlink AggregatorV3 integration validating round completeness, price positivity, and staleness. Standalone — not currently consumed by staking or governance." },
            ],
          },
        ],
      },
      {
        heading: "Oracle Boundary",
        lede: "PriceOracleConsumer is a standalone Chainlink integration, not currently wired into staking or governance decisions.",
        flow: ["CHAINLINK", "PRICEORACLECONSUMER (STANDALONE)"],
      },
      {
        heading: "Governance Execution",
        lede: "Voting power is bound to historical checkpoints, not current balances — delegation has to happen before a proposal's snapshot to count. Successful proposals execute permissionlessly, and the DAO can act on itself through the same mechanism.",
        flow: ["DELEGATE", "CREATE PROPOSAL", "SNAPSHOT", "VOTE", "QUORUM / STATE", "EXECUTE"],
      },
      {
        heading: "Staking Model",
        lede: "Staking, unstaking, and reward claims are permissionless; funding, pausing, and the reward rate are DAO-controlled. Reward claims draw only from a separately funded reserve and can never consume staked principal.",
        flow: ["APPROVE", "STAKE", "ACCRUE", "CLAIM / UNSTAKE"],
        items: [
          "Principal and reward liquidity are accounted separately",
          "Reward claims are bounded by the funded reward reserve",
          "Fixed reward rate, DAO-adjustable",
          "Pausing blocks new staking without trapping withdrawals or claims",
        ],
      },
      {
        heading: "Security / Invariants",
        items: [
          "Reward claims cannot exceed the funded reward reserve",
          "Reward claims cannot consume staked principal",
          "Voting power is bound to historical checkpoints, preventing current-balance or just-in-time voting",
          "Proposal quorum is evaluated against the proposal's own snapshot",
          "Successful proposals execute permissionlessly, with no privileged executor",
          "DAO ownership of every contract removes the deployer as a continuing administrator",
          "Emergency pause blocks new staking without trapping existing funds",
          "Chainlink price data is rejected when stale, future-dated, or incomplete",
        ],
      },
      {
        heading: "Verification",
        items: [
          "146/146 tests passing",
          "100% line/statement coverage on every production contract",
          "CI recompiles and re-runs the full test suite on every push",
          "Frontend typecheck, build, and lint validated in CI",
          "Deployment workflow re-verifies chain ID before broadcasting",
          "Deployment workflow re-verifies deployed bytecode against source",
          "Deployment workflow independently re-verifies contract ownership on-chain",
          "Current Sepolia contracts are DAO-owned, confirmed post-deployment",
        ],
      },
      {
        heading: "Deployment",
        entries: [
          { term: "Network", detail: "Ethereum Sepolia (testnet), chain ID 11155111" },
          { term: "Live Application", detail: "stakeverse.vercel.app" },
          { term: "StakeVerseToken", detail: "0xf87d0115aF9Fc668d69c540dD7c27BC032d9Afcd" },
          { term: "StakeVerseDAO", detail: "0x8B555044B4c0A0a91cb0028043004d94291FD01F" },
          { term: "StakeVerseStaking", detail: "0x5EBd1259223CD30D1Ba95298b517F1F59ABBEa64" },
          { term: "StakeVerseNFT", detail: "0xA2C7c2db9Ca89b90994049e74d1Ea3eaB62F286C" },
          { term: "PriceOracleConsumer", detail: "0x5773E1acaE1Bda00caCedC5ebA1653db2C1e749F" },
        ],
      },
      {
        heading: "Current State",
        lede: "StakeVerse is deployed and DAO-owned on Ethereum Sepolia — not mainnet. The current implementation has a few known gaps between contract capability and what the frontend or documentation currently expose.",
        items: [
          "Staking UI does not currently expose the contract's unstake function",
          "The dashboard's oracle price is currently hardcoded, not a live read from PriceOracleConsumer",
          "NFT ownership does not currently affect staking or governance",
          "Token issuance is uncapped, controlled entirely by DAO governance; NFT issuance is non-scarce",
          "No third-party audit or static-analysis review has been performed",
          "Deployed contracts are not currently source-verified on a block explorer",
          "Contracts are not upgradeable — fixes require redeployment and migration",
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
      "Vite",
      "Tailwind CSS",
      "ethers.js",
    ],
    repoUrl: "https://github.com/psatomas/stakeverse-protocol",
    liveUrl: "https://stakeverse.vercel.app/",
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
