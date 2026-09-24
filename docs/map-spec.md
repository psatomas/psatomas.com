# MAP architecture specification

## 1. Purpose

MAP is PSATomas.com’s independent, interactive technical knowledge
environment for learning and mastering Protocol Engineering: from
distributed-systems foundations through programmable protocols, intelligent
agents, machine economies, and increasingly autonomous digital systems.

MAP is content and structured knowledge. It explains systems, mechanisms,
assumptions, and connections. It does not implement the systems it explains.

This document is the canonical Phase 0 architecture specification. It defines
responsibilities and invariants, not production implementation files,
components, or a populated ontology.

## 2. Product definition

PSATomas.com has four sibling first-class environments:

```text
PSATOMAS.COM
├── MAP       interactive technical knowledge environment
├── SYSTEMS   concrete systems and architecture
├── RESEARCH  long-form technical reasoning
└── LAB       interactive experiments
```

MAP is not an index, wrapper, or dependency layer over Systems, Research, or
Lab. It remains useful and complete if those environments do not exist.

Its learning model is:

> The hierarchy teaches. The graph connects. The content explains. The paths
> guide.

## 3. Non-goals

MAP must not become an AI platform, agent runtime, agent marketplace, payment
network, blockchain, trading system, autonomous DAO product, or
autonomous-economy product. It may explain all of those kinds of systems.

MAP does not require an LLM, RAG, embeddings, vector storage, an agent runtime,
AI APIs, a CMS, a graph database, or a backend service. No such dependency is
justified by Phase 0 or Phase 1.

MAP does not turn every concept into a Research article, duplicate sibling
environment content, or infer semantic graph edges merely from taxonomy
nesting.

## 4. Learning philosophy and center of gravity

MAP should feel like an interactive technical book and learning environment,
not a developer graph debugger or a directory. It should help a reader find a
starting point, understand prerequisites and mechanisms, move to the next
useful concept, and see how a domain connects to another domain.

Protocol Engineering is the intellectual center of gravity. Distributed
systems, computation, state, consensus, networking, cryptography, storage,
identity, authority, oracles, economics, markets, MEV, intents, governance,
scaling, interoperability, security, architecture, and lifecycle must remain
deep. AI, agents, machine economy, and autonomy extend outward from those
foundations. They must ask what protocol infrastructure, mechanisms, trust
models, security properties, economics, and coordination make them possible.

## 5. Long-term knowledge scope

MAP's taxonomy has 27 L0 domains, in this order:

1. Foundations
2. Computation & Execution
3. State & Data
4. Consensus & Ordering
5. Networks & Infrastructure
6. Cryptography & Proofs
7. Storage & Availability
8. Identity, Accounts & Authority
9. Oracles & External Reality
10. Economics & Mechanism Design
11. Markets & Financial Protocols
12. MEV & Execution Markets
13. Intents & Coordination
14. Governance & Institutions
15. Scaling & Modular Systems
16. Interoperability & Abstraction
17. Security, Correctness & Resilience
18. Protocol Architecture
19. Protocol Design & Lifecycle
20. AI & Intelligent Systems
21. Machine Economy
22. Autonomous Coordination
23. Autonomous Execution
24. Autonomous Organizations
25. Autonomous Protocols
26. Autonomous Economy
27. Frontier Systems

These are the root regions of the pedagogical taxonomy and the macro
structure every MAP surface presents, including the homepage preview. They
are taxonomy structure, not a separate ontology primitive: each is a canonical
concept with a root placement, authored like any other record. Until those
root placements exist in the knowledge data, this list is the specification
rather than repository data. Deeper levels are authored incrementally beneath
them.

A concept missing from a domain name is not missing from MAP. Sequencing,
Settlement, Data Availability, Verification, Finality, and Preconfirmations are
canonical concepts that may be placed in several domains without becoming
several concepts.

AI & Intelligent Systems, Machine Economy, and the Autonomous Coordination,
Execution, Organizations, Protocols, and Economy domains are explicit L0
domains. They extend outward from the Protocol Engineering foundations (§4)
and reuse the same canonical concepts. Intelligent and autonomous systems are
also taught where their technical substance lives: Agent Identity under
Identity, Accounts & Authority; Verifiable AI under Cryptography & Proofs;
agent economic mechanisms under Economics & Mechanism Design or Machine
Economy; intents used by agents under Intents & Coordination. Frontier Systems
expresses the integrated frontier and is especially a presentation/taxonomy
concern: it can place existing concepts such as Verifiable AI or
Preconfirmations without creating duplicate identities, and it must not
become a catch-all for AI.

## 6. Core architectural principles

1. Canonical identity is separate from presentation context.
2. Taxonomy and graph relationships are independent structures.
3. Content belongs to canonical concepts, not to every taxonomy appearance.
4. Curated learning paths are independent from both hierarchy and graph edges.
5. Sparse, incomplete knowledge records are valid while the ontology grows.
6. External PSATomas references are optional enrichment, never a core
   prerequisite.
7. Static typed knowledge data is the default until a concrete repository
   requirement disproves it.
8. A rendered view resolves a bounded neighborhood; it must not require the
   entire ontology in the browser.
9. MAP’s data model must remain useful independently of any future AI
   interface.
10. Recursion must never reduce content width.

## 7. Knowledge-model overview

The model has five fundamental domains:

```text
Concepts       What a thing is.
Placements     Where it is taught in a pedagogical hierarchy.
Relationships  How canonical concepts semantically connect.
Content        The concept’s explanatory material and mechanisms.
Paths          Curated sequences for learning/progression.
```

Optional external connections are a separate enrichment layer. A resolver
combines the relevant records into a bounded exploration view. The visible
recursive explorer is a projection of that resolved view, not the source of
truth and not an ontology encoded as nested JSX.

## 8. Canonical concept identity

A Concept answers “what is this thing?” and has exactly one canonical
identity, even when it appears in many contexts. Finality, Sequencing,
Simulation, Execution, Settlement, Identity, Authority, Delegation,
Verification, Markets, Intents, and Agents may all have multiple placements
without becoming multiple concepts.

### Initial identity contract

- Each concept has a stable machine-readable `id` and a stable public `slug`.
- In the initial static model, `id` and `slug` should be identical lowercase,
  hyphenated tokens. This minimizes mapping complexity while the ontology is
  authored in one repository.
- The public canonical URL is derived from the slug, not placement:
  `/map/[conceptId]` where `conceptId` initially equals the slug.
- A concept rename changes display title and content freely. A slug/ID rename
  is a public-URL migration, not a routine editorial edit; it requires an
  explicit alias/redirect decision in a later routing phase.
- Do not introduce a separate opaque ID or general alias table in Phase 1.
  Introduce them only when a real rename/history requirement exists.

Concepts may be orphaned, have no content, have no placements, have many
placements, or have relationships but no placement. These are valid states,
but validation and authoring reports must expose them. A concept with no
placement is not deleted or made invalid merely because it is not yet taught
in the visible taxonomy.

## 9. Taxonomy and placement model

A Placement answers “where is this concept taught/presented?” It is a
pedagogical occurrence, not a second concept and not a copy of canonical
content.

### Minimum useful placement contract

- stable placement ID;
- canonical concept ID;
- nullable parent placement ID;
- deterministic sibling order;
- optional contextual note;
- optional contextual label only when the pedagogical wording genuinely needs
  to differ from the concept title.

Root placements have no parent and are the current broad regions. A child
placement means “teach/present this occurrence within this parent context”; it
does not mean the child concept is a semantic subtype, dependency, or graph
neighbor.

The same concept may have multiple placements under unrelated parents. Every
placement has one parent at most, producing a forest of pedagogical trees;
multiple placement records provide the needed cross-context appearances.

Sibling order is explicit, stable, and deterministic. Placement parent chains
must be acyclic. A direct concept URL resolves a default/preferred placement
when one exists. The default is presentation policy only; it does not make
other placements secondary concept identities.

No canonical description, relationship list, or mechanism is copied into a
placement. A short contextual note may explain why the canonical concept is
being encountered here.

## 10. Relationship graph

Relationships express semantic links between canonical concepts independently
of taxonomy. Taxonomy nesting creates no relationship automatically, and a
relationship creates no placement automatically.

Relationship records use registered relation types, never arbitrary free-form
strings. A type has a stable identity, semantic family, directed meaning,
allowed source/target policy if one is later needed, and a presentation label.
Examples of families include dependency/prerequisite, composition/structure,
mechanism/flow, authority/control, information/proof, economic/market, and
comparison/contrast.

A relationship record contains source concept ID, target concept ID, relation
type ID, and only optional editorial context where it materially clarifies the
edge. Direction is stored as authored. A type may define an inverse
presentation label, allowing the UI to show an incoming edge naturally without
creating a duplicate inverse record.

Duplicate policy: records with the same source, target, and type are
duplicates and invalid unless a later, explicitly designed qualifier makes
them distinct. Self-edges are invalid by default; a specific relation type may
opt in only with a documented semantic reason. Both endpoints and the type
must resolve.

The relationship vocabulary starts small and controlled. Adding a type requires
a documented definition, family, direction/inverse behavior, self-edge policy,
and validation update in the same change. The vocabulary need not be exhaustive
in Phase 0.

## 11. Content model

MAP content is canonical, concise, structured, educational, and
interconnected. It is not a collection of mandatory long-form articles.

A concept may eventually have a title, concise definition, summary,
explanation, why-it-matters, systems role, mechanism, engineering concerns,
trust assumptions, security considerations, economic considerations, diagrams,
and related-concept presentation. Fields are optional except for the minimum
identity needed to render a concept. Sparse content is valid.

Content is owned by the canonical concept. Placements supply context, not
duplicated explanatory bodies. Research remains the sibling environment for
long-form argument and deep reasoning; MAP does not depend on it.

Content must remain data/structured prose, never React component definitions.
Presentation components decide how a definition, section, mechanism, or
diagram is rendered.

## 12. Mechanism and process model

Some concepts explain a process, such as a Transaction Lifecycle, Intent
Execution, or Autonomous Execution. A mechanism is structured explanatory data
owned by its canonical concept (or, if later justified, a separately identified
reusable content object). It contains a title, optional summary/context, and an
ordered sequence of conceptual steps.

Steps should reference canonical concepts when the named step is itself a MAP
concept. A presentational label/note can be added for pedagogical clarity, but
mechanisms must not embed React, CSS, coordinates, animation rules, or Lab
implementation logic. This lets the same mechanism be presented as a static
sequence now and through an interactive visualization later.

Mechanism sequence is explanatory order, not automatically a taxonomy chain,
relationship edge set, prerequisite chain, or knowledge path.

## 13. Knowledge paths and progression

A Knowledge Path is a curated progression sequence, not a taxonomy branch and
not an inferred graph traversal. It references canonical concepts in explicit
order, with a stable ID/slug, title, summary, and at least two steps. Phase 1
paths are linear; branching requires a separate future design rather than an
implicit overloaded step format.

Paths can express “Transaction to Finality,” “From Intelligence to Economic
Agency,” or “From Agent to Machine Commerce” without copying the same
progression fact into concepts, placements, and relationships. A path may be
informed by prerequisites, but a path step does not itself assert a global
prerequisite relation.

## 14. URL and context policy

MAP uses these canonical public routes:

```text
/map
/map/[conceptId]
```

`/map/[conceptId]` identifies one canonical concept and is the sole canonical
URL for that concept. For example, Finality is `/map/finality`, not separate
canonical pages under Consensus, Settlement, and Rollups.

Pathname owns canonical concept identity. Optional URL context identifies the
active placement used to enter or present that concept. The preferred initial
contract is a validated query parameter such as `?context=[placementId]`:

- it preserves a shareable pedagogical context without multiplying canonical
  concept routes;
- a direct URL with no context resolves the concept’s preferred placement;
- an invalid or unrelated context is ignored/replaced by the preferred context,
  while an unknown concept remains a 404;
- canonical metadata always points to `/map/[conceptId]`, without the query.

Explorer navigation that materially changes the selected concept or context
updates the URL, so refresh and browser back/forward reconstruct the meaningful
view. Purely local disclosure state need not enter the URL unless it later
proves necessary for sharing a specific expanded view.

## 15. Explorer interaction model and full-width recursion invariant

The taxonomy is a recursively expandable explorer with no fixed maximum depth.
It communicates hierarchy through breadcrumb/path, active context, current
concept identity, labels, disclosure state, and transitions.

Absolute invariant: recursion never reduces content width. Every depth retains
the same explorer left and right boundaries. MAP must never use cumulative
depth-derived margin-left, padding-left, narrower nested cards, progressively
narrower containers, or horizontal tree indentation to communicate depth.

Each explorer row and expanded child region must use the parent explorer’s full
available width. Any visual treatment for depth must be non-geometric: context,
labels, borders/seams, disclosure affordance, or transition. This is a required
future browser/layout test, including arbitrary depth and no horizontal
overflow.

The explorer is not a graph canvas. Relationship traversal is presented as a
separate conceptual action from hierarchical expansion.

### Disclosure, context, and concept navigation

Three reader intentions stay separate:

- **Disclosure** shows or hides one placement's children. Many placements may
  be expanded at once, so distant parts of the taxonomy can be compared. It
  never changes context, navigates, or closes unrelated branches.
- **Context** is the focused placement: zero or one, changed only by an
  explicit focus action, never inferred from expansion. Its ancestry is shown
  as a context trail (for example `Distributed Systems › Consensus ›
  Finality`) derived from placement ancestry, not from display strings and
  not from Knowledge Paths. Ancestors in the trail re-focus their placement.
- **Concept navigation** opens the canonical concept (`/map/[conceptId]`,
  optionally with `?context=[placementId]`). It is not offered until concept
  routes exist; the explorer never presents unavailable navigation.

Root placements render as structural regions: a graphite region identity
plane, connected rows within the region, and whitespace between regions.
Visual meanings remain distinct: graphite marks structural region identity, a
restrained accent marks the current context, and the disclosure control marks
expanded/collapsed state. Depth is not shown with engineering markers; it is
conveyed through context (region, parent label, context trail) and exposed to
assistive technology.

## 16. Page anatomy

The exact visual order is deferred, but a MAP view has these responsibilities:

1. environment/context identity;
2. breadcrumb/current taxonomy context;
3. recursive explorer for the currently bounded hierarchy region;
4. current canonical concept identity and explanation;
5. structured mechanism/content when present;
6. relationship summaries and traversal opportunities;
7. relevant learning-path or next-context guidance.

The repository’s `max-w-6xl` environment geometry and connected border/seam
language are useful visual foundations. The existing narrow `Container`
primitive is appropriate for prose pages but not the explorer’s full-width
surface. Existing `SystemVisualization` and `SequencePipeline` demonstrate
seams and reduced-motion behavior, but are finite visualizations rather than
recursive explorer primitives.

## 17. Server, client, and state responsibilities

The future environment must not be one giant stateful component.

Server/build resolver responsibilities:

- canonical knowledge records;
- concept and placement resolution;
- preferred-context selection;
- ancestor breadcrumb resolution;
- immediate-child resolution;
- bounded relationship/path summaries;
- validation and route-level missing-concept behavior.

Client responsibilities:

- disclosure state;
- local exploration transitions;
- semantic interactive controls;
- applying URL-driven selection/context changes to the explorer;
- no ownership of the complete canonical ontology.

URL responsibilities:

- canonical concept identity;
- shareable placement context when required;
- history entries for meaningful navigation.

Likely presentation responsibilities divide among an environment shell,
explorer, breadcrumb, node row, concept presentation, relationship
presentation, and knowledge-path presentation. These are responsibilities, not
approved filenames or implementation commitments.

## 18. Performance and scaling boundary

The ontology may grow from hundreds to thousands of concepts, placements, and
edges. The architecture is:

```text
Static typed knowledge model
          ↓
Server/build resolver
          ↓
Bounded view model
          ↓
Client explorer
```

A rendered view generally needs the current concept, current placement,
ancestor path, immediate children, relevant relationship summaries, relevant
path information, and required content. It must not render the full ontology
into the DOM or require the full graph in the client bundle simply because it
exists.

Phase 1 can remain static TypeScript data and pure resolver/validation logic.
Later loading, indexing, or bundling tactics must be selected from measured
constraints, not added prematurely.

## 19. Accessibility

Future explorer work requires semantic disclosure controls, keyboard operation,
`aria-expanded`, logical focus movement, breadcrumb semantics, announced
hierarchy/context, reduced-motion support, and no meaning communicated only by
color or animation. Full-width recursion must remain compatible with semantic
hierarchy; visual non-indentation is not a reason to flatten accessibility
semantics.

Existing repository animation patterns check `prefers-reduced-motion`; MAP
transitions must follow the same principle.

## 20. Optional PSATomas enrichment

Connections to sibling environments are optional supplementary references.
For example, a canonical Intent concept may later link to ExeKPro or the Intent
× MEV Lab experiment, while Oracle may link to the Oracle Lab experiment.

These references are an adapter/enrichment layer, not a fundamental
knowledge-model pillar. MAP concepts, content, taxonomy, paths, and validity
must not depend on their existence. Removing a System, Research article, or Lab
experiment must never invalidate a MAP concept.

When implemented, external target contracts should use each sibling’s existing
public identity: Systems `slug`, published Research `slug`, and Lab
`ExperimentId`. The enrichment layer resolves those sources without copying
their metadata or content into MAP.

## 21. Metadata, social, and sitemap strategy

MAP will later extend the existing centralized social metadata infrastructure,
not create a parallel system. It needs a static `/map` descriptor, a
concept-to-social descriptor adapter, route-specific OG image resolution,
missing-concept metadata that clears canonical/image identity, and sitemap
entries derived from the canonical concept registry.

The current social resolver supports one- and two-segment public paths, which
fits `/map` and `/map/[conceptId]`. The context query is not canonical and must
not alter social identity. Metadata/social/sitemap work remains Phase 13, after
routes and concepts exist.

## 22. Validation invariants

Phase 1 includes pure domain validation from the beginning.

### Concepts

- IDs and public slugs are unique and valid lowercase hyphenated tokens.
- A canonical identity resolves consistently.
- ID/slug equality is enforced while that initial policy remains in force.

### Placements

- Placement IDs are unique.
- Every concept and parent reference resolves.
- Root/parent semantics are valid.
- Sibling ordering is deterministic and unambiguous.
- Parent chains are acyclic.
- Multiple placements of one concept are valid.
- Preferred placement, if declared, resolves to that concept.

### Relationships

- Source and target concepts resolve.
- Relation type is registered.
- Direction/inverse rules are valid.
- Duplicate source/target/type edges are rejected unless an explicitly
  designed qualifier policy later permits them.
- Self-edges are rejected unless their registered type explicitly allows them.

### Content and mechanisms

- Canonical content references one valid concept.
- Sparse content is valid.
- Placements do not silently duplicate canonical content.
- Mechanism step references resolve when represented as concepts.
- Domain records contain no UI/component definitions.

### Paths

- IDs are unique and valid.
- Every step resolves to a canonical concept.
- Order is deterministic.
- Paths have at least two steps.

Orphan concepts, unplaced concepts, concepts without content, and
relationship-only concepts remain valid records. They should be reported for
editorial review rather than rejected structurally.

## 23. Testing strategy

Phase 1: pure Node/domain tests for all validation invariants and resolver
behavior.

Explorer phase: component tests for disclosure, breadcrumb/context behavior,
concept/placement resolution, relationship traversal, and URL reconstruction.

Hardening phase: browser-level tests for arbitrary hierarchy depth, equal
left/right explorer boundaries at every depth, zero depth-derived width shrink,
no horizontal overflow, direct canonical URLs, context reconstruction,
refresh, browser back/forward, multiple placements, cross-branch traversal,
keyboard disclosure, reduced motion, metadata, and missing concepts.

No browser-test dependency is installed in Phase 0. Add one only when the
explorer implementation reaches the browser-level assertions that Node tests
cannot prove.

## 24. AI as knowledge and future AI-interface readiness

AI and intelligent systems are knowledge regions inside MAP: models,
inference, reasoning, planning, uncertainty, goals, memory, tools, actions,
coordination, communication, discovery, policy enforcement, simulation,
sandboxing, human approval, auditability, verifiable inference, zkML, TEEs,
proofs of computation, and verifiable agents.

Machine economy and autonomous systems are also knowledge scope: economic
agents, identity, wallets, capital, budgets, permissions, reputation, credit,
risk, incentives, machine payments, commerce, agent markets, autonomous
coordination, execution, organizations, protocols, economies, and human ↔
machine economic systems. They are not implementation dependencies or product
scope.

The structured model should eventually support operations conceptually like
`getConcept`, `getPlacements`, `getChildren`, `getRelations`,
`getPrerequisites`, `getPaths`, `getNeighborhood`, and `trace`. This prepares
future AI-assisted explanation or traversal without making the ontology depend
on AI or adding AI infrastructure now.

## 25. Implementation phases

0. Canonical architecture specification.
1. Knowledge-model foundation and validation.
2. Homepage MAP introduction.
3. `/map` environment shell.
4. Recursive explorer primitives.
5. Concept presentation.
6. Relationship presentation.
7. Knowledge paths.
8. Explorer/navigation engine.
9. Populate Protocol Engineering.
10. Optional cross-environment enrichment, if useful.
11. Expand into AI, agents, machine economy, autonomy, and frontier systems.
12. Structured traversal / AI-readiness.
13. Metadata, social previews, and sitemap.
14. Accessibility, responsive, and performance hardening.
15. Final acceptance audit.
16. Production deployment.

This sequence is retained. Phase 1 explicitly includes validation as a
foundation prerequisite. Browser history and geometry verification remain later
because the relevant UI does not yet exist.

## 26. Git and release strategy

MAP remains undeployed until final acceptance. Phase work is reviewed in small,
controlled changes. This specification does not authorize a branch, worktree,
commit, push, dependency installation, deployment, or production MAP code.

## 27. Architectural risks

- Treating placements as concepts would duplicate identity and make cross-domain
  learning inconsistent.
- Treating taxonomy as graph semantics would produce false relationships.
- Treating graph edges as hierarchy would make pedagogy unstable and cluttered.
- Hardcoding records into JSX would make content review and validation poor.
- Importing the complete ontology into a client explorer would create bundle and
  DOM scaling failures.
- Using nested-width visual recursion would violate MAP’s core interaction
  invariant.
- Making sibling-environment links mandatory would make MAP incomplete and
  fragile.
- Turning broad AI/autonomy scope into generic encyclopedia coverage would lose
  Protocol Engineering’s center of gravity.

## 28. Explicitly deferred decisions

- Exact initial concept set, content corpus, and populated taxonomy tree.
- Exact relation-type vocabulary and any source/target constraints per type.
- Exact placement query key and invalid-context UI behavior.
- Whether preferred placement is a concept field or resolver-derived policy.
- Exact static data file layout and TypeScript interfaces.
- Exact presentation order, visual design, and animation design.
- Browser E2E tooling choice.
- Slug rename alias/redirect mechanism, until a real rename occurs.
- Whether reusable mechanisms later deserve independent IDs.
- Any database, CMS, search, graph, vector, or AI infrastructure.

## 29. Review answers

1. **Can one concept safely appear in many taxonomy locations?** Yes. One
   canonical Concept may have many Placement records.
2. **Can MAP grow to thousands of concepts without redesigning identity?** Yes.
   Stable canonical IDs/slugs are independent of placement count.
3. **Can taxonomy evolve without breaking canonical concept URLs?** Yes. URLs
   identify concepts, not taxonomy paths.
4. **Can relationships evolve without restructuring taxonomy?** Yes. The graph
   is independently typed and stored.
5. **Can AI/agent/economic domains reuse foundations?** Yes. They reference the
   same Concepts and add contextual Placements/Relationships where useful.
6. **Can Frontier reuse concepts presented elsewhere?** Yes. It is a placement
   concern, not a duplicate identity category.
7. **Can a concept exist without Systems/Research/Lab content?** Yes. MAP is
   independently complete.
8. **Can MAP remain useful without external PSATomas references?** Yes.
   Connections are optional enrichment.
9. **Can the browser render bounded context rather than the entire graph?**
   Yes. The resolver/client boundary makes that the required architecture.
10. **Can future AI reason over the model without the model depending on AI?**
    Yes. Structured canonical records and resolvers precede any AI interface.
11. **Can content expand without radically expanding implementation
    complexity?** Yes. Static typed records, validation, and bounded resolvers
    keep data growth separate from UI architecture.
12. **Does the model preserve the 27-domain breadth without making those
    domains a separate primitive?** Yes. The 27 L0 domains are canonical
    concepts with root placements, so they use the same identity, placement,
    and validation model as every other concept.
