'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getRole } from '@/lib/auth';

// Groupe WhatsApp de la boutique (bouton "Acheter").
const WHATSAPP = 'https://chat.whatsapp.com/K2UIxb5Cg0QJQuG6QoEx4y?s=hd&p=i&mlu=4&amv=1';

const catVisual = (cat: string) => {
  if (cat === 'phone') return { emoji: '📱', grad: 'from-red-500 to-red-700' };
  if (cat === 'accessory') return { emoji: '🎧', grad: 'from-rose-500 to-rose-700' };
  return { emoji: '📦', grad: 'from-slate-500 to-slate-700' };
};

export default function Storefront() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    setIsStaff(!!getRole());
    load();
  }, []);

  const load = async () => {
    try {
      const { data } = await supabase
        .from('catalog')
        .select('id, name, description, category, price_fcfa, image_url')
        .order('created_at', { ascending: false });
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => Number(n).toLocaleString('fr-CM');
  const filtered = items.filter((p) => (p.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barre du haut */}
      <header className="bg-white shadow sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="INNOVER STORE" className="h-10 w-10 rounded-lg object-cover" />
            <span className="text-xl font-bold">
              <span className="text-gray-900">INNOVER</span> <span className="text-red-600">STORE</span>
            </span>
          </div>
          <Link
            href={isStaff ? '/vitrine' : '/login'}
            className="text-sm font-semibold text-gray-500 hover:text-gray-800"
          >
            {isStaff ? '🔧 Espace gestion' : 'Connexion'}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-red-600 to-red-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold">Bienvenue chez INNOVER STORE</h1>
          <p className="mt-2 text-red-100">Téléphones · Accessoires · High-Tech — au meilleur prix</p>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 bg-white text-red-700 font-bold px-6 py-3 rounded-full shadow-lg hover:bg-red-50 transition"
          >
            💬 Rejoindre notre WhatsApp
          </a>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <input
            type="text"
            placeholder="🔍 Chercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md border-2 border-gray-300 rounded-full px-5 py-3 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-red-500"
          />
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-16">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-16">
            {search ? 'Aucun produit trouvé.' : 'Aucun produit pour le moment.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => {
              const v = catVisual(p.category);
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl shadow hover:shadow-xl transition overflow-hidden flex flex-col"
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-40 w-full object-cover" />
                  ) : (
                    <div className={'h-40 bg-gradient-to-br ' + v.grad + ' flex items-center justify-center text-6xl'}>
                      {v.emoji}
                    </div>
                  )}
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">{p.name}</h3>
                    {p.description && (
                      <p className="mt-1 text-xs text-gray-500 leading-snug">{p.description}</p>
                    )}
                    <div className="mt-2 text-red-600 font-extrabold text-lg">
                      {p.price_fcfa > 0 ? fmt(p.price_fcfa) + ' FCFA' : 'Nous consulter'}
                    </div>
                    <a
                      href={WHATSAPP}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition"
                    >
                      🛒 Acheter
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
