-- Migration: Phase 1 Core Domain Foundation
-- Description: Core schema, types, tables and RLS for Novel Engine

-- Custom Types for constraints/clarity
CREATE TYPE novel_status AS ENUM ('draft', 'planning', 'active', 'paused', 'completed', 'archived');
CREATE TYPE plot_thread_status AS ENUM ('open', 'active', 'resolved', 'dropped');
CREATE TYPE arc_status AS ENUM ('planned', 'active', 'completed');
CREATE TYPE chapter_outline_status AS ENUM ('planned', 'approved', 'used');
CREATE TYPE chapter_status AS ENUM ('draft', 'checking', 'approved', 'published', 'failed');

-- 1. NOVELS
CREATE TABLE novels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT,
    status novel_status NOT NULL DEFAULT 'draft',
    language TEXT NOT NULL DEFAULT 'vi',
    target_chapter_count INTEGER,
    target_chapter_length INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_novels_owner_id ON novels(owner_id);

-- 2. STORY BIBLES
CREATE TABLE story_bibles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL UNIQUE REFERENCES novels(id) ON DELETE CASCADE,
    premise TEXT,
    genre TEXT,
    tone TEXT,
    style_guide JSONB DEFAULT '{}'::jsonb,
    rules JSONB DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. WORLDS
CREATE TABLE worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL UNIQUE REFERENCES novels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rules JSONB DEFAULT '{}'::jsonb,
    history JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. LOCATIONS
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    parent_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    kind TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_novel_id ON locations(novel_id);

-- 5. FACTIONS
CREATE TABLE factions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT,
    description TEXT,
    goals JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_factions_novel_id ON factions(novel_id);

-- 6. CHARACTERS
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    description TEXT,
    personality JSONB DEFAULT '{}'::jsonb,
    goals JSONB DEFAULT '[]'::jsonb,
    secrets JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_characters_novel_id ON characters(novel_id);

-- 7. CHARACTER STATES
CREATE TABLE character_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    chapter_number INTEGER,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    status TEXT,
    power_state JSONB DEFAULT '{}'::jsonb,
    inventory JSONB DEFAULT '[]'::jsonb,
    relationships JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_character_states_character_id ON character_states(character_id);

-- 8. ITEMS
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    owner_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    kind TEXT,
    description TEXT,
    state JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_novel_id ON items(novel_id);

-- 9. ABILITIES
CREATE TABLE abilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    kind TEXT,
    description TEXT,
    rules JSONB DEFAULT '[]'::jsonb,
    limitations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_abilities_novel_id ON abilities(novel_id);

-- 10. TIMELINES
CREATE TABLE timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timelines_novel_id ON timelines(novel_id);

-- 11. STORY EVENTS
CREATE TABLE story_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    timeline_id UUID REFERENCES timelines(id) ON DELETE SET NULL,
    chapter_number INTEGER,
    sequence_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_story_events_novel_id ON story_events(novel_id);

-- 12. PLOT THREADS
CREATE TABLE plot_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status plot_thread_status NOT NULL DEFAULT 'open',
    priority INTEGER DEFAULT 0,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plot_threads_novel_id ON plot_threads(novel_id);

-- 13. ARCS
CREATE TABLE arcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    arc_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    purpose TEXT,
    status arc_status NOT NULL DEFAULT 'planned',
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(novel_id, arc_number)
);

CREATE INDEX idx_arcs_novel_id ON arcs(novel_id);

-- 14. SUB ARCS
CREATE TABLE sub_arcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arc_id UUID NOT NULL REFERENCES arcs(id) ON DELETE CASCADE,
    sub_arc_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    purpose TEXT,
    status arc_status NOT NULL DEFAULT 'planned',
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(arc_id, sub_arc_number)
);

CREATE INDEX idx_sub_arcs_arc_id ON sub_arcs(arc_id);

-- 15. CHAPTER OUTLINES
CREATE TABLE chapter_outlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    arc_id UUID REFERENCES arcs(id) ON DELETE SET NULL,
    sub_arc_id UUID REFERENCES sub_arcs(id) ON DELETE SET NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT,
    purpose TEXT,
    outline JSONB DEFAULT '{}'::jsonb,
    status chapter_outline_status NOT NULL DEFAULT 'planned',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(novel_id, chapter_number)
);

CREATE INDEX idx_chapter_outlines_novel_id ON chapter_outlines(novel_id);

-- 16. CHAPTERS
CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    outline_id UUID UNIQUE REFERENCES chapter_outlines(id) ON DELETE SET NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    summary TEXT,
    status chapter_status NOT NULL DEFAULT 'draft',
    word_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(novel_id, chapter_number)
);

CREATE INDEX idx_chapters_novel_id ON chapters(novel_id);

-- Explicit additional indexes requested
CREATE INDEX idx_novels_status ON novels(status);
CREATE INDEX idx_novels_owner_id_status ON novels(owner_id, status);
CREATE INDEX idx_story_bibles_novel_id ON story_bibles(novel_id);
CREATE INDEX idx_worlds_novel_id ON worlds(novel_id);
CREATE INDEX idx_locations_parent_location_id ON locations(parent_location_id);
CREATE INDEX idx_character_states_location_id ON character_states(location_id);
CREATE INDEX idx_character_states_char_chap ON character_states(character_id, chapter_number);
CREATE INDEX idx_items_owner_character_id ON items(owner_character_id);
CREATE INDEX idx_items_location_id ON items(location_id);
CREATE INDEX idx_abilities_character_id ON abilities(character_id);
CREATE INDEX idx_story_events_timeline_id ON story_events(timeline_id);
CREATE INDEX idx_story_events_nov_chap ON story_events(novel_id, chapter_number);
CREATE INDEX idx_story_events_nov_seq ON story_events(novel_id, sequence_number);
CREATE INDEX idx_plot_threads_nov_status ON plot_threads(novel_id, status);
CREATE INDEX idx_arcs_nov_status ON arcs(novel_id, status);
CREATE INDEX idx_arcs_nov_arc_num ON arcs(novel_id, arc_number);
CREATE INDEX idx_sub_arcs_arc_status ON sub_arcs(arc_id, status);
CREATE INDEX idx_chapter_outlines_nov_status ON chapter_outlines(novel_id, status);
CREATE INDEX idx_chapter_outlines_nov_chap ON chapter_outlines(novel_id, chapter_number);
CREATE INDEX idx_chapters_nov_status ON chapters(novel_id, status);
CREATE INDEX idx_chapters_nov_chap ON chapters(novel_id, chapter_number);
CREATE INDEX idx_chapters_outline_id ON chapters(outline_id);


-- UPDATED_AT TRIGGERS
-- Assume the trigger function `moddatetime` exists (pgcrypto/moddatetime) or we use a basic custom trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_novels_modtime BEFORE UPDATE ON novels FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_story_bibles_modtime BEFORE UPDATE ON story_bibles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_worlds_modtime BEFORE UPDATE ON worlds FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_locations_modtime BEFORE UPDATE ON locations FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_factions_modtime BEFORE UPDATE ON factions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_characters_modtime BEFORE UPDATE ON characters FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_character_states_modtime BEFORE UPDATE ON character_states FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_items_modtime BEFORE UPDATE ON items FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_abilities_modtime BEFORE UPDATE ON abilities FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_timelines_modtime BEFORE UPDATE ON timelines FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_story_events_modtime BEFORE UPDATE ON story_events FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_plot_threads_modtime BEFORE UPDATE ON plot_threads FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_arcs_modtime BEFORE UPDATE ON arcs FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_sub_arcs_modtime BEFORE UPDATE ON sub_arcs FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_chapter_outlines_modtime BEFORE UPDATE ON chapter_outlines FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_chapters_modtime BEFORE UPDATE ON chapters FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- ROW LEVEL SECURITY (RLS)
ALTER TABLE novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_bibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE abilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE plot_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

-- Novels Policy
CREATE POLICY "Users can CRUD own novels" ON novels
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Level 1 Children Policies (Direct Novel Relation)
CREATE POLICY "Users can CRUD own story_bibles" ON story_bibles
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own worlds" ON worlds
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own locations" ON locations
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own factions" ON factions
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own characters" ON characters
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own items" ON items
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own abilities" ON abilities
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own timelines" ON timelines
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own story_events" ON story_events
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own plot_threads" ON plot_threads
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own arcs" ON arcs
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own chapter_outlines" ON chapter_outlines
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own chapters" ON chapters
    FOR ALL
    USING (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM novels WHERE id = novel_id AND owner_id = auth.uid()));

-- Level 2 Children Policies (Nested relations)
CREATE POLICY "Users can CRUD own character_states" ON character_states
    FOR ALL
    USING (EXISTS (SELECT 1 FROM characters JOIN novels ON characters.novel_id = novels.id WHERE characters.id = character_id AND novels.owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM characters JOIN novels ON characters.novel_id = novels.id WHERE characters.id = character_id AND novels.owner_id = auth.uid()));

CREATE POLICY "Users can CRUD own sub_arcs" ON sub_arcs
    FOR ALL
    USING (EXISTS (SELECT 1 FROM arcs JOIN novels ON arcs.novel_id = novels.id WHERE arcs.id = arc_id AND novels.owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM arcs JOIN novels ON arcs.novel_id = novels.id WHERE arcs.id = arc_id AND novels.owner_id = auth.uid()));
