# L2 record and plan rules (v2 digest)

Canonical sources (read a section only if this digest leaves a question open): docs/map-authoring/l2-authoring.md,
src/lib/map/authoring/l2/contracts.ts, src/lib/map/types.ts, src/lib/map/validation.ts (`contentBlockShapeProblems`).

## Group file (src/lib/map/authoring/l2/groups/<group>.json)
- Keep `basis` and the member order the skeleton has. Owned members: `claims` (2–4; each a question only this
  concept answers, worded accurately, with conditions) and `excludes` (existing concept ids it may name, never explain).
  Owned-elsewhere members: `reserved` (claims held for the owner). `splits`: one entry per hazard pair listed.
- `concepts.<id> = { model, design }`. model: `meaning` (one sentence), `kind` (mechanism, property, actor, attack,
  failure, parameter, artifact, technology, institutional), `parents` (what it adds beyond each parent), `claims` and
  `excludes` exactly the plan's, `placements` (why one text holds at each), `fields` (at least two of the kind's fields;
  contracts.ts lists them). design: `decision` "prose" (+ `whyProse`) or "structure" (`structures`: each `{structure,
  purpose, whyNotProse}`, plus `division`), and `relationship`, `level`, `territory`, `placements`.
- A structure only where it shows what prose would obscure: comparison (alternatives on shared dimensions),
  distinction (a real conflation), flow (order matters), cycle, state (persistent states with returns), tensions.
- Validate with exactly `npm run -s map:author -- l2 check --group <group>`.

## Record (drafted as JSON; the driver renders it into src/lib/map/data.ts and the registry)
- `{ "conceptId": "<concept>", "definition": "...", "body": [ ...blocks ] }` in the draft's staging file, exactly
  these fields; every value a plain JSON string. No session writes data.ts, the registry or any TypeScript.
- Blocks: `{ "kind": "paragraph", "text" }`; structured blocks exactly the designed kinds (an interaction structure is a
  `flow`); shapes per validation.ts (comparison: label, 2–4 dimensions, 2–6 alternatives `{name, values}`; distinction:
  `{ "kind": "distinction", left, right, further? }`; others per types.ts). Unknown kinds or fields are refused.
- The definition states the meaning; the body never repeats it. One canonical text true at every placement.
- Plain text, American English, no markdown, no line breaks, words rather than symbols.
- The driver validates the staging file, renders the records and runs `l2 check` and the map tests; it reports any
  problem back to the draft session.

## Commands sessions may run (everything else is denied)
`npm run -s map:author -- l2 context <concept>`, `npm run -s map:author -- l2 territory <group>`,
`npm run -s map:author -- l2 signals <concept>`, `npm run -s map:author -- l2 group-signals <group>`,
`npm run -s map:inspect -- <concept> [--context <placement>]`; the plan session also
`npm run -s map:author -- l2 check --group <group>`. Reads are limited to src/, docs/, these prompts and the batch's
own directory; local secrets are never read.

## Never
Edit other groups' files, other records, taxonomy, tests, tooling, docs, data.ts, the registry or any source file. Read data.ts wholesale (use
`npm run -s map:inspect -- <concept>`). Commit, push, switch branches.
