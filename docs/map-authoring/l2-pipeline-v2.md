# L2 authoring pipeline v2

v1 ([l2-authoring.md](l2-authoring.md)) authored one concept at a time with a fresh
agent per step under a long-lived orchestrating conversation. It cost about 2.3 M
weighted tokens per accepted concept. v2 keeps v1's contracts, validators, run
state, gates and delivery, and replaces only how the content is produced:

- **Batches:** one ownership group (2–8 concepts) per batch.
- **A deterministic driver** (`scripts/map-l2v2.ts`) in place of an LLM
  orchestrator.
- **Bounded headless sessions** (`claude -p`), each with a written role.

## Quality policy

- **Nothing ships with a known unresolved substantive defect.**
- **Every defect is tracked.** It gets a stable id in the batch's defect
  ledger and closes only as **verified** (an applied repair the reviewer
  confirms) or **withdrawn** (with a written reason).
- **A refused repair can never be confirmed.** A repair whose quote does not
  match exactly once is refused, and only a superseding finding or a
  withdrawal can close it.
- **Unresolved concepts are parked.** A concept with any open defect after the
  verified repair rounds is parked: its draft leaves the tree and the batch
  stops for a human.
- **Reviews are independent.** The plan review and the batch review run in
  sessions that wrote nothing being reviewed. Escalated concepts get a second,
  independent review.
- **Plan-review claim fixes are verified** before drafting.
- **Acceptance re-checks the evidence:**
  - no open defect;
  - full claim coverage at the last review;
  - confidence not low;
  - the second review done for every escalated concept;
  - every signal resolved.
- **A defect verdict must name its defects.**
- **Sampling measures, it never authorizes.** A defect found by a deep audit is
  repaired and verified like any other.

The rubric is [`scripts/l2v2/prompts/rubric.md`](../../scripts/l2v2/prompts/rubric.md),
distilled from the Foundations audits.

## A batch

| Status | Session | Checks between sessions |
|---|---|---|
| pending → planned | **plan**: claims, excludes, splits, models, designs in the group file (the driver creates the skeleton) | `l2 check --group`; one fix round, else rolled back |
| planned → plan-reviewed | **plan-review** (independent); claim fixes applied exactly, then verified in the resumed session | `l2 check`; an unconfirmed fix is rolled back |
| plan-reviewed → drafted | **draft**: every record of the batch as JSON in its staging file | the file validated as data; the driver renders it into `data.ts` and the registry and checks the source as text; then generate, `l2 check`, focused tests; one rewrite round, else rolled back |
| drafted → reviewed | **review** (independent, side by side) | repairs applied exactly; the resumed reviewer answers every defect id; at most 2 rounds |
| reviewed → escalated | **escalate**: a second independent review of escalated concepts | the same repair and verification loop |
| escalated → accepted | — | the acceptance gates; v1 audit files written; parked concepts removed |

**Escalation triggers:**
- confidence below high;
- 3 or more defects;
- a defect in conditions, a formal result or the definition;
- an uncertain finding;
- a claim touching another domain's concept;
- a corrected plan claim;
- more than one placement;
- an emerging domain;
- a claim not fully covered.

## Safeguards

- **Records are data, never code:**
  - No session writes TypeScript. The draft writes its records as JSON to a
    staging file in the batch directory.
  - The driver validates that file against the record contract
    ([`records.ts`](../../src/lib/map/authoring/l2v2/records.ts)):
    - exact fields;
    - plain strings only (no control characters, markup or line breaks);
    - known block kinds;
    - the block shapes of `validation.ts`;
    - one record per concept, stamped with the session's token.

    Anything else is refused.
  - The driver alone renders the records into `data.ts` and the registry,
    every value as a JSON string literal under a fixed key, so nothing a
    session writes can become an expression.
  - Before anything imports `data.ts` (generate, `l2 check`, the tests,
    inspection), the driver checks the source as text: exactly the earlier
    file plus its rendering of the validated records.
  - Repairs patch the records' values (a quote must occur exactly once in a
    content string, never in a key, kind or id; the result must stay valid) and
    are rendered again.
  - Records read back from batch state are validated again before anything
    renders, compares or fingerprints them. The renderer also refuses any key
    outside the record contract and any id that is not a concept identifier,
    so hand-edited state can never become code.
  - The CLI checks, as text, every v2 record of the slice before `run`,
    `audit` or `finalize` import anything.
- **The session sandbox is the security boundary** (Linux, bubblewrap;
  [`sandbox.ts`](../../src/lib/map/authoring/l2v2/sandbox.ts)).
  - **Why:** a live smoke test showed that the CLI's permission rules are
    *not* a boundary. Under `--permission-mode dontAsk`, Claude Code 2.1.280
    ran `git status` although no allowed tool granted it. Those rules stay as
    defense in depth; the operating system enforces the rest.
  - **Every session runs in the sandbox:** plan, review, draft, repair
    verification, escalation and every deep audit. The driver has no
    unsandboxed path. `run` and `audit` refuse before any session if:
    - this isn't Linux;
    - bubblewrap is missing or cannot create its namespaces;
    - the CLI, node or npm is missing;
    - the token file is missing, or readable by others.
  - **What a session sees:** new user, mount, PID, IPC, UTS, cgroup and
    network namespaces; killed with its parent; no controlling terminal.
    - **Filesystem:**
      - `/work`: an empty, read-only tree holding only `src/`, `docs/`,
        `scripts/` and `package.json`, with secret-like files in them masked
        (`.env*`, `.dev.vars*`, keys);
      - the session's own pack, read-only;
      - one empty writable directory at its batch dir, for its output;
      - for the plan session, a writable copy of the group files;
      - read-only `/usr` and a few files of `/etc` (certificates, users, time);
      - a private `/tmp` and HOME;
      - its session chain's own CLI config dir.
    - **Not visible:** `.git`, `.dev.vars` and env files, the run state and
      campaign authorization, batch state and other sessions' outputs, other
      worktrees, the host HOME, the general credential store, SSH and cloud
      credentials, `node_modules`.
  - **Output after exit only:** the driver reads the session's output only
    once the sandbox has exited.
    - It takes its output file (a regular file, at most 4 MB), and for the
      plan session its group file.
    - Anything else written is a violation, and none of the session is used:
      another name, a link, another group's file.
    - The output reaches the tree only after the integrity guard passes.
  - **Network:** the sandbox has none of its own: no DNS, no IPv4 or IPv6
    route. A launcher inside forwards `127.0.0.1` to the driver's egress
    server (a Unix socket), which offers two paths only, and records every
    refusal in the ledger (`egressDenied`).
    - **The API relay:** the CLI's `ANTHROPIC_BASE_URL` points at it.
      - It forwards only allowed paths (`config.json` `relay.paths`, default
        `/v1/`) to the upstream (default `https://api.anthropic.com`), over
        TLS from the host.
      - It drops any credential the sandbox sent and adds the real token.
      - It passes a redirect back unfollowed, and refuses absolute-URL
        (forward-proxy) requests.
    - **CONNECT tunnels** (`HTTPS_PROXY`): only to allowed host names
      (`config.json` `egress`, default `api.anthropic.com:443`). IP literals,
      IPv6, other ports and malformed targets are refused.

    Non-essential CLI traffic, telemetry, error reporting and auto-update are
    disabled.
  - **The CLI's own state:** every session chain (a session and its
    `--resume` continuations) has its own config dir under
    `.map-authoring/l2v2/sandbox/`, named by its validated session id.
    - A new session starts from an empty one, and a resumption gets exactly
      its chain's, so no session sees another's transcripts or settings,
      across roles and batches alike.
    - Before every session, everything but the transcripts is removed
      (settings, hooks, MCP servers, plugins, shell snapshots), and
      `--strict-mcp-config` starts no MCP server.
  - **Authentication: the token never enters the sandbox.**
    - A dedicated token from `claude setup-token` sits in
      `~/.config/map-l2v2/oauth-token` (mode 0600; `L2V2_TOKEN_FILE`
      overrides). Only the relay on the host reads it.
    - Inside, the CLI holds a placeholder (`CLAUDE_CODE_OAUTH_TOKEN`, not a
      credential), which the relay replaces.
    - No process in the sandbox, shell commands included, can read the token:
      it isn't in any environment, file or mount there, as the tests show.
    - The general credential store (`~/.claude/.credentials.json`) is never
      mounted, and the token joins the secret scan.
  - **Residual risk:** any process in the sandbox can *use* the relay while
    the session runs. A shell command could make API calls that the relay
    authenticates, within the allowed paths, until the session ends. It
    cannot take the token away.
- **What the guard covers beside the sandbox:** the integrity guard below
  still runs around every session as defense in depth, on the host. The CLI's
  own config dirs are left out of it: the CLI writes there, and they are
  reset before every session. It detects what a session changed once it has
  run; preventing anything during the session is the sandbox's job.
- **Session permissions** (defense in depth, not a boundary; see above):
  `--permission-mode dontAsk` with explicit allowed
  tools (`allowedTools`) and denied tools (`deniedTools`, which win), both in
  [`core.ts`](../../src/lib/map/authoring/l2v2/core.ts).
  - **Reads** are limited to `src/`, `docs/`, the prompts, the session's own
    pack and its own output.
    - No session reads the batch state or another session's output.
    - A deep auditor also never reads the group files, which carry earlier
      audits.
    - Local secrets (`.dev.vars`, `.env*`, keys), git internals and credential
      directories are denied.
  - **Commands:** every role may run only `l2 context`, `l2 territory <group>`,
    `l2 signals`, `l2 group-signals <group>` and `map:inspect`; the plan
    session also `l2 check --group <group>`.
  - **Writes:** the plan session may edit only its group file (JSON); every
    other session only its own JSON output file. Writing is denied to every
    session for:
    - TypeScript and JavaScript, shell scripts, `package.json`, lockfiles and
      `tsconfig`;
    - `node_modules`, `.npmrc`, `.envrc` and the env files;
    - `.git`, `.gitignore` and `.gitattributes`, `.husky`;
    - `.claude`, `.mcp.json`, `CLAUDE.md` and `AGENTS.md`;
    - the run state and the campaign authorization (`.map-authoring`'s v1
      runs, ledgers, config, batch state, samples, packs and audit files);
    - home-directory configuration (Claude Code, git, npm, shell, SSH).
  - No session may record, authorize, reopen, run delivery, write territory,
    use git or run arbitrary code.
- **Secrets never ship:** before acceptance, every record, audit note,
  resolution and the group file are scanned. The scan looks for credential
  patterns and for the values of the local secret files (matched, never
  logged). A staged record with one is refused, an audit with one parks its
  concept, and a group file with one stops the batch.
  - The group file is scanned key by key and value by value, after the plan
    and again at acceptance. Its plan `basis` holds 64-hex fingerprints the
    v1 tooling writes (membership, hazards, parents, fixed members); these
    alone are left out.
  - They're left out only when they equal, path for path, the basis recorded
    before any session ran. That's the skeleton the driver created, or the
    committed plan.
  - A fingerprint changed, moved, added or never trusted is scanned like any
    other text, and so is a file that isn't JSON. v1's later audit
    fingerprints are never trusted.
- **Integrity guard and rollback**, around every session, including the first
  deep-audit session (`guardedSession` in
  [`driver.ts`](../../src/lib/map/authoring/l2v2/driver.ts)):
  - **Snapshots**, taken as bytes with each file's mode; links are never
    followed.
    - Every changed or untracked file, plus `data.ts`, the registry and the
      group file.
    - The local run state, file by file: `.map-authoring/` is git-ignored and
      holds the v1 runs, the campaign authorization, batch and sample state,
      and the ledger.
    - The ignored executable and configuration surfaces, read in full: git's
      shared and worktree config, hooks and `info/` (resolved through git, so
      a worktree's are found), the repository's `.claude/`, `.mcp.json` and
      `.npmrc`, and `~/.gitconfig`, `~/.npmrc` and `~/.claude/settings.json`.
    - The dependencies by metadata only (mode, size, time, link target), never
      by hashing the tree: every entry of `node_modules/.bin`, the installed
      lockfile, and each top-level package's manifest.
  - **Violations:** any change outside the role's one allowed file:
    - `data.ts` and the registry, which only the driver writes;
    - tests, tooling, other groups, created or deleted files;
    - any local run state other than the session's own output;
    - any change to a surface.
  - **Rollback:**
    - On a violation, a failed session or a failed validation, exactly the
      changes made since the snapshot are restored: bytes and mode,
      pre-existing user changes as they were, and files the session created
      removed.
    - A changed dependency or directory is never restored automatically: the
      batch stops for manual recovery, as it does when any restore fails.
    - A draft that fails at any point, including its rewrite round, leaves
      nothing rendered.
    - The driver removes only records it rendered itself: it keeps the
      fingerprint of each rendering. Before a draft, a record of the batch's
      concepts it did not write (or one edited since), or a registry entry it
      did not add, stops the batch with nothing removed.
  - **Never touched:** directory entries (such as nested worktrees) are
    compared by presence and never read or restored. `.worktrees/` is never
    part of a batch, and nothing ever resets or cleans the repository.
- **Commands keep their output apart:** stdout is the only data parsed or
  restored, git content is read as bytes, and stderr appears only in messages.
- **Output files carry the session's run token.** Each output is deleted
  before its session runs and must contain the token the driver generated, so
  a stale or foreign file is never consumed.
- **Partly authored v1 slices:**
  - v2 authors only groups with no v1 step recorded.
  - Groups v1 finished are skipped.
  - Groups with some steps recorded are refused, for a human to decide.
  - Concepts registered at the base or drafted or audited in the v1 run are
    protected, and the driver refuses a batch that includes one.
- **Resume never skips forward:** `resume --at` accepts the status the batch
  stopped at or an earlier one, and the later stages run again. Accepting a
  batch through `resume` is refused.
- **Resume restarts from the evidence, not from what came after:**
  - Each status reached keeps a checkpoint of the batch's evidence: concept
    states, defect ledger, audit notes, group audit.
  - A resume moves the attempt's evidence to the batch's history, kept for the
    record and never judged again, and restores the checkpoint of the status
    resumed at. A later stage's defects, notes or verdicts never decide the
    new acceptance, while earlier ones (such as a corrected plan claim that
    triggers escalation) still count.
  - Open deep-audit defects stay unless the record is drafted again (resuming
    at `plan-reviewed` or earlier).
  - The history also keeps the attempt's records, accepted but unfinalized
    text included. A redraft starts without current records, and nothing in
    the history ever counts as accepted.
  - Records a park removed from the tree are rendered again from their
    validated data: the CLI's checks before `run` accept a record that is
    missing while its concept is not accepted, and still refuse a missing or
    changed accepted one.
  - A resume is recorded in the ledger as the human's decision: the batch's
    parked concepts stop counting toward the parking stop rule.
- **Independent reviews stay independent:**
  - Reviewers see only the sources, the prompts, their pack and their own
    output, never the batch state or another session's output.
  - The second review is told the focus areas (conditions and formal results,
    corrected claims, placements, coverage), never the first review's verdict,
    confidence, findings or their count.
  - A deep auditor's pack carries the concept's model and design, never an
    earlier audit.
- **One driver per checkout:** a lock in `.map-authoring/l2v2/lock`. A lock
  left by a dead process is reported, never stolen.
- **Session execution:**
  - Each session runs in its own process group, killed whole on a timeout,
    as soon as the session exits, and if the driver itself stops: nothing it
    started can still write after the guard has looked (Linux and macOS).
    A timeout sends SIGTERM, then SIGKILL after a grace period to a group
    that has not ended. The escalation is cancelled once the session has
    closed, so it never signals a reused group id.
  - A timeout (default 30 minutes) kills the session.
  - Failures (timeout, non-zero exit, no JSON, an error result, a usage
    limit) are recorded as `session-failed` with no usage; usage the CLI did
    not report stays unknown, never zero.
  - The model is explicit (`config.json`, default `claude-opus-5-5`). An
    optional `maxBudgetUsd` is passed to the CLI, but it does not bound a
    subscription's quota: the limits below and the usage meter do.
  - The CLI has no turn limit; the timeout bounds sessions instead.
- **Per-batch limits** (`budget.json`: `maxSessionsPerBatch`, default 20;
  `maxBatchMinutes`, default 240):
  - A session counts before it starts, and failed ones count. When a limit is
    reached, the batch stops before the next session for a human. A session
    can overrun the time limit by at most one session timeout.
  - A session the driver never saw finish (the process stopped) counts as
    interrupted, for its whole timeout. Its changes were never checked, so the
    batch stops for a human to inspect.
  - A resume, and a repair after a deep audit, start a new window.
- **Audit limits:**
  - One `audit` command audits at most `maxAuditConcepts` concepts (default
    12, `budget.json`), one guarded session each.
  - The stop rules are checked before every audit session.
  - A failed audit session is recorded as such. One the CLI never saw finish
    is recorded as interrupted when the next audit command starts, which then
    stops for a human to inspect.

## Delivery

v2 runs inside a v1 slice run and delivers through it:

1. `npm run map:author -- l2 start --slice <id>`: v1's start safeguards and
   branch.
2. `npm run map:l2v2 -- run --slice <id> [--groups ..]`: the batches.
3. `npm run map:l2v2 -- audit --sample-slice <id>`: the measurement sample
   (4 per slice by default), drawn deterministically from the slice id. A
   defect found is repaired exactly, verified by the auditor's resumed session
   and re-accepted through the gates, or parked.
4. `npm run map:l2v2 -- finalize --slice <id>`:
   - refuses unless every v2 batch is accepted and the sample is settled;
   - refuses while any deep audit (sample, pilot or any other label) found
     substantive defects in a concept at or after its last acceptance, or in
     the very record that was accepted (each audit keeps the fingerprint of
     what it read): known defects are repaired (`--fix`) and accepted again
     first;
   - refuses unless `data.ts` holds exactly the accepted records: each one's
     fingerprint is kept at acceptance (the fingerprint v1 computes), so an
     edit after acceptance is never recorded unreviewed;
   - records the v1 steps in v1's order, every command with `--domain <id>`,
     so it works while another run (such as the paused `foundations-1`)
     exists;
   - runs `l2 complete audit` and `l2 run --until diff`.
5. `npm run map:author -- l2 run --domain <id>`: commit, push, PR, CI and
   merge under the recorded campaign authorization. v2 itself never pushes or
   merges.

**Repairing content after a deep audit:**
- `audit --fix --slice <id>` repairs only accepted, not yet finalized v2
  concepts, through the same verified loop.
- Recorded or protected records need a controlled v1 revision (`l2 reopen`).
- Baselines read at a commit (`--ref`) are measured and never fixed.

## Cost measurement and stop rules

`.map-authoring/l2v2/ledger.jsonl` records:
- every session's usage as the CLI reported it (**measured**);
- failed sessions;
- batch outcomes;
- deep audits, with campaign and baseline audits kept apart;
- readings of the usage meter (`meter --percent <n>`, **measured**).

The weighting is **assumed**: input 1, cache read 0.1, cache write 1.25,
output 5. `report` prints it all.

**Stop rules** (defaults in `DEFAULT_BUDGET`, overridable in `budget.json`):
- the last 3 batches average more than 1.3 × 122 k weighted per accepted
  concept;
- escalation runs above 40%, once there are at least 10 concepts;
- any parked concept, until a human resumes its batch;
- 3 or more of the last 10 sessions (any role, audits included) failed or
  were interrupted, counted after the latest acknowledgment (below);
- 8 or more of the last 20 **campaign** audits have substantive defects
  (baselines never count);
- within one weekly window, the meter rises more than 0.109% per accepted
  concept (use 0.163% for 3 weeks). A drop in the reading marks a weekly
  reset.

**Acknowledging failures:**
`npm run map:l2v2 -- clear-failures --note "<what was checked>"` is the only
way out of the failure stop rule.
- **Before running it:** a human checks the CLI, the quota and the tree.
- **What it does:** it appends an `ack` entry to the ledger, and the rule then
  counts only sessions after it. Every failure, timestamp and usage record
  stays in the ledger; new failures can stop the campaign again.
- **What it requires:** a non-empty note (an acknowledgment without one counts
  as none). It refuses when there is nothing to acknowledge, and while any
  batch or audit session is in flight or interrupted, until that is recorded
  and inspected through its own command.
- **What it never clears:** a `resume` or a meter reading never clears the
  rule. The acknowledgment itself clears nothing else: parked concepts, known
  defects, changed records and every other stop rule stand.

## Live verification still required

Before the pilot, one sandboxed live session with no authoring must confirm:
- the CLI accepts the placeholder and sends its API calls to the relay
  (`ANTHROPIC_BASE_URL` with an OAuth token), and the relay's token
  authenticates them;
- `/v1/` covers every path the CLI calls, and no other host is needed
  (`egressDenied` shows each refusal);
- `--resume` works with a chain's config dir, and whether `--resume`
  returns the same session id;
- the CLI writes nothing outside its writable paths.

**The sandbox tests are mandatory in CI.** Linux CI installs bubblewrap,
allows unprivileged user namespaces, checks that a sandbox starts, and runs
the tests with `L2V2_REQUIRE_SANDBOX=1`, so a missing sandbox fails the build
instead of skipping tests. Elsewhere the tests skip where no sandbox can
exist; they never run unsandboxed. The sandbox mirrors the host's root layout
(`/bin`, `/lib64`…) and mounts node and npm from wherever they are installed.

## Calibration pilot (before scaling)

The pilot is about 12 concepts in Computation & Execution, plus 6 Foundations
records as a baseline.

1. Read the meter: `meter --percent <n>`.
2. Start the slice with `l2 start`, then run `run --slice <id> --groups <g1,g2,g3>`.
3. Read the meter again.
4. Deep-audit every pilot concept:
   `audit --label pilot --concepts <ids> --slice <id> --fix`.
5. Deep-audit the baseline from the checkpoint, with its plan and accepted work
   as of that commit:
   `audit --label baseline --ref refs/checkpoints/l2-foundations-1-2026-10-08 --concepts <6 ids>`.
6. Compare: `report`.

**Pass only if all hold:**
- pilot substantive defects per concept ≤ max(0.2, 1.5 × the baseline);
- every pilot defect found is repaired and verified;
- zero territory leaks;
- every claim fully covered;
- meter cost per accepted concept within the plan;
- nothing parked, or each parked concept explained.

Scale only after a pass.
