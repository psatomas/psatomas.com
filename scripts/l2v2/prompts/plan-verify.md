The driver applied your claim fixes to src/lib/map/authoring/l2/groups/{{GROUP}}.json:
{{FIXES}}

Re-read the plan as it now stands (`npm run -s map:author -- l2 territory {{GROUP}}`): confirm each fix is accurate and complete, introduces no new overclaim or territory conflict, and that every claim of the batch can now be explained with a mechanism, conditions and a failure or confusion. Edit nothing except your output file.

Write {{OUT}}:
{ "run": "{{RUN}}", "verdict": "pass" | "stop", "claimFixes": [], "stopReason": "<only for stop: what is still wrong>", "note": "<what you verified>" }
End with a one-line summary.
