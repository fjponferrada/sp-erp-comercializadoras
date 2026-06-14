'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';

// Inicializamos Resend (requerirá RESEND_API_KEY en el .env)
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

export async function updateClient(clientId: string, data: any) {
  try {
    const oldClient = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!oldClient) {
      throw new Error("Cliente no encontrado");
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        businessName: data.businessName !== undefined ? data.businessName : oldClient.businessName,
        vatNumber: data.vatNumber !== undefined ? data.vatNumber : oldClient.vatNumber,
        contactEmail: data.contactEmail !== undefined ? data.contactEmail : oldClient.contactEmail,
        contactPhone: data.contactPhone !== undefined ? data.contactPhone : oldClient.contactPhone,
        billingAddress: data.billingAddress !== undefined ? data.billingAddress : oldClient.billingAddress,
      }
    });

    revalidatePath(`/clientes/${clientId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error updating client:", error);
    return { success: false, error: error.message };
  }
}

export async function getPaginatedClientsAction(page: number, limit: number, searchTerm: string, typeFilter: string) {
  try {
    const { getClientVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getClientVisibilityFilter();
    
    let whereClause: any = { AND: [{ ...visibilityFilter }] };

    if (searchTerm) {
      const terms = searchTerm.split(/\s+/).filter(Boolean);
      terms.forEach(term => {
        whereClause.AND.push({
          OR: [
            { businessName: { contains: term, mode: 'insensitive' } },
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { vatNumber: { contains: term, mode: 'insensitive' } }
          ]
        });
      });
    }

    if (typeFilter && typeFilter !== 'Todos') {
      if (typeFilter === 'Empresa') {
        whereClause.AND.push({
          OR: [
            { vatNumber: { startsWith: 'A', mode: 'insensitive' } },
            { vatNumber: { startsWith: 'B', mode: 'insensitive' } }
          ]
        });
      } else if (typeFilter === 'Particular') {
        whereClause.AND.push({
          NOT: [
            { vatNumber: { startsWith: 'A', mode: 'insensitive' } },
            { vatNumber: { startsWith: 'B', mode: 'insensitive' } }
          ]
        });
      }
    }

    const totalCount = await prisma.client.count({ where: whereClause });
    const offset = (page - 1) * limit;

    const dbClientes = await prisma.client.findMany({
      where: whereClause,
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
      ],
      skip: offset,
      take: limit,
    });

    const clientesData = dbClientes.map(c => {
      let cupsActivos = 0;
      c.contracts.forEach(contract => {
        if (contract.status === 'ACTIVO' && contract.supplyPoint) {
          cupsActivos++;
        }
      });

      const vatUpper = (c.vatNumber || '').toUpperCase();
      const isEmpresa = vatUpper.startsWith('A') || vatUpper.startsWith('B');

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
        esNuevo: (new Date().getTime() - c.createdAt.getTime()) < 30 * 24 * 60 * 60 * 1000
      };
    });

    return { success: true, clients: clientesData, totalCount };
  } catch (error: any) {
    console.error("Error fetching paginated clients:", error);
    return { success: false, error: error.message };
  }
}

export async function getClientStatsAction() {
  try {
    const { getClientVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getClientVisibilityFilter();
    
    const totalClientes = await prisma.client.count({ where: visibilityFilter });
    
    // Con contrato activo
    const conContratoActivo = await prisma.client.count({
      where: {
        ...visibilityFilter,
        contracts: {
          some: {
            status: 'ACTIVO',
            supplyPointId: { not: undefined } // Or just remove the condition if 'ACTIVO' is enough, let's just use { not: undefined } or drop it entirely.
          }
        }
      }
    });

    const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
    const nuevosEsteMes = await prisma.client.count({
      where: {
        ...visibilityFilter,
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    return { success: true, totalClientes, conContratoActivo, nuevosEsteMes };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
