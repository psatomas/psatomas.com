import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createCoinGeckoAdapter } from "@/experiments/oracle/service/coingecko-adapter";
import { createOracleService, type OracleService } from "@/experiments/oracle/service/oracle-service";
import { createResilientObservationCache } from "@/experiments/oracle/service/observation-cache";
import type { OracleReadingsResponse } from "@/experiments/oracle/api/contract";

/**
 * Resolves the Oracle KV binding fresh on every call — never captured or
 * cached. Under `next dev` / `opennextjs-cloudflare preview`, Miniflare
 * invalidates ("poisons") every previously issued binding stub whenever
 * it reloads its runtime options, which can happen mid-dev-server-
 * lifetime — well after the service below would already have captured
 * one, if it captured the binding itself instead of a resolver for it.
 * A KVNamespace obtained on one call must never be reused on a later
 * one. In a real deployed Worker isolate this costs nothing extra: the
 * binding never changes there, so "resolve every call" and "resolve
 * once" are equally correct — this just also happens to be correct
 * under Miniflare's reload behavior, which "resolve once" is not.
 */
async function resolveOracleKv() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.ORACLE_CACHE;
  } catch {
    // No Cloudflare context reachable at all — createResilientObservationCache
    // falls back to its in-memory cache in this case.
    return undefined;
  }
}

// Composition root for this route. The service is built lazily, once per
// warm isolate rather than once per request — because that's what lets
// its in-flight de-dup (see oracle-service.ts) actually coalesce
// concurrent requests on the same isolate. That's safe to cache across
// requests and reloads alike because, unlike the KV binding above,
// nothing about it is Cloudflare-specific: it's plain JS state (a Map of
// in-flight promises) plus the resilient cache, which itself never
// stores a binding — only the resolver function that fetches one fresh
// each time it's actually needed. See resolveOracleKv above and
// createResilientObservationCache in observation-cache.ts.
let servicePromise: Promise<OracleService> | null = null;

function getOracleService(): Promise<OracleService> {
  if (!servicePromise) {
    servicePromise = Promise.resolve(
      createOracleService([createCoinGeckoAdapter()], {
        cache: createResilientObservationCache(resolveOracleKv),
      }),
    );
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
