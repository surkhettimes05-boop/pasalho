'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { authApi } from '@/lib/api/auth';
import { Button } from '@/components/ui/button';

/**
 * Top-level app shell: sidebar + main content.
 * Used inside the protected route group (app)/.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, clear } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // best-effort: clear local even if server fails
    }
    clear();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-60 flex-col border-r bg-white md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-bold text-blue-600">PASALO OS</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4 text-sm">
          <NavItem href="/dashboard" label="Dashboard" />
          <NavItem href="/products" label="Products" />
          <NavItem href="/stock" label="Stock" />
          <NavItem href="/invoices" label="Invoices" />
          <NavItem href="/invoices/new" label="New Invoice (POS)" />
        </nav>
        <div className="border-t p-4">
          <div className="mb-2 text-xs text-gray-500">Signed in as</div>
          <div className="mb-1 truncate text-sm font-medium">{user?.fullName ?? '—'}</div>
          <div className="mb-3 truncate text-xs text-gray-500">{user?.email ?? '—'}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
    >
      {label}
    </a>
  );
}
