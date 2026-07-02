'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { retailerAuthApi, RETAILER_TOKEN_KEY } from '@/lib/api/retailer-portal';
import { useRetailerAuth } from '../layout';

export default function RetailerLoginPage() {
  const router = useRouter();
  const { setAuth, clearAuth, profile, token } = useRetailerAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(RETAILER_TOKEN_KEY);
    if (storedToken && profile) {
      router.replace('/retailer/dashboard');
    }
  }, [profile, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await retailerAuthApi.login(phone, pin);
      setAuth(result.accessToken, result.retailer);
      router.replace('/retailer/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await retailerAuthApi.logout();
    } catch {
    }
    clearAuth();
  }

  if (profile && token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{profile.shopName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              {profile.ownerName} &middot; {profile.phone}
            </p>
            <Button variant="danger" className="w-full" onClick={handleLogout} loading={loggingOut}>
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 inline-block rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
            PASALO OS
          </div>
          <CardTitle>Retailer Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Phone Number"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98XXXXXXXX"
            />
            <Input
              label="PIN"
              type="password"
              required
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••"
            />
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" loading={submitting}>
              Login
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-500">
            First time?{' '}
            <Link href="/retailer/set-pin" className="text-blue-600 hover:underline">
              Set PIN
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
