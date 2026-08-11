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
  const adminCode = process.env.NEXT_PUBLIC_ADMIN_CODE;
  const vendeurCode = process.env.NEXT_PUBLIC_VENDEUR_CODE;
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
