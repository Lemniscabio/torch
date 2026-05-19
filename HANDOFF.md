# Handoff notes — for a new session / new assistant

This file fills the gaps left by the rest of the repo's docs. Start by reading, in order:

1. **`README.md`** (this directory) — architecture overview, what's done, what's left, pointers.
2. **`torch_product/docs/backend-deploy-report.html`** — the canonical deploy walkthrough (every command, every decision, redeploy + rollback flow). Open in a browser.
3. **`torch_product/README.md`** — app-level layout and local dev setup.

Everything below is context those files don't carry.

## Where work happens

- **Active code lives in `torch_product/`.** Frontend, backend, and TWO shared packages.
- **`product_v1/` is legacy / read-only.** Old CRUD scaffolding only — no engine, not deployed. Do not edit it.
- Default branch is `main`. We push directly to it.

### The tea-core split (important to understand before touching either package)

`packages/` contains two packages, deliberately separated to prevent engine math from being bundled into the static frontend:

| Package | Contents | Who imports it |
|---|---|---|
| `@torch/core-shared` (in `packages/tea-core-shared/`) | TypeScript types, input bounds, scale-up envelopes, defaults, equipment metadata, what-if catalog (labels, domain mapping, conflict pairs), stepper helpers, OD→CDW conversion factors | Frontend + backend |
| `@torch/core` (in `packages/tea-core/`) | The engine: `runAssessment`, `runWhatIf`, derivations, all five risk calculators, organism kinetics, scoring rubrics, correlations, heat-transfer constants. Depends on `@torch/core-shared` for types. | Backend only |

Both packages compile to `dist/` (CommonJS, generated on install). The frontend has `transpilePackages: ['@torch/core-shared']` in `next.config.ts` — explicitly NOT including `@torch/core` so the engine source cannot leak into the static bundle.

**Frontend's `package.json` build script** runs `npm --prefix ../packages/tea-core-shared install && npm run build` before `next build`, ensuring tea-core-shared's `dist/` is fresh on every Vercel deploy.

**Backend's Dockerfile** installs and builds both packages before `tsc` compiles `backend/src/`.

### Engine is server-side

- `POST /api/assessments/preview` — compute, no save. Public. Used by `/example` and unauthed assess flow.
- `POST /api/assessments/save` — compute + persist. Authed. Used after sign-in.
- `POST /api/assessments/whatif` — apply target-scale modifications and return all five recomputed domain scores + modified inputs + new primary bottleneck + flags.

The frontend never runs `runAssessment` or `runWhatIf` directly. If you see those imports in the frontend, something regressed.

## Open issues (resolve before claiming everything works)

### 1. React hydration mismatch on the assess wizard (may still apply)
Manifests as "Hydration failed because the server rendered HTML didn't match the client" on `/assess`. Diff in inspector points at `aria-checked` on a radio in Step 3.

Suspected root cause: wizard form state restored from a client-only source (localStorage / sessionStorage / URL params) *after* hydration, so the first server render and first client render disagree on selected radio options.

Diagnosis steps:
- Repro locally: `cd torch_product/frontend && npm run dev`, open `http://localhost:3001/assess`.
- Confirm whether the error appears on first-visit (no saved state) vs. after navigating through a few steps (state in storage).
- Likely fix patterns: mount-guard on the assess shell (`useEffect → setMounted(true); if (!mounted) return null`), or move form-state restoration into a `useEffect` so SSR always sees empty defaults.

Status unconfirmed at last update — may have been resolved incidentally by other changes; verify before debugging.

## Ephemeral runtime values

Most of what you need for GCP commands lives either in `cloudbuild.yaml`, `backend/deploy.sh`, or the deploy-report HTML. Re-export these in any new shell:

```bash
export PROJECT_ID=project-688a4c78-5d5b-45b3-b5d
export REGION=us-central1
export INSTANCE_CONN=project-688a4c78-5d5b-45b3-b5d:us-central1:torch-db
export IMAGE=us-central1-docker.pkg.dev/${PROJECT_ID}/torch/backend:vN  # bump N each deploy
```

**Cloud Run service:** `torch-backend` (region `us-central1`)
**Service URL (no custom domain yet):** `https://torch-backend-746208330214.us-central1.run.app`
**Frontend URL:** `https://torch-snowy.vercel.app`
**Artifact Registry repo:** `torch` in `us-central1` (path: `us-central1-docker.pkg.dev/<project>/torch/backend`)
**Cloud SQL instance:** `torch-db`, Postgres 16, `db-f1-micro`, single-zone, daily backups at 03:00
**Secrets:** `torch-database-url`, `torch-jwt-secret` (both in Secret Manager, project-scoped)

**Cloud Run runtime SA:** `746208330214-compute@developer.gserviceaccount.com` (default Compute SA). Has Editor on the project, plus `secretmanager.secretAccessor` bindings on both secrets.

**User's GCP role:** `roles/editor` + `roles/secretmanager.admin` + `roles/run.admin` on the project. NOT owner — the lemnisca.bio org owner must be looped in for project-level IAM changes.

## Things deliberately not in version control

- **Cloud SQL Postgres password** — only in the user's shell and Secret Manager. Ask the user before running migrations.
- **`backend/.env`** — gitignored. Local dev only. The `.env.example` is the template.
- **`cloud-sql-proxy` binary** — gitignored. Download fresh per OS arch when running migrations.

## Migration / rollback recipes

Already covered in the HTML report's "Redeploying after code changes" section. Don't duplicate; read that.

The two cases that are easy to forget:
- **Schema changed** → run `npx prisma migrate deploy` against Cloud SQL via the Cloud SQL Auth Proxy *before* deploying the new image.
- **Rollback** → `gcloud run services update-traffic torch-backend --region=us-central1 --to-revisions=<previous-revision>=100`. No rebuild needed.

## Working preferences (the user has stated these)

- Run commands themselves; do not invoke `gcloud` from this tool.
- Prefer terse answers and direct commands over long explanations, unless the user asks for the rationale.
- Be explicit about *why* anything risky or hard-to-reverse is being done before doing it.

## Last verified state

- **Backend:** Cloud Run service `torch-backend` at image tag `v6` (or higher — check `gcloud run services describe`). `/api/health` returns 200. Endpoints: `/api/assessments/preview`, `/save`, `/whatif`, plus the original CRUD routes.
- **Frontend:** deployed on Vercel at `torch-snowy.vercel.app`, hitting the Cloud Run URL via `NEXT_PUBLIC_BACKEND_URL`.
- **Database:** `torch` DB on `torch-db` instance, single applied migration (`20260516010618_init`). User + Assessment tables exist; no real user data yet (test data only).
- **Last big architectural change:** engine split into `tea-core` (private) + `tea-core-shared` (public), `runAssessment` moved server-side, what-if analysis fully wired through both packages. See `git log --oneline` for the exact commits.

## What's left (high level — full list in root README)

Must-do: billing budget alert on the GCP project.
Should-do: custom domain (`api.torch.lemnisca.bio`), rate limiting (`express-rate-limit`), CI/CD on push.
Nice-to-have: Firebase Auth swap, structured logging.
Deferred by user: PDF / report generation pipeline (Cloud Run worker + Cloud Tasks + Cloud Storage).
