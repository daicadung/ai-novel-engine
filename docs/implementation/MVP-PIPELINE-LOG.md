# MVP Pipeline Integration

## Overview
Added a deterministic title-to-chapters integration package that composes the existing concept, story architect, longform planner, chapter writer types, memory, and continuity contracts.

## Scope
- No database writes.
- No provider SDK calls.
- No new dependencies.
- No dashboard changes.

## Validation
- `packages/mvp-pipeline/src/__tests__/pipeline.test.ts` verifies local package behavior.
- `tests/integration/mvp_pipeline.test.ts` verifies the title-only MVP contract across 10 chapters.

Status: MVP integration proof complete.
