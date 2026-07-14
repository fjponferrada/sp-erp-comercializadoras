'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type RenewalData = {
  contractId: string;
  type: 'M1N' | 'M1S' | 'RENOVACION';
  productId?: string;
  tariff?: string;
  powers?: { p1c?: number, p2c?: number, p3c?: number, p4c?: number, p5c?: number, p6c?: number };
  clientData?: {
    businessName?: string;
    vatNumber?: string;
    contactName?: string;
    contactEmail?: string;
    iban?: string;
  };
};

export async function createRenewalLead(data: RenewalData) {
  try {
    // 1. Obtener el contrato original completo
    const contract = await prisma.contract.findUnique({
      where: { id: data.contractId },
      include: {
        client: true,
        supplyPoint: true,
        user: true // Comercial original
      }
    });

    if (!contract) {
      throw new Error("Contrato original no encontrado");
    }

    // 2. Base del nuevo Lead (Copia del original)
    const newLeadData: any = {
      businessName: contract.client.businessName,
      firstName: contract.client.firstName,
      lastName: contract.client.lastName,
      vatNumber: contract.client.vatNumber,
      contactName: contract.client.contactName,
      email: contract.client.contactEmail,
      phone: contract.client.contactPhone,
      isMultipoint: contract.client.isMultipoint,
      cups: contract.supplyPoint.cups,
      tariff: contract.supplyPoint.tariff,
      userId: contract.userId, // Mismo comercial
      status: 'NUEVO',
      productType: data.type === 'M1N' ? 'CAMBIO_TECNICO' : data.type === 'M1S' ? 'SUBROGACION' : 'RENOVACION',
    };

    // 3. Aplicar reglas M1N (Cambio Técnico: Producto, Potencias, Tarifa)
    if (data.type === 'M1N' || data.type === 'RENOVACION') {
      if (data.productId) {
        const newProduct = await prisma.product.findUnique({ where: { id: data.productId } });
        if (newProduct) {
          newLeadData.product = newProduct.name;
        }
      }
      if (data.tariff) {
        newLeadData.tariff = data.tariff;
      }
      if (data.powers) {
        // En el nuevo Lead, guardamos las potencias solicitadas en contractData
        newLeadData.contractData = {
          requestedPowers: data.powers
        };
      }
    }

    // 4. Aplicar reglas M1S (Subrogación: Cambio de Titular)
    if (data.type === 'M1S' && data.clientData) {
      newLeadData.businessName = data.clientData.businessName || newLeadData.businessName;
      newLeadData.vatNumber = data.clientData.vatNumber || newLeadData.vatNumber;
      newLeadData.contactName = data.clientData.contactName || newLeadData.contactName;
      newLeadData.email = data.clientData.contactEmail || newLeadData.email;
      
      // Guardar IBAN en contractData para la futura firma
      newLeadData.contractData = {
        ...newLeadData.contractData,
        newIban: data.clientData.iban
      };
    }

    // 5. Crear el nuevo Lead
    const newLead = await prisma.lead.create({
      data: newLeadData
    });

    // 6. Opcional: Actualizar el contrato original para marcar que tiene una renovación en curso
    // En nuestro esquema, actualizaremos un flag o dejaremos trazabilidad en notas internas
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        internalComments: `Renovación/Modificación solicitada el ${new Date().toLocaleDateString()}. Lead ID: ${newLead.id}`
      }
    });

    revalidatePath(`/clientes/${contract.clientId}`);
    
    return { success: true, leadId: newLead.id };
  } catch (error: any) {
    console.error("Error creating renewal lead:", error);
    return { success: false, error: error.message };
  }
}
