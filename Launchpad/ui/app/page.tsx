'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureAuth } from '@/lib/launchpad/api';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const params = new URLSearchParams(window.location.search || '');
      const redirect = params.get('redirect');
      const authResult = await ensureAuth();
      if (!mounted) return;
      if (authResult.success) {
        router.replace(redirect || '/form/');
      } else {
        const qp = new URLSearchParams();
        if (redirect) qp.set('redirect', redirect);
        router.replace(`/login/${qp.toString() ? `?${qp}` : ''}`);
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600" />
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
