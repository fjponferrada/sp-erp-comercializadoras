'use client';

import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import { BrandThemeProvider, defaultTheme, type BrandTheme } from '@/context/BrandThemeContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  // Si hay sesión activa, tomamos los colores y nombre de la marca del usuario autenticado.
  // Si no (durante SSR o carga), usamos el tema por defecto de SP Energía.
  const activeBrand: BrandTheme = session?.user
    ? {
        name:         session.user.brandName,
        logoUrl:      session.user.logoUrl,
        accentColor:  session.user.accentColor,
        bgColor:      session.user.bgColor,
        surfaceColor: session.user.surfaceColor,
        borderColor:  session.user.borderColor,
      }
    : defaultTheme;

  return (
    <BrandThemeProvider theme={activeBrand}>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <div className="main-content" style={{ flex: 1 }}>
          {children}
        </div>
      </div>
    </BrandThemeProvider>
  );
}
