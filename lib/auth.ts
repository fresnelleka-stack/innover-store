// Authentification par mot de passe (vérifié par son empreinte SHA-256).
// Le mot de passe en clair n'apparaît PAS dans le code — seulement son empreinte.
// Deux rôles : 'admin' (accès total) et 'vendeur' (vente uniquement).

export type Role = 'admin' | 'vendeur';

const KEY = 'innover_role';

// Empreintes SHA-256 des mots de passe (pas les mots de passe eux-mêmes).
const ADMIN_HASH = 'eec8067554e6eb7b45cd20fb1c5143682abafc35b02bef845f7e5ca41843e582';
const VENDEUR_HASH = '4c7d5e88ae205f519fe348f491cf81e9e5551fcfc47a78f8981ffd5f06727ecd';

export function getRole(): Role | null {
  if (typeof window === 'undefined') return null;
  const r = window.localStorage.getItem(KEY);
  return r === 'admin' || r === 'vendeur' ? r : null;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Vérifie le mot de passe saisi (par empreinte) et enregistre le rôle.
// Renvoie le rôle ou null si le mot de passe est invalide.
export async function login(password: string): Promise<Role | null> {
  const hash = await sha256(password.trim());
  if (hash === ADMIN_HASH) {
    window.localStorage.setItem(KEY, 'admin');
    return 'admin';
  }
  if (hash === VENDEUR_HASH) {
    window.localStorage.setItem(KEY, 'vendeur');
    return 'vendeur';
  }
  return null;
}

export function logout() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
}
