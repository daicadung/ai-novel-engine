# Phase 1 — Core Domain Foundation Log

## 1. Prompt History and Requirements
**Task**: Implement Phase 1 - Core Domain foundation for AI Novel Engine.
**Goal**: Create the persistent core domain model needed before any LLM/generation work: Novel, Story Bible, World, Character, Faction, Location, Item, Ability, Timeline, Plot Thread, Arc, Chapter. This phase is database/schema/types/tests only. No story generation logic yet.

**Requirements**:
1. Multi-tenant by `owner_id` UUID referencing `auth.users(id)`.
2. Every domain table must have `id` UUID primary key default `gen_random_uuid()`, `created_at`, `updated_at`.
3. RLS must be enabled on all 16 user-owned domain tables.
4. Owner isolation: users can only CRUD rows for novels they own, directly or through parent novel ownership.
5. Provide a new SQL migration `supabase/migrations/20260816..._phase_1_core_domain.sql`.
6. Add `packages/domain` containing TypeScript types only.
7. Add 4 test suites:
   - SQL structure test (no DB required) asserting schema structure.
   - Domain type smoke test asserting exported enums/unions.
   - DB-backed integration test asserting Phase 1 tables exist and RLS is enabled (skipped if no DB).
   - RLS ownership test asserting cross-tenant restrictions between User A and User B (skipped if no DB).

**Constraints**:
- Keep schema normalized.
- Do not overbuild generation jobs or LLM queues.
- No new runtime dependencies for `packages/domain`.
- Do not revert Phase 0 changes.

## 2. Implementation Steps Taken
- **Migration Generation**: Created `20260816183500_phase_1_core_domain.sql` containing 16 core tables: `novels`, `story_bibles`, `worlds`, `locations`, `factions`, `characters`, `character_states`, `items`, `abilities`, `timelines`, `story_events`, `plot_threads`, `arcs`, `sub_arcs`, `chapter_outlines`, `chapters`.
- **Foreign Keys & Indexes**: Configured `owner_id` explicitly for `novels`, while child tables cascade delete off `novel_id`. Configured foreign key indexes appropriately.
- **Row Level Security**: Set up RLS policies explicitly for each of the 16 tables. Direct children (e.g. `characters`, `chapters`) check `EXISTS` on `novels`. Nested children (e.g. `sub_arcs`, `character_states`) use `JOIN novels` to assert ownership traversal.
- **Types**: Added `packages/domain` package configured in `pnpm-workspace.yaml`. Added TypeScript interfaces for all 16 core entities matching the SQL schema precisely.
- **Testing**: Added `tests/integration/phase1_schema.test.ts` (pure static analysis of the migration file regex), `packages/domain/src/__tests__/types.test.ts` (type assertions), `tests/integration/phase1_db.test.ts` (verifying DB schema and RLS enabled map on public schema), and `tests/integration/phase1_rls.test.ts` (verifying isolation rules).
- **Validation**: Ran `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` across the workspace. All commands passed successfully. DB tests correctly skipped because `pg` connection failed gracefully.

## 3. Test Results
- **Lint**: `pnpm -r lint` (Passed)
- **Typecheck**: `pnpm -r typecheck` (Passed)
- **Test**: `vitest run`
  - `phase1_schema.test.ts` passed (static SQL parsing)
  - `types.test.ts` passed
  - `phase1_db.test.ts` skipped gracefully due to missing local Docker database.
  - `phase1_rls.test.ts` skipped gracefully due to missing local Docker database.
- **Build**: `pnpm -r build` (Passed)

## 4. Codex Review Remediation
1. **Missing Indexes**: Added explicit `CREATE INDEX` statements for high-value access patterns (status filtering, orderings, sequence, and foreign keys like `outline_id` and `parent_location_id`) directly to the migration script. Updated `phase1_schema.test.ts` to assert their presence.
2. **Domain Type Smoke Test**: Replaced basic `type` unions with `export const X_STATUSES = [...] as const` arrays, and mapped union types dynamically `(typeof X_STATUSES)[number]`. This allows runtime validation of valid statuses. Updated `types.test.ts` to assert the length, elements of the arrays, and validate typing on a mock fixture.
3. **Packages/Domain Lint**: Added `"lint": "tsc --noEmit"` to `packages/domain/package.json` so the root workspace `pnpm lint` command cascades correctly.

## 5. Known Limitations & Follow-ups
- DB tests skipped visibly due to no DB connection locally.
- RLS nested policy traversals could incur performance costs at massive scale, but are appropriate for Phase 1. If scaling issues arise in future phases, a materialized `owner_id` or view could be applied to deeply nested children.

Status: Ready for review.
