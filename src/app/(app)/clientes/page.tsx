import React from 'react';
import { prisma } from '@/lib/prisma';
import { getClientVisibilityFilter } from '@/lib/permissions';
import ClientesClient, { ClienteData } from './ClientesClient';
import { auth } from '@/auth';

export default async function ClientesPage() {
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';
  const visibilityFilter = await getClientVisibilityFilter();

  const dbClientes = await prisma.client.findMany({
    where: visibilityFilter,
    include: {
      contracts: {
        include: {
          supplyPoint: true
        }
      }
    },
    orderBy: [
      { businessName: 'asc' },
      { firstName: 'asc' }
    ]
  });

  const clientesData: ClienteData[] = dbClientes.map(c => {
    // Calcular CUPS activos
    let cupsActivos = 0;
    c.contracts.forEach(contract => {
      if (contract.status === 'ACTIVO' && contract.supplyPoint) {
        cupsActivos++;
      }
    });

    const isEmpresa = c.vatNumber.toUpperCase().startsWith('A') || c.vatNumber.toUpperCase().startsWith('B');

    return {
      id: c.id,
      nif: c.vatNumber,
      nombre: c.businessName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Desconocido',
      tipo: isEmpresa ? 'Empresa' : 'Particular',
      contratos: c.contracts.length,
      cupsActivos,
      email: c.contactEmail || '-',
      telefono: c.contactPhone || '-',
      fechaAlta: c.createdAt.toISOString().split('T')[0],
      esNuevo: (new Date().getTime() - c.createdAt.getTime()) < 30 * 24 * 60 * 60 * 1000 // Menos de 30 días
    };
  });

  return <ClientesClient clientes={clientesData} userRole={userRole} />;
}
