/**
 * Type on a canvas, shared by the share receipt and the MoodStamp image.
 *
 * Both are posters drawn straight onto a canvas, which reaches the page's
 * loaded Archivo faces and can measure text — so a long line is fitted or
 * wrapped rather than clipped.
 */

/* ------------------------------- typography ------------------------------- */

/*
 * next/font scopes the family name, so the literal "Archivo Black" is not
 * registered. The CSS variables hold the real names — read them at runtime and
 * keep a heavy system stack behind them.
 */
export function stack(variable: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

export function displayFont(size: number): string {
  return `400 ${size}px ${stack('--font-archivo-black', "'Arial Black', Impact, sans-serif")}`;
}

export function bodyFont(size: number, weight: number = 700): string {
  return `${weight} ${size}px ${stack('--font-archivo', "system-ui, 'Helvetica Neue', Arial, sans-serif")}`;
}

/** Canvas will not draw with a face the document has not finished loading. */
export async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([document.fonts.load(displayFont(96)), document.fonts.load(bodyFont(32))]);
    await document.fonts.ready;
  } catch {
    // A missing face falls back to the system stack rather than failing.
  }
}

export function setTracking(context: CanvasRenderingContext2D, value: string): void {
  // Supported everywhere that matters; harmless where it is not.
  (context as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = value;
}

/** Largest size at or below `max` that fits `text` within `maxWidth`. */
export function fitSize(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  max: number,
  min: number,
  font: (size: number) => string,
): number {
  let size = max;
  while (size > min) {
    context.font = font(size);
    if (context.measureText(text).width <= maxWidth) break;
    size -= Math.max(1, Math.round(size * 0.04));
  }
  context.font = font(size);
  return size;
}

/** Greedy wrap, ellipsing the final line rather than clipping it. */
export function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && current) lines.push(current);

  if (lines.length === maxLines) {
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length || context.measureText(lines[maxLines - 1]).width > maxWidth) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }

  return lines;
}
