import React from 'react';
import { prisma } from '@/lib/prisma';
import { getUserVisibilityFilter } from '@/lib/permissions';
import RenovacionesClient, { RenovacionData } from './RenovacionesClient';

export default async function RenovacionesPage() {
  const visibilityFilter = await getUserVisibilityFilter();

  const dbRenovaciones = await prisma.contract.findMany({
    where: {
      ...visibilityFilter,
      status: {
        in: ['ACTIVO', 'TRAMITANDO']
      },
      terminationDate: {
        not: null
      }
    },
    include: {
      client: true,
      supplyPoint: true,
      product: true,
      user: true
    },
    orderBy: {
      permanenceStartDate: 'asc'
    }
  });

  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' }
  });

  const renovacionesData: RenovacionData[] = dbRenovaciones.map(r => {
    const dVencimiento = r.terminationDate ? new Date(r.terminationDate) : new Date();
    const now = new Date();
    const diffTime = dVencimiento.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let estado = 'PENDIENTE';
    if (diffDays <= 20) estado = 'URGENTE';
    else if (diffDays <= 40) estado = 'PROXIMO';

    return {
      id: r.id,
      contractId: r.id,
      clientId: r.clientId,
      cups: r.supplyPoint?.cups || 'Desconocido',
      direccion: r.supplyPoint?.address || 'Sin dirección',
      cliente: r.client?.businessName || `${r.client?.firstName || ''} ${r.client?.lastName || ''}`.trim() || 'Desconocido',
      telefonoContacto: r.client?.contactPhone || '-',
      emailComercial: r.user?.email || 'Sin agente',
      fechaActivacion: r.activationDate?.toISOString().split('T')[0] || '-',
      tarifa: r.supplyPoint?.tariff || '2.0TD',
      mwh: r.supplyPoint?.annualConsumption || 0,
      vencimiento: r.terminationDate?.toISOString().split('T')[0] || '-',
      diasRestantes: diffDays,
      producto: r.product?.name || 'Desconocido',
      canal: 'Directo', // TODO: Leer de Lead.source
      estado,
      hasSelfConsumption: r.supplyPoint?.hasSelfConsumption || false
    };
  });

  return <RenovacionesClient initialRenovaciones={renovacionesData} products={products} />;
}
