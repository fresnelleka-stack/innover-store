'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, getRole } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getRole()) router.replace('/');
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const role = login(code);
    if (!role) {
      setError("Code d'accès incorrect");
      return;
    }
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="INNOVER STORE"
            className="w-56 h-56 object-cover rounded-2xl mx-auto mb-4 shadow-lg"
          />
          <p className="text-gray-600">Connexion</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code d'accès
            </label>
            <div className="relative">
              <input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                placeholder="Entrez votre code"
                className="w-full px-4 py-3 pr-16 border-2 border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-gray-500 hover:text-gray-700"
              >
                {showCode ? 'Cacher' : 'Voir'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            Se connecter
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Admin = accès complet · Vendeur = vente uniquement
        </p>
      </div>
    </div>
  );
}
