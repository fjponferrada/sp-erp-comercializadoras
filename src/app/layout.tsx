import type { Metadata } from 'next';
import AuthProvider from '@/components/AuthProvider';
import './globals.css';

export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  let host = headersList.get('host') || '';
  if (host.includes(':')) host = host.split(':')[0];

  const brand = await prisma.brand.findFirst({
    where: { domain: host }
  });

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
  const headersList = await headers();
  let host = headersList.get('host') || '';
  if (host.includes(':')) host = host.split(':')[0];

  const brand = await prisma.brand.findFirst({
    where: { domain: host },
    select: { accentColor: true }
  });

  return {
    themeColor: brand?.accentColor || '#84cc16',
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
