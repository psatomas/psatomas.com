# MAP L2 analysis and authoring architecture

A read-only analysis of MAP's L2 layer, written before any L2 exposition
exists. It covers what L2 is, what it must teach, how it relates to L0 and L1,
and the architecture that L2 authoring should use. It is a proposal: nothing
here is an operating procedure until it is accepted and the tooling in the
[roadmap](#21-implementation-roadmap) exists. Until then,
[content-architecture.md](content-architecture.md),
[quality-contract.md](quality-contract.md) and
[representation-design.md](representation-design.md) govern all authoring.

- **Baseline:** `main` at `7bf73704940dac2c9af0ff168a65740f99d61d8f`
  (PR #195 merged). Every figure below is measured at that commit.
- **Facts:** `npm run map:l2` recomputes the inventory from the taxonomy
  ([`l2/inventory.ts`](../../src/lib/map/authoring/l2/inventory.ts)); add
  `-- --json` for every concept, placement and group.
- **Hazards:** curated near-synonyms, category relations, multi-axis
  groups, facet watches and State candidates are in
  [`l2/hazards.json`](../../src/lib/map/authoring/l2/hazards.json). A test
  keeps every id valid against the taxonomy.

Concept identity and placement identity are kept apart throughout. A concept
is one canonical meaning with one record; a placement is one appearance of it.

## Contents

1. [Baseline](#1-baseline)
2. [The L2 corpus](#2-the-l2-corpus)
3. [Existing content state](#3-existing-content-state)
4. [Ownership](#4-ownership)
5. [Depth contract](#5-depth-contract)
6. [Parent–child boundary](#6-parentchild-boundary)
7. [Sibling boundary](#7-sibling-boundary)
8. [Representation analysis](#8-representation-analysis)
9. [The State primitive](#9-the-state-primitive)
10. [Other primitive candidates](#10-other-primitive-candidates)
11. [Representation density without quotas](#11-representation-density-without-quotas)
12. [Authoring units](#12-authoring-units)
13. [Context contract](#13-context-contract)
14. [Concept-model contract](#14-concept-model-contract)
15. [Representation-design contract](#15-representation-design-contract)
16. [Editorial-audit contract](#16-editorial-audit-contract)
17. [Verification architecture](#17-verification-architecture)
18. [Scale and token economics](#18-scale-and-token-economics)
19. [Autonomous-campaign requirements](#19-autonomous-campaign-requirements)
20. [Pilot](#20-pilot)
21. [Implementation roadmap](#21-implementation-roadmap)

## 1. Baseline

- `main` equals `origin/main` at `7bf7370`, with no tracked changes and no open
  PRs.
- **L0 and L1 are complete.** All 27 L0 and 327 L1 concepts own content, and
  the registry holds exactly those 354 records.
- **The representation infrastructure is in place.** The accepted-design spec
  and refactor mode exist, and `map:author -- refactor domains` reports every
  domain's actionable designs resolved. Only two designs remain, both blocked
  on `state`: `action-execution` and `protocol-adaptation`.
- **Cycle and Comparison** are in the types, validation and renderer.
- **The render check waits for readiness:** `waitForExposition` waits for
  `aria-busy="false"`.

## 2. The L2 corpus

**Size.** L2 is terminal: validation allows at most two levels below L0, and
no L2 placement carries children.

| Fact | Count |
|---|---|
| L2 placements | 1937 |
| Unique L2 concepts | 1670 |
| L2-only concepts (no placement above L2) | 1604 |
| Dual-role concepts (also placed at L1) | 66, with 83 L2 placements |
| Concepts with several placements anywhere | 265 |
| Concepts placed in more than one domain | 260 |
| Concepts with several L2 placements | 210 (2: 170, 3: 29, 4: 6, 5: 4, 6: 1) |
| Concepts under more than one L1 parent concept | 207 |
| Concepts whose L2 placements span domains | 206 |
| Concepts with a contextual label | 39 |
| Concepts placed twice in one domain | 9 |

**Sibling groups.** Each L1 placement has between 3 and 7 L2 children; none
has zero. Distribution: 3 children: 1 group (Virtual Machines), 4: 1
(Consensus Layers), 5: 44, 6: 278, 7: 6. 328 of the 330 groups own at least
one concept. Domain-Specific Security, and Disputes & Emergency Controls, own
none of their children.

**Per domain.** "Owned" counts L2-only concepts whose preferred placement is
in the domain; "placed" counts distinct L2 concepts placed there.

| Domain | L1 | L2 placements | Placed | Owned |
|---|---|---|---|---|
| Foundations | 7 | 43 | 42 | 35 |
| Computation & Execution | 7 | 39 | 39 | 36 |
| State & Data | 10 | 59 | 58 | 55 |
| Consensus & Ordering | 10 | 58 | 57 | 55 |
| Networks & Infrastructure | 10 | 58 | 57 | 55 |
| Cryptography & Proofs | 8 | 48 | 48 | 48 |
| Storage & Availability | 9 | 51 | 51 | 47 |
| Identity, Accounts & Authority | 8 | 47 | 47 | 42 |
| Oracles & External Reality | 12 | 70 | 69 | 59 |
| Economics & Mechanism Design | 11 | 66 | 65 | 65 |
| Markets & Financial Protocols | 12 | 72 | 71 | 70 |
| MEV & Execution Markets | 13 | 79 | 79 | 74 |
| Intents & Coordination | 12 | 71 | 71 | 61 |
| Governance & Institutions | 15 | 89 | 89 | 84 |
| Scaling & Modular Systems | 14 | 80 | 80 | 64 |
| Interoperability & Abstraction | 14 | 82 | 82 | 72 |
| Security, Correctness & Resilience | 20 | 119 | 119 | 82 |
| Protocol Architecture | 12 | 68 | 68 | 54 |
| Protocol Design & Lifecycle | 14 | 81 | 81 | 60 |
| AI & Intelligent Systems | 12 | 69 | 69 | 66 |
| Machine Economy | 14 | 84 | 84 | 57 |
| Autonomous Coordination | 10 | 60 | 60 | 57 |
| Autonomous Execution | 11 | 66 | 66 | 44 |
| Autonomous Organizations | 15 | 88 | 88 | 54 |
| Autonomous Protocols | 17 | 99 | 99 | 57 |
| Autonomous Economy | 17 | 102 | 102 | 74 |
| Frontier Systems | 16 | 89 | 89 | 77 |

**Unusual topology.**

- **Parent in one place, sibling in another.** 21 concept pairs. Incident
  Response is the parent of Pause Mechanisms and Circuit Breakers in Security,
  yet sits beside them under Emergency Governance, Disputes & Emergency
  Controls and Autonomous Security Responses. Agent Identity is the parent of
  Agent Reputation and also its sibling under Machine Identity and Machine
  Economy. No L2 exposition can assume its parent's framing.
- **Delegation** has six placements: one L1 and five L2 leaves, in six
  domains.
- **Resource Allocation** carries two L1 child layers (an existing facet case).
- **Eight dual-role concepts have their preferred placement at an L2 leaf:**
  Transitions, Transaction Ordering, Builders, Agent Identity, Cross-Domain
  Execution, Cross-Domain Settlement, Cross-Domain Atomicity and Incident
  Response.
- **Placed twice in one domain:** Protocol Properties, Agent Reputation, State,
  State Roots, Proposers, Automation Networks, External APIs, Penalties,
  Liquidity Risk.
- **The semantic graph barely touches L2:** 5 relationships, 1 mechanism and
  1 knowledge path in the whole model. The tree and the parent text are an
  author's only structural context.
- **Named technologies are concepts:** EVM, WASM, zkVMs, Merkle Patricia
  Tries, Verkle Trees, SNARKs, STARKs, zkEVMs.

## 3. Existing content state

| State | Concepts |
|---|---|
| No content | 1604: every L2-only concept |
| Content shared with an L1 placement | 66 dual-role concepts; their 83 L2 leaf placements show the L1-authored record (149–496 words, median 225) |
| Placeholder or legacy fields | 0 |
| Definition only | 0 |
| Registry inconsistencies | 0 |

A row without content cannot be opened, so no L2 row shows text that looks
authored but is not.

**How the Finality and Agent Identity failure ("authored" hiding placeholder
content) reappears at L2:**

1. **Dual-role records count as authored but were written for the L1 role.**
   The L1 contract required that each also reads as a complete explanation at
   its leaf placements, and the samples read (Delegation, Builders) do. The
   L2 depth contract (mechanism, variants, failure) was never checked against
   them, and a planner that treats registration as done would skip them
   silently. They need a dual-role leaf audit, not automatic exclusion. The
   eight with a preferred L2 leaf, and the three with three or more L2
   placements (Finality, Delegation, Incident Response), come first.
2. **Being named is not being explained.** Every L2 label appears in its
   domain's L0 terms strip, and 58% are named in their L1 parent, mostly in a
   single sentence. Mention-based coverage would look complete when it is
   not.
3. **The parent sometimes already states the child's key insight.** Governance
   Execution explains why a timelock is an exit; Protocol Properties defines
   fault tolerance; Market Power explains algorithmic collusion. An L2 record
   that paraphrases those sentences looks authored and adds nothing. This is
   the most likely way L2 content ends up hollow.

## 4. Ownership

The L1 rule assigns authoring to the domain of the child-carrying placement,
otherwise to the domain of the preferred placement. No L2 placement carries
children, so only the fallback applies. It is sufficient, with these
additions:

1. **Concepts with any L1 placement are owned by L1.** They are outside L2
   authoring and enter only the dual-role leaf audit.
2. **Every L2-only concept has exactly one owner:** the sibling group and
   domain of its preferred placement. All 199 multi-placement L2-only concepts
   have one, and the inventory test enforces it. In canonical domain order the
   owner precedes every other placement except for five concepts: Computation
   Proofs, Commitment Schemes, Attestations, Inference Confidence and Service
   Discovery.
3. **The owner writes once, with context from every placement:** each parent,
   each sibling set and each label. The boundary rules must hold against all of
   them at once; Human Oversight, for example, has six parents.
4. **Ownership is workflow only.** Settlement's preferred placement is under
   Derivatives, yet its exposition explains settlement in general.
5. **Stop** when the parent definitions imply different meanings rather than
   facets of one meaning.

**Riskiest multi-placement concepts.** Every L2 placement is a leaf.

| Concept | Placements | How the placements relate | One exposition? |
|---|---|---|---|
| Verification | Trust Models, Verifiable Computation, Correctness | Checking instead of trusting; checking a computation; checking code against a specification (the verification-versus-validation sense) | Yes, framed as checking conformance to a stated claim by evidence. The riskiest case. |
| Settlement | Derivatives (preferred), Intent Settlement, Machine Commerce, Verification & Settlement, Autonomous Commerce | Final transfer that discharges an obligation | Yes; the preferred context is narrow |
| Authority Escalation | Agent Permissions, Organizational Decision-Making, Protocol Policies, labelled "Escalation" | Handing a decision upward, consistently | Yes; the title invites a privilege-escalation reading |
| Collusion | Adversarial Environments, Oracle Security, Attack Classes, Market Power | Coalitions defeating an independence assumption | Yes; must not teach its sibling Algorithmic Collusion |
| Fault Tolerance | Protocol Properties, Distributed Storage, Resilience, Self-Healing | Which properties survive which faults | Yes; two parents already state the core |
| Circuit Breakers, Pause Mechanisms | Five placements each | Automatic halt on a measured condition; authorized pause | Yes |
| Constitutions, Capabilities, Validation, Reserves | Two or three each | Consistent meaning | Yes |

**No placement-meaning stops were found.** Identity hazards remain:

- **Contextual labels that are another concept's title (11 L2 concepts).**
  For example, `external-data-availability` is shown as "Data Availability"
  under Oracle Problem, and `agent-synchronization` as "Synchronization".
  `npm run map:l2 -- --json` lists them as `labelHomonyms`. A twelfth case,
  Intent Matching shown as "Matching", is an L1 placement.
- **Two concepts with the same title**, `communication` and
  `coordination-communication`, both in Foundations.
- **Near-synonym pairs**, which are a different problem: see
  [section 7](#7-sibling-boundary).

## 5. Depth contract

**L2 is MAP's terminal layer.** Nothing deeper exists to defer to, so each
record must be complete for its own concept, bounded by the concept itself
rather than by deferral.

- **L0** orients a reader in a domain (median 1320 words).
- **L1** states the organizing model of a branch, giving each child about one
  sentence (median 223 words, about 38 per child).
- **L2** explains how the concept itself works, under which conditions, how it
  fails, and what it is confused with.

The 66 dual-role records show a workable scale: a definition plus two to four
focused paragraphs, structured only where structure carries meaning. That is a
reference, not a length target.

**Dimensions that set depth.** No single answer fits every concept.

1. **Kind of concept.** Each kind owes different things:
   - a mechanism or process: steps, invariants, failure paths;
   - a property: a precise statement, its conditions, how it is established
     and how it is violated;
   - an actor or role: incentives, powers, the trust placed in it, its
     misbehaviour;
   - an attack or failure: preconditions, mechanism, impact, defences;
   - a parameter or metric: what it controls, how it is set, sensitivity at
     the bounds;
   - an artifact or structure: contents, how it is produced and checked,
     what it proves and what it does not;
   - a named technology: its distinguishing design choices and their
     consequences;
   - an abstract or institutional concept: its distinctions and consequences.
2. **Variant status.** About 122 L1 parents have two or more variant-like
   children (around 360 children by shared head noun). A variant states its
   defining choice and what that choice trades away. Comparing variants
   belongs to the parent.
3. **Domain maturity.** Established engineering gets concrete mechanism.
   Domains 19–27 are emerging or speculative: claims are stated as proposals
   or conditions, never as deployed fact.
4. **Mathematics** appears only when the quantity is the concept, such as
   fault thresholds, a utilization kink, sampling confidence or the cost of
   corruption. It is written as a plain-text relation, stated in words first,
   with no derivations.
5. **Concrete protocol examples** illustrate. The exposition must stay true if
   the example changes, and must avoid facts that date.
6. **Placements.** The more placements, the more context-neutral the framing.
7. **What the parent already says.** Start beyond the parent's claim about the
   child.

**Two examples of the layering.**

- **Governance Execution (L1)** establishes that the executor's authority
  defines what governance can change, and that a timelock is an exit.
  **Timelocks (L2)** adds the queue, delay and execute sequence, who can
  cancel, that only actions routed through the timelock are delayed, the
  bypass paths, and the failure where the delay is shorter than users need to
  exit.
- **Protocol Properties (L1)** establishes the safety and liveness shapes.
  **Safety (L2)** adds that a violation is witnessed by a finite prefix of an
  execution, that safety is established through invariants, that it can be
  kept under asynchrony by giving up liveness, accountable safety, and how it
  differs from "security".

## 6. Parent–child boundary

| Pattern (example) | Parent establishes | Child adds | Paraphrasing the parent would be | Teaching siblings would be |
|---|---|---|---|---|
| Parts or stages (Transactions, Smart Contracts) | The whole and how the parts connect | Its own internal mechanism and how it fails | Re-describing the whole lifecycle | Explaining adjacent stages |
| Variants (Sequencing, Virtual Machines, Auctions) | The dimensions the variants differ on | Its defining choice, mechanism and costs | Restating the dimensions | A comparison table of all siblings |
| Properties (Protocol Properties, Security Properties) | What a property is, and its shape | Precise statement, conditions, how established and broken, confusions | The parent's classification | Defining sibling properties |
| Actors (Lending & Borrowing, Proposer-Builder Separation) | How the actors interact | Incentives, powers, trust, misbehaviour | Describing the market again | The counterparty's side |
| Threat catalogs (Attack Classes, Oracle Security) | The pattern and how attacks chain | Preconditions, mechanism, impact, defences | The chain story | Explaining member or neighbouring attacks |
| Mechanism and its parameters (Interest Rates, Fees) | Why the parameter exists | Definition, setting, sensitivity, failure at the bounds | "It balances supply and demand" | Explaining the other levers |

**Rules.**

1. **Do not paraphrase the parent.** List every sentence in every parent that
   mentions the child before drafting. A needed premise may appear once, in
   context-neutral words; everything after it must add something no parent
   says.
2. **Do not teach siblings.** Name a sibling only to draw a boundary. A variant
   may contrast itself with its nearest alternative once, in a sentence or a
   `distinction`; it never tabulates its siblings.
3. **Do not pre-empt other records.** L2 has no children, so the danger is
   explaining any concept that has its own placement anywhere: siblings,
   cousins, category members, dual-role concepts. Name them; do not explain
   them.
4. **Hold under every parent.** Read the draft under each parent and sibling
   set. No positional language, and no claims true under only one parent.
5. **No circular definitions** ("shared sequencing is sequencing that is
   shared").
6. **Dual-role records are audited, not rewritten.** Revise one only when it
   fails the L2 leaf contract at one of its placements.

## 7. Sibling boundary

**Groups are not closed units.**

- **Ownership is mixed.** 150 of 330 groups own all their children. The other
  180 contain children owned elsewhere or dual-role. Seven groups own exactly
  one child: Security Properties, Security Economics, Pre-Launch Validation,
  Organizational Governance, Protocol Lifecycle Automation, Data Availability
  Layers and Cross-Domain Coordination.
- **Groups are linked.** Through shared concepts, 208 groups form one linked
  set; only 61 stand alone.
- **Sibling names lean on the parent.** 944 of the 1937 placements share a
  word with their parent's title, and 180 groups have three or more such
  children.
- **Parents already compare.** 16 L1 parents lay their children out in a
  structured block. Formal Methods compares model checking, theorem proving,
  symbolic execution and static analysis; Oracle Aggregation, Cross-Chain
  Verification, Off-Chain Scaling and Pre-Launch Validation do the same.

**Territory by what distinguishes the siblings.**

| Siblings differ by | Example groups | Parent's territory | Each sibling's own territory |
|---|---|---|---|
| Mechanism | Oracle Aggregation (Medianization, Weighted, Outlier Filtering, Quorum) | Why aggregate; its existing comparison | Its rule's behaviour, what corruption it tolerates, how it is manipulated |
| Trust assumption | Interoperability Models; Off-Chain Computation; Cross-Chain Verification | The trust axis | Who must be honest, how failure shows, how it is checked |
| Lifecycle stage | Transactions; Proposals; Deployment & Launch | The order of stages | Its stage's inputs, outputs and failure |
| Actor | Proposer-Builder Separation; Lending & Borrowing; Governance Participants | The interaction | Incentives, powers, trust, misbehaviour |
| Artifact | On-Chain Data; Blobs | Why separate kinds exist | Contents, who can read or prove it, lifetime and cost |
| Property | Hash Functions; Commitments; Zero-Knowledge Proofs | What the properties are for | Precise statement, attack model, consequence of failure |
| Failure mode | Smart Contract Security; AI Security; Governance Attacks | The pattern family | Precondition, mechanism, impact, defence |
| Parameter | Freshness; Adaptive Parameters; Collateral | What is tuned and why, and how parameters interact | What it measures, how it is set, its extremes |
| Implementation choice | Smart Contract Architecture; Synchronization; Execution Layers | The design problem | The choice, its consequences and its costs |
| Variant | Execution Models; Auctions; Stablecoins; Voting | The axes | Its defining choice and what it trades away |

**Hard cases.**

1. **Groups split along more than one axis.** Execution Models mixes
   determinism, sequential or parallel, and optimistic or speculative. Auctions
   crosses the price rule with bid visibility. Bots mix triggers with
   purposes. Interoperability Models, Governance Models, Data Sources and
   Arbitrage are similar (`multiAxisGroups` in the hazards file). Only the
   parent can own the axes; a sibling that explains them consumes the parent
   and its siblings.
2. **A sibling that is a category of other siblings.** Hash Properties
   contains Collision and Preimage Resistance; Orders contains Limit and Market
   Orders; Initial Synchronization contains Full, Snap and State Sync; Formal
   Verification contains Model Checking and Theorem Proving; Transaction
   Lifecycle spans every other Transactions stage. Across groups, Network
   Attacks contains Eclipse and Denial-of-Service Attacks, and Vulnerability
   Classes contains Smart Contract Security's entries. The category explains
   its classification principle and what members share; it names members and
   never explains them. Each member owns its mechanism.
3. **Siblings here, parent and child elsewhere.** Incident Response is an
   authored dual-role record beside Pause Mechanisms and Circuit Breakers
   under Emergency Governance. They treat it as the umbrella and never repeat
   its synthesis.
4. **Named technologies.** EVM, WASM and zkVMs are siblings and connect to EVM
   Equivalence, EVM Compatibility, zkEVMs and Alternative VMs in Scaling.
   Merkle Trees, Merkle Patricia Tries and Verkle Trees are siblings, as are
   SNARKs and STARKs. Each owns its own design and consequences; comparing
   them is the parent's; facts that date are avoided.
5. **The parent already compares the variants.** The L2 record starts from
   its row in the parent's comparison and goes into mechanism, limits and
   failure; it never restates that row.
6. **Near-synonyms** (`nearSynonyms` in the hazards file), the case that can
   fail outright:
   - Liquidators and Liquidation Searchers;
   - Based Rollups and Based Sequencing;
   - Interactive Fraud Proofs and Dispute Games (siblings);
   - Escape Hatches, Forced Withdrawals and Forced Inclusion;
   - Archival State and State Archiving;
   - Machine Money and Machine-Native Money;
   - Capital Formation and Autonomous Capital Formation;
   - Self-Owning Agents and Self-Sovereign Machines (siblings);
   - Self-Modifying and Self-Improving Protocols (siblings);
   - Recursively Autonomous Systems and Nested Autonomy (siblings);
   - Approval Thresholds and Action Approval Thresholds, which is labelled
     "Approval Thresholds";
   - Autonomy Levels and Protocol Autonomy Levels;
   - Scheduled Execution and Execution Scheduling (same words, different
     meanings).

   Each pair needs a defensible split of territory recorded before drafting.
   Where none exists, it is a taxonomy identity stop. These concentrate in
   the Autonomous and Frontier domains.

**Preventing the first-written sibling from taking the others' territory.**

- **A territory plan per group, written before any drafting.** It covers every
  member, whoever owns it, records the claims the parents already make, and
  assigns each remaining claim to exactly one concept.
- **The plan looks beyond the group**: category and member relations,
  near-synonyms, and clusters sharing a term across groups (12 Liquidation
  concepts across Markets and MEV; the sequencing concepts across Consensus
  and Scaling; Formal Methods, Correctness, Protocol Specification and
  Testing; Attack Classes and Protocol Security).
- **Authored records are fixed claims.** Members owned by a later group or
  domain get reserved claims that their owner honours or explicitly revises.
- **The audit checks mentions**: every other concept title a draft mentions
  is listed, and each must be named rather than explained.

**Is the sibling group the authoring unit?** It is the right planning nucleus
but not a closed territory. Sibling overlap is densest inside groups and the
parent context is shared, but 180 groups are mixed, 208 are linked, and
several territories span groups and domains. [Section 12](#12-authoring-units)
separates the units.

## 8. Representation analysis

L2 has no content yet, so the evidence is the concepts themselves: titles,
siblings, parent text, and what each concept's explanation needs.

| Structure | Where it occurs at L2 (examples) | Existing primitive |
|---|---|---|
| Sequence or process | Commit-Reveal, Challenge-Response, Distributed Key Generation, Batch Posting | `flow` |
| Lifecycle, forward only | Proposal, Intent and Contract Lifecycle; Withdrawals; Organization Formation | `flow` with branches |
| Branching or failure outcomes | Settlement Failure, Execution Failure Handling, Hashed Timelock Contracts (claim, or refund after timeout) | `flow` |
| Interaction between actors | Atomic Swaps, Proposer-Builder Separation bidding, User Operations, Request-Response | `flow` with actor-named steps |
| Feedback | Feedback Loops, Agent Loops, Procyclicality, Network Effects, liquidation spirals | `cycle` |
| Failure propagation | Contagion, Bad Debt, Depegging, Composability Risks | `flow`, or `cycle` when self-reinforcing |
| Data flow | Indexer Pipelines, Data Transformation, Retrieval-Augmented Generation | `flow` |
| Alternatives × dimensions | Proxy Patterns (transparent, UUPS, beacon), aggregation schemes | `comparison`, at L2 only for sub-variants that are not taxonomy siblings |
| Conflation | Antonym pairs, EVM Equivalence versus Compatibility, near-synonyms | `distinction`, where the confusion is real |
| Tension | Scalability Trilemma, Objective Trade-offs | `tensions`; rare, since trade-offs mostly belong to L1 |
| Trust boundary | Trusted Computing Base, Bridge Custody | Prose or `distinction` |
| Invariant | Invariants, Invariant Functions, Solvency Constraints | Prose |
| Mathematical relation | Constant Product, Quadratic Voting, Availability Confidence, Quorums | Plain-text relation in prose |
| Dependency | Action Dependencies, Call Graphs, Component Dependencies | Weak gap; see section 10 |
| Hierarchy | Merkle Trees, Role and Policy Hierarchies, Delegation Chains | Prose, or a one-level `flow` |
| State with returns | See section 9 | **Gap** |
| Iteration with an exit | Dispute Games (bisection), Retries, Replanning, Negotiation rounds | **Gap**: `cycle` implies a loop that never ends and `flow` cannot loop. A State shape. |

Most L2 records will be prose. Two L2-specific rules follow from the boundary
analysis:

- **A comparison of siblings belongs to the parent.** At L2 a `comparison` is
  legitimate only for alternatives inside the concept that are not taxonomy
  siblings.
- **`distinction` will matter more at L2 than elsewhere,** because
  near-synonyms and antonym pairs are dense. It is still used only where the
  conflation is real.

## 9. The State primitive

**Evidence from L2.** A scan of L2 titles for lifecycle, mode and state-like
semantics found 172 candidates. Filtered by hand to concepts where returns,
re-entry or persistent modes carry the meaning, about 12 are strong and 11
moderate (`stateCandidates` in the hazards file). That is about 1–2% of L2,
in at least eight domains.

- **Strong:** Transaction Lifecycle (included, then reorganized back to
  pending); Circuit Breakers (open, half-open, closed); Pause Mechanisms
  (different authority to pause and to unpause); Mode Switching and Regime
  Detection (hysteresis); Recovery Modes; Automatic Failover (with failback);
  Graceful Degradation; Retries; Liquidation Thresholds (position health: a
  partial liquidation returns it to healthy); Workflow Definitions; Two-Phase
  Commit (its blocking "uncertain" state).
- **Moderate:** Revocation, Session Keys, Peg Stability, Depegging, Peg
  Defense, Reorganizations, Approval Workflows, Credit Default, Kill Switches,
  Dispute Games, Contract Lifecycle.

**What it implies.**

- **The gap recurs, independently of L1, and is justified by meaning.** A
  forward flow would misrepresent these concepts, and a cycle would wrongly
  imply they never end. Prose remains accurate, so `state` improves about 2%
  of L2 records; it never blocks correctness.
- **The two blocked L1 designs fall inside L2 territory and are not evidence
  for the primitive.** Protocol Adaptation's target (normal and defensive modes
  with hysteresis) is the territory of its children Mode Switching and Regime
  Detection. Action Execution's target (a submitted transaction's states) is
  the territory of Transaction Lifecycle, under Transactions in another
  domain. Executing them would have those L1 records draw their child's state
  machine, and another domain's, which the vertical-boundary rules forbid.
  They should be re-reviewed (see the [roadmap](#21-implementation-roadmap)).
- **Timing.** Transaction Lifecycle is owned by Computation & Execution, the
  second domain in canonical order. If `state` is wanted there, it must exist
  before that domain's L2 run.

**Recommended shape (design only).** One general, tightly bounded primitive
covering modes with returns and iteration with an exit:

- a label; 2 to 6 states, with the initial state and any terminal states
  marked;
- labelled transitions (from, to, condition), a small bounded number of them;
- validation that rejects a machine without a back-edge or self-loop and
  directs it to `flow` instead, so `state` can never become a decorated flow;
- a vertical axis with labelled side rails for back-edges, like `cycle`'s
  return rail, so it is the same column at every width;
- a text alternative generated from the data ("starts in A; from A, when X,
  to B; from B, when Y, back to A; C is final");
- a fixture in the browser suite's `models` section, like cycle and
  comparison.

## 10. Other primitive candidates

Each candidate needs repeated, semantically independent cases where prose and
every existing primitive (including the proposed `state`) fail. Ranked by
evidence:

| Rank | Candidate | Strongest examples | Domains | Relationship to show | Why existing forms do or do not suffice | Minimum semantics if built | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Mathematical relation | Constant Product, Impermanent Loss, Interest Rates and Utilization, Collateral Ratios, Quadratic Voting, Availability Confidence, Probabilistic Finality, Threshold Signatures, Cost of Corruption, PID Control | 10 or more | A quantity defined by others, or the shape of a curve | Prose with a plain-text relation ("x × y = k") states it exactly; plain symbols already pass validation. A chart of a curve would need protocol-specific parameters, which make canonical content time-sensitive. | Formula with variable glossary, or a qualitative curve | Frequent, but prose suffices. **An authoring convention, not a primitive.** |
| 2 | Actor interaction sequence | Challenge-Response, Commit-Reveal, Hashed Timelock Contracts, Atomic Swaps, Two-Phase Commit, Request-Response, Offers and Counteroffers, Execution Callbacks, Header Relaying, Distributed Key Generation | About 8 | Ordered messages between parties, sometimes across two chains, with timeouts | A `flow` whose steps name their actor shows order and branches. Two-Phase Commit and bisection are State shapes. Per-party timers (HTLC's asymmetric timeouts) are clearer in prose than in lanes. | Lanes, messages, timers | Moderate frequency, covered by `flow` plus `state`. **No primitive.** |
| 3 | Dependency graph | Action Dependencies, Call Graphs, Component Dependencies, Cross-Layer Dependencies, Trust Dependencies, Dependency Management, Requirements Traceability | 4 | A directed acyclic graph of what relies on what | The concepts are about dependency structure in general; any drawn graph would picture one example, which is illustration rather than canonical meaning. Prose explains transitivity, ordering and critical paths. | Nodes, directed edges, acyclicity | Weak. **No primitive.** Keep the recorded gap. |
| 4 | Trust boundary | Trust Boundaries, Trusted Computing Base, Trusted Components, Sandboxing, Execution Isolation, Bridge and Key Custody, Network Segmentation | About 6 | Which components sit inside a trust perimeter and where it is crossed | The meaning is a classification and its consequences: prose and `distinction`. A drawn perimeter is an example architecture. | Regions, membership, crossings | Weak. **No primitive.** |
| 5 | Data flow | Indexer Pipelines, Data Transformation, Execution Pipelines, Data Flows, Retrieval-Augmented Generation, Gossip Propagation | About 6 | Data moving through stages, fanning out | `flow` is native; a parallel set approximates fan-out. | — | Covered. |
| 6 | Invariant | Invariants, Invariant Functions, Solvency Constraints, Protocol Invariants, Atomicity Guarantees | Many | A statement that must always hold | An invariant is a statement, not a shape; prose states it exactly. | — | Covered. |

**Conclusion:** `state` is the only new primitive justified before L2. Plain-
text mathematical relations need an authoring convention (section 16), not a
block.

## 11. Representation density without quotas

**History.**

| Level | Records | With a structured model block | Block uses |
|---|---|---|---|
| L0 | 27 | 27 | paragraph 534, terms 357, heading 315, distinction 308, flow 142, tensions 2 |
| L1 | 327 | 34 | paragraph 985, comparison 13, distinction 12, flow 7, tensions 4, cycle 1, heading 1 |

Both convergence failures have already happened:

- **Diagram convergence at L0.** From about domain 13 onward, sections
  compress to heading, paragraph, distinction and terms strip, so
  `distinction` was used 308 times largely by template.
- **Prose convergence at L1.** After the first four domains, 299 consecutive
  records were definition plus paragraphs, citing "accepted L1 precedent",
  until the representation-design step and refactor campaign restored
  decisions.

**L2 opportunities.** Distinction will be commonest; flow next; state, cycle
and comparison occasional; tensions rare. That describes likely use, never a
target. There are no quotas, no minimum number of structures, no domain-level
targets, and no rule to prefer visuals. Prose wins whenever it communicates
the concept most accurately.

**Safeguards against precedent.**

- **Decide form per concept, from its model:** concept model, then semantic
  relationship, then best representation, recorded before drafting
  (section 15).
- **Fresh context per concept** (section 18). No unrelated authored L2 record
  is ever shown as an example.
- **Sibling content as claims, not text.** Siblings appear as their plan
  claims; full text is retrieved only to check a specific boundary.
- **Drift signals, not targets.** The run reports, descriptively, how often
  each block sequence and opening-sentence pattern appears over a rolling
  window. An unusually uniform window is a signal for audit attention, never
  a failure and never a quota.
- **Justification both ways.** The design must justify prose-only as firmly as
  it justifies structure, so neither becomes the default.

## 12. Authoring units

| Activity | Unit | Why |
|---|---|---|
| Ownership resolution | Concept, computed corpus-wide, verified at every run start | Deterministic; one owner per L2-only concept |
| Territory planning | Ownership group plus its semantic neighbourhood | Overlap is densest in groups but crosses them |
| Concept modeling | Concept | Forces understanding of one meaning |
| Representation design | Concept, checked against the group plan | Form follows one concept's model; the plan prevents two siblings drawing the same relationship |
| Drafting | Concept, in fresh context | Prevents precedent and context decay |
| Editorial audit | Concept (independent context), then group | Concept audit judges depth and accuracy; the group pass judges territory and repetition |
| Deterministic verification | Concept, group and PR (section 17) | Each layer catches different defects |
| Commits | One per ownership group: plan, designs, records and registry | Review follows territory; one feature per commit |
| PRs | A slice of a domain: whole groups in canonical order, about 30 concepts | Domains own 35–84 concepts, about four times the L1 records per domain; about 55–60 PRs in all |
| Campaign progression | Domains in canonical order, slices within a domain | Owner-first: the owning domain precedes other placements except for five concepts |

**A concept in several plans.** Every plan whose group holds a placement lists
the concept as a member:

- in its **owner's** plan it is `owned`, with its claims allocated there;
- in **other** plans it is `owned elsewhere`, either `authored` (its record is
  its fixed claim set) or `reserved` (its claims are recorded but it is not
  written).

Non-owner plans never assign its claims to their own members, and their
members may only name it. It is authored exactly once, by its owner.

**A concept owned by a later domain in an earlier plan.** The earlier plan
records reserved claims for it: what the earlier members must leave to it,
stated as claims rather than prose. The earlier run writes nothing for it.
When the owner's run arrives, its plan imports the reservations and either
honours them or revises them with a recorded reason. Revision is safe because
the earlier records only named the concept.

**Territory plans are repository-owned.** They must exist before drafting
starts, because:

- runs in later domains read earlier reservations;
- the audit and the diff check validate records against them;
- staleness is only detectable against a recorded plan.

They are committed with the group's content in the same commit and reviewed in
the PR. They do not need separate pre-acceptance (section 19).

## 13. Context contract

The goal is sufficient semantic boundaries with minimal irrelevant precedent.
Domain dumps are never provided.

| Context | Class | Notes |
|---|---|---|
| Concept identity, title, every placement with trail and label | Always | Deterministic |
| Exact sentences in every parent that mention the target | Always | Deterministic extraction; `map:inspect` today shows only the primary parent and must be extended |
| The target's plan entry: owned claims, exclusions, reserved claims nearby | Always | From the territory plan |
| The complete sibling set at the owner placement, with each sibling's plan claims | Always | Claims, not text |
| L2 rule card (depth contract, boundary rules, canonical rules) | Always | About 4,000 tokens instead of about 25,000 for the full docs |
| Representation catalog with fit notes | Always | Compact form of `represent catalog` |
| Concept-model schema for the target's kind | Always | Section 14 |
| Owning L1 parent's whole exposition | Always | Median 223 words |
| Other parents' whole expositions | Conditional | When the target has several placements |
| Sibling sets at other placements | Conditional | When the target has several placements |
| Already-authored sibling records | Conditional | Only within the group or the flagged neighbourhood, to check a boundary |
| Dual-role content | Conditional | When a dual-role concept is a sibling or parent |
| Category or member relations | Conditional | When the hazards file or plan flags them |
| Near-synonym partner (its plan entry, or its record if authored) | Conditional | When flagged |
| Cross-group cluster claims | Conditional | When the plan places the target in a cluster |
| Contextual labels and label homonyms | Conditional | When present |
| The L0 sentences mentioning the target | Conditional | When the L0 prose (not only the terms strip) mentions it |
| Accepted representation design | Conditional | Once recorded, for drafting and audit |
| Full L0 exposition | On demand | When domain framing is in doubt |
| Other L1 expositions, unrelated authored L2 records | On demand | To check a specific boundary; never as an example |
| Terminology lookup ("is X a concept?") | On demand | Deterministic title search |
| Full authoring docs | On demand | The rule card cites them |

## 14. Concept-model contract

The model is reasoning, never rendered. It forces understanding before prose
without becoming a form.

**Core fields (always):**

- `meaning`: one sentence, the concept's core meaning;
- `kind`: mechanism, property, actor, attack, parameter, artifact,
  technology or institutional;
- `parents`: what each parent already establishes, and what this concept
  adds beyond it;
- `claims`: the exclusive territory from the plan;
- `excludes`: concepts to name and not explain;
- `placements`: one line per placement on why the exposition holds there.

**Fields by kind (the two or three that matter are expected; others are
optional):**

| Kind | Relevant fields |
|---|---|
| Mechanism or process | `sequence`, `actors`, `inputs`, `outputs`, `assumptions`, `failures`; `states` when it has modes or returns |
| Property | `statement` (what, for whom, under which conditions), `establishedBy`, `violatedBy`, `confusions` |
| Actor or role | `role`, `powers`, `incentives`, `trustPlaced`, `misbehaviour` |
| Attack or failure | `preconditions`, `mechanism`, `impact`, `defences`, `detection` |
| Parameter or metric | `measures`, `setBy`, `tradeoff`, `extremes`; `relation` when quantitative |
| Artifact or structure | `contents`, `producedBy`, `checkedBy`, `proves`, `lifetime` |
| Named technology | `designChoices`, `consequences`, `nearestAlternative` (one), `datedFacts` (what to avoid) |
| Institutional | `distinctions`, `consequences`, `conditions`, `status` (established, emerging or speculative) |

Cross-kind optional fields: `states` and `transitions`, `invariants`,
`tradeoffs`, internal `variants` (never taxonomy siblings), `relation`
(mathematics).

**Validation** checks the core fields, that the kind's expected fields are
present, and that claims and excludes match the plan. It never checks prose
quality.

## 15. Representation-design contract

Resolved per concept before drafting:

- **decision:** `prose`, `structure`, or `block`;
- **relationship:** the semantic relationship that drives the decision;
- **primitive** and why it expresses that relationship;
- **for a structure:** why prose alone is insufficient;
- **for prose:** why no structure carries meaning prose would obscure;
- **level:** why the structure belongs at this concept rather than its parent
  or another placed concept;
- **territory:** why it does not draw a sibling's or reserved claim's
  relationship;
- **placements:** why it holds at every placement;
- **division of labour:** what prose must explain that the structure does not,
  and what the structure communicates that the prose must not restate.

**Block.** If the relationship has no suitable primitive, the design records a
representation gap and the concept is either written in prose (when prose is
accurate) or blocked. No diagram is improvised.

**Acceptance is incremental.** Designs are recorded in the run, beside the
territory plan, validated deterministically, audited, and reviewed in the PR.
Repository-wide pre-acceptance (the L1 refactor pattern) fits revising
existing records; for new records, a design depends on the plan and would
otherwise be accepted before its territory exists. The pilot is the exception:
its plans and designs get a human checkpoint before drafting (section 19).

## 16. Editorial-audit contract

Tools surface candidates; judgment decides. Phrase overlap never decides
editorial correctness.

| Check | Deterministic | Heuristic signal | Agent judgment |
|---|---|---|---|
| Schema, block shapes, plain text, registry | Yes | | |
| Positional language ("below", "this domain", "above", "following") | Lexicon match | | Confirm |
| Mentions of other concept titles | Exact detection | | Named or explained? |
| Parent paraphrase | | Similarity to every parent sentence that mentions the target | Yes |
| Sibling theft | | Similarity to sibling records and plan claims | Yes |
| Reserved-claim violation | Claim keyword match against the plan | | Yes |
| Explaining another placed concept | Title detection | Sentences spent on it | Yes |
| Category or member violation | From the hazards file and plan | | Yes |
| Near-synonym collapse | From the hazards file | Similarity to the partner | Yes |
| Template language | | Opening-sentence and sentence-shape repetition over a window | Yes |
| Template representation | | Block-sequence repetition over a window | Yes |
| Insufficient mechanism depth | | Kind fields in the model left unused in the text | Yes |
| Unnecessary implementation detail | | Version numbers, opcode or parameter values | Yes |
| Placement-specific framing | Lexicon | | Yes, read under every parent |
| Terminology drift | Glossary lookup for undefined terms | | Yes |
| Unsupported factual claims | | Unhedged absolutes ("always", "guarantees", "cannot") | Yes |
| Speculation stated as fact | | Domains 19–27 without modal or conditional phrasing | Yes |
| Diagram restating prose, or prose narrating the diagram | | Overlap between block strings and adjacent paragraphs | Yes |
| Definition repeated in the body | Near-exact match | | Yes |
| Examples that date or specialize canonical content | | Years, versions, "currently", product names | Yes |
| Mathematical relations | | Symbols without words | Yes (stated in words, plain text) |

## 17. Verification architecture

| When | What |
|---|---|
| Per concept | Content validation (`validateMapKnowledge`), registry entry, model and design schema, plan conformance (claims, excludes), deterministic audit checks |
| Per group (commit) | Plan validity: every member covered, each claim assigned once, reservations honoured; plan freshness against its fingerprints; group audit pass |
| Per PR | `map:generate` with no drift (every `hasContent` flip expected); `npm test`; lint; type-check; build; full browser suite; render check of every placement of every changed concept at 1280 and 375 pixels; an L2 expansion check; the L2 diff boundary |
| Per domain completion | Render check of every placement of every concept the domain owns or holds; dual-role leaf audit for the domain's dual-role placements |
| Campaign completion | Full render of every L2 and dual-role placement (about 3,900 renders); full browser suite; corpus drift report; Worker bundle and asset counts against limits; deployment only on its own explicit request |

**What each render covers** (the render check today):

- canonical-text equality across placements;
- trail;
- current and expanded state;
- exact children (none at L2);
- no facet leakage;
- text alternatives and table labels;
- overflow at desktop and mobile widths.

It reads only after `waitForExposition`, which waits for `aria-busy="false"`,
and a failed load is reported, never compared.

**To build for L2:**

- **L2 expansion check.** From each L1 placement holding a changed concept,
  open the parent, activate the L2 row, wait for readiness, and check the
  exposition, trail and URL. The render check enters by URL; this enters by
  navigation.
- **State semantics**, if implemented: the generated text alternative,
  back-edge rails, and the same column at every width (a browser fixture).
- **L2 diff boundary**: only declared records added, their registry entries,
  `hasContent` flips for exactly those concepts in the generated view, and
  their plan and design artifacts. Taxonomy, relationships, mechanisms,
  paths, L0 and L1 records, and other domains' artifacts stay byte-identical.
- **Stale detection.** A plan records fingerprints of its group membership,
  parent records, authored members' records and reserved owners. A change
  makes the plan stale and stops drafting.

**Scale facts to watch.**

- Static content routes grow from 354 to 1958, and prerendered output and
  deploy artifacts grow with them (the last deploy uploaded 342 assets).
- `data.ts` is already 1.37 MB with exposition at about 2.4 KB per record. L2
  adds roughly 3 MB.
- The homepage preview imports `mapResolver`, which carries the whole
  knowledge model, exposition included, into server code. The Worker bundle
  therefore grows with every record.

Measure the Worker bundle before the campaign. Consider keeping exposition
out of the runtime module graph (only the static content route needs it), and
splitting content storage per domain so that diffs stay reviewable.

## 18. Scale and token economics

**Assumptions** (from measured sizes):

- The full authoring docs are about 25,000 tokens; an L2 rule card is about
  4,000.
- `map:inspect` for a five-placement concept is about 8,000 characters (about
  2,000 tokens).
- An L1 parent is about 300 tokens.

| Work | Units | Input tokens per unit | Output tokens per unit | Total input | Total output |
|---|---|---|---|---|---|
| Territory plans | 328 | about 18,000 | about 3,000 | 5.9M | 1.0M |
| Model, design and draft | 1604 | about 12,000 | about 3,000 | 19.2M | 4.8M |
| Independent concept audit | 1604 | about 10,000 | about 1,500 | 16.0M | 2.4M |
| Repair (assuming 25% redraft once) | about 400 | about 15,000 | about 3,000 | 6.0M | 1.2M |
| Group audit pass | 328 | about 12,000 | about 1,500 | 3.9M | 0.5M |
| **Total** | | | | **about 51M** | **about 10M** |

Shared prefixes (rule card, catalog) are cacheable. These are
order-of-magnitude estimates under stated assumptions, not measurements.

**Batching compared.**

- **Concept by concept, with group plans (recommended):** about 51M input.
  Bounded context, no accumulated precedent, territory protected.
- **Concept by concept, without plans:** about 35M input, but sibling theft
  is unchecked, so repairs and audit failures rise. False economy.
- **Domain batch in one growing context:** context grows by about 5,000
  tokens per concept. For a 60-concept domain, the input sums to about 10.7M
  per domain, or about 290M across 27 domains. It crosses compaction limits
  and accumulates precedent, which is the L1 convergence mechanism.

**Deterministic work that never consumes model reasoning:**

- ontology traversal, ownership and placement lookup;
- context assembly and extraction of parent sentences that mention the
  target;
- sibling membership, category and member relations, near-synonym warnings;
- plan, model and design schema validation;
- phrase-overlap and drift signals;
- diff validation, render and browser verification;
- reporting.

**Model reasoning is reserved for** territory, the concept model,
representation choice, authoring and editorial judgment.

**Context degradation.** Each concept and each audit starts from a fresh,
assembled context. The run state on disk, not the conversation, carries
progress. A territory plan is the only cross-concept memory, and it holds
claims, not prose.

## 19. Autonomous-campaign requirements

**Deterministic infrastructure:**

- the L2 inventory and ownership (this change adds the read-only part);
- the hazards registry;
- an L2 context assembler that extracts sentences from every parent;
- schemas and validators for plans, models and designs;
- an L2 planner and run state (branch naming, base, slices), reusing the
  domain-run reconciliation;
- the gates;
- an L2 diff validator;
- the L2 expansion check;
- stale detection;
- audit signals;
- PR text and reports generated from the run;
- the `state` primitive.

**Agent reasoning:** territory allocation, concept models, representation
designs, drafting, and editorial judgment.

**Stop conditions:**

- a near-synonym or identity pair without a defensible territory split;
- incompatible meanings across placements;
- a representation gap that prose cannot cover accurately;
- a territory conflict between plans (the same claim reserved twice) or a
  claim no member can hold;
- a stale plan or design (parent, member, membership or reservation changed);
- unexpected existing content, a registry inconsistency, or a concept that
  became dual-role or changed owner;
- a group that owns nothing reached as a run target;
- an inventory problem (`npm run map:l2` not clean);
- a diff outside the declared scope;
- a verification failure, or a CI failure after a fix attempt;
- a git, remote or PR mismatch, or a PR that is not mergeable;
- an audit failure persisting after two repairs;
- a factual claim the agent cannot support and the exposition cannot do
  without;
- a drift signal persisting over a whole slice (pause for calibration; never
  a quota).

**Human acceptance.**

| Item | Accepted by | Granularity |
|---|---|---|
| L2 architecture (this document) | Human | Once, by merging |
| `state` primitive | Human | Its own product PR |
| Tooling | Human | Ordinary PRs |
| Re-review of the blocked L1 designs | Human | One small spec PR |
| Pilot territory plans and designs | Human | One checkpoint before pilot drafting |
| Pilot content | Human | Detailed review of one PR |
| Campaign authorization | Human | Explicit, once, as for L1 |
| Campaign PRs | Human merge, or agent merge only under explicit campaign authorization | Per slice PR, about 55–60 in all |
| Plans and designs during the campaign | Reviewed in their PR | No separate approvals |

Semantic safety comes from plans, validators and stop conditions, not from
1604 approvals.

## 20. Pilot

Five groups and 22 owned concepts, run out of canonical order to test the
architecture rather than to produce volume.

| Group (domain) | Owned concepts | What it tests | Likely representation question | Ownership and placement complexity | Failure would reveal |
|---|---|---|---|---|---|
| Emergency Governance (Governance & Institutions) | Emergency Powers, Pause Mechanisms, Guardians, Emergency Upgrades, Circuit Breakers | Strong State candidates; five-placement concepts; parent already stating child insights (pause traps users, breaker thresholds); a dual-role sibling (Incident Response) that is parent elsewhere | `state` for Circuit Breakers and possibly Pause Mechanisms; prose for Guardians | Pause Mechanisms and Circuit Breakers each have four other parents in four domains; Emergency Upgrades is also under Upgrade Security | Whether one exposition survives five parents, whether the plan stops parent paraphrase, and whether State is used only where meaning needs it |
| Cross-Chain Atomicity (Interoperability & Abstraction) | Atomic Swaps, Hashed Timelock Contracts, Two-Phase Commit, Partial Failures, Atomicity Guarantees | Category and member (Atomic Swaps realized by HTLC); a concrete mechanism; a reserved claim for Shared Sequencing, owned by an earlier domain and not yet authored; parent is an authored dual-role L1 | `flow` with a branch for HTLC; `state` for Two-Phase Commit; prose for Atomicity Guarantees | Shared Sequencing has four placements and is owned by Consensus & Ordering | Whether reservations work out of order, and whether the category consumes its member |
| Formal Methods (Security, Correctness & Resilience) | Formal Verification, Model Checking, Theorem Proving, Symbolic Execution, Static Analysis, Formal Specifications | The parent already compares four children in a `comparison`; a category sibling (Formal Verification); a cross-group cluster (Correctness: Verification and Specifications; Protocol Specification) | Mostly prose; any comparison would duplicate the parent | Formal Specifications also sits under Protocol Specification beside Specifications | Whether L2 restates its row of the parent's comparison, and whether cluster claims hold |
| Oracle Problem (Oracles & External Reality) | Verification Limits, External Data Availability, Oracle Failure | A contextual-label homonym ("Data Availability" for `external-data-availability`); a mixed group whose other three members are owned by earlier domains and are not yet authored | Prose; possibly a `distinction` from data availability, if the confusion is real | Three reserved claims from Foundations and State & Data | Whether the homonym is disambiguated without leaning on the label, and whether ordinary prose stays deep and unformulaic |
| Virtual Machines (Computation & Execution) | EVM, WASM, zkVMs | Named technologies; a parent with an existing `tensions` block that already says what each optimizes for; neighbours (EVM Equivalence, EVM Compatibility, zkEVMs, Alternative VMs) owned by a later domain | Prose; nothing the parent's tensions already shows | Later-domain neighbours need reserved claims | Whether named technologies stay canonical and undated, and whether a parent's structure is respected rather than redrawn |

Freshness (Oracles: Update Frequency, Staleness, Timestamps, Freshness
Thresholds, Heartbeats, Deviation Thresholds) is the alternate if the pilot
needs a tighter parameter-sibling test.

**Pilot procedure:**

1. Plans and designs first.
2. Human checkpoint.
3. Drafting and audit.
4. One PR.
5. Detailed review.
6. Refine the contracts and tooling before the campaign.

If `state` is not yet implemented, the pilot exercises the block path
instead, which is also useful but proves less.

## 21. Implementation roadmap

Dependency-ordered. Nothing here is executed by this analysis.

1. **Accept this architecture** (merge this document and the read-only
   inventory).
2. **Re-review the two blocked L1 State designs** against the vertical
   boundary. The likely outcome is to resolve them as keep: the L1 records
   relate to the state machines, while Transaction Lifecycle and Mode
   Switching own them. This removes the L1 justification before the primitive
   is built and stops an L1 record drawing L2 territory. It is one small spec
   PR through the existing refactor governance.
3. **Implement `state`** as product work: types, validation (with the
   back-edge rule), renderer, generated text alternative, browser fixture,
   catalog entry changed from gap to native, and documentation. It is
   independent of steps 4–6 and can proceed in parallel, but must land before
   the pilot and before Computation & Execution's L2 run.
4. **Prepare for scale:** measure the Worker bundle and assets; decide
   whether to keep exposition out of the runtime module graph and split
   content storage per domain. Do this before content volume grows, not
   after.
5. **L2 read-only tooling:**
   - a context assembler with sentences from every parent;
   - sibling claims and cluster detection;
   - `map:inspect` extended to every parent;
   - hazard integration.
6. **Contracts as tooling:** schemas and validators for territory plans,
   concept models and representation designs; audit signals; drift report.
7. **L2 orchestration:**
   - planner (ownership-based eligibility, slices) and run state;
   - branch naming, with `MAP_RUN_BRANCH` extended;
   - gates and the L2 diff validator;
   - the L2 expansion check and stale detection;
   - reports and PR text;
   - stop conditions.
8. **Pilot** (section 20), with the human checkpoint on plans and designs.
9. **Pilot audit and refinement** of contracts, context and tooling.
10. **Campaign authorization**, then domains in canonical order, slice by
    slice, ending at validated PRs. The dual-role leaf audit runs per domain.
11. **Campaign completion verification** (section 17). Deployment only on its
    own explicit request.

`state` belongs after the L1 re-review and before the pilot. Building it
first would cement the two L1 designs as its precedent. Building it after the
pilot would leave the pilot's strongest State candidates untested and push
Transaction Lifecycle into a later refactor.
