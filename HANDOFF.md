# Handoff notes — for a new session / new assistant

Start by reading **[README.md](README.md)** — architecture, tech stack, repo layout, local dev, deploy commands, what's done, what's left, and the pointers table. Everything below is context that README doesn't carry.

---

## Where work happens

- Active code: `torch_product/`. Frontend, backend, two shared packages.
- `product_v1/` is legacy / read-only. Do not edit it.
- Default branch: `main`. Push directly to it.

## The tea-core split

Two packages in `packages/`, deliberately separated so engine math cannot be bundled into the frontend:

| Package | Contents | Imported by |
|---|---|---|
| `@torch/core-shared` (`packages/tea-core-shared/`) | Types, input bounds, scale-up envelopes, defaults, what-if catalog, OD→CDW factors | Frontend + backend |
| `@torch/core` (`packages/tea-core/`) | `runAssessment`, `runWhatIf`, all five risk calculators, organism kinetics, scoring rubrics, correlations | Backend only |

The frontend has `transpilePackages: ['@torch/core-shared']` in `next.config.ts` — explicitly NOT `@torch/core`. If you ever see `@torch/core` imported in frontend code, something regressed.

Frontend's build script rebuilds `tea-core-shared/dist/` before every `next build` so Vercel always gets a fresh compile. Backend's Dockerfile does the same before `tsc`.

## GCP runtime values

Re-export these at the start of any shell session that touches GCP:

```bash
export PROJECT_ID=project-688a4c78-5d5b-45b3-b5d
export REGION=us-central1
export INSTANCE_CONN=project-688a4c78-5d5b-45b3-b5d:us-central1:torch-db
export IMAGE=us-central1-docker.pkg.dev/${PROJECT_ID}/torch/backend:vN  # bump N each deploy
```

**Cloud Run service:** `torch-backend` (us-central1)
**Backend URL:** `https://torch-backend-746208330214.us-central1.run.app`
**Frontend URL:** `https://torch.lemnisca.bio`
**Artifact Registry:** `us-central1-docker.pkg.dev/project-688a4c78-5d5b-45b3-b5d/torch/backend`
**Cloud SQL:** `torch-db`, Postgres 16, `db-f1-micro`, us-central1, daily backups 03:00
**Secrets:** `torch-database-url`, `torch-jwt-secret` (Secret Manager, project-scoped)
**Runtime SA:** `746208330214-compute@developer.gserviceaccount.com` — has Editor + `secretmanager.secretAccessor` on both secrets
**User's GCP role:** `roles/editor` + `roles/secretmanager.admin` + `roles/run.admin`. NOT owner — loop in the lemnisca.bio org owner for project-level IAM changes.

## Things not in version control

- **Cloud SQL password** — only in the user's shell and Secret Manager. Ask before running migrations.
- **`backend/.env`** — gitignored. `.env.example` is the template.
- **`cloud-sql-proxy` binary** — gitignored. Download fresh per OS/arch when running migrations.

## Migration / rollback

- **Schema changed** → run `npx prisma migrate deploy` via Cloud SQL Auth Proxy *before* deploying the new image.
- **Rollback** → `gcloud run services update-traffic torch-backend --region=us-central1 --to-revisions=<prev-revision>=100`. No rebuild needed.

Full detail in [docs/backend-deploy-report.html](torch_product/docs/backend-deploy-report.html).

## Working preferences

- User runs all `gcloud` / shell commands themselves — do not invoke them from this tool.
- Terse answers and direct commands; explain rationale only when asked.
- Flag risky or hard-to-reverse actions explicitly before doing them.
- No GitHub Actions. No Firebase Auth. No custom domain for backend. No CI/CD automation.

## Last verified state

- **Backend:** v10, running. Rate limiting active (2000 req/15min global, 100/15min auth). PDF endpoint live. Memory 1Gi, timeout 120s, max-instances 5.
- **Frontend:** `torch.lemnisca.bio`. PDF preview modal (`DownloadPdfButton`) — opens inline iframe, "Save to disk" downloads blob. Calls `POST /api/assessments/:id/pdf`.
- **Database:** single migration (`20260516010618_init`). User + Assessment tables. No Report model needed (PDF is inline, no persistence).
- **CORS:** `FRONTEND_URL=https://torch.lemnisca.bio` (no trailing slash).
- **Billing budget:** configured in GCP console.

## Backlog

### Next up
- **Structured logging + Cloud Trace** — `pino` for JSON logs (Cloud Logging parses automatically), Cloud Trace SDK for per-request latency. ~30 min for logging alone.

### Deferred / explicit no
- Firebase Auth — not doing
- Custom backend domain — not doing
- CI/CD automation — not doing
- Re-enable Design section in what-if (`DomainDetail.tsx` has `const design = false ? ...`) — deferred, revisit later
