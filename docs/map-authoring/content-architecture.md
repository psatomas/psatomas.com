# MAP content architecture

What canonical exposition is responsible for at each taxonomy role, and how a
single exposition serves every placement of its concept. This extends
[spec §11](../map-spec.md#11-content-model) and
[§15](../map-spec.md#15-explorer-interaction-model-and-full-width-recursion-invariant).
It does not replace them.

## How exposition reaches a reader

- **Storage.** One `MapConceptContent` record per concept, in
  `mapKnowledge.content` ([`data.ts`](../../src/lib/map/data.ts)), with the ID
  `<concept-id>-content`. It has a `definition` and an optional ordered `body`
  of typed blocks ([`types.ts`](../../src/lib/map/types.ts)).
- **Order.** `toMapConceptExposition`
  ([`explorer-model.ts`](../../src/components/map/explorer-model.ts)) renders
  the definition first as the lead paragraph, then any legacy `summary`,
  `explanation` and `whyItMatters` as plain unlabelled paragraphs, then the
  body.
- **Opening a row.** A reader who opens any placement of the concept sees the
  exposition first and the placement's children beneath it: explanation
  before decomposition. A row with content and no children still opens,
  onto the exposition alone.
- **Loading.** The explorer only knows that a concept has content (the
  `hasContent` flag in the generated view). The exposition itself loads from
  `/api/map/content/<concept-id>` when a reader first opens the concept.

## Level is a placement role, not a concept property

A placement's level is its depth: 0 is an L0 domain, 1 an L1 topic, 2 an L2
topic. The editorial responsibilities below attach to those roles. A concept
takes on each role it holds in some placement, so never treat a concept as
"an L1 concept" in the abstract. On main, 67 of the 330 L1 placements belong
to concepts that are also placed at another level. Check with
`npm run map:inspect -- <concept-id>`.

| Role | Responsibility | Scope |
|---|---|---|
| **L0 domain** | Orient the reader in a broad technical domain and lay out its conceptual territory: what the domain is about, how its L1 topics divide it, and how they relate. | The whole domain, at the level of its L1 topics. |
| **L1 topic** | State the conceptual model the branch represents: what the topic is, which distinctions or processes organize it, and how its L2 children fit together and depend on one another. Synthesize and relate. | The topic and the relations among its children, not each child's own depth. |
| **L2 topic** | Give the focused technical explanation of the concept itself: its mechanism, assumptions, variants, failure modes, and what it is often confused with. | The concept itself. |

### L0: orientation (the existing corpus)

All 27 L0 domains have canonical exposition. The corpus shares one shape,
which the domain tests in `map.test.ts` protect for several domains:

1. The definition states the domain's territory.
2. An intro paragraph, usually with one domain-level `flow`.
3. One section per L1 topic, in sibling order. Each opens with a `heading`
   phrased as a claim, not a label (for example "Vulnerabilities are
   weaknesses; exploits make use of them"), continues with one or more
   paragraphs and often a `distinction` or `flow`, and closes with a `terms`
   strip whose entries are that L1 topic's L2 labels.
4. A closing paragraph, then a `terms` strip listing the domain's L1 labels.

Early domains (01–09) have richer sections with several paragraphs and
flows. From about 13 onward, sections are compressed to heading, one
paragraph, distinction and strip, and lean on "X is not Y"
disambiguation. Both are established. Neither is a template for L1.

### L1: synthesis of a branch

The parent L0 exposition already summarizes each L1 topic in its section.
`map:inspect` prints that section as "Parent exposition around the primary
context". An L1 exposition therefore:

- **goes beyond the parent's section.** It explains the model the parent only
  names: why the children belong together, what organizes them (a lifecycle,
  a set of dimensions, a trade-off, a layering), and how one child
  constrains, enables or depends on another. It does not restate the parent's
  sentences or reuse its headings verbatim.
- **introduces its children in relation to each other, without explaining
  each in full.** Name the child concepts where the model needs them, and
  give only as much of each as the relation requires. The mechanism,
  variants and failure modes of a child belong to the child's own (future) L2
  exposition. When a child already owns content, relate to it; do not restate
  it.
- **stays within its branch.** Sibling L1 topics are separate branches.
  Mention a sibling only to draw a boundary the reader needs, and do not teach
  it.

### L2: focused knowledge

L2 exposition explains its concept on its own terms. It may assume the reader
arrived through the parent's synthesis but must not depend on it, because
the same concept may be placed under other parents. It covers what the
parent only names, at the depth the concept needs.

## One canonical exposition, many placements

The exposition is shared verbatim by every placement of the concept. That
rules out:

- **Positional or contextual references**: "below", "the topics that follow",
  "in this domain", "as the previous section showed". At some placements there
  are no children beneath the row, and the parent and domain differ.
- **Claims true in only one context.** Finality's exposition must hold under
  Consensus & Ordering, Protocol Properties, Rollups and Cross-Chain
  Verification alike. Context-specific framing belongs to the placement's
  optional `contextualNote`, which is taxonomy data, not content work. The
  explorer does not render notes today.

When a concept is placed at several levels:

- **Usually one placement carries the concept's children.** Children are
  placed under that placement; its other placements are leaves.
  `map:inspect` names the carrier ("Only X carries the concept's
  children"). Some concepts carry children at several placements; see
  [several child-carrying placements](#several-child-carrying-placements).
- **The same text must work in both roles.** Where the concept is an L1
  topic, it introduces a layer of children. At its leaf placements, the same
  text must read as a complete explanation of the concept, because nothing
  opens beneath it there. Write the synthesis as explanation of the concept
  itself, not as a table of contents for the rows below.
- **The preferred placement may be a leaf.** For 11 L1 placements the
  preferred placement is elsewhere, for example Transitions, preferred under
  State Machines but carrying its layer as "State Transitions" under State &
  Data. Inspect with `--context <carrier>` to see the layer you are
  synthesizing, and read the other placements to see where the text must also
  stand alone.

### Several child-carrying placements

A few concepts carry a layer of children at more than one placement, usually
L1 topics of different domains. Each layer decomposes the same concept along a
different facet suited to its domain. For example, one layer covers the
mechanisms of an activity and another the kinds of thing it applies to, or one
covers what is established and another the machinery that establishes it.

- **One carrier:** the existing L1 contract applies. The exposition may
  synthesize that carrier's layer.
- **Several carriers:**
  - The canonical exposition explains the concept in terms that are valid at
    every placement. It may identify the facets that the child layers
    represent and say how they relate.
  - It must not synthesize one carrier's layer as though that were *the*
    decomposition of the concept.
  - It must not synthesize the union of all child sets into one artificial
    layer.
  - Each carrier's domain exposition (its L0 section) remains responsible for
    synthesizing that domain's layer. Children, including those shared
    between layers, are named at most, never explained.
  - **Ownership.** The domain containing the preferred placement owns
    authoring of the canonical exposition. Batches for the other domains leave
    the concept to that domain rather than treating it as blocked. Ownership
    is workflow responsibility only: it does not make the preferred carrier's
    layer the canonical decomposition.
  - **Inspection.** Inspect every child-carrying placement before writing.
    `map:inspect` lists each facet with its trail, child count and the
    children unique to it, the child concepts the layers share, and the
    parent section around every carrier.
  - **Stop condition.** If the layers cannot reasonably be read as facets of
    one canonical meaning, stop. That points to a taxonomy or identity
    problem, such as a concept that should be split, not an authoring
    problem.

### Contextual labels versus identity

`contextualLabel` changes only the explorer wording. Examples: Transitions is
shown as "State Transitions" under State & Data, and Contract Deployment as
"Deployment" under Smart Contracts. The exposition is written about the
canonical concept (its title) and must make sense under every label it
appears with.

### Reused concepts constrain writing

- A concept reused across domains is one meaning. If the exposition you want
  to write fits only one domain's sense of a word, you may be looking at a
  different concept. Stop and escalate (see the
  [workflow](authoring-workflow.md#stop-and-escalate)). Do not bend the
  shared exposition or add a new concept.
- Distinct concepts can share a title. For example, `communication`
  (message exchange between processes) is not `coordination-communication`
  (participants exchanging information to align action). `map:inspect` lists
  them. Keep their meanings apart.
- The preferred placement is presentation policy. It does not make other
  placements secondary meanings.

## Structure follows meaning

Form is decided after the concept is understood: context, analysis, concept
model, representation design, then authoring, audit and verification
([representation-design.md](representation-design.md)). The L0 block pattern
is not a template for other roles, and neither is any sibling's form. Choose
blocks by what the explanation needs:

| Block | Use it for | Corpus note |
|---|---|---|
| `paragraph` | Continuous technical explanation; the default. | 500+ uses. |
| `heading` | A turn in a longer exposition. Phrase it as a claim. Never a template label like "Why it matters". | L0 sections open with one. Short expositions need none. |
| `flow` | A process, pipeline or decomposition whose order or branching carries meaning. At most six parallel elements; no two parallel stages in a row. | 140 uses. |
| `distinction` | A specific conflation the reader is likely to make ("A ≠ B", optionally a chain). | Heavily used from domain 13 onward; use it only where the confusion is real. |
| `tensions` | Recurring pairs of forces that genuinely pull against each other. | Only 2 uses in the corpus. |
| `terms` | The vocabulary a passage introduces, as plain text (not navigation). | L0 strips mirror taxonomy labels; that is an L0 convention, not a requirement elsewhere. |
| `cycle` | A recurrent process whose last step feeds the next pass of the first, such as a control or feedback loop. Not a process that ends or merely repeats. | New; see [representation-design.md](representation-design.md#choosing-among-the-structured-blocks). |
| `comparison` | Two to six alternatives read across the same two to four named dimensions. Not a table for its own sake, and not a set of variants with one attribute each. | New; see [representation-design.md](representation-design.md#choosing-among-the-structured-blocks). |

- **Not every concept needs every block type, or a body.** A definition plus a
  few paragraphs can be complete. Sparse content is valid
  ([spec §6](../map-spec.md#6-core-architectural-principles)). Add a
  structure only when it carries meaning prose would carry less clearly.
- **Blocks carry meaning and order only.** No markup, styling, or
  instructions to the renderer. Authoring prompts ("why it matters", "trust
  assumptions") may guide what you write but are never rendered as labelled
  sections.
- **Legacy fields.** `summary`, `explanation` and `whyItMatters` render as
  plain paragraphs, and only the Finality fixture uses them. Use `definition`
  plus `body` for new exposition.

## Known debt in the existing corpus

- **Consensus & Ordering repeats Finality.** Its L0 section on Finality
  restates the Finality fixture's definition, summary and why-it-matters
  nearly verbatim. When Finality is authored or revised, resolve the overlap
  deliberately. Do not copy the pattern.
- **Pinned L0 wording.** Many domain tests pin L0 headings and phrases. See
  [`quality-contract.md`](quality-contract.md#tests-for-authored-content) for
  why new content should not follow that pattern.
