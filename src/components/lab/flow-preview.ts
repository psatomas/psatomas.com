import type { ExperimentId } from "@/types";

/** A short, hand-picked excerpt of each experiment's own real flow
 * diagram (see src/experiments/{id}/component.tsx) — not new content,
 * just fewer steps of it. This is UI-layer curation, deliberately kept
 * out of the registry: it's an editorial choice about which three steps
 * hint at an experiment best on a small surface, not a fact about the
 * experiment itself the way index/title/subtitle are. Keyed by the same
 * ExperimentId the registry already uses, so TypeScript forces a
 * deliberate choice here whenever a new experiment is added, rather than
 * silently rendering nothing. Shared by the homepage Lab preview and the
 * /lab index — both show the same curated excerpt, so it lives in one
 * place rather than two. */
export const FLOW_PREVIEW: Record<ExperimentId, readonly [string, string, string]> = {
  evm: ["TX 01", "STATE", "TX 02"],
  "intent-mev": ["INTENT", "SOLVERS", "SELECTED"],
  oracle: ["COINGECKO", "ORACLE SERVICE", "PROTOCOL LAB"],
};
