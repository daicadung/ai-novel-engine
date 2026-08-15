# Phase 2 Implementation Plan: Story Architect

## Overview
The objective of Phase 2 is to build the Story Architect subsystem. This subsystem takes a single input (Novel Title) and progressively transforms it into a comprehensive Story Bible without autonomous chapter prose generation. We will use a Mock LLM provider to test the pipeline.

## 1. Core Abstractions (`packages/core`)
- **Stage Registry**: A centralized, data-driven registry defining every stage (e.g., CONCEPT, PREMISE, WORLD). Each definition includes dependencies, input/output schemas, and handler identifiers.
- **Enums**: 
  - `ArchitectStage` (CONCEPT, PREMISE, etc.)
  - `ArchitectStatus` (NOT_STARTED, RUNNING, COMPLETED, FAILED, STALE)
- **Zod Schemas**: Strict schemas for all structured LLM outputs.

## 2. Database Modifications (`packages/database`)
- **Novel Model**: Add `architectStage` and `architectStatus` to track the current state of the pipeline.
- **GenerationJob Model**: Ensure fields exist for `stage`, `status`, `provider`, `model`, `input`, `output`, `error`, `retryCount`, `startedAt`, `completedAt`.

## 3. Pipeline Architecture (`apps/api`)
- **LLM Provider**: Abstract interface (`generate`, `generateStructured`, `healthCheck`). Implement a `MockProvider` that returns realistic, structured outputs for all Phase 2 stages.
- **Stage Registry & Handlers**:
  - `StageHandler` instances prepare input, invoke the provider, validate output via Zod, and persist canonical state.
- **ArchitectManager**: Handles state machine transitions, dependency checks, idempotency, concurrency prevention, downstream stage invalidation (marking as STALE), and retry logic.

## 4. API Endpoints
- `POST /api/novels/:novelId/architect/start`
- `GET /api/novels/:novelId/architect/status`
- `POST /api/novels/:novelId/architect/stages/:stage/run`
- `POST /api/novels/:novelId/architect/stages/:stage/retry`
- `GET /api/novels/:novelId/architect/jobs`
- `GET /api/novels/:novelId/architect/result/:stage`

## 5. Web Dashboard
- UI to monitor pipeline progress, start generation, retry failed stages, and view structured outputs.

## 6. Testing (DB-Free)
- Unit tests for Stage Registry, Dependency Graph, State Transitions, Retry, Idempotency, Concurrency, MockProvider, and Downstream Invalidation.
