-- ============================================================
-- VERROUILLAGE DE LA BASE INNOVER STORE (sécurité RLS)
-- À coller dans Supabase → SQL Editor → Run
-- Seuls TES comptes autorisés peuvent accéder aux données.
-- ============================================================

-- 1) Activer la sécurité (Row Level Security) sur les tables
alter table public.products enable row level security;
alter table public.sales    enable row level security;
alter table public.catalog  enable row level security;

-- ------------------------------------------------------------
-- CATALOG (la vitrine publique)
--   • Tout le monde peut VOIR (les clients)
--   • Seuls TES comptes peuvent ajouter / modifier / supprimer
-- ------------------------------------------------------------
drop policy if exists "catalog_lecture_publique" on public.catalog;
create policy "catalog_lecture_publique" on public.catalog
  for select using (true);

drop policy if exists "catalog_ecriture_comptes" on public.catalog;
create policy "catalog_ecriture_comptes" on public.catalog
  for all
  using ( (auth.jwt() ->> 'email') in ('jildasinno@gmail.com','jildasinno+vendeur@gmail.com') )
  with check ( (auth.jwt() ->> 'email') in ('jildasinno@gmail.com','jildasinno+vendeur@gmail.com') );

-- ------------------------------------------------------------
-- PRODUCTS (ton stock interne : IMEI, prix d'achat…)
--   • PRIVÉ : seuls TES comptes peuvent voir et gérer
-- ------------------------------------------------------------
drop policy if exists "products_comptes_seulement" on public.products;
create policy "products_comptes_seulement" on public.products
  for all
  using ( (auth.jwt() ->> 'email') in ('jildasinno@gmail.com','jildasinno+vendeur@gmail.com') )
  with check ( (auth.jwt() ->> 'email') in ('jildasinno@gmail.com','jildasinno+vendeur@gmail.com') );

-- ------------------------------------------------------------
-- SALES (tes ventes et bénéfices)
--   • PRIVÉ : seuls TES comptes peuvent voir et gérer
-- ------------------------------------------------------------
drop policy if exists "sales_comptes_seulement" on public.sales;
create policy "sales_comptes_seulement" on public.sales
  for all
  using ( (auth.jwt() ->> 'email') in ('jildasinno@gmail.com','jildasinno+vendeur@gmail.com') )
  with check ( (auth.jwt() ->> 'email') in ('jildasinno@gmail.com','jildasinno+vendeur@gmail.com') );

-- ============================================================
-- FIN. Personne (à part tes 2 comptes connectés) ne peut lire
-- tes ventes, modifier tes prix ou effacer tes produits.
-- La vitrine publique reste visible par les clients.
-- ============================================================
