'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getAccount, sellerLabel, SELLERS, ADMIN_EMAIL, type Account, type Role } from '@/lib/auth';
import Header from '../components/Header';

// Panne réseau (téléphone : « Load failed » / « Failed to fetch »).
const isNetworkError = (e: any): boolean => {
  const m = ((e && (e.message || e.toString())) || '').toLowerCase();
  return (
    m.includes('load failed') ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('timeout')
  );
};

async function withRetry<T>(fn: () => PromiseLike<T>, tries = 3, delayMs = 800): Promise<T> {
  let last: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isNetworkError(e) || i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}

export default function Dashboard() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [dateRange, setDateRange] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState<any[]>([]);
  const [stockRemaining, setStockRemaining] = useState(0);
  const [stockValue, setStockValue] = useState(0);
  const [productStocks, setProductStocks] = useState<any[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  // Dépenses / sorties d'argent
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expLabel, setExpLabel] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expSaving, setExpSaving] = useState(false);
  const [expError, setExpError] = useState('');
  // Admin : dépense payée par quel vendeur ('' = l'admin lui-même)
  const [expSeller, setExpSeller] = useState('');
  // Comptes par vendeur : ventes / dépenses depuis le début + versements (argent remis au patron)
  const [allSales, setAllSales] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payEmail, setPayEmail] = useState(SELLERS[0].email);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState('');
  // Vendeur : ventes des AUTRES vendeurs (montants seulement) sur la période
  const [teamSales, setTeamSales] = useState<any[]>([]);

  useEffect(() => {
    getAccount().then((a) => {
      if (!a) {
        router.replace('/');
        return;
      }
      setAccount(a);
      setRole(a.role);
    });
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
      // Un vendeur ne voit que SES chiffres ; l'admin voit les 2 boutiques.
      const mine = account && account.role !== 'admin' ? account.email : null;
      if (mine) query = query.eq('seller_email', mine);

      // Toutes les ventes depuis le début (colonnes légères) : sert au « reste à remettre ».
      let allQuery = supabase.from('sales').select('seller_email, total_price_xaf').not('seller_email', 'is', null);
      if (mine) allQuery = allQuery.eq('seller_email', mine);

      // Vendeur : seulement le MONTANT vendu par les autres boutiques sur la période
      // (pas le détail des ventes, ni le profit, ni les dépenses).
      let teamQuery = null;
      if (mine) {
        teamQuery = supabase
          .from('sales')
          .select('seller_email, total_price_xaf, quantity')
          .not('seller_email', 'is', null)
          .neq('seller_email', mine);
        if (cutoff) teamQuery = teamQuery.gte('sold_at', cutoff);
      }

      const prodQuery = supabase
        .from('products')
        .select('id, name, imei, category, cost_xaf, quantity_available, quantity_sold')
        .order('name', { ascending: true });

      // Dépenses / versements : non-bloquants (si la table n'existe pas encore, on affiche 0).
      const optional = (p: PromiseLike<{ data: any; error: any }>) =>
        Promise.resolve(p).then(
          (r) => (r.error ? [] : r.data || []),
          () => []
        );
      const expPromise = optional(
        withRetry(() => {
          let q = supabase.from('expenses').select('*').order('spent_at', { ascending: false });
          if (cutoff) q = q.gte('spent_at', cutoff);
          return q;
        })
      );
      const allExpPromise = optional(
        withRetry(() =>
          supabase.from('expenses').select('id, seller_email, amount_xaf').not('seller_email', 'is', null)
        )
      );
      const payPromise = optional(
        withRetry(() => supabase.from('payouts').select('*').order('paid_at', { ascending: false }))
      );

      // Toutes les demandes partent EN MÊME TEMPS (au lieu d'attendre l'une après l'autre) :
      // le tableau de bord s'affiche en une seule attente réseau.
      const [salesRes, allSalesRes, teamRes, prodRes, expData, allExpData, payData] = await Promise.all([
        query,
        allQuery,
        teamQuery ?? Promise.resolve({ data: [], error: null }),
        prodQuery,
        expPromise,
        allExpPromise,
        payPromise,
      ]);

      if (salesRes.error) throw salesRes.error;
      if (allSalesRes.error) throw allSalesRes.error;
      if (teamRes.error) throw teamRes.error;
      if (prodRes.error) throw prodRes.error;

      setSales(salesRes.data || []);
      setAllSales(allSalesRes.data || []);
      setTeamSales(teamRes.data || []);
      setExpenses(expData);
      setAllExpenses(allExpData);
      setPayouts(payData);

      const prodData = prodRes.data;
      setProductStocks(prodData || []);
      setStockRemaining((prodData || []).reduce((s: number, p: any) => s + (p.quantity_available || 0), 0));
      setStockValue(
        (prodData || []).reduce(
          (s: number, p: any) => s + Number(p.quantity_available || 0) * Number(p.cost_xaf || 0),
          0
        )
      );
    } catch (err: any) {
      setError(
        isNetworkError(err)
          ? '⚠️ Connexion instable — les données n\'ont pas pu se charger. Rafraîchis la page.'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = sales.reduce((s, x) => s + Number(x.total_price_xaf || 0), 0);
  const totalProfit = sales.reduce((s, x) => s + Number(x.profit_xaf || 0), 0);
  const itemsSold = sales.reduce((s, x) => s + Number(x.quantity || 0), 0);
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';
  // Dépenses de la période + bénéfice net (ce qui te reste vraiment)
  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount_xaf || 0), 0);
  const netProfit = totalProfit - totalExpenses;
  // Argent réel en caisse = tout ce qui a été encaissé − tout ce qui est sorti.
  const cashOnHand = totalRevenue - totalExpenses;

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expAmount);
    if (!expLabel.trim()) {
      setExpError('Écris à quoi sert la dépense (ex : Transport, Loyer).');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpError('Entre un montant valide (supérieur à 0).');
      return;
    }
    setExpError('');
    setExpSaving(true);
    try {
      const payload: Record<string, any> = {
        label: expLabel.trim(),
        amount_xaf: amount,
        // Le serveur met de toute façon le compte connecté ; seul l'admin peut choisir un vendeur.
        seller_email: (role === 'admin' && expSeller) || account?.email || null,
      };
      if (expDate) payload.spent_at = new Date(expDate + 'T12:00:00').toISOString();
      const { data, error } = await withRetry(() =>
        supabase.from('expenses').insert([payload]).select()
      );
      if (error) throw error;
      if (data) {
        setExpenses((prev) => [data[0], ...prev]);
        setAllExpenses((prev) => [data[0], ...prev]);
      }
      setExpLabel('');
      setExpAmount('');
      setExpDate('');
    } catch (err: any) {
      setExpError(
        isNetworkError(err)
          ? '⚠️ Connexion instable — la dépense n\'a pas été enregistrée. Réessaie.'
          : err.message || 'Erreur'
      );
    } finally {
      setExpSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    try {
      const { error } = await withRetry(() => supabase.from('expenses').delete().eq('id', id));
      if (error) throw error;
      setExpenses((prev) => prev.filter((x) => x.id !== id));
      setAllExpenses((prev) => prev.filter((x) => x.id !== id));
    } catch (err: any) {
      setExpError(isNetworkError(err) ? '⚠️ Connexion instable — réessaie.' : err.message || 'Erreur');
    }
  };

  // Versement : argent qu'un vendeur remet au patron (admin seulement).
  const addPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError('Entre un montant valide (supérieur à 0).');
      return;
    }
    setPayError('');
    setPaySaving(true);
    try {
      const { data, error } = await withRetry(() =>
        supabase
          .from('payouts')
          .insert([{ seller_email: payEmail, amount_xaf: amount, note: payNote.trim() || null }])
          .select()
      );
      if (error) throw error;
      if (data) setPayouts((prev) => [data[0], ...prev]);
      setPayAmount('');
      setPayNote('');
    } catch (err: any) {
      setPayError(
        isNetworkError(err)
          ? '⚠️ Connexion instable — le versement n\'a pas été enregistré. Réessaie.'
          : err.message || 'Erreur'
      );
    } finally {
      setPaySaving(false);
    }
  };

  const deletePayout = async (id: string) => {
    if (!confirm('Supprimer ce versement ?')) return;
    try {
      const { error } = await withRetry(() => supabase.from('payouts').delete().eq('id', id));
      if (error) throw error;
      setPayouts((prev) => prev.filter((x) => x.id !== id));
    } catch (err: any) {
      setPayError(isNetworkError(err) ? '⚠️ Connexion instable — réessaie.' : err.message || 'Erreur');
    }
  };

  // Comptes par vendeur. « Doit avoir en main » = encaissé − dépenses (période choisie).
  // « Reste à remettre » = depuis le début : encaissé − dépenses − déjà remis au patron.
  const sumBy = (rows: any[], email: string | null, field: string) =>
    rows
      .filter((r) => (email ? r.seller_email === email : !r.seller_email))
      .reduce((s, r) => s + Number(r[field] || 0), 0);
  const sellerStats = (email: string | null, name: string) => {
    const periodSales = sales.filter((s) => (email ? s.seller_email === email : !s.seller_email));
    const revenue = sumBy(sales, email, 'total_price_xaf');
    const spent = sumBy(expenses, email, 'amount_xaf');
    const allRevenue = email ? sumBy(allSales, email, 'total_price_xaf') : 0;
    const allSpent = email ? sumBy(allExpenses, email, 'amount_xaf') : 0;
    const paid = email ? sumBy(payouts, email, 'amount_xaf') : 0;
    return {
      email,
      name,
      count: periodSales.length,
      items: periodSales.reduce((s, x) => s + Number(x.quantity || 0), 0),
      revenue,
      profit: sumBy(sales, email, 'profit_xaf'),
      spent,
      inHand: revenue - spent,
      allRevenue,
      allSpent,
      paid,
      due: allRevenue - allSpent - paid,
    };
  };
  // Admin : un bloc par vendeur (+ l'admin et les anciennes ventes s'il y en a sur la période).
  // Vendeur : seulement son propre bloc.
  const sellerRows =
    role === 'admin'
      ? [
          ...SELLERS.map((s) => sellerStats(s.email, s.name)),
          sellerStats(ADMIN_EMAIL, 'Admin (toi)'),
          sellerStats(null, 'Avant (compte commun)'),
        ].filter((r, i) => i < SELLERS.length || r.count > 0 || r.spent > 0)
      : account
      ? [sellerStats(account.email, account.name)]
      : [];

  // Alerte stock : produits épuisés (0) ou presque (<= 3), du plus critique au moins.
  const lowStock = productStocks
    .filter((p: any) => Number(p.quantity_available || 0) <= 3)
    .sort((a: any, b: any) => Number(a.quantity_available || 0) - Number(b.quantity_available || 0));

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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Revenu Total', value: fmt(totalRevenue) + ' XAF', color: 'text-blue-600', icon: '💰', ring: 'border-blue-500' },
            { label: 'Profit Total', value: fmt(totalProfit) + ' XAF', color: 'text-green-600', icon: '📈', ring: 'border-green-500', note: 'avant dépenses' },
            { label: 'Dépenses', value: '- ' + fmt(totalExpenses) + ' XAF', color: 'text-red-600', icon: '💸', ring: 'border-red-500', note: 'sorties d’argent' },
            { label: 'Argent en Caisse', value: fmt(cashOnHand) + ' XAF', color: cashOnHand >= 0 ? 'text-emerald-600' : 'text-red-600', icon: '💵', ring: cashOnHand >= 0 ? 'border-emerald-500' : 'border-red-500', note: 'revenu total − dépenses (l’argent qu’on a)' },
            { label: 'Bénéfice Net', value: fmt(netProfit) + ' XAF', color: netProfit >= 0 ? 'text-emerald-600' : 'text-red-600', icon: '✅', ring: netProfit >= 0 ? 'border-emerald-500' : 'border-red-500', note: 'profit − dépenses' },
            { label: 'Articles Vendus', value: String(itemsSold), color: 'text-purple-600', icon: '🛒', ring: 'border-purple-500' },
            { label: 'Marge Moyenne', value: profitMargin + ' %', color: 'text-indigo-600', icon: '⚖️', ring: 'border-indigo-500' },
            { label: 'Stock Restant', value: String(stockRemaining), color: 'text-orange-600', icon: '📦', ring: 'border-orange-500' },
            { label: 'Valeur du Stock', value: fmt(stockValue) + ' XAF', color: 'text-teal-600', icon: '🏦', ring: 'border-teal-500', note: 'au prix d’achat' },
          ].map((m) => (
            <div key={m.label} className={'bg-white rounded-lg shadow p-5 border-l-4 ' + m.ring}>
              <div className="flex items-center justify-between">
                <p className="text-gray-600 text-sm">{m.label}</p>
                <span className="text-xl">{m.icon}</span>
              </div>
              <p className={'text-2xl font-bold mt-1 ' + m.color}>{m.value}</p>
              {m.note && <p className="text-xs text-gray-400 mt-0.5">{m.note}</p>}
            </div>
          ))}
        </div>

        {/* Comptes par vendeur : qui a vendu quoi, qui doit combien */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 border-l-4 border-blue-600">
          <h2 className="text-xl font-bold mb-1 text-gray-900">
            {role === 'admin' ? '👥 Comptes par vendeur' : '🧑‍💼 Mon compte — ' + (account?.name || '')}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Chaque vente est enregistrée automatiquement au nom de celui qui est connecté.{' '}
            <span className="font-semibold">Reste à remettre</span> = tout ce qu&apos;il a encaissé
            − ses dépenses − l&apos;argent déjà remis au patron (depuis le début).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sellerRows.map((r) => (
              <div key={r.email || 'none'} className="border-2 border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-lg font-bold text-gray-900">🧑‍💼 {r.name}</p>
                  <p className="text-sm text-gray-500">
                    {r.count} vente{r.count > 1 ? 's' : ''} · {r.items} article{r.items > 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
                  {dateRange === 'today' ? "Aujourd'hui" : dateRange === 'all' ? 'Depuis le début' : 'Sur la période'}
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Encaissé</span>
                    <span className="font-semibold text-blue-600">{fmt(r.revenue)} XAF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dépenses</span>
                    <span className="font-semibold text-red-600">- {fmt(r.spent)} XAF</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-gray-800 font-semibold">Doit avoir en main</span>
                    <span className="font-bold text-gray-900">{fmt(r.inHand)} XAF</span>
                  </div>
                  {role === 'admin' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Profit</span>
                      <span className="font-semibold text-green-600">{fmt(r.profit)} XAF</span>
                    </div>
                  )}
                </div>

                {r.email && (
                  <div className="mt-3 bg-gray-50 rounded p-3 text-sm space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Depuis le début</p>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Encaissé − dépenses</span>
                      <span className="font-semibold">{fmt(r.allRevenue - r.allSpent)} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Déjà remis au patron</span>
                      <span className="font-semibold text-emerald-600">- {fmt(r.paid)} XAF</span>
                    </div>
                    <div
                      className={
                        'flex justify-between rounded px-2 py-1 font-bold ' +
                        (r.due > 0 ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800')
                      }
                    >
                      <span>Reste à remettre</span>
                      <span>{fmt(r.due)} XAF</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Vendeur : montant vendu par l'autre boutique (total seulement) */}
          {role !== 'admin' &&
            SELLERS.filter((s) => s.email !== account?.email).map((s) => {
              const rows = teamSales.filter((x) => x.seller_email === s.email);
              const total = rows.reduce((sum, x) => sum + Number(x.total_price_xaf || 0), 0);
              const items = rows.reduce((sum, x) => sum + Number(x.quantity || 0), 0);
              return (
                <div
                  key={s.email}
                  className="mt-4 border-2 border-dashed border-gray-200 rounded-lg p-4 flex justify-between items-center gap-3"
                >
                  <div>
                    <p className="font-bold text-gray-900">🧑‍💼 {s.name} a vendu</p>
                    <p className="text-xs text-gray-500">
                      {dateRange === 'today' ? "Aujourd'hui" : dateRange === 'all' ? 'Depuis le début' : 'Sur la période'}
                      {' · '}
                      {items} article{items > 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-blue-600 whitespace-nowrap">{fmt(total)} XAF</p>
                </div>
              );
            })}

          {/* Versements : argent remis au patron */}
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-2 text-gray-900">💵 Versements (argent remis au patron)</h3>
            {role === 'admin' && (
              <>
                <form onSubmit={addPayout} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                  <select
                    value={payEmail}
                    onChange={(e) => setPayEmail(e.target.value)}
                    className="border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:outline-none focus:border-emerald-500"
                  >
                    {SELLERS.map((s) => (
                      <option key={s.email} value={s.email}>
                        Reçu de {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    placeholder="Montant reçu (XAF)"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Note (facultatif)"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    className="border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={paySaving}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-2 rounded"
                  >
                    {paySaving ? 'Enregistrement...' : '✅ Enregistrer'}
                  </button>
                </form>
                {payError && <p className="text-red-600 text-sm mb-3">{payError}</p>}
              </>
            )}
            {payouts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-3">Aucun versement enregistré.</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {payouts.map((p) => (
                  <div key={p.id} className="flex justify-between items-center border-b last:border-b-0 py-2 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {sellerLabel(p.seller_email)}
                        {p.note ? ' — ' + p.note : ''}
                      </p>
                      <p className="text-xs text-gray-500">{timeOf(p.paid_at)}</p>
                    </div>
                    <p className="font-semibold text-emerald-600 whitespace-nowrap">
                      {fmt(Number(p.amount_xaf || 0))} XAF
                    </p>
                    {role === 'admin' && (
                      <button
                        onClick={() => deletePayout(p.id)}
                        className="text-gray-400 hover:text-red-600 font-bold px-2"
                        title="Supprimer ce versement"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dépenses / sorties d'argent */}
        <div className="bg-white rounded-lg shadow p-6 mb-8 border-l-4 border-red-500">
          <h2 className="text-xl font-bold mb-1 text-gray-900">💸 Dépenses / Sorties d&apos;argent</h2>
          <p className="text-sm text-gray-500 mb-4">
            Note ici tout l&apos;argent qui sort (transport, loyer, achats…). Ça se déduit
            automatiquement de l&apos;<span className="font-semibold">Argent en Caisse</span> (revenu −
            dépenses) et du <span className="font-semibold">Bénéfice Net</span>.
          </p>

          <form onSubmit={addExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
            <input
              type="text"
              placeholder="À quoi ? (ex : Transport)"
              value={expLabel}
              onChange={(e) => setExpLabel(e.target.value)}
              className="sm:col-span-2 border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-red-500"
            />
            <input
              type="number"
              min="0"
              placeholder="Montant (XAF)"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-red-500"
            />
            <input
              type="date"
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
              title="Date de la dépense (laisser vide = aujourd'hui)"
              className="border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:outline-none focus:border-red-500"
            />
            {role === 'admin' && (
              <select
                value={expSeller}
                onChange={(e) => setExpSeller(e.target.value)}
                title="Qui a payé cette dépense (elle sera déduite de son argent en main)"
                className="sm:col-span-4 border-2 border-gray-300 rounded px-3 py-2 text-gray-900 bg-white focus:outline-none focus:border-red-500"
              >
                <option value="">Payée par : moi (admin)</option>
                {SELLERS.map((s) => (
                  <option key={s.email} value={s.email}>
                    Payée par : {s.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={expSaving}
              className="sm:col-span-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-2 rounded"
            >
              {expSaving ? 'Enregistrement...' : '➖ Enregistrer la dépense'}
            </button>
          </form>
          {expError && <p className="text-red-600 text-sm mb-3">{expError}</p>}

          {expenses.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-3">
              Aucune dépense sur cette période.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              <div className="flex justify-between items-center bg-red-50 rounded px-3 py-2 font-bold text-red-700">
                <span>Total dépenses ({dateRange === 'all' ? 'tout' : 'période'})</span>
                <span>- {fmt(totalExpenses)} XAF</span>
              </div>
              {expenses.map((x) => (
                <div
                  key={x.id}
                  className="flex justify-between items-center border-b last:border-b-0 py-2 gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{x.label}</p>
                    <p className="text-xs text-gray-500">
                      {timeOf(x.spent_at)} · {sellerLabel(x.seller_email)}
                    </p>
                  </div>
                  <p className="font-semibold text-red-600 whitespace-nowrap">
                    - {fmt(Number(x.amount_xaf || 0))} XAF
                  </p>
                  {role === 'admin' && (
                    <button
                      onClick={() => deleteExpense(x.id)}
                      className="text-gray-400 hover:text-red-600 font-bold px-2"
                      title="Supprimer cette dépense"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alerte stock bas / épuisé */}
        {!loading && lowStock.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8 border-l-4 border-red-500">
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              ⚠️ Alertes stock <span className="text-red-600">({lowStock.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {lowStock.map((p: any) => {
                const q = Number(p.quantity_available || 0);
                return (
                  <span
                    key={p.id}
                    className={
                      'px-3 py-1 rounded-full text-sm font-semibold ' +
                      (q === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')
                    }
                  >
                    {p.name} : {q === 0 ? 'épuisé' : q + ' restant' + (q > 1 ? 's' : '')}
                  </span>
                );
              })}
            </div>
          </div>
        )}

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
                        <p className="text-xs text-gray-500">
                          {timeOf(sale.sold_at)}
                          {role === 'admin' && ' · ' + sellerLabel(sale.seller_email)}
                        </p>
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
                          {p.imei && (() => {
                            const list = String(p.imei).split(/[\n,]+/).map((x: string) => x.trim()).filter(Boolean);
                            return (
                              <span className="text-xs text-gray-500 ml-2">
                                {list.length > 1 ? list.length + ' IMEI' : 'IMEI: ' + list[0]}
                              </span>
                            );
                          })()}
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
