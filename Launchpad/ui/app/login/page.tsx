'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, login } from '@/lib/launchpad/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const auth = checkAuth();
    if (auth.success) {
      const redirect = new URLSearchParams(window.location.search).get('redirect') || '/form/';
      router.replace(redirect);
    }
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        const redirect = new URLSearchParams(window.location.search).get('redirect') || '/form/';
        router.replace(redirect);
      } else {
        setError(result.message || 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-200 via-blue-200 to-indigo-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-600 rounded-full shadow-md h-16 w-16 p-[2px]">
            <img
              src="/images/maha-logo.jpg"
              alt="Maha Logo"
              className="rounded-full object-cover h-full w-full bg-white"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Maha Launchpad</h1>
            <p className="text-sm font-semibold text-slate-600">Employee Onboarding Application</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="admin@launchpad.local"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 transition"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
