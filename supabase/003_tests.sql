-- Test section tables and placeholder question seed data.
-- Run after supabase/001_schema.sql.

create table if not exists public.test_questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  question_type text not null check (question_type in ('mcq', 'multiple_select', 'typed_answer')),
  options jsonb not null default '[]'::jsonb,
  correct_answers jsonb not null default '[]'::jsonb,
  points int not null default 1 check (points > 0),
  display_order int not null default 0 unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'auto_submitted')),
  total_questions int not null default 2,
  score int not null default 0,
  max_score int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.test_attempt_questions (
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.test_questions(id) on delete restrict,
  position int not null check (position > 0),
  primary key (attempt_id, question_id),
  unique (attempt_id, position)
);

create table if not exists public.test_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.test_questions(id) on delete restrict,
  answer jsonb not null default '[]'::jsonb,
  is_correct boolean not null default false,
  points_awarded int not null default 0 check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create or replace view public.test_results_view as
select
  ta.id,
  ta.started_at,
  ta.submitted_at,
  ta.expires_at,
  ta.status,
  ta.total_questions,
  ta.score,
  ta.max_score,
  st.id as student_id,
  st.name as student_name,
  st.email as student_email,
  st.roll_id
from public.test_attempts ta
join public.students st on st.id = ta.student_id;

alter table public.test_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.test_attempt_questions enable row level security;
alter table public.test_answers enable row level security;

create policy "Authenticated users can read active test questions" on public.test_questions
  for select to authenticated using (is_active = true);

create policy "Students can create own test attempts" on public.test_attempts
  for insert to authenticated with check (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );
create policy "Students can read own test attempts" on public.test_attempts
  for select to authenticated using (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );
create policy "Students can update own active test attempts" on public.test_attempts
  for update to authenticated using (
    status = 'in_progress' and exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.students s where s.id = student_id and s.auth_user_id = auth.uid())
  );

create policy "Students can manage own attempt questions" on public.test_attempt_questions
  for all to authenticated using (
    exists (select 1 from public.test_attempts a join public.students s on s.id = a.student_id where a.id = attempt_id and s.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.test_attempts a join public.students s on s.id = a.student_id where a.id = attempt_id and s.auth_user_id = auth.uid())
  );

create policy "Students can manage own answers" on public.test_answers
  for all to authenticated using (
    exists (select 1 from public.test_attempts a join public.students s on s.id = a.student_id where a.id = attempt_id and s.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.test_attempts a join public.students s on s.id = a.student_id where a.id = attempt_id and s.auth_user_id = auth.uid())
  );

create policy "Faculty can manage test questions" on public.test_questions
  for all to authenticated using (public.is_faculty()) with check (public.is_faculty());
create policy "Faculty can read all test attempts" on public.test_attempts
  for select to authenticated using (public.is_faculty());
create policy "Faculty can read all attempt questions" on public.test_attempt_questions
  for select to authenticated using (public.is_faculty());
create policy "Faculty can read all test answers" on public.test_answers
  for select to authenticated using (public.is_faculty());

insert into public.test_questions (question_text, question_type, options, correct_answers, points, display_order)
values
('Placeholder MCQ 1: choose the single correct option.', 'mcq', '["Option A", "Option B", "Option C", "Option D"]', '["Option A"]', 1, 1),
('Placeholder MCQ 2: choose the single correct option.', 'mcq', '["Option A", "Option B", "Option C", "Option D"]', '["Option B"]', 1, 2),
('Placeholder MCQ 3: choose the single correct option.', 'mcq', '["Option A", "Option B", "Option C", "Option D"]', '["Option C"]', 1, 3),
('Placeholder MCQ 4: choose the single correct option.', 'mcq', '["Option A", "Option B", "Option C", "Option D"]', '["Option D"]', 1, 4),
('Placeholder multiple-select 5: select all correct options.', 'multiple_select', '["Option A", "Option B", "Option C", "Option D"]', '["Option A", "Option C"]', 1, 5),
('Placeholder multiple-select 6: select all correct options.', 'multiple_select', '["Option A", "Option B", "Option C", "Option D"]', '["Option B", "Option D"]', 1, 6),
('Placeholder multiple-select 7: select all correct options.', 'multiple_select', '["Option A", "Option B", "Option C", "Option D"]', '["Option A", "Option B"]', 1, 7),
('Placeholder typed-answer 8: enter a short sentence.', 'typed_answer', '[]', '["placeholder answer"]', 1, 8),
('Placeholder typed-answer 9: enter a numeric value.', 'typed_answer', '[]', '["42"]', 1, 9),
('Placeholder typed-answer 10: enter a numeric value.', 'typed_answer', '[]', '["10"]', 1, 10)
on conflict do nothing;
