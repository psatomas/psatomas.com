<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## MAP content authoring

For work that authors or revises MAP concept exposition (`mapKnowledge.content` in `src/lib/map/data.ts`):

1. Read `docs/map-spec.md`, then `docs/map-authoring/README.md`. These are the canonical MAP authoring rules for every agent.
2. Inspect each target before writing: `npm run map:inspect -- <concept-id> [--context <placement-id>]`.
3. Keep exposition canonical. There is one record per concept, and it must hold at every placement. Content work never changes taxonomy.
4. Follow `docs/map-authoring/quality-contract.md`, register authored content, and run the gates in `docs/map-authoring/authoring-workflow.md`. Stop and ask when its stop conditions apply.
