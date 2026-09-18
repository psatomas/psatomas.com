/** Conservative advance estimates for the bundled Geist face, in em.
 * Explicit lines keep layout deterministic without browser font measurement. */
function advance(character: string): number {
  if (/\s/.test(character)) return 0.3;
  if (/[ilI.,:;'!|]/.test(character)) return 0.35;
  if (/[MWmw@]/.test(character)) return 1;
  return /[A-Z]/.test(character) ? 0.8 : 0.65;
}

function width(text: string): number {
  return Array.from(text).reduce((sum, character) => sum + advance(character), 0);
}

export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    if (line && width(`${line} ${word}`) * fontSize > maxWidth) {
      lines.push(line);
      line = "";
    }
    // Break oversized tokens too, so even an unbroken title stays on canvas.
    for (const character of (line ? ` ${word}` : word)) {
      if (line && width(line + character) * fontSize > maxWidth) {
        lines.push(line.trim());
        line = "";
      }
      line += character;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function titleLayout(title: string) {
  for (const fontSize of [64, 56, 48]) {
    const lines = wrapText(title, fontSize, 1040);
    if (lines.length <= 4) return { lines, fontSize };
  }
  // Only unusually large future titles need an abbreviated image. HTML
  // metadata retains the full title; never shrink it to illegible type.
  const lines = wrapText(title, 48, 1040).slice(0, 4);
  lines[3] = lines[3].slice(0, -2).trimEnd() + "…";
  return { lines, fontSize: 48 };
}

export function supportingLine(text: string | undefined): string {
  if (!text) return "";
  const lines = wrapText(text, 26, 1040);
  return lines.length > 1 ? lines[0].trimEnd() + "…" : lines[0];
}
