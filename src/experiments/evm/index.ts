import type { ExperimentDefinition } from "@/types";
import { EvmExperiment } from "./component";

export const evmExperiment: ExperimentDefinition = {
  id: "evm",
  index: "01",
  title: "EVM",
  subtitle: "EXECUTION MODEL",
  description:
    "Explores how sequential transactions transform EVM state and how execution outcomes become the starting state for subsequent calls.",
  designation: "EXPERIMENT 01 — EVM EXECUTION MODEL",
  excerpt:
    "A transaction executes against Ethereum's current state, consumes gas, and either commits its resulting state changes atomically or reverts them. This experiment isolates that execution model across state, storage, sequential transactions, and nested message calls.",
  Component: EvmExperiment,
};
