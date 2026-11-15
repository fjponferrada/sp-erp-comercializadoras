import { cache } from 'react';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

interface ResolvedPermissionContext {
  isAuthorized: boolean;
  userId: string;
  email: string;
  role: string;
  channelId: string | null;
  activeBrandId: string;
  companyAdminBrandIds: string[];
}

const loadLiveUser = cache(async (userId?: string, email?: string) => {
  if (userId) {
    const byId = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companies: { select: { id: true } },
        assignedBrands: { select: { id: true, companyId: true } },
      },
    });
    if (byId) return byId;
  }

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  return prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
    include: {
      companies: { select: { id: true } },
      assignedBrands: { select: { id: true, companyId: true } },
    },
  });
});

const loadCompanyBrandIds = cache(async (companyIdsKey: string) => {
  if (!companyIdsKey) return [] as string[];
  const companyIds = companyIdsKey.split(',').filter(Boolean);
  if (companyIds.length === 0) return [] as string[];

  const brands = await prisma.brand.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true },
  });
  return brands.map((b) => b.id);
});

async function resolvePermissionContext(): Promise<ResolvedPermissionContext | null> {
  const session = await auth();
  if (!session?.user) return null;

  const sessionUser = session.user as any;
  const dbUser = await loadLiveUser(sessionUser.id, sessionUser.email);

  if (!dbUser || dbUser.isActive === false) {
    return null;
  }

  const cookieStore = await cookies();
  const cookieBrandId = cookieStore.get('active-brand')?.value;
  const role = dbUser.role;

  if (role === 'SUPERADMIN') {
    return {
      isAuthorized: true,
      userId: dbUser.id,
      email: dbUser.email.trim().toLowerCase(),
      role,
      channelId: dbUser.channelId,
      activeBrandId: cookieBrandId || dbUser.brandId,
      companyAdminBrandIds: [],
    };
  }

  if (role === 'COMPANYADMIN') {
    const companyIdsKey = dbUser.companies
      .map((c) => c.id)
      .sort()
      .join(',');
    const companyBrandIds = await loadCompanyBrandIds(companyIdsKey);
    const assignedBrandIds = dbUser.assignedBrands.map((b) => b.id);
    const allAuthorizedBrandIds = Array.from(new Set([...companyBrandIds, ...assignedBrandIds]));

    if (allAuthorizedBrandIds.length === 0) {
      return null;
    }

    // Si el COMPANYADMIN ha seleccionado una marca concreta válida en BrandSelector, acotamos a esa marca
    const scopedBrandIds =
      cookieBrandId && allAuthorizedBrandIds.includes(cookieBrandId)
        ? [cookieBrandId]
        : allAuthorizedBrandIds;

    return {
      isAuthorized: true,
      userId: dbUser.id,
      email: dbUser.email.trim().toLowerCase(),
      role,
      channelId: dbUser.channelId,
      activeBrandId: scopedBrandIds[0],
      companyAdminBrandIds: scopedBrandIds,
    };
  }

  if (role === 'CLIENT') {
    return {
      isAuthorized: true,
      userId: dbUser.id,
      email: dbUser.email.trim().toLowerCase(),
      role,
      channelId: null,
      activeBrandId: dbUser.brandId,
      companyAdminBrandIds: [dbUser.brandId],
    };
  }

  // BACKOFFICE, CANAL, COMERCIAL: acceso gobernado estrictamente por assignedBrands
  const assignedBrandIds = dbUser.assignedBrands.map((b) => b.id);
  if (assignedBrandIds.length === 0) {
    return null;
  }

  const activeBrandId =
    cookieBrandId && assignedBrandIds.includes(cookieBrandId)
      ? cookieBrandId
      : assignedBrandIds.includes(dbUser.brandId)
        ? dbUser.brandId
        : assignedBrandIds[0];

  return {
    isAuthorized: true,
    userId: dbUser.id,
    email: dbUser.email.trim().toLowerCase(),
    role,
    channelId: dbUser.channelId,
    activeBrandId,
    companyAdminBrandIds: [activeBrandId],
  };
}

function buildClientEmailOr(cleanEmail: string) {
  return [
    { contactEmail: { equals: cleanEmail, mode: 'insensitive' as const } },
    { invoiceEmail: { equals: cleanEmail, mode: 'insensitive' as const } },
    { contactEmail2: { equals: cleanEmail, mode: 'insensitive' as const } },
    { contactEmail3: { equals: cleanEmail, mode: 'insensitive' as const } },
    { representativeEmail: { equals: cleanEmail, mode: 'insensitive' as const } },
  ];
}

export async function getActiveBrand(_sessionUser?: any): Promise<string | null> {
  const ctx = await resolvePermissionContext();
  return ctx?.activeBrandId || null;
}

export async function getUserVisibilityFilter() {
  const ctx = await resolvePermissionContext();
  if (!ctx) return { userId: 'not_logged_in' };

  const { userId, email, role, channelId, activeBrandId, companyAdminBrandIds } = ctx;

  if (role === 'SUPERADMIN') {
    return {};
  }

  if (role === 'COMPANYADMIN') {
    return {
      client: {
        brandId: { in: companyAdminBrandIds },
      },
    };
  }

  if (role === 'BACKOFFICE') {
    return {
      client: {
        brandId: activeBrandId,
      },
    };
  }

  if (role === 'CANAL' && channelId) {
    return {
      client: {
        brandId: activeBrandId,
      },
      OR: [
        { user: { channelId } },
        { userId },
      ],
    };
  }

  if (role === 'CLIENT') {
    return {
      client: {
        brandId: activeBrandId,
        OR: buildClientEmailOr(email),
      },
    };
  }

  // Default for COMERCIAL (or CANAL without channelId)
  return {
    client: {
      brandId: activeBrandId,
    },
    userId,
  };
}

export async function getLeadVisibilityFilter() {
  const ctx = await resolvePermissionContext();
  if (!ctx) return { id: 'not_logged_in' };

  const { userId, role, channelId, activeBrandId, companyAdminBrandIds } = ctx;

  if (role === 'SUPERADMIN') {
    return {};
  }

  if (role === 'COMPANYADMIN') {
    return {
      user: {
        OR: [
          { brandId: { in: companyAdminBrandIds } },
          { assignedBrands: { some: { id: { in: companyAdminBrandIds } } } },
        ],
      },
    };
  }

  if (role === 'BACKOFFICE') {
    return {
      user: {
        OR: [
          { brandId: activeBrandId },
          { assignedBrands: { some: { id: activeBrandId } } },
        ],
      },
    };
  }

  if (role === 'CANAL' && channelId) {
    return {
      user: {
        AND: [
          {
            OR: [
              { brandId: activeBrandId },
              { assignedBrands: { some: { id: activeBrandId } } },
            ],
          },
          {
            OR: [{ channelId }, { id: userId }],
          },
        ],
      },
    };
  }

  if (role === 'CLIENT') {
    return { id: 'client_no_leads' };
  }

  // Default for COMERCIAL
  return {
    userId,
  };
}

export async function getClientVisibilityFilter() {
  const ctx = await resolvePermissionContext();
  if (!ctx) return { id: 'not_logged_in' };

  const { userId, email, role, channelId, activeBrandId, companyAdminBrandIds } = ctx;

  if (role === 'SUPERADMIN') {
    return {};
  }

  if (role === 'COMPANYADMIN') {
    return {
      brandId: { in: companyAdminBrandIds },
    };
  }

  if (role === 'BACKOFFICE') {
    return {
      brandId: activeBrandId,
    };
  }

  if (role === 'CANAL' && channelId) {
    return {
      brandId: activeBrandId,
      OR: [
        { contracts: { some: { user: { channelId } } } },
        { contracts: { some: { userId } } },
      ],
    };
  }

  if (role === 'CLIENT') {
    return {
      brandId: activeBrandId,
      OR: buildClientEmailOr(email),
    };
  }

  // Default for COMERCIAL
  return {
    brandId: activeBrandId,
    OR: [{ contracts: { some: { userId } } }],
  };
}

export async function getInvoiceVisibilityFilter() {
  const ctx = await resolvePermissionContext();
  if (!ctx) return { id: 'not_logged_in' };

  const { userId, email, role, channelId, activeBrandId, companyAdminBrandIds } = ctx;

  if (role === 'SUPERADMIN') {
    return {};
  }

  if (role === 'COMPANYADMIN') {
    return {
      client: {
        brandId: { in: companyAdminBrandIds },
      },
    };
  }

  if (role === 'BACKOFFICE') {
    return {
      client: {
        brandId: activeBrandId,
      },
    };
  }

  if (role === 'CANAL' && channelId) {
    return {
      client: {
        brandId: activeBrandId,
        OR: [
          { contracts: { some: { user: { channelId } } } },
          { contracts: { some: { userId } } },
        ],
      },
    };
  }

  if (role === 'CLIENT') {
    return {
      client: {
        brandId: activeBrandId,
        OR: buildClientEmailOr(email),
      },
    };
  }

  // Default for COMERCIAL
  return {
    client: {
      brandId: activeBrandId,
      OR: [{ contracts: { some: { userId } } }],
    },
  };
}

export async function getChannelVisibilityFilter() {
  const ctx = await resolvePermissionContext();
  if (!ctx) return { id: 'not_logged_in' };

  const { role, activeBrandId, companyAdminBrandIds } = ctx;

  if (role === 'SUPERADMIN') {
    return {};
  }

  if (role === 'COMPANYADMIN') {
    return {
      brandId: { in: companyAdminBrandIds },
    };
  }

  if (role === 'CLIENT') {
    return { id: 'client_no_channels' };
  }

  // BACKOFFICE, CANAL, COMERCIAL
  return {
    brandId: activeBrandId,
  };
}

export async function getSupplyPointVisibilityFilter() {
  const ctx = await resolvePermissionContext();
  if (!ctx) return { id: 'not_logged_in' };

  const { userId, email, role, channelId, activeBrandId, companyAdminBrandIds } = ctx;

  if (role === 'SUPERADMIN') {
    return {};
  }

  if (role === 'COMPANYADMIN') {
    return {
      client: {
        brandId: { in: companyAdminBrandIds },
      },
    };
  }

  if (role === 'BACKOFFICE') {
    return {
      client: {
        brandId: activeBrandId,
      },
    };
  }

  if (role === 'CANAL' && channelId) {
    return {
      client: { brandId: activeBrandId },
      OR: [
        { contracts: { some: { user: { channelId } } } },
        { contracts: { some: { userId } } },
      ],
    };
  }

  if (role === 'CLIENT') {
    return {
      client: {
        brandId: activeBrandId,
        OR: buildClientEmailOr(email),
      },
    };
  }

  // Default for COMERCIAL
  return {
    client: { brandId: activeBrandId },
    OR: [{ contracts: { some: { userId } } }],
  };
}
