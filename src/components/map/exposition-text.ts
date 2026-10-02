/**
 * Spoken wording for MAP's exposition models, generated from their data so a
 * model and its text alternative can never disagree. Kept apart from the
 * components so it can be tested without rendering.
 */

/** "label: A, then B, then C, then back to A, and again." The return is stated, never implied. */
export function describeCycle(label: string, steps: readonly string[]): string {
  return `${label}: ${steps.join(", then ")}, then back to ${steps[0]}, and again.`;
}

export type StateTransitionDirection = "forward" | "return" | "stay";

/** Where a transition goes relative to the listed order of states: on, back, or nowhere. */
export function transitionDirection(states: readonly string[], from: string, to: string): StateTransitionDirection {
  if (from === to) return "stay";
  return states.indexOf(to) < states.indexOf(from) ? "return" : "forward";
}

/** A state's outgoing transitions, in the order they were given. */
export function transitionsFrom<T extends { from: string }>(transitions: readonly T[], state: string): T[] {
  return transitions.filter((transition) => transition.from === state);
}

/** States without an outgoing transition: where the system ends. */
export function finalStates(states: readonly string[], transitions: readonly { from: string }[]): string[] {
  return states.filter((state) => transitionsFrom(transitions, state).length === 0);
}

const listed = (names: readonly string[]) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/**
 * "label: starts in A. From A, when X, to B. From B, when Y, back to A. B is
 * final." Every transition keeps its direction and its event or condition;
 * returns are stated as returns, never left for the reader to infer.
 */
export function describeState(label: string, states: readonly string[], transitions: readonly { from: string; to: string; when: string }[]): string {
  const said = states.flatMap((state) =>
    transitionsFrom(transitions, state).map(({ from, to, when }) => {
      const direction = transitionDirection(states, from, to);
      return direction === "stay" ? `From ${from}, when ${when}, it stays in ${from}.` : `From ${from}, when ${when}, ${direction === "return" ? "back " : ""}to ${to}.`;
    }),
  );
  const finals = finalStates(states, transitions);
  const ending = finals.length ? [`${listed(finals)} ${finals.length === 1 ? "is" : "are"} final.`] : [];
  return [`${label}: starts in ${states[0]}.`, ...said, ...ending].join(" ");
}
