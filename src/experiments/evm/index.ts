import type { ExperimentDefinition } from "@/types";
import { EvmExperiment } from "./component";

export const evmExperiment: ExperimentDefinition = {
  id: "evm",
  index: "01",
  title: "EVM",
  subtitle: "EXECUTION MODEL",
  description:
    "Explores how sequential transactions transform EVM state and how execution outcomes become the starting state for subsequent calls.",
  Component: EvmExperiment,
};
