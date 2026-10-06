// Authentification RÉELLE via Supabase Auth (vérifiée côté serveur).
// Le mot de passe n'est PAS dans le code : il est stocké (chiffré) par Supabase.
// Deux comptes : admin (accès total) et vendeur (vente + ajout, mais pas de suppression).

import { supabase } from './supabase';

export type Role = 'admin' | 'vendeur';

// Emails des comptes (ce ne sont PAS des secrets : la sécurité vient du mot de passe
// vérifié par le serveur + le verrouillage de la base RLS).
// ⚠️ Ces emails doivent correspondre EXACTEMENT aux comptes créés dans Supabase.
const ADMIN_EMAIL = 'jildasinno@gmail.com';
const VENDEUR_EMAIL = 'jildasinno+vendeur@gmail.com';

// Retrouve le rôle à partir de l'email connecté.
function roleForEmail(email: string | null | undefined): Role | null {
  const e = (email || '').toLowerCase();
  if (e === ADMIN_EMAIL.toLowerCase()) return 'admin';
  if (e === VENDEUR_EMAIL.toLowerCase()) return 'vendeur';
  return null;
}

// Connexion : on saisit seulement le mot de passe.
// On essaie d'abord le compte admin, puis le compte vendeur.
export async function login(password: string): Promise<Role | null> {
  const pass = password.trim();
  for (const email of [ADMIN_EMAIL, VENDEUR_EMAIL]) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (!error && data.user) return roleForEmail(data.user.email);
  }
  return null;
}

// Rôle courant d'après la session active.
export async function getRole(): Promise<Role | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ? roleForEmail(data.session.user.email) : null;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
