import type { OracleReadingsResponse } from "./contract.ts";

/**
 * Frontend-facing client used by the Oracle experiment UI. Calls our
 * server-side API; CoinGecko access and caching stay behind that boundary.
 */
export async function fetchOracleReadings(
  asset: string,
  init?: RequestInit,
): Promise<OracleReadingsResponse> {
  const res = await fetch(`/api/oracle?asset=${encodeURIComponent(asset)}`, init);
  if (!res.ok) {
    throw new Error(`Oracle API request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
