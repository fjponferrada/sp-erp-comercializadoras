import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Topbar from '@/components/Topbar';
import { getUserVisibilityFilter } from '@/lib/permissions';
import FacturasPenalizacionesClient from './FacturasPenalizacionesClient';

export const dynamic = 'force-dynamic';

export default async function FacturasPenalizacionesPage() {
  const session = await auth();
  if (!session?.user) return <div>No autorizado</div>;

  const visibilityFilter = await getUserVisibilityFilter();

  const invoices = await prisma.penaltyInvoice.findMany({
    where: {
      contract: {
        ...visibilityFilter
      }
    },
    include: {
      client: true,
      contract: {
        include: { brand: true, product: true }
      },
      supplyPoint: true
    },
    orderBy: [
      { issueDate: 'desc' },
      { invoiceNumber: 'desc' }
    ],
    take: 500
  });

  return (
    <>
      <Topbar title="Facturas de Penalizaciones" subtitle="Historial de penalizaciones facturadas" />
      <FacturasPenalizacionesClient initialInvoices={invoices} />
    </>
  );
}
