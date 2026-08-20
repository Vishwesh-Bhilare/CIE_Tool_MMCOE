-- Physics Game Lab Supabase schema
-- Run this file in the Supabase SQL Editor before using the website.

create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  roll_id text not null,
  email text not null unique,
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  slug text primary key,
  title text not null,
  concept text,
  category text,
  description text,
  formulas jsonb not null default '[]'::jsonb,
  module_label text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_config (
  id int primary key default 1 check (id = 1),
  accepting_responses boolean not null default true,
  exam_end_time timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.exam_config (id, accepting_responses, exam_end_time)
values (1, true, null)
on conflict (id) do nothing;

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  game_slug text not null references public.games(slug) on update cascade,
  score int not null check (score >= 0),
  details jsonb not null default '{}'::jsonb,
  calculation_image text,
  created_at timestamptz not null default now()
);

create or replace view public.leaderboard_view as
select
  sc.id,
  sc.created_at,
  sc.game_slug,
  g.title as game_title,
  sc.score,
  sc.details,
  sc.calculation_image,
  st.id as student_id,
  st.name as student_name,
  st.email as student_email,
  st.roll_id
from public.scores sc
join public.students st on st.id = sc.student_id
left join public.games g on g.slug = sc.game_slug;

alter table public.students enable row level security;
alter table public.games enable row level security;
alter table public.exam_config enable row level security;
alter table public.scores enable row level security;

create policy "Students can read own profile" on public.students
  for select using (auth.uid() = auth_user_id);
create policy "Students can insert own profile" on public.students
  for insert with check (auth.uid() = auth_user_id);
create policy "Students can update own profile" on public.students
  for update using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);

create policy "Authenticated users can read active games" on public.games
  for select to authenticated using (is_active = true);

create policy "Authenticated users can read exam config" on public.exam_config
  for select to authenticated using (true);

create policy "Students can insert own scores" on public.scores
  for insert to authenticated with check (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );
create policy "Students can read own scores" on public.scores
  for select to authenticated using (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );
create policy "Students can update own score images" on public.scores
  for update to authenticated using (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );

-- Dashboard access: create faculty users in Supabase Auth, then add their emails here.
create table if not exists public.faculty_allowlist (
  email text primary key
);
alter table public.faculty_allowlist enable row level security;

create or replace function public.is_faculty()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.faculty_allowlist f
    where lower(f.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create policy "Faculty can read all students" on public.students
  for select to authenticated using (public.is_faculty());
create policy "Faculty can read all scores" on public.scores
  for select to authenticated using (public.is_faculty());
create policy "Faculty can manage exam config" on public.exam_config
  for all to authenticated using (public.is_faculty()) with check (public.is_faculty());
create policy "Faculty can manage games" on public.games
  for all to authenticated using (public.is_faculty()) with check (public.is_faculty());
create policy "Faculty can read allowlist" on public.faculty_allowlist
  for select to authenticated using (public.is_faculty());
