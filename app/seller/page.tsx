'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';
import { getRole, type Role } from '@/lib/auth';
import Header from '../components/Header';

export default function SellerPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [recentSales, setRecentSales] = useState<any[]>([]);
  // Prix de vente saisi par le vendeur pour chaque produit (pré-rempli avec le prix enregistré).
  const [priceInputs, setPriceInputs] = useState<Record<string, number>>({});

  useEffect(() => {
    const r = getRole();
    if (!r) {
      router.replace('/login');
      return;
    }
    setRole(r);
  }, [router]);

  useEffect(() => {
    if (!role) return;
    loadProducts();
    loadRecentSales();
  }, [role]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .gt('quantity_available', 0)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
      // Pré-remplir chaque prix avec le prix de vente enregistré (le vendeur peut le changer).
      setPriceInputs((prev) => {
        const next = { ...prev };
        (data || []).forEach((p: Product) => {
          if (next[p.id] === undefined) next[p.id] = p.selling_price_xaf;
        });
        return next;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, products(name)')
        .order('sold_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      setRecentSales(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.imei && p.imei.includes(searchTerm))
  );

  const handleSell = async (p: Product) => {
    if (p.quantity_available <= 0) return;
    const price = Number(priceInputs[p.id] ?? p.selling_price_xaf);
    if (!Number.isFinite(price) || price <= 0) {
      alert('Entrez un prix de vente valide pour ' + p.name + '.');
      return;
    }
    if (!confirm('Vendre ' + p.name + ' à ' + price.toLocaleString('fr-CM') + ' XAF ?')) return;
    try {
      setError('');
      setSellingId(p.id);

      const { error: saleError } = await supabase.from('sales').insert([{
        product_id: p.id,
        imei: p.imei,
        quantity: 1,
        unit_price_xaf: price,
        total_price_xaf: price,
        profit_xaf: price - p.cost_xaf,
        seller_id: null,
        seller_name: 'Vendeur',
      }]);
      if (saleError) throw saleError;

      const { error: updError } = await supabase
        .from('products')
        .update({
          quantity_available: p.quantity_available - 1,
          quantity_sold: (p.quantity_sold || 0) + 1,
        })
        .eq('id', p.id);
      if (updError) throw updError;

      loadProducts();
      loadRecentSales();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSellingId(null);
    }
  };

  if (!role) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header role={role} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Point de Vente</h1>
          <p className="text-gray-600">Enregistrer une vente</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <input
            type="text"
            placeholder="Chercher par nom ou IMEI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-2 border-gray-300 rounded px-4 py-3 text-lg text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Chargement des produits...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              {searchTerm ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-gray-900">{product.name}</h3>
                    {product.imei && <p className="text-sm text-gray-600 truncate">IMEI: {product.imei}</p>}
                    <p className="text-xs text-gray-500 mt-1">
                      Prix conseillé : {product.selling_price_xaf.toLocaleString('fr-CM')} XAF · Stock :{' '}
                      <span className="font-semibold text-gray-900">{product.quantity_available}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <label className="block text-xs text-gray-500 mb-1">Prix de vente (XAF)</label>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={priceInputs[product.id] ?? product.selling_price_xaf}
                      onChange={(e) =>
                        setPriceInputs((prev) => ({
                          ...prev,
                          [product.id]: e.target.value === '' ? 0 : parseFloat(e.target.value),
                        }))
                      }
                      className="w-32 border-2 border-gray-300 rounded px-3 py-2 text-right text-gray-900 bg-white focus:outline-none focus:border-green-500 mb-2"
                    />
                    <button
                      onClick={() => handleSell(product)}
                      disabled={sellingId === product.id || product.quantity_available === 0}
                      className="block w-32 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded transition"
                    >
                      {sellingId === product.id ? '...' : 'Vendre'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ventes récentes */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">🧾 Ventes récentes</h2>
          {recentSales.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Aucune vente pour le moment</p>
          ) : (
            <div className="divide-y">
              {recentSales.map((sale) => {
                const d = new Date(sale.sold_at);
                const when =
                  d.toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' }) +
                  ' - ' +
                  d.toLocaleDateString('fr-CM', { day: '2-digit', month: '2-digit' });
                return (
                  <div key={sale.id} className="flex justify-between items-center py-3">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">
                        {sale.products?.name || 'Produit supprimé'}
                        {sale.quantity > 1 ? ' x' + sale.quantity : ''}
                      </p>
                      {sale.imei && <p className="text-xs text-gray-600">IMEI: {sale.imei}</p>}
                      <p className="text-xs text-gray-500">{when}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">{Number(sale.total_price_xaf).toLocaleString('fr-CM')} XAF</p>
                      <p className="text-xs text-green-600">+{Number(sale.profit_xaf).toLocaleString('fr-CM')} profit</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
