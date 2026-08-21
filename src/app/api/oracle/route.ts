import { createDevOracleAdapter } from "@/experiments/oracle/service/dev-adapter";
import { createOracleService } from "@/experiments/oracle/service/oracle-service";
import type { OracleReadingsResponse } from "@/experiments/oracle/api/contract";

// Composition root for this route: today, one adapter — the Phase 1 dev
// fixture. A later phase adds a real adapter here; nothing in the Oracle
// domain/service layer, or in this route, needs to change shape for that.
const oracleService = createOracleService([createDevOracleAdapter()]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset") ?? "ETH/USD";

  const readings = await oracleService.getReadings(asset);
  const body: OracleReadingsResponse = { asset, readings };

  return Response.json(body);
}
