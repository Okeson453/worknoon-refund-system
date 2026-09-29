# WORKNOON refund web client — Vite build served by nginx, which also proxies /api to the API.
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY packages/shared-types packages/shared-types
COPY apps/web apps/web

# The bundle inlines the API base URL at build time; nginx proxies /api on the same origin.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build --workspace @worknoon/web

FROM nginx:1.27-alpine AS runtime
# The nginx image's entrypoint runs envsubst over /etc/nginx/templates/*.template, expanding only
# variables that exist in the environment, and writes the result to conf.d/default.conf.
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
# Defaults to the Railway private-network hostname of a service named "api". Set it to the API
# service's real internal hostname (<service-name>.railway.internal) if it is named differently.
# A wrong hostname now degrades /api to 502 instead of preventing boot.
ENV API_INTERNAL_HOST=api.railway.internal
# Renders the DNS resolver placeholder in the config at container start, after envsubst.
COPY apps/web/25-render-resolvers.sh /docker-entrypoint.d/25-render-resolvers.sh
RUN chmod +x /docker-entrypoint.d/25-render-resolvers.sh
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
