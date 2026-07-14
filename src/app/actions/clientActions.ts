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

    const asString = (val: any) => val !== undefined && val !== null && val !== '' ? String(val) : null;

    let updateData: any = {
      vatNumber: data.vatNumber !== undefined ? asString(data.vatNumber) : oldClient.vatNumber,
      contactEmail: data.contactEmail !== undefined ? asString(data.contactEmail) : oldClient.contactEmail,
      contactPhone: data.contactPhone !== undefined ? asString(data.contactPhone) : oldClient.contactPhone,
      billingStreetType: data.billingStreetType !== undefined ? asString(data.billingStreetType) : oldClient.billingStreetType,
      billingStreet: data.billingStreet !== undefined ? asString(data.billingStreet) : oldClient.billingStreet,
      billingNumber: data.billingNumber !== undefined ? asString(data.billingNumber) : oldClient.billingNumber,
      billingFloor: data.billingFloor !== undefined ? asString(data.billingFloor) : oldClient.billingFloor,
      billingDoor: data.billingDoor !== undefined ? asString(data.billingDoor) : oldClient.billingDoor,
      billingPostalCode: data.billingPostalCode !== undefined ? asString(data.billingPostalCode) : oldClient.billingPostalCode,
      billingCity: data.billingCity !== undefined ? asString(data.billingCity) : oldClient.billingCity,
      billingProvince: data.billingProvince !== undefined ? asString(data.billingProvince) : oldClient.billingProvince,
    };

    if (data.billingStreet || data.billingCity) {
      const addrParts = [];
      if (updateData.billingStreetType) addrParts.push(updateData.billingStreetType);
      if (updateData.billingStreet) addrParts.push(updateData.billingStreet);
      if (updateData.billingNumber) addrParts.push(`Nº ${updateData.billingNumber}`);
      if (updateData.billingFloor) addrParts.push(`Pl. ${updateData.billingFloor}`);
      if (updateData.billingDoor) addrParts.push(`Pt. ${updateData.billingDoor}`);
      if (updateData.billingPostalCode) addrParts.push(updateData.billingPostalCode);
      if (updateData.billingCity) addrParts.push(updateData.billingCity);
      if (updateData.billingProvince) addrParts.push(`(${updateData.billingProvince})`);
      updateData.billingAddress = addrParts.join(' ');
    }

    if (oldClient.airtableData) {
      let newAirtableData = { ...(oldClient.airtableData as any) };
      
      if (data.billingPostalCode !== undefined) newAirtableData['CP'] = data.billingPostalCode;
      if (data.billingCity !== undefined) {
        newAirtableData['POBLACIÓN'] = data.billingCity;
        newAirtableData['POBLACION'] = data.billingCity;
      }
      if (data.billingProvince !== undefined) newAirtableData['PROVINCIA'] = data.billingProvince;
      
      if (data.billingStreetType !== undefined) {
        newAirtableData['TIPO VIA TITULAR'] = data.billingStreetType;
        newAirtableData['TIPO VÍA TITULAR'] = data.billingStreetType;
      }
      if (data.billingStreet !== undefined) {
        newAirtableData['NOMBRE VIA TITULAR'] = data.billingStreet;
        newAirtableData['NOMBRE VÍA TITULAR'] = data.billingStreet;
      }
      if (data.billingNumber !== undefined) {
        newAirtableData['Número Titular'] = data.billingNumber;
        newAirtableData['NÚMERO TITULAR'] = data.billingNumber;
      }
      if (data.billingFloor !== undefined) {
        newAirtableData['Piso Titular'] = data.billingFloor;
        newAirtableData['PISO TITULAR'] = data.billingFloor;
      }
      if (data.billingDoor !== undefined) {
        newAirtableData['Puerta Titular'] = data.billingDoor;
        newAirtableData['PUERTA TITULAR'] = data.billingDoor;
      }

      updateData.airtableData = JSON.parse(JSON.stringify(newAirtableData));
    }

    if (oldClient.clientType === 'Persona física') {
      const firstName = data.firstName !== undefined ? data.firstName : oldClient.firstName;
      const lastName = data.lastName !== undefined ? data.lastName : oldClient.lastName;
      const lastName2 = data.lastName2 !== undefined ? data.lastName2 : oldClient.lastName2;
      updateData.firstName = firstName;
      updateData.lastName = lastName;
      updateData.lastName2 = lastName2;
      updateData.businessName = `${firstName || ''} ${lastName || ''} ${lastName2 || ''}`.replace(/\s+/g, ' ').trim();
    } else {
      updateData.businessName = data.businessName !== undefined ? data.businessName : oldClient.businessName;
    }

    console.log("UPDATE DATA PAYLOAD:", JSON.stringify(updateData, null, 2));
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: updateData
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
