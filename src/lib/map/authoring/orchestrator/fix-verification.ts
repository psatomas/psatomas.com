/**
 * How a declared general fix is verified on its own: the base tree plus the
 * fix, without the run's content. The verification is the smallest one that
 * exercises what the fix changes. Every fix is type-checked and must pass the
 * unit suite. A fix to the MAP browser checks must also pass those checks
 * against a production build. A fix whose effect no focused check can
 * exercise is unverifiable, and the run stops instead of trusting the unit
 * suite.
 */
export type FixVerificationPlan = {
  typecheck: true;
  unit: true;
  /** A production build of the verification tree, needed by any browser check. */
  build: boolean;
  /** Browser-suite sections to run, "all" for the whole suite, or none. */
  suite: "all" | string[];
  /** Run the render check on a sample of already-authored concepts. */
  render: boolean;
  /** Files no focused check can verify. */
  unverifiable: string[];
};

const RENDER_CHECK = "e2e/map/render-check.mts";
/** Shared by every browser check, so only the whole suite plus the render check exercises them. */
const SUITE_WIDE = ["e2e/map/harness.mts", "e2e/map/run.mts"];

/**
 * `sectionsOf` names the browser-suite sections a file defines, as the fixed
 * file exports them, or returns an empty list when it defines none.
 */
export function planFixVerification(files: readonly string[], sectionsOf: (file: string) => readonly string[]): FixVerificationPlan {
  const plan: FixVerificationPlan = { typecheck: true, unit: true, build: false, suite: [], render: false, unverifiable: [] };
  const sections = new Set<string>();
  for (const file of files) {
    if (!file.startsWith("e2e/")) continue;
    plan.build = true;
    if (file === RENDER_CHECK) plan.render = true;
    else if (SUITE_WIDE.includes(file)) {
      plan.suite = "all";
      plan.render = true;
    } else {
      const defined = file.startsWith("e2e/map/") ? sectionsOf(file) : [];
      if (defined.length === 0) plan.unverifiable.push(file);
      defined.forEach((section) => sections.add(section));
    }
  }
  if (plan.suite !== "all") plan.suite = [...sections];
  return plan;
}
