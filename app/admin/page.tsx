'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';

export default function AdminPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'phone' as const,
    imei: '',
    cost_xaf: 0,
    selling_price_xaf: 0,
    quantity_available: 0,
  });

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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([formData])
        .select();

      if (error) throw error;
      if (data) setProducts([data[0], ...products]);

      setFormData({
        sku: '',
        name: '',
        category: 'phone',
        imei: '',
        cost_xaf: 0,
        selling_price_xaf: 0,
        quantity_available: 0,
      });
      setShowForm(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const margin = (cost: number, selling: number) => {
    const profit = selling - cost;
    const percent = cost > 0 ? ((profit / cost) * 100).toFixed(1) : 0;
    return { profit, percent };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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

        {/* Add Product Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            {showForm ? '✕ Annuler' : '+ Ajouter Produit'}
          </button>
        </div>

        {/* Add Product Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Ajouter un nouveau produit</h2>
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="SKU (ref unique)"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="border rounded px-3 py-2"
              />
              <input
                type="text"
                placeholder="Nom du produit"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="border rounded px-3 py-2"
              />
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="border rounded px-3 py-2"
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
                className="border rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder="Prix d'achat (XAF)"
                required
                value={formData.cost_xaf}
                onChange={(e) => setFormData({ ...formData, cost_xaf: parseFloat(e.target.value) })}
                className="border rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder="Prix de vente (XAF)"
                required
                value={formData.selling_price_xaf}
                onChange={(e) => setFormData({ ...formData, selling_price_xaf: parseFloat(e.target.value) })}
                className="border rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder="Quantité"
                required
                value={formData.quantity_available}
                onChange={(e) => setFormData({ ...formData, quantity_available: parseInt(e.target.value) })}
                className="border rounded px-3 py-2"
              />
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
              >
                Ajouter
              </button>
            </form>
          </div>
        )}

        {/* Products List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">SKU</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Produit</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">IMEI</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Prix Achat</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Prix Vente</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Marge</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Stock</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Vendu</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Aucun produit. Cliquez sur "Ajouter Produit" pour commencer.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const { profit, percent } = margin(p.cost_xaf, p.selling_price_xaf);
                  return (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium">{p.sku}</td>
                      <td className="px-6 py-3 text-sm">{p.name}</td>
                      <td className="px-6 py-3 text-sm">{p.imei || '-'}</td>
                      <td className="px-6 py-3 text-sm text-right">{p.cost_xaf.toLocaleString('fr-CM')} XAF</td>
                      <td className="px-6 py-3 text-sm text-right">{p.selling_price_xaf.toLocaleString('fr-CM')} XAF</td>
                      <td className="px-6 py-3 text-sm text-right text-green-600 font-semibold">
                        +{profit.toLocaleString('fr-CM')} ({percent}%)
                      </td>
                      <td className="px-6 py-3 text-sm text-right">{p.quantity_available}</td>
                      <td className="px-6 py-3 text-sm text-right">{p.quantity_sold || 0}</td>
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
