// Authentification RÉELLE via Supabase Auth (vérifiée côté serveur).
// Le mot de passe n'est PAS dans le code : il est stocké (chiffré) par Supabase.
// Deux comptes : admin (accès total) et vendeur (vente + ajout, mais pas de suppression).

import { createClient } from '@supabase/supabase-js';
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

// Client temporaire, sans session enregistrée : sert uniquement à VÉRIFIER un
// mot de passe sans toucher à la session de la personne connectée.
function checkClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'innover-check' } }
  );
}

async function passwordWorks(email: string, password: string): Promise<boolean> {
  const c = checkClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  // 'local' : ne ferme QUE cette vérification, pas les sessions ouvertes ailleurs.
  await c.auth.signOut({ scope: 'local' });
  return true;
}

// Changer le mot de passe du compte connecté.
// Renvoie un message d'erreur, ou null si tout s'est bien passé.
export async function changePassword(current: string, next: string): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  const role = roleForEmail(email);
  if (!email || !role) return 'Session expirée : reconnecte-toi.';

  const newPass = next.trim();
  if (newPass.length < 6) return 'Le nouveau mot de passe doit faire au moins 6 caractères.';
  if (newPass === current.trim()) return "Le nouveau mot de passe doit être différent de l'ancien.";

  if (!(await passwordWorks(email, current.trim()))) {
    return 'Mot de passe actuel incorrect.';
  }

  // La connexion se fait avec le mot de passe seul : les deux comptes
  // doivent donc avoir des mots de passe DIFFÉRENTS.
  const otherEmail = role === 'admin' ? VENDEUR_EMAIL : ADMIN_EMAIL;
  if (await passwordWorks(otherEmail, newPass)) {
    return "Ce mot de passe est déjà utilisé par l'autre compte. Choisis-en un autre.";
  }

  const { error } = await supabase.auth.updateUser({ password: newPass });
  return error ? error.message : null;
}
