'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getRole, login } from '@/lib/auth';

// Groupe WhatsApp de la boutique (bouton "Acheter").
const WHATSAPP = 'https://chat.whatsapp.com/K2UIxb5Cg0QJQuG6QoEx4y?s=hd&p=i&mlu=4&amv=1';

// Vrai logo WhatsApp (SVG), couleur verte officielle (#25D366).
const WhatsAppIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <path fill="#25D366" d="M16.003 0h-.006C7.17 0 0 7.172 0 16c0 3.5 1.128 6.744 3.046 9.378L1.05 31.3l6.13-1.96A15.9 15.9 0 0016.003 32C24.83 32 32 24.826 32 16S24.83 0 16.003 0z" />
    <path
      fill="#fff"
      d="M25.318 22.594c-.386 1.09-1.918 1.994-3.14 2.258-.836.178-1.928.32-5.604-1.204-4.7-1.948-7.726-6.724-7.962-7.034-.226-.31-1.9-2.53-1.9-4.826 0-2.296 1.166-3.42 1.636-3.9.386-.394.836-.574 1.302-.574.15 0 .286.008.408.014.386.016.58.038.834.646.316.762 1.086 2.844 1.178 3.038.094.194.188.456.056.766-.124.32-.234.442-.44.678-.206.236-.402.416-.606.668-.188.22-.4.456-.164.86.236.396 1.05 1.73 2.25 2.8 1.548 1.38 2.802 1.822 3.246 2.006.33.136.724.104.966-.156.308-.334.688-.888 1.074-1.434.274-.394.62-.442 1.004-.298.39.14 2.466 1.162 2.888 1.372.422.21.702.31.804.486.1.176.1 1.018-.286 2.106z"
    />
  </svg>
);

const catVisual = (cat: string) => {
  if (cat === 'phone') return { emoji: '📱', grad: 'from-red-500 to-red-700' };
  if (cat === 'accessory') return { emoji: '🎧', grad: 'from-rose-500 to-rose-700' };
  return { emoji: '📦', grad: 'from-slate-500 to-slate-700' };
};

type Lang = 'fr' | 'en';
const T = {
  fr: {
    staff: 'Espace employé',
    manage: '🔧 Espace gestion',
    welcome: 'Bienvenue chez INNOVER STORE',
    tagline:
      '⚠️ Évitez les arnaques : nous sommes une entreprise sérieuse. Rejoignez notre groupe WhatsApp pour discuter directement avec nos administrateurs au Cameroun et en Chine. Nous vendons en gros et en détail, avec livraison dans toutes les villes du Cameroun.',
    joinWa: 'Rejoindre notre WhatsApp',
    install: "Installer l'application",
    search: '🔍 Chercher un produit...',
    loading: 'Chargement...',
    noneFound: 'Aucun produit trouvé.',
    none: 'Aucun produit pour le moment.',
    available: 'DISPO',
    price: 'Prix',
    buy: 'Acheter',
    consult: 'Nous consulter',
    swipe: (n: number) => `← Fais glisser pour voir les ${n} photos →`,
    codePlaceholder: "Code d'accès",
    connect: 'Se connecter',
    wrong: 'Mot de passe incorrect',
    installTitle: "Installer l'application",
    ios: [
      'Appuie sur le bouton Partager (le carré avec une flèche ↑) en bas de Safari.',
      "Fais défiler et choisis « Sur l'écran d'accueil ».",
      'Appuie sur « Ajouter » en haut à droite.',
    ],
    android: [
      'Ouvre le menu ⋮ (en haut à droite du navigateur).',
      "Choisis « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
      "Confirme — l'icône INNOVER STORE apparaîtra sur ton écran.",
    ],
    ok: "J'ai compris",
  },
  en: {
    staff: 'Staff area',
    manage: '🔧 Management',
    welcome: 'Welcome to INNOVER STORE',
    tagline:
      '⚠️ Avoid scams: we are a serious company. Join our WhatsApp group to chat directly with our administrators in Cameroon and China. We sell wholesale and retail, with delivery to all cities in Cameroon.',
    joinWa: 'Join our WhatsApp',
    install: 'Install the app',
    search: '🔍 Search a product...',
    loading: 'Loading...',
    noneFound: 'No product found.',
    none: 'No products yet.',
    available: 'IN STOCK',
    price: 'Price',
    buy: 'Buy',
    consult: 'Contact us',
    swipe: (n: number) => `← Swipe to see the ${n} photos →`,
    codePlaceholder: 'Access code',
    connect: 'Sign in',
    wrong: 'Wrong password',
    installTitle: 'Install the app',
    ios: [
      'Tap the Share button (the square with an up arrow ↑) at the bottom of Safari.',
      'Scroll and choose "Add to Home Screen".',
      'Tap "Add" in the top right.',
    ],
    android: [
      'Open the ⋮ menu (top right of the browser).',
      'Choose "Install app" or "Add to Home screen".',
      'Confirm — the INNOVER STORE icon will appear on your screen.',
    ],
    ok: 'Got it',
  },
} as const;

// image_url peut contenir 1 photo (ancien format) ou un tableau JSON de photos.
const getImages = (image_url: string | null | undefined): string[] => {
  if (!image_url) return [];
  const s = String(image_url);
  if (s.startsWith('[')) {
    try {
      const a = JSON.parse(s);
      return Array.isArray(a) ? a.filter(Boolean) : [];
    } catch {
      return [s];
    }
  }
  return [s];
};

export default function Storefront() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [code, setCode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [zoom, setZoom] = useState<any>(null);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [iosHint, setIosHint] = useState(false);
  const [lang, setLang] = useState<Lang>('fr');
  const t = T[lang];

  useEffect(() => {
    const saved = localStorage.getItem('innover_lang');
    if (saved === 'en' || saved === 'fr') setLang(saved);
    const handler = (e: any) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const ua = navigator.userAgent || '';
    setIsIOS(/iphone|ipad|ipod/i.test(ua));
    const sa =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    setStandalone(sa);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const doInstall = async () => {
    if (installEvt) {
      installEvt.prompt();
      try {
        await installEvt.userChoice;
      } catch {
        /* ignore */
      }
      setInstallEvt(null);
    } else {
      setIosHint(true);
    }
  };

  useEffect(() => {
    setIsStaff(!!getRole());
    load();

    // Rafraîchissement automatique du catalogue :
    // 1) quand on rouvre / revient sur l'app, 2) toutes les 20 s, 3) en temps réel (si activé).
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    const interval = setInterval(refreshIfVisible, 20000);
    const channel = supabase
      .channel('catalog-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog' }, () => load())
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await login(code);
    if (!r) {
      setLoginError(t.wrong);
      return;
    }
    router.push('/admin');
  };

  const load = async () => {
    try {
      const { data } = await supabase
        .from('catalog')
        .select('id, name, description, category, price_fcfa, image_url')
        .order('created_at', { ascending: false });
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => Number(n).toLocaleString('fr-CM');
  const filtered = items.filter((p) => (p.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barre du haut */}
      <header className="bg-white shadow sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="INNOVER STORE" className="h-10 w-10 rounded-lg object-cover" />
            <span className="text-xl font-bold">
              <span className="text-gray-900">INNOVER</span> <span className="text-red-600">STORE</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Sélecteur de langue FR / EN */}
            <div className="flex items-center rounded-full border border-gray-300 overflow-hidden text-xs font-bold">
              {(['fr', 'en'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => {
                    setLang(l);
                    localStorage.setItem('innover_lang', l);
                  }}
                  className={'px-2.5 py-1 ' + (lang === l ? 'bg-blue-900 text-white' : 'text-gray-600')}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {isStaff ? (
              <Link href="/vitrine" className="text-sm font-semibold text-gray-500 hover:text-gray-800">
                {t.manage}
              </Link>
            ) : (
              <button
                onClick={() => {
                  setLoginError('');
                  setCode('');
                  setShowLogin(true);
                }}
                className="text-sm font-bold text-gray-700 hover:text-gray-900"
              >
                {t.staff}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-red-600 to-red-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold">{t.welcome}</h1>
          <p className="mt-3 text-white font-bold max-w-2xl mx-auto leading-relaxed">{t.tagline}</p>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 bg-white text-red-700 font-bold px-6 py-3 rounded-full shadow-lg hover:bg-red-50 transition"
          >
            <WhatsAppIcon className="w-6 h-6" />
            {t.joinWa}
          </a>
          {!standalone && (
            <div>
              <button
                onClick={doInstall}
                className="inline-flex items-center gap-2 mt-3 bg-red-800/60 hover:bg-red-800 text-white font-semibold px-5 py-2.5 rounded-full border border-white/40 transition"
              >
                📲 {t.install}
              </button>
            </div>
          )}
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <input
            type="text"
            placeholder={t.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md border-2 border-gray-300 rounded-full px-5 py-3 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-red-500"
          />
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-16">{t.loading}</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-16">{search ? t.noneFound : t.none}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((p) => {
              const v = catVisual(p.category);
              const imgs = getImages(p.image_url);
              return (
                <div
                  key={p.id}
                  onClick={() => setZoom(p)}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition flex gap-3 p-3 cursor-pointer"
                >
                  {/* Photo à gauche */}
                  <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-lg overflow-hidden relative">
                    {imgs.length > 0 ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgs[0]} alt={p.name} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                          {imgs.length > 1 ? '📷 ' + imgs.length : '🔍'}
                        </span>
                      </>
                    ) : (
                      <div className={'w-full h-full bg-gradient-to-br ' + v.grad + ' flex items-center justify-center text-4xl'}>
                        {v.emoji}
                      </div>
                    )}
                  </div>

                  {/* Infos à droite */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0 bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {t.available}
                      </span>
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{p.name}</h3>
                    </div>
                    {p.description && (
                      <p className="text-xs text-gray-500 leading-snug line-clamp-1 mt-0.5">{p.description}</p>
                    )}
                    <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] text-red-500 font-semibold leading-none">{t.price}</div>
                        <div className="text-red-600 font-extrabold text-lg leading-tight truncate">
                          {p.price_fcfa > 0 ? fmt(p.price_fcfa) + ' FCFA' : t.consult}
                        </div>
                      </div>
                      <a
                        href={WHATSAPP}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg transition"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                        {t.buy}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Galerie produit (clients) : plusieurs photos, on fait glisser */}
      {zoom && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col p-3"
          onClick={() => setZoom(null)}
        >
          <button
            onClick={() => setZoom(null)}
            className="self-end text-white text-3xl leading-none mb-2"
            aria-label="Fermer"
          >
            ✕
          </button>

          {(() => {
            const imgs = getImages(zoom.image_url);
            return (
              <>
                <div className="flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
                  {imgs.length > 0 ? (
                    <div className="h-full flex gap-2 overflow-x-auto snap-x snap-mandatory">
                      {imgs.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={src}
                          alt={zoom.name + ' ' + (i + 1)}
                          className="snap-center shrink-0 w-full h-full object-contain rounded-lg"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-white text-7xl">
                      {catVisual(zoom.category).emoji}
                    </div>
                  )}
                </div>

                {imgs.length > 1 && (
                  <p className="text-center text-white/70 text-xs mt-2">{t.swipe(imgs.length)}</p>
                )}

                <div
                  className="mt-3 bg-white rounded-xl p-4 flex items-center justify-between gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 leading-snug">{zoom.name}</p>
                    {zoom.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{zoom.description}</p>
                    )}
                    <p className="text-red-600 font-extrabold text-xl mt-1">
                      {zoom.price_fcfa > 0 ? fmt(zoom.price_fcfa) + ' FCFA' : t.consult}
                    </p>
                  </div>
                  <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg"
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                    {t.buy}
                  </a>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Popup de connexion (staff) */}
      {showLogin && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{t.staff}</h2>
              <button
                onClick={() => setShowLogin(false)}
                className="text-gray-400 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                autoFocus
                placeholder={t.codePlaceholder}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (loginError) setLoginError('');
                }}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              {loginError && <p className="text-red-600 text-sm mt-2">{loginError}</p>}
              <button
                type="submit"
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
              >
                {t.connect}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Instructions d'installation (iPhone / navigateurs sans invite auto) */}
      {iosHint && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
          onClick={() => setIosHint(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">📲 {t.installTitle}</h2>
              <button onClick={() => setIosHint(false)} className="text-gray-400 hover:text-gray-700 text-xl">
                ✕
              </button>
            </div>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              {(isIOS ? t.ios : t.android).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <button
              onClick={() => setIosHint(false)}
              className="w-full mt-5 bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-lg"
            >
              {t.ok}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
