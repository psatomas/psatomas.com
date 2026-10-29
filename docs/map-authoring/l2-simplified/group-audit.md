# Step: independent GROUP audit (simplified pipeline v1, fresh bounded context)

First read common.md and follow it.

Every owned member of the group has passed its own concept audit. You judge the members read together. You never
edit records: a defect goes to the orchestrator, which repairs it through `l2 reopen` and re-audits.

## Read
- docs/map-authoring/quality-contract.md §B (esp. 4 sibling leakage, 9 template repetition, 11 representation);
  docs/map-authoring/l2-authoring.md "Signals", "Drift", "Depth", "Territory precedents".
- The plan: `npm run map:author -- l2 territory <group>` (topic labels, excludes, reservations, splits).
- Every owned member's record: `npm run map:inspect -- <id>`; the parent: `npm run map:inspect -- <parent>`.
- `npm run map:author -- l2 group-signals <group>`; optionally `npm run map:author -- l2 drift`.

## Judge (side by side)
- An argument, example or explanation made in two members; a split or reservation crossed; one member explaining
  what another's labels cover.
- Contradictions between members; a term used in different senses across members; members choosing different
  structures for the same comparison without reason.
- Template convergence: shared openings, the same arc or enumeration pattern across members, the same form for
  every member without the concepts requiring it. Repetition that follows the labels is not convergence; say so.
- Each group signal: real defect or not, and why.

## Decide
Blocking or advisory as in l2-authoring.md, "Finding severity". Blocking here includes a contradiction between
members, a split or reservation crossed, and one member explaining what another's labels cover.
- PASS: write WORK/audits/group-<group>.json as `{ "note": "... Advisory: <findings or none>", "resolutions": [ one per current group signal ] }`,
  then run `npm run map:author -- l2 record group-audit <group> --audit-file <that file>`; report any failure.
- FAIL: do not record. Write WORK/findings/group-<group>.md, blocking findings first: member, exact sentence, why it
  is a defect, the proposed fix and which member should change. Then the advisory findings.

## Report back (at most 8 lines)
PASS/FAIL; defects one line each; convergence observations; whether the record step succeeded.
