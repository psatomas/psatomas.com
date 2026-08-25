import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createCoinGeckoAdapter } from "@/experiments/oracle/service/coingecko-adapter";
import { createOracleService, type OracleService } from "@/experiments/oracle/service/oracle-service";
import {
  createInMemoryObservationCache,
  createKvObservationCache,
} from "@/experiments/oracle/service/observation-cache";
import type { OracleReadingsResponse } from "@/experiments/oracle/api/contract";

// Composition root for this route. The service is built lazily, once per
// warm isolate rather than once per request — see getOracleService()
// below — because the Cloudflare KV binding it needs is only reachable
// inside a request's async context, not at module load time. Reusing the
// same service instance across requests on a warm isolate is also what
// lets its in-flight de-dup (see oracle-service.ts) actually coalesce
// concurrent requests; that's a bonus, not what makes the cache correct
// across isolates — the KV cache is (see observation-cache.ts).
let servicePromise: Promise<OracleService> | null = null;

async function getOracleService(): Promise<OracleService> {
  if (!servicePromise) {
    servicePromise = (async () => {
      let cache;
      try {
        const { env } = await getCloudflareContext({ async: true });
        cache = env.ORACLE_CACHE
          ? createKvObservationCache(env.ORACLE_CACHE)
          : createInMemoryObservationCache();
      } catch {
        // No Cloudflare context reachable at all — fail toward "still
        // serves readings locally" rather than toward a broken route.
        cache = createInMemoryObservationCache();
      }
      return createOracleService([createCoinGeckoAdapter()], { cache });
    })();
  }
  return servicePromise;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset") ?? "ETH/USD";

  const oracleService = await getOracleService();
  const readings = await oracleService.getReadings(asset);
  const body: OracleReadingsResponse = { asset, readings };

  return Response.json(body);
}
