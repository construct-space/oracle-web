# ─── Stage 1: build the Vue SPA ──────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS spa

WORKDIR /app

# Workspace files first so `bun install` layer caches on lockfile changes only.
COPY package.json bun.lock ./
COPY core/package.json ./core/
COPY packages/ ./packages/
COPY spaces/ ./spaces/

RUN bun install --frozen-lockfile

COPY core/ ./core/

RUN cd core && bun run build

# ─── Stage 2: nginx serving SPA + proxying /api/* to oracle-api ──────────────
FROM nginx:1.27-alpine AS runtime

# envsubst for rendering nginx.conf at startup — upstream hostname comes from
# env vars set by CapRover, not baked into the image.
RUN apk add --no-cache gettext

COPY --from=spa /app/core/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && rm /etc/nginx/conf.d/default.conf

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
