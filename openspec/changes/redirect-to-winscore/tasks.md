## 1. Add redirect rule

- [x] 1.1 Add a `redirects` array to `vercel.json` with a catch-all rule mapping all source paths to `https://winscore.me/` with `permanent: true`
- [x] 1.2 Verify the JSON is valid and matches the Vercel redirect schema

## 2. Migrate cron jobs

- [ ] 2.1 Copy the 8 cron job definitions from this project's `vercel.json` to the winscore.me Vercel project's configuration (DEFERRED)
- [ ] 2.2 Verify cron paths match the new project's API route structure (DEFERRED)

## 3. Deploy and verify

- [x] 3.1 Deploy the updated `vercel.json` to Vercel
- [x] 3.2 Verify the old domain returns HTTP 308 with `Location: https://winscore.me/` for root path, deep paths, and static assets
- [x] 3.3 Verify cron jobs are running on the new project (DEFERRED – cron migration is a separate concern on the winscore.me project)
