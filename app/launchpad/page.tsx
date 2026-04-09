'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureAuth } from '@/lib/launchpad/api';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      let redirect: string | null = null;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search || '');
        redirect = params.get('redirect');
      }
      const authResult = await ensureAuth();
      if (!mounted) return;
      if (authResult.success) {
        router.push(redirect || '/launchpad/form');
      } else {
        // Not logged in anywhere -> go to Mahaverse login
        const params = new URLSearchParams();
        params.set('redirect', '/launchpad/form');
        router.push(`/?${params.toString()}`);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}

