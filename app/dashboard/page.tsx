'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Dashboard() {
  const [dateRange, setDateRange] = useState('today');

  // Sample data - will be replaced with Supabase
  const stats = {
    totalRevenue: 2450000,
    totalProfit: 650000,
    itemsSold: 12,
    stockRemaining: 50,
    profitMargin: 26.5,
  };

  const topProducts = [
    { name: 'iPhone 13', sold: 5, revenue: 2250000, profit: 750000 },
    { name: 'Samsung A12', sold: 4, revenue: 880000, profit: 280000 },
    { name: 'Accessoires', sold: 3, revenue: 320000, profit: 120000 },
  ];

  const recentSales = [
    { id: '1', product: 'iPhone 13', imei: '123456789', price: 450000, profit: 150000, seller: 'Jean', time: '14:30' },
    { id: '2', product: 'Samsung A12', imei: '987654321', price: 220000, profit: 70000, seller: 'Marie', time: '13:15' },
    { id: '3', product: 'Accessoires', price: 30000, profit: 10000, seller: 'Jean', time: '12:45' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
            <p className="text-gray-600">Statistiques et rapports</p>
          </div>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Retour
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Date Range Selector */}
        <div className="mb-6 flex gap-2">
          {[
            { value: 'today', label: 'Aujourd\'hui' },
            { value: 'week', label: 'Semaine' },
            { value: 'month', label: 'Mois' },
            { value: 'all', label: 'Tout' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setDateRange(option.value)}
              className={option.value === dateRange ? 'px-4 py-2 rounded font-semibold transition bg-blue-600 text-white' : 'px-4 py-2 rounded font-semibold transition bg-white text-gray-700 hover:bg-gray-100'}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Revenu Total</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {(stats.totalRevenue / 1000000).toFixed(1)}M XAF
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Profit Total</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {(stats.totalProfit / 1000000).toFixed(1)}M XAF
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Articles Vendus</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">{stats.itemsSold}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Stock Restant</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">{stats.stockRemaining}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Marge Moyenne</p>
            <p className="text-2xl font-bold text-indigo-600 mt-2">{stats.profitMargin}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Products */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">📊 Top Produits</h2>
            <div className="space-y-4">
              {topProducts.map((product, idx) => (
                <div key={idx} className="border-b pb-4 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-sm text-gray-600">{product.sold} vendus</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">{(product.revenue / 1000000).toFixed(2)}M XAF</p>
                      <p className="text-sm text-green-600">+{(product.profit / 1000).toFixed(0)}k profit</p>
                    </div>
                  </div>
                  <div className="mt-2 bg-gray-200 rounded h-2 overflow-hidden">
                    <div className="bg-blue-600 h-full" style={{ width: ((product.sold / 5) * 100) + '%' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">🛒 Ventes Récentes</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentSales.map((sale) => (
                <div key={sale.id} className="border-b pb-3 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{sale.product}</p>
                      {sale.imei && <p className="text-xs text-gray-600">IMEI: {sale.imei}</p>}
                      <p className="text-xs text-gray-500">{sale.seller} @ {sale.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">{(sale.price / 1000).toFixed(0)}k</p>
                      <p className="text-xs text-green-600">+{(sale.profit / 1000).toFixed(0)}k</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stock Alert */}
        <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <p className="text-yellow-800 font-semibold">⚠️ Articles à Réapprovisionner</p>
          <p className="text-sm text-yellow-700 mt-1">5 produits avec stock inférieur à 3 unités</p>
        </div>
      </main>
    </div>
  );
          }
