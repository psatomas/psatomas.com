/**
 * Turns a title (or an author-supplied override) into a URL-safe slug —
 * lowercase, hyphen-separated, no leading/trailing hyphens. Shared by the
 * D1 repository (final validation before a write) and the authoring
 * editor (a live "this is what the URL will look like" preview as the
 * author types) so the two never compute slightly different slugs for
 * the same title. Pure and framework-free on purpose — safe to import
 * from a Client Component.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
