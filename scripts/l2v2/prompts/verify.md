The driver applied your repairs to the batch `{{GROUP}}`. Results:
{{REPORT}}

Verify concepts {{REVIEWED}}: their records as they now stand are below. Answer EVERY defect id listed above:
- "fixed": the applied repair fixes it completely (an unapplied repair can never be fixed);
- "withdrawn": it was not a defect after all, with the reason;
- "open": it is still a defect; then add a corrected finding (exact quote occurring once, exact replacement), which replaces it.
Then, for every applied repair:
- re-read the definition, the changed sentence, its paragraph, and EVERY sentence of the record that states, depends on or summarizes what the repair changed, or uses a term it narrowed or redefined. A repair that leaves the definition, a summary or another sentence contradicting it, or that adds an overclaim or loses a condition, is a new defect;
- report any new defect as a finding.
The other concepts of your review ({{OTHERS}}) have not changed since you last judged them. Cross-check EACH of them, briefly, against the repairs to its neighbours: does the unchanged record now hold
- "contradiction": a statement a repaired record now contradicts;
- "relationship": a relationship, boundary or split with a repaired record that no longer holds;
- "terminology": a term in another sense than the repaired records now use it;
- "claims": a claim or explanation a repair invalidated?
Answer each with true (found) or false in "crossChecks", with a one-sentence note on what you compared. A problem found is also reported as a defect finding on that concept, in an entry for it (exact quote occurring once, exact replacement); a defect on it is never reported without its cross-check naming the problem.

Signals as they now stand (concept | id | detail); give a resolution for every signal of each concept you verify:
{{SIGNALS}}

You edit nothing. Your final message is exactly this JSON object, and nothing else:
{ "run": "{{RUN}}", "concepts": { "<id>": { "verdict": "pass" | "defect",
  "defects": [ { "id": "<defect id>", "status": "fixed" | "withdrawn" | "open", "why": "<reason>" } ],
  "findings": [ ...same finding shape as before, for corrected or new defects only... ],
  "note": "<what you verified>", "resolutions": [ { "id": "<signal id>", "resolution": "<how judged>" } ] } },
  "crossChecks": { "<each unchanged concept>": { "contradiction": false, "relationship": false, "terminology": false, "claims": false, "note": "<one sentence, at most 300 characters: what you compared>" } } }
"crossChecks" is {} when no concept is unchanged.

# Records as they now stand (supplied by the driver)

{{RECORDS}}
