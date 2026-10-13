# Build the Angular SPA, then serve it with Nginx.
# Build context: repository-root/frontend
FROM node:24-bookworm-slim AS builder

ARG BASE_URL
ENV BASE_URL=${BASE_URL}

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production \
    && mkdir -p /tmp/angular-dist \
    && INDEX_HTML="$(find dist -type f -name index.html -print -quit)" \
    && if [ -z "$INDEX_HTML" ]; then echo 'Angular build did not produce index.html under dist/' >&2; find dist -maxdepth 4 -type f >&2 || true; exit 1; fi \
    && cp -a "$(dirname "$INDEX_HTML")"/. /tmp/angular-dist/

FROM nginx:stable-alpine AS runtime

# Nginx official image substitutes ${API_UPSTREAM} in this template at startup.
ENV API_UPSTREAM=${BASE_URL}
RUN cat > ./src/environments/environment.ts <<EOF
export const environment = {
  apiBaseUrl: '${BASE_URL}',
};
EOF
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /tmp/angular-dist/ /usr/share/nginx/html/

EXPOSE 80
