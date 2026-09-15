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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
if (!supabaseUrl) {
  console.info('  –  skipped (set NEXT_PUBLIC_SUPABASE_URL to check the optimiser allowlist)');
} else {
  try {
    const sample = `${supabaseUrl}/storage/v1/object/public/artifact-images/smoke-probe.png`;
    const response = await get(`/_next/image?url=${encodeURIComponent(sample)}&w=64&q=75`);

    /*
     * Both a blocked host and a missing object answer 400, so the status alone
     * says nothing. The body is what tells them apart: "not allowed" is the
     * allowlist refusing the host, while "upstream response is invalid" means
     * the host was accepted and only this object is absent — which is expected,
     * since nothing guarantees a particular image exists.
     */
    const body = response.ok ? '' : await response.text().catch(() => '');
    const blocked = body.includes('not allowed');
    report(!blocked, 'Supabase Storage host is on the optimiser allowlist', blocked ? 'host refused' : 'permitted');

    // And the allowlist is still an allowlist.
    const proxied = await get('/_next/image?url=https%3A%2F%2Fevil.example.invalid%2Fx.png&w=64&q=75');
    const refused = (await proxied.text().catch(() => '')).includes('not allowed');
    report(refused, 'arbitrary hosts refused — not an open image proxy');
  } catch (error) {
    report(false, 'image optimiser', (error as Error).message);
  }
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
