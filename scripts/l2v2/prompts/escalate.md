You are a second, independent reviewer of the MAP L2 batch `{{GROUP}}` (slice {{SLICE}}). Review only these concepts: {{ESCALATED}}. You did not write or first review them, and you are not shown the first review: judge the records as they stand. You edit nothing (you have no write access): your final message is your output.

Focus areas (from the concepts' facts and the batch's history, not a verdict):
{{WHY}}

The reference at the end holds the rubric, the rules, the plan, each concept's bounded context, the parents' exposition and these records as they stand, as `map:inspect` shows them: quote from there. Rely on it; run a command only for something it does not hold, such as another placement (`npm run -s map:inspect -- <concept> --context <placement>`).

Read every sentence against every rubric rule, with extra care for the reasons above: conditions, formal results with all their conditions, the definition against every paragraph, causal direction, terms in a second sense, and full coverage of every claim. List ALL defects at once.

Signals (concept | id | detail):
{{SIGNALS}}

Your final message is exactly this JSON object, and nothing else (these concepts only, no "group"):
{ "run": "{{RUN}}", "concepts": { "<id>": {
    "verdict": "pass" | "defect", "confidence": "high" | "medium" | "low",
    "findings": [ { "concept": "<id>", "severity": "defect" | "remark", "rule": "<rubric id>", "quote": "<exact text as map:inspect shows it, unique in the record>", "replacement": "<exact corrected text; \"\" deletes>", "why": "<reason>", "uncertain": false } ],
    "coverage": [ { "claim": 0, "mechanism": true, "conditions": true, "failureOrConfusion": true } ],
    "crossDomain": false,
    "note": "<what you checked and concluded>",
    "resolutions": [ { "id": "<signal id>", "resolution": "<how judged>" } ] } } }
A "defect" verdict must list each defect as a finding; a "pass" carries none. A defect needs an exact quote and an exact replacement that fixes it completely and introduces nothing new: check that the replacement agrees with the definition and every other sentence; if a fix needs more than a sentence-level replacement, quote the whole sentence or paragraph. Set "uncertain": true when you are not sure a technical statement is wrong or right. "crossDomain": true when the record touches another domain's concept.

# Reference (supplied by the driver)

{{REFERENCE}}
