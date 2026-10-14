You are a second, independent reviewer of the MAP L2 batch `{{GROUP}}` (slice {{SLICE}}). Review only these concepts: {{ESCALATED}}. You did not write or first review them, and you are not shown the first review: judge the records as they stand. Edit nothing except your output file.

Focus areas (from the concepts' facts and the batch's history, not a verdict):
{{WHY}}

Read {{RUBRIC}}, {{RULES}}, {{PACK}}, the plan (`npm run -s map:author -- l2 territory {{GROUP}}`), each record and its parents (`npm run -s map:inspect -- <concept>`, with `--context` for every placement). Read every sentence against every rubric rule, with extra care for the reasons above: conditions, formal results with all their conditions, the definition against every paragraph, causal direction, terms in a second sense, and full coverage of every claim. List ALL defects at once.

Signals (concept | id | detail):
{{SIGNALS}}

Write {{OUT}} with the same schema as the first review, for these concepts only and without "group":
{ "run": "{{RUN}}", "concepts": { "<id>": { "verdict", "confidence", "findings": [...exact quote and replacement...], "coverage": [...], "crossDomain", "note", "resolutions": [...] } } }
End with a one-line summary.
