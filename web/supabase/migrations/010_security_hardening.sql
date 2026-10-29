-- 1. Profiles: a signed-in user must not be able to change their own role, org, approval or site.
--    (The edit_own policy only checked id = auth.uid(), so anyone could make themselves an owner.)
CREATE OR REPLACE FUNCTION guard_profile_privileged()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service role (server routes) and the signup trigger run with no end-user JWT role
  IF coalesce(auth.role(), 'service_role') <> 'authenticated' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.role := 'field'; NEW.org_id := NULL; NEW.approval_status := 'pending'; NEW.assigned_project_id := NULL;
    RETURN NEW;
  END IF;
  IF NEW.role                IS DISTINCT FROM OLD.role
  OR NEW.org_id              IS DISTINCT FROM OLD.org_id
  OR NEW.approval_status     IS DISTINCT FROM OLD.approval_status
  OR NEW.assigned_project_id IS DISTINCT FROM OLD.assigned_project_id
  OR NEW.email               IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'role, organization, approval and site access can only be changed by an administrator';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_profile ON profiles;
CREATE TRIGGER trg_guard_profile BEFORE INSERT OR UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_privileged();
DROP POLICY IF EXISTS edit_own ON profiles;   -- duplicate of update_own_profile

-- 2. Per-user site access. A user with rows here sees ONLY those sites. Owners/admins always see all.
CREATE TABLE IF NOT EXISTS user_project_access (
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);
ALTER TABLE user_project_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY upa_read  ON user_project_access FOR SELECT USING (user_id = auth.uid() OR org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')));
CREATE POLICY upa_write ON user_project_access FOR ALL
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')))
  WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')));

CREATE OR REPLACE FUNCTION can_access_project(row_org_id uuid, row_project_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT row_org_id = get_my_org_id()
    AND (
      row_project_id IS NULL
      OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner','admin')
      OR CASE
           WHEN EXISTS (SELECT 1 FROM user_project_access WHERE user_id = auth.uid())
             THEN EXISTS (SELECT 1 FROM user_project_access WHERE user_id = auth.uid() AND project_id = row_project_id)
           WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'field'
             THEN (SELECT assigned_project_id FROM profiles WHERE id = auth.uid()) IS NULL
                  OR row_project_id = (SELECT assigned_project_id FROM profiles WHERE id = auth.uid())
           ELSE TRUE
         END
    )
$$;

-- projects itself is gated by id, not project_id
DROP POLICY IF EXISTS org_isolation ON projects;
CREATE POLICY org_isolation ON projects FOR ALL USING (can_access_project(org_id, id)) WITH CHECK (can_access_project(org_id, id));

-- 3. Option (module) locks enforced in the database, not just by hiding menu links.
--    hidden lists hold menu hrefs ('/budget'). Owners/admins are never locked out.
CREATE OR REPLACE FUNCTION module_allowed(mod text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN (SELECT role FROM profiles WHERE id = auth.uid()) IN ('owner','admin') THEN TRUE
    ELSE NOT (
      mod = ANY (coalesce((SELECT r.hidden FROM role_menu_prefs r JOIN profiles p ON p.org_id = r.org_id AND p.role = r.role WHERE p.id = auth.uid()), '{}'))
      OR mod = ANY (coalesce((SELECT u.hidden FROM user_menu_prefs u WHERE u.user_id = auth.uid()), '{}'))
    )
  END
$$;

DO $$
DECLARE m record;
BEGIN
  FOR m IN SELECT * FROM (VALUES
    ('/budget','budget_items'),('/invoices','invoices'),('/change-orders','change_orders'),('/quotes','quotes'),
    ('/safety','safety_incidents'),('/equipment','equipment'),('/timelog','time_logs'),('/photos','site_photos'),
    ('/documents','documents'),('/subcontractors','subcontractors'),('/ai-tools','ai_reviews'),('/rfis','rfis'),
    ('/submittals','submittals'),('/meetings','meetings'),('/daily-log','daily_logs')
  ) AS v(href, tbl) LOOP
    IF to_regclass('public.' || m.tbl) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS module_lock ON %I', m.tbl);
      EXECUTE format('CREATE POLICY module_lock ON %I AS RESTRICTIVE FOR ALL USING (module_allowed(%L)) WITH CHECK (module_allowed(%L))', m.tbl, m.href, m.href);
    END IF;
  END LOOP;
END $$;
