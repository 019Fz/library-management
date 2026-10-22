# One Dockerfile for the whole app. docker-compose.yml builds it from the repository root:
#   target "backend"  -> the API (Node 24, runs as the non-root "node" user)
#   target "frontend" -> nginx (non-root) serving the React app built with Vite
# What may enter an image is decided by docker/Dockerfile.dockerignore (an allow-list).

# ---------- backend ----------
# Dev packages stay installed on purpose: the server starts through tsx and the migrations use the prisma CLI.
FROM node:24-bookworm-slim AS backend

# Prisma's schema engine needs OpenSSL, which the slim image does not include
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

# Dependencies first, so this layer is cached until the lockfile changes
COPY --chown=node:node backend/package.json backend/package-lock.json ./
RUN npm ci

# The app, plus the start script (it imports ./src/..., so it sits next to package.json)
COPY --chown=node:node backend/ ./
COPY --chown=node:node docker/backend-start.js ./docker-start.js

# Generate the Prisma client into src/generated/prisma. prisma.config.ts wants a DATABASE_URL to load,
# so a throwaway placeholder is given to this one command only (it is not stored in the image).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate

ENV NODE_ENV=production PORT=5000
EXPOSE 5000

# docker-start.js: apply migrations (migrate deploy), optional seeds, then start the server
CMD ["node_modules/.bin/tsx", "docker-start.js"]

# ---------- frontend: build ----------
FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# The API address is written into the JavaScript at build time, so it must be an address the BROWSER can reach.
# docker-compose.yml passes it (default http://localhost:5000).
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- frontend: serve ----------
# The "unprivileged" nginx runs as a non-root user, so it listens on 8080 (ports below 1024 need root)
FROM nginxinc/nginx-unprivileged:1.28-alpine AS frontend
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html
EXPOSE 8080
