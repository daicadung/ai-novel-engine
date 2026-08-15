# Phase 8 Implementation Plan — Autonomous Novel Generation Pipeline

## Objective

Transform the AI Novel Engine from a manually-triggered generation tool into an autonomous, progressive novel-generation system capable of producing 1000+ chapter novels without manual intervention per chapter.

## Architecture

The Phase 8 orchestration layer sits atop the existing Phase 1–7.5 infrastructure:

```
POST /api/novels/:id/generation/start
        ↓
NovelGenerationOrchestrator
        ↓
GenerationStageResolver (DB inspection, no mutations)
        ↓
DatabaseQueueManager → GenerationJob (idempotencyKey @unique)
        ↓
Vercel Cron → ServerlessJobProcessor (existing)
        ↓
JobDispatcher → ArchitectManager / StoryPlannerManager / SceneManager / ProseManager
        ↓
ILLMProvider → NineRouter → LLM
```

## Key Design Decisions

1. **No new worker** — `ServerlessJobProcessor` unchanged as sole executor
2. **No new queue** — `DatabaseQueueManager` unchanged as sole job store
3. **No new LLM abstraction** — `ILLMProvider` / `NineRouterProvider` unchanged
4. **AutoContinue** — implemented inside `ServerlessJobProcessor` success path (not a loop)
5. **Idempotency** — `GenerationJob.idempotencyKey @unique` at DB level + app-level pre-check
6. **Windowing** — `generationWindowSize × chapterBatchSize` chapters prepared per advance
