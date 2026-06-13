# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js app (output: "standalone").
# Debian slim (glibc) so sharp's prebuilt binary resolves without a musl rebuild.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH" NEXT_TELEMETRY_DISABLED=1
# Pin pnpm to match local; newer pnpm treats unacknowledged build scripts
# (sharp, @swc/core, msw, ...) as a fatal ERR_PNPM_IGNORED_BUILDS.
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# --- deps: install with the committed lockfile ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- builder: compile the standalone server bundle ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* are inlined into the CLIENT bundle at build time, so these must
# be the browser-reachable values. Server code reads process.env at RUNTIME
# (overridden to the in-network origin in docker-compose.yml).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm build

# --- runner: minimal runtime image ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r nodejs && useradd -r -g nodejs -m nextjs
# Standalone output ships server.js + a traced node_modules; static assets and
# public/ must be copied alongside it (Next does not bundle them).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
