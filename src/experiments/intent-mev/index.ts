import type { ExperimentDefinition } from "@/types";
import { IntentMevExperiment } from "./component";

export const intentMevExperiment: ExperimentDefinition = {
  id: "intent-mev",
  index: "02",
  title: "INTENT",
  subtitle: "EXECUTION & MEV",
  description:
    "Examines how an execution intent can produce multiple candidate paths and how route selection changes the resulting MEV exposure.",
  designation: "EXPERIMENT 02 — INTENT EXECUTION × MEV",
  excerpt:
    "An intent doesn't prescribe an exact execution path. The protocol evaluates candidate execution routes and selects one according to a scoring policy — MEV risk is one input to that decision, not an afterthought.",
  Component: IntentMevExperiment,
};
