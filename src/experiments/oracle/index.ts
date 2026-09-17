import type { ExperimentDefinition } from "@/types";
import { OraclesExperiment } from "./component";

export const oracleExperiment: ExperimentDefinition = {
  id: "oracle",
  index: "03",
  title: "ORACLES",
  subtitle: "ON-CHAIN × OFF-CHAIN DATA",
  description:
    "Examines how external observations cross the off-chain/on-chain boundary, including freshness, caching, and failure-state behavior.",
  designation: "EXPERIMENT 03 — ORACLE · LIVE OBSERVATION",
  excerpt:
    "An external source produces a value. An oracle observes it, timestamps its own reception, and evaluates freshness before a protocol would ever act on it. Everything below is real data from that pipeline — not a simulation.",
  Component: OraclesExperiment,
};
