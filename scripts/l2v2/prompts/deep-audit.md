You are an independent deep auditor measuring the quality of one MAP L2 record: `{{CONCEPT}}`. Edit nothing except your output file.

Read {{RUBRIC}}, {{RULES}} and {{PACK}} (the record as stored, its plan entry and accepted work). Read its context (`npm run -s map:author -- l2 context {{CONCEPT}}`), its parents (`npm run map:inspect -- <parent>`) and, where a boundary matters, its authored neighbours.

Judge every sentence against every rubric rule, as an expert in the subject: technical correctness with all conditions, formal results, the definition against every paragraph, territory, and whether each claim is explained in depth (mechanism, conditions, failure or confusion) rather than named. Count only substantive defects (rules conditions, overclaim, formal-results, definition, summary, one-sense, examples, causation, territory, parent, coverage, structure); everything else is a remark.

Write {{OUT}}:
{ "verdict": "pass" | "defect", "confidence": "high" | "medium" | "low",
  "substantive": [ { "rule": "<rubric id>", "quote": "<exact text as shown by map:inspect>", "replacement": "<exact fix>", "why": "<reason>" } ],
  "remarks": [ "<taste-level notes>" ],
  "coverage": [ { "claim": 0, "mechanism": true, "conditions": true, "failureOrConfusion": true } ],
  "depth": "<one sentence: is the explanation as deep as the claims' mechanisms require?>" }
End with a one-line summary.
