-- Create leads table for sales pipeline
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  project_description TEXT,
  project_type TEXT DEFAULT 'standard',
  estimated_value NUMERIC,
  status TEXT DEFAULT 'new', -- new, contacted, proposal_sent, negotiating, won, lost, on_hold
  source TEXT,
  next_followup DATE,
  last_contact DATE,
  converted_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create lead_notes table for conversation log
CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leads_org_id ON leads(org_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_next_followup ON leads(next_followup) WHERE status NOT IN ('won', 'lost');
CREATE INDEX idx_lead_notes_lead_id ON lead_notes(lead_id);

-- RLS Policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

-- Users can see leads in their org
CREATE POLICY leads_view ON leads FOR SELECT
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Users can create leads in their org
CREATE POLICY leads_create ON leads FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Users can update leads in their org
CREATE POLICY leads_update ON leads FOR UPDATE
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Users can see notes for leads in their org
CREATE POLICY lead_notes_view ON lead_notes FOR SELECT
  USING (lead_id IN (SELECT id FROM leads WHERE org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())));

-- Users can create notes for leads in their org
CREATE POLICY lead_notes_create ON lead_notes FOR INSERT
  WITH CHECK (lead_id IN (SELECT id FROM leads WHERE org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())));
