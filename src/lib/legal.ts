/**
 * The facts the policy pages depend on, kept in one place so they can be
 * corrected without touching a page component.
 *
 * Nothing here should be aspirational. A provider is listed only if the
 * production deployment actually uses it; a cookie is described only if the
 * code actually sets it.
 */

/**
 * The legal name of whoever operates Skewvy, once there is one to state.
 * Set `LEGAL_OPERATOR_NAME` in the environment; until then the pages say
 * "independently operated" and name nobody.
 */
export const LEGAL_OPERATOR_NAME: string | null = process.env.LEGAL_OPERATOR_NAME?.trim() || null;

/**
 * Each policy's version is its effective date. Registration records the
 * versions in force when someone clicks Continue, so a later revision can be
 * told apart from what they agreed to. Change the date when the text changes.
 */
export const POLICY_VERSIONS = {
  terms: '2026-09-26',
  privacy: '2026-09-26',
} as const;

export function formatPolicyDate(version: string): string {
  return new Date(`${version}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Infrastructure that processes data on Skewvy's behalf in production. */
export const SERVICE_PROVIDERS: Array<{ name: string; purpose: string }> = [
  { name: 'Vercel', purpose: 'hosting and serving the website' },
  { name: 'Supabase', purpose: 'the database and uploaded image storage' },
  { name: 'Resend', purpose: 'sending account verification and PIN reset emails' },
  { name: 'Cloudflare Turnstile', purpose: 'checking that sign-ups, sign-ins and reports come from people, not bots' },
];

/** What the site stores in the browser. Essential only; there is no tracking. */
export const BROWSER_STORAGE: Array<{ name: string; purpose: string }> = [
  { name: 'skewvy_session (cookie)', purpose: 'keeps you signed in; removed when you sign out or it expires' },
  {
    name: 'Cloudflare Turnstile',
    purpose: 'the robot check on sign-up, sign-in and report forms may store its own short-lived security data',
  },
];
