/**
 * Share-card ("sentiment receipt") generation.
 *
 * The receipt is composed as an SVG string and rasterised through a canvas, so
 * there is no screenshot library and no server round trip. 1080×1350 is the
 * portrait size that survives Instagram Stories, X, WhatsApp and Snapchat.
 */

import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactTotals, ArtifactType, UserContribution } from '@/lib/domain/types';

export interface ReceiptInput {
  title: string;
  artifactType: ArtifactType;
  category: string;
  imageUrl: string | null;
  totals: ArtifactTotals;
  contribution?: UserContribution | null;
  caption: string;
}

const WIDTH = 1080;
const HEIGHT = 1350;

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      default: return '&quot;';
    }
  });
}

/** Greedy wrap; the receipt title is allowed at most three lines. */
function wrapTitle(title: string, charactersPerLine = 24, maxLines = 3): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= charactersPerLine) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (last.length > charactersPerLine) lines[maxLines - 1] = `${last.slice(0, charactersPerLine - 1)}…`;
  }
  return lines;
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildReceiptSvg(input: ReceiptInput): Promise<string> {
  const { totals } = input;
  const people = totals.negativeOpinionTotal + totals.positiveOpinionTotal;
  const negativeShare = sharePercent(totals.negativeOpinionTotal, people);
  const titleLines = wrapTitle(input.title);
  const stamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // The artwork has to be inlined: an external href will not rasterise onto a canvas.
  const embedded = input.imageUrl ? await toDataUrl(input.imageUrl) : null;

  const own = input.contribution;
  const ownLine =
    own && (own.rottenEggCount > 0 || own.medalCount > 0)
      ? `Your contribution: ${own.rottenEggCount > 0 ? `${formatCount(own.rottenEggCount)} 🥚` : ''}${
          own.rottenEggCount > 0 && own.medalCount > 0 ? '   ' : ''
        }${own.medalCount > 0 ? `${formatCount(own.medalCount)} 🏅` : ''}`
      : 'Recorded on skewvy.com';

  /*
   * Everything below the title flows from where the title actually ends, so a
   * one-line and a three-line headline both produce a balanced card.
   */
  const artTop = 164;
  const artHeight = 372;
  const titleLineHeight = 58;
  const titleFirstBaseline = artTop + artHeight + 112;
  const titleLastBaseline = titleFirstBaseline + (titleLines.length - 1) * titleLineHeight;

  const countersTop = titleLastBaseline + 46;
  const countersHeight = 200;
  const barTop = countersTop + countersHeight + 58;
  const footerTop = barTop + 126;

  const barWidth = 960;
  const negativeWidth = Math.round((barWidth * negativeShare) / 100);
  const counterWidth = 468;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Geist, Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#08090b" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#08090b" stop-opacity="0.92"/>
    </linearGradient>
    <clipPath id="artClip"><rect x="60" y="${artTop}" width="960" height="${artHeight}" rx="10"/></clipPath>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#08090b"/>

  <g>
    <text x="60" y="100" font-size="34" font-weight="600" fill="#f2f2f0" letter-spacing="-0.5">Ske</text>
    <path d="M129 84 L136 101 L143 89 L147 96 L151 89 L158 101 L165 84" stroke="#e5484d" stroke-width="3"
      stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <text x="168" y="100" font-size="34" font-weight="600" fill="#f2f2f0" letter-spacing="-0.5">vy</text>
    <text x="1020" y="97" text-anchor="end" font-size="19" font-weight="500" fill="#70737a" letter-spacing="1.6">${
      input.artifactType === 'entity' ? 'ENTITY' : 'FLASH NEWS'
    }</text>
  </g>

  <g clip-path="url(#artClip)">
    ${
      embedded
        ? `<image xlink:href="${embedded}" x="60" y="${artTop}" width="960" height="${artHeight}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="60" y="${artTop}" width="960" height="${artHeight}" fill="url(#scrim)"/>`
        : `<rect x="60" y="${artTop}" width="960" height="${artHeight}" fill="#14171c"/>`
    }
    <text x="90" y="${artTop + artHeight - 32}" font-size="19" font-weight="500" fill="#a4a6aa" letter-spacing="1.6">${escapeXml(
      input.category.toUpperCase(),
    )}</text>
  </g>
  <rect x="60" y="${artTop}" width="960" height="${artHeight}" rx="10" fill="none" stroke="#ffffff" stroke-opacity="0.11"/>

  ${titleLines
    .map(
      (line, index) =>
        `<text x="60" y="${titleFirstBaseline + index * titleLineHeight}" font-size="48" font-weight="600" fill="#f2f2f0" letter-spacing="-1.4">${escapeXml(
          line,
        )}</text>`,
    )
    .join('')}

  <g transform="translate(60, ${countersTop})">
    <rect x="0" y="0" width="${counterWidth}" height="${countersHeight}" rx="10" fill="#101216" stroke="#ffffff" stroke-opacity="0.07"/>
    <text x="32" y="68" font-size="34">🥚</text>
    <text x="32" y="142" font-size="58" font-weight="600" fill="#bd7650" letter-spacing="-1.8">${formatCount(
      totals.rottenEggTotal,
    )}</text>
    <text x="32" y="174" font-size="18" fill="#a4a6aa">Rotten Eggs</text>

    <rect x="${barWidth - counterWidth}" y="0" width="${counterWidth}" height="${countersHeight}" rx="10" fill="#101216" stroke="#ffffff" stroke-opacity="0.07"/>
    <text x="${barWidth - counterWidth + 32}" y="68" font-size="34">🏅</text>
    <text x="${barWidth - counterWidth + 32}" y="142" font-size="58" font-weight="600" fill="#c5a15a" letter-spacing="-1.8">${formatCount(
      totals.medalTotal,
    )}</text>
    <text x="${barWidth - counterWidth + 32}" y="174" font-size="18" fill="#a4a6aa">Medals</text>
  </g>

  <g transform="translate(60, ${barTop})">
    <rect x="0" y="0" width="${barWidth}" height="6" rx="3" fill="#181b20"/>
    <rect x="0" y="0" width="${negativeWidth}" height="6" rx="3" fill="#76503c"/>
    <rect x="${negativeWidth}" y="0" width="${barWidth - negativeWidth}" height="6" rx="3" fill="#766442"/>
    <text x="0" y="46" font-size="21" fill="#a4a6aa">${formatCount(totals.negativeOpinionTotal)} critical</text>
    <text x="${barWidth}" y="46" text-anchor="end" font-size="21" fill="#a4a6aa">${formatCount(
      totals.positiveOpinionTotal,
    )} appreciative</text>
    <text x="0" y="82" font-size="19" fill="#70737a">${formatCount(
      totals.uniqueParticipantTotal,
    )} people counted once each</text>
  </g>

  <g transform="translate(60, ${footerTop})">
    <text x="0" y="0" font-size="28" font-weight="600" fill="#f2f2f0">${escapeXml(input.caption)}</text>
    <text x="0" y="44" font-size="21" fill="#a4a6aa">${escapeXml(ownLine)}</text>
    <text x="0" y="94" font-size="18" fill="#70737a">${escapeXml(stamp)}</text>
    <text x="${barWidth}" y="94" text-anchor="end" font-size="19" font-weight="500" fill="#70737a">skewvy.com</text>
  </g>
</svg>`;
}

/** Rasterises the receipt to a PNG blob. */
export async function renderReceiptPng(input: ReceiptInput): Promise<Blob | null> {
  const svg = await buildReceiptSvg(input);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => resolve(null);
      element.src = url;
    });
    if (!image) return null;

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, WIDTH, HEIGHT);

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.96));
  } finally {
    URL.revokeObjectURL(url);
  }
}
