-- ============================================================
-- MISE À JOUR : vraies adresses des comptes de Gildas et Harold
-- À coller dans Supabase → SQL Editor → Run   (ne supprime rien)
-- ============================================================
create or replace function public.innover_is_staff() returns boolean
language sql stable as $$
  select public.innover_email() in (
    'jildasinno@gmail.com',       -- admin (le patron)
    'gildaslekajio@icloud.com',   -- Gildas
    'hlekajio@gmail.com'          -- Harold
  )
$$;
