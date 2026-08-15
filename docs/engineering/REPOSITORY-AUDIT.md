# Repository Audit: AI Novel Engine

## Architecture Overview
The system is built as a TypeScript monorepo using pnpm workspaces.
It consists of two main applications and two shared packages:
- **Apps**:
  - `api`: A Fastify-based backend service.
  - `web`: A Next.js (v15) frontend application.
- **Packages**:
  - `core`: Shared domain logic and types.
  - `database`: Prisma ORM integration wrapping a PostgreSQL database with pgvector, along with Redis for caching/queues.

## Repository Structure
```
.
├── apps
│   ├── api          # Fastify backend
│   └── web          # Next.js frontend
├── packages
│   ├── core         # Shared types and logic
│   └── database     # Prisma schema and generated client
├── docker-compose.yml # Infrastructure (Postgres + Redis)
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

## Dependency Map
- `@ane/api` depends on `@ane/database`, `fastify`, `ioredis`.
- `@ane/web` depends on `next`, `react`, `react-dom`.
- `@ane/database` depends on `@prisma/client`.
- `@ane/core` currently has no external dependencies.

## Database Model Map
The current Prisma schema defines the following entities:
- **Novel**: The core entity representing a story.
- **StoryBible**: Versioned world-building and rules for a novel.
- **Character**: Characters belonging to a novel.
- **Arc**: Story arcs containing multiple chapters.
- **Chapter**: Individual chapters with planning and generated content.
- **PlotThread**: Long-running plotlines.
- **Foreshadowing**: Setup and payoff tracking.
- **GenerationJob**: Tracks async AI generation tasks.
- **Memory**: Vector-ready memory store for RAG (Retrieval-Augmented Generation).

## API Map
Currently, the API is extremely minimal.
- `GET /health`: Returns service health (database and redis status).
- `GET /api`: Returns basic API info (name and version).

## Current Implementation Status
**Phase 0 Status: Partially Complete.**
- The monorepo structure is set up.
- Docker infrastructure (Postgres + Redis) is configured.
- The Prisma schema is well-defined for the domain.
- **Missing:**
  - The API has no business routes (CRUD operations for models are missing).
  - The Web frontend has no UI components or integration with the API.
  - The `core` package only exports two basic types (`NovelStatus`, `ChapterStatus`) and lacks business logic.

## Problems Found & Technical Inconsistencies
1. **Missing pgvector configuration in Prisma:** The `docker-compose.yml` uses `pgvector/pgvector:pg17`, but the `Memory` model in Prisma does not utilize the `Unsupported("vector")` type for embeddings. It currently just stores `content` as a string and lacks vector fields.
2. **Duplication of Types:** Enums like `NovelStatus` and `ChapterStatus` exist in Prisma schema but are also manually duplicated as union types in `packages/core/src/index.ts`. This should be unified to use Prisma's generated types or properly synced.
3. **API Organization:** `apps/api/src/server.ts` contains all route definitions. There is no controller or routing architecture set up for scalability.

## Recommended Corrections
- Enable the `postgresqlExtensions` preview feature in Prisma to properly support `pgvector`.
- Add an `embedding` field to the `Memory` model to support semantic search.
- Clean up `packages/core` to re-export Prisma generated types rather than hardcoding string unions.
- Scaffold a proper routing structure in `apps/api` (e.g., using Fastify plugins or a controller pattern).

## Phase 1 Implementation Plan
Phase 1 should focus on establishing the core CRUD operations and basic engine loop:
1. **API Routing & Controllers**: Set up modular routing in the `api` app.
2. **Core CRUD Endpoints**: Implement endpoints for creating and managing `Novel`, `Character`, `StoryBible`, and `Arc`.
3. **Database Updates**: Fix the `Memory` model to include vector embeddings.
4. **LLM Integration Setup**: Create service classes in the `api` to communicate with LLM providers (OpenAI/Anthropic).
5. **Basic Web UI**: Create the initial Next.js dashboard to create and view Novels.
