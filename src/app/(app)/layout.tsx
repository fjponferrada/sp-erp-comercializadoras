import { auth } from '@/auth';
import { cookies } from 'next/headers';
import Sidebar from '@/components/Sidebar';
import { BrandThemeProvider, defaultTheme, type BrandTheme } from '@/context/BrandThemeContext';
import { MobileSidebarProvider } from '@/context/MobileSidebarContext';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const cookieStore = await cookies();
  const activeBrandId = cookieStore.get('active-brand')?.value || session?.user?.brandId;

  let activeBrand: BrandTheme = defaultTheme;

  if (session?.user) {
    const allowedBrands = (session.user as any).allowedBrands || [];
    const brandData = allowedBrands.find((b: any) => b.id === activeBrandId) || allowedBrands[0];
    
    if (brandData) {
      activeBrand = {
        name:         brandData.name || session.user.brandName,
        logoUrl:      brandData.logoUrl || session.user.logoUrl,
        accentColor:  brandData.accentColor || session.user.accentColor,
        bgColor:      brandData.bgColor || session.user.bgColor,
        surfaceColor: brandData.surfaceColor || session.user.surfaceColor,
        borderColor:  brandData.borderColor || session.user.borderColor,
      };
    }
  }

  return (
    <BrandThemeProvider theme={activeBrand}>
      <MobileSidebarProvider>
        <div style={{ display: 'flex' }}>
          <Sidebar />
          <div className="main-content" style={{ flex: 1 }}>
            {children}
          </div>
        </div>
      </MobileSidebarProvider>
    </BrandThemeProvider>
  );
}
