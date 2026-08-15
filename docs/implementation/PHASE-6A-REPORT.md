# PHASE 6A REPORT: Production LLM Infrastructure

## Architecture

The system has successfully migrated from a hardcoded `MockProvider` to a provider-agnostic LLM interface (`ILLMProvider`).

The dependency direction has been corrected so that all internal engine features depend entirely on `@ane/core` contracts instead of specific API implementations.

```text
@ane/core
     ↑
     │ (contracts: ILLMProvider, LLMMessage, LLMError)
     │
@ane/api/services/llm
     ↑
     │ (ProviderFactory)
     │
Architect / Planner / Scene Architect / Prose Engine
```

All API communications now use an array of `LLMMessage` rather than raw prompt strings to robustly support `system`, `user`, and `assistant` contexts natively.

## Provider Implementations

The following providers were successfully implemented in `@ane/api`:

1. **`OpenAIProvider`**: Connects to `api.openai.com` (defaulting to `gpt-4o`). Supports JSON-mode explicitly.
2. **`AnthropicProvider`**: Connects to `api.anthropic.com` (defaulting to `claude-3-5-sonnet-20240620`). Safely extracts system messages for Anthropic's unique parameter structure.
3. **`GoogleProvider`**: Connects to Gemini API (`gemini-1.5-pro-latest`). Formats parts and system instructions natively.
4. **`OllamaProvider`**: Connects to local Ollama daemon (`http://localhost:11434`, defaulting to `llama3`).
5. **`MockProvider`**: Retained for DB-free and E2E deterministic tests, matching Phase 1-5 structural expectations.

## Configuration & Routing

The `ProviderFactory` resolves providers using the following priority order:

1. **Explicit runtime configuration**: Handlers requesting a specific provider/model for a specific job.
2. **Stage-specific environment variables**: E.g., `ARCHITECT_LLM_PROVIDER`, `PROSE_LLM_MODEL`.
3. **Global fallback**: `LLM_PROVIDER` and `MODEL`.
4. **Fallback default**: `MockProvider`.

API keys are never exposed to the frontend or persisted in the database.

## Error Handling & Retry Policy

A unified error handling framework intercepts provider-specific HTTP failures and maps them to `LLMErrorCode`:

- `RATE_LIMITED` (Retryable)
- `AUTHENTICATION_FAILED` (Terminal)
- `INVALID_REQUEST` (Terminal)
- `CONTEXT_LENGTH_EXCEEDED` (Terminal)
- `PROVIDER_UNAVAILABLE` (Retryable)
- `TIMEOUT` (Retryable)
- `INVALID_RESPONSE` (Terminal)

`BaseProvider` uses an exponential backoff loop for retryable errors with a maximum of 3 attempts.

## Structured Generation Guarantee

The `generateStructured<T>` method guarantees valid output matching the requested schema:

1. Text generation is invoked (with JSON mode hint if supported).
2. The response is strictly parsed as JSON (with markdown block stripping).
3. `Zod` validates the resulting object against the target schema.
4. Any failure in parsing or validation throws an `INVALID_RESPONSE` error, guaranteeing downstream handlers receive only `T`.

## Tests & Quality Gates

DB-Free tests were implemented using Vitest in `apps/api/tests/llm.test.ts`.

- ✅ Provider factory resolution
- ✅ Stage-specific routing
- ✅ Missing API key handling
- ✅ Normalized error mapping
- ✅ Retryable vs non-retryable errors
- ✅ Structured JSON parsing
- ✅ Zod validation failure
- ✅ MockProvider compatibility
- ✅ Message array handling

## Remaining DB-Blocked Items

Because PostgreSQL and Docker are currently unavailable in the environment, the following remain blocked:
- Running Prisma migrations to a real DB.
- Integration tests involving DB persistence of generation jobs and novel states.

The infrastructure is otherwise 100% complete and ready for production consumption.
