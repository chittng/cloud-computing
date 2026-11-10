# Stage 1: Build the application
FROM node:24.22.1-alpine AS builder

WORKDIR /app

RUN npm install -g --allow-scripts=pnpm pnpm@12.16.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --runtime-on-fail=ignore

COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/

RUN pnpm build

# Stage 2: Production runtime
FROM node:24.22.1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN npm install -g --allow-scripts=pnpm pnpm@12.16.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --runtime-on-fail=ignore

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
