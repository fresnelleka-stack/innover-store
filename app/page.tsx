'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRole } from '@/lib/auth';

// Page d'accueil = simple redirection. Plus d'écran de menu : on arrive
// directement sur une page réelle, la navigation se fait par la barre du haut.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const r = getRole();
    router.replace(r ? '/seller' : '/login');
  }, [router]);

  return null;
}
