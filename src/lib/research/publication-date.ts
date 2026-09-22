/** One stored representation: a UTC calendar date, never an audit timestamp.
 * Republishing preserves the original date. Invalid existing values require
 * an explicit data repair; publishing must not silently normalize them. */
export function publicationDate(existing: string | null, now: Date): string {
  const value = existing ?? now.toISOString().slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) ||
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid Research publication date: "${value}"; expected YYYY-MM-DD`);
  }
  return value;
}
