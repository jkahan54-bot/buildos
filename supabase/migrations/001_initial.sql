-- ================================================================
-- BuildOS — Initial Schema
-- Run this in your Supabase SQL Editor
-- ================================================================

-- Organizations (one per company)
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  logo_url    text,
  created_at  timestamptz default now()
);

-- User profiles (extends Supabase auth.users)
create table profiles (
  id             uuid primary key references auth.users on delete cascade,
  org_id         uuid references organizations on delete cascade,
  full_name      text,
  email          text,
  role           text not null default 'field' check (role in ('owner','admin','office','field')),
  phone          text,
  avatar_url     text,
  ai_primary_model   text default 'claude-sonnet-4-6',
  ai_secondary_model text default 'gpt-4o',
  created_at     timestamptz default now()
);

-- Projects
create table projects (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations on delete cascade,
  name          text not null,
  type          text not null default 'standard' check (type in ('standard','medical_facility')),
  status        text not null default 'active' check (status in ('active','completed','on_hold','cancelled')),
  phase         text,
  address       text,
  sq_footage    integer,
  crew_size     integer default 0,
  budget        numeric(14,2) default 0,
  spent         numeric(14,2) default 0,
  progress      integer default 0 check (progress between 0 and 100),
  start_date    date,
  deadline      date,
  description   text,
  created_by    uuid references profiles,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Budget line items
create table budget_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects on delete cascade,
  org_id      uuid references organizations on delete cascade,
  category    text not null,
  description text not null,
  quantity    numeric(10,2),
  unit        text,
  unit_cost   numeric(10,2),
  labor_cost  numeric(10,2),
  total       numeric(14,2) generated always as (quantity * (unit_cost + labor_cost)) stored,
  status      text default 'pending' check (status in ('pending','approved','paid')),
  created_at  timestamptz default now()
);

-- Invoices
create table invoices (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade,
  project_id  uuid references projects on delete cascade,
  vendor      text not null,
  amount      numeric(14,2) not null,
  due_date    date,
  status      text default 'pending' check (status in ('pending','approved','paid','overdue')),
  notes       text,
  created_at  timestamptz default now()
);

-- Team assignments
create table team_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade,
  project_id  uuid references projects,
  profile_id  uuid references profiles on delete cascade,
  job_title   text,
  hourly_rate numeric(8,2),
  status      text default 'active',
  created_at  timestamptz default now(),
  unique(project_id, profile_id)
);

-- Time logs
create table time_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade,
  project_id  uuid references projects on delete cascade,
  profile_id  uuid references profiles on delete cascade,
  clock_in    timestamptz not null,
  clock_out   timestamptz,
  hours       numeric(5,2) generated always as (
    extract(epoch from (clock_out - clock_in)) / 3600
  ) stored,
  notes       text,
  created_at  timestamptz default now()
);

-- Daily logs
create table daily_logs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations on delete cascade,
  project_id    uuid references projects on delete cascade,
  profile_id    uuid references profiles on delete cascade,
  log_date      date not null default current_date,
  weather       text,
  crew_count    integer,
  work_done     text,
  materials     text,
  equipment     text,
  issues        text,
  created_at    timestamptz default now()
);

-- Safety incidents
create table safety_incidents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade,
  project_id  uuid references projects on delete cascade,
  reported_by uuid references profiles,
  type        text not null,
  severity    text not null check (severity in ('Low','Medium','High','Critical')),
  description text not null,
  location    text,
  status      text default 'Open' check (status in ('Open','In Review','Closed')),
  ai_review   jsonb,
  incident_date timestamptz default now(),
  created_at  timestamptz default now()
);

-- RFIs
create table rfis (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade,
  project_id  uuid references projects on delete cascade,
  submitted_by uuid references profiles,
  title       text not null,
  description text,
  priority    text default 'Medium' check (priority in ('Low','Medium','High')),
  status      text default 'Open' check (status in ('Open','Review','Closed')),
  response    text,
  created_at  timestamptz default now()
);

-- Documents
create table documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade,
  project_id  uuid references projects,
  uploaded_by uuid references profiles,
  name        text not null,
  file_type   text,
  file_size   integer,
  storage_path text,
  url         text,
  created_at  timestamptz default now()
);

-- Site photos
create table site_photos (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade,
  project_id  uuid references projects on delete cascade,
  taken_by    uuid references profiles,
  label       text,
  tag         text,
  storage_path text,
  url         text,
  latitude    numeric(10,7),
  longitude   numeric(10,7),
  ai_analysis jsonb,
  taken_at    timestamptz default now()
);

-- Messages / channels
create table message_channels (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade,
  project_id  uuid references projects,
  name        text not null,
  type        text default 'project' check (type in ('project','team','broadcast','direct')),
  created_at  timestamptz default now()
);

create table messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid references message_channels on delete cascade,
  sender_id   uuid references profiles on delete set null,
  content     text not null,
  created_at  timestamptz default now()
);

-- Milestones
create table milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects on delete cascade,
  org_id      uuid references organizations on delete cascade,
  title       text not null,
  due_date    date,
  completed   boolean default false,
  critical    boolean default false,
  created_at  timestamptz default now()
);

-- Subcontractors
create table subcontractors (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations on delete cascade,
  name        text not null,
  contact     text,
  email       text,
  phone       text,
  trade       text,
  status      text default 'active',
  rating      numeric(3,1),
  created_at  timestamptz default now()
);

-- AI reviews log
create table ai_reviews (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations on delete cascade,
  project_id      uuid references projects,
  created_by      uuid references profiles,
  scenario        text,
  input_content   text,
  primary_model   text,
  primary_result  jsonb,
  secondary_model text,
  secondary_result jsonb,
  created_at      timestamptz default now()
);

-- Medical facility checklists
create table medical_checklists (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects on delete cascade,
  org_id      uuid references organizations on delete cascade,
  name        text not null,
  room_type   text,
  created_at  timestamptz default now()
);

create table medical_checklist_items (
  id              uuid primary key default gen_random_uuid(),
  checklist_id    uuid references medical_checklists on delete cascade,
  product_code    text,
  product_name    text not null,
  category        text,
  quantity_needed integer default 1,
  quantity_installed integer default 0,
  checked         boolean default false,
  modified        boolean default false,
  notes           text,
  checked_by      uuid references profiles,
  checked_at      timestamptz,
  created_at      timestamptz default now()
);

-- ================================================================
-- Row Level Security
-- ================================================================
alter table organizations           enable row level security;
alter table profiles                enable row level security;
alter table projects                enable row level security;
alter table budget_items            enable row level security;
alter table invoices                enable row level security;
alter table team_members            enable row level security;
alter table time_logs               enable row level security;
alter table daily_logs              enable row level security;
alter table safety_incidents        enable row level security;
alter table rfis                    enable row level security;
alter table documents               enable row level security;
alter table site_photos             enable row level security;
alter table message_channels        enable row level security;
alter table messages                enable row level security;
alter table milestones              enable row level security;
alter table subcontractors          enable row level security;
alter table ai_reviews              enable row level security;
alter table medical_checklists      enable row level security;
alter table medical_checklist_items enable row level security;

-- Helper: get current user's org_id
create or replace function get_my_org_id()
returns uuid language sql security definer stable as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Generic org-scoped policy helper
create or replace function same_org(row_org_id uuid)
returns boolean language sql security definer stable as $$
  select row_org_id = get_my_org_id()
$$;

-- Policies: all tables — users can only see their own org's data
do $$
declare t text;
begin
  foreach t in array array[
    'projects','budget_items','invoices','team_members','time_logs',
    'daily_logs','safety_incidents','rfis','documents','site_photos',
    'message_channels','milestones','subcontractors','ai_reviews',
    'medical_checklists','medical_checklist_items'
  ] loop
    execute format(
      'create policy "org_isolation" on %I for all using (same_org(org_id))', t
    );
  end loop;
end $$;

create policy "view_own_org"  on organizations for select using (id = get_my_org_id());
create policy "view_profiles" on profiles       for select using (org_id = get_my_org_id());
create policy "edit_own"      on profiles       for update using (id = auth.uid());

-- Messages: join via channel
create policy "msg_via_channel" on messages for all using (
  exists (
    select 1 from message_channels mc
    where mc.id = channel_id and mc.org_id = get_my_org_id()
  )
);

-- ================================================================
-- Trigger: auto-create profile on sign up
-- ================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
