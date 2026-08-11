// Authentification simple par code d'accès + rôle (stocké côté navigateur).
// Deux rôles: 'admin' (accès total) et 'vendeur' (vente uniquement).

export type Role = 'admin' | 'vendeur';

const KEY = 'innover_role';

export function getRole(): Role | null {
  if (typeof window === 'undefined') return null;
  const r = window.localStorage.getItem(KEY);
  return r === 'admin' || r === 'vendeur' ? r : null;
}

// Vérifie le code saisi et enregistre le rôle. Renvoie le rôle ou null si code invalide.
export function login(code: string): Role | null {
  // Valeurs de repli pour que la connexion marche même si Netlify n'a pas les variables.
  // Ces codes sont NEXT_PUBLIC_* (déjà visibles côté navigateur), donc pas de secret réel ici.
  const adminCode = process.env.NEXT_PUBLIC_ADMIN_CODE || 'Admin2026';
  const vendeurCode = process.env.NEXT_PUBLIC_VENDEUR_CODE || 'Vente2026';
  const clean = code.trim();
  if (adminCode && clean === adminCode) {
    window.localStorage.setItem(KEY, 'admin');
    return 'admin';
  }
  if (vendeurCode && clean === vendeurCode) {
    window.localStorage.setItem(KEY, 'vendeur');
    return 'vendeur';
  }
  return null;
}

export function logout() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
}
