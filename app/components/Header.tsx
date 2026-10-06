'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout, type Role } from '@/lib/auth';

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

  const doLogout = async () => {
    await logout();
    router.replace('/');
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
    </header>
  );
}
