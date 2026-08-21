import type { OracleReadingsResponse } from "./contract.ts";

/**
 * Frontend-facing client for the Oracle API. Not wired into the Oracle
 * experiment's UI yet (../component.tsx still uses its own client-side
 * simulation) — this exists so a later phase can switch the UI to real
 * data by importing this function, instead of touching the API route or
 * service directly from a component.
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
