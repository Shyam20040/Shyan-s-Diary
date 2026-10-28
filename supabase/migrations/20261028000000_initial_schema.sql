create extension if not exists pgcrypto;

create type public.task_status as enum (
  'backlog', 'planned', 'in_progress', 'blocked', 'completed', 'cancelled'
);
create type public.task_priority as enum ('low', 'medium', 'high', 'critical');
create type public.report_status as enum ('queued', 'processing', 'completed', 'failed');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  timezone text not null default 'Asia/Kolkata',
  report_local_time time not null default '22:00',
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 180),
  description text not null default '',
  target_value numeric,
  current_value numeric not null default 0,
  unit text,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'archived')),
  starts_on date,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references public.goals(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 180),
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'archived')),
  starts_on date,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 180),
  description text not null default '',
  status public.task_status not null default 'planned',
  priority public.task_priority not null default 'medium',
  due_date date,
  estimate_minutes integer not null default 0 check (estimate_minutes >= 0),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index tasks_status_due_date_idx on public.tasks(status, due_date) where deleted_at is null;
create index tasks_project_id_idx on public.tasks(project_id) where deleted_at is null;
create index tasks_goal_id_idx on public.tasks(goal_id) where deleted_at is null;
create index tasks_created_at_idx on public.tasks(created_at desc);

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  event_type text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index task_events_task_created_idx on public.task_events(task_id, created_at desc);

create or replace function public.capture_task_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_events (task_id, event_type, after_data)
    values (new.id, 'created', to_jsonb(new) - 'updated_at');
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    insert into public.task_events (task_id, event_type, before_data, after_data)
    values (new.id, 'archived', to_jsonb(old) - 'updated_at', to_jsonb(new) - 'updated_at');
  elsif (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    insert into public.task_events (task_id, event_type, before_data, after_data)
    values (new.id, 'updated', to_jsonb(old) - 'updated_at', to_jsonb(new) - 'updated_at');
  end if;
  return new;
end;
$$;

create trigger tasks_capture_insert after insert on public.tasks
for each row execute function public.capture_task_event();
create trigger tasks_capture_update after update on public.tasks
for each row execute function public.capture_task_event();

create table public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  status text not null default 'running' check (status in ('running', 'paused', 'completed', 'abandoned')),
  session_type text not null default 'focus' check (session_type in ('focus', 'break', 'manual')),
  interruption_notes text not null default '',
  created_at timestamptz not null default now()
);
create unique index time_sessions_one_active_idx on public.time_sessions ((1))
  where status in ('running', 'paused');
create index time_sessions_started_at_idx on public.time_sessions(started_at desc);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  accomplished text not null default '',
  went_well text not null default '',
  challenges text not null default '',
  lessons text not null default '',
  next_day_priorities text not null default '',
  private_notes text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  title text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  tags text[] not null default '{}',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blog_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete restrict,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index blog_revisions_post_created_idx on public.blog_revisions(post_id, created_at desc);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 180),
  description text not null default '',
  schedule jsonb not null default '{"frequency":"daily"}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete restrict,
  entry_date date not null,
  completed_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (habit_id, entry_date)
);
create index habit_entries_date_idx on public.habit_entries(entry_date desc);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  related_type text not null check (related_type in ('task', 'project', 'journal', 'blog', 'report')),
  related_id uuid not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  storage_path text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  period_start date,
  period_end date,
  result jsonb not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  created_at timestamptz not null default now()
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  status public.report_status not null default 'queued',
  storage_path text,
  metrics jsonb not null default '{}'::jsonb,
  analysis jsonb,
  ai_issue text,
  generated_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  error_message text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index daily_reports_status_date_idx on public.daily_reports(status, report_date desc);

create or replace function public.claim_daily_report(p_report_date date, p_force boolean default false)
returns table(report_id uuid, attempt integer, claimed boolean, report_status public.report_status)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_status public.report_status;
  v_attempt integer;
  v_updated_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('daily-report:' || p_report_date::text));
  select r.id, r.status, r.attempts, r.updated_at
    into v_id, v_status, v_attempt, v_updated_at
    from public.daily_reports as r
    where r.report_date = p_report_date
    for update;

  if found and not p_force and v_status = 'completed' then
    return query select v_id, v_attempt, false, v_status;
    return;
  end if;

  if found and v_status = 'processing'
      and v_updated_at > now() - interval '15 minutes' then
    return query select v_id, v_attempt, false, v_status;
    return;
  end if;

  if v_id is null then
    insert into public.daily_reports (report_date, status, attempts)
      values (p_report_date, 'processing', 1)
      returning id, attempts into v_id, v_attempt;
  else
    update public.daily_reports as r
      set status = 'processing',
          attempts = r.attempts + 1,
          error_message = null,
          updated_at = now()
      where r.id = v_id
      returning r.attempts into v_attempt;
  end if;

  return query select v_id, v_attempt, true, 'processing'::public.report_status;
end;
$$;
revoke all on function public.claim_daily_report(date, boolean) from public, anon, authenticated;
grant execute on function public.claim_daily_report(date, boolean) to service_role;

create table public.scheduled_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  run_key text not null unique,
  status public.report_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
create index scheduled_job_runs_name_created_idx on public.scheduled_job_runs(job_name, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  scheduled_at timestamptz,
  read_at timestamptz,
  related_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger tasks_touch_updated_at before update on public.tasks
for each row execute function public.touch_updated_at();
create trigger goals_touch_updated_at before update on public.goals
for each row execute function public.touch_updated_at();
create trigger projects_touch_updated_at before update on public.projects
for each row execute function public.touch_updated_at();
create trigger daily_logs_touch_updated_at before update on public.daily_logs
for each row execute function public.touch_updated_at();
create trigger blog_posts_touch_updated_at before update on public.blog_posts
for each row execute function public.touch_updated_at();
create trigger habits_touch_updated_at before update on public.habits
for each row execute function public.touch_updated_at();
create trigger ai_conversations_touch_updated_at before update on public.ai_conversations
for each row execute function public.touch_updated_at();
create trigger daily_reports_touch_updated_at before update on public.daily_reports
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.time_sessions enable row level security;
alter table public.daily_logs enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_revisions enable row level security;
alter table public.habits enable row level security;
alter table public.habit_entries enable row level security;
alter table public.attachments enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.daily_reports enable row level security;
alter table public.scheduled_job_runs enable row level security;
alter table public.notifications enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-life-files',
  'private-life-files',
  false,
  26214400,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/markdown']
)
on conflict (id) do update set public = false, file_size_limit = 26214400;
