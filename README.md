# Torch

Bioreactor scale-up assessment tool. Users describe a lab-scale fermentation, the engine flags scale-up risks across mixing, oxygen transfer, heat transfer, and CO₂ stripping, and returns a structured risk report.

**Live**
- Frontend: <https://torch-snowy.vercel.app>
- Backend: <https://torch-backend-746208330214.us-central1.run.app>
- Health check: `/api/health`

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
│   └── README.md                   # app-level details (local dev setup, layout)
│
└── product_v1/                     # legacy. CRUD scaffolding only, no engine.
                                    #   Kept for reference; not deployed.
```

The split between `tea-core` and `tea-core-shared` is deliberate: the **engine math is backend-only** (organism kinetics, correlations, scoring rubrics, `runAssessment`, `runWhatIf`), while the **public surface** (types, input bounds, scale-up envelopes, defaults, what-if catalog labels) is what the frontend imports. Frontend never bundles engine code; it POSTs inputs to the backend and renders the structured response.

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
export IMAGE=us-central1-docker.pkg.dev/${PROJECT_ID}/torch/backend:vN   # bump N each time(Current latest is v7, check before writing: https://console.cloud.google.com/artifacts/docker/project-688a4c78-5d5b-45b3-b5d/us-central1/torch/backend?project=project-688a4c78-5d5b-45b3-b5d&rapt=AEjHL4PgVGOyPb7c-HlNBrclq0TVMZAQMI09_KspZ6YCTUOqSIDUf1J5v2fFwfiGjkFGWs9x-9F7Jk3udSTjNnKgFLIFiZQpxrci2OtL09TF-hZvY7haFHM)

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
- [x] Scale-dependent input limits in Step 3 wired up. `tea-core-shared` exports `SCALEUP_OPERATING_RANGES` (binned by volume: 1, 10, 100, 1k, 10k L) plus `getScaleupOperatingRange(v)` and `maxImpellersForGeometry(hd)`. Frontend reads them: VesselStep shows a per-scale max-RPM / max-VVM hint, schema enforces those maxes as hard errors at submit.
- [x] **Engine split into private (backend-only) and public (shared) packages.** `tea-core-shared` carries types, bounds, defaults, the scale-up envelope, the what-if modification catalog and conflict pairs, and the OD→CDW table — all safe to bundle into the frontend. `tea-core` carries the math: `runAssessment`, `runWhatIf`, organism kinetics, correlations, scoring rubrics, heat-transfer correlations. Frontend imports only from `tea-core-shared`; engine code physically cannot leak into the static bundle.
- [x] **`runAssessment` moved server-side.** Backend exposes `POST /api/assessments/preview` (compute, no save), `/save` (compute + persist, authed), `/whatif` (apply modifications). Frontend calls these instead of running math in the browser.
- [x] **What-if analysis fully wired.** Per-domain modification buttons filtered by the catalog's `domains` array, conflict pairs auto-deselect on toggle, at-limit heuristic dims unusable buttons, current → target value hints under each button. Continuous knobs (Inlet O₂ and feed-frequency stepper) drive the engine's `oxygen_level` / `feed_frequency` params. Target Scale column shows inline `original → modified` with the recomputed risk badge. "Changes Applied" summary uses `modified_inputs` from the engine; primary-bottleneck shifts are surfaced; what-if-only flags display in a callout.
- [x] **Scale-Up Projections** uses real ensemble min/max for kLa and mixing time (engine surfaces `kla_ensemble.{min,max}` and `theta_mix_*_{min,max}`). Adaptive precision: integers for large values, decimals only for sub-unit ones.

## What's left

### Must-do before going wider
- **Billing budget alert.** Three minutes in the GCP console. Catches runaway costs from bugs/abuse.

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
| Where does the math live? | `torch_product/packages/tea-core/src/engine/` (backend-only) |
| Where are the risk thresholds? | `torch_product/packages/tea-core/src/constants/scoring.ts` (backend-only) |
| Where are the input bounds? | `torch_product/packages/tea-core-shared/src/constants/input_bounds.ts` (flat) + `scaleup_operating_ranges.ts` (scale-binned RPM / VVM / P/V envelopes). Both public. |
| Where is the what-if catalog? | `torch_product/packages/tea-core-shared/src/constants/whatif.ts` (modification labels, domain mapping, conflict pairs, stepper helpers). Public. |
| Where is the what-if engine? | `torch_product/packages/tea-core/src/engine/whatif/` — `runWhatIf`, `applyModifications`, `canApplyModification`. Backend-only. |
| Where is the API contract? | `torch_product/backend/src/routes/` + controllers |
| Where is the DB schema? | `torch_product/backend/prisma/schema.prisma` |
| App-level layout, local dev specifics | `torch_product/README.md` |
