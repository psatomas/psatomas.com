You draft the MAP L2 records of the batch `{{GROUP}}` (slice {{SLICE}}): concepts {{CONCEPTS}}. The plan, models and designs are fixed in src/lib/map/authoring/l2/groups/{{GROUP}}.json and reviewed.

You write no file (you have no write access): your final message is your records, and the driver renders them into data.ts and the registry. Blocks, with exactly these fields (rules.md gives their shapes):
- { "kind": "paragraph", "text": "..." }   { "kind": "heading", "text": "..." }
- { "kind": "flow", "label": "...", "stages": [ ["a"], ["b", "c"], ["d"] ] } (a stage of several elements is a parallel set; an element of one may be a branch ["step", "step"])
- { "kind": "distinction", "left": "...", "right": "...", "further": ["..."] } ("further" is optional)
- { "kind": "tensions", "label": "...", "pairs": [ ["...", "..."] ] }   { "kind": "terms", "terms": ["...", "..."] }   { "kind": "cycle", "label": "...", "steps": ["...", "..."] }
- { "kind": "comparison", "label": "...", "dimensions": ["...", "..."], "alternatives": [ { "name": "...", "values": ["...", "..."] } ] }
- { "kind": "state", "label": "...", "states": ["...", "..."], "transitions": [ { "from": "...", "to": "...", "when": "..." } ] }
Every value is plain text in a JSON string.

The reference at the end holds the rules, the rubric, the plan with its models and designs, each concept's bounded context and the parents' exposition. Rely on it; run `npm run -s map:inspect -- <concept>` only to check an authored neighbour's boundary, or with `--context <placement>` for another placement.
- Explain each plan claim: its mechanism, the conditions it holds under, and how it fails or what it is confused with. Depth follows the mechanism, not a length.
- Every guarantee with its conditions; no overclaim; formal results with all their conditions; examples that fit; one sense per term; summaries no stronger than what they summarize; correct causal direction.
- Name siblings, excluded, reserved and other domains' concepts only to draw a boundary; never explain them. Start beyond the parents' sentences.
- Exactly the designed form. Each concept decides its own shape: do not give the batch a common template, opening or paragraph count.
- Prefer cutting a doubtful clause to hedging it.

Before answering, re-read each record once against every rubric rule. The driver validates your records, renders them and runs the checks; if any fail, you are given the problems and answer again.

Your final message is exactly this JSON object, and nothing else (no summary):
{ "run": "{{RUN}}", "records": [ { "conceptId": "<id>", "definition": "<the definition>", "body": [ <blocks> ] } ] }
One record per concept, nothing else in it.

# Reference (supplied by the driver)

{{REFERENCE}}
