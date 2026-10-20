-- Add blocked_by field to punch_list_items
ALTER TABLE punch_list_items
ADD COLUMN blocked_by TEXT,
ADD COLUMN blocker_detected_at TIMESTAMPTZ;

-- Create an index for filtering by blocked_by
CREATE INDEX idx_punch_items_blocked_by ON punch_list_items(blocked_by)
WHERE blocked_by IS NOT NULL;

-- Blocker history for tracking when blockers are resolved
CREATE TABLE IF NOT EXISTS blocker_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES punch_list_items(id) ON DELETE CASCADE,
  blocker_text TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocker_history_item ON blocker_history(item_id);
