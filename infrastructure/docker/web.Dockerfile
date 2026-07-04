# ══════════════════════════════════════════════════════════════════════
# Next.js apps — production image (parameterised by APP: landing-web,
# tenant-web, super-admin). Build from repo root:
#   docker build -f infrastructure/docker/web.Dockerfile --build-arg APP=tenant-web .
# Requires `output: "standalone"` in each app's next.config.
# Skeleton only — activates once the apps have source code.
# ══════════════════════════════════════════════════════════════════════
ARG APP=tenant-web

FROM node:20-alpine AS pruner
ARG APP
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo prune @gym-saas/${APP} --docker

FROM node:20-alpine AS builder
ARG APP
RUN corepack enable
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo build --filter=@gym-saas/${APP}

FROM node:20-alpine AS runner
ARG APP
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=app:app /repo/apps/${APP}/.next/standalone ./
COPY --from=builder --chown=app:app /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=builder --chown=app:app /repo/apps/${APP}/public ./apps/${APP}/public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
