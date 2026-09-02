/**
 * Derives a reading-time estimate from raw Markdown/MDX source, rather
 * than asking an author to guess a number in a form field. A standard
 * ~200 words/minute rate, rounded up so a short article still reads as
 * "1 MIN READ" instead of "0 MIN READ". Deliberately crude — it counts
 * whitespace-separated tokens in the raw source (headings, code fences,
 * and all), not rendered prose word count. Good enough for the "roughly
 * how long is this" label the public article page shows; not a precision
 * instrument.
 */
export function estimateReadingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
