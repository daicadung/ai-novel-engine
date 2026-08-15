# Phase 7.5 Production Deployment Checklist

This document provides all configuration, setup, and operational procedures
required before deploying the AI Novel Engine to production.

---

## 1. Environment Variables

All environment variables must be configured as **Vercel Environment Variables** (not in `.env` files in production).

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL **Transaction Pooler** connection string. Used for all Prisma runtime queries. |
| `DIRECT_URL` | ✅ | Supabase PostgreSQL **Session/Direct** connection string. Required for Prisma migrations. |
| `NINE_ROUTER_API_KEY` | ✅ | API key for the 9Router LLM gateway. **Never expose to frontend.** |
| `INTERNAL_JOB_SECRET` | ✅ | Secret that protects `/api/internal/jobs/process`. Must be set before deploying Cron. **Server-only.** |
| `LLM_PROVIDER` | ✅ | Primary LLM provider name. Set to `9router` for production. |
| `MODEL` | ✅ | Default model name (e.g. `gpt-4o`). |
| `JOB_BATCH_SIZE` | ✅ | Maximum jobs to process per Vercel Cron invocation. Recommended: `3`. |
| `JOB_PROCESSOR_TIMEOUT_MS` | ✅ | Soft processor deadline in milliseconds. Recommended: `50000` (50 seconds). |
| `JOB_LOCK_TIMEOUT_MS` | ✅ | Stale job lock expiry. Recommended: `180000` (3 minutes). |
| `MAX_RETRIES` | ✅ | Maximum job retry attempts before permanent FAILED. Recommended: `3`. |
| `MAX_SCENE_RETRIES` | ✅ | Maximum scene generation retry attempts within a prose job. Recommended: `3`. |
| `MAX_REVISION_RETRIES` | ✅ | Maximum prose revision attempts per scene. Recommended: `3`. |
| `MAX_TOKENS` | ⚠️ Optional | Global token budget limit (stops generation when exceeded). |
| `MAX_CONTEXT_SIZE` | ⚠️ Optional | Maximum LLM context window size hint. Provider-dependent. |
| `NINE_ROUTER_BASE_URL` | ⚠️ Optional | Override the 9Router base URL (default: `https://9router.fft.vn/v1`). |
| `ARCHITECT_LLM_PROVIDER` | ⚠️ Optional | Override LLM provider for Story Architect stage only. |
| `ARCHITECT_LLM_MODEL` | ⚠️ Optional | Override model for Story Architect stage only. |
| `PLANNER_LLM_PROVIDER` | ⚠️ Optional | Override LLM provider for Planner stage only. |
| `PLANNER_LLM_MODEL` | ⚠️ Optional | Override model for Planner stage only. |
| `SCENE_LLM_PROVIDER` | ⚠️ Optional | Override LLM provider for Scene stage only. |
| `SCENE_LLM_MODEL` | ⚠️ Optional | Override model for Scene stage only. |
| `PROSE_LLM_PROVIDER` | ⚠️ Optional | Override LLM provider for Prose stage only. |
| `PROSE_LLM_MODEL` | ⚠️ Optional | Override model for Prose stage only. |
| `CORS_ORIGIN` | ✅ | Allowed CORS origin (e.g. your frontend Vercel URL). |

> [!CAUTION]
> NEVER set `DATABASE_URL`, `DIRECT_URL`, `NINE_ROUTER_API_KEY`, or `INTERNAL_JOB_SECRET` in any file that gets committed to version control.

---

## 2. Supabase Setup

1. Create a new Supabase project at [app.supabase.com](https://app.supabase.com).
2. Navigate to **Settings → Database → Connection String**.
3. Copy the **Transaction Pooler** URL → set as `DATABASE_URL`.
4. Copy the **Session Pooler** (or direct connection) URL → set as `DIRECT_URL`.
5. Enable the `pgvector` extension: **Database → Extensions → vector**.

---

## 3. Prisma Migration

> [!IMPORTANT]
> Migrations require `DIRECT_URL` to bypass the connection pooler.

```bash
# In packages/database
DIRECT_URL="your-direct-url" DATABASE_URL="your-pooler-url" npx prisma migrate deploy
```

Or set these in your local `.env` file (which is gitignored) and run:

```bash
cd packages/database
npx prisma migrate deploy
npx prisma generate
```

---

## 4. Vercel Deployment

1. Install Vercel CLI: `npm i -g vercel`
2. Link to project: `vercel link`
3. Set all environment variables via Vercel dashboard or CLI:
   ```bash
   vercel env add DATABASE_URL
   vercel env add DIRECT_URL
   vercel env add NINE_ROUTER_API_KEY
   vercel env add INTERNAL_JOB_SECRET
   vercel env add LLM_PROVIDER
   ```
4. Deploy: `vercel --prod`

---

## 5. Vercel Cron Configuration

The `vercel.json` file includes a cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/internal/jobs/process",
      "schedule": "* * * * *"
    }
  ]
}
```

This runs every minute. On Vercel Pro/Enterprise, crons can run as frequently as every 1 minute.
The endpoint is protected by `INTERNAL_JOB_SECRET` via `Authorization: Bearer <secret>`.

> [!NOTE]
> Vercel Cron automatically sends the `Authorization` header from the cron configuration. You may need to configure it manually if using a custom trigger.

---

## 6. 9Router Configuration

The 9Router provider is the OpenAI-compatible gateway used in production.

- Base URL: `https://9router.fft.vn/v1`
- Set `LLM_PROVIDER=9router`
- Set `NINE_ROUTER_API_KEY=<your-key>`
- Set `MODEL=gpt-4o` (or preferred model name supported by 9Router)

The system will call `POST {NINE_ROUTER_BASE_URL}/chat/completions` with standard OpenAI message format.

---

## 7. Budget Configuration

Budget limits prevent runaway generation costs. Configure in Vercel environment variables:

| Variable | Description |
|---|---|
| `MAX_TOKENS` | Global token limit across all generations for this instance |
| `MAX_CONTEXT_SIZE` | Max context window size hint |

Additional per-job/chapter/novel limits can be set programmatically via `BudgetManager.setConfig()`.

---

## 8. Job Recovery Procedures

### Stale Job Recovery (Automatic)
The `ServerlessJobProcessor` automatically recovers stale jobs at the beginning of every cron invocation.
A job is stale if its `lockedAt` timestamp is older than `JOB_LOCK_TIMEOUT_MS`.

### Manual Failed Job Inspection
Query failed jobs via the API or directly in Supabase:

```sql
SELECT id, status, error, "retryCount", "failedAt"
FROM "GenerationJob"
WHERE status = 'FAILED'
ORDER BY "failedAt" DESC;
```

### Re-queuing a Failed Job
To manually re-queue a failed job:

```sql
UPDATE "GenerationJob"
SET status = 'QUEUED', "retryCount" = 0, "lockedAt" = NULL, "lockedBy" = NULL, error = NULL
WHERE id = '<job-id>';
```

---

## 9. Retry Behavior

| Retry Attempt | Wait Time (Exponential Backoff) |
|---|---|
| 1st retry | 2 seconds |
| 2nd retry | 4 seconds |
| 3rd retry | 8 seconds |
| 4th attempt | FAILED permanently |

Stale recovery retries have a short 10-second delay.

---

## 10. Rollback Procedure

The system uses **non-destructive versioning**. Rolling back means reverting the canonical pointer:

1. Identify the previous canonical `ChapterProseVersion` (status: `STALE`).
2. Update the pointer:
   ```sql
   UPDATE "ChapterProse" SET "currentVersionId" = '<previous-version-id>' WHERE "chapterId" = '<chapter-id>';
   UPDATE "ChapterProseVersion" SET status = 'CANONICAL' WHERE id = '<previous-version-id>';
   UPDATE "ChapterProseVersion" SET status = 'STALE' WHERE id = '<current-version-id>';
   ```
3. Historical records are always preserved — no data is lost.

For plan rollback (StoryPlanVersion), similarly flip `isCanonical`:

```sql
UPDATE "StoryPlanVersion" SET "isCanonical" = false WHERE id = '<current-id>';
UPDATE "StoryPlanVersion" SET "isCanonical" = true WHERE id = '<previous-id>';
```

---

## 11. Monitoring & Observability

Each `GenerationJob` record tracks:

- `status`, `retryCount`, `lockedAt`, `lockedBy`
- `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCostUsd`
- `provider`, `model`
- `startedAt`, `completedAt`, `failedAt`
- `error` (structured JSON)
- `correlationId`, `parentJobId`

Query job throughput in Supabase:

```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG("totalTokens") as avg_tokens,
  SUM("estimatedCostUsd") as total_cost_usd,
  AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt"))) as avg_latency_seconds
FROM "GenerationJob"
GROUP BY status;
```
