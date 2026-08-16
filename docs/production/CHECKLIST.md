# Production Deployment Checklist

Use this checklist to ensure all guardrails are met before deploying the AI Novel Engine to production.

## 1. Environment Validation
- [ ] Ensure \`DATABASE_URL\` is securely populated in the production environment.
- [ ] Verify LLM provider API keys (e.g., Anthropic, OpenAI) are set and valid.
- [ ] Confirm \`NODE_ENV\` is set to \`production\`.
- [ ] Ensure frontend URLs and CORS rules allow the correct origin domains.

## 2. Database & Schema
- [ ] Run and verify all Supabase migrations are fully applied.
- [ ] Assert RLS (Row Level Security) policies are active and properly restricted.
- [ ] Ensure table indices are present (especially similarity search and ID lookups).
- [ ] Verify automatic scheduled backups are enabled for Postgres.

## 3. Infrastructure & Monitoring
- [ ] Validate standard health endpoints (e.g., \`/api/health\`) return HTTP 200 OK.
- [ ] Ensure log aggregation is receiving Next.js and Orchestrator errors.
- [ ] Confirm alerts are configured for high error rates or sudden cost spikes.

## 4. Rollback Plan
- [ ] Have the exact previous build/commit hash ready.
- [ ] Verify down-migrations (if applicable) or point-in-time recovery strategy is understood.
- [ ] Ensure static assets for the previous version can be restored.

## 5. Security Check
- [ ] Confirm \`next.config.ts\` applies standard headers (nosniff, X-Frame-Options, Referrer-Policy).
- [ ] Do a final check to ensure NO hardcoded keys or secrets are in the compiled codebase.
