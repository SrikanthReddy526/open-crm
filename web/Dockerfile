# Open CRM website + HTTPS front door (Caddy).
# Serves the React build and forwards /api/* to the Spring Boot container.
# Build: docker build -t opencrm-web ./web
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Same origin as the API (Caddy proxies /api), so no API URL is baked in.
ENV VITE_API_URL=
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /src/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
