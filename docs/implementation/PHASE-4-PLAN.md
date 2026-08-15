# Phase 4 Implementation Plan: Chapter & Scene Architect

## Overview
Phase 4 bridges the gap between Long-Term Story Planning and Future Prose Generation by decomposing `ChapterBlueprint`s into a sequence of structured `ScenePlan`s. It introduces a rigorous `ContinuityState` engine, tracking emotional progression, character knowledge, items, and physical locations to prevent logical contradictions and ensure tight narrative cohesion without generating prose.

## Proposed Architecture

### 1. Scene Plan Versioning & Structure
Similar to Phase 3, Scene Architecture is entirely non-destructive and versioned.
- **ScenePlanVersion**: Tracks candidate versions for a given Chapter's scene sequence.
- **Scene**: Contains structured fields for `sceneNumber`, `title`, `purpose`, `povCharacter`, `location`, `time`, `function` (SETUP, CLIMAX, etc.), and `emotionalBeat`. Must include `status: PlanStatus` so STALE scenes do not remain semantically canonical.
- **Stale Semantics**: `isCanonical` is removed in favor of `status: PlanStatus`. Regenerating a Scene Plan marks the old `ScenePlanVersion` and its `Scenes` as `STALE`.

### 2. Continuity Engine
The core of Phase 4 is the Continuity State machine.
- **ContinuitySnapshot**: Immutable representation of the deterministic world state at a chapter boundary (e.g., Snapshot before Chapter 127). Includes lineage pointers: `previousSnapshotId` and `sourceScenePlanVersionId`.
- **StateChange**: Dedicated relational model for explicit deltas (e.g., `CharacterA.location: Capital -> Forest`).
- **Knowledge State Isolation**: Distinguishes Global Story Truth from Character Knowledge State. Characters explicitly track what they *know*, preventing accidental information leaks.

### 3. Continuity Validation
A rigorous `ContinuityValidator` validates every generated candidate against the `ContinuitySnapshot` to detect:
- `previousValue` correctness (source state matches current state).
- Conflicting transitions.
- Ordering correctness.
- Dead characters appearing.
*Invalid plans will be rejected before Transactional Promotion.*

### 4. Database Schema Extensions
```prisma
model ScenePlanVersion {
  id          String   @id @default(cuid())
  chapterId   String
  version     Int
  status      PlanStatus @default(DRAFT)
  scenes      Scene[]
  snapshot    ContinuitySnapshot?
  createdAt   DateTime @default(now())
}

model Scene {
  id                  String   @id @default(cuid())
  scenePlanVersionId  String
  sceneNumber         Int
  status              PlanStatus @default(DRAFT)
  function            String   // SETUP, CONFLICT, etc.
  povCharacter        String?
  location            String?
  time                String?
  objective           String?
  conflict            String?
  obstacle            String?
  escalation          String?
  turningPoint        String?
  outcome             String?
  emotionalBeat       String?
  informationControl  Json?    // REVEALED, WITHHELD
  plotThreads         Json?    // ADVANCE, COMPLICATE
  foreshadowing       Json?
  transitionToNext    String?
  stateChanges        StateChange[]
  // No cascade delete to preserve history
  scenePlanVersion    ScenePlanVersion @relation(fields: [scenePlanVersionId], references: [id])
}

model StateChange {
  id            String   @id @default(cuid())
  sceneId       String
  entityType    String   // CHARACTER, ITEM, LOCATION, etc.
  entityId      String
  property      String
  previousValue String?
  newValue      String
  reason        String?
  createdAt     DateTime @default(now())
  // No cascade delete to preserve history
  scene         Scene    @relation(fields: [sceneId], references: [id])
}

model ContinuitySnapshot {
  id                       String   @id @default(cuid())
  novelId                  String
  chapterNumber            Int
  status                   PlanStatus @default(DRAFT)
  previousSnapshotId       String?
  sourceScenePlanVersionId String?  @unique
  characters               Json?    // includes global vs knowledge isolation
  items                    Json?
  locations                Json?
  factions                 Json?
  plotThreads              Json?
  foreshadowing            Json?
  // No cascade delete to preserve history
  scenePlanVersion         ScenePlanVersion? @relation(fields: [sourceScenePlanVersionId], references: [id])
}
```

### 5. API Endpoints
**`apps/api/src/routes/scene.ts`**
- `POST /api/novels/:novelId/chapters/:chapterId/scenes/generate` (Uses `GenerationJob`)
- `GET /api/novels/:novelId/chapters/:chapterId/scenes`
- `GET /api/novels/:novelId/chapters/:chapterId/continuity`
- `POST /api/novels/:novelId/chapters/:chapterId/scenes/regenerate`
- `GET /api/novels/:novelId/continuity/snapshot/:chapterNumber`

### 6. Context Builders & Adapters
- `SceneContextBuilder`: Selectively queries the `ChapterBlueprint`, `ContinuitySnapshot`, and immediate preceding Scene outcomes. Prevents context bloat.
- Adaptive Scene Count: The LLM/Allocator will decide the number of scenes dynamically based on the blueprint's climax/pacing, without a hardcoded limit.

### 7. Web UI
- A Scene Architect interface allowing users to view the Chapter → Scene Timeline.
- Visual continuity diffs (BEFORE → SCENE CHANGES → AFTER).
- Controls to generate or regenerate scene plans.

## Verification Plan

### Automated Tests (DB-Free)
- **State Transition Correctness:** Validate Before + StateChange = After calculation.
- **PreviousValue Validation:** Ensure state changes don't blindly override unmatched states.
- **Immutable Snapshots:** Lineage tracking and snapshot non-mutation on regeneration.
- **Knowledge-State Isolation:** Global truth vs local character knowledge mapping.
- **Versioning:** Status promotion and STALE propagation logic.

### Quality Gates
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `npx prisma validate`.
- Explicit DB migration and DB integration tests remain blocked as expected.
