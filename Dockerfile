# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN npm ci && npm ci --prefix apps/api

COPY . .
RUN npm run build

# --- Production stage ---
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache tini font-dejavu font-noto-cjk

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN npm ci --omit=dev --prefix apps/api && npm cache clean --force

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/dist ./dist
COPY apps/api/src/database/migrations ./apps/api/src/database/migrations

RUN mkdir -p uploads backups

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health/live || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
