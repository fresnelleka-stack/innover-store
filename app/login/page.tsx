'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// L'ancienne page de connexion n'existe plus : la connexion se fait via le
// popup sur la vitrine. On redirige toute visite de /login vers l'accueil.
export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
