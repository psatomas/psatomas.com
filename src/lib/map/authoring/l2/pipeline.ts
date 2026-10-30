/**
 * L2 pipeline modes (docs/map-authoring/l2-authoring.md, "Pipeline modes").
 * A slice runs under one mode, chosen when the run starts and recorded in its
 * run state and in each of its group files, so committed plans validate under
 * the mode they were written for. A run state or group file without one is
 * legacy: every historical record keeps validating as it was accepted.
 *
 * - legacy: territory plans with assertion claims, then a persisted concept
 *   model and representation design per concept, then drafting and audits.
 * - simplified: territory plans whose claims are topic labels (they name what
 *   to explain and assert nothing), then drafting and audits. No model or
 *   design is persisted; the author decides the representation, and the
 *   audit judges it.
 *
 * Everything after drafting is the same in both modes: two independent first
 * audits, fingerprint-bound audit records, territory, group audits, repair
 * accounting, the deterministic gates and the guarded integration.
 *
 * Routing names the model each role's agent uses. The tool does not launch
 * agents: it records the routing a run was started with and prints it, so an
 * orchestrator applies it per agent and `l2 cost` can measure it. Pure;
 * development tooling only.
 */
export type L2PipelineMode = "legacy" | "simplified";
export const L2_ROLES = ["plan", "design", "author", "first-audit", "repair", "re-audit", "group-audit"] as const;
export type L2Role = (typeof L2_ROLES)[number];
export type L2Routing = Partial<Record<L2Role, string>>;
export type L2Pipeline = { mode: L2PipelineMode; version: number; routing?: L2Routing };

/** Each mode's current version, and where its versioned agent instructions live. */
export const PIPELINES: Record<L2PipelineMode, { version: number; instructions: string; roles: readonly L2Role[] }> = {
  legacy: { version: 1, instructions: "docs/map-authoring/l2-authoring.md", roles: L2_ROLES },
  simplified: { version: 1, instructions: "docs/map-authoring/l2-simplified/", roles: L2_ROLES.filter((role) => role !== "design") },
};

/**
 * Default routing per mode. Legacy records the split routing the campaign ran
 * last (CE-2). Simplified starts on Opus for its pilot; this is a pilot choice,
 * not a finding that one model is better for every role, and `--routing`
 * overrides any role so others can be evaluated.
 */
export const DEFAULT_ROUTING: Record<L2PipelineMode, Required<Pick<L2Routing, "plan" | "author" | "first-audit" | "repair" | "re-audit" | "group-audit">> & L2Routing> = {
  legacy: { plan: "sonnet", design: "sonnet", author: "sonnet", "first-audit": "opus", repair: "sonnet", "re-audit": "opus", "group-audit": "opus" },
  simplified: { plan: "opus", author: "opus", "first-audit": "opus", repair: "opus", "re-audit": "opus", "group-audit": "opus" },
};

/** Model names the routing accepts: a family alias or a full model id. */
const MODEL = /^(opus|sonnet|haiku|fable|claude-[a-z0-9.-]+)$/;

export class PipelineError extends Error {}

/** The pipeline a run state or group file declares; none declared is legacy, version 1. */
export const pipelineOf = (holder: { pipeline?: L2Pipeline } | undefined): L2Pipeline => holder?.pipeline ?? { mode: "legacy", version: 1 };
export const isSimplified = (holder: { pipeline?: L2Pipeline } | undefined) => pipelineOf(holder).mode === "simplified";

/** The routing a run uses: its mode's defaults with the run's recorded overrides. */
export const routingOf = (pipeline: L2Pipeline): L2Routing => ({ ...DEFAULT_ROUTING[pipeline.mode], ...(pipeline.routing ?? {}) });

/** Parses `role=model,role=model`, refusing roles the mode does not have and models it does not know. */
export function parseRouting(text: string | undefined, mode: L2PipelineMode): L2Routing {
  if (!text) return {};
  const routing: L2Routing = {};
  for (const part of text.split(",").map((entry) => entry.trim()).filter(Boolean)) {
    const [role, model, extra] = part.split("=").map((entry) => entry.trim());
    if (!role || !model || extra !== undefined) throw new PipelineError(`routing "${part}" is not role=model`);
    if (!PIPELINES[mode].roles.includes(role as L2Role)) throw new PipelineError(`the ${mode} pipeline has no ${role} role (roles: ${PIPELINES[mode].roles.join(", ")})`);
    if (!MODEL.test(model)) throw new PipelineError(`unknown model ${model}: use opus, sonnet, haiku, fable or a claude-* id`);
    routing[role as L2Role] = model;
  }
  return routing;
}

/** A mode known to this tooling, or a PipelineError. */
export function pipelineMode(mode: string | undefined): L2PipelineMode {
  const chosen = (mode ?? "legacy") as L2PipelineMode;
  if (!(chosen in PIPELINES)) throw new PipelineError(`unknown pipeline ${mode}: legacy or simplified`);
  return chosen;
}

/**
 * The pipeline a new run starts with: a known mode at its current version,
 * and the complete routing it starts with (the mode's defaults with any
 * overrides), recorded so that later changes to the defaults never rewrite
 * what a run used.
 */
export function startPipeline(mode: string | undefined, routing?: string): L2Pipeline {
  const chosen = pipelineMode(mode);
  const overrides = parseRouting(routing, chosen);
  const defaults = Object.fromEntries(Object.entries(DEFAULT_ROUTING[chosen]).filter(([role]) => PIPELINES[chosen].roles.includes(role as L2Role)));
  return { mode: chosen, version: PIPELINES[chosen].version, routing: { ...defaults, ...overrides } };
}

export const describePipeline = (pipeline: L2Pipeline) => `${pipeline.mode} pipeline v${pipeline.version}`;

/**
 * A run's pipeline and routing for display. A run started before pipeline
 * modes recorded neither: it is legacy, and its routing is not known, so none
 * is inferred from today's defaults.
 */
export function pipelineStatus(holder: { pipeline?: L2Pipeline } | undefined): string {
  const pipeline = holder?.pipeline;
  if (!pipeline) return "legacy pipeline v1 (run predates pipeline modes); routing not recorded";
  const routing = pipeline.routing ?? {};
  const roles = PIPELINES[pipeline.mode].roles.filter((role) => routing[role]);
  return `${describePipeline(pipeline)}; routing ${roles.length ? roles.map((role) => `${role}=${routing[role]}`).join(", ") : "not recorded"}`;
}

/**
 * Why a group file cannot be recorded for a run: it declares another pipeline
 * than the run's. The fix is an edit of that one field (a skeleton is written
 * only for a group file that does not exist), after which the claims must
 * still fit the run's mode.
 */
export function pipelineMismatchProblem(group: string, file: string, declared: L2Pipeline, run: L2Pipeline): string | undefined {
  if (samePipeline(declared, run)) return undefined;
  const edit = run.mode === "legacy" ? `remove the "pipeline" field from ${file}` : `set "pipeline": ${JSON.stringify({ mode: run.mode, version: run.version })} in ${file}`;
  const claims = run.mode === "simplified" ? "every owned claim is a topic label" : "the claims are the legacy plan's";
  return `${group} declares the ${describePipeline(declared)} but the run uses the ${describePipeline(run)}: ${edit} (an existing group file is not rewritten by \`l2 territory --write\`), make sure ${claims}, run \`map:author -- l2 check --group ${group}\`, then record the plan again`;
}

/** Whether two declarations name the same mode and version (routing is the run's, not the plan's). */
export const samePipeline = (a: L2Pipeline, b: L2Pipeline) => a.mode === b.mode && a.version === b.version;

/** A pipeline a group file or run state may declare: a known mode at a known version. */
export function pipelineProblems(pipeline: L2Pipeline | undefined): string[] {
  if (!pipeline) return [];
  if (!(pipeline.mode in PIPELINES)) return [`unknown pipeline mode ${String(pipeline.mode)}`];
  if (!Number.isInteger(pipeline.version) || pipeline.version < 1 || pipeline.version > PIPELINES[pipeline.mode].version) return [`${pipeline.mode} pipeline version ${String(pipeline.version)} is not one this tooling knows (1..${PIPELINES[pipeline.mode].version})`];
  return [];
}

/** The longest topic label, in words. */
export const TOPIC_LABEL_WORDS = 24;

/**
 * Why a claim is not a topic label. A label names a question the concept must
 * explain in one short phrase and asserts nothing: no list of instances
 * ("such as", "for example", a colon list), no second clause or sentence, no
 * parenthetical. Judgment about whether a phrase asserts is the auditors';
 * these are the mechanical signs that it does.
 */
export function topicLabelProblems(claim: string): string[] {
  const problems: string[] = [];
  const words = claim.trim().split(/\s+/).filter(Boolean);
  if (words.length > TOPIC_LABEL_WORDS) problems.push(`${words.length} words: a topic label is one short phrase (at most ${TOPIC_LABEL_WORDS})`);
  if (/[;:]/.test(claim)) problems.push("a colon or semicolon makes it a list or a second clause: name the question only");
  if (/[()]/.test(claim)) problems.push("a parenthetical carries detail: a label names the question only");
  if (/\.\s+\S|\.$/.test(claim.trim())) problems.push("a sentence: a label is a phrase, without a full stop");
  if (/\b(such as|for example|e\.g\.|i\.e\.|including)\b/i.test(claim)) problems.push("it lists instances: the author decides which examples hold");
  return problems;
}
