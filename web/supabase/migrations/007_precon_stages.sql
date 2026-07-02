-- Pre-construction stage tracker: per-project pipeline of pre-con stages
-- (design → permits → bidding → contracts → mobilization) with ball-in-court.
CREATE TABLE IF NOT EXISTS precon_stages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations ON DELETE CASCADE,
  project_id   UUID REFERENCES projects ON DELETE CASCADE,
  stage        TEXT NOT NULL,
  sort_order   INT  DEFAULT 0,
  status       TEXT DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','waiting','done','na')),
  waiting_on   TEXT,          -- ball-in-court bucket (Architect, Inspector/DOB, …)
  waiting_for  TEXT,          -- the specific thing we're waiting for, free text
  notes        TEXT,
  target_date  DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, stage)
);

ALTER TABLE precon_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON precon_stages FOR ALL USING (same_org(org_id));
CREATE INDEX IF NOT EXISTS idx_precon_project ON precon_stages(project_id);
