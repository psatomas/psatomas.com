/**
 * Homepage MAP preview: the 27 L0 domains as presentation labels, in order.
 * This is not taxonomy data. A topic becomes a targeted entry into /map only
 * when it names an existing placement by identity; until the L0 placements
 * are authored in the MAP domain, none do. Never match placements by label.
 */
export type MapPreviewTopic = {
  label: string;
  placementId?: string;
};

export const MAP_PREVIEW_TOPICS: readonly MapPreviewTopic[] = [
  { label: "Foundations" },
  { label: "Computation & Execution" },
  { label: "State & Data" },
  { label: "Consensus & Ordering" },
  { label: "Networks & Infrastructure" },
  { label: "Cryptography & Proofs" },
  { label: "Storage & Availability" },
  { label: "Identity, Accounts & Authority" },
  { label: "Oracles & External Reality" },
  { label: "Economics & Mechanism Design" },
  { label: "Markets & Financial Protocols" },
  { label: "MEV & Execution Markets" },
  { label: "Intents & Coordination" },
  { label: "Governance & Institutions" },
  { label: "Scaling & Modular Systems" },
  { label: "Interoperability & Abstraction" },
  { label: "Security, Correctness & Resilience" },
  { label: "Protocol Architecture" },
  { label: "Protocol Design & Lifecycle" },
  { label: "AI & Intelligent Systems" },
  { label: "Machine Economy" },
  { label: "Autonomous Coordination" },
  { label: "Autonomous Execution" },
  { label: "Autonomous Organizations" },
  { label: "Autonomous Protocols" },
  { label: "Autonomous Economy" },
  { label: "Frontier Systems" },
];
