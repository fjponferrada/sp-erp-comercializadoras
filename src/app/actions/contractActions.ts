'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { put } from '@vercel/blob';

export async function convertLeadToContractAction(leadId: string) {
  try {
    // 1. Verificar si ya existe un contrato para este Lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contract: true, user: true },
    });

    if (!lead) {
      return { error: 'Lead no encontrado.' };
    }

    if (lead.contractId) {
      return { error: 'Este Lead ya ha sido convertido a Contrato.' };
    }

    // --- VALIDACIONES DE NEGOCIO ---
    const validationErrors: string[] = [];
    const cData: any = lead.contractData || {};

    // 1. SIPS OK
    if (lead.sipsMessages && lead.sipsMessages.length > 0) {
      validationErrors.push(`Aviso de SIPS pendiente de revisión: ${lead.sipsMessages}`);
    }

    // 2. Error NIF apoderado/titular
    const vat = lead.vatNumber || cData.nif;
    if (!vat || !/^[A-Z0-9]{8,9}$/i.test(vat.replace(/[-\s]/g, ''))) {
      validationErrors.push("El NIF/CIF del titular está vacío o no tiene un formato válido.");
    }

    // 3. Error CP
    const cp = cData.cp || cData.codigoPostal;
    if (!cp || !/^\d{5}$/.test(cp)) {
      validationErrors.push("El Código Postal del punto de suministro debe tener 5 dígitos.");
    }

    // 4. Tarifa / Consumo
    if (!lead.estimatedMWh || lead.estimatedMWh <= 0) {
      validationErrors.push("El consumo anual estimado debe ser mayor a 0.");
    }

    if (!cData.cnae) {
      validationErrors.push("El CNAE no puede estar vacío.");
    }

    if (validationErrors.length > 0) {
      return { 
        error: 'VALIDATION_FAILED',
        validationErrors 
      };
    }
    // --- FIN VALIDACIONES ---

    const isMultipoint = lead.isMultipoint || lead.businessName.toUpperCase().includes('ERANOVUM');

    let contactEmail = lead.email;
    let contactEmail2 = lead.contactEmail2;
    let contactEmail3 = lead.contactEmail3;

    if (isMultipoint && lead.businessName.toUpperCase().includes('ERANOVUM')) {
       cData.emailFactura = 'finance@eranovum.energy';
       contactEmail2 = 'roger@iseoenergia.es';
       contactEmail3 = 'pm.emobility@eranovum.energy';
       cData.duracionSVA = 1;
    }

    // 2. Necesitamos un Client. Buscamos por NIF o creamos.
    const vatNum = lead.vatNumber || `PENDING-${lead.id}`;
    const brandIdToUse = lead.user?.brandId || (await prisma.brand.findFirst())?.id || '';
    let client = await prisma.client.findUnique({
      where: { vatNumber_brandId: { vatNumber: vatNum, brandId: brandIdToUse } }
    });
    
    if (client) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          businessName: lead.businessName,
          firstName: lead.firstName,
          lastName: lead.lastName,
          contactEmail: contactEmail || client.contactEmail,
          contactEmail2: contactEmail2 || client.contactEmail2,
          contactEmail3: contactEmail3 || client.contactEmail3,
          clientType: cData.tipoCliente || client.clientType,
          isMultipoint: isMultipoint || client.isMultipoint,
        }
      });
    } else {
      client = await prisma.client.create({
        data: {
          businessName: lead.businessName,
          firstName: lead.firstName,
          lastName: lead.lastName,
          vatNumber: vatNum,
          contactEmail: contactEmail,
          contactEmail2: contactEmail2,
          contactEmail3: contactEmail3,
          clientType: cData.tipoCliente || 'Desconocido',
          brandId: brandIdToUse,
          isMultipoint: isMultipoint,
        }
      });
    }

    // 3. Necesitamos un SupplyPoint. Buscamos por CUPS.
    const targetCups = lead.cups || `CUPS-PENDING-${lead.id}`;
    let supplyPoint = await prisma.supplyPoint.findFirst({
      where: { cups: targetCups, client: { brandId: brandIdToUse } },
      include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    let previousContractId = null;

    if (supplyPoint) {
      // Mantenemos el clientId original hasta que se active el nuevo contrato
      supplyPoint = await prisma.supplyPoint.update({
        where: { id: supplyPoint.id },
        data: {
          address: cData.direccion || supplyPoint.address,
          city: cData.poblacion || supplyPoint.city,
          postalCode: cData.cp || supplyPoint.postalCode,
          province: cData.provincia || supplyPoint.province,
          tariff: lead.tariff || supplyPoint.tariff,
        },
        include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });
      if (supplyPoint.contracts && supplyPoint.contracts.length > 0) {
        previousContractId = supplyPoint.contracts[0].id;
      }
    } else {
      supplyPoint = await prisma.supplyPoint.create({
        data: {
          cups: targetCups,
          address: cData.direccion || 'Pendiente',
          city: cData.poblacion || 'Pendiente',
          postalCode: cData.cp || '00000',
          province: cData.provincia || 'Pendiente',
          tariff: lead.tariff || '2.0TD',
          clientId: client.id,
        },
        include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });
    }

    // 4. Necesitamos un Product. Buscamos uno o creamos genérico.
    let product = await prisma.product.findFirst({
      where: { name: lead.product || 'Producto Genérico' }
    });

    if (!product) {
      const brand = await prisma.brand.findFirst(); // Asumimos que hay al menos una marca
      if (!brand) throw new Error("No hay marcas configuradas en el sistema.");
      product = await prisma.product.create({
        data: {
          name: lead.product || 'Producto Genérico',
          type: lead.productType || 'FIX',
          brandId: brand.id,
        }
      });
    }

    // Generación de código de contrato exacto a Airtable
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const min = now.getMinutes();
    
    // Canal genérico o extraer del lead si lo hubiera, usaremos 'AED' genérico + 'AV' + tipo
    const isCompany = client.vatNumber.toUpperCase().startsWith('A') || client.vatNumber.toUpperCase().startsWith('B');
    const typeChar = isCompany ? 'E' : 'P';
    const prefix = `AEDAV${typeChar}`;
    
    const cupsLast4 = supplyPoint.cups ? supplyPoint.cups.slice(-4) : '0000';
    
    // Fórmula de Airtable: {Código Canal} & {Código comercial} & {Año firma} & {Mes} & {Día} & {Hora} & {Min} & {Digitos CUPS}
    let contractCode = `${prefix}${year}${month}${day}${hour}${min}${cupsLast4}`;
    
    // Para asegurar unicidad 100% en caso de concurrencia en el mismo minuto
    const existingCode = await prisma.contract.findUnique({ where: { contractCode } });
    if (existingCode) {
      contractCode = `${contractCode}-${Math.floor(Math.random() * 1000)}`;
    }

    // 5. Crear el contrato
    const contract = await prisma.contract.create({
      data: {
        userId: lead.userId,
        clientId: client.id,
        supplyPointId: supplyPoint.id,
        productId: product.id,
        status: isMultipoint ? 'ACEPTADO' : 'BORRADOR',
        previousContractId: previousContractId,
        contractCode,
      },
    });

    // 3. Vincular el Contrato al Lead y cambiar el estado del Lead a CONTRATADO
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        contractId: contract.id,
        status: 'CONTRATADO',
        contractData: cData,
      },
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    revalidatePath('/contratos');

    return { success: true, contractId: contract.id };
  } catch (error: any) {
    console.error("Error al convertir Lead a Contrato:", error);
    return { error: 'Ocurrió un error inesperado al procesar la conversión.' };
  }
}

export async function remakeContractAction(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contract: true, user: true },
    });

    if (!lead) {
      return { error: 'Lead no encontrado.' };
    }

    if (!lead.contractId || !lead.contract) {
      return { error: 'Este Lead no tiene ningún contrato asociado para rehacer.' };
    }

    // --- VALIDACIONES DE NEGOCIO ---
    const validationErrors: string[] = [];
    const cData: any = lead.contractData || {};

    // 1. SIPS OK
    if (lead.sipsMessages && lead.sipsMessages.length > 0) {
      validationErrors.push(`Aviso de SIPS pendiente de revisión: ${lead.sipsMessages}`);
    }

    // 2. Error NIF apoderado/titular
    const vat = lead.vatNumber || cData.nif;
    if (!vat || !/^[A-Z0-9]{8,9}$/i.test(vat.replace(/[-\s]/g, ''))) {
      validationErrors.push("El NIF/CIF del titular está vacío o no tiene un formato válido.");
    }

    // 3. Error CP
    const cp = cData.cp || cData.codigoPostal;
    if (!cp || !/^\d{5}$/.test(cp)) {
      validationErrors.push("El Código Postal del punto de suministro debe tener 5 dígitos.");
    }

    // 4. Tarifa / Consumo
    if (!lead.estimatedMWh || lead.estimatedMWh <= 0) {
      validationErrors.push("El consumo anual estimado debe ser mayor a 0.");
    }

    if (!cData.cnae) {
      validationErrors.push("El CNAE no puede estar vacío.");
    }

    if (validationErrors.length > 0) {
      return { 
        error: 'VALIDATION_FAILED',
        validationErrors 
      };
    }
    // --- FIN VALIDACIONES ---

    const isMultipoint = lead.isMultipoint || lead.businessName.toUpperCase().includes('ERANOVUM');

    let contactEmail = lead.email;
    let contactEmail2 = lead.contactEmail2;
    let contactEmail3 = lead.contactEmail3;

    if (isMultipoint && lead.businessName.toUpperCase().includes('ERANOVUM')) {
       cData.emailFactura = 'finance@eranovum.energy';
       contactEmail2 = 'roger@iseoenergia.es';
       contactEmail3 = 'pm.emobility@eranovum.energy';
       cData.duracionSVA = 1;
    }

    // Actualizar Cliente
    await prisma.client.update({
      where: { id: lead.contract.clientId },
      data: {
        businessName: lead.businessName,
        firstName: lead.firstName,
        lastName: lead.lastName,
        vatNumber: lead.vatNumber || `PENDING-${lead.id}`,
        contactEmail: contactEmail,
        contactEmail2: contactEmail2,
        contactEmail3: contactEmail3,
        contactPhone: lead.phone,
        clientType: cData.tipoCliente || 'Desconocido',
        isMultipoint: isMultipoint,
      }
    });

    // Actualizar Punto de Suministro
    await prisma.supplyPoint.update({
      where: { id: lead.contract.supplyPointId },
      data: {
        cups: lead.cups || `CUPS-PENDING-${lead.id}`,
        address: cData.direccion || 'Pendiente',
        city: cData.poblacion || 'Pendiente',
        postalCode: cData.cp || '00000',
        province: cData.provincia || 'Pendiente',
        tariff: lead.tariff || '2.0TD',
      }
    });

    // Producto
    let product = await prisma.product.findFirst({
      where: { name: lead.product || 'Producto Genérico' }
    });

    if (!product) {
      const brand = await prisma.brand.findFirst();
      if (brand) {
        product = await prisma.product.create({
          data: {
            name: lead.product || 'Producto Genérico',
            type: lead.productType || 'FIX',
            brandId: brand.id,
          }
        });
      }
    }

    // Actualizar Contrato
    await prisma.contract.update({
      where: { id: lead.contract.id },
      data: {
        productId: product?.id || lead.contract.productId,
        status: isMultipoint ? 'ACEPTADO' : 'BORRADOR', // Vuelve a Borrador al rehacer salvo si es Multipunto
        updatedAt: new Date(),
      },
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { contractData: cData }
    });

    return { success: true, contractId: lead.contract.id };

  } catch (error: any) {
    console.error("Error al rehacer Contrato:", error);
    return { error: 'Ocurrió un error inesperado al rehacer el contrato.' };
  }
}

function getContractStatusFromDates(
  signatureDate: Date | null | undefined,
  requestDate: Date | null | undefined,
  activationDate: Date | null | undefined,
  terminationDate: Date | null | undefined
): string {
  if (terminationDate && activationDate) return 'BAJA';
  if (activationDate) return 'ACTIVO';
  if (requestDate) return 'TRAMITANDO';
  if (signatureDate) return 'ACEPTADO';
  return 'BORRADOR';
}

export async function updateContractDatesAction(
  contractId: string,
  dates: {
    signatureDate?: Date | null;
    requestDate?: Date | null;
    activationDate?: Date | null;
    terminationDate?: Date | null;
  },
  tramitationType?: string
) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { supplyPoint: true, product: true }
    });

    if (!contract) return { error: 'Contrato no encontrado' };

    const mergedSignature = dates.signatureDate !== undefined ? dates.signatureDate : contract.signatureDate;
    const mergedRequest = dates.requestDate !== undefined ? dates.requestDate : contract.requestDate;
    const mergedActivation = dates.activationDate !== undefined ? dates.activationDate : contract.activationDate;
    const mergedTermination = dates.terminationDate !== undefined ? dates.terminationDate : contract.terminationDate;

    const newStatus = getContractStatusFromDates(mergedSignature, mergedRequest, mergedActivation, mergedTermination);

    let permanenceStartDate = contract.permanenceStartDate;
    const mergedTramitationType = tramitationType !== undefined ? tramitationType : contract.tramitationType;

    // Lógica de inicio de permanencia si entra una fecha de activación y no había permanencia (o queremos sobreescribir)
    if (mergedActivation && mergedTramitationType) {
      const reqTypeUpper = mergedTramitationType.toUpperCase();
      if (
        (!reqTypeUpper.includes('M1') && !reqTypeUpper.includes('E1')) ||
        (reqTypeUpper === 'M1S')
      ) {
        permanenceStartDate = mergedActivation;
      }
    }

    // Actualizamos el contrato
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: newStatus,
        signatureDate: mergedSignature,
        requestDate: mergedRequest,
        activationDate: mergedActivation,
        terminationDate: mergedTermination,
        tramitationType: mergedTramitationType,
        permanenceStartDate,
      }
    });

    // =====================================
    // GENERACIÓN AUTOMÁTICA DE COMISIONES
    // =====================================
    if (newStatus === "ACTIVO" && contract.status !== "ACTIVO") {
      // 1. Buscamos el usuario y su canal
      const user = await prisma.user.findUnique({
        where: { id: contract.userId },
        include: { channel: true }
      });

      if (user?.channelId) {
        // 2. Comprobamos si ya existe la comisión
        const existingCommission = await prisma.commission.findUnique({
          where: { contractId: contract.id }
        });

        if (!existingCommission && contract.product) {
          // 3. Calculamos la comisión usando el tipo configurado en el Producto
          let amount = 0;
          const consumption = contract.supplyPoint?.annualConsumption ? contract.supplyPoint.annualConsumption : 5000;
          const channelPct = user.channel?.fixedCommissionPct || 0.65;

          if (contract.product.commissionType === "POWER_TIERS") {
            // Ejemplo de cálculo por tramos de potencia para 2.0
            // Usamos p1c (Potencia en P1) del SupplyPoint
            const power = contract.supplyPoint.p1c || 3.3;
            const tiers = contract.product.powerTiersCommission as Record<string, number> || { "0-5": 20, "5-10": 30 };
            
            if (power <= 5) amount = tiers["0-5"] || 20;
            else if (power <= 10) amount = tiers["5-10"] || 30;
            else amount = 40; // Default
            
            // Si el tramo ya es neto para el canal, o si hay que multiplicarlo por el % del canal
            // amount = amount * channelPct; (Dependerá de la regla de negocio)
          } else {
            // "MARGIN_PERCENTAGE" (Sobre margen)
            // Calculamos un margen bruto dummy (fee * consumo + feePotencia * potencia)
            const feeEnergy = contract.product.fee || 0.015;
            const power = contract.supplyPoint.p1c || 5;
            const feePower = 0.05; // 5 centimos de margen de potencia al dia (ejemplo)
            
            const marginEnergy = consumption * feeEnergy;
            const marginPower = power * feePower * 365;
            const grossMargin = marginEnergy + marginPower;
            
            amount = grossMargin * channelPct;
          }

          await prisma.commission.create({
            data: {
              contractId: contract.id,
              channelId: user.channelId,
              consumptionBasis: consumption,
              amount: amount,
              relativeAmount: amount / consumption,
              signatureDate: mergedSignature,
              activationDate: mergedActivation,
              status: "PENDIENTE"
            }
          });
        }
      }
    }

    // Si el estado es ACTIVO (o BAJA, implica que llegó a activarse), el SupplyPoint es de este cliente
    if ((newStatus === 'ACTIVO' || newStatus === 'BAJA') && contract.clientId !== contract.supplyPoint.clientId) {
      await prisma.supplyPoint.update({
        where: { id: contract.supplyPointId },
        data: {
          clientId: contract.clientId
        }
      });
    }

    // Si el contrato pasa a ACTIVO por primera vez y hay un anterior, le damos de BAJA
    if (newStatus === 'ACTIVO' && contract.status !== 'ACTIVO' && contract.previousContractId) {
      await prisma.contract.update({
        where: { id: contract.previousContractId },
        data: {
          status: 'BAJA',
          terminationDate: mergedActivation
        }
      });
    }

    revalidatePath('/contratos');
    revalidatePath(`/contratos/${contractId}`);

    return { success: true, contractId, newStatus };
  } catch (error: any) {
    console.error('Error updating contract dates:', error);
    return { error: error.message || 'Error desconocido' };
  }
}

export async function sendContractToDocuSignAction(contractId: string) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { Lead: true }
    });

    if (!contract) return { error: 'Contrato no encontrado' };

    // Aquí iría la lógica del SDK de DocuSign Node.js
    // 1. Generar PDF (usando la misma lógica que el endpoint /api/pdf/contract)
    // 2. Crear un Envelope de DocuSign
    // 3. Añadir al firmante (contract.lead.email o contract.contactEmail)
    // 4. Enviar

    console.log(`Simulando envío a DocuSign para el contrato ${contractId}`);

    // Como simulación, podemos dejarlo en BORRADOR pero marcando que ya se ha enviado (podríamos añadir un campo sentToSignatureDate en el schema en el futuro)
    
    return { success: true, message: 'Contrato enviado a firma exitosamente.' };
  } catch (error: any) {
    console.error('Error sending contract to DocuSign:', error);
    return { error: error.message || 'Error desconocido al enviar a DocuSign' };
  }
}

export async function createContractModificationAction(contractId: string, type: string, changes: any) {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    });

    if (!contract) return { error: 'Contrato no encontrado' };

    // Para M1N (técnica) u otras, creamos un registro de modificación
    const mod = await prisma.contractModification.create({
      data: {
        contractId: contractId,
        type: type,
        status: 'PENDIENTE',
        requestedChanges: changes
      }
    });

    // TODO: Si es M1S, podríamos clonar el contrato y generar el Anexo.

    return { success: true, message: 'Modificación solicitada correctamente.', modificationId: mod.id };
  } catch (error: any) {
    console.error('Error creating modification:', error);
    return { error: error.message || 'Error desconocido al solicitar modificación' };
  }
}

export async function updateContractFull(formData: FormData) {
  try {
    const contractId = formData.get('contractId') as string;
    if (!contractId) throw new Error('Contract ID missing');

    const status = formData.get('status') as string;
    const internalComments = formData.get('internalComments') as string;
    const signatureDate = formData.get('signatureDate') as string;
    const activationDate = formData.get('activationDate') as string;
    const terminationDate = formData.get('terminationDate') as string;
    const permanenceStartDate = formData.get('permanenceStartDate') as string;
    const tramitationType = formData.get('tramitationType') as string;

    const distributor = formData.get('distributor') as string;
    const annualConsumptionStr = formData.get('annualConsumption') as string;
    const vatNumber = formData.get('vatNumber') as string;
    const contactEmail = formData.get('contactEmail') as string;
    const invoiceEmail = formData.get('invoiceEmail') as string;
    const contactPhone = formData.get('contactPhone') as string;
    const iban = formData.get('iban') as string;
    const cnae = formData.get('cnae') as string;

    const file = formData.get('signedContractPdf') as File | null;

    // First fetch the existing contract to get client and supply point IDs
    const existing = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { client: true, supplyPoint: true }
    });

    if (!existing) throw new Error('Contract not found');

    // Handle file upload
    if (file && file.size > 0) {
      const blob = await put(`contracts/${contractId}/${file.name}`, file, {
        access: 'public',
      });
      // Save it as a Document related to Contract
      await prisma.document.create({
        data: {
          type: 'Contrato',
          url: blob.url,
          name: file.name,
          contractId: contractId
        }
      });
    }

    // Update Client
    if (existing.clientId) {
      await prisma.client.update({
        where: { id: existing.clientId },
        data: {
          vatNumber: vatNumber || undefined,
          contactEmail: contactEmail || undefined,
          invoiceEmail: invoiceEmail || undefined,
          contactPhone: contactPhone || undefined,
          iban: iban || undefined,
          cnae: cnae || undefined,
        }
      });
    }

    // Update SupplyPoint
    if (existing.supplyPointId) {
      await prisma.supplyPoint.update({
        where: { id: existing.supplyPointId },
        data: {
          distributor: distributor || undefined,
          annualConsumption: annualConsumptionStr ? parseFloat(annualConsumptionStr) : undefined,
        }
      });
    }

    // Update Contract
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: status || undefined,
        internalComments: internalComments,
        signatureDate: signatureDate ? new Date(signatureDate) : null,
        activationDate: activationDate ? new Date(activationDate) : null,
        terminationDate: terminationDate ? new Date(terminationDate) : null,
        permanenceStartDate: permanenceStartDate ? new Date(permanenceStartDate) : null,
        tramitationType: tramitationType || undefined,
      }
    });

    revalidatePath('/contratos');
    return { success: true };
  } catch (error: any) {
    console.error('Error in updateContractFull:', error);
    return { error: error.message || 'Error updating contract' };
  }
}
