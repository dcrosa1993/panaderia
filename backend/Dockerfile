# Multi-stage production image for the NestJS API.
# Build context: repository-root/backend
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

# argon2 may need native compilation when a prebuilt binary is unavailable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma 7 loads prisma.config.ts during generation. This dummy URL is only
# available in the build stage; no database connection is made during generate.
RUN DATABASE_URL='postgresql://build:build@127.0.0.1:5432/build?schema=public' npx prisma generate \
    && npm run build \
    && npm prune --omit=dev

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

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]
