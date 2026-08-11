'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout, type Role } from '@/lib/auth';

export default function Header({ role }: { role: Role }) {
  const router = useRouter();
  const pathname = usePathname();

  const doLogout = () => {
    logout();
    router.replace('/login');
  };

  const linkClass = (href: string) =>
    'px-3 py-2 rounded font-semibold text-sm transition ' +
    (pathname === href
      ? 'bg-blue-600 text-white'
      : 'text-gray-700 hover:bg-gray-100');

  return (
    <header className="bg-white shadow sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-xl font-bold text-gray-900">
          INNOVER STORE
        </Link>

        <nav className="flex items-center gap-1 flex-wrap">
          <Link href="/seller" className={linkClass('/seller')}>
            🛒 Vente
          </Link>
          <Link href="/dashboard" className={linkClass('/dashboard')}>
            📈 Tableau de bord
          </Link>
          {role === 'admin' && (
            <Link href="/admin" className={linkClass('/admin')}>
              📊 Produits
            </Link>
          )}
          <span className="ml-2 px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-semibold">
            {role === 'admin' ? '👑 Admin' : '🧑‍💼 Vendeur'}
          </span>
          <button
            onClick={doLogout}
            className="ml-1 px-3 py-2 rounded font-semibold text-sm text-red-600 hover:bg-red-50 transition"
          >
            Déconnexion
          </button>
        </nav>
      </div>
    </header>
  );
}
