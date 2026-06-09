import React from 'react';
import { prisma } from '@/lib/prisma';
import { getUserVisibilityFilter } from '@/lib/permissions';
import BajasClient, { BajaData } from './BajasClient';

export default async function BajasPage() {
  const visibilityFilter = await getUserVisibilityFilter();

  const dbBajas = await prisma.contract.findMany({
    where: {
      ...visibilityFilter,
      status: {
        in: ['INACTIVO', 'PERDIDO']
      }
    },
    include: {
      client: true,
      supplyPoint: true,
      product: true
    },
    orderBy: {
      terminationDate: 'desc'
    }
  });

  const bajasData: BajaData[] = dbBajas.map(b => {
    const dAlta = b.activationDate ? new Date(b.activationDate) : new Date();
    const dBaja = b.terminationDate ? new Date(b.terminationDate) : new Date();
    const diffTime = Math.abs(dBaja.getTime() - dAlta.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      id: b.id,
      cups: b.supplyPoint?.cups || 'Desconocido',
      cliente: b.client?.businessName || `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.trim() || 'Desconocido',
      clientId: b.clientId,
      telefono: b.client?.contactPhone || null,
      email: b.client?.contactEmail || null,
      tarifa: b.supplyPoint?.tariff || '2.0TD',
      mwh: b.supplyPoint?.annualConsumption || 0,
      fechaAlta: b.activationDate?.toISOString().split('T')[0] || '-',
      fechaBaja: b.terminationDate?.toISOString().split('T')[0] || '-',
      motivo: 'Fin de permanencia', // Airtable no tiene este campo exacto
      canal: 'Directo', // TODO: Leer de Lead.source
      producto: b.product?.name || 'Desconocido',
      diasVida: diffDays
    };
  });

  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' }
  });

  return <BajasClient initialBajas={bajasData} products={products} />;
}
