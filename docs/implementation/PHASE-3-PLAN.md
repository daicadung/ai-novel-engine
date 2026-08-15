# Phase 3 Implementation Plan: Long-Term Story Planner

## Overview
The Long-Term Story Planner progressively transforms a canonical Story Bible into a scalable, hierarchical story plan (Destination → Macro → Saga → Arc → MiniArc → ChapterBlueprint) capable of supporting 1000+ chapters. It uses bounded contexts, structural versioning, non-destructive regeneration, and rigorous range validation to ensure robust planning without prose generation.

## Proposed Architecture

### 1. Story Plan Versioning & Separation
Planning artifacts are explicitly separated from canonical runtime state where practical.
- **Root Entity:** `StoryPlan` (1:1 with `Novel`).
- **Version Entity:** `StoryPlanVersion` tracks `v1`, `v2`, etc. It acts as the root for `StoryDestination`, `MacroPlan`, `Sagas`, `CharacterArcs`, and `ChapterPlanningBatches`.
- **Versioning Strategy:** Old planning artifacts are never destroyed. They are kept under their historical `StoryPlanVersion`.

### 2. Planning Artifacts vs Canonical Entities
- **Canonical:** `Arc`, `Chapter` (extended with foreign keys to their planner parents).
- **Planning Artifacts:** `ChapterBlueprint` (holds all chapter planning data: POV, setup, progression, consequences), `Saga`, `MiniArc`.
- **CharacterArc:** A 1:N relationship from `Character`. Belongs to `StoryPlanVersion`. Tracks `currentState`, `nextMilestone`, `emotionalProgression`, `status`.

### 3. Hierarchy & Stale Semantics
Every planning artifact (`Saga`, `MiniArc`, `ChapterBlueprint`) uses an explicit status enum (`DRAFT`, `CANONICAL`, `STALE`).
- **STALE:** Indicates a previously valid artifact whose upstream assumptions changed (e.g., its parent Saga was regenerated). STALE artifacts are preserved.
- **Regeneration Flow:** Generate Candidate → Validate (Zod & Domain) → Transactional Promote → Mark old dependents STALE (never cascade delete).

### 4. Chapter Range Integrity & Allocation
- `ChapterRangeAllocator` allocates non-overlapping ranges (Sagas, Arcs, MiniArcs).
- Uses narrative weights to scale appropriately.
- **Subtree Regeneration:** Regenerating Saga 3 preserves the ranges of Sagas 1, 2, 4, 5 (unless global rebalancing is explicitly requested).

### 5. Progressive Planning & Chapter Batches
- Complete 1000-chapter plans are not required up-front.
- **Partial States:** Destination only → Macro → Saga 1 → Arc 1 → MiniArc 1 → Chapters 1-10.
- **ChapterPlanningBatch:** Groups chunked generations (e.g., 10 chapters). Tracks `batchNumber`, `chapterRange`, and `status`.

### 6. Context Builders & Limits
- `StoryContextBuilder`, `SagaContextBuilder`, `ArcContextBuilder`, `ChapterContextBuilder`.
- Explicitly queries only *relevant* factions, plot threads, and foreshadowing for the specific narrative scope. 
- Enforces strict deterministic context limits to ensure scalable LLM usage.

### 7. Consequence Graph
- A `Consequence` model tracking turning points.
- Structured polymorphic references (`targetId`, `targetType`) linking to `Character`, `Faction`, `PlotThread`, `Relationship`, or `Location`.

### 8. Database Schema Updates
```prisma
// New Planning Root
model StoryPlan { ... }
model StoryPlanVersion { ... }

// New Planning Artifacts (Versioned)
model StoryDestination { ... }
model MacroPlan { ... }
model Saga { ... status (CANONICAL/STALE) }
model MiniArc { ... status (CANONICAL/STALE) }
model ChapterBlueprint { ... status, povCharacter, hooks, consequences }
model ChapterPlanningBatch { ... }
model CharacterArc { ... startingState, targetState, milestones }
model Consequence { ... targetId, targetType, description }

// Extended Canonical Entities
// Arc: add `sagaId`
// Chapter: add `miniArcId`, `chapterBlueprintId`
```

### 9. API & Services
**`StoryPlannerManager`** handles:
- Candidate generation via `LLMProvider` (or `MockProvider`).
- Zod & Domain validation (continuity, reference existence, range overlap checks).
- Transactional Promotion (upserting canonical links and marking old artifacts STALE).

**Endpoints (`/api/novels/:novelId/planner/*`)**:
- `/status`, `/versions`, `/regenerate`
- `/destination`, `/macro`, `/sagas`, `/sagas/:sagaId/arcs`, `/arcs/:arcId/mini-arcs`, `/mini-arcs/:miniArcId/chapters` (batch).

## Verification Plan

### Automated DB-Free Tests
- **ChapterRangeAllocator:** Stable ranges, non-overlapping math, subtree isolation.
- **Context Builders:** Payload boundaries and explicit relevance filtering.
- **Validation:** Consequence propagation, Hierarchy validation, STALE state handling logic, idempotency.

### Manual Verification & Quality Gates
- `pnpm prisma validate` to confirm schema integrity.
- Run all static checks (`lint`, `typecheck`, `test`, `build`).
- Inspect the Next.js Story Planner UI rendering the progressive hierarchy and version history.
