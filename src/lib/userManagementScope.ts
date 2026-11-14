import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const ROOT_SUPERADMIN_EMAIL = 'fjponferrada@sp-energia.com';

export const VALID_ROLES = [
  'SUPERADMIN',
  'COMPANYADMIN',
  'BACKOFFICE',
  'CANAL',
  'COMERCIAL',
  'CLIENT',
] as const;

export type ValidUserRole = (typeof VALID_ROLES)[number];

export interface UserManagementScope {
  callerId: string;
  callerEmail: string;
  callerRole: 'SUPERADMIN' | 'COMPANYADMIN';
  isSuperAdmin: boolean;
  allowedCompanyIds: string[] | null;
  allowedBrandIds: string[] | null;
}

export async function getUserManagementScope(): Promise<UserManagementScope | null> {
  const session = await auth();
  if (!session?.user) return null;

  const sessionUserId = session.user.id;
  const sessionEmail = (session.user.email || '').trim().toLowerCase();

  const caller = sessionUserId
    ? await prisma.user.findUnique({
        where: { id: sessionUserId },
        include: {
          companies: { select: { id: true } },
          assignedBrands: { select: { id: true, companyId: true } },
          brand: { select: { id: true, companyId: true } },
        },
      })
    : sessionEmail
      ? await prisma.user.findFirst({
          where: { email: { equals: sessionEmail, mode: 'insensitive' } },
          include: {
            companies: { select: { id: true } },
            assignedBrands: { select: { id: true, companyId: true } },
            brand: { select: { id: true, companyId: true } },
          },
        })
      : null;

  if (!caller || caller.isActive === false) return null;

  if (caller.role !== 'SUPERADMIN' && caller.role !== 'COMPANYADMIN') {
    return null;
  }

  if (caller.role === 'SUPERADMIN') {
    return {
      callerId: caller.id,
      callerEmail: caller.email.trim().toLowerCase(),
      callerRole: 'SUPERADMIN',
      isSuperAdmin: true,
      allowedCompanyIds: null,
      allowedBrandIds: null,
    };
  }

  // COMPANYADMIN: acceso estrictamente acotado a sus comercializadoras y marcas asociadas
  const directCompanyIds = caller.companies.map((c) => c.id);
  const companyBrands =
    directCompanyIds.length > 0
      ? await prisma.brand.findMany({
          where: { companyId: { in: directCompanyIds } },
          select: { id: true, companyId: true },
        })
      : [];

  const brandIdSet = new Set<string>();
  const companyIdSet = new Set<string>(directCompanyIds);

  companyBrands.forEach((b) => {
    brandIdSet.add(b.id);
    companyIdSet.add(b.companyId);
  });

  caller.assignedBrands.forEach((b) => {
    brandIdSet.add(b.id);
    companyIdSet.add(b.companyId);
  });

  if (brandIdSet.size === 0 && caller.brand) {
    brandIdSet.add(caller.brand.id);
    companyIdSet.add(caller.brand.companyId);
  }

  return {
    callerId: caller.id,
    callerEmail: caller.email.trim().toLowerCase(),
    callerRole: 'COMPANYADMIN',
    isSuperAdmin: false,
    allowedCompanyIds: Array.from(companyIdSet),
    allowedBrandIds: Array.from(brandIdSet),
  };
}

export function isTargetUserInScope(
  targetUser: {
    role: string;
    brandId: string;
    assignedBrands?: Array<{ id: string }>;
    companies?: Array<{ id: string }>;
  },
  scope: UserManagementScope
): boolean {
  if (scope.isSuperAdmin) return true;
  if (targetUser.role === 'SUPERADMIN') return false;

  const allowedBrandSet = new Set(scope.allowedBrandIds || []);
  const allowedCompanySet = new Set(scope.allowedCompanyIds || []);

  if (allowedBrandSet.has(targetUser.brandId)) return true;
  if (targetUser.assignedBrands?.some((b) => allowedBrandSet.has(b.id))) return true;
  if (targetUser.companies?.some((c) => allowedCompanySet.has(c.id))) return true;

  return false;
}
