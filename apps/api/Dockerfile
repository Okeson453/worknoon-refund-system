# WORKNOON refund API — multi-stage build from the monorepo root.
# node:20-slim (Debian) is used instead of Alpine so the Prisma query engine finds OpenSSL.
FROM node:20-slim AS build
WORKDIR /app

ENV npm_config_fund=false \
    npm_config_audit=false

# 1. Workspace manifests first so dependency installation is cached independently of the source.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# 2. Sources.
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api

RUN npm run build --workspace @worknoon/shared-types \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build --workspace @worknoon/api

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force

COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY apps/api/docker-entrypoint.sh /app/apps/api/docker-entrypoint.sh
COPY scripts/wait-for-db.sh /app/scripts/wait-for-db.sh

RUN chmod +x /app/apps/api/docker-entrypoint.sh /app/scripts/wait-for-db.sh \
 && chown -R node:node /app

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
