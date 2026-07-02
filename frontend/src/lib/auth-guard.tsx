'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { authApi } from '@/lib/api/auth';

const PUBLIC_PATHS = ['/login'];

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, setUser, clear, _hasHydrated } = useAuthStore();
  const verifying = useRef(false);

  const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    // Step 1 — wait for Zustand to load from localStorage
    if (!_hasHydrated) return;

    // Step 2 — public pages need no auth
    if (isPublic) return;

    // Step 3 — no token at all → go to login
    if (!token) {
      router.replace('/login');
      return;
    }

    // Step 4 — user already loaded in this session → nothing to do
    if (user) return;

    // Step 5 — token exists but user not in memory → verify once
    if (verifying.current) return;
    verifying.current = true;

    authApi
      .me()
      .then((u) => {
        setUser(u);
      })
      .catch(() => {
        clear();
        router.replace('/login');
      })
      .finally(() => {
        verifying.current = false;
      });
  }, [_hasHydrated, token, user, isPublic, pathname, router, setUser, clear]);

  // While hydrating, show a full-screen spinner so nothing flickers
  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
