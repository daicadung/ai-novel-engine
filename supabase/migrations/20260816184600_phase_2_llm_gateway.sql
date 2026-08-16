-- Migration: Phase 2 LLM Gateway
-- Description: Tracking tables for LLM requests and model configurations

-- 1. MODEL CONFIGS
CREATE TABLE model_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null means global
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    display_name TEXT NOT NULL,
    input_cost_per_million NUMERIC,
    output_cost_per_million NUMERIC,
    context_window INTEGER,
    enabled BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE NULLS NOT DISTINCT (owner_id, provider, model)
);

CREATE INDEX idx_model_configs_owner_id ON model_configs(owner_id);
CREATE INDEX idx_model_configs_provider_model ON model_configs(provider, model);

-- 2. LLM REQUESTS
CREATE TABLE llm_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    request_id TEXT, -- external request ID returned by provider
    status TEXT NOT NULL, -- e.g. success, error
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    estimated_cost NUMERIC,
    currency TEXT,
    error_code TEXT,
    error_message TEXT, -- Sanitized
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_requests_owner_id ON llm_requests(owner_id);
CREATE INDEX idx_llm_requests_novel_id ON llm_requests(novel_id);
CREATE INDEX idx_llm_requests_provider_model ON llm_requests(provider, model);


-- UPDATED_AT TRIGGERS
CREATE TRIGGER update_model_configs_modtime BEFORE UPDATE ON model_configs FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE model_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_requests ENABLE ROW LEVEL SECURITY;

-- model_configs Policies
-- Users can read configs that belong to them OR that are global (owner_id IS NULL)
CREATE POLICY "Users can read own or global model_configs" ON model_configs
    FOR SELECT
    USING (owner_id = auth.uid() OR owner_id IS NULL);

-- Users can only modify their own configs
CREATE POLICY "Users can modify own model_configs" ON model_configs
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- llm_requests Policies
-- Users can only read/write their own requests
CREATE POLICY "Users can CRUD own llm_requests" ON llm_requests
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());
