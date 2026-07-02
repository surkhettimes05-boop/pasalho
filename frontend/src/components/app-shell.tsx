'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { authApi } from '@/lib/api/auth';
import { SyncService } from '@/lib/sync-service';
import { Button } from '@/components/ui/button';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, clear } = useAuthStore();

  // Start background sync once user is confirmed
  useEffect(() => {
    if (!user) return;
    SyncService.syncCatalog();
    const interval = setInterval(() => SyncService.processQueue(), 30_000);
    return () => clearInterval(interval);
  }, [user]);

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* best-effort */ }
    clear();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="no-print hidden w-60 flex-col border-r bg-white md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-bold text-blue-600">PASALO OS</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 text-sm">
          <SectionLabel>Overview</SectionLabel>
          <NavItem href="/dashboard" label="Dashboard" />

          <SectionLabel>Organisation</SectionLabel>
          <NavItem href="/branches"   label="Branches" />
          <NavItem href="/warehouses" label="Warehouses" />

          <SectionLabel>Catalog &amp; Stock</SectionLabel>
          <NavItem href="/products"           label="Products" />
          <NavItem href="/stock"              label="Stock" />
          <NavItem href="/stock/adjustments"  label="Adjustments" />
          <NavItem href="/stock/counts"       label="Stock Counts" />
          <NavItem href="/stock/damage"       label="Damage Reports" />
          <NavItem href="/stock/expiry"       label="Expiry Dashboard" />
          <NavItem href="/transfers"          label="Transfers" />

          <SectionLabel>Sales &amp; Finance</SectionLabel>
          <NavItem href="/invoices/new" label="New Invoice (POS)" />
          <NavItem href="/invoices"     label="Invoices" />
          <NavItem href="/payments"     label="Payments" />
          <NavItem href="/retailers"    label="Retailers" />
          <NavItem href="/sales-reps"   label="Sales Reps" />

          <SectionLabel>Field Operations</SectionLabel>
          <NavItem href="/routes"       label="Routes" />
          <NavItem href="/orders"       label="Sales Orders" />
          <NavItem href="/deliveries"   label="Deliveries" />

          <SectionLabel>Admin</SectionLabel>
          <NavItem href="/notifications" label="Notifications" />
          <NavItem href="/audit-logs"    label="Audit Logs" />
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-4 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
      {children}
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 hover:bg-gray-100 hover:text-gray-900 ${
        active ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'
      }`}
    >
      {label}
    </Link>
  );
}
