-- Vendors/subcontractors active on a project, synced from the OneDrive job-site
-- folder structure (one subfolder per vendor under a project's vendor/invoice
-- folder) rather than re-entered by hand.
CREATE TABLE IF NOT EXISTS project_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  last_activity_at TIMESTAMPTZ,
  source_path TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, vendor_name)
);

CREATE INDEX IF NOT EXISTS idx_project_vendors_project ON project_vendors(project_id);

ALTER TABLE project_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY pv_read ON project_vendors FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  ));
