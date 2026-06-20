import type { Metadata } from 'next';
import AuthProvider from '@/components/AuthProvider';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'SP Energía ERP | Gestión de Comercializadoras',
  description: 'Software de gestión integral para comercializadoras eléctricas. Multi-comercializadora, multi-marca.',
};

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
