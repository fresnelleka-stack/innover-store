'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getRole, type Role } from '@/lib/auth';
import Header from './components/Header';

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const r = getRole();
    if (!r) {
      router.replace('/login');
      return;
    }
    setRole(r);
  }, [router]);

  if (!role) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header role={role} />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Bienvenue</h1>
          <p className="text-gray-600 mt-1">
            {role === 'admin' ? 'Accès administrateur (complet)' : 'Accès vendeur'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/seller"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-6 px-4 rounded-lg text-center text-lg transition"
          >
            🛒 Vendre un Article
          </Link>

          <Link
            href="/dashboard"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-6 px-4 rounded-lg text-center text-lg transition"
          >
            📈 Tableau de Bord
          </Link>

          <Link
            href="/admin"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 px-4 rounded-lg text-center text-lg transition sm:col-span-2"
          >
            📊 Gérer les Produits
          </Link>
        </div>
      </main>
    </div>
  );
}
