import type { Metadata } from 'next';
import { Providers } from '@/lib/providers';
import { AuthGuard } from '@/lib/auth-guard';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'PASALO OS',
  description: 'FMCG Distribution Operating System',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#3b82f6" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>
          <AuthGuard>{children}</AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
