-- Field workers can be assigned to a specific project/site so their
-- Daily Review only shows job-site items for that project.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
