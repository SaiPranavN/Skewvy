import { REACTION_VOICES } from './catalog';
import { moderateText } from './moderation';
import type { MoodStampArtworkData } from './types';

/**
 * The emails MoodStamps send: the stamp itself, and the one reminder that
 * stands in for any others that arrived the same day.
 *
 * Email clients understand tables and inline styles and very little else, so
 * the stamp is rebuilt from those. Three things make it hold up:
 *
 * - The perforated edge is four tiny images of a bite, tiled along each edge
 *   over the stamp's own colour. Masks and SVG, which the page uses, do not
 *   survive email. Where images are off the edge is simply straight.
 * - Display type is set in the heaviest face each platform has at weight 900
 *   — Arial Black on desktop, the bold system face on phones. Phones have no
 *   Arial Black, and a named weight of 400 fell back to a thin regular face.
 * - A small stylesheet resizes it for phones. Gmail's apps honour class-based
 *   media queries; the inline sizes are the desktop layout and the fallback.
 *
 * Every piece of text a person typed is escaped. The sender's email address
 * appears nowhere, and an anonymous sender's name is never put in at all.
 */

const INK = '#17140F';
const PAPER = '#F7F2E7';
const GROUND = '#DAD6CF';
const CARROT = '#FF6B45';
const GOLD = '#FFCB2F';
const VIOLET = '#9F7AFF';
const MUTED = '#4A453D';

const DISPLAY = "'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif";
const BODY = "'Helvetica Neue',Helvetica,Arial,sans-serif";

/** Content width inside the stamp on desktop, and on a phone. */
const DESKTOP_WIDTH = 468;
const PHONE_WIDTH = 262;

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
  /** Absolute URL of the folder holding the perforation images, without a trailing slash. */
  assetBaseUrl: string;
  /** The site's own address, linked from the masthead. */
  siteUrl: string;
}

export interface OutgoingEmail {
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export type MoodStampEmail = OutgoingEmail;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Who a MoodStamp says it is from. Display names are chosen freely at sign-up
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

/** Arial Black runs wide: about 0.82em a capital. The feeling fits its line, never breaking a word. */
function emotionSizes(emotion: string): { desktop: number; phone: number } {
  const longest = Math.max(4, ...emotion.split(/\s+/).map((word) => word.length));
  const fit = (width: number) => Math.floor(width / (longest * 0.82));
  return { desktop: Math.max(26, Math.min(64, fit(DESKTOP_WIDTH))), phone: Math.max(20, Math.min(44, fit(PHONE_WIDTH))) };
}

function unsubscribeHeaders(oneClickUrl: string | undefined): Record<string, string> | undefined {
  if (!oneClickUrl) return undefined;
  return { 'List-Unsubscribe': `<${oneClickUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}

/** A domain name typed as text is turned into a blue link by Gmail; an explicit link keeps the ink. */
function siteLink(siteUrl: string, style: string): string {
  return `<a href="${escapeHtml(siteUrl)}" style="${style}color:${INK};text-decoration:none;">skewvy.com</a>`;
}

function document(title: string, preheader: string, styles: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<title>${escapeHtml(title)}</title>
<style>
${styles}
</style>
</head>
<body style="margin:0;padding:0;background:${GROUND};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND};">
<tr><td align="center" class="ms-outer" style="padding:28px 12px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
${body}
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderMoodStampEmail(input: MoodStampEmailInput): OutgoingEmail {
  const { data } = input;
  const e = escapeHtml;
  const voice = REACTION_VOICES[data.reaction];
  const tone = data.reaction === 'medal' ? GOLD : CARROT;
  const unit = data.quantity === 1 ? voice.singular : voice.plural;
  const from = senderLabel(data);
  const shownFrom = from ?? 'Anonymous';
  const size = emotionSizes(data.emotion);

  const subject = from ? `${from} sent you a MoodStamp` : 'Someone sent you a MoodStamp';
  const preheader = `${data.quantity} ${unit} · ${voice.lead} ${data.emotion.toLowerCase()}`;
  const intro = from
    ? `<strong>${e(from)}</strong> sent you a MoodStamp on Skewvy — a feeling, counted and put into words.`
    : 'Someone sent you a MoodStamp on Skewvy. They chose to stay anonymous; Skewvy has verified that they hold an account.';

  const edge = (side: 'top' | 'bottom' | 'left' | 'right') => {
    const url = `${input.assetBaseUrl}/perf-${side}.png`;
    const repeat = side === 'top' || side === 'bottom' ? 'repeat-x' : 'repeat-y';
    const position = side === 'bottom' ? 'left bottom' : side === 'right' ? 'right top' : 'left top';
    return `background="${e(url)}" style="background-color:${tone};background-image:url('${e(url)}');background-repeat:${repeat};background-position:${position};font-size:0;line-height:0;"`;
  };

  const badge = (label: string, solid = false) =>
    `<span class="ms-badge" style="display:inline-block;border:2px solid ${INK};padding:5px 8px;margin:0 6px 6px 0;font:800 10px/1 ${BODY};letter-spacing:.16em;text-transform:uppercase;${
      solid ? `background:${INK};color:${PAPER};` : `color:${INK};`
    }">${label}</span>`;

  const reasonRow = (index: number) => `
            <tr>
              <td class="ms-row-label" width="32%" style="width:32%;padding:12px 14px;border-bottom:2px solid ${INK};font:800 10.5px/1.4 ${BODY};letter-spacing:.14em;text-transform:uppercase;color:${INK};vertical-align:top;">
                <span style="opacity:.6;">0${index + 1}</span>&nbsp;${e(voice.reasons[index].label)}
              </td>
              <td class="ms-row-text" style="padding:12px 14px 12px 0;border-bottom:2px solid ${INK};font:600 15px/1.4 ${BODY};color:${INK};vertical-align:top;">
                &ldquo;${e(data.reasons[index])}&rdquo;
              </td>
            </tr>`;

  const styles = `
@media only screen and (max-width:520px) {
  .ms-outer { padding:18px 8px 28px !important; }
  .ms-intro { font-size:14px !important; }
  .ms-pad { padding:14px 12px 12px !important; }
  .ms-badge { font-size:9px !important; padding:4px 6px !important; letter-spacing:.12em !important; }
  .ms-lead { font-size:12px !important; letter-spacing:.16em !important; padding-top:16px !important; }
  .ms-emotion { font-size:${size.phone}px !important; }
  .ms-number { font-size:46px !important; padding-right:8px !important; }
  .ms-unit { font-size:17px !important; }
  .ms-tag { font-size:8.5px !important; padding:4px 6px !important; letter-spacing:.06em !important; }
  .ms-tile-cell { display:none !important; }
  .ms-person-label { padding:10px 0 10px 12px !important; }
  .ms-name { font-size:17px !important; padding:10px 12px 10px 8px !important; }
  .ms-intent-aside { display:none !important; }
  .ms-row-label { display:block !important; width:auto !important; border-bottom:0 !important; padding:10px 12px 0 !important; }
  .ms-row-text { display:block !important; padding:4px 12px 12px !important; font-size:14px !important; }
  .ms-lead-text { font-size:18px !important; }
  .ms-foot-cell { display:block !important; text-align:left !important; padding-top:6px !important; }
}`;

  const body = `
  <tr><td class="ms-intro" style="padding:0 2px 18px;font:15px/1.55 ${BODY};color:${INK};">${intro}</td></tr>

  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${tone};">
      <tr><td colspan="3" height="13" ${edge('top')}>&nbsp;</td></tr>
      <tr>
        <td width="13" ${edge('left')}>&nbsp;</td>
        <td style="background:${tone};padding:4px 2px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${INK};">
          <tr><td class="ms-pad" style="padding:20px 20px 16px;">

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:4px solid ${INK};">
              <tr>
                <td style="padding-bottom:8px;">${siteLink(input.siteUrl, `font:800 16px/1 ${BODY};`)}</td>
                <td align="right" style="padding-bottom:8px;font:900 14px/1 ${DISPLAY};letter-spacing:.08em;color:${INK};">MOODSTAMP</td>
              </tr>
            </table>

            <div style="padding-top:12px;">${badge('Private')}${badge('Delivered', true)}${badge('Verified sender')}</div>

            <div class="ms-lead" style="padding-top:22px;font:900 15px/1 ${DISPLAY};letter-spacing:.2em;text-transform:uppercase;color:${INK};">${e(voice.lead)}</div>
            <div class="ms-emotion" style="padding-top:8px;font:900 ${size.desktop}px/0.95 ${DISPLAY};letter-spacing:-.02em;text-transform:uppercase;color:${INK};word-break:normal;overflow-wrap:normal;">${e(data.emotion)}</div>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">
              <tr>
                <td class="ms-number" style="font:900 72px/0.9 ${DISPLAY};letter-spacing:-.04em;color:${INK};padding-right:12px;vertical-align:middle;white-space:nowrap;">${data.quantity}</td>
                <td style="vertical-align:middle;">
                  <div class="ms-unit" style="font:900 24px/1 ${DISPLAY};text-transform:uppercase;color:${INK};white-space:nowrap;">${e(unit)}</div>
                  <div class="ms-tag" style="display:inline-block;margin-top:8px;background:${INK};color:${PAPER};padding:6px 9px;font:900 11px/1 ${DISPLAY};letter-spacing:.08em;white-space:nowrap;">DELIVERED TO YOU!!!</div>
                </td>
                <td class="ms-tile-cell" style="vertical-align:middle;padding-left:16px;">
                  <div style="width:56px;height:56px;line-height:56px;text-align:center;background:${
                    // The egg emoji is drawn near-white on every platform; it needs a dark tile to be seen.
                    data.reaction === 'medal' ? PAPER : INK
                  };border:3px solid ${INK};font-size:30px;">${data.reaction === 'medal' ? '🏅' : '🥚'}</div>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:${INK};">
              <tr>
                <td class="ms-person-label" width="1%" style="padding:12px 0 12px 14px;font:800 10px/1 ${BODY};letter-spacing:.2em;color:${PAPER};vertical-align:middle;white-space:nowrap;">FROM:</td>
                <td class="ms-name" style="padding:12px 14px 12px 10px;font:900 20px/1.1 ${DISPLAY};color:${PAPER};vertical-align:middle;">${e(shownFrom)}${
                  data.anonymous
                    ? `<div style="padding-top:6px;font:700 11px/1.3 ${BODY};color:${PAPER};"><span style="color:${tone};">&#10003;</span> Identity verified by Skewvy</div>`
                    : ''
                }</td>
              </tr>
              <tr>
                <td class="ms-person-label" width="1%" style="padding:12px 0 12px 14px;border-top:1px dashed #6b655b;font:800 10px/1 ${BODY};letter-spacing:.2em;color:${PAPER};white-space:nowrap;">TO:</td>
                <td class="ms-name" style="padding:12px 14px 12px 10px;border-top:1px dashed #6b655b;font:900 20px/1.1 ${DISPLAY};color:${PAPER};">${e(
                  data.recipientName,
                )}</td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:${PAPER};border:2px solid ${INK};">
              <tr>
                <td colspan="2" style="padding:11px 14px;border-bottom:2px solid ${INK};">
                  <span style="font:800 11px/1 ${BODY};letter-spacing:.2em;text-transform:uppercase;color:${INK};">${e(voice.intent)}</span>
                  <span class="ms-intent-aside" style="float:right;font:600 12px/1 ${BODY};color:${INK};">${e(voice.intentAside)}</span>
                </td>
              </tr>
              ${reasonRow(0)}
              ${reasonRow(1)}
              <tr>
                <td colspan="2" style="padding:12px 14px 16px;background:${tone};">
                  <div style="font:800 10.5px/1.4 ${BODY};letter-spacing:.14em;text-transform:uppercase;color:${INK};"><span style="opacity:.6;">03</span>&nbsp;${e(
                    voice.reasons[2].label,
                  )}</div>
                  <div class="ms-lead-text" style="padding-top:6px;font:900 22px/1.15 ${DISPLAY};letter-spacing:-.01em;color:${INK};">&ldquo;${e(
                    data.reasons[2],
                  )}&rdquo;</div>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:4px solid ${INK};">
              <tr>
                <td class="ms-foot-cell" style="padding-top:10px;font:800 12.5px/1.4 ${BODY};color:${INK};">${
                  data.receiptCode ? `Receipt ${e(data.receiptCode)}` : ''
                }<br><span style="font-weight:600;font-size:11px;">A feeling, counted and delivered by ${siteLink(
                  input.siteUrl,
                  'font-weight:600;font-size:11px;',
                )}</span></td>
                <td class="ms-foot-cell" align="right" style="padding-top:10px;font:800 12.5px/1.4 ${BODY};color:${INK};vertical-align:top;">Delivered ${formatDate(
                  data.date,
                )}</td>
              </tr>
            </table>

          </td></tr>
          </table>
        </td>
        <td width="13" ${edge('right')}>&nbsp;</td>
      </tr>
      <tr><td colspan="3" height="13" ${edge('bottom')}>&nbsp;</td></tr>
    </table>
  </td></tr>

  <tr><td align="center" style="padding:28px 0 6px;">
    <a href="${e(input.openUrl)}" style="display:inline-block;background:${VIOLET};color:${INK};border:2px solid ${INK};padding:15px 26px;font:800 15px/1 ${BODY};text-decoration:none;">Open your MoodStamp</a>
  </td></tr>
  <tr><td align="center" style="padding:6px 0 0;font:13px/1.5 ${BODY};color:${MUTED};">Open it to keep it, or download it as an image.</td></tr>

  <tr><td style="padding:30px 2px 0;font:12px/1.6 ${BODY};color:${MUTED};border-top:1px solid #b9b3a8;">
    You got this because someone entered your email address on Skewvy to send you a MoodStamp. Skewvy checks every
    MoodStamp for swearing, insults and threats before it is sent, and emails any address at most once a day — if more
    arrive, they wait on Skewvy and you get one reminder.<br><br>
    <a href="${e(input.optOutUrl)}" style="color:${INK};font-weight:700;">Stop MoodStamps to this address</a>
    &nbsp;·&nbsp;
    <a href="${e(input.reportUrl)}" style="color:${INK};font-weight:700;">Report this MoodStamp</a>
  </td></tr>`;

  const text = [
    from
      ? `${from} sent you a MoodStamp on Skewvy.`
      : 'Someone sent you a MoodStamp on Skewvy. They chose to stay anonymous; Skewvy has verified that they hold an account.',
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
    html: document(subject, preheader, styles, body),
    text,
    headers: unsubscribeHeaders(input.oneClickOptOutUrl),
  };
}

export interface ReminderEmailInput {
  /** How many MoodStamps are waiting that have not been mentioned before. */
  count: number;
  /** Whether a verified account already holds this address. */
  hasAccount: boolean;
  /** Where the button goes: the board, or sign-up with the way back to it. */
  actionUrl: string;
  /** The address they were sent to, so a new account is made with the right one. */
  email: string;
  optOutUrl: string;
  /** Absent for the email about a person's own link, which they switch off on Skewvy. */
  oneClickOptOutUrl?: string;
  siteUrl: string;
  /**
   * 'address': MoodStamps sent to this address, held back to keep it to one
   * email a day. 'link': MoodStamps written on the person's own link.
   */
  source?: 'address' | 'link';
}

/**
 * The one email that stands in for every MoodStamp held back that day.
 *
 * It says how many are waiting and where, and nothing else: no senders, no
 * feelings. Anyone who wants to read them signs in — or, without an account,
 * makes one with this address, which is what proves the stamps are theirs.
 */
export function renderReminderEmail(input: ReminderEmailInput): OutgoingEmail {
  const e = escapeHtml;
  const many = input.count > 1;
  const viaLink = input.source === 'link';
  const subject = many ? `You have ${input.count} MoodStamps waiting` : 'You have a MoodStamp waiting';
  const lead = viaLink
    ? many
      ? `${input.count} MoodStamps came in through your MoodStamp link.`
      : 'A MoodStamp came in through your MoodStamp link.'
    : many
      ? `${input.count} more MoodStamps were sent to you on Skewvy.`
      : 'Another MoodStamp was sent to you on Skewvy.';
  const why = viaLink
    ? 'They are on your MoodStamps board. Skewvy tells you about new ones at most once a day.'
    : 'So your inbox is not flooded, Skewvy emails you at most one MoodStamp a day. The rest wait for you on your MoodStamps board.';
  const footer = viaLink
    ? 'You got this because you have a MoodStamp link on Skewvy.'
    : 'You got this because MoodStamps were sent to your email address on Skewvy.';
  const stopLabel = viaLink ? 'Turn off these emails' : 'Stop MoodStamps to this address';
  const action = input.hasAccount ? 'Open your MoodStamps' : 'Create your account to read them';
  const accountNote = input.hasAccount
    ? 'Sign in to Skewvy to read them.'
    : `They are waiting under this address. Sign up with ${e(input.email)} and they will be on your board.`;

  const body = `
  <tr><td style="background:${PAPER};border:3px solid ${INK};padding:28px 26px 26px;">
    <div>${siteLink(input.siteUrl, `font:800 16px/1 ${BODY};`)}</div>
    <div style="padding-top:22px;font:900 30px/1.05 ${DISPLAY};letter-spacing:-.02em;color:${INK};">${e(subject)}.</div>
    <p style="margin:16px 0 0;font:16px/1.55 ${BODY};color:${INK};">${e(lead)} ${e(why)}</p>
    <p style="margin:12px 0 0;font:15px/1.55 ${BODY};color:${MUTED};">${accountNote}</p>
    <div style="padding-top:24px;">
      <a href="${e(input.actionUrl)}" style="display:inline-block;background:${VIOLET};color:${INK};border:2px solid ${INK};padding:15px 24px;font:800 15px/1 ${BODY};text-decoration:none;">${action}</a>
    </div>
  </td></tr>
  <tr><td style="padding:26px 2px 0;font:12px/1.6 ${BODY};color:${MUTED};">
    ${e(footer)}<br><br>
    <a href="${e(input.optOutUrl)}" style="color:${INK};font-weight:700;">${e(stopLabel)}</a>
  </td></tr>`;

  const text = [
    `${subject}.`,
    '',
    `${lead} ${why}`,
    input.hasAccount ? 'Sign in to Skewvy to read them.' : `Sign up with ${input.email} and they will be on your board.`,
    '',
    `${action}: ${input.actionUrl}`,
    '',
    `${stopLabel}: ${input.optOutUrl}`,
  ].join('\n');

  return { subject, html: document(subject, subject, '', body), text, headers: unsubscribeHeaders(input.oneClickOptOutUrl) };
}
