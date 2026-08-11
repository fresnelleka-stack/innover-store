'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';
import { getRole, type Role } from '@/lib/auth';
import Header from '../components/Header';

type ProductForm = {
  sku: string;
  name: string;
  category: 'phone' | 'accessory' | 'other';
  imei: string;
  cost_xaf: number;
  selling_price_xaf: number;
  quantity_available: number;
};

const emptyFormData: ProductForm = {
  sku: '',
  name: '',
  category: 'phone',
  imei: '',
  cost_xaf: 0,
  selling_price_xaf: 0,
  quantity_available: 0,
};

export default function AdminPanel() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [soldIds, setSoldIds] = useState<string[]>([]);
  const [soldProductIds, setSoldProductIds] = useState<string[]>([]);
  const [imeiWarning, setImeiWarning] = useState('');
  const [formData, setFormData] = useState<ProductForm>(emptyFormData);

  // Détection auto: renvoie le nom du produit qui a déjà cet IMEI, sinon null
  const findImeiOwner = async (imei: string): Promise<string | null> => {
    const clean = imei.trim();
    if (!clean) return null;
    let q = supabase.from('products').select('id, name').eq('imei', clean);
    if (editingId) q = q.neq('id', editingId);
    const { data, error } = await q.limit(1);
    if (error) return null;
    return data && data.length > 0 ? data[0].name : null;
  };

  const checkImei = async (imei: string) => {
    const owner = await findImeiOwner(imei);
    setImeiWarning(owner ? 'Cet IMEI est déjà enregistré (produit : ' + owner + ')' : '');
  };

  useEffect(() => {
    const r = getRole();
    if (!r) {
      router.replace('/login');
      return;
    }
    // Admin ET vendeur ont accès à la gestion des produits (le vendeur ne peut juste pas supprimer).
    setRole(r);
  }, [router]);

  useEffect(() => {
    if (role) loadProducts();
  }, [role]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);

      // Produits ayant déjà au moins une vente → non modifiables
      const { data: soldRows } = await supabase.from('sales').select('product_id');
      const ids = Array.from(
        new Set((soldRows || []).map((r: any) => r.product_id).filter(Boolean))
      ) as string[];
      setSoldProductIds(ids);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSku = (category: string) => {
    const prefix = category === 'phone' ? 'TEL' : category === 'accessory' ? 'ACC' : 'ART';
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return prefix + '-' + rand;
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const imei = formData.imei.trim() === '' ? null : formData.imei.trim();

      // Détection auto: refuser un IMEI déjà présent dans le système
      if (imei) {
        const owner = await findImeiOwner(imei);
        if (owner) {
          setError('Cet IMEI est déjà enregistré dans le système (produit : ' + owner + '). Impossible de l\'ajouter deux fois.');
          return;
        }
      }

      if (editingId) {
        const { data, error } = await supabase
          .from('products')
          .update({ ...formData, imei })
          .eq('id', editingId)
          .select();

        if (error) throw error;
        if (data) setProducts(products.map((p) => (p.id === editingId ? data[0] : p)));
      } else {
        const payload = { ...formData, imei, sku: generateSku(formData.category) };
        const { data, error } = await supabase
          .from('products')
          .insert([payload])
          .select();

        if (error) throw error;
        if (data) setProducts([data[0], ...products]);
      }

      setFormData(emptyFormData);
      setEditingId(null);
      setShowForm(false);
      setImeiWarning('');
    } catch (err: any) {
      if (err?.code === '23505' || (err?.message && err.message.toLowerCase().includes('imei'))) {
        setError('Cet IMEI est déjà enregistré dans le système. Impossible de l\'ajouter deux fois.');
      } else {
        setError(err.message);
      }
    }
  };

  const handleEditClick = (p: Product) => {
    setEditingId(p.id);
    setFormData({
      sku: p.sku,
      name: p.name,
      category: p.category,
      imei: p.imei || '',
      cost_xaf: p.cost_xaf,
      selling_price_xaf: p.selling_price_xaf,
      quantity_available: p.quantity_available,
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyFormData);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Supprimer ce produit et tout son historique de ventes ? (retiré partout, y compris le tableau de bord)')) return;
    try {
      setError('');
      setDeletingId(id);
      // Supprimer d'abord les ventes liées pour qu'il disparaisse aussi du tableau de bord
      const { error: salesError } = await supabase.from('sales').delete().eq('product_id', id);
      if (salesError) throw salesError;
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(products.filter((p) => p.id !== id));
      if (editingId === id) handleCancelForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSell = async (p: Product) => {
    if (p.quantity_available <= 0) {
      alert('Stock épuisé pour ' + p.name);
      return;
    }
    if (!confirm('Confirmer la vente de ' + p.name + ' ?')) return;
    try {
      setError('');
      setSellingId(p.id);

      const { error: saleError } = await supabase.from('sales').insert([{
        product_id: p.id,
        imei: p.imei,
        quantity: 1,
        unit_price_xaf: p.selling_price_xaf,
        total_price_xaf: p.selling_price_xaf,
        profit_xaf: p.selling_price_xaf - p.cost_xaf,
        seller_id: null,
        seller_name: 'Vendeur',
      }]);
      if (saleError) throw saleError;

      const { data, error: updError } = await supabase
        .from('products')
        .update({
          quantity_available: p.quantity_available - 1,
          quantity_sold: (p.quantity_sold || 0) + 1,
        })
        .eq('id', p.id)
        .select();
      if (updError) throw updError;
      if (data) setProducts(products.map((x) => (x.id === p.id ? data[0] : x)));

      setSoldIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSellingId(null);
    }
  };

  // Réapprovisionner : ajoute des pièces au stock (ne touche pas au prix,
  // donc reste possible même sur un produit déjà vendu / au prix figé).
  const handleRestock = async (p: Product) => {
    const input = prompt('Combien de pièces ajouter au stock de « ' + p.name + ' » ?', '1');
    if (input === null) return;
    const n = parseInt(input, 10);
    if (!Number.isFinite(n) || n <= 0) {
      alert('Entrez un nombre valide (supérieur à 0).');
      return;
    }
    try {
      setError('');
      const { data, error } = await supabase
        .from('products')
        .update({ quantity_available: p.quantity_available + n })
        .eq('id', p.id)
        .select();
      if (error) throw error;
      if (data) setProducts(products.map((x) => (x.id === p.id ? data[0] : x)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cellStyle = (id: string) =>
    soldIds.includes(id) ? { backgroundColor: '#bbf7d0' } : undefined;

  // Un produit déjà vendu (au moins une vente) ne peut plus être modifié.
  const isSold = (p: Product) => soldProductIds.includes(p.id) || soldIds.includes(p.id);

  const margin = (cost: number, selling: number) => {
    const profit = selling - cost;
    const percent = cost > 0 ? ((profit / cost) * 100).toFixed(1) : 0;
    return { profit, percent };
  };

  if (!role) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header role={role} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Produits</h1>
          <p className="text-gray-600">Gestion des produits et stock</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={() => (showForm ? handleCancelForm() : setShowForm(true))}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            {showForm ? '✕ Annuler' : '+ Ajouter Produit'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              {editingId ? 'Modifier le produit' : 'Ajouter un nouveau produit'}
            </h2>
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nom du produit"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductForm['category'] })}
                className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              >
                <option value="phone">Téléphone</option>
                <option value="accessory">Accessoire</option>
                <option value="other">Autre</option>
              </select>
              <div>
                <input
                  type="text"
                  placeholder="IMEI (si applicable)"
                  value={formData.imei}
                  onChange={(e) => {
                    setFormData({ ...formData, imei: e.target.value });
                    if (imeiWarning) setImeiWarning('');
                  }}
                  onBlur={(e) => checkImei(e.target.value)}
                  className={
                    'w-full border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400 ' +
                    (imeiWarning ? 'border-red-500' : '')
                  }
                />
                {imeiWarning && (
                  <p className="text-red-600 text-sm mt-1">⚠️ {imeiWarning}</p>
                )}
              </div>
              <input
                type="number"
                min="0"
                placeholder="Prix d'achat (XAF)"
                required
                value={formData.cost_xaf === 0 ? '' : formData.cost_xaf}
                onChange={(e) => setFormData({ ...formData, cost_xaf: parseFloat(e.target.value) || 0 })}
                className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <input
                type="number"
                min="0"
                placeholder="Prix de vente (XAF)"
                required
                value={formData.selling_price_xaf === 0 ? '' : formData.selling_price_xaf}
                onChange={(e) => setFormData({ ...formData, selling_price_xaf: parseFloat(e.target.value) || 0 })}
                className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <input
                type="number"
                min="1"
                placeholder="Quantité (ex: 5)"
                required
                value={formData.quantity_available === 0 ? '' : formData.quantity_available}
                onChange={(e) => setFormData({ ...formData, quantity_available: parseInt(e.target.value) || 0 })}
                className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
                >
                  {editingId ? 'Enregistrer' : 'Ajouter'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Produit</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">IMEI</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Prix Achat</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Prix Vente</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Marge</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Stock</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Aucun produit. Cliquez sur "Ajouter Produit" pour commencer.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const { profit, percent } = margin(p.cost_xaf, p.selling_price_xaf);
                  return (
                    <tr
                      key={p.id}
                      className={'border-b transition-colors ' + (soldIds.includes(p.id) ? '' : 'hover:bg-gray-50')}
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-900" style={cellStyle(p.id)}>{p.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-900" style={cellStyle(p.id)}>{p.imei || '-'}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-900" style={cellStyle(p.id)}>{p.cost_xaf.toLocaleString('fr-CM')} XAF</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-900" style={cellStyle(p.id)}>{p.selling_price_xaf.toLocaleString('fr-CM')} XAF</td>
                      <td className="px-6 py-3 text-sm text-right text-green-600 font-semibold" style={cellStyle(p.id)}>
                        +{profit.toLocaleString('fr-CM')} ({percent}%)
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-bold" style={cellStyle(p.id)}>
                        <span className={p.quantity_available <= 0 ? 'text-red-600' : 'text-gray-900'}>
                          {p.quantity_available}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-right" style={cellStyle(p.id)}>
                        <div className="flex gap-2 justify-end items-center">
                          <button
                            onClick={() => handleSell(p)}
                            disabled={sellingId === p.id || p.quantity_available <= 0}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded disabled:bg-gray-300 disabled:text-gray-500"
                          >
                            {sellingId === p.id ? '...' : p.quantity_available <= 0 ? 'Épuisé' : soldIds.includes(p.id) ? '✓ Vendu' : 'Vendre'}
                          </button>
                          {isSold(p) ? (
                            <span
                              className="text-gray-400 font-semibold"
                              title="Prix figé : article déjà vendu, prix/nom non modifiables (le stock reste réapprovisionnable)"
                            >
                              🔒 figé
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEditClick(p)}
                              className="text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              Modifier
                            </button>
                          )}
                          <button
                            onClick={() => handleRestock(p)}
                            className="text-emerald-600 hover:text-emerald-800 font-semibold"
                            title="Ajouter des pièces au stock (réapprovisionner)"
                          >
                            ➕ Stock
                          </button>
                          {role === 'admin' && (
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              disabled={deletingId === p.id}
                              className="text-red-600 hover:text-red-800 font-semibold disabled:text-gray-400"
                            >
                              {deletingId === p.id ? '...' : 'Supprimer'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
                                                            }
