The driver applied your repairs to the batch `{{GROUP}}`. Results:
{{REPORT}}

Verify concepts {{REVIEWED}} as they now stand (`npm run map:inspect -- <concept>`). For each:
- confirm each applied repair fixes its defect;
- re-read the changed sentence, its paragraph, and EVERY sentence of the record that uses a term the repair narrowed or redefined, for new overclaims, lost conditions, second senses and contradictions;
- for a repair NOT applied, give a corrected finding with an exact quote that occurs once.

Signals as they now stand (concept | id | detail); give a resolution for every signal of each concept:
{{SIGNALS}}

Write {{OUT}}:
{ "concepts": { "<id>": { "verdict": "pass" | "defect", "findings": [ ...same finding shape as before, defects only for what still needs repair... ], "note": "<what you verified>", "resolutions": [ { "id": "<signal id>", "resolution": "<how judged>" } ] } } }
Edit nothing except this file. End with a one-line summary.
