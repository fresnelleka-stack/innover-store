'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getRole, type Role } from '@/lib/auth';
import Header from '../components/Header';

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

type CatForm = {
  id: string | null;
  name: string;
  category: 'phone' | 'accessory' | 'other';
  description: string;
  price: string;
  image_url: string;
};
const emptyForm: CatForm = { id: null, name: '', category: 'phone', description: '', price: '', image_url: '' };

export default function VitrineAdmin() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CatForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const r = getRole();
    if (!r) {
      router.replace('/login');
      return;
    }
    setRole(r);
  }, [router]);

  useEffect(() => {
    if (role) load();
  }, [role]);

  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => Number(n).toLocaleString('fr-CM');

  const openAdd = () => {
    setError('');
    setForm({ ...emptyForm });
  };
  const openEdit = (p: any) => {
    setError('');
    setForm({
      id: p.id,
      name: p.name || '',
      category: p.category || 'phone',
      description: p.description || '',
      price: p.price_fcfa ? String(p.price_fcfa) : '',
      image_url: p.image_url || '',
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
      const payload: Record<string, any> = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || null,
        price_fcfa: parseFloat(form.price) || 0,
        image_url: form.image_url || null,
      };
      if (form.id) {
        const { error } = await supabase.from('catalog').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('catalog').insert([payload]);
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
    if (!confirm('Retirer « ' + p.name + ' » de la vitrine ?')) return;
    try {
      const { error } = await supabase.from('catalog').delete().eq('id', p.id);
      if (error) throw error;
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!role) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header role={role} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📣 Vitrine (catalogue public)</h1>
            <p className="text-gray-600">Ce que les clients voient sur la page d&apos;accueil — indépendant de ton stock.</p>
          </div>
          <button
            onClick={openAdd}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3 rounded-lg shadow"
          >
            ➕ Ajouter au catalogue
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-500 py-16">Chargement...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-500 py-16">
            Aucun produit dans la vitrine. Clique « Ajouter au catalogue ».
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((p) => {
              const v = catVisual(p.category);
              return (
                <div key={p.id} className="bg-white rounded-xl shadow overflow-hidden flex flex-col relative">
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    <button
                      onClick={() => openEdit(p)}
                      title="Modifier"
                      className="bg-white/90 hover:bg-white text-gray-800 rounded-full w-8 h-8 shadow text-sm"
                    >
                      ✏️
                    </button>
                    {role === 'admin' && (
                      <button
                        onClick={() => remove(p)}
                        title="Retirer"
                        className="bg-white/90 hover:bg-white text-red-600 rounded-full w-8 h-8 shadow text-sm"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-36 w-full object-cover" />
                  ) : (
                    <div className={'h-36 bg-gradient-to-br ' + v.grad + ' flex items-center justify-center text-5xl'}>
                      {v.emoji}
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm">{p.name}</h3>
                    {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                    <div className="mt-1 text-red-600 font-bold">
                      {p.price_fcfa > 0 ? fmt(p.price_fcfa) + ' FCFA' : 'Nous consulter'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Formulaire ajout / modif */}
      {form && (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {form.id ? 'Modifier' : 'Ajouter à la vitrine'}
              </h2>
              <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-700 text-xl">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{error}</div>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-1">📷 Photo</label>
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
                onChange={(e) => setForm({ ...form, category: e.target.value as CatForm['category'] })}
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white"
              >
                <option value="phone">Téléphone</option>
                <option value="accessory">Accessoire</option>
                <option value="other">Autre</option>
              </select>
              <textarea
                rows={2}
                placeholder="Description (facultatif)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <input
                type="number"
                min="0"
                placeholder="Prix affiché (FCFA) — 0 = « Nous consulter »"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
            </div>
            <div className="flex gap-3 px-5 py-3 border-t">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-2 rounded"
              >
                {saving ? 'Enregistrement...' : form.id ? 'Enregistrer' : 'Ajouter'}
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
