'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';

export default function SellerPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCheckout, setSavingCheckout] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.imei && p.imei.includes(searchTerm))
  );

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem && existingItem.quantity < product.quantity_available) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else if (!existingItem) {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const totalSale = cart.reduce((sum, item) => sum + (item.selling_price_xaf * item.quantity), 0);
  const totalProfit = cart.reduce((sum, item) => sum + ((item.selling_price_xaf - item.cost_xaf) * item.quantity), 0);

  const handleCheckout = async () => {
    try {
      setSavingCheckout(true);
      setError('');

      for (const item of cart) {
        await supabase
          .from('sales')
          .insert([{
            product_id: item.id,
            imei: item.imei,
            quantity: item.quantity,
            unit_price_xaf: item.selling_price_xaf,
            total_price_xaf: item.selling_price_xaf * item.quantity,
            profit_xaf: (item.selling_price_xaf - item.cost_xaf) * item.quantity,
            seller_id: 'default',
            seller_name: 'Vendeur',
          }]);

        const newQty = item.quantity_available - item.quantity;
        await supabase
          .from('products')
          .update({
            quantity_available: newQty,
            quantity_sold: item.quantity_sold + item.quantity
          })
          .eq('id', item.id);
      }

      alert('Vente enregistree! ' + cart.length + ' article(s) vendus. Total: ' + totalSale.toLocaleString('fr-CM') + ' XAF. Profit: ' + totalProfit.toLocaleString('fr-CM') + ' XAF');
      setCart([]);
      loadProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingCheckout(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Point de Vente</h1>
            <p className="text-gray-600">Enregistrer une vente</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search & Products */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <input
                type="text"
                placeholder="Chercher par SKU, nom ou IMEI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-2 border-gray-300 rounded px-4 py-3 text-lg focus:outline-none focus:border-blue-500"
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
                filteredProducts.map((product) => {
                  return (
                    <div key={product.id} className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{product.name}</h3>
                          <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                          {product.imei && <p className="text-sm text-gray-600">IMEI: {product.imei}</p>}
                          <p className="text-sm mt-2">
                            <span className="text-green-600 font-semibold">{product.selling_price_xaf.toLocaleString('fr-CM')} XAF</span>
                            <span className="text-gray-500 ml-2 line-through">{product.cost_xaf.toLocaleString('fr-CM')} XAF</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 mb-2">Stock: <span className="font-semibold">{product.quantity_available}</span></p>
                          <button
                            onClick={() => addToCart(product)}
                            disabled={product.quantity_available === 0}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition"
                          >
                            {product.quantity_available === 0 ? 'Rupture' : 'Vendre'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cart Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h2 className="text-xl font-bold mb-4">Panier</h2>

              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Panier vide</p>
              ) : (
                <>
                  <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="border-b pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{item.name}</p>
                            <p className="text-xs text-gray-600">{item.selling_price_xaf.toLocaleString('fr-CM')} XAF × {item.quantity}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-semibold"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                            className="border w-10 px-1 py-1 text-center text-xs rounded"
                          />
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Articles:</span>
                      <span className="font-semibold">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total vente:</span>
                      <span className="font-semibold text-lg text-blue-600">{totalSale.toLocaleString('fr-CM')} XAF</span>
                    </div>
                    <div className="flex justify-between bg-green-50 p-2 rounded">
                      <span>Profit estimé:</span>
                      <span className="font-semibold text-green-600">{totalProfit.toLocaleString('fr-CM')} XAF</span>
                    </div>
                    <button
                      onClick={handleCheckout}
                      disabled={cart.length === 0 || savingCheckout}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded mt-4 transition"
                    >
                      {savingCheckout ? '⏳ Enregistrement...' : '✓ Valider la Vente'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
            }
