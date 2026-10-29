-- Workflow + Timeline share one table: schedule_tasks.
-- Each item has a duration and "blocked by" links; dates are computed from them.
ALTER TABLE schedule_tasks
  ADD COLUMN IF NOT EXISTS duration_days  INT  DEFAULT 5,
  ADD COLUMN IF NOT EXISTS depends_on     UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stage          TEXT,
  ADD COLUMN IF NOT EXISTS original_start DATE,
  ADD COLUMN IF NOT EXISTS original_end   DATE,
  ADD COLUMN IF NOT EXISTS locked         BOOLEAN DEFAULT FALSE,   -- fixed date (inspection, delivery); never auto-moved
  ADD COLUMN IF NOT EXISTS delay_reason   TEXT,
  ADD COLUMN IF NOT EXISTS sort_order     INT DEFAULT 0;
UPDATE schedule_tasks SET original_start = start_date, original_end = end_date WHERE original_start IS NULL;
UPDATE schedule_tasks SET duration_days = GREATEST(1, (end_date - start_date)) WHERE duration_days IS NULL OR duration_days = 5;
