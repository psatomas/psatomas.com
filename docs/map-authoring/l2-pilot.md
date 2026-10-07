# L2 pilot: findings and refinement

The L2 pilot authored 22 concepts in five ownership groups (PR #209) through
the governed workflow in [l2-authoring.md](l2-authoring.md). This records
what it showed and what changed before the campaign:

- the review findings and their repair;
- the territory precedents;
- the measured depth before and after refinement;
- how each kind of defect the pilot found should be caught;
- the tooling and contract changes.

The scale projection from these records is in
[l2-content-scale.md](l2-content-scale.md#15-re-measured-with-the-pilot).

## 1. How the pilot ran

1. **Plans and designs.** Every territory plan, concept model and design was
   recorded and reviewed by a human at the checkpoint. The review added the
   `failure` kind (#208).
2. **First drafting.** Each concept was drafted by one agent and audited by
   another, each in a fresh context; then each group was audited as a
   whole. The concept audits repaired 21 of 22 records before recording.
3. **Detailed review of the PR.** It found five defects and four territory
   questions. The workflow then had no way to repair a concept after its
   audit, which led to the repair lifecycle (#210, #212, #213).
4. **Repair cycle 1.** All 22 concepts were reopened in one cycle and
   repaired in fresh contexts. The repairs covered:
   - the five findings;
   - the territory decisions;
   - American English;
   - an editorial-depth pass.

   Each concept was then re-audited in a fresh context, and each group
   re-audited.
5. **Second repairs.** The re-audits reopened four concepts once more, each
   for an error the first repair had introduced or left. All four passed on
   their second repair. No concept reached the repair limit.
6. **Validation and commits.** The run validated the repaired tree in full
   (gates, browser suite, render and expansion, diff). It then committed one
   repair commit per group on top of the original commits, fast-forwarded
   the push and regenerated #209's text. On its first attempt, the commit
   stage found a defect in the new repair commit itself, fixed in #215; the
   run took the fix by merging main through `sync`.

## 2. Review findings and their resolution

| Finding | Resolution |
|---|---|
| Atomicity Guarantees: the "all or refund" row relied on "deadlines enforced on each chain", false for adaptor-signature swaps | Now "a refund deadline enforced on at least one of the chains". The first repair, "the chains that hold refundable legs", still implied every chain, because every locked leg is refundable. The re-audit reopened it. |
| Formal Specifications repeated Formal Verification's argument that a guarantee quoted without its assumptions claims too much | Removed. The record keeps its own point: the assumptions are part of what a specification means. The first repair introduced a false finality claim ("a finalized block stays final only while…"); the second made it "is guaranteed to stay final only while…". |
| Oracle Failure used "feed" for both an upstream source and the oracle's output, and listed a mis-mapped feed as a source error | "Source", "node", "oracle" and "update" now each have one sense, and "feed" is gone. The example fits none of the model's causes, so it was removed. A second repair fixed an ambiguity the first introduced. |
| zkVMs: the trace row implied every zkVM is a register machine | "the registers or stack entries the step uses". |
| British spellings in 10 of 22 records (behaviour, artefact, modelled, …) | Normalized. American English is now quality-contract criterion 12, and a short list of British forms is refused when drafting is recorded (#210). |

Two further corrections came from the audits:

- **Partial Failures' model meaning** ("a state no participant intended")
  contradicted its adversarial cause. It now says "a state the action was
  not meant to produce", re-recorded within the repair.
- **Verification Limits' model.** Its `statement` and `violatedBy` were
  corrected before the first PR.

## 3. Territory decisions

The four overlaps and their precedents are in
[l2-authoring.md](l2-authoring.md#territory-precedents):

- **Emergency Powers and Emergency Upgrades:** legitimate overlap, divided
  general from specific.
- **Model Checking and Formal Specifications:** reference only.
- **EVM and three unplanned Smart Contracts concepts:** an actual,
  latent ownership collision. The EVM's claim was narrowed, its excludes
  extended, and the plan, design and record repaired through the lifecycle.
- **Verification Limits and Authenticity:** legitimate overlap, divided by
  angle.

The EVM's second repair came from the narrowed claim itself. Its wording,
"differ only in", was inaccurate and reappeared in the record.

## 4. Depth, measured

Words count every string a record shows. Measured on the 22 records, before
refinement (#209 at `826aee0`) and after repair cycle 1:

| Measure | Before | After |
|---|---|---|
| Minimum | 529 | 504 |
| 25th percentile | 821 | 758 |
| Median | 1,026 | 984 |
| 75th percentile | 1,116 | 1,046 |
| 90th percentile | 1,177 | 1,150 |
| Maximum | 1,252 | 1,201 |
| Total words | 20,996 | 19,705 |
| Mean words | 954 | 896 |
| Bytes per record (JSON, mean / median) | 5,864 / 6,289 | 5,552 / 5,964 |
| Total bytes | 129,015 | 122,154 |
| Structured / prose-only records | 5 / 17 | 5 / 17 |

**What changed most:**

- **EVM (−17%).** Its call material moved to the narrowed claim: what a call
  carries and what its context exposes now belong to Message Calls and
  Execution Context.
- **Verification Limits (−13%).** The attestation mechanisms (why a TLS
  session proves nothing to others, zero knowledge, the vendor-certified
  key) now belong to Authenticity.
- **Emergency Upgrades (−9%).** The general ending and accountability
  mechanics now belong to Emergency Powers.
- **Pause Mechanisms (−8%).** A repeated example, a wordy setup and a
  restated conclusion.

The smallest changes were Emergency Powers (0%), Theorem Proving (−2%) and
zkVMs (−2%), whose auditors found little removable material.

**Representative removals:**

- **Sibling or adjacent territory:**
  - "A call names a target account, supplies calldata, may transfer
    ether…" (EVM; now Message Calls);
  - "because relayers are offline or the chain is congested" (Two-Phase
    Commit; the causes belong to Partial Failures).
- **Parent repetition:**
  - "The shared hash is what makes two separate contracts one exchange"
    (HTLC);
  - "where much of its speed comes from" (WASM).
- **The same point twice:**
  - "One key used in error can hold a protocol still for as long as a
    vote takes" (Pause Mechanisms, restating the sentence before);
  - "and its bounds trade them against one another" (Guardians, where the
    next paragraph states the tradeoff).
- **Excess examples:** "a channel holding three messages when its capacity
  was two" (Model Checking) and "the price of an asset that has not begun
  trading" (External Data Availability).
- **Prose spelling out a structure's cells:** "the next lets such a state
  exist but fixes how it ends; the weaker ones promise a later repair, or
  nothing" (Atomicity Guarantees).

**What the depth pass showed:**

- **The pilot's length is mostly necessary at the claims' scope.** A
  fresh-context editorial pass removed about 6%. The independent re-audits
  found little removable material left.
- **Length does not follow the number of claims.** Every concept has three
  or four claims, and the correlation between claim count and length is
  −0.23. Length follows how much mechanism each claim carries. Governance
  concepts run 680–760 words; formal methods and virtual machines
  1,000–1,200; External Data Availability 504. Words per claim range from
  168 to 400 (median 295).
- **The levers for the campaign** are claim scope in the plans and per-claim
  economy in the audits, not a word cap ([Depth](l2-authoring.md#depth)).
  The old 210-word "expected" assumption was the dual-role L1 scale, not L2
  depth.
- **Shape.** Ten of the 22 records have five paragraphs, and all five
  Emergency Governance members do. Their group audits judged this to follow
  the claim counts. The drift report now measures paragraph-count
  convergence.

## 5. What the pilot taught about validation

Every substantive defect the pilot found, classified by where it belongs:

**1. Deterministic validation should catch it** (now does):

| Defect | Check |
|---|---|
| British spellings | `spellingProblems`, refused when drafting is recorded |
| A record changed after its audit, or after drafting, outside a repair | Fingerprint binding; `staleL2Steps`, `l2 status`, the `l2-check` gate |
| A repair that changes territory, a model or a design without revalidating it | `repairScopeProblems` |
| Repairs not counted; the two-repair limit not enforced | Repair cycles counted by `reopen`, including a failed repair's reopening |
| An audit bound to the wrong fingerprint (an `--audit-file` written after validation read the plans) | Fixed ordering |
| A test pinning a concept as unauthored | Deep-entry expectations derived from the row (the pilot's declared fix) |
| A stale dev server's generated route types failing the build gate | The gate clears them first |
| A repair commit comparing status-prefixed git lines with paths | Paths compared (#215) |
| A plan claim naming an unplanned concept of its own domain (EVM / Message Calls) | `claimCollisions`, refused unless excluded |
| The Worker growing past the storage threshold unnoticed | The `worker-budget` check in every L2 run's diff stage |

**2. A heuristic could usefully flag it** (attention, resolved by the audit):

| Defect or risk | Signal |
|---|---|
| Wording that matches another concept's title | `names-concept` (existing) |
| Unhedged absolutes | `absolutes`, no longer counting the concept's own title words |
| A record far longer than its claims need, or thin for its claims | `depth-long`, `depth-short` |
| A slice converging on one depth or paragraph count | `drift-depth`, `drift-paragraph-count` |
| Positional and dated wording | `positional`, `dated`, without the pilot's false positives ("above one", "at the latest") |

**3. Fresh-context technical and editorial judgment** (no regex should try):

- **Overclaims and wrong conditions:**
  - "usually given to different parties" (Pause Mechanisms);
  - "only if no commit can still take effect" (Two-Phase Commit);
  - a consensus quorum that blocks "if a majority fails" (Two-Phase
    Commit).
- **False facts:**
  - an account with "no code" (EVM, now that accounts can delegate code);
  - the hash visible on every chain at lock time (HTLC);
  - finality lasting "only while validators follow the protocol" (Formal
    Specifications, introduced by a repair).
- **Examples that do not fit their category:** freezing a balance as a
  "power to move" (Emergency Powers); a mis-mapped feed as a source error
  (Oracle Failure).
- **Reservation and territory breaches carried by structure or paraphrase:**
  - the "all or nothing" cell that answered Shared Sequencing's reserved
    question;
  - unnamed paraphrases of a sibling's mechanism.
- **Inconsistency across members:** the deadline cell against the Atomic
  Swaps record.
- **Inaccurate plan claims:** "differ only in".
- **Term-sense drift:** "feed".
- **Ambiguity introduced by condensing:** "within blocks".
- **The same argument made twice in different words.**

These were all found by reading, most by the independent auditor and
several only by the second auditor after a repair. The response is the
fresh-context audit and re-audit loop, not more patterns.

**`property.violatedBy`.** Verification Limits showed the field invites a
breach framing for a limit-type property. The corpus does not justify
changing the contract:

- About 70 L2 concepts are properties with a natural violation (Safety,
  Collision Resistance, Inclusion Guarantees).
- Of 35 limit- or threshold-titled concepts, nearly all are parameters
  (Credit Limits, Liquidation Thresholds).
- Only a few are epistemic limits like Verification Limits.

The contract already lets a model leave out a field a concept does not have.
The guidance now says so for limits.

## 6. Tooling and contract changes

| PR | Change |
|---|---|
| #208 | The `failure` concept kind |
| #210 | The governed repair lifecycle (`reopen`, scope bounds, staleness, counted repairs, repair commits, `sync`, `--audit-file`, `group-signals`); American English |
| #211 | `sync` adopts a merge of main already on the branch |
| #212 | Every repair attempt counted; `sync` allowed during a repair |
| #213 | A repair's plan is recorded before its design without deadlock |
| #215 | `--audit-file` ordering; the build gate clears stale route types; repair commits by path, and `sync` past an open repair; signal false positives and depth diagnostics; the same-domain claim-collision check |
| This PR | The `worker-budget` check; the empirical scale scenarios; the depth policy, territory precedents and this record; the scale re-measurement |

## 7. Remaining known weaknesses

- **Paraphrase is not detected.** Overlap signals compare wording, so the
  same argument in different words passes unless an auditor reads for it.
  This is by design (section 5).
- **A repaired run costs about twice the agent work of a first draft.** Every
  concept is re-drafted and re-audited, and every group re-audited. That is
  the price of fresh context; a campaign should repair in slices, not
  record by record.
- **Clarity remarks the audits judged acceptable were not acted on.** One
  example is a pronoun with a weak antecedent in Pause Mechanisms. A further
  repair cycle would have cost repairs for marginal gain.
- **The L1 Formal Methods comparison row for model checking** ("nothing
  beyond the model's bounds") is coarser than the Model Checking record. It
  is L1 content, outside the pilot.
