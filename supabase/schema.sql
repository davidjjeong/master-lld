create table if not exists public.practices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null,
  problem_title text not null,
  difficulty text not null,
  current_step integer not null default 0,
  answer text not null default '',
  step_scores jsonb not null default '{}'::jsonb,
  feedback jsonb,
  follow_up_question text,
  timer_seconds integer not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.practices enable row level security;

drop policy if exists "Users can view their own practices" on public.practices;
create policy "Users can view their own practices"
  on public.practices for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own practices" on public.practices;
create policy "Users can create their own practices"
  on public.practices for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own practices" on public.practices;
create policy "Users can update their own practices"
  on public.practices for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own practices" on public.practices;
create policy "Users can delete their own practices"
  on public.practices for delete
  using (auth.uid() = user_id);

create index if not exists practices_user_updated_idx
  on public.practices (user_id, updated_at desc);
