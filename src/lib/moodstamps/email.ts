import { REACTION_VOICES } from './catalog';
import { moderateText } from './moderation';
import type { MoodStampArtworkData } from './types';

/**
 * The email a MoodStamp arrives in.
 *
 * Email clients understand tables and inline styles and very little else, so
 * the stamp is rebuilt from those: the same tone, ink frame, feeling, count,
 * From / To bar and three reasons as the page and the downloaded image, in
 * Arial Black where the display face cannot load. The link underneath opens
 * the real one.
 *
 * Every piece of text a person typed is escaped. The sender's email address
 * appears nowhere, and an anonymous sender's name is never put in at all —
 * not in the subject, the body, or the plain-text part.
 */

const INK = '#17140F';
const PAPER = '#F7F2E7';
const GROUND = '#DAD6CF';
const CARROT = '#FF6B45';
const GOLD = '#FFCB2F';
const VIOLET = '#9F7AFF';

const DISPLAY = "'Archivo Black','Arial Black',Arial,Helvetica,sans-serif";
const BODY = 'Arial,Helvetica,sans-serif';

export interface MoodStampEmailInput {
  data: MoodStampArtworkData;
  /** The recipient's private link to the stamp. */
  openUrl: string;
  /** The page where the recipient can stop MoodStamps to their address. */
  optOutUrl: string;
  /** The one-click unsubscribe endpoint, for the List-Unsubscribe header. */
  oneClickOptOutUrl: string;
  /** The report form, pointed at this stamp. */
  reportUrl: string;
}

export interface MoodStampEmail {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Who the email says it is from. Display names are chosen freely at sign-up
 * and are not checked the way a MoodStamp is, so a name that would fail those
 * checks is not printed in someone else's inbox under Skewvy's name.
 */
export function senderLabel(data: Pick<MoodStampArtworkData, 'anonymous' | 'senderName'>): string | null {
  if (data.anonymous) return null;
  const name = data.senderName.trim();
  if (!name || !moderateText(name).clean) return 'A Skewvy member';
  return name;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  );
}

export function renderMoodStampEmail(input: MoodStampEmailInput): MoodStampEmail {
  const { data } = input;
  const voice = REACTION_VOICES[data.reaction];
  const tone = data.reaction === 'medal' ? GOLD : CARROT;
  const unit = data.quantity === 1 ? voice.singular : voice.plural;
  const from = senderLabel(data);
  const shownFrom = from ?? 'Anonymous';

  const subject = from ? `${from} sent you a MoodStamp` : 'Someone sent you a MoodStamp';
  const preheader = `${data.quantity} ${unit} · ${voice.lead} ${data.emotion.toLowerCase()}`;

  const longest = Math.max(4, ...data.emotion.split(/\s+/).map((word) => word.length));
  const emotionSize = Math.max(28, Math.min(64, Math.floor(470 / (longest * 0.74))));

  const e = escapeHtml;
  const intro = from
    ? `<strong>${e(from)}</strong> sent you a MoodStamp on Skewvy — a feeling, counted and put into words.`
    : 'Someone sent you a MoodStamp on Skewvy. They chose to stay anonymous; Skewvy has verified that they hold an account.';

  const badge = (label: string, solid = false) =>
    `<span style="display:inline-block;border:2px solid ${INK};padding:5px 8px;margin:0 6px 6px 0;font:800 10px/1 ${BODY};letter-spacing:.16em;text-transform:uppercase;${
      solid ? `background:${INK};color:${PAPER};` : `color:${INK};`
    }">${label}</span>`;

  const reasonRow = (index: number) => `
      <tr>
        <td style="padding:12px 14px;border-bottom:2px solid ${INK};font:800 10.5px/1.4 ${BODY};letter-spacing:.14em;text-transform:uppercase;color:${INK};width:32%;vertical-align:top;">
          <span style="opacity:.6;">0${index + 1}</span> ${e(voice.reasons[index].label)}
        </td>
        <td style="padding:12px 14px 12px 0;border-bottom:2px solid ${INK};font:600 15px/1.4 ${BODY};color:${INK};vertical-align:top;">
          “${e(data.reasons[index])}”
        </td>
      </tr>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND};">
<tr><td align="center" style="padding:28px 12px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td style="padding:0 2px 18px;font:15px/1.55 ${BODY};color:${INK};">${intro}</td></tr>

  <tr><td style="background:${tone};border:3px solid ${INK};padding:12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${INK};">
    <tr><td style="padding:20px 20px 16px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:4px solid ${INK};">
        <tr>
          <td style="padding-bottom:8px;font:800 16px/1 ${BODY};color:${INK};">skewvy.com</td>
          <td align="right" style="padding-bottom:8px;font:400 15px/1 ${DISPLAY};letter-spacing:.06em;color:${INK};">MOODSTAMP</td>
        </tr>
      </table>

      <div style="padding-top:12px;">${badge('Private')}${badge('Delivered', true)}${badge('Verified sender')}</div>

      <div style="padding-top:22px;font:400 15px/1 ${DISPLAY};letter-spacing:.2em;text-transform:uppercase;color:${INK};">${e(voice.lead)}</div>
      <div style="padding-top:8px;font:400 ${emotionSize}px/0.95 ${DISPLAY};letter-spacing:-.03em;text-transform:uppercase;color:${INK};word-break:break-word;">${e(data.emotion)}</div>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">
        <tr>
          <td style="font:400 72px/0.9 ${DISPLAY};letter-spacing:-.05em;color:${INK};padding-right:12px;vertical-align:middle;">${data.quantity}</td>
          <td style="vertical-align:middle;">
            <div style="font:400 24px/1 ${DISPLAY};text-transform:uppercase;color:${INK};">${e(unit)}</div>
            <div style="display:inline-block;margin-top:8px;background:${INK};color:${PAPER};padding:6px 9px;font:400 11px/1 ${DISPLAY};letter-spacing:.08em;">DELIVERED TO YOU!!!</div>
          </td>
          <td style="vertical-align:middle;padding-left:14px;">
            <div style="width:56px;height:56px;line-height:56px;text-align:center;background:${
              // The egg emoji is drawn near-white on every platform; it needs a dark tile to be seen.
              data.reaction === 'medal' ? PAPER : INK
            };border:3px solid ${INK};font-size:30px;">${
              data.reaction === 'medal' ? '🏅' : '🥚'
            }</div>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:${INK};">
        <tr>
          <td width="1%" style="padding:12px 14px;font:800 10px/1 ${BODY};letter-spacing:.2em;color:${PAPER};vertical-align:middle;white-space:nowrap;">FROM:</td>
          <td style="padding:12px 14px 12px 0;font:400 20px/1.1 ${DISPLAY};color:${PAPER};vertical-align:middle;">${e(shownFrom)}${
            data.anonymous
              ? `<div style="padding-top:6px;font:700 11px/1.3 ${BODY};color:${PAPER};"><span style="color:${tone};">✓</span> Identity verified by Skewvy</div>`
              : ''
          }</td>
        </tr>
        <tr>
          <td width="1%" style="padding:12px 14px;border-top:1px dashed #6b655b;font:800 10px/1 ${BODY};letter-spacing:.2em;color:${PAPER};white-space:nowrap;">TO:</td>
          <td style="padding:12px 14px 12px 0;border-top:1px dashed #6b655b;font:400 20px/1.1 ${DISPLAY};color:${PAPER};">${e(
            data.recipientName,
          )}</td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:${PAPER};border:2px solid ${INK};">
        <tr>
          <td colspan="2" style="padding:11px 14px;border-bottom:2px solid ${INK};">
            <span style="font:800 11px/1 ${BODY};letter-spacing:.2em;text-transform:uppercase;color:${INK};">${e(voice.intent)}</span>
            <span style="float:right;font:600 12px/1 ${BODY};color:${INK};">${e(voice.intentAside)}</span>
          </td>
        </tr>
        ${reasonRow(0)}
        ${reasonRow(1)}
        <tr>
          <td colspan="2" style="padding:12px 14px 16px;background:${tone};">
            <div style="font:800 10.5px/1.4 ${BODY};letter-spacing:.14em;text-transform:uppercase;color:${INK};"><span style="opacity:.6;">03</span> ${e(
              voice.reasons[2].label,
            )}</div>
            <div style="padding-top:6px;font:400 22px/1.15 ${DISPLAY};letter-spacing:-.02em;color:${INK};">“${e(data.reasons[2])}”</div>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:4px solid ${INK};">
        <tr>
          <td style="padding-top:10px;font:800 12.5px/1.4 ${BODY};color:${INK};">${
            data.receiptCode ? `Receipt ${e(data.receiptCode)}` : ''
          }<br><span style="font-weight:600;font-size:11px;">A feeling, counted and delivered by skewvy.com</span></td>
          <td align="right" style="padding-top:10px;font:800 12.5px/1.4 ${BODY};color:${INK};vertical-align:top;">Delivered ${formatDate(
            data.date,
          )}</td>
        </tr>
      </table>

    </td></tr>
    </table>
  </td></tr>

  <tr><td align="center" style="padding:28px 0 6px;">
    <a href="${e(input.openUrl)}" style="display:inline-block;background:${VIOLET};color:${INK};border:2px solid ${INK};padding:15px 26px;font:800 15px/1 ${BODY};text-decoration:none;">Open your MoodStamp</a>
  </td></tr>
  <tr><td align="center" style="padding:6px 0 0;font:13px/1.5 ${BODY};color:#4a453d;">Open it to keep it, or download it as an image.</td></tr>

  <tr><td style="padding:30px 2px 0;font:12px/1.6 ${BODY};color:#4a453d;border-top:1px solid #b9b3a8;">
    You got this because someone entered your email address on skewvy.com to send you a MoodStamp. Skewvy checks every
    MoodStamp for swearing, insults and threats before it is sent.<br><br>
    <a href="${e(input.optOutUrl)}" style="color:${INK};font-weight:700;">Stop MoodStamps to this address</a>
    &nbsp;·&nbsp;
    <a href="${e(input.reportUrl)}" style="color:${INK};font-weight:700;">Report this MoodStamp</a>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    from ? `${from} sent you a MoodStamp on Skewvy.` : 'Someone sent you a MoodStamp on Skewvy. They chose to stay anonymous; Skewvy has verified that they hold an account.',
    '',
    `${voice.lead.toUpperCase()} ${data.emotion.toUpperCase()}`,
    `${data.quantity} ${unit.toUpperCase()}`,
    '',
    `From: ${shownFrom}`,
    `To: ${data.recipientName}`,
    '',
    voice.intent.toUpperCase(),
    ...voice.reasons.map((prompt, index) => `${prompt.label}: “${data.reasons[index]}”`),
    '',
    data.receiptCode ? `Receipt ${data.receiptCode}` : '',
    '',
    `Open your MoodStamp: ${input.openUrl}`,
    '',
    `Stop MoodStamps to this address: ${input.optOutUrl}`,
    `Report this MoodStamp: ${input.reportUrl}`,
  ].join('\n');

  return {
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${input.oneClickOptOutUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
