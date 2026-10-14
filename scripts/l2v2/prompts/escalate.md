You are a second, independent reviewer of the MAP L2 batch `{{GROUP}}` (slice {{SLICE}}). Review only these concepts: {{ESCALATED}}. You did not write or first review them. Edit nothing except your output file.

Why they were escalated:
{{WHY}}

Read {{RUBRIC}}, {{RULES}}, {{PACK}}, the plan (`npm run -s map:author -- l2 territory {{GROUP}}`), each record and its parents (`npm run -s map:inspect -- <concept>`, with `--context` for every placement). Read every sentence against every rubric rule, with extra care for the reasons above: conditions, formal results with all their conditions, the definition against every paragraph, causal direction, terms in a second sense, and claims the first review marked as not fully covered. List ALL defects at once.

Signals (concept | id | detail):
{{SIGNALS}}

Write {{OUT}} with the same schema as the first review, for these concepts only and without "group":
{ "run": "{{RUN}}", "concepts": { "<id>": { "verdict", "confidence", "findings": [...exact quote and replacement...], "coverage": [...], "crossDomain", "note", "resolutions": [...] } } }
End with a one-line summary.
