import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  sentAt: string;
}

/** Tests and the dev inbox page read from here. */
const globalForMail = globalThis as unknown as { __skewvyOutbox?: OutboundEmail[] };
globalForMail.__skewvyOutbox ??= [];

export function outbox(): OutboundEmail[] {
  return globalForMail.__skewvyOutbox!;
}

export function clearOutbox(): void {
  globalForMail.__skewvyOutbox!.length = 0;
}

/**
 * Transport selection:
 *  - `RESEND_API_KEY` set  → real delivery over the Resend HTTP API.
 *  - otherwise             → dev transport: the message is kept in memory,
 *    written to `.mail/` as HTML, and the link is logged to the server console.
 */
export async function sendEmail(message: Omit<OutboundEmail, 'sentAt'>): Promise<void> {
  const record: OutboundEmail = { ...message, sentAt: new Date().toISOString() };
  const store = outbox();
  store.push(record);
  if (store.length > 100) store.splice(0, store.length - 100);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Skewvy <onboarding@resend.dev>',
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Email delivery failed with status ${response.status}`);
    }
    return;
  }

  if (process.env.NODE_ENV !== 'test') {
    const directory = path.join(process.cwd(), '.mail');
    const file = path.join(directory, `${Date.now()}-${message.to.replace(/[^a-z0-9]/gi, '_')}.html`);
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(file, message.html, 'utf8');
    } catch {
      // A read-only filesystem must not break the auth flow.
    }
    const link = message.text.match(/https?:\/\/\S+/)?.[0];
    console.info(`\n📮 [skewvy dev mail] to=${message.to} — ${message.subject}\n   ${link ?? file}\n`);
  }
}

const BRAND_STYLES = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#0b0b12;color:#f3f1f7;padding:32px;border-radius:20px;max-width:520px;margin:0 auto;`;

function template(title: string, intro: string, buttonLabel: string, url: string, footer: string): string {
  return `<!doctype html><html><body style="background:#07070c;padding:24px;margin:0;">
  <div style="${BRAND_STYLES}">
    <div style="font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:#e0483c;font-weight:700;">Skewvy</div>
    <h1 style="font-size:24px;margin:16px 0 8px;line-height:1.25;">${title}</h1>
    <p style="color:#b9b4c9;font-size:15px;line-height:1.6;margin:0 0 24px;">${intro}</p>
    <a href="${url}" style="display:inline-block;background:#e0483c;color:#fff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:600;font-size:15px;">${buttonLabel}</a>
    <p style="color:#7d7791;font-size:13px;line-height:1.6;margin:24px 0 0;">${footer}</p>
    <p style="color:#5c5872;font-size:12px;line-height:1.6;margin:16px 0 0;word-break:break-all;">${url}</p>
  </div></body></html>`;
}

export async function sendVerificationEmail(to: string, displayName: string, url: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Verify your email for Skewvy',
    html: template(
      `One tap to confirm, ${displayName}`,
      'Confirm this email address once and you are done — from then on you sign in with your email and PIN.',
      'Verify my email',
      url,
      'This link works once and expires in 60 minutes. If you did not create a Skewvy account, ignore this message.',
    ),
    text: `Verify your Skewvy email: ${url}\n\nThis link works once and expires in 60 minutes.`,
  });
}

export async function sendPinResetEmail(to: string, displayName: string, url: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Reset your Skewvy PIN',
    html: template(
      `Set a new PIN, ${displayName}`,
      'Use the link below to choose a new PIN. Every existing Skewvy session will be signed out once you do.',
      'Choose a new PIN',
      url,
      'This link works once and expires in 30 minutes. If you did not ask for it, you can safely ignore this email.',
    ),
    text: `Reset your Skewvy PIN: ${url}\n\nThis link works once and expires in 30 minutes.`,
  });
}

export async function sendStepUpEmail(to: string, displayName: string, url: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'Confirm this sign-in to Skewvy',
    html: template(
      `New device, ${displayName}?`,
      'We saw a sign-in we did not recognise. Confirm it was you and we will finish signing you in.',
      'Yes, that was me',
      url,
      'This link works once and expires in 30 minutes. If this was not you, change your PIN.',
    ),
    text: `Confirm your Skewvy sign-in: ${url}\n\nThis link works once and expires in 30 minutes.`,
  });
}
