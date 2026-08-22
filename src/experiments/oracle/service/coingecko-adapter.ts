import type { AssetSymbol, OracleObservation } from "../domain/model.ts";
import type { OracleSourceAdapter } from "./oracle-source.ts";

/**
 * CoinGecko Keyless Public API — https://docs.coingecko.com/docs/keyless-public-api
 * No API key required. Verified against CoinGecko's own docs before
 * writing this, not invented:
 *
 *   GET https://api.coingecko.com/api/v3/simple/price
 *     ?ids=<coin id>&vs_currencies=<currency>&include_last_updated_at=true
 *
 *   → { "<coin id>": { "<currency>": <number>, "last_updated_at": <unix seconds> } }
 *
 * Rate limit for keyless usage is ~10-30 calls/min (dynamic, no key) —
 * fine for on-demand fetches from a low-traffic demo; not intended for
 * scheduled polling (see oracle-service.ts / route.ts for why nothing
 * polls this yet).
 */

const BASE_URL = "https://api.coingecko.com/api/v3/simple/price";
const REQUEST_TIMEOUT_MS = 5_000;

/** This adapter's asset vocabulary is CoinGecko-specific (coin id +
 * vs_currency) and must never leak past this file — everything above
 * the adapter boundary only ever sees our own AssetSymbol ("ETH/USD"). */
const ASSET_MAP: Record<AssetSymbol, { coinId: string; vsCurrency: string; unit: string }> = {
  "ETH/USD": { coinId: "ethereum", vsCurrency: "usd", unit: "USD" },
  "BTC/USD": { coinId: "bitcoin", vsCurrency: "usd", unit: "USD" },
  "SOL/USD": { coinId: "solana", vsCurrency: "usd", unit: "USD" },
};

/** Assets this adapter can actually serve — lets a consumer (e.g. an
 * asset selector) discover real options instead of hardcoding a list
 * that could drift out of sync with ASSET_MAP. */
export const SUPPORTED_ASSETS = Object.keys(ASSET_MAP);

type CoinGeckoResponse = Record<string, Record<string, number> & { last_updated_at?: number }>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function createCoinGeckoAdapter(): OracleSourceAdapter {
  return {
    id: "coingecko",
    async fetchObservation(asset: AssetSymbol): Promise<OracleObservation | null> {
      const mapping = ASSET_MAP[asset];
      if (!mapping) return null; // legitimately unsupported — not a failure

      const url = `${BASE_URL}?ids=${mapping.coinId}&vs_currencies=${mapping.vsCurrency}&include_last_updated_at=true`;

      let res: Response;
      try {
        // Explicit no-store: this must hit CoinGecko fresh every call,
        // not rely on whatever Next's fetch-caching default happens to
        // be for this version. See Phase 2 notes on why no caching
        // layer is introduced yet.
        res = await fetch(url, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: "no-store",
          // CoinGecko's keyless API 403s any request without a
          // "descriptive" User-Agent (confirmed against the real API —
          // Cloudflare Workers' fetch doesn't set one by default, unlike
          // Node's, which is why this only surfaced under workerd).
          headers: { "User-Agent": "psatomas.com Oracle Experiment (https://psatomas.com)" },
        });
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          throw new Error(`CoinGecko request timed out after ${REQUEST_TIMEOUT_MS}ms`);
        }
        throw new Error(
          `CoinGecko request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (res.status === 429) {
        throw new Error("CoinGecko rate limit exceeded (429)");
      }
      if (!res.ok) {
        throw new Error(`CoinGecko request failed with status ${res.status}`);
      }

      let data: CoinGeckoResponse;
      try {
        data = await res.json();
      } catch {
        throw new Error("CoinGecko returned a response that was not valid JSON");
      }

      const entry = data[mapping.coinId];
      const value = entry?.[mapping.vsCurrency];
      const observedAtSeconds = entry?.last_updated_at;

      if (!isFiniteNumber(value) || !isFiniteNumber(observedAtSeconds)) {
        throw new Error(
          `CoinGecko returned a malformed response for ${mapping.coinId}/${mapping.vsCurrency}`,
        );
      }

      return {
        asset,
        value,
        unit: mapping.unit,
        observedAt: observedAtSeconds * 1000, // CoinGecko gives seconds; our domain uses ms
      };
    },
  };
}
