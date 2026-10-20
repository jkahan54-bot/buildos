-- Per-user menu overrides, layered on top of role_menu_prefs.
-- A user's hidden items = role's hidden items UNION this table's hidden items
-- (per-user prefs can only hide additional items, never un-hide a role default).
CREATE TABLE IF NOT EXISTS user_menu_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hidden TEXT[] NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_menu_prefs_org ON user_menu_prefs(org_id);

ALTER TABLE user_menu_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ump_read ON user_menu_prefs FOR SELECT
  USING (org_id IN (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY ump_write ON user_menu_prefs FOR ALL
  USING (org_id IN (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['owner','admin'])))
  WITH CHECK (org_id IN (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['owner','admin'])));
