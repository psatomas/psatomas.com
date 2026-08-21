import { evaluateReading } from "../domain/evaluate.ts";
import {
  defaultFreshnessPolicy,
  type AssetSymbol,
  type OracleFreshnessPolicy,
  type OracleReading,
} from "../domain/model.ts";
import type { OracleSourceAdapter } from "./oracle-source.ts";

/**
 * Orchestrates one or more source adapters into evaluated readings. This
 * is the only place that knows "ask every configured source, then
 * evaluate what came back" — adapters don't know about each other or
 * about this service, and nothing above this service knows how many
 * adapters are configured or how any of them fetch data.
 */
export interface OracleService {
  getReadings(asset: AssetSymbol): Promise<OracleReading[]>;
}

export function createOracleService(
  adapters: OracleSourceAdapter[],
  policy: OracleFreshnessPolicy = defaultFreshnessPolicy,
): OracleService {
  return {
    async getReadings(asset) {
      const now = Date.now();
      return Promise.all(
        adapters.map(async (adapter) => {
          const observation = await adapter.fetchObservation(asset);
          return evaluateReading(adapter.id, asset, observation, now, policy);
        }),
      );
    },
  };
}
