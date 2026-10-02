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
- `kind`: mechanism, property, actor, attack, parameter, artifact,
  technology or institutional;
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
