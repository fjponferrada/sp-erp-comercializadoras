import { cache } from 'react';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';

export interface DashboardAccessContext {
  isLoggedIn: boolean;
  isAuthorized: boolean;
  userId: string | null;
  role: string | null;
  scopedBrandIds: string[] | null; // null = todas las marcas autorizadas (SUPERADMIN)
  activeBrandId: string | null;
  activeCompanyId: string | null;
  activeCompanyReeCode: string | null;
  contractWhere: Prisma.ContractWhereInput;
  supplyPointWhere: Prisma.SupplyPointWhereInput;
}

export const resolveDashboardAccess = cache(async (): Promise<DashboardAccessContext> => {
  const denied: DashboardAccessContext = {
    isLoggedIn: false,
    isAuthorized: false,
    userId: null,
    role: null,
    scopedBrandIds: [],
    activeBrandId: null,
    activeCompanyId: null,
    activeCompanyReeCode: null,
    contractWhere: { id: 'not_authorized' },
    supplyPointWhere: { id: 'not_authorized' },
  };

  const session = await auth();
  if (!session?.user) {
    return denied;
  }

  const sessionUser = session.user as { id?: string; email?: string };
  let dbUser = sessionUser.id
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        include: {
          brand: { select: { id: true, companyId: true } },
          companies: { select: { id: true } },
          assignedBrands: { select: { id: true, companyId: true } },
        },
      })
    : null;

  if (!dbUser && sessionUser.email) {
    dbUser = await prisma.user.findFirst({
      where: { email: { equals: sessionUser.email.trim().toLowerCase(), mode: 'insensitive' } },
      include: {
        brand: { select: { id: true, companyId: true } },
        companies: { select: { id: true } },
        assignedBrands: { select: { id: true, companyId: true } },
      },
    });
  }

  if (!dbUser || dbUser.isActive === false) {
    return denied;
  }

  const role = dbUser.role;
  if (!hasAdminOrBackofficeRole(role)) {
    return {
      ...denied,
      isLoggedIn: true,
      userId: dbUser.id,
      role,
    };
  }

  let cookieBrandId: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieBrandId = cookieStore.get('active-brand')?.value;
  } catch {
    // Llamada fuera de contexto de request HTTP (ej. scripts de verificación local)
  }

  let scopedBrandIds: string[] | null = null;
  let activeBrandId: string | null = cookieBrandId || dbUser.brandId;

  if (role === 'SUPERADMIN') {
    scopedBrandIds = null;
  } else if (role === 'COMPANYADMIN') {
    const companyIds = dbUser.companies.map((c) => c.id);
    const companyBrands =
      companyIds.length > 0
        ? await prisma.brand.findMany({
            where: { companyId: { in: companyIds } },
            select: { id: true },
          })
        : [];
    const allAuthorizedBrandIds = Array.from(
      new Set([...companyBrands.map((b) => b.id), ...dbUser.assignedBrands.map((b) => b.id)])
    );

    if (allAuthorizedBrandIds.length === 0) {
      return {
        ...denied,
        isLoggedIn: true,
        userId: dbUser.id,
        role,
      };
    }

    scopedBrandIds =
      cookieBrandId && allAuthorizedBrandIds.includes(cookieBrandId)
        ? [cookieBrandId]
        : allAuthorizedBrandIds;
    activeBrandId = scopedBrandIds[0];
  } else {
    // BACKOFFICE
    const assignedBrandIds = dbUser.assignedBrands.map((b) => b.id);
    if (assignedBrandIds.length === 0) {
      return {
        ...denied,
        isLoggedIn: true,
        userId: dbUser.id,
        role,
      };
    }

    activeBrandId =
      cookieBrandId && assignedBrandIds.includes(cookieBrandId)
        ? cookieBrandId
        : assignedBrandIds.includes(dbUser.brandId)
          ? dbUser.brandId
          : assignedBrandIds[0];
    scopedBrandIds = [activeBrandId];
  }

  let activeCompanyId = await resolveActiveCompanyId(session);
  if (!activeCompanyId) {
    if (activeBrandId) {
      const b = await prisma.brand.findUnique({
        where: { id: activeBrandId },
        select: { companyId: true },
      });
      activeCompanyId = b?.companyId || null;
    }
    if (!activeCompanyId) {
      activeCompanyId = dbUser.brand?.companyId || dbUser.companies[0]?.id || null;
    }
  }

  let activeCompanyReeCode: string | null = null;
  if (activeCompanyId) {
    const company = await prisma.company.findUnique({
      where: { id: activeCompanyId },
      select: { codigoRee: true },
    });
    activeCompanyReeCode = company?.codigoRee || null;
  }

  const contractWhere: Prisma.ContractWhereInput =
    scopedBrandIds === null
      ? {}
      : {
          client: {
            brandId: scopedBrandIds.length === 1 ? scopedBrandIds[0] : { in: scopedBrandIds },
          },
        };

  const supplyPointWhere: Prisma.SupplyPointWhereInput =
    scopedBrandIds === null
      ? {}
      : {
          client: {
            brandId: scopedBrandIds.length === 1 ? scopedBrandIds[0] : { in: scopedBrandIds },
          },
        };

  return {
    isLoggedIn: true,
    isAuthorized: true,
    userId: dbUser.id,
    role,
    scopedBrandIds,
    activeBrandId,
    activeCompanyId,
    activeCompanyReeCode,
    contractWhere,
    supplyPointWhere,
  };
});
