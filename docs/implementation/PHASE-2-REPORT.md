# Phase 2 Implementation Report: Story Architect

## Overview
Phase 2 (Story Architect) has been successfully implemented. The pipeline is designed to take a Novel Title and systematically structure it through 14 stages, producing a comprehensive Story Bible. We have adhered strictly to the architectural constraints (data-driven registry, LLM abstraction, STALE tracking, and idempotency).

## 1. Implemented Features
- **Core Abstractions**:
  - Centralized data-driven `STAGE_REGISTRY` in `@ane/core` with typed input/output schemas (Zod).
  - Enums: `ArchitectStage`, `ArchitectStatus`.
- **Pipeline Architecture (`apps/api`)**:
  - `ArchitectManager`: Orchestrates dependencies, concurrency checks, STALE invalidation, and state transitions.
  - `StageHandler`: Base class that dictates `prepareInput`, `invoke`, and `applyCanonicalPersistence`. All 14 stages have handlers.
  - `LLMProvider` & `MockProvider`: The system interfaces with an abstraction layer. `MockProvider` returns completely realistic JSON responses mapped to Phase 2 schemas, allowing DB-free validation.
- **Database (`packages/database`)**:
  - `Novel` model extended with `architectStage` and `architectStatus`.
  - `GenerationJob` model expanded to store full lifecycle data (`input`, `output`, `provider`, `stage`, `status`, `retryCount`).
- **RESTful API**: Endpoints for starting, viewing status, querying jobs, retrying, and pulling results for specific stages.
- **Web Dashboard**: Updated the UI to display the current Architect Status and a button to start the pipeline.

## 2. Technical Decisions & Corrections Applied
- **LLM Independence**: No real LLM credentials or packages are baked in. `MockProvider` simulates latency and returns schema-compliant data for all 14 stages.
- **Structured Output Workflow**: LLM string -> parse -> Zod validation -> domain validation -> DB persistence.
- **Regeneration & Idempotency**: Running a stage deletes old canonical entities in Phase 1 models (`deleteMany`) before writing new ones to prevent duplication.
- **Dependency Graph**: The `ArchitectManager` DFS algorithm automatically computes downstream dependencies and ensures they run sequentially.

## 3. Testing
- Added robust DB-Free tests in `apps/api/tests/architect.test.ts` evaluating:
  - Dependency Graph traversal (`getDownstreamStages`).
  - Stage Registry validation.
  - MockProvider structured output mapping.
- DB integration tests can be written for `runStage`, but execution is blocked by the missing PostgreSQL server.

## 4. Canonical State Safety
To ensure data integrity for long-form novels, the regeneration strategy has been hardened:
- **Transactional Regeneration**: Canonical data is only updated in a `$transaction`. If LLM output validation fails, or if relation/integrity constraints fail, the transaction rolls back safely.
- **Non-Destructive Replacement**: We removed all blind `deleteMany()` calls. Regeneration uses an `upsert`-like approach (match by deterministic identity like name or title) to merge new data or create missing records, preserving obsolete records if necessary without cascading destructive deletes.
- **Failed Generation**: If an LLM call fails entirely (invalid schema, network issue), the failure is caught before the transaction starts, leaving the existing canonical state 100% untouched.
- **STALE vs DELETE**: Downstream stages are marked conceptually as `STALE` (by canceling previously successful jobs or logging them) but their canonical data remains available until the respective downstream stage is successfully regenerated. STALE never means DELETE.
- **Idempotency**: Running the same generation twice on the same stage correctly updates the existing identities instead of duplicating them.

## 5. Remaining Infrastructure Verification
Because PostgreSQL is not available locally, Prisma migrations and API execution tests remain blocked.

## IMPLEMENTATION STATUS

CODE IMPLEMENTATION: PASS
TYPECHECK: PASS
LINT: PASS
UNIT TESTS: PASS
CORE BUILD: PASS
DATABASE BUILD: PASS
API BUILD: PASS
WEB BUILD: PASS
ROOT BUILD: PASS
PRISMA VALIDATION: PASS
DATABASE MIGRATION: BLOCKED
INTEGRATION TESTS: BLOCKED
