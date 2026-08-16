# Phase 7 - Memory + Continuity Foundation

## Overview
Implemented the deterministic post-chapter quality and state layer. This includes Memory Extractor (with deterministic hints extraction), State Mapper to Phase 1 shapes, Continuity Checker (rule-based validation), and Repair Prompt Builder.

## Scope & Constraints Adhered To
- **0 DB Writes / Migrations**: The `StateMapper` builds valid payloads mapped against `character_states`, `items`, `plot_threads`, and `story_events` but returns them for higher-level orchestrators to persist later.
- **0 Autonomous Repair Loops**: `RepairPromptBuilder` constructs an LLM prompt string containing the continuity issues and original chapter prose. It does not invoke the LLM to rewrite.
- **0 Direct Fetch / SDK calls**: The `MemoryExtractor` strictly uses the `LlmGateway` abstraction from Phase 2.
- **Naïve State Resolution**: The `StateMapper` uses string identifiers (`character_name`, `item_name`, etc.) for foreign keys (`notes`/`metadata`), with a designated ponytail comment indicating a future DB resolver transaction requirement for strict UUID lookup.

## Tests Completed
- `memory.parser.test.ts`: Rejects markdown and invalid formats; ensures correct array structures.
- `hints.test.ts`: Verifies seeds are safely extracted from `ChapterDraft`.
- `state.mapper.test.ts`: Ensures output shape exactly matches Phase 1 partial definitions.
- `checker.test.ts`: Validates rule triggers (minor for draft risks, major for plot thread reopening, critical for destroyed item usage or dead character action).
- `repair.prompt.test.ts`: Prompt formatting test, ensuring issue descriptions are bundled with original content.
- `extractor.test.ts`: Orchestrates complete extraction using `MockAdapter`.
- `phase7_schema.test.ts`: Enforces system restrictions (no migrations, no DB client usage, no `fetch`/SDK).

## Commands Run & Validation
```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm typecheck
```

Status: Phase 7 execution complete.
