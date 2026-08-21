import type { ExperimentDefinition } from "@/types";
import { IntentMevExperiment } from "./component";

export const intentMevExperiment: ExperimentDefinition = {
  id: "intent-mev",
  index: "02",
  title: "INTENT",
  subtitle: "EXECUTION & MEV",
  Component: IntentMevExperiment,
};
