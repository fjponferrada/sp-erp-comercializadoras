import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import InstalacionDetailClient from './InstalacionDetailClient';

export const dynamic = 'force-dynamic';

export default async function InstalacionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const session = await auth();
  const sessionUser = session?.user;

  const supplyPoint = await prisma.supplyPoint.findUnique({
    where: { id: resolvedParams.id },
    include: {
      client: true,
      contracts: {
        include: { product: true, user: true },
        orderBy: { createdAt: 'desc' }
      },
      invoices: {
        orderBy: { issueDate: 'desc' }
      }
    }
  });

  if (!supplyPoint) {
    notFound();
  }

  return (
    <InstalacionDetailClient 
      initialSupplyPoint={supplyPoint} 
      userRole={sessionUser?.role || 'CANAL'} 
    />
  );
}
