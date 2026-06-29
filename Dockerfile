# Mercado Ahorros CRM (Next.js BFF) — multi-stage build producing a lean
# standalone image. Mirrors the auth service Dockerfile conventions (node:20-alpine,
# pnpm pinned, non-root user).

# 1) Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
# Pin pnpm to a version compatible with the node:20 base (pnpm@latest -> v11 crashes
# on node 20 with ERR_UNKNOWN_BUILTIN_MODULE).
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile

# 2) Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are INLINED into the client bundle at build time, so they must
# be supplied here (not just at runtime). Pass them with --build-arg. The same values
# should also be set at runtime (k8s ConfigMap) for the server-side reads.
ARG NEXT_PUBLIC_AUTH_SERVICE_URL
ARG NEXT_PUBLIC_AUTH_BASE_PATH=/api/auth
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=$NEXT_PUBLIC_AUTH_SERVICE_URL
ENV NEXT_PUBLIC_AUTH_BASE_PATH=$NEXT_PUBLIC_AUTH_BASE_PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate && pnpm run build

# 3) Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next standalone server reads PORT/HOSTNAME. Keep the CRM on 8102.
ENV PORT=8102
ENV HOSTNAME=0.0.0.0

# Use the built-in non-root `node` user (uid/gid 1000), matching the api/auth deploys.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 8102
CMD ["node", "server.js"]
