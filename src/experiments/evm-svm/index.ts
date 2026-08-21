import type { ExperimentDefinition } from "@/types";
import { EvmSvmExperiment } from "./component";

export const evmSvmExperiment: ExperimentDefinition = {
  id: "evm-svm",
  index: "01",
  title: "EVM × SVM",
  subtitle: "EXECUTION MODELS",
  Component: EvmSvmExperiment,
};
