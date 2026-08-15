# Phase 5 Implementation Plan: Prose Generation Engine

## Overview
Phase 5 introduces the Prose Generation Engine, transforming canonical Scene Architecture (Phase 4) into actual novel prose. Driven by rigorous structural and continuity boundaries established in earlier phases, the engine generates prose scene-by-scene. It enforces strict context limits, knowledge boundaries (Global Truth vs. POV Knowledge), and a robust validation-revision cycle before any text is promoted to canonical state.

## Proposed Architecture

### 1. Lineage & Invariants
Prose generation is firmly downstream of scene planning and continuity state. The complete lineage is:

```text
ChapterBlueprint
    ↓
ScenePlanVersion (Phase 4)
    ↓
ContinuitySnapshot (Phase 4)
    ↓
ChapterProseVersion (Phase 5)
    ↓
SceneProse (Phase 5)
```

**Cross-Version Contamination Invariants:**
- `SceneProse` MUST NOT reference a `Scene` belonging to a different `ScenePlanVersion`. Domain validation and explicit relational lineage strictly enforce this boundary.
- `ChapterProse.currentVersionId` is heavily protected: it can ONLY point to a `CANONICAL` `ChapterProseVersion` and may only be updated atomically during a transactional canonical promotion.
- Prose generation MUST NEVER mutate or invent canonical continuity state. Continuity `StateChange`s originate strictly from Phase 4 and are consumed by Phase 5 exclusively as immutable constraints.

### 2. Prose Artifact Model & Versioning
Prose artifacts use a dedicated `ProseStatus` enum to preserve historical generations, revisions, and human edits non-destructively.
- **ChapterProse**: The root container for a chapter's prose.
- **ChapterProseVersion**: Represents a candidate version of the chapter's prose, explicitly linked to a source `ScenePlanVersion`.
- **SceneProse**: Contains the actual text bound to a specific `Scene`.
- **ProseStatus Enum**: `DRAFT`, `CANONICAL`, `STALE`, `REJECTED`, `HUMAN_EDITED`. (Distinct from `PlanStatus`).
- **Human Edits**: Modifying prose triggers the creation of a brand new immutable version marked `HUMAN_EDITED`. Historical prose content is NEVER mutated.

### 3. Prose Generation Pipeline
1. **Context Building**: Extract bounded `ScenePlan`, `ContinuitySnapshot`, and explicit `KnowledgeState` filters.
2. **Draft Generation**: Invoke LLM (`MockProvider`).
3. **Prose Validation**: Validated against a strict structured `ValidationReport` schema (not arbitrary JSON). Checks POV consistency, continuity invariants, and stylistic goals.
4. **Revision Engine**: Targeted repair using explicit limits: separate maximums for scene-level generation attempts vs. revision attempts, and chapter-level limits.
5. **Chapter Assembly**: Ordered concatenation and Chapter-Level validation.
6. **Canonical Promotion**: Transactional promotion of the verified `ChapterProseVersion` to `currentVersionId`.

### 4. Dependency-Aware STALE Propagation
When an isolated scene (e.g., Scene 4) is regenerated, downstream propagation of `STALE` or `NEEDS_REVIEW` statuses is strictly **dependency-aware**. Only downstream scenes that materially rely on the outcomes or state transitions of Scene 4 are marked invalid, rather than blindly invalidating every subsequent scene in the chapter.

### 5. Database Schema Extensions
```prisma
enum ProseStatus {
  DRAFT
  CANONICAL
  STALE
  REJECTED
  HUMAN_EDITED
}

model ChapterProse {
  id                 String                @id @default(cuid())
  chapterId          String                @unique
  currentVersionId   String?               // Protected pointer
  versions           ChapterProseVersion[]
  chapter            Chapter               @relation(fields: [chapterId], references: [id])
}

model ChapterProseVersion {
  id                    String         @id @default(cuid())
  chapterProseId        String
  sourceScenePlanVersionId String      // Explicit lineage
  version               Int
  status                ProseStatus    @default(DRAFT)
  generatedAt           DateTime       @default(now())
  provider              String?
  model                 String?
  tokenMetadata         Json?
  
  sceneProseList        SceneProse[]
  chapterProse          ChapterProse   @relation(fields: [chapterProseId], references: [id])
  sourceScenePlanVersion ScenePlanVersion @relation(fields: [sourceScenePlanVersionId], references: [id])
}

model SceneProse {
  id                    String              @id @default(cuid())
  chapterProseVersionId String
  scenePlanId           String
  content               String
  wordCount             Int                 @default(0)
  status                ProseStatus         @default(DRAFT)
  validationReport      Json?               // Typed ValidationReport schema
  generationMetadata    Json?
  
  chapterProseVersion   ChapterProseVersion @relation(fields: [chapterProseVersionId], references: [id])
  scene                 Scene               @relation(fields: [scenePlanId], references: [id])
}
```

### 6. API Endpoints
**`apps/api/src/routes/prose.ts`**
- `POST /api/novels/:novelId/chapters/:chapterId/prose/generate`
- `POST /api/novels/:novelId/chapters/:chapterId/prose/regenerate`
- `POST /api/novels/:novelId/chapters/:chapterId/scenes/:sceneId/prose/generate`
- `GET /api/novels/:novelId/chapters/:chapterId/prose`
- `GET /api/novels/:novelId/chapters/:chapterId/prose/versions`

### 7. Cost Control
Configurable limits explicitly separate generation attempts from revision attempts, and define limits at both the scene level and chapter level.

## Verification Plan

### DB-Free Unit Tests
- **Cross-Version Rejection**: Ensure `SceneProse` cannot attach to a `Scene` from a mismatched `ScenePlanVersion`.
- **Canonical Pointer Protection**: Ensure `ChapterProse.currentVersionId` only accepts `CANONICAL` variants and correctly swaps during transactions.
- **Immutable Human Edits**: Verify that modifying text creates a new version instead of updating history.
- **Validation Report**: Enforce the structured `ValidationReport` schema formatting.
- **Retry/Generation Limits**: Test scene and chapter-level limits for revision and generation loops.
- **Dependency-Aware STALE**: Validate that regeneration correctly flags dependent downstream scenes.
- **Read-Only Continuity**: Verify that prose generation cannot produce new Continuity `StateChange` records.

### Quality Gates
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `npx prisma validate`.
- Explicit DB migration and DB integration tests remain blocked as expected.
