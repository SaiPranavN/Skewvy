# Skewvy

**A global sentiment playground.** People find an **Entity** or a piece of **Flash News**, then tap
🥚 **Rotten Eggs** or 🏅 **Medals** as many times as they feel like it. The counters are the product.

> Every tap adds to the reaction total. Every person counts once in the public opinion.

---

## The one rule that shapes everything

**Reactions and Opinions are different measurements and are never mixed.**

| | What it counts | Where it lives | Behaviour |
|---|---|---|---|
| **Reaction** | Individual taps — emotional *intensity* | `reaction_aggregates` (one row per person per artifact) | Accumulates without limit |
| **Opinion** | *People* — one position per person per artifact | `opinions`, unique on `(user_id, artifact_type, artifact_id)` | Upserted; switching sides moves the row, never duplicates it |

If one person sends 100 Rotten Eggs: the Rotten Egg counter rises by 100, **one** aggregate row records
100 units, and **one** opinion row records them as negative. No row is written per tap, ever.

---

## Quick start

```bash
npm install
npm run db:reset   # creates the schema and seeds the demo world
npm run dev        # http://localhost:3000
```

That is the whole setup. No Docker, no database server, no API keys — every service has a working
development default. Node 22.5 or newer is required.

To make yourself an administrator:

```bash
npm run admin -- you@example.com
```

(Register the account first, or list the address in `ADMIN_EMAILS` before registering.)

Locked out — forgotten PIN, or an account created before you picked one? Set a PIN directly, creating
the account if it does not exist:

```bash
npm run pin -- you@example.com your-new-pin
```

Add `--admin` to grant the admin flag at the same time. This talks to the database, never over HTTP.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, design tokens as CSS custom properties |
| Typeface | Geist, self-hosted — one family throughout |
| Database | One adapter, two drivers — `node:sqlite` locally, PostgreSQL (`pg`) in production |
| PIN hashing | Argon2id (`@node-rs/argon2`), scrypt fallback |
| Bot check | Cloudflare Turnstile, verified server-side |
| Realtime | Server-sent events + an in-process bus (PostgreSQL `LISTEN/NOTIFY` across instances) |
| Validation | Zod schemas shared by the forms and the route handlers |
| Motion | One shared token set; pooled DOM particles, CSS keyframes — no animation library |
| Share card | SVG composed in the browser and rasterised through a canvas — no dependency |
| Tests | Vitest against a real temporary SQLite database |

Domain logic lives in `src/lib/services/*` and is called by both route handlers and server components.
UI components never talk to the database.

---

## Environment variables

Copy `.env.example` to `.env.local`. Everything is optional locally.

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:./data/skewvy.db` | A `postgres://…` URL switches drivers automatically |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Base for emailed links — **must be set in production** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare test key | Public site key |
| `TURNSTILE_SECRET_KEY` | Cloudflare test key | **Set both in production** |
| `TURNSTILE_DISABLED` | unset | `1` bypasses the check entirely. Ignored when `NODE_ENV=production` |
| `RESEND_API_KEY` | unset | Without it, mail is written to `.mail/` and logged |
| `EMAIL_FROM` | `Skewvy <onboarding@resend.dev>` | Sender identity |
| `IP_HASH_PEPPER` | dev value | **Set a long random value in production** |
| `ADMIN_EMAILS` | unset | Comma-separated; these get the admin flag at registration |
| `REALTIME_PG_NOTIFY` | unset | `1` relays realtime events between instances (PostgreSQL only) |
| `ALLOW_SIMULATOR` | unset | `1` permits the demo simulator outside development |

---

## Database

### Local (default)

SQLite through Node's built-in `node:sqlite`, which still sits behind a flag — the npm scripts pass
`--experimental-sqlite` for you. The file lives at `data/skewvy.db` and is gitignored.

```bash
npm run db:migrate   # apply the schema (idempotent)
npm run db:seed      # add demo content on top of what is there
npm run db:reset     # delete the file and rebuild from scratch
```

### PostgreSQL

Point `DATABASE_URL` at a PostgreSQL instance and run the same commands — the schema is written to be
valid on both engines (application-generated UUID text ids, ISO-8601 text timestamps, 0/1 integers for
booleans). Add `?sslmode=require` for a managed provider.

```bash
DATABASE_URL=postgres://user:pass@host:5432/skewvy npm run db:migrate
DATABASE_URL=postgres://user:pass@host:5432/skewvy npm run db:seed
```

### Tables

`users`, `sessions`, `auth_tokens`, `entities`, `flash_news`, `flash_news_entities`, `opinions`,
`reaction_aggregates`, `artifact_totals`, `reaction_batches`, `rate_limits`, `app_settings`.

The schema is the string in [`src/lib/db/schema.ts`](src/lib/db/schema.ts).

---

## Authentication

Passwordless registration with a **user-chosen PIN** for everyday access.

**Email is only required where it can actually be sent.** With no `RESEND_API_KEY` configured,
registration creates the account and signs you in immediately with whatever address you type, and
risk-based step-up is skipped — a prototype must not send people to an inbox nothing can reach. Set
`RESEND_API_KEY` and the full verification flow turns itself back on; production always requires it,
whatever the environment says. `REQUIRE_EMAIL_VERIFICATION` overrides the rule in either direction.

**Register (with email configured)** → Turnstile is verified server-side → the account is created
with the PIN hashed → a one-time link is emailed → opening it verifies the address and opens a
session.

**Sign in afterwards** → email + PIN + Turnstile. **No email is sent when a session expires.** The
inbox is only involved for first verification, PIN reset, and risk-based step-up.

**Step-up** → a sign-in from a device and network the account has never used asks for one email
confirmation. It is the exception, not the routine.

**Forgotten PIN.** With a mail transport, "Forgot PIN?" emails a one-click link. Without one, the
same screen takes the address and sets the new PIN in place — there is no inbox to send anyone to,
and a forgotten PIN would otherwise lock the account permanently. The direct path is refused by the
service the moment email verification is required, so a live deployment always proves inbox
ownership first.

Also implemented: HTTP-only `SameSite=Lax` cookies, token rotation after login, sliding 30-day
expiry, progressive lockout (60s → 5min → 30min), per-address and per-IP rate limits, resend
cooldowns, PIN reset that revokes every session, and invalid/expired states for every emailed link.

**The robot check.** Turnstile is verified server-side on every entry point. Until a real site key
*and* secret are both configured, the app runs on Cloudflare's public test keys, where every token
passes and the check carries no security value — so a browser that cannot load the widget (blocked
iframe, privacy extension, corporate proxy) falls back and can still reach the form. The moment real
keys are set, that fallback is rejected and a failed check blocks the request.

**Security properties.** Raw PINs are never stored, logged or returned. Session and email tokens are
stored as SHA-256 digests, never in plaintext. IP addresses are stored only as a peppered digest.
No response from registration, login or PIN reset reveals whether an address has an account.

---

## Reactions

The client buffers taps and posts a batch roughly every 400 ms:

```json
{
  "artifactType": "flash_news",
  "artifactId": "…",
  "reactionType": "rotten_egg",
  "quantity": 24,
  "clientBatchId": "client-generated-unique-id"
}
```

The server authenticates, validates, rate-limits, then — in one transaction — claims the batch id,
increments the person's aggregate, upserts their opinion, applies signed deltas to the artifact
totals, and returns the authoritative numbers.

`(user_id, client_batch_id)` is unique, so **a retried request is a no-op** and returns
`applied: false` with the current totals. Client totals are never trusted; only server-computed
deltas are written.

On the client: the counter moves in the same frame as the tap, failed batches retry with the same id
and a quiet retry state, and unacknowledged taps are added on top of server totals so a number never
appears to go backwards.

**A signed-out tap records nothing.** It does not move the public counter, the opinion counts or the
participant total — it opens the sign-in sheet instead. The number on screen only ever reflects
reactions that will actually be saved.

---

## Realtime

`GET /api/realtime/stream` is a server-sent event stream. Events are coalesced per artifact over a
700 ms window, so a busy artifact produces a few grouped updates a second rather than one per batch.
Remote changes roll the counters more gently than your own taps and surface as an occasional pulse
(`+284 🥚 just landed`) — never a particle per remote reaction.

For multiple instances, set `REALTIME_PG_NOTIFY=1` with a PostgreSQL `DATABASE_URL`.

---

## Admin

`/admin`, gated on a single `is_admin` flag and re-checked inside every action.

Create, edit, preview, publish, unpublish and archive Entities and Flash News; upload or paste
images; link a Flash News item to zero, one or many Entities; search; and see reaction and opinion
totals per item.

**Development-only tools**, refused when `NODE_ENV=production` unless `ALLOW_SIMULATOR=1`:

- **Simulated demo activity** — small batches from demo accounts at irregular intervals, written
  through the same service real reactions use. Labelled as simulated everywhere it appears.
- **Reset demo totals** — clears every aggregate, opinion and batch, then recomputes totals to zero.

---

## Sample content

18 Flash News items across 8 Entities, spanning technology, gaming, sports, culture, entertainment,
business, community and controversy — positive, negative and genuinely split. One item links to two
Entities; one links to none.

**Everything is fictional.** No claims are made about real people or organisations.

Seeded counters are not written straight into `artifact_totals`: the seeder creates 9,000 demo
participants with real aggregate and opinion rows and derives the totals from them, so the sample
data obeys exactly the same invariants the live path does.

The sample content ships without images. Rather than manufacture artwork for events that never
happened, a card with no image falls back to a neutral charcoal block carrying the Entity's initials
or the category. Real images can be uploaded or linked per item from the admin area.

---

## Design

**Dark editorial signal.** A near-black neutral ground (`#08090b`), surfaces separated by a single
low-contrast border and a small change in tone, and no shadow anywhere except genuinely temporary
overlays — dialogs and the sign-in sheet.

Colour is rationed. Skewvy red appears in the wordmark's waveform, the active navigation rule and
small attention indicators. Muted terracotta means Rotten Eggs, antique gold means Medals. Nothing
else is tinted: no section accents, no sentiment-tinted pages, no decorative gradients.

Hierarchy comes from typography, spacing and the scale of the numbers. Reaction totals are the
largest numeric element on any surface; public opinion sits at body scale beneath them so the two
measurements never compete.

The brand is the full **Skewvy** wordmark — white letters with the "w" drawn as a red waveform. There
is no icon, monogram or badge form, and the mark is never placed inside a container.

Motion is one shared token set: 150ms for micro-interactions, 180ms for controls, 220ms for surfaces,
240ms for page entrances, and 1.5–2.2s for reaction particles. Page entrances move 6px and fade.
Pressing a reaction control compresses it to `scale(0.985)` and brightens its number. Counters emphasise
briefly and settle within 300ms. `prefers-reduced-motion` replaces particle travel and page movement
with short opacity changes.

---

## Accessibility

Reaction controls are real buttons: keyboard operable, with visible focus rings and screen-reader
labels carrying the action, the current total and your own contribution. Live-region announcements are
throttled to at most one every 1.5 s so a burst of taps cannot flood a screen reader. Rotten Eggs and
Medals are distinguished by emoji, label and shape — never by colour alone. `prefers-reduced-motion`
replaces the floating particles with a brief fade-and-scale at the control and stops the ambient
drift. Tap targets are at least 44 px, and nothing depends on hover.

---

## Testing

```bash
npm test          # 120 tests
npm run typecheck
```

| File | Covers |
|---|---|
| `tests/pin.test.ts` | PIN hashing, verification, the scrypt fallback, PIN policy |
| `tests/auth.test.ts` | Registration, verification, login, lockout, step-up, PIN reset, sessions |
| `tests/reactions.test.ts` | Batch application, idempotency, aggregate-not-per-tap, opinion invariants |
| `tests/content.test.ts` | Publishing, relationships, cards, search, trending |
| `tests/api.test.ts` | Route handlers end to end, including cookies and rate limits |
| `tests/domain.test.ts` | Number presentation, sentiment labels, SQL placeholder translation |
| `tests/turnstile.test.ts` | Robot-check configuration, fallback acceptance, production hardening |
| `tests/reaction-store.test.ts` | Signed-out taps recording nothing, optimistic updates, tap batching |
| `tests/auth-no-email.test.ts` | Prototype mode: instant sign-up, direct PIN reset, production still locked down |
| `tests/e2e-journey.test.ts` | Register → verify → session expiry → PIN login → react → retry → switch sides → totals |

Each file gets its own temporary SQLite database and runs against the real schema. Only Cloudflare is
stubbed, so no test depends on the network.

---

## Routes

**Public** — `/`, `/flash-news`, `/flash-news/[slug]`, `/entities`, `/entities/[slug]`, `/trending`,
`/search`, `/login`, `/register`, `/auth/verify`, `/auth/reset-pin`, `/profile`

**Admin** — `/admin`, `/admin/entities`, `/admin/entities/new`, `/admin/entities/[id]/edit`,
`/admin/flash-news`, `/admin/flash-news/new`, `/admin/flash-news/[id]/edit`

**API** — `/api/auth/{register,login,logout,verify,resend-verification,request-pin-reset,reset-pin,session,config}`,
`/api/reactions/batch`, `/api/artifacts/[type]/[id]/totals`, `/api/realtime/stream`

---

## Production checklist

1. Set `DATABASE_URL` to PostgreSQL and run `npm run db:migrate`.
2. Set `NEXT_PUBLIC_APP_URL` to the real origin — emailed links are built from it.
3. Set real Turnstile keys and leave `TURNSTILE_DISABLED` unset.
4. Set `RESEND_API_KEY` and `EMAIL_FROM`, or swap the transport in `src/lib/services/email.ts`.
5. Set a long random `IP_HASH_PEPPER`.
6. Leave `ALLOW_SIMULATOR` unset.
7. Terminate TLS — session cookies set `Secure` automatically when `NODE_ENV=production`.
8. Image uploads write to `public/uploads`; on a read-only or serverless host, use external image
   URLs or point the upload action at object storage.

---

## Not in this iteration

Public content creation, user-generated Entities or Flash News, comments, following, direct messages,
moderation systems, reputation scores, multiple admin roles, configurable animation, collision or
impact effects, time-bound battles, recommendation algorithms, payments.
