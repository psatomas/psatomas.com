/**
 * Homepage MAP preview topics: presentation labels, not taxonomy data. A
 * topic becomes a targeted entry into /map only when it names an existing
 * placement by identity; the rest stay informational until their regions
 * are authored. Never match placements by label.
 */
export type MapPreviewTopic = {
  label: string;
  placementId?: string;
};

export const MAP_PREVIEW_TOPICS: readonly MapPreviewTopic[] = [
  { label: "Foundations" },
  { label: "Computation & State" },
  { label: "Consensus", placementId: "consensus" },
  { label: "Cryptography & Verification" },
  { label: "Identity & Authority" },
  { label: "Economics & Incentives" },
  { label: "Intents" },
  { label: "Protocol Architecture" },
  { label: "Autonomous Systems" },
];
