import type { ExperimentDefinition } from "@/types";
import { OraclesExperiment } from "./component";

export const oracleExperiment: ExperimentDefinition = {
  id: "oracle",
  index: "03",
  title: "ORACLES",
  subtitle: "ON-CHAIN × OFF-CHAIN DATA",
  description:
    "Examines how external observations cross the off-chain/on-chain boundary, including freshness, caching, and failure-state behavior.",
  Component: OraclesExperiment,
};
