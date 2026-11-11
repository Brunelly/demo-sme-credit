# syntax=docker/dockerfile:1
# The app in one production image: the API serves the built web app and /api on PORT.
#
#   docker build -t app .
#   docker run -p 3000:3000 -e MONGODB_URI=mongodb://host.docker.internal:27017/app app
#   docker run --rm -e MONGODB_URI=… app node apps/api/src/migrate.ts     # migrations, before the first start
#
# docker-compose.yml runs it with MongoDB and the migrations for you.

ARG NODE_VERSION=22

# ---- build: every dependency, then type-check and build the web app ----
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime dependencies: only what the API needs to run ----
FROM node:${NODE_VERSION}-slim AS runtime-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
RUN npm ci --omit=dev --workspace @app/api --no-audit --no-fund

# ---- the image: no compilers, no dev dependencies, runs as the unprivileged `node` user ----
FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY package.json poc.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/contracts/src packages/contracts/src
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/migrations apps/api/migrations
COPY apps/api/scripts apps/api/scripts
COPY maitento maitento
COPY --from=build /app/apps/web/dist apps/web/dist
# The code is root's and read-only to the app; it writes nothing to disk.
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "apps/api/src/server.ts"]
