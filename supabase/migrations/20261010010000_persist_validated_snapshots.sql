-- Store the shared validated domain snapshots alongside relational query columns.
-- Existing rows without snapshots remain explicitly unverified during hydration.
ALTER TABLE acquisition_theses ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE company_evidence ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE company_analyses ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS payload JSONB;
