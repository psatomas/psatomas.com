# L2 authoring pipeline v2

v1 ([l2-authoring.md](l2-authoring.md)) authored one concept at a time with a fresh
agent per step under a long-lived orchestrating conversation. It cost about 2.3 M
weighted tokens per accepted concept. v2 keeps v1's contracts, validators, run
state, gates and delivery, and replaces only how the content is produced:

- **Batches:** one ownership group (2–8 concepts) per batch.
- **A deterministic driver** (`scripts/map-l2v2.ts`) in place of an LLM
  orchestrator.
- **Bounded headless sessions** (`claude -p`), each with a written role.

## Quality policy

- **Nothing ships with a known unresolved substantive defect.** A concept whose
  defect survives the verified repair rounds is **parked**: its draft leaves
  the tree and the batch stops for a human.
- **Reviews are independent.** The plan review and the batch review run in
  sessions that wrote nothing being reviewed. Escalated concepts get a second,
  independent review.
- **Every repair is verified.** The reviewer re-reads each repaired passage and
  every sentence using a term the repair narrowed.
- **Sampling measures, it never authorizes.** Deep audits estimate the residual
  defect rate. A defect they find is repaired and verified like any other.

The rubric is [`scripts/l2v2/prompts/rubric.md`](../../scripts/l2v2/prompts/rubric.md),
distilled from the Foundations audits.

## A batch

| Status | Session | Checks between sessions |
|---|---|---|
| pending → planned | **plan**: claims, excludes, splits, models, designs in the group file | `l2 check --group`; one fix round |
| planned → plan-reviewed | **plan-review** (independent): claim accuracy, territory, depth; exact claim fixes or stop | fixes applied exactly; `l2 check` |
| plan-reviewed → drafted | **draft**: every record of the batch in `data.ts` plus registry | generate, `l2 check`, focused tests; each record and entry exactly once |
| drafted → reviewed | **review** (independent, side by side): every sentence, the rubric, claim coverage, signals, the group | exact repairs applied, then **verification** in the resumed review session, at most 2 rounds |
| reviewed → escalated | **escalate**: a second independent review of escalated concepts | exact repairs, then verification in the resumed session, at most 2 rounds |
| escalated → accepted | — | every signal resolved; v1 audit files written; parked concepts removed |

**Escalation triggers:**
- reviewer confidence below high;
- 3 or more defects in one concept;
- a defect in conditions, a formal result or the definition;
- an uncertain finding;
- a claim touching another domain's concept;
- a plan claim corrected at plan review;
- more than one placement;
- an emerging domain (L0 order 19 and later);
- a claim not fully covered.

**Guards.** Before and after every session, the driver checks:
- No session changes records outside its batch, so accepted content is never
  touched.
- The registry only gains the batch's entries.
- Reviewers change neither `data.ts`, the registry nor the group file.
- Only the plan session edits the group file.

A violation stops the batch.

**Recovery.** State lives in `.map-authoring/l2v2/<slice>/<group>/state.json`
(git-ignored) and is written after every step. Re-running continues from the
last completed status. A draft interrupted part-way is removed and started
cleanly, so records are never duplicated.

## Delivery

v2 runs inside a v1 slice run and delivers through it:

1. `npm run map:author -- l2 start --slice <id>`: v1's start safeguards and
   branch.
2. `npm run map:l2v2 -- run --slice <id>`: the batches.
3. `npm run map:l2v2 -- finalize --slice <id>`:
   - records the v1 steps in v1's order (plans, designs, then author and audit
     per concept, then group audits);
   - runs `l2 complete audit`;
   - runs `l2 run --until diff`, which covers the gates, the browser, render
     and expansion checks, and the diff check with its Worker size check.
4. `npm run map:author -- l2 run`: commit, push, PR, CI and merge, under the
   recorded campaign authorization. v2 itself never pushes or merges.

## Cost measurement and stop rules

Every session's exact usage, taken from the `claude -p` JSON output, goes to
`.map-authoring/l2v2/ledger.jsonl`, together with batch outcomes, deep-audit
results and readings of the usage meter (`map:l2v2 -- meter --percent <n>`).
`map:l2v2 -- report` summarizes them.

Weighting, which is provisional and not a quota unit: input 1, cache read 0.1,
cache write 1.25, output 5.

**Stop rules,** checked before every batch. Defaults are in `DEFAULT_BUDGET`
and can be overridden in `.map-authoring/l2v2/budget.json`:
- the last 3 batches average more than 1.3 × 122 k weighted per accepted
  concept;
- escalation runs above 40%, once there are at least 10 concepts;
- any parked concept;
- 8 or more of the last 20 deep-audited concepts have substantive defects;
- the meter rises more than 0.109% of a weekly quota per accepted concept
  between two readings. Use 0.163% for a 3-week plan.

## Calibration pilot (before scaling)

The pilot is about 12 concepts in Computation & Execution, plus 6 Foundations
records as a baseline.

1. Read the meter: `npm run map:l2v2 -- meter --percent <n>`.
2. Start the slice with `l2 start`, then run `npm run map:l2v2 -- run --slice <id> --groups <g1,g2,g3>`.
3. Read the meter again.
4. Deep-audit every pilot concept:
   `npm run map:l2v2 -- audit --label pilot --concepts <ids>`.
5. Deep-audit the baseline from the checkpoint:
   `npm run map:l2v2 -- audit --label baseline --ref refs/checkpoints/l2-foundations-1-2026-10-08 --concepts <6 ids>`.
6. Read the comparison: `npm run map:l2v2 -- report`.

**Pass only if all hold:**
- pilot substantive defects per concept ≤ max(0.2, 1.5 × the baseline);
- every pilot defect found is repaired and re-verified before anything ships;
- zero territory leaks;
- every claim fully covered;
- meter cost per accepted concept within the plan;
- nothing parked, or each parked concept explained.

Scale only after a pass.
