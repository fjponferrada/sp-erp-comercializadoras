import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { BrandThemeProvider, defaultTheme, BrandTheme } from '@/context/BrandThemeContext';

export async function PublicBrandProvider({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  let host = headersList.get('host') || '';
  
  // Clean host (remove port if local)
  if (host.includes(':')) {
    host = host.split(':')[0];
  }

  let theme: BrandTheme = defaultTheme;

  if (host && host !== 'localhost') {
    const brand = await prisma.brand.findFirst({
      where: { domain: host }
    });

    if (brand) {
      theme = {
        name: brand.name,
        accentColor: brand.accentColor,
        bgColor: brand.bgColor,
        surfaceColor: brand.surfaceColor,
        borderColor: brand.borderColor,
        logoUrl: brand.logoUrl,
        faviconUrl: brand.faviconUrl,
      };
    }
  }

  return (
    <BrandThemeProvider theme={theme}>
      {children}
    </BrandThemeProvider>
  );
}
