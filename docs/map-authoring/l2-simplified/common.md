# Common rules for every agent of a simplified-pipeline L2 slice

You work on the MAP knowledge model of the repository at the path your task names (a Next.js site; MAP is static
typed data). You are one step of a governed L2 slice run (`npm run map:author -- l2 ...`) under the simplified
pipeline, version 1 (docs/map-authoring/l2-simplified/README.md). The orchestrator, not you, records steps, runs
gates, commits, pushes, opens PRs and merges. WORK below means the directory your task names for findings and
audit files.

## Ground rules
- Work in the repository on the current branch. Never switch branches, commit, push, stash, reset or merge. Never deploy.
- Edit only the files your step names. Never edit taxonomy (concepts, placements, relationships, mechanisms,
  paths), tests, tooling, docs, other records, or other groups' files. Never weaken a check.
- Do not run `npm run lint` on the whole tree, the build, or the browser suites.
- American English everywhere (behavior, modeled, favor, defense, -ize, analyze, honor, center).
- Reports back are brief and factual. Do not paste records or whole files into your report.

## Repository contracts (read the sections your step names)
- docs/map-authoring/l2-authoring.md: territory plans, context, signals, drift, Depth, Territory precedents, repairs,
  pipeline modes.
- docs/map-authoring/content-architecture.md: the L2 role; one canonical exposition at every placement; block table.
- docs/map-authoring/quality-contract.md: A (mechanical) and B (12 editorial criteria).
- docs/map-authoring/representation-design.md: structures, where each fits, choosing among blocks.
- src/lib/map/types.ts and src/lib/map/validation.ts (`contentBlockShapeProblems`): block shapes.

## Commands
- `npm run map:author -- l2 status`: the run's state, its pipeline and routing.
- `npm run map:author -- l2 territory <group>`: a group's plan.
- `npm run map:author -- l2 check --group <group>`: validate a plan and its concept work at their stage.
- `npm run map:author -- l2 context <concept-id>`: one concept's bounded context.
- `npm run map:inspect -- <concept-id> [--context <placement-id>]`: a record and its parents' exposition.
- `npm run map:author -- l2 signals <concept-id>` and `npm run map:author -- l2 group-signals <group>`.
Never read src/lib/map/data.ts wholesale (it is large); use map:inspect.

## Lessons that bind every step
- Findings are blocking or advisory (l2-authoring.md, "Finding severity"). Only blocking findings fail an audit or
  open a repair. Doubt about a material technical claim is blocking.
- Repairs introduce new errors; every change is re-reviewed in fresh context. Repairs that widen a record's scope
  introduced most repair defects in the 2026-10 benchmark: fix what was found, at its scope.
- Reference vs explanation: naming another concept to draw a boundary or say what this one works on is fine;
  explaining it (even by paraphrase without its name) is leakage.
- Overclaims are the commonest defect: "any", "every", "always", "never", "only", "the one", "usually",
  "unlike X", "differ only in", "guaranteed", "proves", "cannot". Use them only where they hold for every case;
  otherwise "can", "many designs", "often", or state the condition.
- Scope every general statement to the designs it holds for. A sentence true of one implementation (Ethereum, say)
  is stated for that implementation, or narrowed until it holds everywhere it claims to.
- Examples must fit the category they illustrate. One term, one sense. A summary or lead sentence must not
  contradict the conditioned sentences it summarizes. Impossibility and threshold results need all their conditions.
- Do not restate a parent's sentences or a sibling's argument. Do not imitate neighbouring records' form.
- Judgment problems are judged, not regexed. Depth follows the claims; there is no word target or cap.
