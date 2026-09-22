/** Shared by the repository and authoring service so error handling does
 * not depend on the persistence implementation. */

/** Thrown by createDraft/updateDraft when the requested (or derived)
 * slug already belongs to a different article. A distinct class rather
 * than a generic Error so the authoring service (and, through it, the
 * UI) can distinguish "pick a different slug" from any other failure. */
export class SlugTakenError extends Error {
  readonly slug: string;

  // A plain field assignment, not a TS constructor parameter property —
  // Node's `--test` runner type-strips rather than fully transforms
  // TypeScript, and parameter properties are a real syntax transform
  // (they also generate a `this.x = x` assignment), not just a type
  // annotation, so strip-only mode rejects them outright.
  constructor(slug: string) {
    super(`The slug "${slug}" is already in use by another article.`);
    this.name = "SlugTakenError";
    this.slug = slug;
  }
}
