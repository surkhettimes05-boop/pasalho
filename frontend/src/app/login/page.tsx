'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await authApi.login({ login, password });
      // Store both tokens immediately so the interceptor can refresh
      if (typeof window !== 'undefined') {
        localStorage.setItem('pasalo_token', result.accessToken);
        localStorage.setItem('pasalo_refresh_token', result.refreshToken);
      }
      const me = await authApi.me();
      setSession(result.accessToken, me);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-block rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
            PASALO OS
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500">FMCG Distribution Operating System</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email or phone</label>
            <Input
              type="text"
              autoComplete="username"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="superadmin@pasalo.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4" /> Signing in…
              </span>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <div className="mt-6 rounded-md bg-gray-50 p-3 text-xs text-gray-500">
          <div className="mb-1 font-semibold text-gray-700">Demo credentials</div>
          <div>superadmin@pasalo.com / Admin@1234</div>
          <div>branchmanager@pasalo.com / Pasalo@1234</div>
          <div>salesrep@pasalo.com / Pasalo@1234</div>
        </div>
      </div>
    </div>
  );
}
