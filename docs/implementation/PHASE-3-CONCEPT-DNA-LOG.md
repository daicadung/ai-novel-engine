# Phase 3 — Concept + Story DNA Foundation Log

## 1. Prompt History and Requirements
**Task**: Implement Phase 3 - Concept + Story DNA foundation.
**Goal**: Create the first non-writing AI pipeline that generates multiple concept candidates from a title, extracts structured Story DNA from those concepts, and assesses similarity against existing DNA records. All interaction with LLMs must occur strictly via the Phase 2 `llm-gateway`.

**Requirements**:
1. Migration `*_phase_3_concept_dna.sql` introducing `concept_candidates`, `story_dna`, and `similarity_records` tables with strict RLS enforcement.
2. Enable `vector` extension but defer actual HNSW/ivfflat index creation.
3. Package `packages/concept-engine` featuring:
   - Strong TypeScript typing (`ConceptCandidate`, `StoryDna`, `SimilarityDecision`).
   - Pure prompt builder functions.
   - Resilient, pure-function parsers validating structural LLM output natively.
   - `ConceptEngine` orchestration leveraging the `llm-gateway` abstraction natively.
4. Comprehensive offline mock tests assuring logic validation without executing external HTTP requests.
5. Integration test `tests/integration/phase3_schema.test.ts` statically verifying schema sanity.

**Constraints**:
- Keep prompt content strictly unlogged (via Phase 2 safe logging constructs or inherent design).
- No actual chapter writing, story bibles, arcs, or autonomous generation cycles implemented.
- `vitest run` must succeed without real internet access.

## 2. Implementation Steps Taken
- **Database Schema**: Authored and deployed `20260816190600_phase_3_concept_dna.sql`. Safely loaded the `vector` operator class, created the `vector(1536)` column for future DNA search capabilities, deferred its index, and constructed robust UUID references aligning strictly with `auth.users(id)` and `novels(id)`.
- **Pure Prompts & Parsers**: 
  - Designed `buildConceptGenerationPrompt` and `buildStoryDnaPrompt` strictly formatting desired output structure.
  - Implemented `parseConceptCandidates` and `parseStoryDna`, incorporating markdown block strippers (`\`\`\`json`) to counter overly helpful LLM wrapper tendencies, alongside stringent Object/Array typings validating field signatures securely without relying on `eval`.
- **Concept Engine**: Constructed `ConceptEngine` class, bridging `LlmGateway` and the parser components together. Exposes safe `generateConcepts` and `extractStoryDna` methods relying on strict temperature controls (`0.8` for ideation, `0.1` for extraction).
- **Similarity Core**: Developed a pure function `decideSimilarity(score, thresholds)` implementing clear thresholds classifying similarity as Accept (<0.30), Review (0.30 - 0.60), and Reject (>0.60).
- **Offline Reliability Testing**: Deployed exhaustive offline testing targeting parsing faults, missing fields, boundary scores, schema structures, and deterministic MockAdapter data streams.

## 3. Test Results
- **Install**: `pnpm install` synchronized all 6 workspace packages successfully.
- **Lint**: `pnpm -r lint` (Passed).
- **Typecheck**: `pnpm -r typecheck` (Passed - required patching string literal quotes for JSON mock payloads).
- **Test**: `vitest run` (Passed - executed 45 integration & unit tests, completely skipping network requirements for Phase 3 functionality).
  - `concept.parser.test.ts`: Passed (successfully stripped markdown wraps and caught invalid formats).
  - `dna.parser.test.ts`: Passed.
  - `similarity.test.ts`: Passed.
  - `engine.test.ts`: Passed.
  - `phase3_schema.test.ts`: Passed (statically validated structural integrity of migration constraints).
- **Build**: `pnpm -r build` (Passed - successfully compiled `packages/concept-engine` to CommonJS dist alongside full next build).

## 4. Known Limitations & Follow-ups
- Default similarity thresholds currently treat generic values statically. We may want to load threshold boundaries from `model_configs` or environment configurations directly in subsequent phases.
- `story_dna` `embedding` index creation is entirely deferred until vector search limits necessitate dedicated HNSW operations.

## 5. Remediation (Codex Review)
Based on review feedback, the following fixes were applied:
1. **Story DNA Type Safety & Parser Strictness**: Updated `StoryDna` interface to strictly require all 9 layers (e.g., `world_dna`, `character_dna`). Re-engineered `parseStoryDna` to iterate through these layers, employing robust `isPlainObject` type guards asserting they are non-null objects and strictly rejecting `Array` or `null` derivations. Added unit tests for missing, null, and array permutations.
2. **Eliminated `any` in Concept Parser**: Refactored `parseConceptCandidates` to use `unknown` accompanied by custom type guards. `rawPayload` is formally typed as `unknown` locally.
3. **Eliminated `any` in DNA Parser**: Similarly refactored `parseStoryDna`, migrating internal constructs entirely from `any` to `unknown` and applying robust validation casting.
4. **Migration Index Coverage**: Explicitly added `idx_similarity_records_decision_score` on `(decision, similarity_score)`. Validated index presence via `phase3_schema.test.ts`.
5. **RLS Child Access Governance**: Redefined RLS `USING` and `WITH CHECK` clauses for `concept_candidates` and `story_dna` to encompass an `EXISTS` check asserting child access when attached to `novels` matching the `owner_id`. Verified this logic syntactically via regex in tests.
6. **SQL CHECK Constraints**: Bolstered data integrity by appending explicit `CHECK (status IN ('generated', ...))` for Concepts and `CHECK (decision IN ('accept', ...))` for Similarity records directly within the schema definition.
7. **Comprehensive Static Secrets Test**: Enhanced `phase3_schema.test.ts` to scan strictly against literal occurrences of `prompt`, `prompt_text`, `api_key`, `secret`, `access_token`, ensuring absolute schema sterility.
8. **E2E Deterministic Tests**: Consolidated isolated Engine tests into a unified, deterministic pipeline test within `engine.test.ts`. Leveraging multiple bounded inputs on the `MockAdapter`, the test asserts fetching concepts and subsequently mapping the initial concept directly into full DNA extraction seamlessly.

Status: Ready for review.
