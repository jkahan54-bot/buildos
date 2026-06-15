-- Field-worker project scoping (database-level enforcement of assigned_project_id).
--
-- Previously, role-based access (e.g. "field workers only see their assigned
-- project") was enforced only in app/page code via same_org(org_id) RLS.
-- This adds a real DB-level rule: a 'field' role user with assigned_project_id
-- set can only access rows for that project (within their own org). Users
-- without assigned_project_id, or with any other role, are unaffected —
-- identical to the previous same_org(org_id) behavior.

create or replace function can_access_project(row_org_id uuid, row_project_id uuid)
returns boolean language sql security definer stable as $$
  select row_org_id = get_my_org_id()
    and (
      row_project_id is null
      or (select role from profiles where id = auth.uid()) <> 'field'
      or (select assigned_project_id from profiles where id = auth.uid()) is null
      or row_project_id = (select assigned_project_id from profiles where id = auth.uid())
    )
$$;

-- Replace org-only isolation with project-aware isolation on project-scoped tables.
do $$
declare t text;
begin
  foreach t in array array[
    'ai_reviews','budget_items','change_orders','daily_logs','documents','equipment',
    'invoices','medical_checklists','meeting_minutes','message_channels','milestones',
    'punch_list_items','quotes','rfis','safety_incidents','schedule_tasks','site_photos',
    'submittals','team_members','time_logs'
  ] loop
    execute format('drop policy if exists "org_isolation" on %I', t);
    execute format(
      'create policy "org_isolation" on %I for all using (can_access_project(org_id, project_id)) with check (can_access_project(org_id, project_id))', t
    );
  end loop;
end $$;

-- daily_log_drafts / whatsapp_messages: switch from project-join to direct column check.
drop policy if exists "org_via_project" on daily_log_drafts;
create policy "org_isolation" on daily_log_drafts for all
  using (can_access_project(org_id, project_id))
  with check (can_access_project(org_id, project_id));

drop policy if exists "org_via_project" on whatsapp_messages;
create policy "org_isolation" on whatsapp_messages for all
  using (can_access_project(org_id, project_id))
  with check (can_access_project(org_id, project_id));

-- site_walkthroughs: RLS was never enabled on this table — close this gap.
alter table site_walkthroughs enable row level security;
create policy "org_isolation" on site_walkthroughs for all
  using (can_access_project(org_id, project_id))
  with check (can_access_project(org_id, project_id));
