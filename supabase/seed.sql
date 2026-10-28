begin;

insert into public.profiles (id, timezone, report_local_time, theme)
values (
  '00000000-0000-4000-8000-000000000001',
  'Asia/Kolkata',
  '22:00',
  'system'
)
on conflict (id) do nothing;

insert into public.goals (id, title, description, status)
values (
  '00000000-0000-4000-8000-000000000002',
  '[DEMO] Build a consistent planning habit',
  '[DEMO] Example goal; replace or remove it when you start using the app.',
  'active'
)
on conflict (id) do nothing;

insert into public.projects (id, goal_id, title, description, status)
values (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  '[DEMO] Weekly planning',
  '[DEMO] Example project linked to the sample goal.',
  'active'
)
on conflict (id) do nothing;

insert into public.tasks (id, project_id, goal_id, title, description, status, priority, estimate_minutes)
values (
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  '[DEMO] Review the week and choose three priorities',
  '[DEMO] Sample task created by the Supabase seed.',
  'planned',
  'medium',
  20
)
on conflict (id) do nothing;

insert into public.time_sessions (
  id, task_id, started_at, ended_at, duration_seconds, status, session_type, interruption_notes
)
values (
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000004',
  '2026-10-28 08:00:00+05:30',
  '2026-10-28 08:25:00+05:30',
  1500,
  'completed',
  'focus',
  '[DEMO] Example session; this is not real activity.'
)
on conflict (id) do nothing;

insert into public.daily_logs (
  id, log_date, accomplished, went_well, challenges, lessons, next_day_priorities, private_notes
)
values (
  '00000000-0000-4000-8000-000000000006',
  '2026-10-28',
  '[DEMO] Example accomplishment.',
  '[DEMO] Example reflection.',
  '[DEMO] Example challenge.',
  '[DEMO] Example lesson.',
  '[DEMO] Choose one important priority.',
  '[DEMO] Replace or delete this sample journal entry.'
)
on conflict (log_date) do nothing;

insert into public.ai_conversations (id, feature, title, metadata)
values (
  '00000000-0000-4000-8000-000000000007',
  'planning',
  '[DEMO] Planning conversation',
  '{"demo": true}'::jsonb
)
on conflict (id) do nothing;

insert into public.blog_posts (id, title, body, status, tags)
values (
  '00000000-0000-4000-8000-000000000008',
  '[DEMO] A small weekly reflection',
  '[DEMO] Sample draft only. Replace this text with your own writing.',
  'draft',
  array['demo']
)
on conflict (id) do nothing;

insert into public.blog_revisions (id, post_id, title, body)
values (
  '00000000-0000-4000-8000-000000000009',
  '00000000-0000-4000-8000-000000000008',
  '[DEMO] A small weekly reflection',
  '[DEMO] Sample draft only. Replace this text with your own writing.'
)
on conflict (id) do nothing;

insert into public.habits (id, title, description, schedule)
values (
  '00000000-0000-4000-8000-000000000010',
  '[DEMO] Plan tomorrow',
  '[DEMO] Example habit.',
  '{"frequency":"daily","demo":true}'::jsonb
)
on conflict (id) do nothing;

insert into public.habit_entries (id, habit_id, entry_date, note)
values (
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000010',
  '2026-10-28',
  '[DEMO] Example habit entry; not real activity.'
)
on conflict (habit_id, entry_date) do nothing;

insert into public.ai_insights (id, feature, period_start, period_end, result, model)
values (
  '00000000-0000-4000-8000-000000000012',
  'planning',
  '2026-10-28',
  '2026-10-28',
  '{"demo":true,"summary":"Example only; no personal activity was analyzed."}'::jsonb,
  'demo'
)
on conflict (id) do nothing;

insert into public.notifications (id, title, body)
values (
  '00000000-0000-4000-8000-000000000013',
  '[DEMO] Sample notification',
  '[DEMO] This placeholder can be deleted.'
)
on conflict (id) do nothing;

commit;
