# ══════════════════════════════════════════════════════════════════════
# @gym-saas/api — production image (multi-stage, pnpm + turbo prune)
# Build from repo root:  docker build -f infrastructure/docker/api.Dockerfile .
# Skeleton only — build/run steps activate once the API has source code.
# ══════════════════════════════════════════════════════════════════════

# ── 1. prune the monorepo to only what the api needs ──
FROM node:20-alpine AS pruner
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo prune @gym-saas/api --docker

# ── 2. install deps + build ──
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo build --filter=@gym-saas/api
# prisma client generation happens here once schema has models:
# RUN pnpm --filter @gym-saas/api exec prisma generate

# ── 3. minimal runtime, non-root ──
FROM node:20-alpine AS runner
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=app:app /repo/apps/api/dist ./dist
COPY --from=builder --chown=app:app /repo/apps/api/package.json ./
COPY --from=builder --chown=app:app /repo/node_modules ./node_modules
USER app
EXPOSE 4000
# HEALTHCHECK CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/server.js"]
