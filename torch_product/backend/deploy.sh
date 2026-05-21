#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?must be set}"
: "${REGION:?must be set}"
: "${INSTANCE_CONN:?must be set}"
: "${IMAGE:?must be set}"

gcloud run deploy torch-backend \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --add-cloudsql-instances="$INSTANCE_CONN" \
  --set-secrets=DATABASE_URL=torch-database-url:latest,JWT_SECRET=torch-jwt-secret:latest,RESEND_API_KEY=resend-api-key:latest \
  --set-env-vars="NODE_ENV=production,FRONTEND_URL=https://torch.lemnisca.bio,COOKIE_SECURE=true,AUTH_EMAIL_FROM=Lemnisca <shilpa@lemnisca.bio>" \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --timeout=120
