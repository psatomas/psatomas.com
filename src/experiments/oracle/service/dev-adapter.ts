import type { AssetSymbol, OracleObservation } from "../domain/model.ts";
import type { OracleSourceAdapter } from "./oracle-source.ts";

/**
 * DEVELOPMENT ADAPTER — not a real data source. Produces a fixed,
 * deterministic observation so the service/API boundary can be built and
 * exercised end to end before a real provider (Phase 2) is wired in.
 *
 * This is intentionally the only implementation of OracleSourceAdapter
 * that exists right now. It is never presented to a user as live data —
 * the Oracle experiment's UI still uses its own separate client-side
 * simulation (see ../simulation.ts) for now, not this adapter.
 */
export function createDevOracleAdapter(): OracleSourceAdapter {
  return {
    id: "dev-fixture",
    async fetchObservation(asset: AssetSymbol): Promise<OracleObservation | null> {
      if (asset !== "ETH/USD") return null;

      return {
        asset,
        value: 3421.2,
        unit: "USD",
        observedAt: Date.now() - 4_000, // always "4s old" relative to whenever this is called
      };
    },
  };
}
