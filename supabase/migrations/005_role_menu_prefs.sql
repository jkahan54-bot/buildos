-- Role menu visibility preferences
-- Stores, per organization + role, which sidebar items are HIDDEN.
-- No row / empty array = that role sees all of its default menu items.

CREATE TABLE IF NOT EXISTS role_menu_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  hidden TEXT[] NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, role)
);

CREATE INDEX IF NOT EXISTS idx_role_menu_prefs_org ON role_menu_prefs(org_id);

ALTER TABLE role_menu_prefs ENABLE ROW LEVEL SECURITY;

-- Anyone in the org can READ their org's prefs (needed to render their own sidebar)
CREATE POLICY rmp_read ON role_menu_prefs FOR SELECT
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Only owners and admins can CHANGE prefs
CREATE POLICY rmp_write ON role_menu_prefs FOR ALL
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')))
  WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')));
