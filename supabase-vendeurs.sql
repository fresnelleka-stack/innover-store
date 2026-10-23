-- ============================================================
-- COMPTES PERSONNELS DES VENDEURS (Gildas, Harold) — INNOVER STORE
-- À coller dans Supabase → SQL Editor → Run   (une seule fois)
--
-- Ce script :
--   • ajoute « qui a vendu » sur chaque vente et « qui a payé » sur chaque dépense
--   • remplit ce nom AUTOMATIQUEMENT côté serveur (impossible de vendre au nom de l'autre)
--   • crée la table des versements (argent remis au patron)
--   • seul l'admin peut corriger / supprimer une vente ou une dépense
--   • ferme l'ancien compte vendeur commun
-- Les ventes déjà enregistrées ne sont PAS touchées (elles restent « compte commun »).
-- ============================================================

-- 1) Qui est connecté ? (fonctions utilitaires)
create or replace function public.innover_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.innover_is_admin() returns boolean
language sql stable as $$
  select public.innover_email() = 'jildasinno@gmail.com'
$$;

create or replace function public.innover_is_staff() returns boolean
language sql stable as $$
  select public.innover_email() in (
    'jildasinno@gmail.com',          -- admin (le patron)
    'gildaslekajio@icloud.com',   -- Gildas
    'hlekajio@gmail.com'    -- Harold
  )
$$;

-- 2) Nouvelles colonnes
alter table public.sales    add column if not exists seller_email text;
alter table public.expenses add column if not exists seller_email text;
create index if not exists idx_sales_seller_email    on public.sales(seller_email);
create index if not exists idx_expenses_seller_email on public.expenses(seller_email);

-- 3) Le serveur écrit lui-même le vendeur connecté.
--    Un vendeur ne peut PAS choisir un autre nom. L'admin peut attribuer
--    une dépense à un vendeur (ex : transport payé par Gildas).
create or replace function public.innover_set_seller() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.innover_is_admin() or new.seller_email is null then
    new.seller_email := public.innover_email();
  end if;
  return new;
end
$$;

drop trigger if exists innover_sales_seller on public.sales;
create trigger innover_sales_seller before insert on public.sales
  for each row execute function public.innover_set_seller();

drop trigger if exists innover_expenses_seller on public.expenses;
create trigger innover_expenses_seller before insert on public.expenses
  for each row execute function public.innover_set_seller();

-- 4) Table des versements : argent que chaque vendeur remet au patron
create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  seller_email text not null,
  amount_xaf   numeric not null check (amount_xaf > 0),
  note         text,
  paid_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists idx_payouts_seller_email on public.payouts(seller_email);
alter table public.payouts enable row level security;

-- 5) Sécurité (RLS) — on remplace les anciennes règles
-- CATALOG (vitrine) : tout le monde voit, l'équipe modifie
drop policy if exists "catalog_lecture_publique" on public.catalog;
create policy "catalog_lecture_publique" on public.catalog
  for select using (true);
drop policy if exists "catalog_ecriture_comptes" on public.catalog;
create policy "catalog_ecriture_comptes" on public.catalog
  for all using (public.innover_is_staff()) with check (public.innover_is_staff());

-- PRODUCTS (stock commun aux 2 boutiques) : l'équipe gère
drop policy if exists "products_comptes_seulement" on public.products;
create policy "products_comptes_seulement" on public.products
  for all using (public.innover_is_staff()) with check (public.innover_is_staff());

-- SALES : l'équipe voit (pour savoir quels IMEI sont déjà vendus) et ajoute ;
--         seul l'admin corrige ou supprime
drop policy if exists "sales_comptes_seulement" on public.sales;
drop policy if exists "sales_lecture" on public.sales;
drop policy if exists "sales_ajout" on public.sales;
drop policy if exists "sales_modif_admin" on public.sales;
drop policy if exists "sales_suppr_admin" on public.sales;
create policy "sales_lecture" on public.sales
  for select using (public.innover_is_staff());
create policy "sales_ajout" on public.sales
  for insert with check (
    public.innover_is_staff()
    and (public.innover_is_admin() or seller_email = public.innover_email())
  );
create policy "sales_modif_admin" on public.sales
  for update using (public.innover_is_admin()) with check (public.innover_is_admin());
create policy "sales_suppr_admin" on public.sales
  for delete using (public.innover_is_admin());

-- EXPENSES : chaque vendeur voit et ajoute SES dépenses ; l'admin voit tout,
--            seul l'admin supprime
drop policy if exists "expenses_comptes_seulement" on public.expenses;
drop policy if exists "expenses_lecture" on public.expenses;
drop policy if exists "expenses_ajout" on public.expenses;
drop policy if exists "expenses_suppr_admin" on public.expenses;
create policy "expenses_lecture" on public.expenses
  for select using (public.innover_is_admin() or seller_email = public.innover_email());
create policy "expenses_ajout" on public.expenses
  for insert with check (
    public.innover_is_staff()
    and (public.innover_is_admin() or seller_email = public.innover_email())
  );
create policy "expenses_suppr_admin" on public.expenses
  for delete using (public.innover_is_admin());

-- PAYOUTS : seul l'admin enregistre ; chaque vendeur voit ce qu'il a remis
drop policy if exists "payouts_lecture" on public.payouts;
drop policy if exists "payouts_admin" on public.payouts;
create policy "payouts_lecture" on public.payouts
  for select using (public.innover_is_admin() or seller_email = public.innover_email());
create policy "payouts_admin" on public.payouts
  for all using (public.innover_is_admin()) with check (public.innover_is_admin());

-- (Les règles des PHOTOS — Supabase Storage — ne sont pas modifiées ici :
--  l'éditeur SQL n'a souvent pas le droit d'y toucher, ce qui annulait tout le script.)

-- ============================================================
-- FIN. Ensuite, dans Supabase → Authentication → Users → « Add user »,
-- crée 2 comptes (coche « Auto Confirm User ») :
--   • gildaslekajio@icloud.com   avec le mot de passe de Gildas
--   • hlekajio@gmail.com   avec le mot de passe de Harold
-- (mots de passe tous DIFFÉRENTS, et différents de celui de l'admin)
-- ============================================================
