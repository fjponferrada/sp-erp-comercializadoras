import { cache } from 'react';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import Sidebar from '@/components/Sidebar';
import BlockedSessionScreen from '@/components/BlockedSessionScreen';
import { BrandThemeProvider, defaultTheme, type BrandTheme } from '@/context/BrandThemeContext';
import { MobileSidebarProvider } from '@/context/MobileSidebarContext';

const checkUserActiveStatus = cache(async (userId?: string, email?: string) => {
  if (userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    if (u) return u.isActive;
  }
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return true;
  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
    select: { isActive: true },
  });
  return byEmail ? byEmail.isActive : false;
});

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const cookieStore = await cookies();
  const activeBrandId = cookieStore.get('active-brand')?.value || session?.user?.brandId;

  let activeBrand: BrandTheme = defaultTheme;

  if (session?.user) {
    const isActive = await checkUserActiveStatus(session.user.id, session.user.email || undefined);
    if (isActive === false) {
      return (
        <BrandThemeProvider theme={activeBrand}>
          <BlockedSessionScreen />
        </BrandThemeProvider>
      );
    }

    const allowedBrands = (session.user as any).allowedBrands || [];
    const brandData = allowedBrands.find((b: any) => b.id === activeBrandId) || allowedBrands[0];
    const targetBrandIdForCfg = brandData?.id || activeBrandId;
    const refCfg = targetBrandIdForCfg
      ? await prisma.brandReferralConfig
          .findUnique({
            where: { brandId: targetBrandIdForCfg },
            select: { isEnabled: true },
          })
          .catch(() => null)
      : null;

    let referralNavVisible = Boolean(refCfg?.isEnabled);
    if (!referralNavVisible && (session.user as any).role === 'CLIENT' && targetBrandIdForCfg && session.user.email) {
      const cleanEmail = session.user.email.trim();
      const priorClientCount = await prisma.client
        .count({
          where: {
            brandId: targetBrandIdForCfg,
            OR: [
              { contactEmail: { equals: cleanEmail, mode: 'insensitive' } },
              { invoiceEmail: { equals: cleanEmail, mode: 'insensitive' } },
              { contactEmail2: { equals: cleanEmail, mode: 'insensitive' } },
              { contactEmail3: { equals: cleanEmail, mode: 'insensitive' } },
              { representativeEmail: { equals: cleanEmail, mode: 'insensitive' } },
            ],
            AND: [
              {
                OR: [
                  { referralWalletTxs: { some: { brandId: targetBrandIdForCfg } } },
                  { referralsMade: { some: { brandId: targetBrandIdForCfg } } },
                ],
              },
            ],
          },
        })
        .catch(() => 0);
      if (priorClientCount > 0) referralNavVisible = true;
    }
    
    if (brandData) {
      activeBrand = {
        name:         brandData.name || session.user.brandName,
        logoUrl:      brandData.logoUrl || session.user.logoUrl,
        accentColor:  brandData.accentColor || session.user.accentColor,
        bgColor:      brandData.bgColor || session.user.bgColor,
        surfaceColor: brandData.surfaceColor || session.user.surfaceColor,
        borderColor:  brandData.borderColor || session.user.borderColor,
        referralEnabled: referralNavVisible,
      };
    } else if (refCfg || referralNavVisible) {
      activeBrand = {
        ...activeBrand,
        referralEnabled: referralNavVisible,
      };
    }
  }

  return (
    <BrandThemeProvider theme={activeBrand}>
      <MobileSidebarProvider>
        <div style={{ display: 'flex', minWidth: 0 }}>
          <Sidebar />
          <div className="main-content" style={{ flex: 1, minWidth: 0 }}>
            {children}
          </div>
        </div>
      </MobileSidebarProvider>
    </BrandThemeProvider>
  );
}
