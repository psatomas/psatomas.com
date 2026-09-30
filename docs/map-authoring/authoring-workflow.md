# MAP authoring workflow

A deterministic loop for authoring or revising canonical exposition. Follow
the steps in order. Where a step hits a [stop condition](#stop-and-escalate),
stop and report instead of guessing.

## 0. Baseline

- Work on a feature branch created from the current `origin/main`. Never work
  on a stale checkout.
- Start from a clean tree, or leave unrelated changes untouched.
- Content work changes content only. Concepts, placements, labels, preferred
  placements, relationships and the renderer stay as they are.

## 1. Select a bounded target

```bash
npm run map:inspect -- --domain <l0-domain-id>
```

This lists the domain's L1 topics in sibling order with their content status,
how many children already have content, whether the concept is also placed
at other levels, and whether its preferred placement is elsewhere.

- A batch is **one concept**, or **a few consecutive L1 topics of one domain**
  in sibling order. Never a whole domain in one change unless explicitly
  asked.
- Unless told otherwise, author a branch before its children: L1 before its
  L2 children.
- Where `map:inspect` shows `preferred at <placement>` for an L1 topic, the
  concept also lives elsewhere. Read its full context (step 2) before
  including it.
- Where it shows `children also at <placement>`, the concept carries child
  layers in more than one placement. Only the domain containing its
  preferred placement authors it (see
  [several child-carrying placements](content-architecture.md#several-child-carrying-placements)).
  Other domains' batches record it as left to that domain, not as blocked.

## 2. Inspect the canonical concept and its placement context

```bash
npm run map:inspect -- <concept-id>
npm run map:inspect -- <concept-id> --context <placement-id>   # when authoring a specific role
```

The primary context defaults to the preferred placement. When you are
authoring the concept's L1 synthesis role and the Attention list says "the
primary context is a leaf", re-run with `--context` set to the placement that
carries the children.

Read the whole output, in this order:

1. **Concept and canonical content.** Is there existing exposition? If so,
   this is a revision and it changes every placement.
2. **Primary placement and trail.** The containing L0 domain and ancestry.
3. **Parent.** The parent's content status and "Parent exposition around the
   primary context", which is the text you must not restate.
4. **Siblings**, in order. Their scope is not yours.
5. **Children**, in order, with their content status and placement counts.
   Children with content must not be restated. For children without content,
   do not pre-empt their focused explanation.
6. **Other placements.** Each "also served" placement is a context in which
   the same exposition must read correctly, often as a leaf.
7. **Contextual labels and notes, and same-title concepts.**
8. **Relationships, mechanisms and paths.** Use them only if the exposition
   genuinely needs them. They are not rendered today and they do not create
   obligations.
9. **Attention** and **Authoring constraints**.

If the parent section is not located automatically, read the parent in full
with `npm run map:inspect -- <parent-concept-id>`.

When the Attention list reports that children are carried at several
placements, read every facet it lists and the parent section printed for each
carrier. The exposition relates those facets. It synthesizes none of the
layers, and it does not synthesize their union.

## 3. Derive the semantic responsibility

Before writing, state in your working notes, and later in the report:

- the role or roles the concept holds (see
  [content-architecture.md](content-architecture.md)): the synthesis role
  where it carries children, a leaf elsewhere, or focused L2;
- what the parent section already says, and what this exposition adds;
- which children or siblings bound the scope, and what is left to them;
- the model or explanation the exposition will give, in one or two sentences.

If you cannot state these without guessing, [stop](#stop-and-escalate).

## 4. Author the canonical exposition

- Add or edit exactly one record in `mapKnowledge.content`
  ([`data.ts`](../../src/lib/map/data.ts)), following
  `{ id: "<concept-id>-content", conceptId: "<concept-id>", definition, body? }`.
  Place new records after the existing records of the same domain, or at the
  end of the content array.
- Follow [content-architecture.md](content-architecture.md) and the
  editorial criteria in [quality-contract.md](quality-contract.md#b-editorial-and-semantic-review-criteria).
- Write only plain text. Use only block kinds from `types.ts`.

## 5. Register the authored content

For new exposition, add the concept ID to `AUTHORED_CONTENT_CONCEPTS` in
[`src/lib/map/authoring/content-registry.ts`](../../src/lib/map/authoring/content-registry.ts).
The ontology tests treat any content not in that registry as accidental, so
registration is the explicit statement that the exposition was authored on
purpose. Revising already registered exposition needs no new entry
(`map:inspect` shows the concept's registration state). Removing content
removes its registration.

Do not add tests that pin the new wording (see
[quality-contract.md](quality-contract.md#tests-for-authored-content)).

## 6. Run the authoring checks

```bash
node --test src/lib/map/map.test.ts src/lib/map/authoring/context.test.ts
npm run map:inspect -- <concept-id>        # confirm "Canonical content" and the Attention list
```

MAP validation runs inside these tests and whenever the resolver is created.
Fix every reported error in the content. Never weaken a check to make it
pass.

## 7. Regenerate derived explorer data

```bash
npm run map:generate
```

Adding or removing content flips `hasContent` for every placement of the
concept in `src/components/map/explorer-view.generated.json`. A unit test
fails if the committed file is stale. The regenerated diff should change only
those flags, and only for the placements `map:inspect` listed.

## 8. Run the repository gates

```bash
npm test
npm run lint
npm run build
```

`npm run build` also type-checks and prerenders one
`/api/map/content/<concept-id>` document per concept with content.

The browser suite (`npm run test:map:browser`, about 25 minutes; setup in
the [README](../../README.md#development)) is required when a change touches
the explorer or renderer, and before merging the first change that gives a
new role content (for example the first L1 batch), because opening those rows
now loads exposition. For later content-only batches it is optional; run it
when in doubt.

## 9. Report

Report, for each concept:

- concept, primary context, and every placement the exposition serves;
- the responsibility derived in step 3, and what was left to the parent,
  siblings and children;
- the editorial self-review against
  [quality-contract.md §B](quality-contract.md#b-editorial-and-semantic-review-criteria),
  including any doubts;
- exact commands run and their results;
- stop conditions hit and questions left open.

Commit only when authorized, as `feat(map): add <domain> L1 content` or a
similarly scoped semantic message, with one coherent change per commit.

## Stop and escalate

Stop, do not author, and report the question when:

- **Unknown or mismatched target.** `map:inspect` fails.
- **Invalid baseline.** MAP validation or the unit tests already fail before
  your change.
- **Registry inconsistency.** `map:inspect` reports the concept as
  `INCONSISTENT`: it owns content that is not registered, or it is registered
  without content.
- **Meanings diverge across placements.** The concept seems to mean different
  things in different placements, so one exposition cannot serve all of them
  truthfully. This is a taxonomy question: a split or a re-placement is not
  content work. The same applies when several child layers cannot reasonably
  be read as facets of one meaning.
- **Conflict with existing content.** The parent's exposition says something
  your exposition would have to contradict. Parent content is canonical;
  resolving the conflict is a separate decision.
- **Unclear role.** You cannot tell whether the concept should synthesize a
  layer or explain itself. For example, the preferred placement is a leaf
  but the task names an L1 batch, and it is not clear which role is wanted.
- **Same-title ambiguity.** The source material you would draw on fits a
  same-title concept better than this one.
- **Structural change needed.** The content can only be expressed with a new
  block kind, a renderer change, a new concept, a new relationship type, or a
  taxonomy edit.
- **Existing content in scope.** A revision would change fixture content
  (Finality, Agent Identity) that tests pin, or would overlap an L0 section
  that restates it, and the task did not say to resolve that.
- **Uncertain facts.** You are unsure a technical claim is correct. Leave it
  out or flag it; do not state it as fact.
