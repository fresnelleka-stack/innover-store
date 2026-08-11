'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getRole, type Role } from '@/lib/auth';

// Groupe WhatsApp de la boutique (bouton "Acheter").
const WHATSAPP = 'https://chat.whatsapp.com/K2UIxb5Cg0QJQuG6QoEx4y?s=hd&p=i&mlu=4&amv=1';
const DESC_SEP = '|~|';

const parseDesc = (sku: string | null | undefined): string => {
  const s = sku || '';
  const i = s.indexOf(DESC_SEP);
  return i >= 0 ? s.slice(i + DESC_SEP.length) : '';
};
const genCode = (cat: string) => {
  const p = cat === 'phone' ? 'TEL' : cat === 'accessory' ? 'ACC' : 'ART';
  return p + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
};
const catVisual = (cat: string) => {
  if (cat === 'phone') return { emoji: '📱', grad: 'from-red-500 to-red-700' };
  if (cat === 'accessory') return { emoji: '🎧', grad: 'from-rose-500 to-rose-700' };
  return { emoji: '📦', grad: 'from-slate-500 to-slate-700' };
};

// Compresse une photo (max 700px, JPEG ~72%) → data URL léger.
const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('lecture'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image'));
      img.onload = () => {
        const max = 700;
        let { width, height } = img;
        if (width > max || height > max) {
          if (width >= height) {
            height = Math.round((height * max) / width);
            width = max;
          } else {
            width = Math.round((width * max) / height);
            height = max;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

type FormState = {
  id: string | null;
  name: string;
  category: 'phone' | 'accessory' | 'other';
  description: string;
  cost: string;
  price: string;
  quantity: string;
  image_url: string;
  hasImei: boolean;
};
const emptyForm: FormState = {
  id: null,
  name: '',
  category: 'phone',
  description: '',
  cost: '',
  price: '',
  quantity: '',
  image_url: '',
  hasImei: false,
};

export default function Storefront() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setRole(getRole());
    load();
  }, []);

  const load = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, category, selling_price_xaf, cost_xaf, quantity_available, sku, imei, image_url')
        .gt('quantity_available', 0)
        .order('created_at', { ascending: false });
      setProducts(data || []);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => Number(n).toLocaleString('fr-CM');
  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const isStaff = !!role;
  const isAdmin = role === 'admin';

  const openAdd = () => {
    setError('');
    setForm({ ...emptyForm });
  };
  const openEdit = (p: any) => {
    setError('');
    setForm({
      id: p.id,
      name: p.name,
      category: p.category,
      description: parseDesc(p.sku),
      cost: p.cost_xaf ? String(p.cost_xaf) : '',
      price: p.selling_price_xaf ? String(p.selling_price_xaf) : '',
      quantity: String(p.quantity_available ?? ''),
      image_url: p.image_url || '',
      hasImei: !!(p.imei && String(p.imei).trim()),
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const desc = (form.description || '').split(DESC_SEP).join('/').trim();
      const code = genCode(form.category);
      const sku = desc ? code + DESC_SEP + desc : code;
      const payload: Record<string, any> = {
        name: form.name.trim(),
        category: form.category,
        sku,
        cost_xaf: parseFloat(form.cost) || 0,
        selling_price_xaf: parseFloat(form.price) || 0,
        image_url: form.image_url || null,
      };
      // On ne touche au stock que pour les produits SANS IMEI (sinon géré dans /admin).
      if (!form.hasImei) payload.quantity_available = parseInt(form.quantity, 10) || 0;

      if (form.id) {
        const { error } = await supabase.from('products').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([{ ...payload, quantity_sold: 0 }]);
        if (error) throw error;
      }
      setForm(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: any) => {
    if (!confirm('Supprimer définitivement « ' + p.name + ' » du site ?')) return;
    try {
      await supabase.from('sales').delete().eq('product_id', p.id);
      const { error } = await supabase.from('products').delete().eq('id', p.id);
      if (error) throw error;
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err: any) {
      alert(err.message);
    }
  };

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
            <Link href="/admin" className="text-sm font-semibold text-gray-500 hover:text-gray-800">
              🔧 Gestion avancée
            </Link>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-gray-500 hover:text-gray-800">
              Connexion
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-red-600 to-red-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 text-center">
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
        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            type="text"
            placeholder="🔍 Chercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-md border-2 border-gray-300 rounded-full px-5 py-3 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-red-500"
          />
          {isStaff && (
            <button
              onClick={openAdd}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3 rounded-full shadow whitespace-nowrap"
            >
              ➕ Ajouter un produit
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-16">Chargement des produits...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-16">
            {search ? 'Aucun produit trouvé.' : 'Aucun produit disponible pour le moment.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => {
              const v = catVisual(p.category);
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl shadow hover:shadow-xl transition overflow-hidden flex flex-col relative"
                >
                  {isStaff && (
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      <button
                        onClick={() => openEdit(p)}
                        title="Modifier"
                        className="bg-white/90 hover:bg-white text-gray-800 rounded-full w-8 h-8 shadow text-sm"
                      >
                        ✏️
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => remove(p)}
                          title="Supprimer"
                          className="bg-white/90 hover:bg-white text-red-600 rounded-full w-8 h-8 shadow text-sm"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  )}
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
                    {parseDesc(p.sku) && (
                      <p className="mt-1 text-xs text-gray-500 leading-snug">{parseDesc(p.sku)}</p>
                    )}
                    <div className="mt-1 text-xs text-green-600 font-semibold">✓ Disponible</div>
                    <div className="mt-2 text-red-600 font-extrabold text-lg">
                      {p.selling_price_xaf > 0 ? fmt(p.selling_price_xaf) + ' FCFA' : 'Nous consulter'}
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

      {/* Formulaire d'ajout / modification (staff) */}
      {form && (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {form.id ? 'Modifier le produit' : 'Nouveau produit'}
              </h2>
              <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-700 text-xl">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{error}</div>
              )}

              {/* Photo */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">📷 Photo du produit</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const d = await compressImage(f);
                        setForm((prev) => (prev ? { ...prev, image_url: d } : prev));
                      } catch {
                        alert('Photo invalide.');
                      }
                    }}
                    className="text-sm text-gray-700"
                  />
                  {form.image_url && (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.image_url} alt="aperçu" className="h-16 w-16 object-cover rounded border" />
                      <button
                        type="button"
                        onClick={() => setForm((prev) => (prev ? { ...prev, image_url: '' } : prev))}
                        className="text-red-600 text-sm font-semibold"
                      >
                        Retirer
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <input
                type="text"
                placeholder="Nom du produit *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as FormState['category'] })}
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white"
              >
                <option value="phone">Téléphone</option>
                <option value="accessory">Accessoire</option>
                <option value="other">Autre</option>
              </select>
              <textarea
                rows={2}
                placeholder="Infos / description (état, capacité, garantie…)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="0"
                  placeholder="Prix d'achat (privé)"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Prix public (FCFA)"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
                />
              </div>
              {form.hasImei ? (
                <p className="text-xs text-gray-400">
                  Stock géré par IMEI dans « Gestion avancée » (non modifiable ici).
                </p>
              ) : (
                <input
                  type="number"
                  min="0"
                  placeholder="Quantité en stock"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
                />
              )}
            </div>
            <div className="flex gap-3 px-5 py-3 border-t">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-2 rounded"
              >
                {saving ? 'Enregistrement...' : form.id ? 'Enregistrer' : 'Ajouter le produit'}
              </button>
              <button
                onClick={() => setForm(null)}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
