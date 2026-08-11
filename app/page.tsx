'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getRole, login } from '@/lib/auth';

// Groupe WhatsApp de la boutique (bouton "Acheter").
const WHATSAPP = 'https://chat.whatsapp.com/K2UIxb5Cg0QJQuG6QoEx4y?s=hd&p=i&mlu=4&amv=1';

const catVisual = (cat: string) => {
  if (cat === 'phone') return { emoji: '📱', grad: 'from-red-500 to-red-700' };
  if (cat === 'accessory') return { emoji: '🎧', grad: 'from-rose-500 to-rose-700' };
  return { emoji: '📦', grad: 'from-slate-500 to-slate-700' };
};

export default function Storefront() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [code, setCode] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    setIsStaff(!!getRole());
    load();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await login(code);
    if (!r) {
      setLoginError('Mot de passe incorrect');
      return;
    }
    router.push('/admin');
  };

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
          {isStaff ? (
            <Link href="/vitrine" className="text-sm font-semibold text-gray-500 hover:text-gray-800">
              🔧 Espace gestion
            </Link>
          ) : (
            <button
              onClick={() => {
                setLoginError('');
                setCode('');
                setShowLogin(true);
              }}
              className="text-sm font-semibold text-gray-500 hover:text-gray-800"
            >
              Connexion
            </button>
          )}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((p) => {
              const v = catVisual(p.category);
              return (
                <div key={p.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition flex gap-3 p-3">
                  {/* Photo à gauche */}
                  <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-lg overflow-hidden">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={'w-full h-full bg-gradient-to-br ' + v.grad + ' flex items-center justify-center text-4xl'}>
                        {v.emoji}
                      </div>
                    )}
                  </div>

                  {/* Infos à droite */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0 bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        DISPO
                      </span>
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{p.name}</h3>
                    </div>
                    {p.description && (
                      <p className="text-xs text-gray-500 leading-snug line-clamp-1 mt-0.5">{p.description}</p>
                    )}
                    <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] text-red-500 font-semibold leading-none">Prix</div>
                        <div className="text-red-600 font-extrabold text-lg leading-tight truncate">
                          {p.price_fcfa > 0 ? fmt(p.price_fcfa) + ' FCFA' : 'Nous consulter'}
                        </div>
                      </div>
                      <a
                        href={WHATSAPP}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-lg transition"
                      >
                        Acheter
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Popup de connexion (staff) */}
      {showLogin && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Connexion</h2>
              <button
                onClick={() => setShowLogin(false)}
                className="text-gray-400 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                autoFocus
                placeholder="Code d'accès"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (loginError) setLoginError('');
                }}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              {loginError && <p className="text-red-600 text-sm mt-2">{loginError}</p>}
              <button
                type="submit"
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
              >
                Se connecter
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
