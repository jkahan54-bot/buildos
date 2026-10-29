-- Personal no-login links for site managers + their voice reports.
-- The link token itself is never stored, only its SHA-256 hash. All writes go through server routes (service role).
CREATE TABLE IF NOT EXISTS field_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  person_name   TEXT NOT NULL,
  language      TEXT DEFAULT 'en',                 -- en | es | yi : read-back language
  project_ids   UUID[] NOT NULL DEFAULT '{}',      -- the only sites this link can report on
  notify_emails TEXT[] DEFAULT '{}',               -- who gets urgent items
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked       BOOLEAN DEFAULT FALSE,
  last_used_at  TIMESTAMPTZ,
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS voice_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  link_id      UUID REFERENCES field_links ON DELETE SET NULL,
  person_name  TEXT,
  project_id   UUID REFERENCES projects ON DELETE SET NULL,
  language     TEXT,
  transcript   TEXT,
  extracted    JSONB,
  priority     TEXT DEFAULT 'normal',
  status       TEXT DEFAULT 'draft' CHECK (status IN ('draft','confirmed','discarded')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_voice_reports_project ON voice_reports(project_id, created_at DESC);
ALTER TABLE field_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY fl_admin_read ON field_links FOR SELECT USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')));
CREATE POLICY vr_read ON voice_reports FOR SELECT USING (can_access_project(org_id, project_id));
