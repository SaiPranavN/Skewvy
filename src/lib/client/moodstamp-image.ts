/**
 * The downloadable MoodStamp: the same stamp as the page draws, as a PNG.
 *
 * Drawn on a canvas for the reasons the share receipt is (see receipt.ts):
 * the canvas reaches the page's loaded Archivo faces and can measure text, so
 * the reasons wrap to their real length instead of being clipped. The height
 * is worked out first, from the measured text, and the stamp is then drawn to
 * fit it — a short note makes a short stamp, a long one a taller stamp.
 */

import { REACTION_VOICES } from '@/lib/moodstamps/catalog';
import type { MoodStampArtworkData } from '@/lib/moodstamps/types';
import { bodyFont, displayFont, ensureFonts, fitSize, setTracking, wrapLines } from './canvas-text';

const INK = '#17140F';
const PAPER = '#F7F2E7';
const CARROT = '#FF6B45';
const GOLD = '#FFCB2F';
const EGG_SHELL = '#D3C886';
const GROUND = '#DAD6CF';

const WIDTH = 1080;
const OUTER = 44;
const SHADOW = 12;
const FRAME_INSET = 26;
const PAD = 36;
const BITE = 9;
const PITCH = 27;

const STATE_BADGE: Record<MoodStampArtworkData['state'], string> = {
  preview: 'PREVIEW',
  sent: 'SENT',
  unopened: 'UNOPENED',
  opened: 'OPENED',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  );
}

function dateLine(data: MoodStampArtworkData): string {
  const verb = data.state === 'preview' ? 'Drafted' : data.state === 'sent' ? 'Sent' : 'Delivered';
  return `${verb} ${formatDate(data.date)}`;
}

/** A stamp-shaped silhouette with perforated edges, in one colour. */
function stampShape(width: number, height: number, colour: string): HTMLCanvasElement {
  const shape = document.createElement('canvas');
  shape.width = width;
  shape.height = height;
  const context = shape.getContext('2d')!;
  context.fillStyle = colour;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'destination-out';

  const bite = (x: number, y: number) => {
    context.beginPath();
    context.arc(x, y, BITE, 0, Math.PI * 2);
    context.fill();
  };
  const across = Math.floor(width / PITCH);
  const offsetX = (width - across * PITCH) / 2 + PITCH / 2;
  for (let index = 0; index < across; index += 1) {
    bite(offsetX + index * PITCH, 0);
    bite(offsetX + index * PITCH, height);
  }
  const down = Math.floor(height / PITCH);
  const offsetY = (height - down * PITCH) / 2 + PITCH / 2;
  for (let index = 0; index < down; index += 1) {
    bite(0, offsetY + index * PITCH);
    bite(width, offsetY + index * PITCH);
  }
  return shape;
}

function drawEgg(context: CanvasRenderingContext2D, size: number): void {
  context.save();
  context.scale(size / 100, size / 100);
  const shell = new Path2D('M50 10C31 10 20 44 20 62c0 18 13 28 30 28s30-10 30-28c0-18-11-52-30-52Z');
  context.fillStyle = EGG_SHELL;
  context.fill(shell);
  context.lineWidth = 5;
  context.lineJoin = 'round';
  context.strokeStyle = INK;
  context.stroke(shell);
  context.fillStyle = INK;
  for (const [x, y, r] of [
    [58, 50, 3.6],
    [44, 70, 3.1],
    [60, 73, 2.4],
  ]) {
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawMedal(context: CanvasRenderingContext2D, size: number): void {
  context.save();
  context.scale(size / 100, size / 100);
  context.lineJoin = 'round';
  context.strokeStyle = INK;

  context.fillStyle = INK;
  context.fill(new Path2D('M31 6h14l13 38-12 4Z'));

  const right = new Path2D('M69 6H55L43 42l12 4Z');
  context.fillStyle = GOLD;
  context.fill(right);
  context.lineWidth = 4;
  context.stroke(right);

  context.beginPath();
  context.arc(50, 66, 23, 0, Math.PI * 2);
  context.fillStyle = GOLD;
  context.fill();
  context.lineWidth = 5;
  context.stroke();

  context.beginPath();
  context.arc(50, 66, 14.5, 0, Math.PI * 2);
  context.lineWidth = 3.2;
  context.stroke();

  context.fillStyle = INK;
  context.fill(new Path2D('m50 56.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L50 71.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9Z'));
  context.restore();
}

interface Layout {
  emotionSize: number;
  emotionLines: string[];
  rows: Array<{ labelLines: string[]; textLines: string[]; height: number }>;
  leadLabel: string;
  leadLines: string[];
  leadHeight: number;
  height: number;
}

const ROW_PAD = 22;
const TEXT_LINE = 34;
const LEAD_LINE = 46;

function contentWidth(): number {
  return WIDTH - OUTER * 2 - SHADOW - FRAME_INSET * 2 - PAD * 2;
}

/** Every measured size, worked out before anything is drawn. */
function layOut(context: CanvasRenderingContext2D, data: MoodStampArtworkData): Layout {
  const voice = REACTION_VOICES[data.reaction];
  const width = contentWidth();

  // The feeling: as large as fits on one line, down to a floor, then two lines.
  const emotion = data.emotion.toUpperCase();
  setTracking(context, '-4px');
  let emotionSize = fitSize(context, emotion, width, 196, 96, displayFont);
  let emotionLines = [emotion];
  context.font = displayFont(emotionSize);
  if (context.measureText(emotion).width > width) {
    emotionLines = wrapLines(context, emotion, width, 2);
    emotionSize = 96;
  }
  setTracking(context, '0px');

  // Kept well clear of the answer column: tracked capitals measure a little short.
  const labelWidth = width * 0.3 - 34;
  const textWidth = width * 0.7 - 24;

  const rows = voice.reasons.slice(0, 2).map((prompt, index) => {
    context.font = bodyFont(15, 800);
    setTracking(context, '2.5px');
    const labelLines = wrapLines(context, `${String(index + 1).padStart(2, '0')}  ${prompt.label.toUpperCase()}`, labelWidth, 3);
    setTracking(context, '0px');
    context.font = bodyFont(25, 600);
    const textLines = wrapLines(context, `“${data.reasons[index]}”`, textWidth, 6);
    const height = Math.max(labelLines.length * 22, textLines.length * TEXT_LINE) + ROW_PAD * 2;
    return { labelLines, textLines, height };
  });

  context.font = displayFont(40);
  setTracking(context, '-1px');
  const leadLines = wrapLines(context, `“${data.reasons[2]}”`, width - 48, 5);
  setTracking(context, '0px');
  const leadHeight = ROW_PAD + 18 + 14 + leadLines.length * LEAD_LINE + ROW_PAD;

  const emotionHeight = emotionLines.length * emotionSize * 0.86;
  const headerHeight = 64;
  const reasonsHeight = headerHeight + rows.reduce((sum, row) => sum + row.height, 0) + leadHeight;

  // Step for step the same advances renderMoodStamp makes as it draws.
  const contentHeight =
    46 + 26 + // masthead and its rule
    40 + 72 + // badges, and the air above the feeling
    34 + 20 + // the lead line
    emotionHeight + 30 +
    176 + 58 + // the count row
    104 + 28 + // from and to
    reasonsHeight + 46 +
    6 + 22 + 56; // footer rule and its two lines

  const height = OUTER + FRAME_INSET + PAD + contentHeight + PAD + FRAME_INSET + OUTER + SHADOW;
  return {
    emotionSize,
    emotionLines,
    rows,
    leadLabel: `03  ${voice.reasons[2].label.toUpperCase()}`,
    leadLines,
    leadHeight,
    height: Math.ceil(height),
  };
}

function drawBox(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, line: number): void {
  context.lineWidth = line;
  context.strokeRect(x + line / 2, y + line / 2, width - line, height - line);
}

export async function renderMoodStamp(data: MoodStampArtworkData): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null;
  await ensureFonts();

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  const layout = layOut(measure, data);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = layout.height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const voice = REACTION_VOICES[data.reaction];
  const tone = data.reaction === 'medal' ? GOLD : CARROT;
  const stampWidth = WIDTH - OUTER * 2 - SHADOW;
  const stampHeight = layout.height - OUTER * 2 - SHADOW;

  context.fillStyle = GROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(stampShape(stampWidth, stampHeight, INK), OUTER + SHADOW, OUTER + SHADOW);
  context.drawImage(stampShape(stampWidth, stampHeight, tone), OUTER, OUTER);

  context.strokeStyle = INK;
  drawBox(context, OUTER + FRAME_INSET, OUTER + FRAME_INSET, stampWidth - FRAME_INSET * 2, stampHeight - FRAME_INSET * 2, 2.5);

  const x = OUTER + FRAME_INSET + PAD;
  const width = contentWidth();
  const right = x + width;
  let y = OUTER + FRAME_INSET + PAD;

  context.textBaseline = 'top';
  context.fillStyle = INK;

  // Masthead.
  context.font = bodyFont(34, 800);
  setTracking(context, '-0.5px');
  context.textAlign = 'left';
  context.fillText('skewvy.com', x, y);
  context.font = displayFont(32);
  setTracking(context, '2px');
  context.textAlign = 'right';
  context.fillText('MOODSTAMP', right, y + 2);
  context.textAlign = 'left';
  y += 46;
  context.fillRect(x, y, width, 6);
  y += 26;

  // Badges.
  const badges = ['PRIVATE', STATE_BADGE[data.state], data.state === 'unopened' || data.state === 'opened' ? 'VERIFIED DELIVERY' : 'VERIFIED SENDER'];
  context.font = bodyFont(15, 800);
  setTracking(context, '2.5px');
  let badgeX = x;
  badges.forEach((badge, index) => {
    const badgeWidth = context.measureText(badge).width + 30;
    if (index === 1) {
      context.fillStyle = INK;
      context.fillRect(badgeX, y, badgeWidth, 40);
      context.fillStyle = PAPER;
    } else {
      context.strokeStyle = INK;
      drawBox(context, badgeX, y, badgeWidth, 40, 2.5);
      context.fillStyle = INK;
    }
    context.fillText(badge, badgeX + 15, y + 13);
    badgeX += badgeWidth + 10;
  });
  context.fillStyle = INK;
  y += 40 + 72;

  // The line above the feeling, and the feeling.
  context.font = displayFont(34);
  setTracking(context, '7px');
  context.fillText(voice.lead.toUpperCase(), x, y);
  y += 34 + 20;

  context.font = displayFont(layout.emotionSize);
  setTracking(context, '-4px');
  for (const line of layout.emotionLines) {
    context.fillText(line, x - 4, y);
    y += layout.emotionSize * 0.86;
  }
  y += 30;

  // The count, what it is, and the mark.
  const unit = (data.quantity === 1 ? voice.singular : voice.plural).toUpperCase();
  context.font = displayFont(200);
  setTracking(context, '-12px');
  const number = String(data.quantity);
  context.fillText(number, x - 6, y - 8);
  const numberWidth = context.measureText(number).width;
  const unitX = x + numberWidth + 20;
  const tileSize = 150;
  const unitRoom = right - tileSize - 30 - unitX;
  setTracking(context, '-2px');
  fitSize(context, unit, unitRoom, 66, 30, displayFont);
  context.fillText(unit, unitX, y + 40);

  context.save();
  context.font = displayFont(22);
  setTracking(context, '2px');
  const tag = 'DELIVERED TO YOU!!!';
  const tagWidth = context.measureText(tag).width + 30;
  context.translate(unitX, y + 112);
  context.rotate((-1.5 * Math.PI) / 180);
  context.fillStyle = INK;
  context.fillRect(0, 0, tagWidth, 44);
  context.fillStyle = PAPER;
  context.fillText(tag, 15, 12);
  context.restore();

  context.save();
  context.translate(right - tileSize / 2 - 6, y + 80);
  context.rotate((4 * Math.PI) / 180);
  context.fillStyle = INK;
  context.fillRect(-tileSize / 2 + 9, -tileSize / 2 + 9, tileSize, tileSize);
  context.fillStyle = PAPER;
  context.fillRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize);
  context.strokeStyle = INK;
  drawBox(context, -tileSize / 2, -tileSize / 2, tileSize, tileSize, 3.5);
  context.translate(-tileSize / 2 + 20, -tileSize / 2 + 20);
  if (data.reaction === 'medal') drawMedal(context, tileSize - 40);
  else drawEgg(context, tileSize - 40);
  context.restore();
  y += 176 + 58;

  // From and to.
  const barHeight = 104;
  const split = x + width * 0.62;
  context.fillStyle = INK;
  context.fillRect(x, y, width, barHeight);
  context.strokeStyle = 'rgba(247, 242, 231, 0.45)';
  context.lineWidth = 2;
  context.setLineDash([5, 5]);
  context.beginPath();
  context.moveTo(split, y);
  context.lineTo(split, y + barHeight);
  context.stroke();
  context.setLineDash([]);

  const person = (label: string, name: string, left: number, room: number, note: string | null) => {
    context.fillStyle = PAPER;
    context.font = bodyFont(15, 800);
    setTracking(context, '3.5px');
    context.fillText(label, left, y + (note ? 30 : 44));
    const labelWidth = context.measureText(label).width + 16;
    setTracking(context, '-0.5px');
    fitSize(context, name, room - labelWidth, 44, 22, displayFont);
    context.fillText(name, left + labelWidth, y + (note ? 18 : 30));
    if (note) {
      context.font = bodyFont(17, 700);
      setTracking(context, '0px');
      context.fillStyle = tone;
      context.fillText('✓', left, y + 70);
      context.fillStyle = PAPER;
      context.fillText(note, left + 22, y + 70);
    }
  };
  const from = data.anonymous ? 'Anonymous' : data.senderName;
  person('FROM:', from, x + 26, split - x - 44, data.anonymous ? 'Identity verified by Skewvy' : null);
  person('TO:', data.recipientName, split + 26, right - split - 44, null);
  y += barHeight + 28;

  // The reasons.
  const reasonsTop = y;
  const reasonsHeight = 64 + layout.rows.reduce((sum, row) => sum + row.height, 0) + layout.leadHeight;
  context.fillStyle = INK;
  context.fillRect(x + 10, reasonsTop + 10, width, reasonsHeight);
  context.fillStyle = PAPER;
  context.fillRect(x, reasonsTop, width, reasonsHeight);

  context.fillStyle = INK;
  context.font = bodyFont(18, 800);
  setTracking(context, '4.5px');
  context.fillText(voice.intent.toUpperCase(), x + 26, y + 23);
  context.font = bodyFont(19, 600);
  setTracking(context, '0px');
  context.textAlign = 'right';
  context.fillText(voice.intentAside, right - 26, y + 22);
  context.textAlign = 'left';
  y += 64;
  context.fillRect(x, y - 3, width, 3);

  for (const row of layout.rows) {
    context.font = bodyFont(15, 800);
    setTracking(context, '2.5px');
    row.labelLines.forEach((line, index) => context.fillText(line, x + 26, y + ROW_PAD + 5 + index * 22));
    context.font = bodyFont(25, 600);
    setTracking(context, '0px');
    row.textLines.forEach((line, index) => context.fillText(line, x + width * 0.3 + 12, y + ROW_PAD + index * TEXT_LINE));
    y += row.height;
    context.fillRect(x, y - 2, width, 2.5);
  }

  context.fillStyle = tone;
  context.fillRect(x, y, width, layout.leadHeight);
  context.fillStyle = INK;
  context.font = bodyFont(15, 800);
  setTracking(context, '2.5px');
  context.fillText(layout.leadLabel, x + 26, y + ROW_PAD);
  context.font = displayFont(40);
  setTracking(context, '-1px');
  layout.leadLines.forEach((line, index) => context.fillText(line, x + 24, y + ROW_PAD + 32 + index * LEAD_LINE));
  y += layout.leadHeight;

  context.strokeStyle = INK;
  drawBox(context, x, reasonsTop, width, reasonsHeight, 3);
  y += 46;

  // Footer.
  context.fillStyle = INK;
  context.fillRect(x, y, width, 6);
  y += 6 + 22;
  context.font = bodyFont(22, 800);
  setTracking(context, '0px');
  context.fillText(data.receiptCode ? `Receipt ${data.receiptCode}` : 'Receipt number assigned when sent', x, y);
  context.font = bodyFont(16, 600);
  context.fillText('A feeling, counted and delivered by skewvy.com', x, y + 36);

  const seal = `PRIVATE · ${STATE_BADGE[data.state]}`;
  context.font = bodyFont(14, 800);
  setTracking(context, '2.5px');
  const sealWidth = context.measureText(seal).width + 24;
  context.save();
  context.translate(right - sealWidth, y - 4);
  context.rotate((-3 * Math.PI) / 180);
  context.strokeStyle = INK;
  drawBox(context, 0, 0, sealWidth, 36, 2.5);
  context.fillText(seal, 12, 11);
  context.restore();

  context.font = bodyFont(22, 800);
  setTracking(context, '0px');
  context.textAlign = 'right';
  context.fillText(dateLine(data), right - sealWidth - 22, y);
  context.textAlign = 'left';

  return canvas;
}

/** Renders the stamp and hands it to the browser as a PNG download. */
export async function downloadMoodStamp(data: MoodStampArtworkData): Promise<boolean> {
  const canvas = await renderMoodStamp(data);
  if (!canvas) return false;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `moodstamp-${(data.receiptCode ?? 'preview').toLowerCase()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
