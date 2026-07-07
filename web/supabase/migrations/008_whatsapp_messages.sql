-- Full WhatsApp group log: EVERY message from every scanned group is stored,
-- not just the ones that became tasks — so daily reports can show complete
-- per-group transcripts. `action` records what the webhook did with it.
-- NOTE: whatsapp_messages already existed (id, org_id, project_id, message_date,
-- sender, content, created_at) from an earlier feature — this adds the columns
-- the webhook logger needs rather than recreating the table.
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS action TEXT; -- task_created | completion | completion_no_match | safety_incident | chatter
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "org_isolation" ON whatsapp_messages FOR ALL USING (same_org(org_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_wa_messages_sent ON whatsapp_messages(sent_at);
