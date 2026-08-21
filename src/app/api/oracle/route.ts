import { createCoinGeckoAdapter } from "@/experiments/oracle/service/coingecko-adapter";
import { createOracleService } from "@/experiments/oracle/service/oracle-service";
import type { OracleReadingsResponse } from "@/experiments/oracle/api/contract";

// Composition root for this route: Phase 2 — one real adapter
// (CoinGecko's keyless public API, no credentials required). The Phase 1
// dev fixture (service/dev-adapter.ts) still exists for local testing
// without hitting the network, but this route no longer uses it — its
// data was never meant to be presented as live. A later phase can add a
// second real adapter to this array without changing anything else.
const oracleService = createOracleService([createCoinGeckoAdapter()]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset") ?? "ETH/USD";

  const readings = await oracleService.getReadings(asset);
  const body: OracleReadingsResponse = { asset, readings };

  return Response.json(body);
}
