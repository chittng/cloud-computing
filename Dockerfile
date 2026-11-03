# syntax=docker/dockerfile:1

# Versions must match "devEngines" in package.json.
ARG NODE_VERSION=24.22.1
ARG PNPM_VERSION=12.16.1

# ---------- base: Node + pnpm ----------
FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------- build: install all deps and compile TypeScript to dist/ ----------
FROM base AS build
# Copy manifests first so Docker can cache the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
# Everything else (filtered by .dockerignore).
COPY . .
RUN pnpm build

# ---------- prod-deps: production dependencies only ----------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---------- runtime: small final image ----------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# package.json is required at runtime: it contains "type": "module" (native ESM).
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Run as the unprivileged user that ships with the official Node image.
USER node

EXPOSE 3000

# Optional: enable after /health is merged (CLOUD-12).
# HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
#   CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Same command as "pnpm start" in package.json.
CMD ["node", "dist/main"]

