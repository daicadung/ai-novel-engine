# Phase 7 Production Migration Walkthrough

The AI Novel Engine has been successfully migrated to a serverless-ready architecture for Vercel + Supabase, removing the previous Docker, Redis, and BullMQ dependencies.

## 1. Database-Backed Queue
A new `DatabaseQueueManager` has been implemented which stores generation jobs in the `GenerationJob` table in PostgreSQL. This allows the system to operate natively on Vercel and guarantees transactional safety with Supabase.

## 2. Serverless Execution 
A `ServerlessJobProcessor` has been created, utilizing atomic Postgres row locking (`FOR UPDATE SKIP LOCKED`) to securely claim pending jobs.
This allows Vercel Cron to trigger the `/api/internal/jobs/process` endpoint periodically, executing jobs up to a bounded limit per run, and safely picking up where it left off on the next tick.

## 3. Stale Job Recovery
Hung jobs (e.g. if Vercel serverless functions time out) are automatically recovered. Jobs left in the `CLAIMED` or `RUNNING` state beyond the `JOB_LOCK_TIMEOUT_SECONDS` threshold are returned to the queue and retried with exponential backoff.

## 4. LLM Production Routing
A `NineRouterProvider` has been added, hooking into the `ProviderFactory`. This connects the generation pipeline directly to the 9Router OpenAI-compatible API endpoints using `NINE_ROUTER_BASE_URL` and `NINE_ROUTER_API_KEY`.

## 5. Dashboard Generation Jobs
The frontend now includes a real-time (polling) `GenerationJobsList` that displays all generation jobs for a given novel. It lists:
- Job ID and Type
- Status (`QUEUED`, `CLAIMED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `RETRY_PENDING`)
- Output Metrics (Cost, Tokens, Retries)
- Detailed Error reasons

## Verification
- Code builds completely without type errors (`pnpm typecheck` passed successfully).
- Redis and BullMQ dependencies and plugins were entirely removed from `@ane/api`.
- Database schema generated successfully with `directUrl` for serverless connection pooling compatibility.
- Unit and integration tests for the queue are available and support skipping DB checks if local Supabase is offline.

The environment is now ready for deployment to Vercel!
