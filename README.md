# Torch

Bioreactor scale-up assessment tool. Users describe a lab-scale fermentation, the engine flags scale-up risks across mixing, oxygen transfer, heat transfer, and CO₂ stripping, and returns a structured risk report.

**Live**
- Frontend: <https://torch.lemnisca.bio>
- Backend: <https://torch-backend-746208330214.us-central1.run.app>
- Health check: `GET /api/health`

## Repo layout

```
torch/
├── torch_product/                  # ← active app (deployed)
│   ├── frontend/                   # Next.js 16 — Vercel
│   ├── backend/                    # Express 5 + Prisma — Cloud Run
│   ├── packages/
│   │   ├── tea-core/               # engine (backend-only) — math + private constants
│   │   └── tea-core-shared/        # public surface — types, bounds, what-if catalog
│   ├── docs/
│   │   └── backend-deploy-report.html   # detailed deploy walkthrough
│   ├── docker-compose.yml          # local Postgres for dev
│   ├── cloudbuild.yaml             # Cloud Build config for the backend image
│   └── README.md                   # app-level layout and local dev setup
│
└── product_v1/                     # legacy. CRUD scaffolding only, no engine.
                                    #   Kept for reference; not deployed.
```

The split between `tea-core` and `tea-core-shared` is deliberate: engine math is backend-only, while the public surface (types, bounds, what-if catalog) is what the frontend imports. Frontend never bundles engine code; it POSTs inputs to the backend and renders the structured response.

Day-to-day work happens in `torch_product/`. `product_v1/` is read-only history.

## Architecture (production)

```
Browser (any user)
    │
    │  HTTPS
    ▼
Vercel ── serves Next.js SPA (NEXT_PUBLIC_BACKEND_URL points here ↓)
    │
    │  HTTPS, Authorization: Bearer <JWT>
    ▼
Cloud Run (torch-backend) ── Express + Prisma + @torch/core (engine)
                            POST /api/assessments/preview   (compute, no save)
                            POST /api/assessments/save      (compute + persist, authed)
                            POST /api/assessments/whatif    (modified scenarios)
                            POST /api/assessments/:id/pdf   (generate PDF, authed)
    │
    │  Unix socket /cloudsql/<conn>
    ▼
Cloud SQL Postgres 16 (torch-db, us-central1, db-f1-micro)

Secret Manager  →  DATABASE_URL, JWT_SECRET (read at container boot)
Artifact Registry  →  Docker image (us-central1-docker.pkg.dev/.../torch/backend)
Cloud Build  →  builds & pushes the image when we run `gcloud builds submit`
```

Frontend and backend are **fully independent** apps. The browser talks straight to Cloud Run; there is no BFF or proxy. Either side can be deployed without touching the other.

## Tech stack

| Layer | Tech | Hosted on |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind v4, react-hook-form, Zod | Vercel |
| Backend API | Express 5, Prisma 7, TypeScript | Cloud Run |
| Database | PostgreSQL 16 | Cloud SQL |
| Engine | `@torch/core` (file: dep, source in `packages/tea-core`) | backend only |
| Shared types + catalog | `@torch/core-shared` (file: dep, source in `packages/tea-core-shared`) | frontend + backend |
| PDF generation | `@sparticuz/chromium` + `puppeteer-core` (inline, no worker) | backend |
| Auth | bcrypt + JWT (localStorage, `Authorization: Bearer`) | — |
| Secrets | Secret Manager (`torch-database-url`, `torch-jwt-secret`) | GCP |
| Image registry | Artifact Registry (`us-central1`, repo `torch`) | GCP |
| CI/CD | Manual `gcloud builds submit` + `bash deploy.sh` | — |

## Local development

Prereqs: Node.js 22+, Docker.

```bash
cd torch_product

# one-time
( cd backend  && cp .env.example .env )
( cd frontend && cp .env.example .env.local )
docker compose up -d
( cd backend && npm install && npx prisma migrate dev --name init )
( cd frontend && npm install )
( cd packages/tea-core && npm install )

# day-to-day (two terminals)
cd backend && npm run dev          # :4000
cd frontend && npm run dev         # :3001
```

Engine tests:
```bash
cd torch_product/packages/tea-core && npm test
```

## Deploying

Full story: **[Backend deploy walkthrough](torch_product/docs/backend-deploy-report.html)** — open in a browser.

### Quick reference — redeploying the backend

From `torch_product/`:

```bash
export PROJECT_ID=project-688a4c78-5d5b-45b3-b5d
export REGION=us-central1
export INSTANCE_CONN=project-688a4c78-5d5b-45b3-b5d:us-central1:torch-db
export IMAGE=us-central1-docker.pkg.dev/${PROJECT_ID}/torch/backend:vN   # bump N each time

gcloud builds submit --config=cloudbuild.yaml --substitutions=_IMAGE=$IMAGE .
bash backend/deploy.sh
curl https://torch-backend-746208330214.us-central1.run.app/api/health
```

Rebuild only when `backend/src/**`, `backend/package.json`, the Dockerfile, the Prisma schema, or `packages/tea-core/**` changed.

### Frontend deploys

Vercel auto-builds on push to `main`. No GCP work needed. The single env var that ties it to the backend is `NEXT_PUBLIC_BACKEND_URL` in Vercel project settings.

## What's done

- [x] Frontend live at `torch.lemnisca.bio`
- [x] Cloud SQL Postgres 16 provisioned (`torch-db`, `db-f1-micro`, daily backups at 03:00)
- [x] Secret Manager holding `DATABASE_URL` and `JWT_SECRET`
- [x] Artifact Registry repo `torch` in `us-central1`
- [x] Cloud Build wired via `cloudbuild.yaml`
- [x] Backend deployed to Cloud Run as `torch-backend` (current: v13)
- [x] CORS set to `https://torch.lemnisca.bio`
- [x] Billing budget alert configured
- [x] Rate limiting: 2000 req/15min global, 100 req/15min on `/api/auth/*`
- [x] End-to-end signup / login / assess / results flow
- [x] Auth via JWT (bcrypt)
- [x] Engine split: `tea-core` (backend-only math) + `tea-core-shared` (public surface)
- [x] `runAssessment` + `runWhatIf` server-side only
- [x] What-if analysis fully wired across all five domains
- [x] Scale-dependent input limits in Step 3
- [x] `estimate_mu` OUR mode (µ-based, gated to supported species)
- [x] PDF generation: `POST /api/assessments/:id/pdf` renders HTML template via Puppeteer, streams PDF to client. `@react-pdf/renderer` removed.
- [x] PDF preview modal: click "Download PDF Report" → modal opens with loading spinner → inline iframe preview, auto-saves to disk as soon as PDF arrives. Modal portaled to `document.body` so it escapes the FAB containing block.
- [x] PDF report fully redesigned: full-bleed cover page, restrained ink palette, compact domain blocks, proper `@page` CSS rules, Puppeteer-native page footer with page numbers. `preferCSSPageSize` + `displayHeaderFooter` for no-cutoff rendering. CO₂ subscript via HTML `<sub>` tag (Cloud Run Chromium lacks U+2082).
- [x] "Download PDF Report" button pinned bottom-right (FAB-style) for discoverability while scrolling.
- [x] Unauthenticated assessment preview saved to DB on sign-in (not lost)

## What's left

- **Structured logging + Cloud Trace** — `pino` for JSON logs, Cloud Trace for per-request latency. ~30 min for logging.
- **PostHog analytics** — product analytics on key flows (assessment, what-if, PDF download).
- **Results page animation pass** — check other Lemnisca products and align on motion/transition language for the results dashboard.

### Explicit no (decided, not forgotten)
- Custom domain for backend — current GCP URL is fine
- CI/CD automation — manual deploy workflow preferred
- Firebase Auth — current bcrypt+JWT works fine

## Approximate monthly cost at idle

~$8/month, almost entirely Cloud SQL. Cloud Run, Artifact Registry, Secret Manager, Cloud Build all sit at ~$0 under current usage.

## Pointers

| Question | Where |
|---|---|
| How do I redeploy? | [docs/backend-deploy-report.html](torch_product/docs/backend-deploy-report.html) §"Redeploying after code changes" |
| GCP runtime values, last verified state, working preferences | [HANDOFF.md](HANDOFF.md) |
| Why is Cloud SQL always on? | deploy-report HTML §"Living with the deploy" |
| Where does the math live? | `torch_product/packages/tea-core/src/engine/` |
| Where are the risk thresholds? | `torch_product/packages/tea-core/src/constants/scoring.ts` |
| Where are the input bounds? | `torch_product/packages/tea-core-shared/src/constants/input_bounds.ts` |
| Where is the what-if catalog? | `torch_product/packages/tea-core-shared/src/constants/whatif.ts` |
| Where is the API contract? | `torch_product/backend/src/routes/` + controllers |
| Where is the DB schema? | `torch_product/backend/prisma/schema.prisma` |
| Where is the PDF template? | `torch_product/backend/src/templates/report.template.ts` |
| App-level layout, local dev specifics | `torch_product/README.md` |
