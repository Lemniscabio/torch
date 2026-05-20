# Multi-stage build for Cloud Run.
#
# Build context MUST be torch_product/ (the parent dir), not backend/, because
# @torch/core lives in ../packages/tea-core and is a file: dependency, and
# @torch/core itself depends on ../tea-core-shared.
# Build command (run from torch_product/):
#   docker build -f backend/Dockerfile -t torch-backend .

# --- 1. Builder ----------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# Bring in shared first (tea-core depends on it), then tea-core. Order
# matters so npm install in backend can resolve both file: deps.
COPY packages/tea-core-shared ./packages/tea-core-shared
COPY packages/tea-core ./packages/tea-core

# Compile @torch/core-shared → dist/ so Node can require() it at runtime.
# (package.json main points at dist/index.js.)
WORKDIR /app/packages/tea-core-shared
RUN npm install --no-audit --no-fund && npm run build

# Compile @torch/core → dist/. tea-core depends on @torch/core-shared, so
# install resolves the local file: dep into tea-core/node_modules first.
WORKDIR /app/packages/tea-core
RUN npm install --no-audit --no-fund && npm run build

# Backend manifest + lockfile
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install --no-audit --no-fund

# Backend source + Prisma schema
COPY backend/tsconfig.json ./
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
COPY backend/src ./src

RUN npx prisma generate
RUN npx tsc

# --- 2. Runtime ----------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

# Chromium dependencies for @sparticuz/chromium (Puppeteer PDF generation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 \
    libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 \
    libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
    libxtst6 lsb-release wget xdg-utils \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Cloud Run injects PORT; default to 8080 for local docker run.
ENV PORT=8080

# Bring tea-core + tea-core-shared source so resolved file: deps stay
# valid at runtime.
COPY --from=builder /app/packages/tea-core-shared ./packages/tea-core-shared
COPY --from=builder /app/packages/tea-core ./packages/tea-core

WORKDIR /app/backend
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/src/generated ./src/generated
COPY --from=builder /app/backend/package.json ./

EXPOSE 8080
CMD ["node", "dist/app.js"]
