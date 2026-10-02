# L2 authoring

The operating procedure for L2 exposition. It implements the accepted
architecture in [l2-analysis.md](l2-analysis.md) with the scale decision in
[l2-content-scale.md](l2-content-scale.md). Where they disagree,
[content-architecture.md](content-architecture.md),
[quality-contract.md](quality-contract.md) and
[representation-design.md](representation-design.md) win.

Per concept, the sequence is fixed:

```text
territory context → concept model → representation design → authoring in a fresh bounded context
→ concept audit → group audit → deterministic verification
```

No step runs as one growing conversation across a group, domain or campaign.
Each concept starts from its assembled context. The territory plan, not the
conversation, carries what siblings have claimed.

## Territory plans

One repository-owned file per ownership group:
`src/lib/map/authoring/l2/groups/<group>.json`, where `<group>` is the L1
placement whose L2 children the group is. It is written before any member is
drafted, and committed with the group's content.

```bash
npm run map:author -- l2 territory <group>            # the plan, or a skeleton if none exists
npm run map:author -- l2 territory <group> --write    # create the skeleton file
npm run map:author -- l2 check [--group <group>]      # validate every plan
npm run map:author -- l2 context <concept-id>         # one concept's bounded context
```

**What the skeleton fills deterministically:**

- every member of the sibling group, in order, with its standing:
  - `owned`: the group owns its authoring;
  - `owned-elsewhere`: another group owns it;
  - `dual-role`: an L1 record already serves it;
- the plan's **basis**: fingerprints of the group's membership, of every
  parent and domain exposition around the owned members, of every member
  already authored, and of the hazards that touch the group;
- an empty split for every hazard pair in
  [`hazards.json`](../../src/lib/map/authoring/l2/hazards.json) that involves
  an owned member: near-synonyms, and category/member relations.

**The judgments the agent fills:**

- `claims` for each owned member: what only it explains. Each claim has one
  owner in the whole corpus.
- `excludes`: concepts it may name but never explain.
- `reserved` for each unauthored member owned elsewhere: the territory held
  for it. It is written as claims, never as prose.
- `revisions`: when the owner's plan narrows a reservation made for one of
  its members elsewhere, the claim and the reason.
- `splits`: how each hazard pair divides its territory. If no defensible
  split exists, stop: that is a taxonomy question, not an authoring one.

**What `l2 check` refuses:**

- members that are not exactly the group's placements, or the wrong standing;
- an owned member without claims;
- a claim owned twice, in the plan or anywhere in the corpus;
- a reservation that another concept claims;
- a reservation the owner's plan neither claims nor revises;
- an unknown excluded concept;
- an unanswered hazard;
- concept work for a concept the group does not own;
- a stale basis: a parent or fixed member changed, a reserved member was
  authored, or membership or hazards changed. Write the plan again before
  drafting.

## Context

`l2 context` assembles what every concept always needs:

- every placement, with its trail, label and siblings;
- the exact sentences of every parent, and of the domain prose (term strips
  excluded), that mention the concept. These are premises: L2 starts beyond
  them and never re-teaches them;
- its claims and excludes, its siblings' territory, and reservations made
  for it by other groups;
- hazards: hazard pairs, a facet watch, a multi-axis group, label homonyms,
  same-title concepts, and State candidacy;
- authored neighbours, by ID only. Read their records only to check a
  boundary, never as an example.

Full parent texts and unrelated records are on demand. A domain is never
dumped into the context.

## Concept work: model, design and audits

Each owned member's work lives in its group file under `concepts.<id>`
([`contracts.ts`](../../src/lib/map/authoring/l2/contracts.ts)). `l2 check`
validates it at the stage it has reached.

**Model** (before any prose):

- `meaning`, a single sentence;
- `kind`: mechanism, property, actor, attack, failure, parameter,
  artifact, technology or institutional. An attack is deliberate (an
  adversary acting for gain, answered by defences: `preconditions`,
  `mechanism`, `impact`, `defences`, `detection`). A failure is a condition
  in which a system does not deliver, from any cause, adversaries included
  (answered by detection and recovery: `causes`, `manifestation`, `impact`,
  `detection`, `recovery`);
- `parents`: what the concept adds beyond each parent;
- `claims` and `excludes`, exactly the plan's;
- `placements`: why the exposition holds at each placement;
- `fields`: at least two of the kind's fields (for a mechanism, sequence,
  actors, inputs, outputs, assumptions and failures), plus cross-kind fields
  where the concept has them (states, transitions, invariants, trade-offs,
  internal variants, a relation). Leave out what the concept does not have.

**Design:**

- `decision`: one of
  - `prose`, with `whyProse`;
  - `structure`, where each structure carries its `purpose` and
    `whyNotProse`, plus a `division` saying what the prose explains and what
    the structure shows;
  - `block`, a catalog gap with the reason prose cannot carry it.
- Always: `relationship`, `level` (why at this concept, not its parent or
  another), `territory` (why it draws no sibling's or reserved relationship)
  and `placements`.

No diagram is improvised for a gap. Once authored, the record must write
exactly the designed structures (prose, none).

**Concept audit:** a `note`, plus a resolution for every signal from
`l2 signals <id>`. It is bound to the record's fingerprint, so editing the
record after the audit reopens it.

**Group audit:** `groupAudit` in the group file, with a note and a resolution
for every group signal (sibling overlap, a shared opening, one form for
every member). It is bound to every owned member's record.

## Signals

Tools surface candidates; the audit decides. Every signal needs a written
resolution, and none is a failure, target or quota on its own
([`signals.ts`](../../src/lib/map/authoring/l2/signals.ts)).

| Kind | Checks |
|---|---|
| Deterministic facts | Positional language; dated or time-sensitive words and versions; the definition repeated in the body; a circular definition; every other concept named (multi-word titles anywhere; single-word titles only for siblings, hazard partners and excludes): confirm each is named, not explained |
| Heuristic | Overlap with a parent sentence that mentions the concept; overlap with authored siblings or hazard partners; three or more unhedged absolutes; too few conditional words in an emerging domain (L0 order 19 onward); a mathematical symbol (state the relation in words); prose spelling out a structure's entries; a model field that barely reaches the text |
| Group | Sibling text overlapping; three or more members opening alike; every member having one structured form |

## Drift

`l2 drift [--window n]` describes the latest authored L2 records. It
reports:

- the top form and its share;
- the top definition opening;
- the top paragraph opener;
- how much paragraph lengths vary.

It flags, as audit attention, a window of at least ten records where:

- more than half of definitions open alike;
- a quarter of paragraphs open alike;
- paragraph lengths barely vary;
- more than 85% of records share one structured form.

A prose majority is never flagged: prose is the expected default, not a
target to diversify away from. A flag persisting across a whole slice pauses
the campaign for calibration (see the campaign stop conditions).

## Diff boundary

Before anything is committed, an L2 run's diff is validated against its base
([`diff.ts`](../../src/lib/map/authoring/l2/diff.ts)). It extends the domain
run's content diff ([`diff-check.ts`](../../src/lib/map/authoring/orchestrator/diff-check.ts)).

**What a run may change:**

- `data.ts`, the registry and the generated view;
- its own group files;
- declared general fixes.

**What a run may not do:**

- change any existing record, L0, L1 or L2;
- change taxonomy, relationships, mechanisms or paths;
- change the generated view beyond `hasContent` flips at every placement of
  the authored concepts.

**The authored set is derived, never supplied:** every owned member of the
run's groups whose design does not block it. Members it blocks stay
unauthored.

**Every other group file is byte-identical.** Each run group must be:

- valid on its own terms;
- not stale;
- consistent with every plan.

**Each authored concept** is audited against exactly its record, with every
signal resolved, and **each group** carries a group audit bound to its
members' records.

## Expansion

The render check (`npm run test:map:render`) enters every placement by URL.
L2 adds `npm run test:map:expansion -- <concept-id>...`
([`l2-expansion.mts`](../../e2e/map/l2-expansion.mts)), which enters every L2
placement the way a reader does. At 1280 and 375 pixels it:

1. opens the parent L1 context and waits for its exposition to settle;
2. checks the L2 row is closed, then activates it;
3. checks the row becomes the context (URL, `aria-current`) and opens
   (`aria-expanded`);
4. checks the exposition settles (on `aria-busy`, never a fixed wait) and
   opens with the concept's own definition;
5. checks nothing overflows.

An L2 run's render stage runs both checks for every placement of every
concept it authored.

## Runs

An L2 run authors one **slice** from a clean, current `main` to a validated
PR. It reuses the domain run's machinery
([domain-runbook.md](domain-runbook.md)) with L2 stages and checks. Run
state is local, in `.map-authoring/l2/<slice>.json`. Group files and content
are committed by the run.

```bash
npm run map:author -- l2 campaign                         # every slice, the next one, merge authorization
npm run map:author -- l2 start --slice <id> | --pilot
npm run map:author -- l2 status | next
npm run map:author -- l2 record plan <group> | design <id> | author <id>
npm run map:author -- l2 record audit <id> | group-audit <group> --audit-file <json>   # binds the audit to the records as they are
npm run map:author -- l2 group-signals <group>            # the group audit's signals
npm run map:author -- l2 reopen <id>[,<id>..] --reason ".."   # a repair (below); --domain <slice> for a finished run
npm run map:author -- l2 sync                             # merge a moved main into the run's branch (below)
npm run map:author -- l2 checkpoint --decision ".."       # the pilot's human review
npm run map:author -- l2 complete audit --note ".."
npm run map:author -- l2 run [--until <stage>]            # gates → browser → render+expansion → diff → commit → push → pr → ci (→ merge)
npm run map:author -- l2 fix | stop | resume              # as for domain runs
npm run map:author -- l2 authorize --authorization ".."   # a human's explicit campaign merge authorization
```

**Slices.** Each domain's ownership groups, in L1 order, are split into the
fewest slices of at most 30 owned concepts, balanced, never splitting a
group: 66 slices in all ([`campaign.ts`](../../src/lib/map/authoring/l2/campaign.ts)).
A slice keeps its identity as the campaign advances. A concept is finished
once it has content, or once its group's plan records a design that blocks
it. Branches are `feat/map-<domain>-l2-<n>`, and `feat/map-l2-pilot` for the
pilot. An open PR from any MAP run branch blocks starting another run.

**Steps.** `record` validates each step deterministically before recording
it, and refuses steps out of order:

1. **Every group's plan.** Recorded when it is valid, current and consistent
   with every plan.
2. **Every concept's model and design.** Each must be valid against the
   plan, which must not be stale.
3. **Each concept drafted, then audited, in turn.**
   - `author` needs the record registered, the view regenerated, the focused
     tests passing, exactly the designed structures, and American English.
     It is recorded once, bound to the record's fingerprint: check
     `l2 signals` before recording. Any later change is a repair.
   - `audit` needs every signal resolved and the record unchanged since it
     was drafted. `--audit-file` writes `{ note, resolutions }` into the
     group file bound to the record's fingerprint. Recording it again with
     the record unchanged only replaces the note.
4. **Each group audit**, bound the same way to every member's record.

Each concept is modelled, designed, drafted and audited from its own
`l2 context`, in a fresh bounded context. The campaign never runs as one
growing conversation.

## Repairs

A defect found after a concept is drafted (by its audit, its group's audit,
or a human review of the run's PR) is repaired through `l2 reopen`, never by
editing the record and recording again.

- **Reopening** names the concepts and the finding (`--reason`). Each
  reopening counts one repair for each concept, however often it is edited
  before it is drafted again; concepts reopened while a cycle is open join
  it. A concept already re-drafted in the open cycle whose repair then
  fails its audit is reopened again, and that counts another repair. Their drafting, their
  audits and their groups' audits are then pending again, and the run
  returns to drafting from wherever it was, keeping its commits, push and
  PR. Everything validated is validated again.
- **Bounds.** Reopening fingerprints each concept's model and design and its
  group's territory. A repair changes the record within them. If the
  finding needs the model, design or territory changed, the repair records
  the design or plan again first, which validates it. Only reopened
  concepts' territory may move: `record` refuses anything else
  (`repairScopeProblems`). A plan or design of a drafted concept cannot be
  recorded again outside a repair.
- **Re-audit.** The repaired concept is drafted and audited again, and its
  group audited again, each in a fresh context, with audits bound to the
  repaired records.
- **Staleness.** `l2 status` lists any recorded drafting, concept audit or
  group audit whose record has changed since (`STALE`). The `l2-check` gate
  and the diff refuse them. The remedy is always to reopen.
- **Limit.** A third repair of one concept stops the run
  (`repair limit: <id>`). A human decision (`l2 resume --decision ..`)
  allows one more.
- **Commits.** Before the run's first commits, a repair is simply part of
  the validated tree. After them, the commit stage adds one commit per
  repaired group on top (`fix(map): repair <group> L2 topics`), carrying only
  that group's repaired records and its group file. The push is a
  fast-forward of the run's own push. The PR is kept and its text
  regenerated with the repair history. Nothing is amended or force-pushed.

**A moved main.** `l2 sync` merges `origin/main` into an open run's branch
(a merge commit, never a rebase), provided main changed none of the run's
files and nothing is uncommitted; an open repair stays open. The run's diff is then measured from the new main and everything is
validated again; the drafting and audits stand, because the content did not
change. A merge of main already at HEAD (made by hand, or before the run had
`sync`) is adopted instead, only if it is exactly the run's recorded head
merged with a commit of main and adds nothing of its own.

**The pilot** stops between design and drafting until a human reviews every
plan and design and records the decision with `l2 checkpoint`. The pilot
never merges its own PR.

**Tool stages:**

- **Gates:** the domain gates (generate without drift, unit tests, lint,
  build), plus `l2-check`: every run group valid, current and audited.
- **Browser:** the full browser suite.
- **Render:** the render check and the expansion check, for every
  placement of every authored concept.
- **Diff:** `validateL2Diff`. Validated files are written to git's object
  store.
- **Commits:** declared fixes first, then one commit per ownership group.
  Each is the exact tree after that group: the later groups' records,
  registry entries, `hasContent` flips and group files are removed from the
  validated tree. Removing them all must give back the base byte for byte,
  so every commit holds whole records and nothing else.
- **Push, PR (generated text) and CI,** as for domain runs.

**Merging.** A run ends at "validated PR awaiting human merge" unless a human
has authorized the campaign (`l2 authorize`). Then the run's `merge` stage
merges its own PR, but only when all of these hold:

- the PR is open against `main` at exactly the pushed commit;
- it is cleanly mergeable;
- CI passes;
- its files are exactly the validated set.

It then synchronizes `main` and proves the pushed head is in it.

**Stop conditions.** Each stops the run with evidence and the smallest
decision needed; `resume --decision ..` continues after a human decides.

| Condition | Where |
|---|---|
| A near-synonym or category pair without a defensible split | `record plan`: the hazard stays unanswered; stop by hand if no split exists |
| Incompatible meanings across placements; an unsupportable factual claim | Agent judgment: `l2 stop` |
| A representation gap prose cannot carry (design `block`) | `record design` stops; resuming leaves the concept unauthored |
| A territory conflict | `record plan` refuses: claim owned twice, or a reservation not honoured |
| A stale plan or design | `record design` and `record author` refuse; the `l2-check` gate and the diff stop |
| A concept still failing after two repairs | `reopen` counts repairs; the third stops until a human allows one more |
| A record, audit or group audit changed outside a repair | `l2 status` marks it stale; `record`, the `l2-check` gate and the diff refuse it |
| Unexpected existing content, or other diff scope | The diff stage |
| Inventory problems | `start` refuses |
| Slice-wide drift | `complete audit` stops once; resume with the calibration decision |
| Verification failure; git, remote or PR mismatch; a PR that cannot merge | As for domain runs; the merge stage refuses anything but the validated PR |

## Pilot

The pilot ([`pilot.json`](../../src/lib/map/authoring/l2/pilot.json)) is the
five groups chosen in [l2-analysis.md](l2-analysis.md#20-pilot), with 22
owned concepts:

- Emergency Governance;
- Cross-Domain Atomicity (in Interoperability & Abstraction);
- Formal Methods;
- Oracle Problem;
- Virtual Machines.

It runs out of canonical order, so its reservations for concepts owned by
earlier domains (Shared Sequencing, Trust Assumptions, External Data,
Authenticity) are written before those owners' plans exist. Those owners'
plans must later claim or revise them.

```bash
npm run map:author -- l2 start --pilot
```

**Procedure:**

1. Write and record every plan, then every model and design.
2. The run holds at the checkpoint. The proposed plans and designs are
   offered for review on a separate, never-merged branch.
3. A human records the review decision with `l2 checkpoint --decision ".."`.
4. Drafting and audits follow, then one PR for detailed review. The pilot
   never merges its own PR.
5. Refine the contracts and tooling from what the pilot shows before the
   campaign.
