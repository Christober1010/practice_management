'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ensureAuth } from '@/lib/launchpad/api';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const params = new URLSearchParams(search || '');
      const redirectParam = params.get('redirect');
      
      const authResult = await ensureAuth();
      if (!mounted) return;
      
      if (authResult.success) {
        // Already authenticated, redirect to Launchpad form or specified redirect
        router.push(redirectParam || '/launchpad/form');
      } else {
        // Not authenticated, redirect to unified Mahaverse login
        const qp = new URLSearchParams();
        if (redirectParam) {
          qp.set('redirect', redirectParam);
        } else {
          qp.set('redirect', '/launchpad/form');
        }
        router.push(`/?${qp.toString()}`);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-200 via-blue-200 to-indigo-200 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <div className="bg-teal-600 rounded-full shadow-md h-20 w-20 p-[2px]">
            <img
              src="/images/maha-logo.jpg"
              alt="Maha Logo"
              className="rounded-full object-cover h-full w-full bg-white"
            />
          </div>
          <div className='text-left'>
            <h1 className="text-3xl font-bold text-slate-800">Maha Launchpad</h1>
            <p className="text-md font-bold text-slate-600">Employee Onboarding Application</p>
          </div>
        </div>
        <div className="flex items-center justify-center space-x-2 text-slate-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
          <span className="text-sm">Redirecting to login...</span>
        </div>
      </div>
    </div>
  );
}
