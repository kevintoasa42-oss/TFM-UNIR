FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.30.5-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94
ENV API_UPSTREAM=http://backend:4000
ENV DNS_RESOLVER=127.0.0.11
ENV NGINX_ENVSUBST_FILTER="^(API_UPSTREAM|DNS_RESOLVER)$"
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=15 CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
