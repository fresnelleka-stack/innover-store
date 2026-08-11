'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getRole, type Role } from '@/lib/auth';
import Header from '../components/Header';

export default function Dashboard() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [dateRange, setDateRange] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState<any[]>([]);
  const [stockRemaining, setStockRemaining] = useState(0);
  const [productStocks, setProductStocks] = useState<any[]>([]);
  const [stockSearch, setStockSearch] = useState('');

  useEffect(() => {
    const r = getRole();
    if (!r) {
      router.replace('/login');
      return;
    }
    setRole(r);
  }, [router]);

  useEffect(() => {
    if (role) loadData();
  }, [dateRange, role]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      let cutoff: string | null = null;
      const now = new Date();
      if (dateRange === 'today') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (dateRange === 'week') {
        cutoff = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      } else if (dateRange === 'month') {
        cutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
      }

      let query = supabase
        .from('sales')
        .select('*, products(name)')
        .order('sold_at', { ascending: false });
      if (cutoff) query = query.gte('sold_at', cutoff);

      const { data: salesData, error: salesErr } = await query;
      if (salesErr) throw salesErr;
      setSales(salesData || []);

      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('id, name, imei, category, quantity_available, quantity_sold')
        .order('name', { ascending: true });
      if (prodErr) throw prodErr;
      setProductStocks(prodData || []);
      setStockRemaining((prodData || []).reduce((s: number, p: any) => s + (p.quantity_available || 0), 0));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = sales.reduce((s, x) => s + Number(x.total_price_xaf || 0), 0);
  const totalProfit = sales.reduce((s, x) => s + Number(x.profit_xaf || 0), 0);
  const itemsSold = sales.reduce((s, x) => s + Number(x.quantity || 0), 0);
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

  const byProduct: Record<string, { name: string; sold: number; revenue: number; profit: number }> = {};
  for (const s of sales) {
    const name = s.products?.name || 'Produit supprimé';
    if (!byProduct[name]) byProduct[name] = { name, sold: 0, revenue: 0, profit: 0 };
    byProduct[name].sold += Number(s.quantity || 0);
    byProduct[name].revenue += Number(s.total_price_xaf || 0);
    byProduct[name].profit += Number(s.profit_xaf || 0);
  }
  const topProducts = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const maxSold = topProducts.reduce((m, p) => Math.max(m, p.sold), 0) || 1;

  const fmt = (n: number) => n.toLocaleString('fr-CM');
  const timeOf = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' }) +
      ' - ' +
      d.toLocaleDateString('fr-CM', { day: '2-digit', month: '2-digit' })
    );
  };

  if (!role) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header role={role} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-600">Statistiques et rapports</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Date Range Selector */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {[
            { value: 'today', label: "Aujourd'hui" },
            { value: 'week', label: 'Semaine' },
            { value: 'month', label: 'Mois' },
            { value: 'all', label: 'Tout' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setDateRange(option.value)}
              className={
                'px-4 py-2 rounded font-semibold transition ' +
                (dateRange === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100')
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Revenu Total</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{fmt(totalRevenue)} XAF</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Profit Total</p>
            <p className="text-2xl font-bold text-green-600 mt-2">{fmt(totalProfit)} XAF</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Articles Vendus</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">{itemsSold}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Stock Restant</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">{stockRemaining}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Marge Moyenne</p>
            <p className="text-2xl font-bold text-indigo-600 mt-2">{profitMargin}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Products */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">📊 Top Produits</h2>
            {loading ? (
              <p className="text-gray-500 text-center py-6">Chargement...</p>
            ) : topProducts.length === 0 ? (
              <p className="text-gray-500 text-center py-6">Aucune vente sur cette période</p>
            ) : (
              <div className="space-y-4">
                {topProducts.map((product, idx) => (
                  <div key={idx} className="border-b pb-4 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.sold} vendu(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600">{fmt(product.revenue)} XAF</p>
                        <p className="text-sm text-green-600">+{fmt(product.profit)} profit</p>
                      </div>
                    </div>
                    <div className="mt-2 bg-gray-200 rounded h-2 overflow-hidden">
                      <div className="bg-blue-600 h-full" style={{ width: (product.sold / maxSold) * 100 + '%' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Sales */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">🛒 Ventes Récentes</h2>
            {loading ? (
              <p className="text-gray-500 text-center py-6">Chargement...</p>
            ) : sales.length === 0 ? (
              <p className="text-gray-500 text-center py-6">Aucune vente sur cette période</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sales.slice(0, 20).map((sale) => (
                  <div key={sale.id} className="border-b pb-3 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">
                          {sale.products?.name || 'Produit supprimé'}
                          {sale.quantity > 1 ? ' x' + sale.quantity : ''}
                        </p>
                        {sale.imei && <p className="text-xs text-gray-600">IMEI: {sale.imei}</p>}
                        <p className="text-xs text-gray-500">{timeOf(sale.sold_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600">{fmt(Number(sale.total_price_xaf))} XAF</p>
                        <p className="text-xs text-green-600">+{fmt(Number(sale.profit_xaf))}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stock par produit */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">📦 Stock par produit</h2>
            <input
              type="text"
              placeholder="Chercher un produit..."
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              className="border-2 border-gray-300 rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          {loading ? (
            <p className="text-gray-500 text-center py-6">Chargement...</p>
          ) : productStocks.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Aucun produit</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-2 font-semibold text-gray-700">Produit</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-700">Vendus</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-700">Stock restant</th>
                  </tr>
                </thead>
                <tbody>
                  {productStocks
                    .filter(
                      (p) =>
                        p.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
                        (p.imei && String(p.imei).includes(stockSearch))
                    )
                    .map((p) => (
                      <tr key={p.id} className="border-b last:border-b-0">
                        <td className="py-2 px-2">
                          <span className="font-medium text-gray-900">{p.name}</span>
                          {p.imei && <span className="text-xs text-gray-500 ml-2">IMEI: {p.imei}</span>}
                        </td>
                        <td className="py-2 px-2 text-right text-gray-600">{p.quantity_sold || 0}</td>
                        <td className="py-2 px-2 text-right font-bold">
                          <span
                            className={
                              p.quantity_available <= 0
                                ? 'text-red-600'
                                : p.quantity_available <= 2
                                ? 'text-orange-500'
                                : 'text-green-600'
                            }
                          >
                            {p.quantity_available}
                          </span>
                          {p.quantity_available <= 0 && (
                            <span className="ml-2 text-xs text-red-600">(épuisé)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
