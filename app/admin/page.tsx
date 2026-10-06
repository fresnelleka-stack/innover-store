'use client';

import { useState, useEffect, useRef } from 'react';
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
  description: string;
  image_url: string;
};

const emptyFormData: ProductForm = {
  sku: '',
  name: '',
  category: 'phone',
  imei: '',
  cost_xaf: 0,
  selling_price_xaf: 0,
  quantity_available: 0,
  description: '',
  image_url: '',
};


// La description est stockée dans la colonne `sku` (unique) sous la forme
// "<code-unique>|~|<description>". On garde ainsi l'unicité sans changer la base.
const DESC_SEP = '|~|';
const parseDesc = (sku: string | null | undefined): string => {
  const s = sku || '';
  const i = s.indexOf(DESC_SEP);
  return i >= 0 ? s.slice(i + DESC_SEP.length) : '';
};

// Panne réseau (téléphone : « Load failed » sur Safari, « Failed to fetch » sur Chrome).
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

// Réessaie une opération réseau jusqu'à `tries` fois (utile sur connexion mobile instable).
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
  const [soldImeis, setSoldImeis] = useState<string[]>([]);
  const [soldImeiPrice, setSoldImeiPrice] = useState<Record<string, number>>({});
  const [imeiPrices, setImeiPrices] = useState<Record<string, string>>({});
  const [sellingImei, setSellingImei] = useState<string | null>(null);
  // Vente d'accessoires (sans IMEI) : quantité + prix unitaire, par produit.
  const [accQty, setAccQty] = useState<Record<string, string>>({});
  const [accPrice, setAccPrice] = useState<Record<string, string>>({});
  const [lastSale, setLastSale] = useState<
    | { name: string; imei: string | null; qty: number; unitPrice: number; total: number; date: string }
    | null
  >(null);
  const [imeiWarning, setImeiWarning] = useState('');
  const [imeiChecking, setImeiChecking] = useState(false);
  const [imeiOk, setImeiOk] = useState(false);
  const imeiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const [formData, setFormData] = useState<ProductForm>(emptyFormData);

  // Un produit peut avoir plusieurs IMEI (un par appareil), saisis un par ligne.
  const parseImeis = (s: string | null | undefined): string[] =>
    (s || '')
      .split(/[\n,]+/)
      .map((x) => x.trim())
      .filter(Boolean);

  // Cherche si un des IMEI est déjà enregistré ailleurs. Renvoie {imei, name} ou null.
  const findImeiConflict = async (
    imeis: string[]
  ): Promise<{ imei: string; name: string } | null> => {
    if (imeis.length === 0) return null;
    try {
      const { data, error } = await withRetry(() => {
        let q = supabase.from('products').select('id, name, imei');
        if (editingId) q = q.neq('id', editingId);
        return q;
      });
      if (error) return null;
      for (const p of data || []) {
        const set = new Set(parseImeis(p.imei));
        for (const im of imeis) if (set.has(im)) return { imei: im, name: p.name };
      }
    } catch {
      // Coup de réseau pendant la vérification : on ne bloque pas l'ajout.
      return null;
    }
    return null;
  };

  // Vérification AUTOMATIQUE en temps réel pendant la saisie des IMEI :
  // 1) doublon dans le même produit (IMEI écrit deux fois), 2) IMEI déjà sur un autre produit.
  const checkImeiLive = (value: string) => {
    if (imeiTimer.current) clearTimeout(imeiTimer.current);
    setImeiOk(false);
    const list = parseImeis(value);
    if (list.length === 0) {
      setImeiChecking(false);
      setImeiWarning('');
      return;
    }
    // 1) Doublon à l'intérieur de la même saisie (détection instantanée)
    const seen = new Set<string>();
    for (const im of list) {
      if (seen.has(im)) {
        setImeiChecking(false);
        setImeiWarning('IMEI écrit deux fois : ' + im + ' — chaque appareil a un IMEI unique.');
        return;
      }
      seen.add(im);
    }
    // 2) Doublon avec un autre produit (vérifié dans la base, après une courte pause de saisie)
    setImeiChecking(true);
    setImeiWarning('');
    imeiTimer.current = setTimeout(async () => {
      const conflict = await findImeiConflict(list);
      setImeiChecking(false);
      if (conflict) {
        setImeiWarning(
          'IMEI déjà enregistré : ' + conflict.imei + ' (produit : ' + conflict.name + ')'
        );
        setImeiOk(false);
      } else {
        setImeiWarning('');
        setImeiOk(true);
      }
    }, 600);
  };

  useEffect(() => {
    getRole().then((r) => {
      if (!r) {
        router.replace('/');
        return;
      }
      // Admin ET vendeur ont accès à la gestion des produits (le vendeur ne peut juste pas supprimer).
      setRole(r);
    });
  }, [router]);

  useEffect(() => {
    if (role) loadProducts();
  }, [role]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await withRetry(() =>
        supabase.from('products').select('*').order('created_at', { ascending: false })
      );

      if (error) throw error;
      setProducts(data || []);

      // Ventes déjà enregistrées : produits vendus (non modifiables) + IMEI vendus (affichés en vert)
      const { data: soldRows } = await withRetry(() =>
        supabase.from('sales').select('product_id, imei, total_price_xaf')
      );
      const ids = Array.from(
        new Set((soldRows || []).map((r: any) => r.product_id).filter(Boolean))
      ) as string[];
      setSoldProductIds(ids);
      const imeis = Array.from(
        new Set((soldRows || []).map((r: any) => (r.imei ? String(r.imei).trim() : '')).filter(Boolean))
      ) as string[];
      setSoldImeis(imeis);
      const priceMap: Record<string, number> = {};
      (soldRows || []).forEach((r: any) => {
        if (r.imei) priceMap[String(r.imei).trim()] = Number(r.total_price_xaf) || 0;
      });
      setSoldImeiPrice(priceMap);
    } catch (err: any) {
      setError(
        isNetworkError(err)
          ? '⚠️ Connexion internet instable — la liste n\'a pas pu se charger. Vérifie ta connexion et rafraîchis.'
          : err.message
      );
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
      const imeiList = parseImeis(formData.imei);
      const imei = imeiList.length > 0 ? imeiList.join('\n') : null;
      // Stock = nombre d'IMEI si des IMEI sont fournis, sinon la quantité saisie.
      const quantity_available =
        imeiList.length > 0 ? imeiList.length : formData.quantity_available;

      // Refuser un IMEI écrit deux fois dans la même saisie
      const seen = new Set<string>();
      for (const im of imeiList) {
        if (seen.has(im)) {
          setImeiWarning('IMEI écrit deux fois : ' + im + ' — chaque appareil a un IMEI unique.');
          setError('IMEI en double dans la saisie : ' + im + ' est écrit plusieurs fois.');
          return;
        }
        seen.add(im);
      }

      // Refuser un IMEI déjà présent (sur n'importe quel produit)
      const conflict = await findImeiConflict(imeiList);
      if (conflict) {
        setImeiWarning(
          'IMEI déjà enregistré : ' + conflict.imei + ' (produit : ' + conflict.name + ')'
        );
        setError(
          'IMEI en double : ' + conflict.imei + ' est déjà sur le produit « ' + conflict.name + ' ».'
        );
        return;
      }

      // La description est encodée dans `sku` (code unique + description).
      const code = generateSku(formData.category);
      const cleanDesc = (formData.description || '').split(DESC_SEP).join('/').trim();
      const sku = cleanDesc ? code + DESC_SEP + cleanDesc : code;
      // On n'envoie PAS `description` à la base (colonne inexistante).
      const base: Record<string, any> = { ...formData, imei, quantity_available, sku };
      delete base.description;

      if (editingId) {
        const { data, error } = await withRetry(() =>
          supabase.from('products').update(base).eq('id', editingId).select()
        );

        if (error) throw error;
        if (data) setProducts(products.map((p) => (p.id === editingId ? data[0] : p)));
      } else {
        const { data, error } = await withRetry(() =>
          supabase.from('products').insert([base]).select()
        );

        if (error) throw error;
        if (data) setProducts([data[0], ...products]);
      }

      setFormData(emptyFormData);
      setEditingId(null);
      setShowForm(false);
      setImeiWarning('');
      setImeiChecking(false);
      setImeiOk(false);
    } catch (err: any) {
      if (isNetworkError(err)) {
        setError('⚠️ Connexion internet instable — le produit n\'a pas été enregistré. Vérifie ta connexion et réessaie.');
      } else if (err?.code === '23505' || (err?.message && err.message.toLowerCase().includes('imei'))) {
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
      description: parseDesc(p.sku),
      image_url: p.image_url || '',
    });
    setImeiWarning('');
    setImeiChecking(false);
    setImeiOk(false);
    setShowForm(true);
    // Faire défiler vers le formulaire pour qu'il soit bien visible.
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyFormData);
    setImeiWarning('');
    setImeiChecking(false);
    setImeiOk(false);
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

  // Vendre des accessoires (sans IMEI) : quantité × prix unitaire, en une fois.
  const handleSellAccessory = async (p: Product) => {
    const qty = parseInt(accQty[p.id] || '1', 10);
    const price = parseFloat(accPrice[p.id] || '');
    if (!Number.isFinite(qty) || qty < 1) {
      alert('Quantité invalide.');
      return;
    }
    if (qty > p.quantity_available) {
      alert('Stock insuffisant : il reste ' + p.quantity_available + '.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      alert('Entre le prix de vente.');
      return;
    }
    try {
      setError('');
      setSellingId(p.id);

      const { error: saleError } = await supabase.from('sales').insert([{
        product_id: p.id,
        imei: null,
        quantity: qty,
        unit_price_xaf: price,
        total_price_xaf: price * qty,
        profit_xaf: (price - p.cost_xaf) * qty,
        seller_id: null,
        seller_name: 'Vendeur',
      }]);
      if (saleError) throw saleError;

      const { data, error: updError } = await supabase
        .from('products')
        .update({
          quantity_available: Math.max(0, p.quantity_available - qty),
          quantity_sold: (p.quantity_sold || 0) + qty,
        })
        .eq('id', p.id)
        .select();
      if (updError) throw updError;
      if (data) setProducts(products.map((x) => (x.id === p.id ? data[0] : x)));

      setSoldIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));
      setLastSale({
        name: p.name,
        imei: null,
        qty,
        unitPrice: price,
        total: price * qty,
        date: new Date().toLocaleString('fr-CM'),
      });
      setAccQty((prev) => ({ ...prev, [p.id]: '1' }));
      setAccPrice((prev) => {
        const n = { ...prev };
        delete n[p.id];
        return n;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSellingId(null);
    }
  };

  // Reçu imprimable (ouvre une petite fenêtre et lance l'impression).
  const printReceipt = (info: {
    name: string;
    imei: string | null;
    qty: number;
    unitPrice: number;
    total: number;
    date: string;
  }) => {
    const w = window.open('', '_blank', 'width=360,height=640');
    if (!w) {
      alert('Autorise les pop-ups pour imprimer le reçu.');
      return;
    }
    const html =
      '<html><head><meta charset="utf-8"><title>Reçu INNOVER STORE</title><style>' +
      '*{font-family:Arial,sans-serif}body{padding:16px;color:#111}' +
      'h1{font-size:20px;margin:0 0 2px;text-align:center;color:#c10812}' +
      '.sub{text-align:center;color:#666;font-size:12px}' +
      'hr{border:none;border-top:1px dashed #999;margin:10px 0}' +
      '.row{display:flex;justify-content:space-between;font-size:13px;margin:4px 0}' +
      '.total{font-size:16px;font-weight:bold;margin-top:8px}' +
      '.foot{text-align:center;color:#666;font-size:12px;margin-top:14px}' +
      '</style></head><body>' +
      '<h1>INNOVER STORE</h1><div class="sub">Reçu de vente</div>' +
      '<div class="sub">' + info.date + '</div><hr/>' +
      '<div class="row"><span>Produit</span><span>' + info.name + '</span></div>' +
      (info.imei ? '<div class="row"><span>IMEI</span><span>' + info.imei + '</span></div>' : '') +
      '<div class="row"><span>Quantité</span><span>' + info.qty + '</span></div>' +
      '<div class="row"><span>Prix unitaire</span><span>' + info.unitPrice.toLocaleString('fr-CM') + ' XAF</span></div>' +
      '<hr/><div class="row total"><span>TOTAL</span><span>' + info.total.toLocaleString('fr-CM') + ' XAF</span></div>' +
      '<div class="foot">Merci pour votre achat !</div>' +
      '<script>window.onload=function(){window.print()}</script></body></html>';
    w.document.write(html);
    w.document.close();
  };

  // Vendre un IMEI précis. Le prix vient du champ saisi à côté de l'IMEI.
  const handleSellImei = async (p: Product, imei: string) => {
    if (soldImeis.includes(imei)) return; // déjà vendu
    const price = parseFloat(imeiPrices[imei] || '');
    if (!Number.isFinite(price) || price <= 0) {
      alert('Entrez d\'abord le prix de vente.');
      return;
    }
    try {
      setError('');
      setSellingImei(imei);
      const { error: saleError } = await supabase.from('sales').insert([
        {
          product_id: p.id,
          imei,
          quantity: 1,
          unit_price_xaf: price,
          total_price_xaf: price,
          profit_xaf: price - p.cost_xaf,
          seller_id: null,
          seller_name: 'Vendeur',
        },
      ]);
      if (saleError) throw saleError;

      // On NE retire PAS l'IMEI : il reste affiché en vert. Le stock (disponibles) baisse de 1.
      const { data, error: updError } = await supabase
        .from('products')
        .update({
          quantity_available: Math.max(0, p.quantity_available - 1),
          quantity_sold: (p.quantity_sold || 0) + 1,
        })
        .eq('id', p.id)
        .select();
      if (updError) throw updError;
      if (data) setProducts(products.map((x) => (x.id === p.id ? data[0] : x)));

      setSoldImeis((prev) => (prev.includes(imei) ? prev : [...prev, imei]));
      setSoldImeiPrice((prev) => ({ ...prev, [imei]: price }));
      setImeiPrices((prev) => {
        const next = { ...prev };
        delete next[imei];
        return next;
      });
      setSoldIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));
      setLastSale({
        name: p.name,
        imei,
        qty: 1,
        unitPrice: price,
        total: price,
        date: new Date().toLocaleString('fr-CM'),
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSellingImei(null);
    }
  };

  // Réapprovisionner (ne touche pas au prix → possible même sur un produit « figé »).
  const handleRestock = async (p: Product) => {
    const existing = parseImeis(p.imei);

    // Produit à IMEI : on ajoute de nouveaux IMEI (un par ligne). Stock = nombre d'IMEI.
    if (existing.length > 0) {
      const input = prompt(
        'Ajouter des appareils à « ' + p.name + ' » : entre les nouveaux IMEI, un par ligne.',
        ''
      );
      if (input === null) return;
      const toAdd = parseImeis(input);
      if (toAdd.length === 0) {
        alert('Aucun IMEI saisi.');
        return;
      }
      const seenAdd = new Set<string>();
      const dupInput = toAdd.find((im) => (seenAdd.has(im) ? true : (seenAdd.add(im), false)));
      if (dupInput) {
        alert('IMEI écrit deux fois dans la saisie : ' + dupInput);
        return;
      }
      const dupHere = toAdd.find((im) => existing.includes(im));
      if (dupHere) {
        alert('IMEI déjà dans ce produit : ' + dupHere);
        return;
      }
      const conflict = await findImeiConflict(toAdd);
      if (conflict) {
        alert('IMEI déjà enregistré ailleurs : ' + conflict.imei + ' (produit : ' + conflict.name + ')');
        return;
      }
      const merged = existing.concat(toAdd);
      try {
        setError('');
        const { data, error } = await supabase
          .from('products')
          // stock disponible = ancien dispo + nouveaux IMEI (les vendus restent dans la liste)
          .update({ quantity_available: p.quantity_available + toAdd.length, imei: merged.join('\n') })
          .eq('id', p.id)
          .select();
        if (error) throw error;
        if (data) setProducts(products.map((x) => (x.id === p.id ? data[0] : x)));
      } catch (err: any) {
        setError(err.message);
      }
      return;
    }

    // Produit sans IMEI (accessoire) : on ajoute un nombre de pièces.
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

  // Corriger le prix d'achat (coût) d'un produit — admin seulement, marche même
  // sur un produit « figé ». Si des ventes existent déjà, propose de recalculer
  // leur profit avec le bon coût (profit = total encaissé − coût × quantité).
  const handleFixCost = async (p: Product) => {
    const input = prompt(
      'Nouveau prix d\'achat de « ' + p.name + ' » (XAF) :',
      String(p.cost_xaf ?? '')
    );
    if (input === null) return;
    const newCost = parseFloat(String(input).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(newCost) || newCost < 0) {
      alert('Entre un montant valide.');
      return;
    }
    try {
      setError('');
      const { data, error } = await supabase
        .from('products')
        .update({ cost_xaf: newCost })
        .eq('id', p.id)
        .select();
      if (error) throw error;
      if (data) setProducts(products.map((x) => (x.id === p.id ? data[0] : x)));

      const { data: salesData, error: salesErr } = await supabase
        .from('sales')
        .select('id, quantity, total_price_xaf')
        .eq('product_id', p.id);
      if (salesErr) throw salesErr;
      if (salesData && salesData.length > 0) {
        const ok = confirm(
          salesData.length +
            ' vente(s) de ce produit déjà enregistrée(s).\n' +
            'Recalculer leur profit avec le nouveau prix d\'achat (' +
            newCost.toLocaleString('fr-CM') +
            ' XAF) ?'
        );
        if (ok) {
          for (const s of salesData) {
            const { error: updErr } = await supabase
              .from('sales')
              .update({
                profit_xaf: Number(s.total_price_xaf || 0) - newCost * Number(s.quantity || 1),
              })
              .eq('id', s.id);
            if (updErr) throw updErr;
          }
          alert('✅ Profit de ' + salesData.length + ' vente(s) recalculé.');
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cellStyle = (id: string) =>
    soldIds.includes(id) ? { backgroundColor: '#bbf7d0' } : undefined;

  // Un produit déjà vendu (au moins une vente) ne peut plus être modifié.
  const isSold = (p: Product) => soldProductIds.includes(p.id) || soldIds.includes(p.id);


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

        {lastSale && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded flex flex-wrap items-center gap-3">
            <p className="text-green-800 font-semibold flex-1 min-w-[200px]">
              ✓ Vente enregistrée : {lastSale.name}
              {lastSale.imei ? ' (IMEI ' + lastSale.imei + ')' : ''} — {lastSale.qty} ×{' '}
              {lastSale.unitPrice.toLocaleString('fr-CM')} ={' '}
              {lastSale.total.toLocaleString('fr-CM')} XAF
            </p>
            <button
              onClick={() => printReceipt(lastSale)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
            >
              🖨️ Imprimer le reçu
            </button>
            <button
              onClick={() => setLastSale(null)}
              className="text-gray-500 hover:text-gray-700 font-semibold px-2"
              title="Fermer"
            >
              ✕
            </button>
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
          <div ref={formRef} className="bg-white rounded-lg shadow p-6 mb-6 scroll-mt-24">
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
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">
                  IMEI — <span className="font-semibold">un par ligne</span> (un par appareil). Le stock = nombre d&apos;IMEI. Laisser vide pour un accessoire.
                </label>
                <textarea
                  rows={4}
                  placeholder={'Un IMEI par ligne, ex :\n355111111111111\n355222222222222'}
                  value={formData.imei}
                  onChange={(e) => {
                    setFormData({ ...formData, imei: e.target.value });
                    checkImeiLive(e.target.value);
                  }}
                  className={
                    'w-full border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400 ' +
                    (imeiWarning ? 'border-red-500' : imeiOk ? 'border-green-500' : '')
                  }
                />
                {imeiWarning && (
                  <p className="text-red-600 text-sm mt-1 font-semibold">⚠️ {imeiWarning}</p>
                )}
                {!imeiWarning && imeiChecking && (
                  <p className="text-gray-500 text-sm mt-1">⏳ Vérification des IMEI…</p>
                )}
                {!imeiWarning && !imeiChecking && imeiOk && (
                  <p className="text-green-600 text-sm mt-1">✅ IMEI disponible(s), aucun doublon.</p>
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
              {parseImeis(formData.imei).length > 0 ? (
                <div className="border rounded px-3 py-2 text-sm bg-gray-50 flex items-center text-gray-700">
                  📦 Stock :
                  <span className="font-bold ml-1">{parseImeis(formData.imei).length}</span>
                  <span className="ml-1 text-gray-400">(= nombre d&apos;IMEI)</span>
                </div>
              ) : role === 'admin' ? (
                <input
                  type="number"
                  min="1"
                  placeholder="Quantité (ex: 5)"
                  value={formData.quantity_available === 0 ? '' : formData.quantity_available}
                  onChange={(e) => setFormData({ ...formData, quantity_available: parseInt(e.target.value) || 0 })}
                  className="border rounded px-3 py-2 text-gray-900 bg-white placeholder-gray-400"
                />
              ) : (
                <div className="border rounded px-3 py-2 text-sm text-gray-400 bg-gray-50 flex items-center">
                  🔒 Stock géré par l'administrateur
                </div>
              )}
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

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Produit</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">IMEI</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Prix Achat</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Stock</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    Aucun produit. Cliquez sur "Ajouter Produit" pour commencer.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  return (
                    <tr
                      key={p.id}
                      className={'border-b transition-colors ' + (soldIds.includes(p.id) ? '' : 'hover:bg-gray-50')}
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-900" style={cellStyle(p.id)}>
                        {p.name}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-900 align-top">
                        {(() => {
                          const list = parseImeis(p.imei);
                          if (list.length === 0) {
                            // Accessoire (sans IMEI) : vendre une quantité à un prix unitaire.
                            if (p.quantity_available <= 0) {
                              return <span className="text-red-600 font-semibold text-xs">Épuisé</span>;
                            }
                            return (
                              <div className="flex items-center gap-1 min-w-[240px]">
                                <input
                                  type="number"
                                  min="1"
                                  max={p.quantity_available}
                                  title="Quantité vendue"
                                  value={accQty[p.id] ?? '1'}
                                  onChange={(e) => setAccQty((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                  className="w-14 border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 bg-white"
                                />
                                <span className="text-gray-400 text-xs">×</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Prix/pièce"
                                  value={accPrice[p.id] ?? ''}
                                  onChange={(e) => setAccPrice((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                  className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 bg-white"
                                />
                                <button
                                  onClick={() => handleSellAccessory(p)}
                                  disabled={sellingId === p.id || !(parseFloat(accPrice[p.id] || '') > 0)}
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-2 py-1 rounded disabled:bg-gray-300 disabled:text-gray-500"
                                >
                                  {sellingId === p.id ? '...' : 'Vendu'}
                                </button>
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-1 min-w-[260px]">
                              {list.map((im, idx) =>
                                soldImeis.includes(im) ? (
                                  <div
                                    key={im + '-' + idx}
                                    title="Vendu"
                                    className="text-xs font-mono px-2 py-1 rounded bg-green-200 text-green-900 flex items-center gap-2"
                                  >
                                    <span>✓</span>
                                    <span>{im}</span>
                                    <span className="ml-auto font-semibold text-green-800">
                                      {soldImeiPrice[im] ? soldImeiPrice[im].toLocaleString('fr-CM') + ' XAF' : ''} vendu
                                    </span>
                                  </div>
                                ) : (
                                  <div key={im + '-' + idx} className="flex items-center gap-1">
                                    <span className="font-mono text-xs text-gray-800 flex-1">{im}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="Prix"
                                      value={imeiPrices[im] ?? ''}
                                      onChange={(e) =>
                                        setImeiPrices((prev) => ({ ...prev, [im]: e.target.value }))
                                      }
                                      className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 bg-white"
                                    />
                                    <button
                                      onClick={() => handleSellImei(p, im)}
                                      disabled={sellingImei === im || !(parseFloat(imeiPrices[im] || '') > 0)}
                                      title="Entrer le prix puis cliquer Vendu"
                                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-2 py-1 rounded disabled:bg-gray-300 disabled:text-gray-500"
                                    >
                                      {sellingImei === im ? '...' : 'Vendu'}
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-3 text-sm text-right text-gray-900" style={cellStyle(p.id)}>{p.cost_xaf.toLocaleString('fr-CM')} XAF</td>
                      <td className="px-6 py-3 text-sm text-right font-bold" style={cellStyle(p.id)}>
                        <span className={p.quantity_available <= 0 ? 'text-red-600' : 'text-gray-900'}>
                          {p.quantity_available}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-right" style={cellStyle(p.id)}>
                        <div className="flex gap-2 justify-end items-center">
                          {isSold(p) ? (
                            <span
                              className="text-gray-400 font-semibold"
                              title="Article déjà vendu — infos non modifiables (le stock reste réapprovisionnable)"
                            >
                              🔒 vendu
                            </span>
                          ) : role === 'admin' ? (
                            <button
                              onClick={() => handleEditClick(p)}
                              className="text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              Modifier
                            </button>
                          ) : null}
                          {role === 'admin' && (
                            <button
                              onClick={() => handleFixCost(p)}
                              className="text-orange-600 hover:text-orange-800 font-semibold"
                              title="Corriger le prix d'achat (marche même si le produit est vendu)"
                            >
                              💲 Coût
                            </button>
                          )}
                          {role === 'admin' && (
                            <button
                              onClick={() => handleRestock(p)}
                              className="text-emerald-600 hover:text-emerald-800 font-semibold"
                              title="Ajouter des pièces au stock (réapprovisionner)"
                            >
                              ➕ Stock
                            </button>
                          )}
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
