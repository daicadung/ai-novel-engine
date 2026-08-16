# MVP Pipeline Integration

## Overview
Added a deterministic title-to-chapters integration package that composes the existing concept, story architect, longform planner, chapter writer types, memory, and continuity contracts.
It also maps the generated result into persistence payloads matching the existing Phase 1 and Phase 3 table contracts.

## Scope
- No database writes.
- No provider SDK calls.
- No new dependencies.
- No dashboard changes.

## Validation
- `packages/mvp-pipeline/src/__tests__/pipeline.test.ts` verifies local package behavior.
- `tests/integration/mvp_pipeline.test.ts` verifies the title-only MVP contract across 50 chapters and asserts persistence payloads for novels, selected concept, DNA, chapter outlines, chapters, and story events.

Status: MVP integration proof complete.
