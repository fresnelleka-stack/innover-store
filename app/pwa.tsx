'use client';

import { useEffect } from 'react';

// Enregistre le service worker (rend l'app installable + hors-ligne de secours).
export default function Pwa() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
