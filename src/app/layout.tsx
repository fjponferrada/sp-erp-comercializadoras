import type { Metadata } from 'next';
import AuthProvider from '@/components/AuthProvider';
import PWAInstall from '@/components/PWAInstall';
import './globals.css';

export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';

const getBrand = cache(async () => {
  const headersList = await headers();
  let host = headersList.get('host') || '';
  if (host.includes(':')) host = host.split(':')[0];

  return await prisma.brand.findFirst({
    where: { domain: host }
  });
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();

  const appName = brand?.name || 'SP Energía ERP';

  return {
    title: `${appName} | Gestión de Comercializadoras`,
    description: 'Software de gestión integral para comercializadoras eléctricas. Multi-comercializadora, multi-marca.',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: appName,
    },
  };
}

export async function generateViewport() {
  const brand = await getBrand();

  return {
    themeColor: brand?.bgColor || '#0B0F19',
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <PWAInstall />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
