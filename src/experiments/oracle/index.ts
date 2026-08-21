import type { ExperimentDefinition } from "@/types";
import { OraclesExperiment } from "./component";

export const oracleExperiment: ExperimentDefinition = {
  id: "oracle",
  index: "03",
  title: "ORACLES",
  subtitle: "ON-CHAIN × OFF-CHAIN DATA",
  Component: OraclesExperiment,
};
