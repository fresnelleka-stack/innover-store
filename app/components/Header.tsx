'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout, changePassword, type Role } from '@/lib/auth';

const NAV = [
  { href: '/seller', label: '🛒 Produit vendu' },
  { href: '/dashboard', label: '📈 Tableau de bord' },
  { href: '/admin', label: '📊 Produits' },
  { href: '/vitrine', label: '📣 Vitrine' },
];

export default function Header({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const doLogout = async () => {
    await logout();
    router.replace('/');
  };

  const openPw = () => {
    setOpen(false);
    setPwCurrent('');
    setPwNew('');
    setPwConfirm('');
    setPwError('');
    setPwDone(false);
    setPwOpen(true);
  };

  const submitPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (pwNew !== pwConfirm) {
      setPwError('Les deux nouveaux mots de passe ne sont pas identiques.');
      return;
    }
    setPwSaving(true);
    const err = await changePassword(pwCurrent, pwNew);
    setPwSaving(false);
    if (err) setPwError(err);
    else setPwDone(true);
  };

  const linkClass = (href: string) =>
    'px-3 py-2 rounded font-semibold text-sm transition ' +
    (pathname === href ? 'bg-blue-600 text-white' : 'text-blue-100 hover:bg-blue-800');

  const mobileLinkClass = (href: string) =>
    'block px-3 py-3 rounded font-semibold transition ' +
    (pathname === href ? 'bg-blue-600 text-white' : 'text-blue-50 hover:bg-blue-800');

  return (
    <header className="bg-blue-900 shadow sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="INNOVER STORE" className="h-9 w-9 rounded-lg object-cover" />
          <span className="text-lg font-bold">
            <span className="text-white">INNOVER</span> <span className="text-red-400">STORE</span>
          </span>
        </Link>

        {/* Menu horizontal (ordinateur) */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={linkClass(n.href)}>
              {n.label}
            </Link>
          ))}
          <span className="ml-2 px-2 py-1 rounded bg-blue-800 text-blue-100 text-xs font-semibold">
            {role === 'admin' ? '👑 Admin' : '🧑‍💼 Vendeur'}
          </span>
          <button
            onClick={openPw}
            className="ml-1 px-3 py-2 rounded font-semibold text-sm text-blue-100 hover:bg-blue-800 transition"
          >
            🔑 Mot de passe
          </button>
          <button
            onClick={doLogout}
            className="ml-1 px-3 py-2 rounded font-semibold text-sm text-red-300 hover:bg-blue-800 transition"
          >
            Déconnexion
          </button>
        </nav>

        {/* Bouton menu (téléphone) */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden text-white text-2xl leading-none px-2"
          aria-label="Menu"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Menu déroulant (téléphone) */}
      {open && (
        <nav className="md:hidden bg-blue-900 border-t border-blue-800 px-4 py-2 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={mobileLinkClass(n.href)}
            >
              {n.label}
            </Link>
          ))}
          <button onClick={openPw} className={mobileLinkClass('#') + ' text-left'}>
            🔑 Changer le mot de passe
          </button>
          <div className="flex items-center justify-between border-t border-blue-800 mt-1 pt-2">
            <span className="px-2 py-1 rounded bg-blue-800 text-blue-100 text-xs font-semibold">
              {role === 'admin' ? '👑 Admin' : '🧑‍💼 Vendeur'}
            </span>
            <button
              onClick={doLogout}
              className="px-3 py-2 rounded font-semibold text-sm text-red-300 hover:bg-blue-800 transition"
            >
              Déconnexion
            </button>
          </div>
        </nav>
      )}

      {/* Fenêtre : changer le mot de passe */}
      {pwOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-gray-900">
            <h2 className="text-xl font-bold mb-1">🔑 Changer le mot de passe</h2>
            <p className="text-sm text-gray-600 mb-4">
              Compte {role === 'admin' ? '👑 Admin' : '🧑‍💼 Vendeur'}
            </p>

            {pwDone ? (
              <>
                <p className="bg-green-50 border-l-4 border-green-500 text-green-800 p-3 rounded mb-4">
                  ✓ Mot de passe changé. Utilise le nouveau à la prochaine connexion.
                </p>
                <button
                  onClick={() => setPwOpen(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
                >
                  Fermer
                </button>
              </>
            ) : (
              <form onSubmit={submitPw} className="space-y-3">
                <input
                  type="password"
                  placeholder="Mot de passe actuel"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full border-2 border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="password"
                  placeholder="Nouveau mot de passe (6 caractères min.)"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full border-2 border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="password"
                  placeholder="Confirmer le nouveau mot de passe"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full border-2 border-gray-300 rounded px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
                />
                {pwError && <p className="text-sm text-red-700">{pwError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPwOpen(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded"
                  >
                    {pwSaving ? '⏳...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
