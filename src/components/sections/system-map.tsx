"use client";

import { useState } from "react";

type Node = {
  id: string;
  label: string;
  descriptor: string;
  x: number;
  y: number;
};

const nodes: Node[] = [
  { id: "evm", label: "EVM", descriptor: "STATE TRANSITIONS", x: 70, y: 56 },
  { id: "solidity", label: "SOLIDITY", descriptor: "SMART CONTRACTS", x: 330, y: 56 },
  { id: "execution", label: "EXECUTION", descriptor: "POLICY / ROUTING", x: 200, y: 192 },
  { id: "oracles", label: "ORACLES", descriptor: "EXTERNAL DATA", x: 38, y: 306 },
  { id: "mev", label: "MEV", descriptor: "ORDER FLOW", x: 362, y: 306 },
  { id: "indexing", label: "INDEXING", descriptor: "EVENT STATE", x: 200, y: 366 },
];

const edges: Array<[string, string]> = [
  ["evm", "execution"],
  ["solidity", "execution"],
  ["oracles", "execution"],
  ["mev", "execution"],
  ["indexing", "execution"],
  ["evm", "solidity"],
];

const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

export function SystemMap() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <svg
      viewBox="0 0 400 400"
      className="h-auto w-full max-w-md"
      role="img"
      aria-label="Map of connected protocol engineering domains: EVM, Solidity, Execution, Oracles, MEV, Indexing"
    >
      {/* coordinate grid backdrop */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="var(--grid-line)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="url(#grid)" />

      {/* edges */}
      {edges.map(([a, b]) => {
        const active = hovered === a || hovered === b;
        const na = byId[a];
        const nb = byId[b];
        return (
          <line
            key={`${a}-${b}`}
            x1={na.x}
            y1={na.y}
            x2={nb.x}
            y2={nb.y}
            stroke={active ? "var(--accent)" : "var(--border-strong)"}
            strokeWidth={active ? 1.25 : 1}
            className="transition-[stroke,stroke-width] duration-300"
          />
        );
      })}

      {/* nodes */}
      {nodes.map((node) => {
        const active = hovered === node.id;
        return (
          <g
            key={node.id}
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-default"
          >
            {/* generous invisible hit-area so hover isn't fiddly */}
            <circle cx={node.x} cy={node.y} r={28} fill="transparent" />
            <circle
              cx={node.x}
              cy={node.y}
              r={active ? 5 : 4}
              fill={active ? "var(--accent)" : "var(--background)"}
              stroke={active ? "var(--accent)" : "var(--muted)"}
              strokeWidth="1.25"
              className="transition-[r,fill,stroke] duration-300"
            />
            <text
              x={node.x}
              y={node.y - 14}
              textAnchor="middle"
              className="font-mono transition-[fill] duration-300"
              style={{
                fontSize: "11px",
                letterSpacing: "0.08em",
                fill: active ? "var(--accent)" : "var(--foreground)",
              }}
            >
              {node.label}
            </text>
            <text
              x={node.x}
              y={node.y + 20}
              textAnchor="middle"
              className="transition-opacity duration-300"
              style={{
                fontSize: "8.5px",
                letterSpacing: "0.06em",
                fill: "var(--muted)",
                opacity: active ? 1 : 0,
              }}
            >
              {node.descriptor}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
