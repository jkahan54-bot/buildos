-- SECURITY: the "edit_own" policy lets a signed-in user UPDATE their own profile row.
-- Without a guard, anyone holding the (public) anon key could set role='owner' or
-- move themselves into another org. Block changes to those columns unless the
-- caller is the service role (server-side API routes) or has no JWT (SQL editor/migrations).
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
declare jwt_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true));
begin
  if jwt_role is null or jwt_role = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.org_id is distinct from old.org_id
     or (to_jsonb(new)->>'assigned_project_id') is distinct from (to_jsonb(old)->>'assigned_project_id') then
    raise exception 'role and organization can only be changed by an administrator through the app';
  end if;
  -- also protect approval status if the column exists
  if to_jsonb(new) ? 'approval_status'
     and (to_jsonb(new)->>'approval_status') is distinct from (to_jsonb(old)->>'approval_status') then
    raise exception 'approval status can only be changed by an administrator through the app';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_privileged_columns on public.profiles;
create trigger trg_guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();
