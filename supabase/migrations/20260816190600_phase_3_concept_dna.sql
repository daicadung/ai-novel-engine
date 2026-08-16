-- Migration: Phase 3 Concept & Story DNA
-- Description: AI pipeline foundations for structured idea generation and similarity checks.

-- Required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. CONCEPT CANDIDATES
CREATE TABLE concept_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
    source_title TEXT NOT NULL,
    candidate_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    premise TEXT NOT NULL,
    genre TEXT,
    setting TEXT,
    protagonist_archetype TEXT,
    theme TEXT,
    conflict TEXT,
    progression_model TEXT,
    power_system TEXT,
    narrative_structure TEXT,
    ending_direction TEXT,
    raw_payload JSONB, -- Raw JSON output from LLM (No system messages or auth tokens!)
    status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'selected', 'rejected', 'modified')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_concept_candidates_owner_id ON concept_candidates(owner_id);
CREATE INDEX idx_concept_candidates_novel_id ON concept_candidates(novel_id);
CREATE INDEX idx_concept_candidates_status ON concept_candidates(status);
CREATE INDEX idx_concept_candidates_source_title ON concept_candidates(source_title);

-- 2. STORY DNA
CREATE TABLE story_dna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
    concept_candidate_id UUID REFERENCES concept_candidates(id) ON DELETE SET NULL,
    dna_version INTEGER NOT NULL DEFAULT 1,
    concept_dna JSONB NOT NULL,
    world_dna JSONB DEFAULT '{}'::jsonb,
    character_dna JSONB DEFAULT '{}'::jsonb,
    power_system_dna JSONB DEFAULT '{}'::jsonb,
    faction_dna JSONB DEFAULT '{}'::jsonb,
    plot_dna JSONB DEFAULT '{}'::jsonb,
    arc_dna JSONB DEFAULT '{}'::jsonb,
    event_dna JSONB DEFAULT '{}'::jsonb,
    ending_dna JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_story_dna_owner_id ON story_dna(owner_id);
CREATE INDEX idx_story_dna_novel_id ON story_dna(novel_id);
CREATE INDEX idx_story_dna_concept_id ON story_dna(concept_candidate_id);
-- Note: Deferred pgvector index creation (HNSW / ivfflat) until scale requires it and pgvector is guaranteed.
-- CREATE INDEX idx_story_dna_embedding ON story_dna USING hnsw (embedding vector_cosine_ops);

-- 3. SIMILARITY RECORDS
CREATE TABLE similarity_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_story_dna_id UUID NOT NULL REFERENCES story_dna(id) ON DELETE CASCADE,
    matched_story_dna_id UUID REFERENCES story_dna(id) ON DELETE SET NULL,
    similarity_score NUMERIC NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('accept', 'modify', 'reject', 'review')),
    reasons JSONB DEFAULT '[]'::jsonb,
    method TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_similarity_records_owner_id ON similarity_records(owner_id);
CREATE INDEX idx_similarity_records_source_dna ON similarity_records(source_story_dna_id);
CREATE INDEX idx_similarity_records_decision ON similarity_records(decision);
CREATE INDEX idx_similarity_records_decision_score ON similarity_records(decision, similarity_score);

-- UPDATED_AT TRIGGERS
CREATE TRIGGER update_concept_candidates_modtime BEFORE UPDATE ON concept_candidates FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_story_dna_modtime BEFORE UPDATE ON story_dna FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE concept_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE similarity_records ENABLE ROW LEVEL SECURITY;

-- concept_candidates Policies
CREATE POLICY "Users can CRUD own concept_candidates" ON concept_candidates
    FOR ALL
    USING (
        owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM novels WHERE novels.id = concept_candidates.novel_id AND novels.owner_id = auth.uid())
    )
    WITH CHECK (
        owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM novels WHERE novels.id = concept_candidates.novel_id AND novels.owner_id = auth.uid())
    );

-- story_dna Policies
CREATE POLICY "Users can CRUD own story_dna" ON story_dna
    FOR ALL
    USING (
        owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM novels WHERE novels.id = story_dna.novel_id AND novels.owner_id = auth.uid())
    )
    WITH CHECK (
        owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM novels WHERE novels.id = story_dna.novel_id AND novels.owner_id = auth.uid())
    );

-- similarity_records Policies
CREATE POLICY "Users can CRUD own similarity_records" ON similarity_records
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());
