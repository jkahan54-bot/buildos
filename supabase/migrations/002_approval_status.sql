-- Add approval_status to profiles for invite approval workflow
-- Run this once in Supabase SQL Editor: https://supabase.com/dashboard/project/biizphtfbiqgkinnfbgy/sql/new

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

-- All existing users are already approved
UPDATE profiles SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = '';

-- New invites will be set to 'pending' by the invite/accept API
