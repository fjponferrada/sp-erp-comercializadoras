import { auth } from '@/auth';
import { cookies } from 'next/headers';

async function getActiveBrand(sessionUser: any) {
  const { brandId, allowedBrands = [] } = sessionUser;
  const cookieStore = await cookies();
  const cookieBrandId = cookieStore.get('active-brand')?.value;
  
  if (cookieBrandId && allowedBrands.some((b: any) => b.id === cookieBrandId)) {
    return cookieBrandId;
  }
  return brandId;
}

export async function getUserVisibilityFilter() {
  const session = await auth();
  if (!session?.user) return { userId: 'not_logged_in' };

  const { id: userId, role, channelId } = session.user as any;
  const activeBrandId = await getActiveBrand(session.user);
  const safeUserId = userId || 'missing_user_id';

  if (role === 'SUPERADMIN') {
    return {}; // No filter, full visibility
  }

  if (role === 'COMPANYADMIN') {
    const prismaUser = await import('@/lib/prisma').then(m => m.prisma.user.findUnique({
      where: { id: safeUserId },
      include: { companies: true }
    }));
    const companyIds = prismaUser?.companies.map(c => c.id) || [];
    return {
      user: {
        brand: { companyId: { in: companyIds } }
      }
    };
  }

  if (role === 'BACKOFFICE') {
    return {
      user: {
        brandId: activeBrandId
      }
    };
  }

  if (role === 'CANAL') {
    if (channelId) {
      return {
        AND: [
          {
            OR: [
              { userId: safeUserId },
              { user: { channelId: channelId } }
            ]
          },
          { user: { brandId: activeBrandId } }
        ]
      };
    } else {
      return { 
        userId: safeUserId,
        user: { brandId: activeBrandId } 
      };
    }
  }

  // Default for COMERCIAL or other roles
  return { 
    userId: safeUserId,
    user: { brandId: activeBrandId }
  };
}

export async function getClientVisibilityFilter() {
  const session = await auth();
  if (!session?.user) return { id: 'not_logged_in' };

  const { id: userId, role, channelId } = session.user as any;
  const activeBrandId = await getActiveBrand(session.user);
  const safeUserId = userId || 'missing_user_id';

  if (role === 'SUPERADMIN') {
    return {}; // No filter, full visibility
  }

  if (role === 'COMPANYADMIN') {
    const prismaUser = await import('@/lib/prisma').then(m => m.prisma.user.findUnique({
      where: { id: safeUserId },
      include: { companies: true }
    }));
    const companyIds = prismaUser?.companies.map(c => c.id) || [];
    return {
      brand: { companyId: { in: companyIds } }
    };
  }

  if (role === 'BACKOFFICE') {
    return {
      brandId: activeBrandId
    };
  }

  if (role === 'CANAL' && channelId) {
    return {
      brandId: activeBrandId,
      OR: [
        { contracts: { some: { user: { channelId: channelId } } } },
        { contracts: { some: { userId: safeUserId } } }
      ]
    };
  }

  // Default for COMERCIAL
  return {
    brandId: activeBrandId,
    OR: [
      { contracts: { some: { userId: safeUserId } } }
    ]
  };
}

export async function getInvoiceVisibilityFilter() {
  const session = await auth();
  if (!session?.user) return { id: 'not_logged_in' };

  const { id: userId, role, channelId } = session.user as any;
  const activeBrandId = await getActiveBrand(session.user);
  const safeUserId = userId || 'missing_user_id';

  if (role === 'SUPERADMIN') {
    return {}; // No filter, full visibility
  }

  if (role === 'COMPANYADMIN') {
    const prismaUser = await import('@/lib/prisma').then(m => m.prisma.user.findUnique({
      where: { id: safeUserId },
      include: { companies: true }
    }));
    const companyIds = prismaUser?.companies.map(c => c.id) || [];
    return {
      client: {
        brand: { companyId: { in: companyIds } }
      }
    };
  }

  if (role === 'BACKOFFICE') {
    return {
      client: {
        brandId: activeBrandId
      }
    };
  }

  if (role === 'CANAL' && channelId) {
    return {
      client: { brandId: activeBrandId },
      OR: [
        { contract: { user: { channelId: channelId } } },
        { contract: { userId: safeUserId } }
      ]
    };
  }

  // Default for COMERCIAL
  return {
    client: { brandId: activeBrandId },
    contract: { userId: safeUserId }
  };
}

export async function getChannelVisibilityFilter() {
  const session = await auth();
  if (!session?.user) return { id: 'not_logged_in' };

  const { id: userId, role } = session.user as any;
  const activeBrandId = await getActiveBrand(session.user);
  const safeUserId = userId || 'missing_user_id';

  if (role === 'SUPERADMIN') {
    return {}; // No filter, full visibility
  }

  if (role === 'COMPANYADMIN') {
    const prismaUser = await import('@/lib/prisma').then(m => m.prisma.user.findUnique({
      where: { id: safeUserId },
      include: { companies: true }
    }));
    const companyIds = prismaUser?.companies.map(c => c.id) || [];
    return {
      brand: { companyId: { in: companyIds } }
    };
  }

  // BACKOFFICE, CANAL, COMERCIAL
  return {
    brandId: activeBrandId
  };
}
