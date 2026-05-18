# Multi-stage build for Cloud Run.
#
# Build context MUST be torch_product/ (the parent dir), not backend/, because
# @torch/core lives in ../packages/tea-core and is a file: dependency.
# Build command (run from torch_product/):
#   docker build -f backend/Dockerfile -t torch-backend .

# --- 1. Builder ----------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# Bring in tea-core first so npm install can resolve the file: dep.
COPY packages/tea-core ./packages/tea-core

# Backend manifest + lockfile
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

ENV NODE_ENV=production
# Cloud Run injects PORT; default to 8080 for local docker run.
ENV PORT=8080

# Bring tea-core source so resolved file: dep stays valid at runtime
COPY --from=builder /app/packages/tea-core ./packages/tea-core

WORKDIR /app/backend
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/src/generated ./src/generated
COPY --from=builder /app/backend/package.json ./

EXPOSE 8080
CMD ["node", "dist/app.js"]
