# Torch — product

The authenticated Torch product. Lives at `torch.lemnisca.bio` in production;
the marketing landing at `lemnisca.bio/torch` is a separate deployment in the
main-landing repo.

## Layout

```
torch_product/
├── docker-compose.yml      # local Postgres
├── packages/tea-core/      # pure calculation engine (math + constants + types)
│                           # consumed by both backend and frontend.
│                           # COPIED VERBATIM from old/frontend/src/lib/.
│                           # Do not edit without updating the math spec.
├── backend/                # Express 5 + Prisma + Postgres. Target: Cloud Run.
└── frontend/               # Next.js 16 App Router. Target: Vercel.
```

## Tech stack

| Layer | Tech | Production target |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind v4, react-hook-form, zod | Vercel |
| Backend API | Express 5, Prisma 7, TypeScript | Cloud Run |
| Database | PostgreSQL 16 | Cloud SQL (Postgres) |
| Shared math | `@torch/core` (file: dep) | bundled into both |
| Auth | JWT (bcrypt) in localStorage, sent as `Authorization: Bearer` | — |

The frontend and backend are **fully independent** apps with no proxy layer
between them. The browser calls the backend directly at
`NEXT_PUBLIC_BACKEND_URL`; the backend allows the frontend origin via CORS.
Either app can be deployed, scaled, or restarted without touching the other.

Deferred to a later phase: PDF generation worker (Cloud Run worker + Cloud
Tasks + Cloud Storage). The `report/` route and `@react-pdf/renderer` are
not in this build.

## Local development

### Prerequisites
- Node.js 22+
- Docker (for the local Postgres container)

### One-time setup
```bash
# From torch_product/
cd backend && cp .env.example .env && cd ..
cd frontend && cp .env.example .env.local && cd ..

# Start Postgres
docker compose up -d

# Install
( cd backend && npm install )
( cd frontend && npm install )
( cd packages/tea-core && npm install )

# Generate Prisma client + run migrations
( cd backend && npx prisma migrate dev --name init )
```

### Running
Two terminals:
```bash
# Terminal 1 — backend on :4000
cd backend && npm run dev

# Terminal 2 — frontend on :3001
cd frontend && npm run dev
```

The browser talks **directly** to the backend at `NEXT_PUBLIC_BACKEND_URL`
(default `http://localhost:4000`). There is no proxy layer in the frontend.
The backend's CORS allowlist (`FRONTEND_URL` env) gates which origins are
allowed.

### Running engine tests
```bash
cd packages/tea-core && npm test
```

## GCP deployment notes

The system is shaped to deploy as two completely separate services:

- **Frontend → Vercel (static, no functions)**: `next.config.ts` sets
  `output: 'export'`, so `next build` emits a plain `out/` directory of
  HTML/JS/CSS. Vercel serves it from its CDN as static files — **zero
  serverless function invocations per request**. The frontend is a SPA.
  Set `NEXT_PUBLIC_BACKEND_URL=https://api.torch.lemnisca.bio` and
  `NEXT_PUBLIC_SITE_URL=https://torch.lemnisca.bio`. Set
  `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to the same
  PostHog project used by the Lemnisca landing site so marketing-to-product
  attribution stays connected. On Vercel: framework preset = "Next.js",
  build command unchanged, output directory `out`.
- **Backend → Cloud Run**: Build with `docker build -f backend/Dockerfile .`
  *from the `torch_product/` directory* (the Dockerfile needs sibling access
  to `packages/tea-core`). Connect to Cloud SQL via the Unix socket path in
  `DATABASE_URL` (see `backend/.env.example`). Map a custom domain
  (`api.torch.lemnisca.bio`) to the service.
- **Database → Cloud SQL for PostgreSQL**: Same Postgres 16 flavour as the
  docker-compose service, so dev/prod parity is real.
- **CORS**: Set `FRONTEND_URL=https://torch.lemnisca.bio` in Cloud Run env —
  this is the origin the backend allows. Pre-flight `OPTIONS` requests
  succeed because `cors()` runs before all routes.

The two services don't share secrets, networks, or runtimes. The JWT signing
secret (`JWT_SECRET`) lives only on the backend; the frontend never sees it.

## Landing-to-product attribution

Torch depends on the main landing repo for marketing attribution. The CTA links
on `lemnisca.bio/torch` must point to the product with UTM/query parameters,
for example:

```text
https://torch.lemnisca.bio/assess?utm_source=lemnisca_landing&utm_medium=torch_landing_cta&utm_campaign=torch_assessment&cta_location=hero
```

The product frontend reads those parameters, stores them for the session, and
attaches them to PostHog events alongside:

```ts
posthog.register({
  product: 'torch',
  surface: 'product',
  app: 'torch_app',
});
```

Keep this contract in mind for every new Lemnisca product: the marketing repo
owns outbound CTA attribution, and the product repo owns ingesting/persisting
that attribution on product events. If either side changes, update both repos
in the same release.

### Deferred GCP pieces
- Cloud Run worker for PDF generation (Playwright/Puppeteer).
- Cloud Tasks for queueing PDF jobs.
- Cloud Storage for storing generated PDFs.

These slot in once the core product is complete and a PDF button is
re-introduced.

## What lives where

| Question | Answer |
|---|---|
| Where does the MOSCH math live? | `packages/tea-core/src/engine/` (verbatim from `old/`). |
| Where do the risk thresholds live? | `packages/tea-core/src/constants/scoring.ts` and friends. |
| Where are organism + impeller + physical constants? | `packages/tea-core/src/constants/`. |
| Where are TypeScript types for inputs/results? | `packages/tea-core/src/types/`. |
| Where does the backend persist? | `backend/prisma/schema.prisma` — User + Assessment. |
| Where is the API contract? | `backend/src/routes/` + controllers. |

## Source of truth

The original repo lives at `../old/` (the previous standalone Torch app).
Calculation engine, math, API surface, and DB schema were copied verbatim
from there. UI/UX is being rebuilt — the new design language is white/black
with one saturated flame accent (`#FF5A1F`), restrained typography, hairlines
instead of cards, no gradients. See `frontend/styles/globals.css` for the
design tokens.
