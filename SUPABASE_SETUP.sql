-- FantomRP: shared topics + realtime
-- Run this once in Supabase SQL Editor.

create table if not exists public.forum_topics (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.forum_topics enable row level security;

drop policy if exists "forum_topics_select" on public.forum_topics;
drop policy if exists "forum_topics_insert" on public.forum_topics;
drop policy if exists "forum_topics_update" on public.forum_topics;
drop policy if exists "forum_topics_delete" on public.forum_topics;

create policy "forum_topics_select" on public.forum_topics for select to anon, authenticated using (true);
create policy "forum_topics_insert" on public.forum_topics for insert to anon, authenticated with check (true);
create policy "forum_topics_update" on public.forum_topics for update to anon, authenticated using (true) with check (true);
create policy "forum_topics_delete" on public.forum_topics for delete to anon, authenticated using (true);

-- Enable Realtime for this table. If Supabase says it is already in the publication, ignore that message.
alter publication supabase_realtime add table public.forum_topics;
