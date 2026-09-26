/**
 * The share receipt — a collectible poster of what one person did to one item.
 *
 * Drawn straight onto a canvas rather than composed as an SVG string. An SVG
 * loaded into an `<img>` renders in an isolated context with no access to the
 * document's fonts, so the old receipt silently fell back to a system face —
 * fatal for a design carried by poster typography. Canvas reaches the loaded
 * Archivo faces, measures text properly (so a long headline can be fitted
 * rather than clipped), and makes the modal preview and the exported file the
 * same pixels by construction.
 *
 * Three variants, one system: an egg receipt in carrot, a medal receipt in
 * gold, and — when the viewer has not reacted — a neutral public status card
 * that makes no personal claim at all.
 */

import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactTotals, ArtifactType, UserContribution } from '@/lib/domain/types';

export type ReceiptFormat = 'story' | 'square';
export type ReceiptVariant = 'egg' | 'medal' | 'public';

export interface ReceiptInput {
  title: string;
  artifactType: ArtifactType;
  category: string;
  imageUrl: string | null;
  totals: ArtifactTotals;
  contribution?: UserContribution | null;
  /** The page this receipt points back to. */
  url: string;
}

export const FORMATS: Array<{ id: ReceiptFormat; label: string; hint: string; ratio: number }> = [
  { id: 'story', label: 'Story', hint: '9:16 — Instagram, WhatsApp', ratio: 1080 / 1920 },
  { id: 'square', label: 'Square', hint: '1:1 — feed, messaging', ratio: 1 },
];

interface Spec {
  width: number;
  height: number;
  margin: number;
  /** Kept clear of platform chrome on a Story. */
  safeTop: number;
  safeBottom: number;
  kicker: number;
  numberMax: number;
  unit: number;
  slabImage: number;
  subject: number;
  scoreNumber: number;
  gap: number;
}

const SPECS: Record<ReceiptFormat, Spec> = {
  story: {
    width: 1080,
    height: 1920,
    margin: 76,
    safeTop: 190,
    safeBottom: 200,
    kicker: 78,
    numberMax: 400,
    unit: 104,
    slabImage: 224,
    subject: 54,
    scoreNumber: 78,
    gap: 46,
  },
  square: {
    width: 1080,
    height: 1080,
    margin: 60,
    safeTop: 52,
    safeBottom: 52,
    kicker: 52,
    numberMax: 210,
    unit: 64,
    slabImage: 150,
    subject: 38,
    scoreNumber: 58,
    gap: 26,
  },
};

interface Palette {
  field: string;
  onField: string;
  slab: string;
  onSlab: string;
  panel: string;
  onPanel: string;
  rule: string;
  egg: string;
  medal: string;
}

const INK = '#17140F';
const PAPER = '#F7F2E7';
const CARROT = '#FF6B45';
const GOLD = '#FFCB2F';
const EGG_DEEP = '#E0472A';
const MEDAL_DEEP = '#9A7100';

function paletteFor(variant: ReceiptVariant): Palette {
  const shared = { slab: INK, onSlab: PAPER, panel: PAPER, onPanel: INK, egg: EGG_DEEP, medal: MEDAL_DEEP };
  if (variant === 'egg') return { field: CARROT, onField: INK, rule: INK, ...shared };
  if (variant === 'medal') return { field: GOLD, onField: INK, rule: INK, ...shared };
  return { field: PAPER, onField: INK, rule: INK, ...shared };
}

/**
 * Which receipt this is.
 *
 * A side, once taken, is final, so a contributor sits on exactly one of them.
 * The larger count decides if both are somehow present, and the recorded
 * stance breaks a tie.
 */
export function receiptVariant(contribution?: UserContribution | null): ReceiptVariant {
  if (!contribution) return 'public';
  const { rottenEggCount, medalCount } = contribution;
  if (rottenEggCount === 0 && medalCount === 0) return 'public';
  /*
   * The side they stand on now, when they have sent anything on it. Someone
   * who gave 300 Medals to an Entity and has since turned critical is critical
   * — a receipt led by the larger count would advertise the view they left.
   */
  if (contribution.stance === 'negative' && rottenEggCount > 0) return 'egg';
  if (contribution.stance === 'positive' && medalCount > 0) return 'medal';
  return rottenEggCount > medalCount ? 'egg' : 'medal';
}

/* ------------------------------- typography ------------------------------- */

/*
 * next/font scopes the family name, so the literal "Archivo Black" is not
 * registered. The CSS variables hold the real names — read them at runtime and
 * keep a heavy system stack behind them.
 */
function stack(variable: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

function displayFont(size: number): string {
  return `400 ${size}px ${stack('--font-archivo-black', "'Arial Black', Impact, sans-serif")}`;
}

function bodyFont(size: number, weight: number = 700): string {
  return `${weight} ${size}px ${stack('--font-archivo', "system-ui, 'Helvetica Neue', Arial, sans-serif")}`;
}

/** Canvas will not draw with a face the document has not finished loading. */
async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([document.fonts.load(displayFont(96)), document.fonts.load(bodyFont(32))]);
    await document.fonts.ready;
  } catch {
    // A missing face falls back to the system stack rather than failing.
  }
}

function setTracking(context: CanvasRenderingContext2D, value: string): void {
  // Supported everywhere that matters; harmless where it is not.
  (context as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = value;
}

/** Largest size at or below `max` that fits `text` within `maxWidth`. */
function fitSize(
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
function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
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

/* --------------------------------- images --------------------------------- */

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const element = new window.Image();
    element.crossOrigin = 'anonymous';
    element.onload = () => resolve(element);
    element.onerror = () => resolve(null);
    element.src = src;
  });
}

/** Cover-crop: fill the box, centre what overflows. */
function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function initialsFor(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* --------------------------------- marks ---------------------------------- */

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/**
 * A reaction emoji with its top-left at (x, y). The egg gets a hairline ink
 * edge, because 🥚 is drawn near-white and would vanish on a pale panel.
 */
function drawEmoji(
  context: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  size: number,
  edge: string | null,
): void {
  context.save();
  context.font = `${size}px ${EMOJI_FONT}`;
  context.textBaseline = 'top';
  context.textAlign = 'left';
  if (edge) {
    context.shadowColor = edge;
    context.shadowBlur = Math.max(1, size / 24);
  }
  context.fillText(glyph, x, y);
  context.restore();
}

function drawEgg(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  drawEmoji(context, '🥚', x, y, size, 'rgba(23, 20, 15, 0.85)');
}

function drawMedal(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  drawEmoji(context, '🏅', x, y, size, null);
}

/* --------------------------------- copy ----------------------------------- */

interface Headline {
  kicker: string;
  value: number;
  unit: string;
  relation: string;
}

function headlineFor(input: ReceiptInput, variant: ReceiptVariant): Headline {
  const own = input.contribution;

  if (variant === 'egg') {
    const count = own?.rottenEggCount ?? 0;
    return { kicker: 'I smashed', value: count, unit: count === 1 ? 'egg' : 'eggs', relation: 'over' };
  }

  if (variant === 'medal') {
    const count = own?.medalCount ?? 0;
    return { kicker: 'I gave', value: count, unit: count === 1 ? 'medal' : 'medals', relation: 'to' };
  }

  // No personal claim: the crowd's own dominant figure leads instead.
  const eggs = input.totals.rottenEggTotal;
  const medals = input.totals.medalTotal;
  const leadEggs = eggs >= medals;
  const count = leadEggs ? eggs : medals;
  return {
    kicker: 'The crowd sent',
    value: count,
    unit: leadEggs ? (count === 1 ? 'rotten egg' : 'rotten eggs') : count === 1 ? 'medal' : 'medals',
    relation: leadEggs ? 'at' : 'to',
  };
}

/**
 * The receipt's small print: this is people expressing themselves, as of a
 * moment — not a fact, not a poll.
 */
function stampFor(): string {
  return `User expression · Totals as of ${new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/** The host and path, without the scheme, as a link cue. */
function linkCue(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return 'skewvy.com';
  }
}

/* --------------------------------- render --------------------------------- */

/**
 * Measure everything first, then distribute the slack.
 *
 * Drawing straight down the canvas and pinning the footer to the bottom edge
 * leaves a dead band above it whenever the content is short — and a headline
 * that wraps to three lines has to push the blocks below it down rather than
 * overrun them. So each block reports its height, the leftover room is shared
 * out between them, and only then does anything get painted.
 */
export async function renderReceipt(input: ReceiptInput, format: ReceiptFormat): Promise<HTMLCanvasElement | null> {
  const spec = SPECS[format];
  const variant = receiptVariant(input.contribution);
  const palette = paletteFor(variant);
  const story = format === 'story';

  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const artwork = input.imageUrl ? await loadImage(input.imageUrl) : null;

  const M = spec.margin;
  const contentWidth = spec.width - M * 2;
  const headline = headlineFor(input, variant);
  const { totals } = input;

  /* ------------------------------- measure -------------------------------- */

  const mastheadSize = story ? 40 : 32;
  const ruleHeight = story ? 5 : 4;
  const mastheadHeight = mastheadSize + (story ? 28 : 22) + ruleHeight;

  const kickerSize = fitSize(context, headline.kicker, contentWidth, spec.kicker, 28, displayFont);
  const numberText = formatCount(headline.value);
  const numberSize = fitSize(context, numberText, contentWidth, spec.numberMax, 88, displayFont);
  const unitSize = fitSize(context, headline.unit.toUpperCase(), contentWidth, spec.unit, 32, displayFont);
  const headlineHeight = kickerSize * 1.04 + numberSize * 0.92 + unitSize * 1.04;

  const slabPad = story ? 28 : 20;
  const imageSize = spec.slabImage;
  const slabHeight = imageSize + slabPad * 2;
  const slabTextX = M + slabPad + imageSize + (story ? 32 : 22);
  const slabTextWidth = spec.width - M - slabPad - slabTextX;
  const relationSize = story ? 19 : 16;

  // Shrink the subject until it fits the room the slab actually has.
  const subjectMaxLines = story ? 3 : 2;
  let subjectSize = spec.subject;
  let subjectLines: string[] = [];
  for (;;) {
    context.font = displayFont(subjectSize);
    subjectLines = wrapLines(context, input.title, slabTextWidth, subjectMaxLines);
    const block = subjectLines.length * subjectSize * 1.06;
    if (block <= imageSize - relationSize - (story ? 22 : 16) || subjectSize <= 20) break;
    subjectSize -= 2;
  }

  const panelPad = story ? 34 : 24;
  // Tall enough for the head-count line that rides under each tap total.
  const panelHeight = story ? 384 : 272;

  const footerSize = story ? 30 : 24;
  const footerHeight = footerSize + (story ? 64 : 48);

  const blocks = [mastheadHeight, headlineHeight, slabHeight, panelHeight];
  const used = blocks.reduce((sum, value) => sum + value, 0) + footerHeight;
  const available = spec.height - spec.safeTop - spec.safeBottom;

  // Three gaps between four blocks, plus the run down to the footer.
  const slack = Math.max(0, available - used);
  const gap = Math.min(story ? 132 : 64, Math.max(story ? 40 : 22, slack / 4));

  /* -------------------------------- paint --------------------------------- */

  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  context.fillStyle = palette.field;
  context.fillRect(0, 0, spec.width, spec.height);

  let y = spec.safeTop + mastheadSize * 0.78;

  // Masthead.
  context.fillStyle = palette.onField;
  context.font = displayFont(mastheadSize);
  setTracking(context, '-0.03em');
  context.fillText('skewvy.com', M, y);
  setTracking(context, '0em');

  context.font = bodyFont(story ? 20 : 17, 700);
  setTracking(context, '0.14em');
  context.textAlign = 'right';
  context.fillText(variant === 'public' ? 'PUBLIC STATUS' : 'MY REACTION RECEIPT', spec.width - M, y);
  setTracking(context, '0em');
  context.textAlign = 'left';

  y += story ? 28 : 22;
  context.fillStyle = palette.rule;
  context.fillRect(M, y, contentWidth, ruleHeight);
  y += ruleHeight + gap;

  // Headline — the focal point.
  context.fillStyle = palette.onField;
  y += kickerSize * 0.82;
  context.font = displayFont(kickerSize);
  setTracking(context, '-0.03em');
  context.fillText(headline.kicker, M, y);

  y += numberSize * 0.9;
  context.font = displayFont(numberSize);
  setTracking(context, '-0.06em');
  context.fillText(numberText, M, y);

  y += unitSize * 1.0;
  context.font = displayFont(unitSize);
  setTracking(context, '-0.02em');
  context.fillText(headline.unit.toUpperCase(), M, y);
  setTracking(context, '0em');

  y += kickerSize * 0.22 + gap;

  // Subject: the black slab.
  const slabTop = y;
  context.fillStyle = palette.slab;
  context.fillRect(M, slabTop, contentWidth, slabHeight);

  if (artwork) {
    drawCover(context, artwork, M + slabPad, slabTop + slabPad, imageSize, imageSize);
  } else {
    context.fillStyle = variant === 'medal' ? GOLD : CARROT;
    context.fillRect(M + slabPad, slabTop + slabPad, imageSize, imageSize);
    context.fillStyle = INK;
    const marks = initialsFor(input.title);
    const size = fitSize(context, marks, imageSize * 0.76, imageSize * 0.5, 22, displayFont);
    context.textAlign = 'center';
    setTracking(context, '-0.04em');
    context.fillText(marks, M + slabPad + imageSize / 2, slabTop + slabPad + imageSize / 2 + size * 0.35);
    setTracking(context, '0em');
    context.textAlign = 'left';
  }

  let slabY = slabTop + slabPad + relationSize;
  context.fillStyle = palette.onSlab;
  context.globalAlpha = 0.66;
  context.font = bodyFont(relationSize, 700);
  setTracking(context, '0.14em');
  context.fillText(
    `${headline.relation.toUpperCase()}  ·  ${(input.artifactType === 'entity' ? 'Entity' : input.category).toUpperCase()}`,
    slabTextX,
    slabY,
  );
  setTracking(context, '0em');
  context.globalAlpha = 1;

  context.font = displayFont(subjectSize);
  setTracking(context, '-0.035em');
  slabY += subjectSize * (story ? 1.06 : 1.02);
  for (const line of subjectLines) {
    context.fillText(line, slabTextX, slabY);
    slabY += subjectSize * 1.06;
  }
  setTracking(context, '0em');

  y = slabTop + slabHeight + gap;

  // Scoreboard.
  const panelTop = y;
  /** "from 5 people" — the line that stops a tap total reading as a head count. */
  const fromPeople = (contributors: number) =>
    contributors === 0
      ? 'from nobody yet'
      : `from ${formatCount(contributors)} ${contributors === 1 ? 'person' : 'people'}`;
  const people = totals.negativeOpinionTotal + totals.positiveOpinionTotal;
  const negativeShare = sharePercent(totals.negativeOpinionTotal, people);

  context.fillStyle = palette.panel;
  context.fillRect(M, panelTop, contentWidth, panelHeight);
  context.strokeStyle = INK;
  context.lineWidth = story ? 5 : 4;
  context.strokeRect(M + 2.5, panelTop + 2.5, contentWidth - 5, panelHeight - 5);

  let panelY = panelTop + panelPad + (story ? 20 : 16);
  context.fillStyle = palette.onPanel;
  context.font = bodyFont(story ? 20 : 16, 700);
  setTracking(context, '0.14em');
  context.fillText('WHERE THE CROWD STANDS', M + panelPad, panelY);
  setTracking(context, '0em');

  // Taps, which is not the same measurement as people.
  panelY += story ? 92 : 66;
  const markSize = story ? 38 : 28;
  const columnX = [M + panelPad, M + contentWidth / 2 + (story ? 8 : 5)];
  const columnRoom = contentWidth / 2 - panelPad - markSize - 26;

  const columns: Array<{
    value: number;
    label: string;
    colour: string;
    mark: 'egg' | 'medal';
    from: string;
  }> = [
    {
      value: totals.rottenEggTotal,
      label: 'ROTTEN EGGS · TAPS',
      colour: palette.egg,
      mark: 'egg',
      from: fromPeople(totals.rottenEggContributorTotal),
    },
    {
      value: totals.medalTotal,
      label: 'MEDALS · TAPS',
      colour: palette.medal,
      mark: 'medal',
      from: fromPeople(totals.medalContributorTotal),
    },
  ];

  /*
   * One size for both, taken from whichever number needs the most room. Fitted
   * independently, a seven-figure total shrinks to half the height of the
   * five-figure one beside it and the pair stops reading as a pair.
   */
  const scoreSize = Math.min(
    ...columns.map((column) =>
      fitSize(context, formatCount(column.value), columnRoom, spec.scoreNumber, 28, displayFont),
    ),
  );

  for (const [index, column] of columns.entries()) {
    const x = columnX[index];
    const text = formatCount(column.value);

    const size = scoreSize;
    context.font = displayFont(size);
    context.fillStyle = column.colour;
    setTracking(context, '-0.05em');
    context.fillText(text, x, panelY);
    const width = context.measureText(text).width;
    setTracking(context, '0em');

    const markY = panelY - size * 0.72;
    if (column.mark === 'egg') drawEgg(context, x + width + 14, markY, markSize);
    else drawMedal(context, x + width + 14, markY, markSize);

    context.fillStyle = palette.onPanel;
    context.globalAlpha = 0.66;
    context.font = bodyFont(story ? 18 : 14, 700);
    setTracking(context, '0.1em');
    context.fillText(column.label, x, panelY + (story ? 36 : 27));
    setTracking(context, '0em');

    // The head count travels with the tap total wherever it goes, including
    // onto a poster somebody will screenshot out of context.
    context.font = bodyFont(story ? 17 : 13, 500);
    context.fillText(column.from, x, panelY + (story ? 60 : 45));
    context.globalAlpha = 1;
  }

  // People, as a balance.
  panelY += story ? 110 : 80;
  const barWidth = contentWidth - panelPad * 2;
  const barHeight = story ? 18 : 13;

  context.fillStyle = GOLD;
  context.fillRect(M + panelPad, panelY, barWidth, barHeight);
  context.fillStyle = CARROT;
  context.fillRect(M + panelPad, panelY, people > 0 ? (barWidth * negativeShare) / 100 : barWidth / 2, barHeight);
  context.strokeStyle = INK;
  context.lineWidth = 3;
  context.strokeRect(M + panelPad + 1.5, panelY + 1.5, barWidth - 3, barHeight - 3);

  panelY += barHeight + (story ? 44 : 33);
  context.fillStyle = palette.onPanel;
  context.font = bodyFont(story ? 23 : 18, 700);
  context.fillText(
    `${formatCount(totals.negativeOpinionTotal)} critical · ${formatCount(totals.positiveOpinionTotal)} appreciative`,
    M + panelPad,
    panelY,
  );

  context.globalAlpha = 0.62;
  context.font = bodyFont(story ? 18 : 14, 500);
  context.textAlign = 'right';
  context.fillText(
    `${formatCount(totals.uniqueParticipantTotal)} ${totals.uniqueParticipantTotal === 1 ? 'person' : 'people'}, counted once each`,
    M + contentWidth - panelPad,
    panelY,
  );
  context.textAlign = 'left';
  context.globalAlpha = 1;

  // Footer, pinned to the bottom safe edge.
  const footerBaseline = spec.height - spec.safeBottom;

  context.fillStyle = palette.rule;
  context.fillRect(M, footerBaseline - (story ? 58 : 44), contentWidth, ruleHeight);

  context.fillStyle = palette.onField;
  context.font = displayFont(footerSize);
  setTracking(context, '-0.03em');
  const cue = linkCue(input.url);
  fitSize(context, cue, contentWidth * 0.62, footerSize, 16, displayFont);
  context.fillText(cue, M, footerBaseline);
  setTracking(context, '0em');

  // The stamp shares the line with the link, so it shrinks rather than collide.
  const stamp = stampFor();
  let stampSize = story ? 18 : 15;
  context.font = bodyFont(stampSize, 500);
  while (context.measureText(stamp).width > contentWidth * 0.36 && stampSize > 10) {
    stampSize -= 1;
    context.font = bodyFont(stampSize, 500);
  }
  context.globalAlpha = 0.68;
  context.textAlign = 'right';
  context.fillText(stamp, spec.width - M, footerBaseline);

  // The tall format has room above the stamp for the one fact people misread.
  if (story) {
    context.font = bodyFont(15, 500);
    context.fillText('Reactions count taps.', spec.width - M, footerBaseline - 26);
  }
  context.textAlign = 'left';
  context.globalAlpha = 1;

  return canvas;
}

export async function receiptToBlob(input: ReceiptInput, format: ReceiptFormat): Promise<Blob | null> {
  const canvas = await renderReceipt(input, format);
  if (!canvas) return null;
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function receiptToDataUrl(input: ReceiptInput, format: ReceiptFormat): Promise<string | null> {
  const canvas = await renderReceipt(input, format);
  if (!canvas) return null;
  return canvas.toDataURL('image/png');
}
