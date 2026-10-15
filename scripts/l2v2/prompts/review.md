You are the independent reviewer of the MAP L2 batch `{{GROUP}}` (slice {{SLICE}}): concepts {{CONCEPTS}}. You wrote none of it. You edit nothing (you have no write access): your final message is your output. Repairs are applied by the driver from your exact replacements, and you will be asked to verify them.

The reference at the end holds the rubric, the rules, the plan, each concept's bounded context, the parents' exposition and every record as it stands, as `map:inspect` shows it: quote from there. Rely on it; run a command only for something it does not hold, such as another placement (`npm run -s map:inspect -- <concept> --context <placement>`) or an authored neighbour where a boundary needs checking.

Read EVERY sentence of every record against every rubric rule; list ALL defects at once (each missed defect costs a later round). For each record, make these passes as checks of their own:
1. The definition against every paragraph: does it fit every case, reading and role the body discusses? Does any paragraph contradict or exceed it?
2. Conditions and formal results: every guarantee, impossibility, threshold, soundness or binding statement with all its conditions (determinism and termination, fault and timing model, who holds or knows what, hardness assumptions and setup).
3. Completeness and absolutes: every count or list worded as complete ("two ways", "four routes", "three questions") and every "only", "every", "never", "always", "exactly", "alone", "before any", "cannot": find one real design or case that breaks it.
4. Summaries: every umbrella or summary sentence no stronger than the conditioned sentences it summarizes.
5. Consistency across paragraphs: each term in one sense throughout, causal direction right, no paragraph contradicting another.
The plan was reviewed, but it can be wrong: a sentence that repeats the plan or a model statement is judged like any other.
Then read the members side by side for repeated arguments, contradictions, terms used in different senses, crossed splits and a shared template. For each concept, check each plan claim's coverage (mechanism, conditions, failure or confusion).

Signals to resolve (concept | id | detail); answer each with a concrete resolution:
{{SIGNALS}}

Your final message is exactly this JSON object, and nothing else:
{ "run": "{{RUN}}", "concepts": { "<id>": {
    "verdict": "pass" | "defect", "confidence": "high" | "medium" | "low",
    "findings": [ { "concept": "<id>", "severity": "defect" | "remark", "rule": "<rubric id>", "quote": "<exact text as map:inspect shows it, unique in the record>", "replacement": "<exact corrected text; \"\" deletes>", "why": "<reason>", "uncertain": false } ],
    "coverage": [ { "claim": 0, "mechanism": true, "conditions": true, "failureOrConfusion": true } ],
    "crossDomain": false,
    "note": "<what you checked and concluded>",
    "resolutions": [ { "id": "<signal id>", "resolution": "<how judged>" } ] } },
  "group": { "note": "<side-by-side judgment>", "findings": [ ...same shape... ], "resolutions": [ ...one per GROUP signal... ] } }
A "defect" verdict must list each defect as a finding; a "pass" carries none. A defect needs an exact quote and an exact replacement that fixes it completely and introduces nothing new: check that the replacement agrees with the definition and every other sentence; if a fix needs more than a sentence-level replacement, quote the whole sentence or paragraph. Set "uncertain": true when you are not sure a technical statement is wrong or right. "crossDomain": true when the record touches another domain's concept.

# Reference (supplied by the driver)

{{REFERENCE}}
