# Phase 1 Implementation Plan: Story Core

## Overview
This phase focuses on establishing a stable, testable Story Core foundation for the AI Novel Engine. We will build the canonical domain models, refactor the Fastify API into a scalable modular architecture (routes, services, schemas), and implement a minimal Next.js web dashboard. LLM generation is strictly excluded from this phase.

## 1. Architecture Refactoring (API)
We will restructure the Fastify backend:
```
apps/api/src/
  ├── server.ts
  ├── plugins/       # cors.ts, database.ts, redis.ts
  ├── routes/        # novels.ts, characters.ts, arcs.ts, etc.
  ├── services/      # novel.service.ts, character.service.ts, etc. (Business Logic)
  ├── schemas/       # Zod validation schemas
  └── errors/        # Standardized error handling
```

## 2. Database (Prisma Schema Updates)
We will preserve existing models and add the missing entities required for Phase 1:
- **Location, Item, Faction**: World entities linked to a Novel.
- **Relationship**: Connects Characters, Factions, Locations, Items.
- **Event**: Chronological story events.
- **Memory**: Base RAG foundation (without complex vector search yet).
- **CharacterState**: Foundation added to Character model for future transitions.

## 3. Core Package
- Remove duplicated enums (e.g. `NovelStatus`, `ChapterStatus`) from `@ane/core` and instead re-export them from the generated Prisma client to ensure a single source of truth.

## 4. Web Application (Dashboard)
We will build a minimal Next.js dashboard supporting:
1. View all novels
2. Create novel
3. View basic Story Bible, Characters, Arcs, and Chapters for a selected novel.

## 5. Testing & Validation
- **Validation**: All API inputs will be validated using Zod. We will return consistent error structures (e.g., `VALIDATION_ERROR`).
- **Testing**: We will write Vitest integration tests for all CRUD operations, database constraints, and error scenarios.

## Execution Quality Gate
Before completing this phase, we will successfully run:
- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `npx prisma validate`
- `pnpm db:migrate`
