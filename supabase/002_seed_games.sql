-- Seed editable game metadata. Update this table instead of hardcoding new game fields in HTML/JS.
insert into public.games (slug, title, concept, category, description, formulas, module_label, display_order) values
('filters','Filter Design Lab','RC Low-Pass Filter','Network Analysis','Design a low-pass filter by selecting correct R and C values to hit the target cutoff frequency.','["fc = 1 / (2πRC)"]','Module 01',1),
('symmetrical','Symmetrical Network','T-Network Balancer','Network Analysis','Balance the series and shunt arms of a T-Network to make it symmetrical.','["Z1 = Z2", "Z₀ = √(Z1² + 2·Z1·Z3)"]','Module 02',2),
('parameters','Network Parameters','Z-Matrix Synthesis','Network Analysis','Adjust the T-Network components to exactly match the target Z-Parameter Matrix.','["Z11 = Z1 + Z3"]','Module 03',3),
('open_short','Open & Short Circuit','Virtual Test Bench','Network Analysis','Perform open and short circuit tests on a mystery network.','["Z11 = V1 / I1 (I2=0)"]','Module 04',4),
('asymmetrical','Asymmetrical Network','Pi-Network Balancer','Network Analysis','Transform an asymmetrical Pi-Network into a balanced symmetrical network.','["Z_A = Z_C"]','Module 05',5),
('twin_t','Twin-T Notch Filter','Interference Rejection','Network Analysis','Construct a parallel Twin-T network to generate a sharp frequency notch.','["fn = 1 / (2πRC)"]','Module 07',6),
('composite','Composite Filters','Filter Cascade Builder','Network Analysis','Cascade multiple filter blocks to create composite frequency responses.','["H_total = H1 × H2"]','Module 08',7)
on conflict (slug) do update set
  title = excluded.title,
  concept = excluded.concept,
  category = excluded.category,
  description = excluded.description,
  formulas = excluded.formulas,
  module_label = excluded.module_label,
  display_order = excluded.display_order;

-- Replace this email with the faculty/admin Google account that should manage the dashboard.
insert into public.faculty_allowlist (email)
values ('faculty@mmcoe.edu.in')
on conflict (email) do nothing;
