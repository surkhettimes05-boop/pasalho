'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, ShoppingCart, FileText, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Spinner } from '@/components/ui/spinner';
import { RETAILER_TOKEN_KEY, retailerAuthApi, RetailerProfile } from '@/lib/api/retailer-portal';

const RETAILER_PROFILE_KEY = 'pasalo_retailer_profile';

import { RetailerAuthContext } from './auth-context';

const publicPaths = ['/retailer/login', '/retailer/set-pin'];

function NavItem({ href, icon: Icon, label, isActive }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors',
        isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700',
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
}

export default function RetailerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<RetailerProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(RETAILER_TOKEN_KEY);
    const storedProfile = localStorage.getItem(RETAILER_PROFILE_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
    if (storedProfile) {
      try {
        setProfile(JSON.parse(storedProfile));
      } catch {
        localStorage.removeItem(RETAILER_PROFILE_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!token && !publicPaths.includes(pathname)) {
      router.replace('/retailer/login');
    }
  }, [loading, token, pathname, router]);

  const setAuth = (newToken: string, newProfile: RetailerProfile) => {
    localStorage.setItem(RETAILER_TOKEN_KEY, newToken);
    localStorage.setItem(RETAILER_PROFILE_KEY, JSON.stringify(newProfile));
    setToken(newToken);
    setProfile(newProfile);
  };

  const clearAuth = () => {
    localStorage.removeItem(RETAILER_TOKEN_KEY);
    localStorage.removeItem(RETAILER_PROFILE_KEY);
    setToken(null);
    setProfile(null);
    router.replace('/retailer/login');
  };

  const isPublicPage = publicPaths.includes(pathname);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isPublicPage) {
    return (
      <RetailerAuthContext.Provider value={{ profile, token, setAuth, clearAuth }}>
        <div className="min-h-screen bg-white">{children}</div>
      </RetailerAuthContext.Provider>
    );
  }

  if (!token) return null;

  const navItems = [
    { href: '/retailer/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/retailer/orders', icon: ShoppingCart, label: 'Orders' },
    { href: '/retailer/invoices', icon: FileText, label: 'Invoices' },
    { href: '/retailer/login', icon: User, label: 'Profile' },
  ];

  return (
    <RetailerAuthContext.Provider value={{ profile, token, setAuth, clearAuth }}>
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link href="/retailer/dashboard" className="text-lg font-bold text-blue-600">
              PASALO OS
            </Link>
            {profile && (
              <span className="truncate text-sm text-gray-600">{profile.shopName}</span>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
          {children}
        </main>
        <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center justify-around py-2">
            {navItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
              />
            ))}
          </div>
        </nav>
      </div>
    </RetailerAuthContext.Provider>
  );
}
