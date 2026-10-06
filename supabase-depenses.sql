-- ============================================================
-- TABLE DES DÉPENSES / SORTIES D'ARGENT — INNOVER STORE
-- À coller dans Supabase → SQL Editor → Run
-- ============================================================

-- 1) Créer la table des dépenses
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,                 -- à quoi sert la dépense (Transport, Loyer…)
  amount_xaf numeric not null default 0,    -- montant en XAF
  spent_at   timestamptz not null default now(),  -- date de la dépense
  created_at timestamptz not null default now()
);

-- 2) Sécurité : seuls TES comptes peuvent voir / ajouter / supprimer une dépense
alter table public.expenses enable row level security;

drop policy if exists "expenses_comptes_seulement" on public.expenses;
create policy "expenses_comptes_seulement" on public.expenses
  for all
  using ( (auth.jwt() ->> 'email') in ('jildasinno@gmail.com','jildasinno+vendeur@gmail.com') )
  with check ( (auth.jwt() ->> 'email') in ('jildasinno@gmail.com','jildasinno+vendeur@gmail.com') );

-- ============================================================
-- FIN. Tu peux maintenant enregistrer tes dépenses depuis le
-- Tableau de bord → section « 💸 Dépenses / Sorties d'argent ».
-- Le « Bénéfice Net » se met à jour tout seul.
-- ============================================================
