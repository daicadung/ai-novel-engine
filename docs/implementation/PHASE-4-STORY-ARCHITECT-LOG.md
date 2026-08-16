# Phase 4: Story Architect Foundation

## 1. Goal
Implement the Architect layer (`packages/story-architect`) capable of generating a structured Story Bible payload from a concept and DNA, parsing it rigorously, and mapping it to Phase 1 existing database core schemas without executing actual persistence logic (deferring IDs and hard FKs to a two-phase resolver).

## 2. Changes Made
- Created `packages/story-architect` workspace package.
- Defined extensive types mapping the AI outputs: `StoryBibleDraft`, `WorldDraft`, `CharacterDraft`, etc.
- Implemented `buildStoryBiblePrompt` to synthesize Concept, Story DNA, and configuration into structured LLM instructions.
- Implemented robust parsing in `parseStoryBibleDraft` validating strict arrays, strings, object shapes, and exact plot thread enums (`PlotThreadStatus`), gracefully returning detailed syntax errors with JSON paths.
- Implemented `mapStoryBibleDraftToPersistence`, transforming hierarchical Drafts into flattened payloads mapped uniquely to Phase 1 tables. Included standard "ponytail comment" indicating lack of FK validation until insertion context.
- Implemented `StoryArchitect` class combining prompts, `LlmGateway`, and parsing into a unified pipeline.
- Implemented zero-dependency `tests/integration/phase4_schema.test.ts` statically asserting that Phase 4 does not invoke migration engines and leaves no prompt literals or tokens behind in compiled schemas.

## 3. Test Results
- `pnpm install`: Workspace resolution passed.
- `pnpm lint`: 0 warnings, 0 errors.
- `pnpm typecheck`: 0 implicit ANYs, strict compilation passed.
- `vitest run`: Passed deterministic architecture simulations through MockAdapter spanning concept ingestion through persistence projection without any network IO.
- `pnpm build`: Completed compilation flawlessly across `config`, `domain`, `llm-gateway`, `concept-engine`, `story-architect`, and `web`.

## 4. Known Limitations & Follow-ups
- **PONYTAIL COMMENT (Two-phase insert resolver)**: We currently defer foreign key relations since DB IDs do not exist prior to actual Supabase/DB invocation. Names are pushed into metadata/reference fields (`location_name_ref`, `parent_name_ref`). Subsequent phases performing actual data writes must pre-insert top-level entities, harvest their UUIDs, map them to children records, and then insert those constraints formally.
- Draft outputs ignore arcs and chapters deliberately to adhere strictly to scope boundaries.

## 5. Remediation (Codex Review)
- Fixed `mapStoryBibleDraftToPersistence` to strictly return ONLY columns defined in the Phase 1 schema.
- Stripped arbitrary `metadata` properties from `character_states`, `items`, and `abilities` because Phase 1 did not define them on those tables.
- Encoded "Name references" (`character_name_ref`, `location_name_ref`) gracefully into existing text columns (`notes`, `state`, `limitations`) with structured string markers, adhering to the standard that UUIDs will be handled downstream.
- Changed the ponytail comment to exactly start with `// ponytail: current ceiling is name-reference payloads only; upgrade path is two-phase insert resolver.`.
- Purged explicit `any` usages from Architect tests and schema check tests (via precise assertions and `unknown` casting).
- Implemented robust key-shape assertions in tests validating that the produced mapper outputs correspond strictly to `novel_id`, `name`, `status`, etc., and no undocumented fields.

## 6. Remediation Pass 2 (Codex Review)
- Upgraded JSONB schema mapping across Architect fields to emit fully structured JSON (objects and arrays) rather than packed strings.
- Upgraded `StoryBibleDraft` interfaces in `src/types.ts` changing `string` to `Record<string, unknown>` (for metadata, styles, rules, states) and `string[]` (for inventories, goals, rules, limitations).
- Adapted `bible.prompt.ts` with updated JSON structure models matching the refined objects and arrays.
- Enhanced `parseStoryBibleDraft` with strict `expectArray`, `expectStringArray`, and widespread `expectObject` enforcement instead of lazy stringification.
- Implemented structured unresolved metadata references by safely extending existing JSONB domains (`items.state = { ...item.state, owner_character_name_ref }` and pushing string refs gracefully into string arrays like `limitations`).

Status: Remediation complete, all strict compilation constraints passing. Ready for review.
