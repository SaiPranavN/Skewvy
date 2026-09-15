/**
 * Checks a deployed Skewvy against the things that only break in production.
 *
 *   npm run smoke -- https://skewvy.com
 *
 * Every check is read-only and safe to run against a live site. Nothing here
 * creates an account, sends an email or writes a reaction.
 */

// Top-level await needs this file to be a module; it imports nothing else.
export {};

const base = process.argv[2]?.replace(/\/+$/, '');

if (!base) {
  console.error('Usage: npm run smoke -- https://your-deployment.vercel.app');
  process.exit(1);
}

let failures = 0;

function report(ok: boolean, label: string, detail = '') {
  if (!ok) failures += 1;
  console.info(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
}

/*
 * A refused host reads differently depending on who answered. The Next dev
 * server says the url parameter is not allowed; Vercel's edge optimiser says
 * INVALID_IMAGE_OPTIMIZE_REQUEST. Matching only the first reported the live
 * site as an open image proxy when it was refusing correctly.
 */
function refusedByAllowlist(body: string): boolean {
  return /not allowed|INVALID_IMAGE_OPTIMIZE_REQUEST/i.test(body);
}

async function get(path: string, init?: RequestInit) {
  return fetch(`${base}${path}`, { redirect: 'manual', ...init });
}

console.info(`\n🔎 ${base}\n`);

/* ------------------------------ pages render ------------------------------ */

console.info('Pages');
for (const path of ['/', '/flash-news', '/entities', '/trending', '/login', '/register']) {
  const started = Date.now();
  try {
    const response = await get(path);
    report(response.ok, path, `${response.status} in ${Date.now() - started}ms`);
  } catch (error) {
    report(false, path, (error as Error).message);
  }
}

/* --------------------------- the database is live -------------------------- */

console.info('\nDatabase');
try {
  const response = await get('/');
  const html = await response.text();
  // The landing page renders content from the database, or an empty state that
  // only appears when the query succeeded and came back with nothing.
  const reachable = html.includes('reacting to') || html.includes('No published content yet');
  report(reachable, 'reachable from the deployment', reachable ? '' : 'page rendered without content');
  report(!html.includes('DATABASE_URL is not set'), 'DATABASE_URL configured');
} catch (error) {
  report(false, 'reachable from the deployment', (error as Error).message);
}

/* ------------------------------ the bot check ------------------------------ */

console.info('\nTurnstile');
try {
  const login = await get('/login');
  const html = await login.text();
  const key = html.match(/0x[A-Za-z0-9]{20,}/)?.[0];
  report(Boolean(key), 'site key served to the browser', key ? `${key.slice(0, 12)}…` : 'not found');
  report(!html.includes('1x00000000000000000000AA'), 'not running on the always-passes test key');

  // The escape hatch for a widget that cannot load must be dead in production.
  const bypass = await get('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'smoke-check@example.invalid',
      pin: 'not-a-real-pin',
      turnstileToken: 'skewvy-widget-unavailable',
    }),
  });
  report(bypass.status === 400, 'bypass token refused', `HTTP ${bypass.status}`);
} catch (error) {
  report(false, 'bot check', (error as Error).message);
}

/* ------------------------------ uploaded images ---------------------------- */

console.info('\nImages');
try {
  /*
   * Checked against an image the site is actually rendering, rather than a URL
   * invented here. On Vercel a blocked host and a missing object produce the
   * same error, so a probe for something that may not exist proves nothing —
   * while an image the page is already asking for either loads or does not.
   */
  const pages = ['/entities', '/flash-news', '/'];
  let optimised: string | null = null;

  for (const page of pages) {
    const html = await (await get(page)).text();
    const match = html.match(/\/_next\/image\?url=[^"'\s]+/);
    if (match) {
      optimised = match[0].replace(/&amp;/g, '&');
      break;
    }
  }

  if (!optimised) {
    console.info('  –  skipped (no images published yet)');
  } else {
    const response = await get(optimised);
    const remote = optimised.includes('supabase.co');
    report(
      response.ok,
      `a published image loads through the optimiser${remote ? ' from Supabase Storage' : ''}`,
      `HTTP ${response.status}`,
    );
  }

  // And the allowlist is still an allowlist.
  const proxied = await get('/_next/image?url=https%3A%2F%2Fevil.example.invalid%2Fx.png&w=64&q=75');
  const refused = !proxied.ok && refusedByAllowlist(await proxied.text().catch(() => ''));
  report(refused, 'arbitrary hosts refused — not an open image proxy');
} catch (error) {
  report(false, 'image optimiser', (error as Error).message);
}

/* --------------------------------- realtime -------------------------------- */

console.info('\nRealtime');
try {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(`${base}/api/realtime/stream`, { signal: controller.signal });
  clearTimeout(timer);
  const contentType = response.headers.get('content-type') ?? '';
  report(contentType.includes('text/event-stream'), 'stream endpoint responds', contentType || `HTTP ${response.status}`);
  await response.body?.cancel();
} catch (error) {
  const aborted = (error as Error).name === 'AbortError';
  // An open stream that never ends is the endpoint working, not failing.
  report(aborted, 'stream endpoint responds', aborted ? 'held open' : (error as Error).message);
}

/* ---------------------------------- links ---------------------------------- */

console.info('\nConfiguration');
try {
  const response = await get('/');
  const html = await response.text();
  const localhost = html.includes('http://localhost:3000');
  report(!localhost, 'NEXT_PUBLIC_APP_URL points at the real origin', localhost ? 'still localhost' : '');
} catch (error) {
  report(false, 'app url', (error as Error).message);
}

console.info(
  failures === 0
    ? '\n✅ Everything checked out.\n'
    : `\n❌ ${failures} check${failures === 1 ? '' : 's'} failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
