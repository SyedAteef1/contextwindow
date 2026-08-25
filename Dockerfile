# Production image for the Next.js app.
#
# Three stages so the runtime layer carries neither the toolchain nor the full
# dependency tree: `standalone` output includes only what the build actually
# imports, which takes the final image from ~1.2GB to ~200MB.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm install`, not `npm ci`.
#
# The lockfile is generated on macOS/arm64, so it records only the darwin
# esbuild binary. `npm ci` installs strictly from the lockfile and fails on
# linux/x64 because @esbuild/linux-x64 isn't in it. `npm install` resolves the
# platform-specific optional dependency for the build architecture instead.
#
# The trade is a slightly weaker reproducibility guarantee; the alternative is
# maintaining a second lockfile per platform, which is worse.
RUN npm install --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next reads the environment at build time for anything inlined into client
# bundles; nothing secret is, so a placeholder is enough to satisfy validation.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

# Run unprivileged — the container is exposed to the internet.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrations and the runner are needed at boot, and standalone output omits
# anything not reachable from the build graph.
COPY --from=build --chown=nextjs:nodejs /app/src/db/migrations ./src/db/migrations
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/postgres ./node_modules/postgres

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
