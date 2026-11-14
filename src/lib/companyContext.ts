import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export const ADMIN_BACKOFFICE_ROLES = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'] as const;

export function hasAdminOrBackofficeRole(role?: string | null): boolean {
  if (!role) return false;
  return (ADMIN_BACKOFFICE_ROLES as readonly string[]).includes(role);
}

/**
 * Resolves the currently active Company ID (`companyId`) for an authenticated user,
 * respecting the active brand/company switcher cookies (`active-brand` / `active-company`)
 * while verifying the user is authorized to access that brand/company.
 */
export async function resolveActiveCompanyId(session: any): Promise<string | null> {
  if (!session?.user) return null;

  const user = session.user as {
    id?: string;
    role?: string;
    brandId?: string;
    companyId?: string;
    allowedBrands?: Array<{ id: string }>;
  };

  try {
    const cookieStore = await cookies();
    const cookieBrandId = cookieStore.get('active-brand')?.value;

    if (cookieBrandId) {
      const isAllowedBrand =
        user.role === 'SUPERADMIN' ||
        cookieBrandId === user.brandId ||
        (Array.isArray(user.allowedBrands) && user.allowedBrands.some(b => b.id === cookieBrandId));

      if (isAllowedBrand) {
        const brand = await prisma.brand.findUnique({
          where: { id: cookieBrandId },
          select: { companyId: true }
        });
        if (brand?.companyId) {
          return brand.companyId;
        }
      }
    }

    const cookieCompanyId = cookieStore.get('active-company')?.value;
    if (cookieCompanyId) {
      if (user.role === 'SUPERADMIN' || cookieCompanyId === user.companyId) {
        return cookieCompanyId;
      }
      if (Array.isArray(user.allowedBrands) && user.allowedBrands.length > 0) {
        const matchingBrand = await prisma.brand.findFirst({
          where: {
            id: { in: user.allowedBrands.map(b => b.id) },
            companyId: cookieCompanyId
          },
          select: { companyId: true }
        });
        if (matchingBrand?.companyId) {
          return matchingBrand.companyId;
        }
      }
    }
  } catch {
    // Fallback if called outside a request cookie context
  }

  return user.companyId || null;
}
