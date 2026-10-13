# syntax=docker/dockerfile:1

# Debian, not Alpine. pnpm-workspace.yaml allows builds for sharp, @swc/core,
# @parcel/watcher and unrs-resolver, all of which ship glibc prebuilt binaries.
# On musl/arm64 pnpm compiles them instead, which needs a toolchain this image
# does not carry and fails late with an error naming unrs-resolver rather than
# the package that actually needs it.
FROM node:24-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable

# Manifests first so a source-only change does not reinstall. pnpm-workspace.yaml
# comes along because pnpm reads allowBuilds from it during install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# NEXT_PUBLIC_* are inlined into the client bundle by `next build`, so they have
# to be present now — passing them to `docker run` later leaves the browser
# calling http://localhost:4000 and failing with no error in any server log.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BRAND_NAME
ARG NEXT_PUBLIC_LOCALE
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---------------------------------------------------------------------------
# No `output: "standalone"` in next.config.ts, so the runner needs the real
# node_modules rather than a self-contained server bundle. If standalone is ever
# turned on, this stage shrinks to copying .next/standalone and .next/static.
#
# corepack has to be enabled again: each FROM starts from a clean filesystem.
FROM node:24-bookworm-slim AS runner
WORKDIR /app

RUN corepack enable

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# next.config.ts is needed at runtime, not only at build: it carries the
# rewrites() that proxy /api/v2/photos, the next-intl plugin wiring, and the
# images config. Without it those silently stop working while the pages still
# render.
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/src/i18n ./src/i18n

EXPOSE 3002
CMD ["pnpm", "start"]
