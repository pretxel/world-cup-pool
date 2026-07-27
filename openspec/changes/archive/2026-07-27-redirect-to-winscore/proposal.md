## Why

The World Cup pool app has been rebranded to WinScore and migrated to a dedicated domain (`winscore.me`). The old domain (`world-cup-pool-*.vercel.app`) should redirect all incoming traffic to the new home so players find the current product and SEO equity transfers cleanly.

## What Changes

- Add a catch-all redirect in `vercel.json` that sends every incoming request to `https://winscore.me/` with a **308 Permanent Redirect** status.
- The redirect runs at the Vercel edge before any framework code, covering all paths — pages, API routes, static assets, and cron job endpoints alike.
- The cron jobs are already running against the old Vercel project, so cron paths (`/api/cron/*`) redirect like everything else. If cron jobs need to continue running, they should be migrated to the new project separately.

## Capabilities

### New Capabilities

- `site-redirect`: Redirect all incoming HTTP requests from the current domain to `https://winscore.me/` with a permanent redirect status.

### Modified Capabilities

_None_ — this adds a new infrastructure-level concern; no existing spec requirements change.

## Impact

- **`vercel.json`**: add a `redirects` array with a single catch-all rule.
- **Cron jobs**: the existing 8 cron paths (`/api/cron/*`) will be caught by the redirect; they must be moved to the winscore.me Vercel project or disabled before the redirect goes live.
- **No code changes**: no middleware, Next.js config, or application code is modified.
