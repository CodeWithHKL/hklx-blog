# Hklx Blog

A small, fast, server-rendered blog with a Markdown admin panel. Built with [Hono](https://hono.dev), Postgres and TypeScript, and deployed on Vercel.

## Features

- Server-rendered public site: featured post, pinned posts, paginated grid, search, RSS feed (`/rss.xml`)
- Admin panel at `/admin` with a Markdown editor and live preview (see [`postguide.md`](postguide.md))
- Password + 8-digit PIN admin login, signed session cookie, login throttling
- Cover and inline images: uploaded, converted to WebP and resized (800px and 1280px copies) with `sharp`
- Image storage on local disk (dev) or Supabase Storage (production)
- Every request is gated behind a Cloudflare Turnstile challenge
- Light, dark and system themes, with post times shown in the visitor's timezone

## Stack

| Area | Choice |
|---|---|
| Framework | Hono on Node (`@hono/node-server` locally, `hono/vercel` in production) |
| Database | Postgres via `postgres` (local Docker, Supabase or Neon) |
| Images | `sharp`, with local or Supabase storage |
| Markdown | `marked` + `sanitize-html` |
| Bot protection | Cloudflare Turnstile |

## Getting started

Requirements: Node 20+ and Docker (or any Postgres database).

```bash
npm install
cp .env.example .env          # then fill it in, see below
docker compose up -d          # local Postgres on port 5433
npm run migrate               # create the tables
npm run dev                   # http://localhost:3000
```

`npm run dev` builds the admin bundle (`public/admin.js`) and starts the server with file watching.

For local development you can use Cloudflare's always-pass Turnstile test keys:

```
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. On Vercel use the pooler URL. |
| `ADMIN_PASSWORD` | yes | Admin password. |
| `ADMIN_PIN` | yes | Exactly 8 digits. Sign-in is refused if missing or malformed. |
| `SESSION_SECRET` | yes | Long random string that signs the session cookie. |
| `TURNSTILE_SITE_KEY` | yes | Public Turnstile site key. |
| `TURNSTILE_SECRET_KEY` | yes | Turnstile secret key, also signs the pass cookie. |
| `SITE_NAME` | no | Site title. Default `Hklx Blog`. |
| `SITE_URL` | no | Public URL, used for canonical links and the RSS feed. |
| `SITE_TIMEZONE` | no | IANA timezone for post dates, e.g. `Asia/Kuala_Lumpur`. Vercel runs on UTC, so set this. |
| `STORAGE` | no | `local` (default) or `supabase`. |
| `SUPABASE_URL` | with `supabase` | Project URL, `https://<ref>.supabase.co`. |
| `SUPABASE_SERVICE_KEY` | with `supabase` | Secret / service-role key. Server-side only. |
| `SUPABASE_BUCKET` | no | Public bucket name. Default `blog-images`. |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Database

Migrations live in `db/migrations/` and are applied in filename order by `npm run migrate`. They are idempotent, so the script is safe to re-run. The blog only creates `posts` and `images`, so it can share a Postgres database with other systems. Row-level security is enabled on both tables so Supabase's REST API cannot expose them; the app connects directly and is not affected.

## Deploying to Vercel

1. Import the repo and set every environment variable above.
2. Use `STORAGE=supabase`. Vercel's filesystem is read-only, so local storage won't work.
3. In Supabase, create a **public** bucket named `blog-images`.
4. Create a Turnstile widget for your domain in Cloudflare and use its keys.
5. Run `npm run migrate` once against the production `DATABASE_URL`.

Because of the Turnstile gate, pages are served `private, no-store`. Files in `public/` (CSS, fonts, favicon) are served by Vercel directly and are not gated.

## Project layout

```
api/index.ts        Vercel entrypoint
src/app.ts          routes (public, admin pages, admin API)
src/dev.ts          local server with static file serving
src/lib/            db, auth, turnstile, markdown, storage, limits
src/views/          HTML templates (layout, public, admin)
src/admin/          admin panel client code, bundled to public/admin.js
db/migrations/      SQL migrations
scripts/            migrate and one-off maintenance scripts
public/             static assets (styles, fonts, favicon)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Build the admin bundle and run the dev server |
| `npm run migrate` | Apply database migrations |
| `npm run build:admin` | Bundle the admin client to `public/admin.js` |
| `npm run typecheck` | Type-check with `tsc` |
