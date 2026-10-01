# MAP L1 domain runbook

The canonical procedure for authoring one L0 domain's L1 topics, from a clean,
current `main` to a validated pull request. It adds nothing to the authoring
contract: [content-architecture.md](content-architecture.md),
[authoring-workflow.md](authoring-workflow.md) and
[quality-contract.md](quality-contract.md) still govern every word. The runbook
decides *order* and *mechanics*; `npm run map:author` records them.

**The human boundary is the merge.** A successful run ends at "validated PR
awaiting human merge". The tool never merges, deploys, force-pushes, amends a
pushed commit, or starts a domain it was not explicitly given.

## Who does what

| Work | Owner |
| --- | --- |
| Writing exposition, the editorial audit, judging whether a stop applies | the agent |
| Planning, ownership, state, regeneration, tests, gates, browser and render checks, diff validation, commits, push, PR, CI | `map:author` |

The agent starts once and continues until the PR is open or a genuine stop
fires. It does not pause for a human after each concept.

## Commands

```bash
npm run map:author -- domains                        # every domain's L1 status; names the next incomplete one
npm run map:author -- plan --domain <id> [--json]    # read-only plan: authored, eligible, deferred, stops
npm run map:author -- start --domain <id> [--dry-run]
npm run map:author -- status                         # stage, concepts, checks, branch, base, git/PR position
npm run map:author -- next                           # only the next action
npm run map:author -- context <concept-id>           # focused context for one concept (map:inspect, run-aware)
npm run map:author -- record <concept-id>            # after writing and registering one concept
npm run map:author -- audit [--json]                 # mechanical audit facts for this run's content
npm run map:author -- complete audit --note "..."
npm run map:author -- fix --kind test|fix --message "test(map): ..." --files a,b --reason "..."
npm run map:author -- stop --subject .. --evidence .. --why .. --decision ..
npm run map:author -- resume --decision "..."        # records the human decision that resolved a stop
npm run map:author -- run [--dry-run] [--trailer ".."] [--footer ".."]
```

A domain is always named explicitly. `domains` shows the next incomplete one
for information only.

## The plan

`plan` and `start` classify each L1 topic through the authoring inspector
(the same code as `map:inspect`):

- **authored**: registered and present. Left alone.
- **eligible**: owned by this domain. With one child layer, the owner is the
  domain carrying it, even when the preferred placement is a leaf elsewhere.
  With several (the [facet rule](content-architecture.md#several-child-carrying-placements)),
  the owner is the preferred placement's domain.
- **deferred**: owned by another domain; the reason is recorded.
- **stop**: a registry inconsistency, or several child layers while the
  preferred placement carries none. Such a domain cannot start.

A domain is complete when nothing eligible or stopped is left.

## Stages

```text
start → author → audit → gates → browser → render → diff → commit → push → pr → ci → done
        (agent)  (agent)  (tool ……………………………………………………………………………………………………………………)
```

State lives in `.map-authoring/<domain-id>.json` (git-ignored). Every command
reads it, so an interrupted run resumes with `status` and `next`. Commands
that change the run first check that the repository still matches it: the
branch, a HEAD equal to the last recorded commit (or the base), and the pushed
commit on the remote. Any mismatch is a stop. A state file for another domain,
or of another version, is refused.

**start** (tool). Refuses unless the tree has no tracked changes, you are on
`main`, local `main` has nothing origin lacks, no `feat/map-*-l1` PR is still
open, the branch does not exist, and the plan has no stops. It fast-forwards
`main`; if that changed anything, run `start` again so the plan is read from
the new tree. It then creates `feat/map-<domain-id>-l1` and records the base.

**author** (agent), for each pending concept, in sibling order:

1. `map:author -- context <concept>`: the bounded context. Never read the
   whole data file.
2. Analyse the concept and design its representation
   ([representation-design.md](representation-design.md)) before writing. The
   form is decided for this concept, never carried over from the previous
   record.
3. Write the exposition and add the registry entry, as
   [authoring-workflow.md](authoring-workflow.md) steps 3 to 6 describe.
4. `map:author -- record <concept>`: confirms the inspector reports it
   registered, regenerates the explorer view, runs the focused MAP tests,
   and records progress.

**audit** (agent). `map:author -- audit` reports facts for the run's
content: overlap with parents, siblings and the corpus; sentences copied
verbatim; possible positional language; shared definition openings. Judge
them against the [quality contract](quality-contract.md) as a whole domain,
correct only this run's content (re-`record` is not needed; `run` regenerates
and re-tests), then `complete audit --note "..."`.

**run** (tool) performs every remaining stage and stops at the first failure:

- **gates**: `map:generate` with no drift, the full unit suite, lint of the
  tracked tree (untracked paths such as `.worktrees/` are ignored, never
  edited), and the build;
- **browser**: the full `test:map:browser` suite, against the build the
  gates made, on its own `next start` server on a free port (never a running
  dev server or `MAP_BASE_URL`). It passes only on a clean exit with the
  suite's own "ALL CHECKS PASSED";
- **render**: `test:map:render` over every placement of every authored
  concept, at desktop and mobile width, with expectations derived from the
  model through the resolver. It checks the context trail, the current and
  expanded state, exactly the placement's own children (none at a leaf), that
  no other carrier's children render, text alternatives, overflow, and text
  identical at every placement. Each failure names the concept, placement,
  viewport and invariant;
- **diff**: against the base (renames counted as a delete plus an add), only
  the content files and declared fixes may change. Existing content,
  concepts, placements, relationships, mechanisms and paths must be
  untouched. `data.ts` must only gain lines, none of them code, and the
  registry only entry lines. Content and registry additions must equal the
  recorded concepts, one record and one entry each. The generated view may
  change only by `hasContent` false → true at their placements. Each declared
  fix is then verified on its own (below). The validated blobs are recorded;
- **commit**: each declared fix in its own commit, in declaration order, then
  `feat(map): add <domain> L1 content`. Only a group's listed files are
  staged, and each staged blob must be the validated one. Afterwards the
  commits must reproduce the validated tree exactly and leave no tracked
  change behind. `.worktrees/` and `.map-authoring/` never enter a commit;
- **push**: first checks that `origin/main` has not changed any file of the
  run and still merges cleanly. It pushes only a branch that is absent from,
  or identical on, the remote;
- **pr**: reuses the branch's open PR only if it targets `main` and carries
  exactly the pushed commit; otherwise it opens one whose title and body are
  generated from the state. A closed, merged or mismatched PR is a stop;
- **ci**: each poll rechecks the remote branch and the PR, then reads the
  PR's checks. Success needs at least one check, and every check passed or
  skipped. A failed or cancelled check is a stop, recorded in the state; the
  tool adds no commits after the content and never amends. Still pending
  after `--ci-wait` minutes (default 30), the run stays at `ci`, and a later
  `run` resumes waiting.

A run is done only there, as a validated PR awaiting human merge. Nothing
follows it: the tool has no merge or deploy path, and `start` refuses a new
domain while any domain PR is open.

### What invalidates what

Before continuing an uncommitted run, `run` compares what earlier results
depended on with the repository now:

| Change since | Consequence |
| --- | --- |
| the run's content records, after the audit | back to **audit**; every later result is dropped |
| the tree (a test or tooling fix, say), since a check | back to **gates**; every tree-bound check is dropped |
| the production build, at browser or render | back to **gates**, which rebuild |

Recording a concept runs the focused MAP tests as a progress signal only. The
gates always regenerate and re-test everything. Once commits exist nothing is
rewound: the commits must equal the validated blobs, and HEAD, the remote
branch, the PR head and CI are checked against the recorded run before each
later stage.

## Stops

Stop with `map:author -- stop` (the agent) or let the tool stop when any of
these hold:

- the child layers are not facets of one concept, or ownership or identity
  is ambiguous;
- the run would change accepted content, taxonomy, placements, relationships,
  mechanisms or paths;
- the generated output changes beyond the expected `hasContent` flips;
- there are unrelated tracked changes, unsafe divergence from `main`, merge
  conflicts, or git or remote state inconsistent with the recorded run;
- a browser or render failure whose fix would change established behavior;
- the infrastructure change needed is materially larger than the domain;
- continuing would need a new authoring rule;
- any stop condition of [authoring-workflow.md](authoring-workflow.md#stop-and-escalate).

A stop report is only: stage, subject, evidence, why the contract is
insufficient, and the smallest decision needed. After a human decides,
`resume` continues from the same stage.

**The one exception.** A small, general, isolated test or tooling fix may
continue the run when it strengthens the contract and changes no product
behavior. For example, a test that pinned authored state is changed to derive
its expectation from the registry. Declare it with `fix`, before committing.
The tool holds it to a policy and refuses anything outside it, which must stop
instead:

- the kind is `test` (test files and `e2e/map/` only) or `fix` (also
  `scripts/`, `src/lib/map/authoring/` and `docs/map-authoring/`). MAP
  runtime, components and content files are never a fix;
- the message is `<kind>(map): ...`, and each file belongs to one fix;
- all fixes together change at most 120 lines. This is a conservative
  circuit breaker, not a definition of safety: the other rules still decide;
- each is verified on its own, on a worktree of the base plus that fix and
  without the run's content, by the smallest sufficient check. That is the
  type-check and unit suite. A fix under `e2e/map/` also needs a production
  build of that tree and the browser checks it changes: its own suite
  sections, or for `render-check.mts` the render check on a sample of
  already-authored concepts. The harness or runner needs the whole suite plus
  the render check. A browser file that no focused check exercises is a stop,
  never passed on the unit suite.

It is committed separately, before the content, and named in the PR.

## Reporting

Progress lines stay compact. A successful run ends with one completion report
covering what was authored, already authored and deferred, the fixes, the
audit note, the checks, the commits, and the PR and CI status. Detailed
diagnostics appear only at stops.
