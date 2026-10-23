// Authentification RÉELLE via Supabase Auth (vérifiée côté serveur).
// Le mot de passe n'est PAS dans le code : il est stocké (chiffré) par Supabase.
// Un compte admin (accès total) + un compte PERSONNEL par vendeur (une boutique chacun) :
// chaque vente est enregistrée au nom de celui qui est connecté.

import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Role = 'admin' | 'vendeur';

export type Account = { email: string; role: Role; name: string };

// Emails des comptes (ce ne sont PAS des secrets : la sécurité vient du mot de passe
// vérifié par le serveur + le verrouillage de la base RLS).
// ⚠️ Ces emails doivent correspondre EXACTEMENT aux comptes créés dans Supabase
// et à la liste dans supabase-vendeurs.sql.
export const ADMIN_EMAIL = 'jildasinno@gmail.com';

export const SELLERS: Account[] = [
  { email: 'jildasinno+gildas@gmail.com', role: 'vendeur', name: 'Gildas' },
  { email: 'jildasinno+harold@gmail.com', role: 'vendeur', name: 'Harold' },
];

const ACCOUNTS: Account[] = [{ email: ADMIN_EMAIL, role: 'admin', name: 'Admin' }, ...SELLERS];

function accountForEmail(email: string | null | undefined): Account | null {
  const e = (email || '').toLowerCase();
  return ACCOUNTS.find((a) => a.email.toLowerCase() === e) || null;
}

// Nom à afficher pour une vente / dépense d'après l'email enregistré dessus.
// Les ventes faites avant les comptes personnels n'ont pas d'email.
export function sellerLabel(email: string | null | undefined): string {
  if (!email) return 'Avant (compte commun)';
  return accountForEmail(email)?.name || email;
}

// Connexion : on saisit seulement le mot de passe.
// On l'essaie sur chaque compte (admin puis vendeurs).
export async function login(password: string): Promise<Role | null> {
  const pass = password.trim();
  for (const { email } of ACCOUNTS) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (!error && data.user) return accountForEmail(data.user.email)?.role || null;
  }
  return null;
}

// Compte courant d'après la session active.
export async function getAccount(): Promise<Account | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ? accountForEmail(data.session.user.email) : null;
}

// Rôle courant d'après la session active.
export async function getRole(): Promise<Role | null> {
  return (await getAccount())?.role || null;
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
  const me = accountForEmail(email);
  if (!email || !me) return 'Session expirée : reconnecte-toi.';

  const newPass = next.trim();
  if (newPass.length < 6) return 'Le nouveau mot de passe doit faire au moins 6 caractères.';
  if (newPass === current.trim()) return "Le nouveau mot de passe doit être différent de l'ancien.";

  if (!(await passwordWorks(email, current.trim()))) {
    return 'Mot de passe actuel incorrect.';
  }

  // La connexion se fait avec le mot de passe seul : tous les comptes
  // doivent donc avoir des mots de passe DIFFÉRENTS.
  for (const other of ACCOUNTS) {
    if (other.email === me.email) continue;
    if (await passwordWorks(other.email, newPass)) {
      return 'Ce mot de passe est déjà utilisé par un autre compte. Choisis-en un autre.';
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPass });
  return error ? error.message : null;
}
