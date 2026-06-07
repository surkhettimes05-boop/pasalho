'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { authApi } from '@/lib/api/auth';

interface AuthGuardProps {
  children: ReactNode;
}

const PUBLIC_PATHS = ['/login'];

/**
 * Wraps protected pages. On first mount, verifies the stored token
 * by calling /auth/me. If it fails, redirects to /login.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, setUser, clear } = useAuthStore();
  const [checked, setChecked] = useState(false);

  const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (isPublic) {
      setChecked(true);
      return;
    }

    if (!token) {
      router.replace('/login');
      setChecked(true);
      return;
    }

    if (user) {
      setChecked(true);
      return;
    }

    // Token exists but no user — verify it
    authApi
      .me()
      .then((u) => {
        setUser(u);
        setChecked(true);
      })
      .catch(() => {
        clear();
        router.replace('/login');
        setChecked(true);
      });
  }, [token, user, isPublic, router, pathname, setUser, clear]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (isPublic) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
