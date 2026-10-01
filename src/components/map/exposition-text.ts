/**
 * Spoken wording for MAP's exposition models, generated from their data so a
 * model and its text alternative can never disagree. Kept apart from the
 * components so it can be tested without rendering.
 */

/** "label: A, then B, then C, then back to A, and again." The return is stated, never implied. */
export function describeCycle(label: string, steps: readonly string[]): string {
  return `${label}: ${steps.join(", then ")}, then back to ${steps[0]}, and again.`;
}

