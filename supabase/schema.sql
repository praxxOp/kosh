-- Kosh schema. Run in the Supabase SQL editor (or `supabase db push`).
-- The app seeds policy_rules with the default board policy on first read.

create table if not exists policy_rules (
  id          text primary key,
  title       text not null,
  description text not null default '',
  category    text not null check (category in ('money','data','access')),
  enabled     boolean not null default true,
  params      jsonb not null default '{}'::jsonb,
  source      text not null default 'custom' check (source in ('board','company','custom')),
  created_at  timestamptz not null default now()
);

create table if not exists audit_events (
  id          text primary key,
  task_id     text not null,
  ts          timestamptz not null default now(),
  role        text not null,
  mode        text not null,            -- off | on
  engine      text not null,            -- none | local | agntid
  server      text not null,            -- tally | alpaca | bank | kosh
  tool        text not null,
  input       jsonb not null default '{}'::jsonb,
  decision    text not null,            -- allowed | blocked | held | error
  rule_id     text,
  rule_title  text,
  reason      text,
  output      jsonb,
  approval_id text
);
create index if not exists audit_events_ts on audit_events (ts desc);
create index if not exists audit_events_task on audit_events (task_id);

create table if not exists approvals (
  id           text primary key,
  created_at   timestamptz not null default now(),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by text not null,
  task_id      text not null,
  server       text not null,
  tool         text not null,
  input        jsonb not null default '{}'::jsonb,
  reason       text not null default '',
  decided_by   text,
  decided_at   timestamptz,
  result       jsonb
);

-- The server uses the service-role key, so RLS can stay on with no public policies.
alter table policy_rules  enable row level security;
alter table audit_events  enable row level security;
alter table approvals     enable row level security;
