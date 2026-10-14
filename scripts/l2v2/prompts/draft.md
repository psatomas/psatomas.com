You draft the MAP L2 records of the batch `{{GROUP}}` (slice {{SLICE}}): concepts {{CONCEPTS}}. The plan, models and designs are fixed in src/lib/map/authoring/l2/groups/{{GROUP}}.json and reviewed.

Write {{OUT}}, the only file you may write. You never edit data.ts, the registry or any source file: the driver renders your records into them.
{ "run": "{{RUN}}", "records": [ { "conceptId": "<id>", "definition": "<the definition>", "body": [ <blocks> ] } ] }
One record per concept, nothing else in the file. Blocks, with exactly these fields (rules.md gives their shapes):
- { "kind": "paragraph", "text": "..." }   { "kind": "heading", "text": "..." }
- { "kind": "flow", "label": "...", "stages": [ ["a"], ["b", "c"], ["d"] ] } (a stage of several elements is a parallel set; an element of one may be a branch ["step", "step"])
- { "kind": "distinction", "left": "...", "right": "...", "further": ["..."] } ("further" is optional)
- { "kind": "tensions", "label": "...", "pairs": [ ["...", "..."] ] }   { "kind": "terms", "terms": ["...", "..."] }   { "kind": "cycle", "label": "...", "steps": ["...", "..."] }
- { "kind": "comparison", "label": "...", "dimensions": ["...", "..."], "alternatives": [ { "name": "...", "values": ["...", "..."] } ] }
- { "kind": "state", "label": "...", "states": ["...", "..."], "transitions": [ { "from": "...", "to": "...", "when": "..." } ] }
Every value is plain text in a JSON string.

Read {{RULES}}, {{RUBRIC}}, {{PACK}}, the group file, and each concept's parents (`npm run -s map:inspect -- <concept>`; add `--context <placement>` for other placements). Read an authored neighbour only to check a boundary.
- Explain each plan claim: its mechanism, the conditions it holds under, and how it fails or what it is confused with. Depth follows the mechanism, not a length.
- Every guarantee with its conditions; no overclaim; formal results with all their conditions; examples that fit; one sense per term; summaries no stronger than what they summarize; correct causal direction.
- Name siblings, excluded, reserved and other domains' concepts only to draw a boundary; never explain them. Start beyond the parents' sentences.
- Exactly the designed form. Each concept decides its own shape: do not give the batch a common template, opening or paragraph count.
- Prefer cutting a doubtful clause to hedging it.

Before finishing, re-read each record once against every rubric rule. The driver validates the file, renders the records and runs the checks; if any fail, you are given the problems to fix in this file. End with one line per concept: word count and block kinds.
