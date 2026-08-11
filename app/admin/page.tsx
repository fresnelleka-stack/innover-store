'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductForm>(emptyFormData);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
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
    } catch (err: any) {
      setError(err.message);
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
    if (!confirm('Supprimer ce produit definitivement ?')) return;
    try {
      setError('');
      setDeletingId(id);
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

  const margin = (cost: number, selling: number) => {
    const profit = selling - cost;
    const percent = cost > 0 ? ((profit / cost) * 100).toFixed(1) : 0;
    return { profit, percent };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600">Gestion des produits et stock</p>
          </div>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Retour
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
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
              <input
                type="text"
                placeholder="IMEI (si applicable)"
                value={formData.imei}
                onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <input
                type="number"
                placeholder="Prix d'achat (XAF)"
                required
                value={formData.cost_xaf}
                onChange={(e) => setFormData({ ...formData, cost_xaf: parseFloat(e.target.value) })}
                className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <input
                type="number"
                placeholder="Prix de vente (XAF)"
                required
                value={formData.selling_price_xaf}
                onChange={(e) => setFormData({ ...formData, selling_price_xaf: parseFloat(e.target.value) })}
                className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
              />
              <input
                type="number"
                placeholder="Quantité"
                required
                value={formData.quantity_available}
                onChange={(e) => setFormData({ ...formData, quantity_available: parseInt(e.target.value) })}
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
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Aucun produit. Cliquez sur "Ajouter Produit" pour commencer.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const { profit, percent } = margin(p.cost_xaf, p.selling_price_xaf);
                  return (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-900">{p.imei || '-'}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-900">{p.cost_xaf.toLocaleString('fr-CM')} XAF</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-900">{p.selling_price_xaf.toLocaleString('fr-CM')} XAF</td>
                      <td className="px-6 py-3 text-sm text-right text-green-600 font-semibold">
                        +{profit.toLocaleString('fr-CM')} ({percent}%)
                      </td>
                      <td className="px-6 py-3 text-sm text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEditClick(p)}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            disabled={deletingId === p.id}
                            className="text-red-600 hover:text-red-800 font-semibold disabled:text-gray-400"
                          >
                            {deletingId === p.id ? '...' : 'Supprimer'}
                          </button>
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
