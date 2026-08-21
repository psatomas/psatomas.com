/**
 * Renders the session's observed values over time. Deliberately not a
 * generic price chart: no zoom/pan, no candles, no volume — just enough
 * to show that a value is arriving from somewhere and changing (or not)
 * over the current session. Every point here is a real observation this
 * client actually received; nothing is interpolated or fabricated to
 * keep the line looking busy.
 */

export type GraphPoint = {
  observedAt: number;
  value: number;
};

const WIDTH = 640;
const HEIGHT = 160;
const PAD_X = 12;
const PAD_Y = 16;

export function ObservationGraph({ points }: { points: GraphPoint[] }) {
  if (points.length === 0) {
    return (
      <div
        className="flex h-40 items-center justify-center border border-border text-xs text-muted"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        Waiting for the first observation…
      </div>
    );
  }

  const minT = points[0].observedAt;
  const maxT = points[points.length - 1].observedAt;
  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  const xFor = (t: number) => {
    if (maxT === minT) return WIDTH / 2;
    return PAD_X + ((t - minT) / (maxT - minT)) * (WIDTH - PAD_X * 2);
  };
  const yFor = (v: number) => {
    if (maxV === minV) return HEIGHT / 2;
    return HEIGHT - PAD_Y - ((v - minV) / (maxV - minV)) * (HEIGHT - PAD_Y * 2);
  };

  const path = points.map((p) => `${xFor(p.observedAt)},${yFor(p.value)}`).join(" ");
  const latest = points[points.length - 1];

  return (
    <div
      className="border border-border"
      style={{
        backgroundImage:
          "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-40 w-full"
        role="img"
        aria-label={`Observed value over the current session, ${points.length} observation${points.length === 1 ? "" : "s"}, latest ${latest.value}`}
      >
        {points.length > 1 && (
          <polyline points={path} fill="none" stroke="var(--accent-dim)" strokeWidth="1.5" />
        )}

        {points.slice(0, -1).map((p) => (
          <circle
            key={p.observedAt}
            cx={xFor(p.observedAt)}
            cy={yFor(p.value)}
            r={2}
            fill="var(--muted)"
          />
        ))}

        {/* latest observation, clearly distinguished from history */}
        <circle cx={xFor(latest.observedAt)} cy={yFor(latest.value)} r={4} fill="var(--accent)" />
      </svg>
    </div>
  );
}
