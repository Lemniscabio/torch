# Torch

Bioreactor scale-up assessment tool. Users describe a lab-scale fermentation, the engine flags scale-up risks across mixing, oxygen transfer, heat transfer, and CO₂ stripping, and returns a structured risk report.

**Live**
- Frontend: <https://torch-snowy.vercel.app>
- Backend: <https://torch-backend-746208330214.us-central1.run.app>
- Health check: `/api/health`

## Repo layout

```
torch/
├── torch_product/      # ← active app (deployed)
│   ├── frontend/       # Next.js 16 — Vercel
│   ├── backend/        # Express 5 + Prisma — Cloud Run
│   ├── packages/
│   │   └── tea-core/   # pure calculation engine, shared by frontend + backend
│   ├── docs/
│   │   └── backend-deploy-report.html   # detailed deploy walkthrough
│   ├── docker-compose.yml   # local Postgres for dev
│   ├── cloudbuild.yaml      # Cloud Build config for the backend image
│   └── README.md            # app-level details (local dev setup, layout)
│
└── product_v1/         # legacy. CRUD scaffolding only, no engine.
                        #   Kept for reference; not deployed.
```

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
Cloud Run (torch-backend) ── Express + Prisma + tea-core
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
| Shared math | `@torch/core` (file: dep, source in `packages/tea-core`) | bundled in both |
| Auth | bcrypt + JWT (localStorage, `Authorization: Bearer`) | — |
| Secrets | Secret Manager (`torch-database-url`, `torch-jwt-secret`) | GCP |
| Image registry | Artifact Registry (`us-central1`, repo `torch`) | GCP |
| CI/CD | Manual `gcloud builds submit` + `bash deploy.sh` for now | — |

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
# Terminal 1
cd backend && npm run dev          # :4000
# Terminal 2
cd frontend && npm run dev         # :3001
```

Engine tests:
```bash
cd torch_product/packages/tea-core && npm test
```

## Deploying

The full story — every command we ran, every decision, why each piece exists — is written up here:

> **[Backend deploy walkthrough](torch_product/docs/backend-deploy-report.html)** — open the HTML in a browser.

That doc covers Cloud SQL provisioning, Secret Manager, Artifact Registry, Cloud Build, the IAM roles we needed and why, the Prisma migration step via the Cloud SQL Auth Proxy, the final `gcloud run deploy`, and the everyday redeploy / rollback flow.

### Quick reference — redeploying the backend after code changes

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

Rebuild only when `backend/src/**`, `backend/package.json`, the Dockerfile, the Prisma schema, or `packages/tea-core/**` changed. Otherwise it's not needed.

### Frontend deploys

Vercel auto-builds on push to the watched branch. No GCP work. The single env var that ties it to the backend is `NEXT_PUBLIC_BACKEND_URL` in the Vercel project settings.

## What's done

- [x] Frontend deployed to Vercel
- [x] Cloud SQL Postgres 16 provisioned (`torch-db`, `db-f1-micro`, daily backups at 03:00)
- [x] Secret Manager holding `DATABASE_URL` and `JWT_SECRET`
- [x] Artifact Registry repo `torch` in `us-central1`
- [x] Cloud Build wired via `cloudbuild.yaml` + `.gcloudignore`
- [x] Backend image built and deployed to Cloud Run as `torch-backend`
- [x] Prisma migrations applied to Cloud SQL via Cloud SQL Auth Proxy
- [x] Public invocation (`allUsers → roles/run.invoker`)
- [x] CORS allowlist points at the Vercel URL
- [x] Frontend `NEXT_PUBLIC_BACKEND_URL` set to Cloud Run URL
- [x] End-to-end signup / login / assess flow works in production
- [x] Auth via JWT (bcrypt) — no Firebase yet, deliberately
- [x] `tea-core` engine includes new `estimate_mu` OUR mode (µ-based, gated to species with Y_X/O₂ data)
- [x] Frontend wires the new mode through schema, mapper, and Step 4 UI

## What's left

### Must-do before going wider
- **Billing budget alert.** Three minutes in the GCP console. Catches runaway costs from bugs/abuse.
- **Scale-dependent input limits in Step 3.** RPM/VVM/D/T bounds should tighten as `v_target` grows. Numbers don't exist anywhere in the codebase yet — need methodology owner to define the rules first, then `tea-core` adds them as either lookup tables or pure formulas, then the frontend reads via a `getProcessBounds(v_target, …)` helper.

### Should-do soon
- **Custom domain** — `api.torch.lemnisca.bio` → Cloud Run, `torch.lemnisca.bio` → Vercel. Requires DNS access at lemnisca.bio.
- **Rate limiting.** Cloud Run doesn't throttle by itself. Either `express-rate-limit` middleware or Cloud Armor.
- **CI/CD.** Auto-rebuild + redeploy on `git push` — either a Cloud Build trigger or a GitHub Action. Right now it's manual `gcloud builds submit`.
- **CORS regex** for Vercel preview URLs (`torch-snowy-<hash>.vercel.app`) — currently only the production URL is allowed.

### Nice-to-have / future
- **Firebase Auth** replacing the current bcrypt+JWT setup. Architecture plan called for it; current setup works fine, migration is a separate workstream.
- **Structured logging** (`pino`) instead of `console.log`.
- **Cloud Trace** for request-level performance breakdown.

### Explicitly deferred
- **PDF / report generation.** Will be a separate Cloud Run worker behind Cloud Tasks, writing PDFs to Cloud Storage. None of that infrastructure exists yet.

## Approximate monthly cost at idle

~$8/month, almost entirely Cloud SQL (which can't scale to zero). Cloud Run, Artifact Registry, Secret Manager, Cloud Build, Cloud Logging all sit at ~$0 under our usage. Traffic-driven costs grow from there but won't matter at our user scale for a while.

## Pointers

| Question | Where |
|---|---|
| How do I redeploy the backend? | [docs/backend-deploy-report.html](torch_product/docs/backend-deploy-report.html), §"Redeploying after code changes" |
| Why is Cloud SQL always on? | Same doc, §"Living with the deploy" |
| Where does the math live? | `torch_product/packages/tea-core/src/engine/` |
| Where are the risk thresholds? | `torch_product/packages/tea-core/src/constants/scoring.ts` |
| Where are the (currently flat) input bounds? | `torch_product/packages/tea-core/src/constants/input_bounds.ts` |
| Where is the API contract? | `torch_product/backend/src/routes/` + controllers |
| Where is the DB schema? | `torch_product/backend/prisma/schema.prisma` |
| App-level layout, local dev specifics | `torch_product/README.md` |
