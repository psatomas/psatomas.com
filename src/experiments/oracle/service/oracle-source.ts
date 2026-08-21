import type { AssetSymbol, OracleObservation, OracleSourceId } from "../domain/model.ts";

/**
 * What every Oracle data source must implement. The service layer — and
 * everything above it — only ever talks to this interface. It has no
 * idea whether a given adapter is an in-memory dev fixture, a REST call
 * to a real provider, or a blockchain read. Swapping the dev adapter for
 * a real one later means implementing this interface; nothing else
 * changes.
 */
export interface OracleSourceAdapter {
  readonly id: OracleSourceId;
  /**
   * Returns null when the source has no observation available right now
   * (request failed, asset not supported, etc.) — adapters report
   * unavailability this way rather than throwing, so one down source
   * never breaks evaluation of the others.
   */
  fetchObservation(asset: AssetSymbol): Promise<OracleObservation | null>;
}
