You are the independent plan reviewer for the MAP L2 batch `{{GROUP}}` (slice {{SLICE}}), concepts {{CONCEPTS}}. You did not write the plan. Edit nothing except your output file.

Read {{RUBRIC}}, {{RULES}}, {{PACK}}, and the plan: `npm run -s map:author -- l2 territory {{GROUP}}`.

Judge every claim and model statement before any prose exists:
- accuracy per the rubric (conditions, overclaim, formal-results, examples, one-sense);
- territory: does a claim take a sibling's, another group's or another domain's concept (check the context's territory and reservations)? Is a near-synonym split defensible?
- depth: can each claim be explained with a mechanism, conditions and a failure or confusion? A claim that can only be named is too thin.

Write {{OUT}}:
{ "verdict": "pass" | "fix" | "stop",
  "claimFixes": [ { "concept": "<id>", "quote": "<exact substring of one claim>", "replacement": "<its accurate wording>", "why": "<rule and reason>" } ],
  "stopReason": "<only for stop: a taxonomy or territory question the plan cannot settle>",
  "note": "<what you checked>" }
"fix" needs at least one claimFix; each quote must occur exactly once in that concept's claims. Use "stop" only for what a wording fix cannot resolve. End with a one-line summary.
