-- Daily Voice Report: personal no-login links, recorded notes, confirmed items, drafts.
-- SECURITY MODEL: every table has RLS enabled. Public (no-login) access happens ONLY through
-- server API routes that validate an unguessable token and use the service role. The browser
-- (anon key) can never read links, tokens, or audio. Staff can read reports/drafts for their org.

create table if not exists report_links (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations on delete cascade,
  person_name   text not null,
  phone         text,
  email         text,
  language      text not null default 'en' check (language in ('en','es','yi','mixed')),
  project_ids   uuid[] not null default '{}',
  token_hash    text not null unique,          -- sha256 of the token; the token itself is never stored
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  created_by    uuid references profiles,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
alter table report_links enable row level security;   -- no policies: service role only

create table if not exists report_link_uses (
  id         bigserial primary key,
  link_id    uuid references report_links on delete cascade,
  action     text not null,
  ip         text,
  user_agent text,
  at         timestamptz not null default now()
);
alter table report_link_uses enable row level security; -- service role only

create table if not exists voice_reports (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations on delete cascade,
  link_id              uuid not null references report_links on delete restrict,
  report_date          date not null default current_date,
  status               text not null default 'processing'
                       check (status in ('processing','needs_confirmation','sent','abandoned','failed')),
  audio_path           text,
  audio_bytes          integer,
  language_hint        text,
  transcript_original  text,
  transcript_english   text,
  items                jsonb not null default '[]',   -- what the AI understood
  confirmed_items      jsonb,                          -- what the manager confirmed/corrected
  low_confidence       boolean not null default false,
  error                text,
  created_at           timestamptz not null default now(),
  sent_at              timestamptz
);
create index if not exists voice_reports_link_idx on voice_reports (link_id, created_at desc);
create index if not exists voice_reports_org_date_idx on voice_reports (org_id, report_date desc);
alter table voice_reports enable row level security;
drop policy if exists "voice_reports_staff_read" on voice_reports;
create policy "voice_reports_staff_read" on voice_reports for select using (same_org(org_id));

-- Money and schedule changes from voice notes are DRAFTS until a person approves them.
create table if not exists report_drafts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations on delete cascade,
  report_id   uuid not null references voice_reports on delete cascade,
  project_id  uuid references projects on delete set null,
  kind        text not null check (kind in ('cost','change_order','schedule_change')),
  summary     text not null,
  amount      numeric(14,2),
  days        integer,
  proposed_date date,
  reason_code text,
  status      text not null default 'draft' check (status in ('draft','approved','rejected')),
  decided_by  uuid references profiles,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
alter table report_drafts enable row level security;
drop policy if exists "report_drafts_staff_read" on report_drafts;
create policy "report_drafts_staff_read" on report_drafts for select using (same_org(org_id));

-- Editable settings (no code changes needed). Managed through staff API with role checks.
create table if not exists report_settings (
  org_id             uuid primary key references organizations on delete cascade,
  cost_alert_amount  numeric(14,2),               -- NULL = alert on every cost until Joel sets an amount
  delay_alert_days   integer not null default 3,
  missing_hour_local integer not null default 17,  -- 5 PM America/New_York
  timezone           text not null default 'America/New_York'
);
alter table report_settings enable row level security;

create table if not exists report_routes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  category        text not null check (category in ('owner','office','pm','missing_report')),
  recipient_name  text not null,
  recipient_email text,
  recipient_whatsapp boolean not null default false   -- true = also use the owner WhatsApp alert
);
alter table report_routes enable row level security;

-- Private bucket for original audio (never public).
insert into storage.buckets (id, name, public)
values ('voice-reports', 'voice-reports', false)
on conflict (id) do update set public = false;
