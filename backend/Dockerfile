# Panaderia NestJS backend - Prisma ORM 7
# Build context: repository-root/backend
#
# Runtime image:
#   docker build -t panaderia-backend:local ./backend
#
# One-shot production migrator image:
#   docker build --target migrator -t panaderia-migrator:local ./backend
#   docker run --rm --network <compose-network> \
#     -e DATABASE_URL='postgresql://USER:PASSWORD@postgres:5432/panaderia?schema=public' \
#     panaderia-migrator:local

FROM node:24-bookworm-slim AS builder

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ARG PORT
ENV PORT=${PORT}
ARG FRONTEND_ORIGIN
ENV FRONTEND_ORIGIN=${FRONTEND_ORIGIN}
ARG JWT_SECRET
ENV JWT_SECRET=${JWT_SECRET}
ARG BOOTSTRAP_ADMIN_EMAIL
ENV BOOTSTRAP_ADMIN_EMAIL=${BOOTSTRAP_ADMIN_EMAIL}
ARG BOOTSTRAP_ADMIN_PASSWORD
ENV BOOTSTRAP_ADMIN_PASSWORD=${BOOTSTRAP_ADMIN_PASSWORD}
ARG BOOTSTRAP_ADMIN_NAME
ENV BOOTSTRAP_ADMIN_NAME=${BOOTSTRAP_ADMIN_NAME}
ARG BOOTSTRAP_BAKERY_NAME
ENV BOOTSTRAP_BAKERY_NAME=${BOOTSTRAP_BAKERY_NAME}

WORKDIR /app

# Native build tools are needed if a dependency such as argon2 has to compile.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma 7 reads prisma.config.ts. This placeholder is used only when generating
# the client; no connection is made to a database during image construction.
RUN DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build?schema=public' \
    npx prisma generate \
    && npm run build

# Production API dependencies only. The final API image does not need the
# Prisma CLI or the migration files at runtime.
FROM builder AS production-dependencies
RUN npm prune --omit=dev

# Separate one-shot image for production database migrations. It intentionally
# carries Prisma CLI (a devDependency), prisma.config.ts, the schema and all
# committed migration files. DATABASE_URL is supplied only when the container
# is run, never during build.
FROM node:24-bookworm-slim AS migrator

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ARG PORT
ENV PORT=${PORT}
ARG FRONTEND_ORIGIN
ENV FRONTEND_ORIGIN=${FRONTEND_ORIGIN}
ARG JWT_SECRET
ENV JWT_SECRET=${JWT_SECRET}
ARG BOOTSTRAP_ADMIN_EMAIL
ENV BOOTSTRAP_ADMIN_EMAIL=${BOOTSTRAP_ADMIN_EMAIL}
ARG BOOTSTRAP_ADMIN_PASSWORD
ENV BOOTSTRAP_ADMIN_PASSWORD=${BOOTSTRAP_ADMIN_PASSWORD}
ARG BOOTSTRAP_ADMIN_NAME
ENV BOOTSTRAP_ADMIN_NAME=${BOOTSTRAP_ADMIN_NAME}
ARG BOOTSTRAP_BAKERY_NAME
ENV BOOTSTRAP_BAKERY_NAME=${BOOTSTRAP_BAKERY_NAME}

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY prisma.config.ts ./prisma.config.ts
COPY prisma ./prisma

ENV NODE_ENV=production

# CLI uses the local Prisma version pinned in package-lock.json.
ENTRYPOINT ["./node_modules/.bin/prisma", "migrate", "deploy"]

# Production API image. No Prisma CLI, source tree, schema or migrations here.
FROM node:24-bookworm-slim AS runtime

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ARG PORT
ENV PORT=${PORT}
ARG FRONTEND_ORIGIN
ENV FRONTEND_ORIGIN=${FRONTEND_ORIGIN}
ARG JWT_SECRET
ENV JWT_SECRET=${JWT_SECRET}
ARG BOOTSTRAP_ADMIN_EMAIL
ENV BOOTSTRAP_ADMIN_EMAIL=${BOOTSTRAP_ADMIN_EMAIL}
ARG BOOTSTRAP_ADMIN_PASSWORD
ENV BOOTSTRAP_ADMIN_PASSWORD=${BOOTSTRAP_ADMIN_PASSWORD}
ARG BOOTSTRAP_ADMIN_NAME
ENV BOOTSTRAP_ADMIN_NAME=${BOOTSTRAP_ADMIN_NAME}
ARG BOOTSTRAP_BAKERY_NAME
ENV BOOTSTRAP_BAKERY_NAME=${BOOTSTRAP_BAKERY_NAME}

ENV NODE_ENV=production \
    PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]
