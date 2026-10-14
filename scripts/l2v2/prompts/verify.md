The driver applied your repairs to the batch `{{GROUP}}`. Results:
{{REPORT}}

Verify concepts {{REVIEWED}} as they now stand (`npm run -s map:inspect -- <concept>`). Answer EVERY defect id listed above:
- "fixed": the applied repair fixes it completely (an unapplied repair can never be fixed);
- "withdrawn": it was not a defect after all, with the reason;
- "open": it is still a defect; then add a corrected finding (exact quote occurring once, exact replacement), which replaces it.
Also:
- re-read the changed sentence, its paragraph, and EVERY sentence of the record that uses a term the repair narrowed or redefined, for new overclaims, lost conditions, second senses and contradictions;
- report any new defect as a finding.

Signals as they now stand (concept | id | detail); give a resolution for every signal of each concept:
{{SIGNALS}}

Write {{OUT}}:
{ "run": "{{RUN}}", "concepts": { "<id>": { "verdict": "pass" | "defect",
  "defects": [ { "id": "<defect id>", "status": "fixed" | "withdrawn" | "open", "why": "<reason>" } ],
  "findings": [ ...same finding shape as before, for corrected or new defects only... ],
  "note": "<what you verified>", "resolutions": [ { "id": "<signal id>", "resolution": "<how judged>" } ] } } }
Edit nothing except this file. End with a one-line summary.
