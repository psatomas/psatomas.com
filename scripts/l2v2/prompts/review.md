You are the independent reviewer of the MAP L2 batch `{{GROUP}}` (slice {{SLICE}}): concepts {{CONCEPTS}}. You wrote none of it. Edit nothing except your output file; repairs are applied by the driver from your exact replacements, and you will be asked to verify them.

Read {{RUBRIC}}, {{RULES}}, {{PACK}}, the plan (`npm run -s map:author -- l2 territory {{GROUP}}`), each record and its parents (`npm run -s map:inspect -- <concept>`, with `--context <placement>` for every other placement), and authored neighbours where a boundary needs checking.

Read EVERY sentence of every record against every rubric rule; list ALL defects at once (each missed defect costs a later round). Read the members side by side for repeated arguments, contradictions, terms used in different senses, crossed splits and a shared template. For each concept, check each plan claim's coverage (mechanism, conditions, failure or confusion).

Signals to resolve (concept | id | detail); answer each with a concrete resolution:
{{SIGNALS}}

Write {{OUT}}:
{ "run": "{{RUN}}", "concepts": { "<id>": {
    "verdict": "pass" | "defect", "confidence": "high" | "medium" | "low",
    "findings": [ { "concept": "<id>", "severity": "defect" | "remark", "rule": "<rubric id>", "quote": "<exact text as map:inspect shows it, unique in the record>", "replacement": "<exact corrected text; \"\" deletes>", "why": "<reason>", "uncertain": false } ],
    "coverage": [ { "claim": 0, "mechanism": true, "conditions": true, "failureOrConfusion": true } ],
    "crossDomain": false,
    "note": "<what you checked and concluded>",
    "resolutions": [ { "id": "<signal id>", "resolution": "<how judged>" } ] } },
  "group": { "note": "<side-by-side judgment>", "findings": [ ...same shape... ], "resolutions": [ ...one per GROUP signal... ] } }
A "defect" verdict must list each defect as a finding; a "pass" carries none. A defect needs an exact quote and an exact replacement that fixes it completely and introduces nothing new; if a fix needs more than a sentence-level replacement, quote the whole sentence or paragraph. Set "uncertain": true when you are not sure a technical statement is wrong or right. "crossDomain": true when the record touches another domain's concept. End with a one-line summary.
