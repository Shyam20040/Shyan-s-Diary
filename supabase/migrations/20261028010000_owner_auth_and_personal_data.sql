create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index focus_sessions_started_at_idx on public.focus_sessions(started_at desc);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null unique,
  content text not null default '',
  mood text,
  energy integer check (energy between 1 and 5),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_entries_entry_date_idx on public.journal_entries(entry_date desc);

create trigger focus_sessions_touch_updated_at before update on public.focus_sessions
for each row execute function public.touch_updated_at();
create trigger journal_entries_touch_updated_at before update on public.journal_entries
for each row execute function public.touch_updated_at();

alter table public.focus_sessions enable row level security;
alter table public.journal_entries enable row level security;
