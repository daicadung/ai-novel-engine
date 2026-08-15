# Phase 7 Migration Impact Report

## 1. Current Infrastructure Dependencies
The AI Novel Engine currently relies on:
- **Application Logic**: TypeScript, Next.js (web frontend), Fastify (API).
- **Database**: PostgreSQL with `pgvector` managed via Prisma.
- **Job Orchestration**: Redis and BullMQ (via `ioredis` and `bullmq` packages).
- **Containerization**: Docker (assumed for local Postgres and Redis, though currently unavailable on the host system).

## 2. Redis/BullMQ Dependencies
BullMQ and Redis are deeply integrated into the `apps/api/src/services/queue` module:
- `BullQueueManager.ts`: Manages adding, cancelling, and tracking jobs using BullMQ.
- `BullWorker.ts`: A long-running daemon that listens to Redis events to execute jobs.
- `workerFactory.ts` & `QueueFactory.ts`: Dynamically select BullMQ vs Memory queues.
- `package.json` & `pnpm-lock.yaml`: Dependencies on `bullmq` and `ioredis`.

## 3. Existing GenerationJob Architecture
The `GenerationJob` model in Prisma already tracks basic metadata (`novelId`, `status`, `stage`, `input`, `output`, `retryCount`). However, it currently acts as a passive historical record rather than the authoritative queue. The real job state resides in Redis/BullMQ.

## 4. Existing Worker Architecture
The current architecture uses daemon workers (`BullWorker.ts`) that utilize an infinite loop / persistent socket connection to Redis. They receive payloads and route them through `JobDispatcher.ts` to domain managers (`ArchitectManager`, `StoryPlannerManager`, etc.). This is fundamentally incompatible with Vercel's serverless environment, which terminates processes quickly and does not support background daemon workers.

## 5. Existing LLM Architecture
The system uses the `ILLMProvider` abstraction (`BaseProvider.ts`, `MockProvider.ts`). It already supports generating structured Zod outputs and text. It currently lacks a direct `9Router` integration, but the architecture easily supports adding an `OpenAICompatibleProvider` that points to `https://9router.fft.vn/v1`.

## 6. What Can Be Preserved
- **Domain Logic**: All Phase 1-5 logic, validations, and handlers remain untouched.
- **Canonical Invariants**: `STALE` semantics, non-destructive regeneration, and Continuity safety are completely isolated from the queue layer and will survive verbatim.
- **Budget & Observability**: `BudgetManager`, `ObservabilityManager`, and `LLMUsageProxy` will seamlessly work with the new serverless queue.
- **Core Abstractions**: `IQueueManager` and `JobDispatcher` interfaces can remain, though their implementations will change.
- **Job Model**: `GenerationJob` is preserved but expanded to take over BullMQ's responsibilities.

## 7. What Must Be Replaced
- **BullMQ / Redis**: Removed entirely in production.
- **Workers**: Long-running daemon workers (`BullWorker.ts`) must be replaced with bounded serverless invocation endpoints.
- **Queue Manager**: `BullQueueManager` will be replaced by a `DatabaseQueueManager` (PostgreSQL-backed).
- **Execution Triggers**: Replaced with Vercel Cron or webhook-driven serverless invocations (`/api/internal/jobs/process`).

## 8. Proposed Migration Steps
1. **Supabase Prisma Configuration**: Update `DATABASE_URL` and `DIRECT_URL` handling for Supabase pooling compatibility.
2. **GenerationJob Schema Update**: Enhance `GenerationJob` with fields for atomic locking (`lockedAt`, `lockedBy`), retries (`scheduledAt`), hierarchy (`parentJobId`), and budget (`inputTokens`, `estimatedCostUsd`, etc.).
3. **Database Queue Manager**: Implement a PostgreSQL-backed `IQueueManager`.
4. **Atomic Job Claiming**: Implement a safe `UPDATE ... WHERE status = QUEUED AND lockedAt IS NULL` transaction in Prisma to prevent concurrent Vercel functions from grabbing the same job.
5. **Serverless Job Processor**: Create a secure Next.js / Fastify endpoint (`POST /api/internal/jobs/process`) that claims a bounded number of jobs, executes them via `JobDispatcher`, and releases them.
6. **Job Retry & Stale Recovery**: Implement backoff scheduling and recovery for jobs where `lockedAt < now - timeout`.
7. **9Router Integration**: Create the `9RouterProvider` using the `ILLMProvider` interface.
8. **Dependency Cleanup**: Remove `bullmq` and `ioredis` dependencies.
9. **UI Adjustments**: Update the dashboard to poll or receive updates from the DB instead of BullMQ.
10. **E2E & Integration Tests**: Verify the full system using the real Supabase database and Mock/9Router providers.
