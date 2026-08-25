/**
 * Protocol Lab experiment registry.
 *
 * This is the ONLY place that knows about all three experiments at once.
 * The Lab shell (components/lab/protocol-lab.tsx) depends only on this
 * file — never on an individual experiment module — and no experiment
 * depends on this file or on any other experiment. That's what makes each
 * one independently addable/removable/replaceable: adding a new experiment
 * means creating its own src/experiments/<name>/ directory and adding one
 * import + one array entry below; removing one means deleting its
 * directory and this one entry. Nothing else changes.
 *
 * `enabled` lives here rather than on the experiment itself: whether an
 * experiment is currently exposed is a rollout decision made by whoever
 * assembles the Lab, not something an experiment should declare about
 * itself.
 */

import type { ExperimentDefinition, ExperimentId } from "@/types";
import { evmExperiment } from "@/experiments/evm";
import { intentMevExperiment } from "@/experiments/intent-mev";
import { oracleExperiment } from "@/experiments/oracle";

export type ExperimentEntry = ExperimentDefinition & { enabled: boolean };

const definitions: ExperimentDefinition[] = [
  evmExperiment,
  intentMevExperiment,
  oracleExperiment,
];

export const experiments: ExperimentEntry[] = definitions.map((def) => ({
  ...def,
  enabled: true,
}));

export function getExperiment(id: ExperimentId | null): ExperimentEntry | undefined {
  if (!id) return undefined;
  return experiments.find((e) => e.id === id);
}
