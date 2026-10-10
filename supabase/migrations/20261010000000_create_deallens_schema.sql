-- DealLens Schema Migration
-- Core relational tables for acquisition intelligence

-- 1. acquisition_theses
CREATE TABLE IF NOT EXISTS acquisition_theses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    geography TEXT NOT NULL,
    min_revenue BIGINT NOT NULL,
    max_revenue BIGINT NOT NULL,
    min_employees INT NOT NULL,
    max_employees INT NOT NULL,
    min_business_age INT NOT NULL,
    prefer_founder_led BOOLEAN NOT NULL DEFAULT TRUE,
    prefer_independent BOOLEAN NOT NULL DEFAULT TRUE,
    exclusion_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. companies
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    website TEXT NOT NULL,
    normalized_domain TEXT NOT NULL,
    industry TEXT NOT NULL,
    location TEXT NOT NULL,
    revenue BIGINT,
    employees INT,
    founded_year INT,
    linkedin_url TEXT,
    contact_name TEXT,
    contact_title TEXT,
    contact_email TEXT,
    description TEXT,
    crawl_status TEXT NOT NULL DEFAULT 'SUCCESS',
    crawled_pages_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_normalized_domain ON companies(normalized_domain);

-- 3. analysis_runs
CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    thesis_id TEXT NOT NULL REFERENCES acquisition_theses(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'completed',
    company_count INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 4. company_analyses
CREATE TABLE IF NOT EXISTS company_analyses (
    id TEXT PRIMARY KEY,
    analysis_run_id TEXT,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    thesis_id TEXT NOT NULL REFERENCES acquisition_theses(id) ON DELETE CASCADE,
    fit_score INT NOT NULL,
    fit_components JSONB NOT NULL DEFAULT '{}'::jsonb,
    owner_signal_score INT NOT NULL,
    confidence_score INT NOT NULL,
    action_bucket TEXT NOT NULL,
    summary TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    unknowns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_analyses_company_id ON company_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_company_analyses_action_bucket ON company_analyses(action_bucket);

-- 5. company_evidence
CREATE TABLE IF NOT EXISTS company_evidence (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    analysis_id TEXT,
    type TEXT NOT NULL,
    claim TEXT NOT NULL,
    snippet TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_page_title TEXT,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.90,
    extraction_method TEXT NOT NULL DEFAULT 'rule',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_evidence_company_id ON company_evidence(company_id);

-- 6. crawl_pages
CREATE TABLE IF NOT EXISTS crawl_pages (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    status_code INT NOT NULL,
    fetch_status TEXT NOT NULL,
    text_hash TEXT,
    content_text TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_pages_company_id ON crawl_pages(company_id);
