import type { ExperimentDefinition } from "@/types";
import { EvmExperiment } from "./component";

export const evmExperiment: ExperimentDefinition = {
  id: "evm",
  index: "01",
  title: "EVM",
  subtitle: "EXECUTION MODEL",
  Component: EvmExperiment,
};
