import type { System } from "@/types";

// This is the portfolio's active Systems presentation, not a full project
// archive — a deliberately curated three, in this order (execution ->
// governance -> provenance), not alphabetical or chronological. Two
// earlier entries ("Protocol Engineering Notes" / protocol-engineering-lab,
// "Web3 Status Registry" / web3-status-registry) were removed from here
// intentionally; their GitHub repos, history, and source are untouched —
// this array is the only place that decided whether they appeared on the
// site, so removing them here is the complete, correct removal. Since
// /systems/[slug] (generateStaticParams) and the homepage's SystemsPreview
// both read from getAllSystems() with no other hardcoded reference to
// either slug anywhere in the codebase, their old detail pages now 404
// rather than needing an explicit route deletion or a redirect — a
// redirect would incorrectly imply the content moved somewhere, when it
// was deliberately unfeatured instead.
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
    // Positioned as a minimal on-chain attestation primitive, not an audit
    // platform or trustless registry without qualification — the one-line
    // description and the Trust Model section below both say directly that
    // the contract preserves submitted claims rather than proving them.
    // The Remediation section documents a real authorization-boundary fix
    // (arbitrary callers -> onlyOwner) without dramatizing it; the old
    // contract is kept as a superseded, historical address, not erased.
    // Every fact here — contract fields, error names, test count, pipeline
    // steps, deployment addresses — is verified directly against the
    // provenance-registry repository (contract source, test file,
    // deploy-sepolia.yml, scripts/verify-deployment.ts), not taken from
    // its own README's promotional framing at face value.
    slug: "provenance-registry",
    name: "Provenance Registry",
    tagline: "On-Chain Attestation Registry",
    summary:
      "Owner-gated Solidity registry appending immutable, timestamped keccak256 attestation records on Ethereum — client-side document verification, no backend infrastructure.",
    description: [
      "An owner-gated Solidity registry that appends immutable, timestamped keccak256 attestation records on Ethereum, with client-side document verification and no backend infrastructure.",
    ],
    sections: [
      {
        heading: "System Model",
        lede: "The registry is a single Solidity contract with no imports and no external contract dependencies — no backend, no database, no indexer, no server-side blockchain service. The frontend communicates with the contract directly through the user's wallet.",
        flow: ["OWNER", "REGISTER", "APPEND", "VERIFY", "EXPLORE"],
        items: [
          "Owner-gated registration",
          "Append-only provenance records",
          "Timestamped metadata",
          "Audit-document hashing",
          "Commit-hash metadata",
          "Public historical reads",
          "Client-side verification",
        ],
      },
      {
        heading: "Architecture",
        lede: "The client talks directly to the contract through the user's wallet — there is no backend, database, or indexing layer between them.",
        flow: ["CLIENT (REACT)", "WEB3 (ETHERS.JS)", "CONTRACT (SOLIDITY)", "BLOCKCHAIN (SEPOLIA)"],
        groups: [
          {
            heading: "Client Layer",
            entries: [
              { term: "React + TypeScript + Vite", detail: "Wallet interaction, registration UI, PDF hashing, verification, and history exploration." },
            ],
          },
          {
            heading: "Web3 Layer",
            entries: [
              { term: "ethers.js v6", detail: "Provider, signer, contract abstraction, transaction submission, contract reads, and Keccak hashing." },
            ],
          },
          {
            heading: "Contract Layer",
            entries: [
              { term: "ProtocolProvenanceRegistry.sol", detail: "Authorization, record validation, append-only storage, ownership, public reads, and event emission." },
            ],
          },
          {
            heading: "Blockchain",
            entries: [
              { term: "Ethereum Sepolia", detail: "Canonical storage for registered provenance records." },
            ],
          },
        ],
      },
      {
        heading: "Contract Model",
        lede: "Every registration appends one ProtocolRecord to the calling protocol's history. The contract stores and preserves these submitted claims — it does not independently verify the PDF contents, the auditor's identity, the Git commit, or the relationship between contractAddress and the audited code.",
        entries: [
          { term: "protocolName", detail: "Free-form protocol identifier." },
          { term: "contractAddress", detail: "Mapping key for the protocol's history." },
          { term: "version", detail: "Free-form version string." },
          { term: "auditHash", detail: "bytes32 document fingerprint." },
          { term: "commitHash", detail: "bytes32 caller-supplied code-revision metadata." },
          { term: "auditor", detail: "Free-form attribution." },
          { term: "timestamp", detail: "Assigned by block.timestamp." },
        ],
      },
      {
        heading: "Registration Flow",
        lede: "Registration is restricted to the current contract owner through onlyOwner.",
        flow: ["OWNER WALLET", "REGISTER UI", "METAMASK", "REGISTERPROTOCOLRECORD()", "APPEND TO STORAGE", "PROTOCOLREGISTERED"],
        items: [
          "The owner supplies protocol metadata",
          "The PDF is hashed locally in the browser",
          "The commit hash is supplied as bytes32 metadata",
          "The wallet signs the transaction",
          "The contract validates required fields",
          "The record is appended to records[contractAddress]",
          "ProtocolRegistered is emitted",
        ],
      },
      {
        heading: "Verification Flow",
        lede: "Verification is read-only and requires no transaction. PDF bytes are hashed entirely client-side — the PDF itself never leaves the browser — and only the resulting bytes32 hash is compared with on-chain state, checked against historical records, not just the latest one. The interface distinguishes four outcomes:",
        flow: ["PDF", "BROWSER KECCAK256", "GETPROTOCOLHISTORY()", "HASH COMPARISON", "VALID / INVALID"],
        items: [
          "No records",
          "Match on latest record",
          "Match on historical record",
          "No matching record",
        ],
      },
      {
        heading: "Provenance History",
        lede: "Records are stored in a per-address dynamic array; registration only appends, and existing records cannot be modified or deleted through the contract ABI. Historical records remain publicly readable.",
        flow: ["PROTOCOL ADDRESS", "GETPROTOCOLHISTORY()", "HISTORICAL RECORDS", "TIMELINE"],
        items: [
          "getLatestRecord() returns the most recently appended record",
          "getRecordCount() exposes the current number of records",
          "The Explorer reads contract storage directly — there is no indexer",
        ],
      },
      {
        heading: "Security & Invariants",
        lede: "The registry provides integrity of the registered record, not proof that the registered claims are truthful.",
        entries: [
          { term: "Access Control", detail: "registerProtocolRecord() is restricted by onlyOwner." },
          { term: "Append-Only History", detail: "There is no update or delete path for existing records." },
          { term: "Record Integrity", detail: "Once appended, the stored audit hash, commit hash, metadata, and timestamp cannot be modified through the contract." },
          { term: "Historical Availability", detail: "Records remain publicly readable through the view functions." },
          { term: "Ownership Control", detail: "Ownership can only change through the owner-authorized transferOwnership() path." },
          { term: "No External Call Surface", detail: "The contract makes no external contract calls and has no payable, receive, or fallback path." },
          { term: "Cryptographic Verification", detail: "Audit-document fingerprints use keccak256 over the raw PDF bytes in the browser." },
        ],
      },
      {
        heading: "Remediation",
        lede: "The current deployment exists because of an authorization-boundary remediation, not a design change: the previous contract allowed any caller to invoke registerProtocolRecord(); the current one restricts it to the owner. Deployed Solidity bytecode is immutable, so the fix required a new deployment rather than a patch.",
        entries: [
          { term: "Superseded Deployment", detail: "0x8166431404B7f8e5e9d351333e08548a23Bbdae0 — allowed arbitrary callers to register records. No longer in use." },
          { term: "Current Deployment", detail: "0xd8FC6C229d7666865EDE56f56C68Af01cC5021BA — adds onlyOwner, confirmed by a live non-owner simulation that reverts with NotOwner." },
        ],
      },
      {
        heading: "Verification Evidence",
        items: [
          "16/16 Solidity tests passing",
          "Tests cover deployment/ownership, registration, unauthorized registration, field validation, ownership transfer, multi-record history, latest-record retrieval, and public read access",
          "Deployment pipeline (manually triggered) compiles, tests, and deploys via Hardhat Ignition",
          "Deployment pipeline verifies deployed bytecode, owner, and a record-read sanity check",
          "Deployment pipeline runs a non-owner registration simulation",
          "Current contract has verified source on Etherscan and Sourcify, per the project's deployment record",
        ],
      },
      {
        heading: "Deployment",
        lede: "Ethereum Sepolia — a testnet, not Ethereum Mainnet. The core system is complete and end-to-end validated: register, verify, and explore all work against this deployment.",
        entries: [
          { term: "Network", detail: "Ethereum Sepolia (testnet), chain ID 11155111" },
          { term: "Current Contract", detail: "0xd8FC6C229d7666865EDE56f56C68Af01cC5021BA — verified on Etherscan and Sourcify" },
          { term: "Live Application", detail: "protocol-provenance-registry.vercel.app" },
          { term: "Pitch Deck", detail: "Vercel-hosted PDF" },
          { term: "Video Pitch", detail: "youtube.com/watch?v=YnaDlZ6Ywwg" },
        ],
      },
      {
        heading: "Current Limitations",
        items: [
          "A single EOA owner controls future registrations — no multisig or timelock",
          "Audit hashes are not independently validated against documents by the contract",
          "Commit hashes are caller-supplied metadata and are not verified against Git",
          "Registered contract addresses are not verified against deployed code",
          "getProtocolHistory() returns an unbounded array",
          "The frontend has no automated test suite and no coverage measurement",
          "A network-enforcement helper exists but is currently unused",
          "The superseded deployment remains permanently deployed on Sepolia",
        ],
      },
      {
        heading: "Trust Model",
        lede: "The registry makes provenance records tamper-evident, not inherently truthful.",
        entries: [
          { term: "Trustless After Registration", detail: "Once written, a record cannot be silently modified or deleted through the contract, anyone can read it, and anyone can independently hash a document and compare it with the stored hash." },
          { term: "Owner-Curated Registration", detail: "Before registration, only the owner can create records — the owner determines what claims are recorded and is trusted for the truthfulness of the submitted metadata." },
        ],
      },
    ],
    stack: [
      "Solidity",
      "Hardhat",
      "Hardhat Ignition",
      "React",
      "TypeScript",
      "Vite",
      "ethers.js",
      "Tailwind CSS",
      "Framer Motion",
      "Ethereum Sepolia",
    ],
    repoUrl: "https://github.com/psatomas/provenance-registry",
    liveUrl: "https://protocol-provenance-registry.vercel.app/",
  },
];

export function getAllSystems(): System[] {
  return systems;
}

export function getSystemBySlug(slug: string): System | undefined {
  return systems.find((system) => system.slug === slug);
}
