# Contributing

Conventions for working in this repository. The user-facing operator runbook
lives in [`operator-guide.md`](./operator-guide.md); architectural context is
in [`architecture.md`](./architecture.md).

## Local development

```bash
pnpm install
cp .env.example .env.local      # fill in real Supabase keys
pnpm dev
```

The dev server fails fast at module load if any of
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or
`SUPABASE_SERVICE_ROLE_KEY` is missing
([`lib/env.ts:19`](../lib/env.ts)).

### Useful scripts

| command             | purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `pnpm dev`          | Next dev server with Turbopack.                           |
| `pnpm build`        | Production build.                                         |
| `pnpm typecheck`    | `tsc --noEmit`.                                           |
| `pnpm lint`         | ESLint (`eslint-config-next` + `eslint-config-prettier`). |
| `pnpm test`         | Vitest unit tests.                                        |
| `pnpm test:watch`   | Vitest watch mode.                                        |
| `pnpm format`       | Prettier write.                                           |
| `pnpm format:check` | Prettier check (CI-friendly).                             |

Run `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check` before
opening a PR.

## Code conventions

### General

- **Next.js 16 App Router** — read the relevant guide in
  `node_modules/next/dist/docs/` before adopting an API you haven't used on
  this codebase. APIs and defaults differ from older Next.js versions.
- **Server Components by default.** Only add `"use client"` when the file
  needs browser APIs, state, or event handlers.
- **Server actions over route handlers** for app mutations. The two existing
  route handlers (`/auth/callback`, `/sign-out`) exist because Supabase's
  cookie exchange needs a `Request` object.
- **No emojis** in code, copy, or commits. Stick to plain ASCII.

### Forms and validation

- **Native HTML forms + server actions**, validated with `zod`. We deliberately
  skipped `shadcn/ui form` because the forms in this app are small. See
  [`app/(public)/matches/[matchId]/actions.ts`](<../app/(public)/matches/[matchId]/actions.ts>)
  and [`app/(admin)/admin/matches/actions.ts`](<../app/(admin)/admin/matches/actions.ts>)
  for the pattern.
- Server actions return either a serialisable result (`{ ok: true } | { ok:
false; error: string }`) or `void`. Throwing is acceptable for admin-only
  actions where the global error boundary will catch.

### UI primitives

- shadcn primitives live under `components/ui/**`. They are tagged with
  `data-slot` attributes (see existing primitives) — keep that pattern when
  you add new ones so styling can target slots cleanly.
- Use `cn(...)` (`lib/utils.ts`) for conditional class composition. Avoid
  ad-hoc string concatenation.
- Tailwind 4 with no `tailwind.config.*` — utility classes are auto-discovered
  via the postcss plugin.

### Database access

- Pick the right Supabase client for the context:
  - User-context reads/writes → `createServerSupabaseClient()` from
    [`lib/supabase/server.ts`](../lib/supabase/server.ts).
  - Client components → `createBrowserSupabaseClient()` from
    [`lib/supabase/browser.ts`](../lib/supabase/browser.ts).
  - Admin-only writes that need to bypass RLS →
    `createAdminSupabaseClient()` from
    [`lib/supabase/admin.ts`](../lib/supabase/admin.ts). The file is
    `import "server-only"` so it cannot accidentally end up in a client
    bundle.
- Never call `getSession()` in Server Components. Use `getUser()` and lean on
  RLS for authorization. (`getSession()` reads the cookie without
  re-validating with Supabase Auth.)
- Prefer narrowed aliases from [`lib/db.ts`](../lib/db.ts) (`MatchRow`,
  `MatchStatus`, `HitType`, `LeaderboardRow`) over raw `Tables<…>` from the
  generated types.

### Caching

- Admin writes that affect the leaderboard call `revalidateTag('leaderboard',
'max')`. Match-list writes call `revalidatePath('/admin/matches')` and
  `revalidatePath('/matches')`. Match-detail writes also call
  `revalidatePath('/matches/[id]')`. Keep this in sync when you add a new
  admin action.
- The `'max'` profile is Next.js 16's longest cache lifetime; tag-based
  invalidation is the freshness mechanism.

## Regenerating Supabase types

When you change the schema (new column, new policy, new function), run:

```bash
supabase gen types typescript --linked > lib/database.types.ts
```

That file is **generated** — do not hand-edit. Narrow types in
[`lib/db.ts`](../lib/db.ts), which is preserved across regenerations.

## Migrations

Schema changes go in a new file under `supabase/migrations/` with a sortable
timestamp prefix (mirroring the existing
`20260513000000_init.sql`). Apply locally with `supabase db push` against the
linked project. The repo has **no down-migration policy** — write forward-only
fixes.

After any migration that affects table columns, types, or functions:

1. `supabase db push`
2. `supabase gen types typescript --linked > lib/database.types.ts`
3. Update any narrowed aliases in `lib/db.ts` if a union changed.
4. `pnpm typecheck && pnpm test`.

## Running tests

`pnpm test` runs Vitest unit tests. The current suite covers the scoring
rules in [`tests/scoring.test.ts`](../tests/scoring.test.ts), which exercises
the pure-TS replica in [`lib/scoring.ts`](../lib/scoring.ts).

Add new tests next to the module under test (`<module>.test.ts`) or inside
`tests/` for cross-module suites. End-to-end tests against a real Supabase
instance are not wired yet (deferred per
[`openspec/changes/add-world-cup-2026-pool/tasks.md:79`](../openspec/changes/add-world-cup-2026-pool/tasks.md)).

## Commits

- One logical change per commit. Imperative subject (`add daily leaderboard
filter`, `fix kickoff lock policy`).
- Trailers are encouraged when relevant:

  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```

- Never use `--no-verify`, `--no-gpg-sign`, or `git commit --amend` after a
  hook failure — fix the underlying issue and create a new commit.

## Pull requests

- Squash-merge to `main`. Keep PR titles under 70 characters; put detail in
  the body.
- Include a short `## Summary` and `## Test plan` checklist. The
  `commit-commands:commit-push-pr` skill produces the right template.

## OpenSpec workflow

Spec-driven changes live under `openspec/changes/<change-id>/` with the
following artifacts:

- `proposal.md` — what changes and why.
- `design.md` — decisions, alternatives, risks.
- `specs/<capability>/spec.md` — `ADDED` / `MODIFIED` requirements with
  scenarios.
- `tasks.md` — the implementation checklist.

Use the OpenSpec slash commands rather than editing artifacts by hand:

| Command                           | Purpose                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `/opsx:propose`                   | One-shot: create a new change with proposal + design + specs + tasks.   |
| `/opsx:explore`                   | Think through ideas before committing to a proposal.                    |
| `/opsx:new` then `/opsx:continue` | Stepwise version of `propose`.                                          |
| `/opsx:ff`                        | Fast-forward through artifact creation when the requirements are clear. |
| `/opsx:apply`                     | Implement the tasks.                                                    |
| `/opsx:verify`                    | Verify the implementation matches the artifacts before archiving.       |
| `/opsx:sync`                      | Sync delta specs from a change into the main specs without archiving.   |
| `/opsx:archive`                   | Finalise and archive a completed change.                                |

The original World Cup change is at
[`openspec/changes/add-world-cup-2026-pool/`](../openspec/changes/add-world-cup-2026-pool/)
and is a good reference template.
