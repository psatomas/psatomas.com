/**
 * SIMULATION — deterministic, client-side model of an oracle boundary. This
 * does not connect to Chainlink, Pyth, RedStone, or any production oracle
 * network. It exists to demonstrate the concept: off-chain data is not
 * automatically on-chain truth — an oracle mechanism decides what a
 * protocol is willing to accept, based on freshness and validity, not just
 * "the latest number."
 */

export type OracleInput = {
  offChainPrice: number;
  /** How old the oracle message is when submitted, in seconds. */
  ageSeconds: number;
  /** Protocol-side acceptance threshold, in seconds. */
  maxStalenessSeconds: number;
  simulateInvalidSignature: boolean;
};

export type OracleEvaluation = {
  accepted: boolean;
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "EXPIRED";
};

export const defaultOracleInput: OracleInput = {
  offChainPrice: 3421.2,
  ageSeconds: 4,
  maxStalenessSeconds: 60,
  simulateInvalidSignature: false,
};

function confidenceFor(ageSeconds: number, maxStalenessSeconds: number): OracleEvaluation["confidence"] {
  const ratio = ageSeconds / maxStalenessSeconds;
  if (ratio > 1) return "EXPIRED";
  if (ratio > 0.6) return "LOW";
  if (ratio > 0.25) return "MEDIUM";
  return "HIGH";
}

/**
 * Pure function: same inputs always produce the same accept/reject
 * decision. No timers, no randomness — the visitor drives state changes
 * explicitly.
 */
export function evaluateOracleUpdate(input: OracleInput): OracleEvaluation {
  const confidence = confidenceFor(input.ageSeconds, input.maxStalenessSeconds);

  if (input.simulateInvalidSignature) {
    return {
      accepted: false,
      reason: "INVALID ATTESTATION — signature does not verify",
      confidence,
    };
  }

  if (input.ageSeconds > input.maxStalenessSeconds) {
    return {
      accepted: false,
      reason: `STALE DATA — ${input.ageSeconds}s old, exceeds ${input.maxStalenessSeconds}s window`,
      confidence,
    };
  }

  return {
    accepted: true,
    reason: `WITHIN FRESHNESS WINDOW — ${input.ageSeconds}s old`,
    confidence,
  };
}
