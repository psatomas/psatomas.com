"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { StatusBadge } from "@/components/lab/status-badge";
import { FlowBox, FlowArrow } from "@/components/lab/flow";
import { fetchOracleReadings } from "./api/client";
import type { OracleReading } from "./domain/model";
import { SUPPORTED_ASSETS } from "./service/coingecko-adapter";
import { ObservationGraph, type GraphPoint } from "./observation-graph";

// Conservative against CoinGecko's keyless rate limit (~10-30 calls/min,
// no key) — this is one browser tab polling on demand, not a scheduled
// job, so this stays deliberately far under any reasonable limit.
const POLL_INTERVAL_MS = 45_000;

// Bounded session history — this experiment shows what THIS client has
// observed during THIS session, not the provider's historical series
// (CoinGecko's keyless /simple/price endpoint doesn't expose history at
// all — there is no "provider history" to fall back on here).
const MAX_HISTORY = 24;

type ConnectionState = "CONNECTING" | "LIVE" | "STALE" | "ERROR" | "DISCONNECTED";

const connectionCopy: Record<ConnectionState, { label: string; variant: "accent" | "warn" | "neutral" }> = {
  CONNECTING: { label: "CONNECTING", variant: "neutral" },
  LIVE: { label: "LIVE", variant: "accent" },
  STALE: { label: "STALE", variant: "warn" },
  ERROR: { label: "ERROR", variant: "warn" },
  DISCONNECTED: { label: "DISCONNECTED", variant: "warn" },
};

function formatTime(ms: number) {
  return new Date(ms).toISOString().slice(11, 19) + " UTC";
}

/**
 * Outer shell: owns which asset is selected and whether polling is
 * paused. Rendering <OracleFeed key={asset}> means switching assets
 * remounts the feed — a fresh component instance with fresh initial
 * state — rather than an effect manually resetting state on every
 * asset change.
 */
export function OraclesExperiment() {
  const [asset, setAsset] = useState<string>(SUPPORTED_ASSETS[0]);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  return (
    <div className="flex flex-col gap-10 p-6 sm:p-8">
      <div>
        <MonoLabel className="text-dim">EXPERIMENT 03 — ORACLE · LIVE OBSERVATION</MonoLabel>
        <p className="mt-2 max-w-xl text-sm text-muted">
          An external source produces a value. An oracle observes it, timestamps its own
          reception, and evaluates freshness before a protocol would ever act on it. Everything
          below is real data from that pipeline — not a simulation.
        </p>
      </div>

      {/* SYSTEM VISUALIZATION */}
      <div className="flex flex-col gap-3">
        <MonoLabel>SYSTEM VISUALIZATION</MonoLabel>
        <div className="flex flex-wrap items-center gap-2">
          <FlowBox>COINGECKO</FlowBox>
          <FlowArrow />
          <FlowBox>ORACLE ADAPTER</FlowBox>
          <FlowArrow />
          <FlowBox>ORACLE SERVICE</FlowBox>
          <FlowArrow />
          <FlowBox>ORACLE API</FlowBox>
          <FlowArrow />
          <FlowBox emphasis>PROTOCOL LAB</FlowBox>
        </div>
      </div>

      {/* INTERACTIVE CONTROLS */}
      <div className="flex flex-col gap-4 border-t border-border pt-8">
        <div className="flex items-center justify-between">
          <MonoLabel>INTERACTIVE CONTROLS</MonoLabel>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              className="font-mono text-[10px] tracking-[0.1em] text-muted hover:text-accent transition-colors"
            >
              {paused ? "RESUME" : "PAUSE"}
            </button>
            <button
              type="button"
              onClick={() => setResetToken((t) => t + 1)}
              className="font-mono text-[10px] tracking-[0.1em] text-muted hover:text-accent transition-colors"
            >
              RESET HISTORY
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUPPORTED_ASSETS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAsset(a)}
              className={`border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] transition-colors ${
                asset === a
                  ? "border-accent text-accent"
                  : "border-border-strong text-muted hover:text-foreground"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted">
          Polling every {POLL_INTERVAL_MS / 1000}s while this tab is visible
          {paused ? " — currently paused." : "."} Session history is local to this browser tab,
          bounded to the last {MAX_HISTORY} observations — CoinGecko&apos;s free endpoint doesn&apos;t
          expose historical data, so this is not the provider&apos;s own history.
        </p>
      </div>

      <OracleFeed
        key={`${asset}-${resetToken}`}
        asset={asset}
        paused={paused}
      />

      {/* TECHNICAL DETAILS */}
      <div className="flex flex-col gap-2 border-t border-border pt-8">
        <MonoLabel>TECHNICAL DETAILS</MonoLabel>
        <p className="max-w-xl text-xs text-muted">
          Source: CoinGecko&apos;s keyless public API, fetched server-side by the Oracle API — this
          browser never calls CoinGecko directly. &ldquo;Observed at&rdquo; is CoinGecko&apos;s own
          timestamp for the value; &ldquo;received at&rdquo; is when this client&apos;s request
          reached the Oracle API. Their difference is latency — the real gap between something
          happening off-chain and a protocol finding out about it. A future phase can add an
          on-chain observation alongside this one for direct comparison; nothing here assumes
          there will only ever be one source.
        </p>
      </div>
    </div>
  );
}

/**
 * Owns the actual live data: the current reading, session history, and
 * connection state. Remounted (via the parent's `key`) whenever the
 * asset or an explicit reset changes, so there's no derived-state effect
 * here — every render of this component starts fresh on purpose.
 */
function OracleFeed({ asset, paused }: { asset: string; paused: boolean }) {
  const [reading, setReading] = useState<OracleReading | null>(null);
  const [history, setHistory] = useState<GraphPoint[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("CONNECTING");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;

    function applySuccess(latest: OracleReading) {
      if (cancelled) return;
      setReading(latest);
      setLastPolledAt(Date.now());
      setLastError(null);

      if (latest.status === "UNAVAILABLE") {
        setConnection("ERROR");
        return;
      }
      setConnection(latest.status === "STALE" ? "STALE" : "LIVE");

      const obs = latest.observation;
      if (!obs) return;
      setHistory((current) => {
        const last = current[current.length - 1];
        // Same observedAt as last time means the provider hasn't produced
        // a new reading yet — the graph must not gain a point for it.
        if (last && last.observedAt === obs.observedAt) return current;
        return [...current, { observedAt: obs.observedAt, value: obs.value }].slice(-MAX_HISTORY);
      });
    }

    function applyFailure(error: unknown) {
      if (cancelled) return;
      // We couldn't even reach our own API — distinct from the API
      // reaching us but reporting the provider as unavailable.
      setConnection("DISCONNECTED");
      setLastError(error instanceof Error ? error.message : String(error));
    }

    function runOnce() {
      if (isFetchingRef.current) return; // never let a slow request overlap the next tick
      isFetchingRef.current = true;
      fetchOracleReadings(asset)
        // Phase 2 composes exactly one adapter today; a future
        // multi-source phase would need to handle more than one entry.
        .then((response) => applySuccess(response.readings[0]))
        .catch(applyFailure)
        .finally(() => {
          isFetchingRef.current = false;
        });
    }

    runOnce();
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") runOnce();
    }, POLL_INTERVAL_MS);

    function handleVisibility() {
      if (document.visibilityState === "visible") runOnce();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      // Free the in-flight guard immediately on cleanup — otherwise a
      // still-pending fetch from this (now-cancelled) invocation blocks
      // the next effect invocation's own runOnce() from ever firing.
      // This matters in dev (React Strict Mode deliberately double-
      // invokes effects) and for any real fast dependency change.
      isFetchingRef.current = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [asset, paused]);

  const copy = connectionCopy[connection];
  const obs = reading?.observation ?? null;

  return (
    <>
      {/* LIVE VALUE GRAPH */}
      <div className="flex flex-col gap-3 border-t border-border pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <MonoLabel>OBSERVED VALUE — SESSION HISTORY</MonoLabel>
            <StatusBadge variant={copy.variant}>{copy.label}</StatusBadge>
          </div>
          <span className="font-mono text-xs text-muted">
            {history.length} point{history.length === 1 ? "" : "s"}
          </span>
        </div>
        <ObservationGraph points={history} />
      </div>

      {/* LIVE STATE / METADATA */}
      <div className="flex flex-col gap-3 border-t border-border pt-8">
        <MonoLabel>LIVE STATE</MonoLabel>

        {connection === "CONNECTING" && !reading ? (
          <p className="text-sm text-muted">Requesting the first observation…</p>
        ) : connection === "DISCONNECTED" ? (
          <p className="text-sm text-warn">
            Could not reach the Oracle API{lastError ? ` — ${lastError}` : ""}.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Stat label="SOURCE" value={reading?.source ?? "—"} />
            <Stat label="ASSET" value={reading?.asset ?? "—"} />
            <Stat
              label="VALUE"
              value={obs ? `${obs.value.toLocaleString()} ${obs.unit}` : "—"}
              emphasis
            />
            <Stat label="OBSERVED AT" value={obs ? formatTime(obs.observedAt) : "—"} />
            <Stat label="RECEIVED AT" value={reading ? formatTime(reading.retrievedAt) : "—"} />
            <Stat
              label="LATENCY"
              value={reading?.latencyMs != null ? `${Math.round(reading.latencyMs / 1000)}s` : "—"}
            />
            <Stat
              label="FRESHNESS"
              value=""
              badge={
                reading?.freshness ? (
                  <StatusBadge variant={reading.freshness === "STALE" ? "warn" : "neutral"}>
                    {reading.freshness}
                  </StatusBadge>
                ) : (
                  <span className="font-mono text-sm text-muted">—</span>
                )
              }
            />
            <Stat label="LAST POLLED" value={lastPolledAt ? formatTime(lastPolledAt) : "—"} />
          </div>
        )}
        {reading?.status === "UNAVAILABLE" && <p className="text-xs text-warn">{reading.reason}</p>}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  badge,
  emphasis = false,
}: {
  label: string;
  value: string;
  badge?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <MonoLabel className="text-dim">{label}</MonoLabel>
      {badge ?? (
        <span className={`font-mono text-sm ${emphasis ? "text-accent" : "text-foreground"}`}>
          {value}
        </span>
      )}
    </div>
  );
}
