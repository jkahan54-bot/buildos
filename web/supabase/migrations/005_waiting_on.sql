-- "Ball in court" tracking: who currently owns the next action on an item.
-- Values: Architect, Engineer, GC, Owner, Sub/Trade, Inspector/DOB, Other (see web/lib/waitingOn.ts)
ALTER TABLE rfis             ADD COLUMN IF NOT EXISTS waiting_on TEXT;
ALTER TABLE submittals       ADD COLUMN IF NOT EXISTS waiting_on TEXT;
ALTER TABLE punch_list_items ADD COLUMN IF NOT EXISTS waiting_on TEXT;
ALTER TABLE change_orders    ADD COLUMN IF NOT EXISTS waiting_on TEXT;

CREATE INDEX IF NOT EXISTS idx_rfis_waiting_on          ON rfis(waiting_on)             WHERE waiting_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submittals_waiting_on    ON submittals(waiting_on)       WHERE waiting_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_punch_items_waiting_on   ON punch_list_items(waiting_on) WHERE waiting_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_change_orders_waiting_on ON change_orders(waiting_on)    WHERE waiting_on IS NOT NULL;
