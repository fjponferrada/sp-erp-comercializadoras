import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getBrandAccessContext } from '@/lib/permissions';
import AjustesClient from './AjustesClient';

export default async function AjustesPage() {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    redirect('/');
  }

  const brand = access.activeBrandId
    ? await prisma.brand.findUnique({
        where: { id: access.activeBrandId },
        select: {
          id: true,
          name: true,
          domain: true,
          logoUrl: true,
          accentColor: true,
          bgColor: true,
          surfaceColor: true,
          borderColor: true,
        },
      })
    : null;

  return <AjustesClient initialBrand={brand} />;
}
