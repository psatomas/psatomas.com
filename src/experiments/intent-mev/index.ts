import type { ExperimentDefinition } from "@/types";
import { IntentMevExperiment } from "./component";

export const intentMevExperiment: ExperimentDefinition = {
  id: "intent-mev",
  index: "02",
  title: "INTENT",
  subtitle: "EXECUTION & MEV",
  description:
    "Examines how an execution intent can produce multiple candidate paths and how route selection changes the resulting MEV exposure.",
  Component: IntentMevExperiment,
};
