-- Add concept/simulation mapping for test questions.
-- Run after supabase/003_tests.sql.

alter table public.test_questions
  add column if not exists concept_name text,
  add column if not exists game_slug text references public.games(slug) on delete set null;

create index if not exists test_questions_game_slug_idx
  on public.test_questions(game_slug);

comment on column public.test_questions.concept_name is 'Human-readable concept shown with the test question.';
comment on column public.test_questions.game_slug is 'Simulation slug from public.games to display alongside the test question.';

update public.test_questions
set
  concept_name = concept_data.concept_name,
  game_slug = concept_data.game_slug
from (values
  (1, 'RC Low-Pass Filter', 'filters'),
  (2, 'T-Network Balancer', 'symmetrical'),
  (3, 'Z-Matrix Synthesis', 'parameters'),
  (4, 'Virtual Test Bench', 'open_short'),
  (5, 'Pi-Network Balancer', 'asymmetrical'),
  (6, 'Twin-T Notch Filter', 'twin_t'),
  (7, 'Filter Cascade Builder', 'composite'),
  (8, 'RC Low-Pass Filter', 'filters'),
  (9, 'T-Network Balancer', 'symmetrical'),
  (10, 'Virtual Test Bench', 'open_short')
) as concept_data(display_order, concept_name, game_slug)
where public.test_questions.display_order = concept_data.display_order;

alter table public.test_questions
  alter column concept_name set default 'Network Analysis';
