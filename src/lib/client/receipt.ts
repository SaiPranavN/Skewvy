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
  accent: string;
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
      ? `You sent ${own.rottenEggCount > 0 ? `${formatCount(own.rottenEggCount)} 🥚` : ''}${
          own.rottenEggCount > 0 && own.medalCount > 0 ? '   ·   ' : ''
        }${own.medalCount > 0 ? `${formatCount(own.medalCount)} 🏅` : ''}`
      : 'Add your own reaction on skewvy.com';

  /*
   * Everything below the title flows from where the title actually ends, so a
   * one-line and a three-line headline both produce a balanced card instead of
   * overlapping blocks.
   */
  const artTop = 168;
  const artHeight = 372;
  const titleLineHeight = 60;
  const titleFirstBaseline = artTop + artHeight + 118;
  const titleLastBaseline = titleFirstBaseline + (titleLines.length - 1) * titleLineHeight;

  const countersTop = titleLastBaseline + 44;
  const countersHeight = 208;
  const barTop = countersTop + countersHeight + 56;
  const footerTop = barTop + 128;

  const barWidth = 960;
  const negativeWidth = Math.round((barWidth * negativeShare) / 100);
  const counterWidth = 468;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#12111d"/>
      <stop offset="60%" stop-color="#0a0a12"/>
      <stop offset="100%" stop-color="#07070d"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#07070d" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#07070d" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="brandmark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff5c4d"/>
      <stop offset="100%" stop-color="#b6551d"/>
    </linearGradient>
    <clipPath id="artClip"><rect x="60" y="${artTop}" width="960" height="${artHeight}" rx="34"/></clipPath>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="900" cy="90" r="300" fill="${input.accent}" opacity="0.18"/>

  <g>
    <rect x="60" y="60" width="62" height="62" rx="17" fill="url(#brandmark)"/>
    <text x="91" y="104" text-anchor="middle" font-size="38" font-weight="800" fill="#ffffff">S</text>
    <text x="140" y="103" font-size="36" font-weight="700" fill="#f5f3fa" letter-spacing="-0.5">Skewvy</text>
    <text x="1020" y="100" text-anchor="end" font-size="21" font-weight="600" fill="#a9a3bd" letter-spacing="3">${
      input.artifactType === 'entity' ? 'ENTITY' : 'FLASH NEWS'
    }</text>
  </g>

  <g clip-path="url(#artClip)">
    ${
      embedded
        ? `<image xlink:href="${embedded}" x="60" y="${artTop}" width="960" height="${artHeight}" preserveAspectRatio="xMidYMid slice"/>`
        : `<rect x="60" y="${artTop}" width="960" height="${artHeight}" fill="${input.accent}" opacity="0.45"/>`
    }
    <rect x="60" y="${artTop}" width="960" height="${artHeight}" fill="url(#scrim)"/>
    <text x="92" y="${artTop + artHeight - 34}" font-size="22" font-weight="600" fill="#d8d4e4" letter-spacing="2.5">${escapeXml(
      input.category.toUpperCase(),
    )}</text>
  </g>
  <rect x="60" y="${artTop}" width="960" height="${artHeight}" rx="34" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>

  ${titleLines
    .map(
      (line, index) =>
        `<text x="60" y="${titleFirstBaseline + index * titleLineHeight}" font-size="52" font-weight="800" fill="#f5f3fa" letter-spacing="-1.5">${escapeXml(
          line,
        )}</text>`,
    )
    .join('')}

  <g transform="translate(60, ${countersTop})">
    <rect x="0" y="0" width="${counterWidth}" height="${countersHeight}" rx="28" fill="#ffffff" fill-opacity="0.05" stroke="#e8913c" stroke-opacity="0.32" stroke-width="2"/>
    <text x="34" y="72" font-size="46">🥚</text>
    <text x="34" y="150" font-size="62" font-weight="800" fill="#e8913c" letter-spacing="-2">${formatCount(
      totals.rottenEggTotal,
    )}</text>
    <text x="34" y="184" font-size="19" font-weight="600" fill="#a9a3bd" letter-spacing="2.5">ROTTEN EGGS</text>

    <rect x="${barWidth - counterWidth}" y="0" width="${counterWidth}" height="${countersHeight}" rx="28" fill="#ffffff" fill-opacity="0.05" stroke="#f2c14e" stroke-opacity="0.32" stroke-width="2"/>
    <text x="${barWidth - counterWidth + 34}" y="72" font-size="46">🏅</text>
    <text x="${barWidth - counterWidth + 34}" y="150" font-size="62" font-weight="800" fill="#f2c14e" letter-spacing="-2">${formatCount(
      totals.medalTotal,
    )}</text>
    <text x="${barWidth - counterWidth + 34}" y="184" font-size="19" font-weight="600" fill="#a9a3bd" letter-spacing="2.5">MEDALS</text>
  </g>

  <g transform="translate(60, ${barTop})">
    <rect x="0" y="0" width="${barWidth}" height="16" rx="8" fill="#ffffff" fill-opacity="0.1"/>
    <rect x="0" y="0" width="${negativeWidth}" height="16" rx="8" fill="#e8913c"/>
    <rect x="${negativeWidth}" y="0" width="${barWidth - negativeWidth}" height="16" rx="8" fill="#f2c14e"/>
    <text x="0" y="54" font-size="23" fill="#a9a3bd">${formatCount(totals.negativeOpinionTotal)} frustrated</text>
    <text x="${barWidth}" y="54" text-anchor="end" font-size="23" fill="#a9a3bd">${formatCount(
      totals.positiveOpinionTotal,
    )} appreciative</text>
    <text x="${barWidth / 2}" y="94" text-anchor="middle" font-size="22" fill="#7d7794">${formatCount(
      totals.uniqueParticipantTotal,
    )} people took part</text>
  </g>

  <g transform="translate(60, ${footerTop})">
    <text x="0" y="0" font-size="32" font-weight="700" fill="#f5f3fa">${escapeXml(input.caption)}</text>
    <text x="0" y="48" font-size="25" fill="#d8d4e4">${escapeXml(ownLine)}</text>
    <text x="0" y="100" font-size="21" fill="#7d7794">${escapeXml(stamp)}</text>
    <text x="${barWidth}" y="100" text-anchor="end" font-size="24" font-weight="700" fill="#e0483c">skewvy.com</text>
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
