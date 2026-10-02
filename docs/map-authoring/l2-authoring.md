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
