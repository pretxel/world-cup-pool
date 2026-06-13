# Self-hosted Supabase (Docker Compose)

Full local Supabase stack — an alternative to `supabase start` (CLI). Mirrors the
official `supabase/supabase` `docker/` layout, pinned to the upstream image
versions, plus two project-specific tweaks:

- `db` is published on host **`54322`** (matches `supabase/config.toml`) so this
  repo's migrations/seed apply directly, without the Supavisor tenant-username scheme.
- `apply-app-schema.sh` loads this repo's `supabase/migrations` + `supabase/seed`.

## Services & ports

| Service          | Image                     | Host port | Purpose                      |
| ---------------- | ------------------------- | --------- | ---------------------------- |
| web (the app)    | built from `../Dockerfile`| **3000**  | Next.js World Cup Pools      |
| kong (API gw)    | `kong:3.9.1`              | **8000**  | REST/Auth/Storage/Realtime   |
| studio           | `supabase/studio`         | via 8000  | Dashboard (`/`)              |
| db (Postgres)    | `supabase/postgres:15`    | **54322** | Direct SQL access            |
| supavisor        | `supabase/supavisor`      | 5432/6543 | Session / transaction pooler |
| auth, rest, realtime, storage, imgproxy, meta, functions | — | internal | behind Kong |

Studio dashboard: `http://localhost:8000` (basic-auth `DASHBOARD_USERNAME` /
`DASHBOARD_PASSWORD` from `.env`).

## Quick start

```bash
cd docker
# .env already created (demo keys + local Postgres pw). For ANY non-local use,
# regenerate secrets first:  sh utils/generate-keys.sh  &&  sh utils/add-new-auth-keys.sh
docker compose up -d --build    # pulls ~11 images + builds the app on first run
docker compose ps               # wait until db/auth/kong/web are healthy
./apply-app-schema.sh           # load this repo's migrations + seed
```

App: <http://localhost:3000>. Stop: `docker compose down`. Wipe everything
(db data + storage): `sh reset.sh`.

### The `web` (app) service

- **Browser vs server origin.** Next inlines `NEXT_PUBLIC_*` at build time into
  BOTH the client AND server bundles, so a runtime `NEXT_PUBLIC_SUPABASE_URL`
  override does NOT reach server code. The browser must use the host-reachable
  `http://localhost:8000` (build arg, baked); the server must use the in-network
  `http://kong:8000`. To bridge this, `lib/env.ts` prefers a **non-public**
  `SUPABASE_URL` (read at runtime, not inlined) on the server and falls back to
  the baked public URL on the client. Compose sets build-arg
  `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000` and runtime
  `SUPABASE_URL=http://kong:8000`. On Vercel `SUPABASE_URL` is unset, so both
  sides use the single hosted URL as before.
- App code changed? Rebuild: `docker compose up -d --build web`.
- Running the app containerized makes the host-dev override `.env.development.local`
  redundant (it only affects `pnpm dev` on the host). Delete it if you only use Docker.

## Point the Next.js app at this stack

The demo `ANON_KEY` / `SERVICE_ROLE_KEY` in `.env` are valid because they're signed
with the default `JWT_SECRET`. In the **repo root** `.env.local`, set:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from docker/.env>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from docker/.env>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> The committed `.env.local` points at the hosted Supabase project. Keep a copy
> before switching, or use a separate env file, so you can switch back.

## Security

- `.env` (real secrets) and `volumes/db/data`, `volumes/storage` are gitignored.
- Demo keys are for LOCAL ONLY. Before exposing this stack anywhere, rotate every
  secret: `sh utils/generate-keys.sh` then `sh utils/add-new-auth-keys.sh`, and
  change `POSTGRES_PASSWORD` / `DASHBOARD_PASSWORD`.
- `apply-app-schema.sh` runs SQL directly (no `supabase_migrations` history). For
  CLI-tracked migrations use `supabase db push --db-url postgresql://postgres:<pw>@127.0.0.1:54322/postgres`.

## Updating image versions

Re-sync from upstream (this layout was copied from `supabase/supabase` `master`):
<https://github.com/supabase/supabase/tree/master/docker>
