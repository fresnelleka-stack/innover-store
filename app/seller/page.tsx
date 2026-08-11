'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getRole, type Role } from '@/lib/auth';
import Header from '../components/Header';

export default function ProduitVenduPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const r = getRole();
    if (!r) {
      router.replace('/login');
      return;
    }
    setRole(r);
  }, [router]);

  useEffect(() => {
    if (role) loadSales();
  }, [role]);

  const loadSales = async () => {
    try {
      setLoading(true);
      setError('');
      const { data, error } = await supabase
        .from('sales')
        .select('*, products(name)')
        .order('sold_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setSales(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = sales.filter((s) => {
    const name = (s.products?.name || '').toLowerCase();
    const imei = s.imei ? String(s.imei) : '';
    const q = searchTerm.toLowerCase();
    return name.includes(q) || imei.includes(searchTerm);
  });

  const totalRevenue = filtered.reduce((sum, s) => sum + Number(s.total_price_xaf || 0), 0);
  const totalProfit = filtered.reduce((sum, s) => sum + Number(s.profit_xaf || 0), 0);

  const fmt = (n: number) => Number(n).toLocaleString('fr-CM');
  const timeOf = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleTimeString('fr-CM', { hour: '2-digit', minute: '2-digit' }) +
      ' - ' +
      d.toLocaleDateString('fr-CM', { day: '2-digit', month: '2-digit', year: 'numeric' })
    );
  };

  if (!role) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header role={role} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Produits vendus</h1>
          <p className="text-gray-600">Historique des ventes</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Résumé */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Articles vendus</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Total encaissé</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(totalRevenue)} XAF</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Profit total</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{fmt(totalProfit)} XAF</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <input
            type="text"
            placeholder="Chercher un produit vendu (nom ou IMEI)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-2 border-gray-300 rounded px-4 py-3 text-lg text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {loading ? (
            <p className="text-gray-500 text-center py-6">Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-center py-6">
              {searchTerm ? 'Aucun produit vendu trouvé' : 'Aucun produit vendu pour le moment'}
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">
                      {sale.products?.name || 'Produit supprimé'}
                      {sale.quantity > 1 ? ' x' + sale.quantity : ''}
                    </p>
                    {sale.imei && <p className="text-xs text-gray-600 truncate">IMEI: {sale.imei}</p>}
                    <p className="text-xs text-gray-500">{timeOf(sale.sold_at)}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold text-blue-600">{fmt(sale.total_price_xaf)} XAF</p>
                    <p className="text-xs text-green-600">+{fmt(sale.profit_xaf)} profit</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
