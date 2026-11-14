import { redirect } from 'next/navigation';
import UsersClient from './UsersClient';
import { prisma } from '@/lib/prisma';
import { getUserManagementScope } from '@/lib/userManagementScope';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const scope = await getUserManagementScope();
  if (!scope) {
    redirect('/');
  }

  const allowedBrandIds = scope.allowedBrandIds || [];
  const allowedCompanyIds = scope.allowedCompanyIds || [];
  const allowedBrandSet = scope.isSuperAdmin ? null : new Set(allowedBrandIds);
  const allowedCompanySet = scope.isSuperAdmin ? null : new Set(allowedCompanyIds);

  const rawUsers = await prisma.user.findMany({
    where: scope.isSuperAdmin
      ? undefined
      : {
          role: { not: 'SUPERADMIN' },
          OR: [
            { brandId: { in: allowedBrandIds } },
            { assignedBrands: { some: { id: { in: allowedBrandIds } } } },
            { companies: { some: { id: { in: allowedCompanyIds } } } },
          ],
        },
    orderBy: { createdAt: 'desc' },
    omit: { password: true },
    include: {
      brand: true,
      channel: true,
      assignedBrands: true,
      companies: {
        include: {
          brands: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Si es COMPANYADMIN, acotamos las relaciones devueltas únicamente a las comercializadoras/marcas de su alcance
  const users = scope.isSuperAdmin
    ? rawUsers
    : rawUsers.map((u) => {
        const channelInScope = Boolean(u.channel?.brandId && allowedBrandSet?.has(u.channel.brandId));
        return {
          ...u,
          brand: allowedBrandSet?.has(u.brandId) ? u.brand : null,
          channelId: channelInScope ? u.channelId : null,
          channel: channelInScope ? u.channel : null,
          assignedBrands: u.assignedBrands.filter((b) => allowedBrandSet?.has(b.id)),
          companies: u.companies
            .filter((c) => allowedCompanySet?.has(c.id))
            .map((c) => ({
              ...c,
              brands: c.brands.filter((b) => allowedBrandSet?.has(b.id)),
            })),
        };
      });

  const brands = await prisma.brand.findMany({
    where: scope.isSuperAdmin ? undefined : { id: { in: allowedBrandIds } },
    orderBy: { name: 'asc' },
  });

  const companies = await prisma.company.findMany({
    where: scope.isSuperAdmin ? undefined : { id: { in: allowedCompanyIds } },
    orderBy: { name: 'asc' },
    include: {
      brands: scope.isSuperAdmin ? true : { where: { id: { in: allowedBrandIds } } },
    },
  });

  const channels = await prisma.channel.findMany({
    where: scope.isSuperAdmin ? undefined : { brandId: { in: allowedBrandIds } },
    orderBy: { name: 'asc' },
    include: {
      brand: { select: { id: true, name: true } },
    },
  });

  return (
    <UsersClient
      initialUsers={users}
      brands={brands}
      companies={companies}
      channels={channels}
      currentUserRole={scope.callerRole}
      currentUserId={scope.callerId}
    />
  );
}
