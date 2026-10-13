# syntax=docker/dockerfile:1
# Build context: repository-root/backend
#
# Runtime image:
#   docker build --target runtime -t panaderia-backend:local ./backend
#
# One-shot production migrator image:
#   docker build --target migrator -t panaderia-migrator:local ./backend
#   docker run --rm --network <compose-network> \
#     --env-file /secure/path/migrator.env \
#     panaderia-migrator:local
#
# IMPORTANT: application secrets must be supplied at container runtime,
# never via Docker build arguments or Dockerfile ENV instructions.

FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Build tools support native dependencies such as argon2 where needed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma 7 reads prisma.config.ts and requires DATABASE_URL during CLI startup.
# This non-secret placeholder is used only to generate Prisma Client at build time;
# no database connection should be attempted during image construction.
RUN DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build?schema=public' \
    npx prisma generate \
    && npm run build

# One-shot migration image. Contains Prisma CLI, schema and committed migrations.
# DATABASE_URL must be injected only when running the container.
FROM builder AS migrator
ENV NODE_ENV=production
ENTRYPOINT ["./node_modules/.bin/prisma", "migrate", "deploy"]

# Remove development dependencies for the application runtime image.
FROM builder AS production-dependencies
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates openssl libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]
