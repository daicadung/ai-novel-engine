# Phase 2 — LLM Gateway Foundation Log

## 1. Prompt History and Requirements
**Task**: Implement Phase 2 - LLM Gateway Foundation for AI Novel Engine.
**Goal**: Create a robust, abstract interface for communicating with various LLM providers without coupling to specific SDKs. Provide cost estimation, retry logic, timeout capabilities, and deterministic mock adapters for tests. Introduce safely-permissioned tracking tables for LLM requests and model configurations. No actual story generation should be hooked up in this phase.

**Requirements**:
1. Add `packages/llm-gateway` and ensure strict typing across `LlmRequest`, `LlmResponse`, `LlmMessage`, `LlmCost`, and `LlmUsage`.
2. Add `supabase/migrations/20260816..._phase_2_llm_gateway.sql` containing `model_configs` and `llm_requests`. RLS must allow global configs without exposing secrets.
3. Build generic adapters for OpenAI and Ollama using standard `fetch`.
4. Build `mock` and `stub` adapters.
5. Create a pure-function cost estimator based on per-million pricing.
6. Create an exponential backoff retry wrapper (`withRetry`) exclusively for transient HTTP error codes (`429, 500, 502, 503, 504`).
7. Thoroughly unit test all components WITHOUT actual network calls. Use dependency injection, mocks, or `globalThis.fetch` overrides.
8. Assert zero leakage of secrets in the database via static tests.

**Constraints**:
- Use `fetch` and `AbortController`. No new SDK dependencies.
- No story generation logic.

## 2. Implementation Steps Taken
- **Database Schema**: Created `supabase/migrations/20260816184600_phase_2_llm_gateway.sql`. Configured strict RLS policies allowing authenticated users to read `owner_id IS NULL` global model configurations, alongside policies enforcing CRUD isolation on user-specific `llm_requests` and `model_configs`.
- **Gateway Core**: Built `packages/llm-gateway/src/core/gateway.ts` utilizing `Map` to route requests by provider identifier dynamically. Injected configuration matching and usage-to-cost conversion directly into the generic `generate()` flow.
- **Cost Engine**: Extracted `estimateCost` into a robust pure function safely handling missing/malformed rate data to return 0 amounts gracefully.
- **Resilience Engine**: Built `withRetry` handling dynamic exponential backoff targeting specifically `LlmGatewayError` classifications tagged with `retryable = true` and applicable `statusCode` variants.
- **Adapters**:
  - `MockAdapter`: Injected highly deterministic responses allowing strict unit testing of upstream consumption.
  - `OpenAiAdapter`: Standardized generic JSON/REST fetch mapping to Chat Completions API.
  - `OllamaAdapter`: Standardized generic JSON/REST fetch mapping to Ollama Chat API.
  - `StubAdapter`: Explicit fail-fast implementations for undefined targets (Anthropic, Gemini, Nine-Router).
- **Test Automation**: Bootstrapped robust tests resolving 22 unique verification conditions, enforcing static schema constraints against `api_key`/`secret` definitions, preventing retry leaks, confirming exact AbortController signal bindings on long-polling fetches, and executing successful generic request traversals via the `LlmGateway`.

## 3. Test Results
- **Install**: `pnpm install` synchronized 5 workspace components smoothly.
- **Lint**: `pnpm -r lint` (Passed - `packages/llm-gateway` and `packages/domain` executed `tsc --noEmit` and `apps/web` executed `eslint` cleanly).
- **Typecheck**: `pnpm -r typecheck` (Passed - fully verified Typescript interfaces).
- **Test**: `vitest run`
  - `mock.test.ts` passed.
  - `gateway.test.ts` passed.
  - `cost.test.ts` passed.
  - `timeout.test.ts` passed (gracefully interrupted simulated long fetch polling via abort signals).
  - `retry.test.ts` passed (accurately bounded loops, identified non-retryable 400s successfully).
  - `phase2_schema.test.ts` passed (successfully enforced negative assertion on schema secrets/api keys).
  - Postgres DB connectivity conditionally skipped existing real-database DB/RLS tests gracefully.
- **Build**: `pnpm -r build` (Passed - successfully compiled `packages/llm-gateway` to CommonJS dist and verified `apps/web` NextJS build).

## 4. Known Limitations & Follow-ups
- Adapters currently serialize and deserialize simple text. Multi-modal payloads and explicit function/tool definitions will require updating interface definitions (`LlmRequest`) during Phase 3 or later.
## 5. Remediation (Codex Review)
Based on review feedback, the following fixes were applied:
1. **Timeout Support**: Added optional `timeoutMs` to `LlmRequest` and implemented internal `AbortController` in both `OpenAiAdapter` and `OllamaAdapter` that safely aborts requests if `timeoutMs` is reached or the external `abortSignal` is triggered. Cleared timers in the `finally` block to prevent leaks.
2. **Timeout Testing**: Updated `timeout.test.ts` to explicitly verify `timeoutMs` abort logic and ensured `globalThis.fetch` is safely restored in `afterEach`.
3. **Safe Logging Metadata**: Added `buildSafeLlmLogMetadata` in `src/core/logging.ts` that safely constructs metadata payload by explicitly mapping fields and ignoring all message/prompt payloads and explicit secrets. Added `logging.test.ts` to prove JSON serializations drop all text content and internal stack traces.
4. **Cleanup**: Removed unused imports (`vi`, `beforeEach`) from `retry.test.ts`.
5. **Gateway Type Safety**: Changed `LlmGateway` constructor from `Record` to `Partial<Record<LlmProvider, LlmProviderAdapter>>` to safely handle unsupported provider stubs without resorting to `as any` casts in `gateway.test.ts`.

Status: Ready for review.
