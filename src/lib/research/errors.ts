/**
 * Split out from d1-repository.ts specifically so this class can be
 * imported without pulling in the rest of that module — d1-repository.ts
 * imports markdown-content.tsx (JSX) at its top level for the public
 * read side, which Node's plain `--test` runner can't parse (no JSX
 * transform in that pipeline). authoring-service.ts needs this error
 * class for a synchronous `instanceof` check but must stay loadable
 * under `node --test` with only fake dependencies injected — see
 * authoring-service.test.ts — so it imports this file instead of
 * d1-repository.ts directly.
 */

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
