/**
 * SIMULATION — deterministic, client-side model of intent-based execution
 * selection. This does not call a real solver network, mempool, or the
 * Execution Kernel Protocol's actual implementation (a separate, unrelated
 * repository). It exists to demonstrate the *concept*: an intent doesn't
 * prescribe an exact execution path — candidate executors quote against it,
 * and a scoring policy picks a winner.
 */

export type Candidate = {
  id: string;
  name: string;
  /** Output quality: better price / fill for the user. Higher is better. */
  quality: number;
  /** Execution cost (gas/fees), in the same unit scale as quality. */
  cost: number;
  /** Modeled MEV exposure (sandwich/frontrun risk) on a 0-100 scale. */
  mevRisk: number;
  /** Modeled execution latency in milliseconds. */
  latencyMs: number;
};

export type ScorePolicy = {
  qualityWeight: number;
  costWeight: number;
  mevWeight: number;
  latencyWeight: number;
};

export type ScoredCandidate = Candidate & {
  score: number;
  mevBand: "LOW" | "MEDIUM" | "HIGH";
};

export const defaultPolicy: ScorePolicy = {
  qualityWeight: 1,
  costWeight: 1,
  mevWeight: 1,
  latencyWeight: 1,
};

export const policyPresets: Record<string, ScorePolicy> = {
  BALANCED: { qualityWeight: 1, costWeight: 1, mevWeight: 1, latencyWeight: 1 },
  "MEV-AVERSE": { qualityWeight: 1, costWeight: 1, mevWeight: 4, latencyWeight: 1 },
  AGGRESSIVE: { qualityWeight: 1, costWeight: 0.3, mevWeight: 0.2, latencyWeight: 0.2 },
};

export const defaultCandidates: Candidate[] = [
  {
    id: "A",
    name: "Direct AMM Route",
    quality: 1000,
    cost: 0,
    mevRisk: 10,
    latencyMs: 0,
  },
  {
    id: "B",
    name: "Aggregator Route",
    quality: 900,
    cost: 150,
    mevRisk: 1,
    latencyMs: 20,
  },
  {
    id: "C",
    name: "Private Relay Route",
    quality: 850,
    cost: 220,
    mevRisk: 0,
    latencyMs: 60,
  },
];

function mevBand(mevRisk: number): ScoredCandidate["mevBand"] {
  if (mevRisk >= 16) return "HIGH";
  if (mevRisk >= 6) return "MEDIUM";
  return "LOW";
}

/**
 * Deterministic scoring: score = quality·qW − cost·cW − mevRisk·mW − latency·lW
 * Pure function — same inputs always produce the same score, no randomness,
 * no timers, no external calls.
 */
export function scoreCandidate(candidate: Candidate, policy: ScorePolicy): ScoredCandidate {
  const score =
    candidate.quality * policy.qualityWeight -
    candidate.cost * policy.costWeight -
    candidate.mevRisk * policy.mevWeight -
    candidate.latencyMs * policy.latencyWeight;

  return {
    ...candidate,
    score: Math.round(score * 100) / 100,
    mevBand: mevBand(candidate.mevRisk),
  };
}

export function scoreAndRank(
  candidates: Candidate[],
  policy: ScorePolicy,
): { scored: ScoredCandidate[]; winnerId: string } {
  const scored = candidates.map((c) => scoreCandidate(c, policy));
  const winner = scored.reduce((best, current) =>
    current.score > best.score ? current : best,
  );
  return { scored, winnerId: winner.id };
}
