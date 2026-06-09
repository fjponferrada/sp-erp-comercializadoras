'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSipsData } from '@/lib/sips';

export async function createLeadAction(formData: FormData) {
  // 1. Identificar al usuario logueado
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error('No autorizado');
  }

  // Obtenemos los datos completos del usuario comercial y su marca
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { brand: true }
  });

  if (!user) throw new Error('Usuario no encontrado en la BD');

  // Datos del formulario
  const vatNumber = formData.get('vatNumber') as string;
  const businessName = formData.get('businessName') as string;
  const cups = formData.get('cups') as string;
  const estimatedMWh = parseFloat((formData.get('estimatedMWh') as string) || '0');
  const genContratoAuto = formData.get('genContratoAuto') === 'true';
  const wantsComparison = formData.get('wantsComparison') === 'true';
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const productType = formData.get('productType') as string;
  const product = formData.get('product') as string;
  const additionalServices = formData.get('additionalServices') as string;
  const forceTariff = formData.get('tariff') as string;
  const forceSelfConsumption = formData.get('selfConsumption') as string;
  const type = (formData.get('type') as string) || 'LUZ';
  const userAddress = formData.get('direccion') as string;
  const solarDataStr = formData.get('solarData') as string;
  const solarData = solarDataStr ? JSON.parse(solarDataStr) : null;
  
  const sipsDataStr = formData.get('sipsData') as string;
  let parsedSipsData = null;
  if (sipsDataStr) {
    try { parsedSipsData = JSON.parse(sipsDataStr); } catch (e) {}
  }

  // Ahora leemos contractData como un JSON completo enviado desde el cliente
  const contractDataStr = formData.get('contractData') as string;
  let contractData: any = {};
  if (contractDataStr) {
    try { contractData = JSON.parse(contractDataStr); } catch (e) {}
  }

  const documentsStr = formData.get('documents') as string;
  let documents: any[] = [];
  if (documentsStr) {
    try { documents = JSON.parse(documentsStr); } catch (e) {}
  }

  // 2. AUTOMATIZACIÓN: Validación B2B instantánea
  // Evaluamos la primera letra del NIF/CIF
  const esJuridica = vatNumber ? /^[ABJUV]/i.test(vatNumber) : false;
  const clientType = esJuridica ? 'JURIDICA' : 'FISICA'; // B2B logic resuelta nativamente

  // 3. AUTOMATIZACIÓN: Valores por defecto del Comercial
  const leadSource = user.defaultSource || 'Directo';

  // Ejecutamos la inserción unificada (Lead + Cliente + SupplyPoint)
  const lead = await prisma.$transaction(async (tx) => {
    const effectiveVat = vatNumber || `TEMP-${Date.now()}`;
    const client = await tx.client.upsert({
      where: { vatNumber_brandId: { vatNumber: effectiveVat, brandId: user.brandId } },
      update: {},
      create: {
        vatNumber: effectiveVat,
        businessName: businessName || 'Sin Nombre',
        clientType: clientType,
        brandId: user.brandId
      }
    });

    if (cups && type === 'LUZ') {
      const sp = await tx.supplyPoint.findFirst({ where: { cups, client: { brandId: user.brandId } } });
      if (!sp) {
        await tx.supplyPoint.create({
          data: {
            cups,
            address: parsedSipsData?.direccion || userAddress || 'Pendiente de SIPS',
            city: parsedSipsData?.poblacion || 'Pendiente',
            postalCode: parsedSipsData?.cp || '00000',
            province: parsedSipsData?.provincia || 'Pendiente',
            tariff: forceTariff || parsedSipsData?.tarifa || '2.0TD',
            clientId: client.id
          }
        });
      } else if (client.id && sp.clientId !== client.id) {
        await tx.supplyPoint.update({
          where: { id: sp.id },
          data: { clientId: client.id }
        });
      }
    }

    const createdLead = await tx.lead.create({
      data: {
        businessName,
        vatNumber: vatNumber || null,
        email: email || null,
        phone: phone || null,
        cups: cups || null,
        status: 'NUEVO',
        source: leadSource,
        userId: user.id,
        type,
        solarData,
        contractData, // <-- Guardamos la nueva lógica reactiva completa
        wantsComparison,
        productType: productType || null,
        product: product || null,
        additionalServices: additionalServices || null,
        tariff: forceTariff || (parsedSipsData?.tarifa || '2.0TD'),
        estimatedMWh: estimatedMWh || null,
        
        // Mapeo directo de Airtable
        generateOffer: contractData?.generateOffer ?? null,
        monthlyExpense: contractData?.monthlyExpense ? String(contractData?.monthlyExpense) : null,
        savings: contractData?.savings ? Number(contractData?.savings) : null,
        comparative: contractData?.comparative || null,
        comments: contractData?.comments || null,
        priceServiceActual: contractData?.priceServiceActual ? Number(contractData?.priceServiceActual) : null,
        
        p1eActual: contractData?.p1eActual ? Number(contractData?.p1eActual) : null,
        p2eActual: contractData?.p2eActual ? Number(contractData?.p2eActual) : null,
        p3eActual: contractData?.p3eActual ? Number(contractData?.p3eActual) : null,
        p4eActual: contractData?.p4eActual ? Number(contractData?.p4eActual) : null,
        p5eActual: contractData?.p5eActual ? Number(contractData?.p5eActual) : null,
        p6eActual: contractData?.p6eActual ? Number(contractData?.p6eActual) : null,

        p1pDaily: contractData?.p1pDaily ? Number(contractData?.p1pDaily) : null,
        p2pDaily: contractData?.p2pDaily ? Number(contractData?.p2pDaily) : null,
        p3pDaily: contractData?.p3pDaily ? Number(contractData?.p3pDaily) : null,
        p4pDaily: contractData?.p4pDaily ? Number(contractData?.p4pDaily) : null,
        p5pDaily: contractData?.p5pDaily ? Number(contractData?.p5pDaily) : null,
        p6pDaily: contractData?.p6pDaily ? Number(contractData?.p6pDaily) : null,
        sipsOk: type === 'FV' ? true : (parsedSipsData ? true : false),
        sipsMessages: type === 'FV' ? 'Estudio Fotovoltaico' : (parsedSipsData ? 'Pre-completado por SIPS (Cliente)' : null)
      }
    });

    // Guardar Documentos asociados
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (doc.url) {
          await tx.document.create({
            data: {
              type: doc.type,
              url: doc.url,
              name: doc.name || doc.type,
              leadId: createdLead.id
            }
          });
        }
      }
    }

    return createdLead;
  });

  // 4. AUTOMATIZACIÓN NATIVA: Consulta a INGEBAU SIPS
  if (lead.id && cups && type === 'LUZ') {
    getSipsData(cups).then(async (sipsData) => {
      if (sipsData && sipsData.result !== 'ERROR') {
        const t = forceTariff || sipsData.tarifa || sipsData.Tarifa || '2.0TD';
        
        let autoConsumo = sipsData.autoconsumo || sipsData.Autoconsumo || sipsData['Cod Autoconsumo SIPS'];
        if (forceSelfConsumption === 'SI') autoConsumo = '12';
        else if (forceSelfConsumption === 'NO') autoConsumo = null;
        else if (autoConsumo && String(autoConsumo).includes('41')) autoConsumo = '12';

        let sp = await prisma.supplyPoint.findFirst({ where: { cups, client: { brandId: user.brandId } } });
        if (sp) {
          await prisma.supplyPoint.update({
          where: { id: sp!.id },
          data: {
            tariff: String(t),
            address: sipsData.direccion || sipsData.Direccion,
            city: sipsData.municipio || sipsData.Municipio,
            postalCode: sipsData.cp || sipsData.CP || sipsData['CP SIPS'],
            province: sipsData.provincia || sipsData.Provincia,
            cnae: sipsData.cnae || sipsData.CNAE || sipsData['CNAE SIPS'],
            selfConsumptionType: autoConsumo ? String(autoConsumo) : null
          }
        });
        }
        
        // 5. AUTOMATIZACIÓN: Motor de Validación y Auto-Generación
        // Ahora respeta las tarifas permitidas específicamente a este comercial
        const tarifaEsValida = user.allowedAutoTariffs.includes(String(t));
        const consumoOk = estimatedMWh > 0 || Number(sipsData.consumo) > 0;
        
        let newStatus = 'NUEVO';
        if (tarifaEsValida && consumoOk && genContratoAuto && !wantsComparison) {
          // Si todo está OK y el comercial pidió contrato automático (no comparativa)
          newStatus = 'BORRADOR GENERADO';
          console.log(`[VALIDATOR] Lead ${lead.id} cumple condiciones. Generando borrador automático...`);
          // Aquí en el futuro llamaremos a la función que genera el PDF real
        }

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            sipsOk: true,
            sipsMessages: 'Validado correctamente',
            status: newStatus
          }
        });

        console.log(`[SIPS] SupplyPoint y Lead actualizados exitosamente para CUPS: ${cups}`);
      } else {
        // Hubo error en el SIPS
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            sipsOk: false,
            sipsMessages: sipsData?.messages || 'Error desconocido en INGEBAU'
          }
        });
        console.warn(`[SIPS] Fallo validando SIPS para CUPS ${cups}: ${sipsData?.messages}`);
      }
    }).catch(console.error);
  }

  return { success: true, leadId: lead.id };
}

export async function duplicateLeadAction(leadId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  const oldLead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!oldLead) throw new Error('Lead no encontrado');

  const newLead = await prisma.lead.create({
    data: {
      businessName: oldLead.businessName + ' (Copia)',
      firstName: oldLead.firstName,
      lastName: oldLead.lastName,
      vatNumber: oldLead.vatNumber,
      email: oldLead.email,
      phone: oldLead.phone,
      status: 'NUEVO', // El clon siempre empieza en NUEVO
      source: oldLead.source,
      cups: oldLead.cups,
      estimatedMWh: oldLead.estimatedMWh,
      tariff: oldLead.tariff,
      userId: oldLead.userId,
      // No copiamos contratos ni documentos
    }
  });

  return { success: true, leadId: newLead.id };
}

export async function updateLeadCupsAction(leadId: string, newCups: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { user: true } });
  if (!lead) throw new Error('Lead no encontrado');

  // 1. Extraer Código REE Distribuidora (ej: ES0021... -> 0021)
  const reeCode = newCups.startsWith('ES') && newCups.length >= 6 ? newCups.substring(2, 6) : null;

  // 2. Actualizar el CUPS en el Lead e invalidar SIPS anterior
  await prisma.lead.update({
    where: { id: leadId },
    data: { 
      cups: newCups,
      sipsOk: false,
      sipsMessages: 'Actualizando CUPS...'
    }
  });

  // 3. Volver a consultar INGEBAU (SIPS) en background
  getSipsData(newCups).then(async (data) => {
    if (data && data.result !== 'ERROR') {
      const t = data.tarifa || data.Tarifa || '2.0TD';
      let autoConsumo = data.autoconsumo || data.Autoconsumo || data['Cod Autoconsumo SIPS'];
      if (autoConsumo && String(autoConsumo).includes('41')) autoConsumo = '12';

      // Upsert SupplyPoint con el nuevo CUPS
      let sp = await prisma.supplyPoint.findFirst({ where: { cups: newCups, client: { brandId: lead.user.brandId } } });
      if (sp) {
        await prisma.supplyPoint.update({
          where: { id: sp.id },
          data: {
            tariff: String(t),
            address: data.direccion || data.Direccion,
            city: data.municipio || data.Municipio,
            postalCode: data.cp || data.CP || data['CP SIPS'],
            province: data.provincia || data.Provincia,
            cnae: data.cnae || data.CNAE || data['CNAE SIPS'],
            selfConsumptionType: autoConsumo ? String(autoConsumo) : null,
            distributor: reeCode || undefined
          }
        });
      } else {
        await prisma.supplyPoint.create({
          data: {
            cups: newCups,
            tariff: String(t),
            address: data.direccion || data.Direccion,
            city: data.municipio || data.Municipio,
            postalCode: data.cp || data.CP || data['CP SIPS'],
            province: data.provincia || data.Provincia,
            cnae: data.cnae || data.CNAE || data['CNAE SIPS'],
            selfConsumptionType: autoConsumo ? String(autoConsumo) : null,
            distributor: reeCode || undefined,
            clientId: 'TEMPORAL' // Esto se corregirá cuando enlacemos con el clientId del Lead
          }
        });
      }

      const tarifaEsValida = lead.user.allowedAutoTariffs.includes(String(t));
      const consumoOk = Number(data.consumo) > 0 || (lead.estimatedMWh ?? 0) > 0;
      
      let newStatus = lead.status;
      if (tarifaEsValida && consumoOk && lead.status === 'NUEVO') {
        newStatus = 'BORRADOR GENERADO';
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { sipsOk: true, sipsMessages: 'SIPS Validado tras cambio de CUPS', status: newStatus }
      });
    } else {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { sipsOk: false, sipsMessages: data?.messages || 'Error de SIPS al cambiar CUPS' }
      });
    }
  }).catch(console.error);

  return { success: true };
}
export async function forceRefreshSipsAction(leadId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { user: true } });
  if (!lead) throw new Error('Lead no encontrado');

  const airtableData = lead.airtableData as any || {};
  let effectiveCups = lead.cups;
  if ((!effectiveCups || effectiveCups.startsWith('CUPS_MOCK')) && airtableData['CUPS2']) {
    effectiveCups = airtableData['CUPS2'];
  }

  if (!effectiveCups || effectiveCups.startsWith('CUPS_MOCK')) throw new Error('El Lead no tiene CUPS configurado');

  const reeCode = effectiveCups.startsWith('ES') && effectiveCups.length >= 6 ? effectiveCups.substring(2, 6) : null;

  // Consultar SIPS de forma síncrona para que la interfaz espere la respuesta
  const data = await getSipsData(effectiveCups);

  if (data && data.result !== 'ERROR') {
    const t = data.tarifa || data.Tarifa || '2.0TD';
    let autoConsumo = data.autoconsumo || data.Autoconsumo || data['Cod Autoconsumo SIPS'];
    if (autoConsumo && String(autoConsumo).includes('41')) autoConsumo = '12';

    let sp = await prisma.supplyPoint.findFirst({ where: { cups: effectiveCups, client: { brandId: lead.user.brandId } } });
    if (sp) {
      await prisma.supplyPoint.update({
        where: { id: sp.id },
        data: {
          tariff: String(t),
          address: data.direccion || data.Direccion,
          city: data.municipio || data.Municipio,
          postalCode: data.cp || data.CP || data['CP SIPS'],
          province: data.provincia || data.Provincia,
          cnae: data.cnae || data.CNAE || data['CNAE SIPS'],
          selfConsumptionType: autoConsumo ? String(autoConsumo) : null,
          distributor: reeCode || undefined
        }
      });
    } else {
      await prisma.supplyPoint.create({
        data: {
          cups: effectiveCups,
          tariff: String(t),
          address: data.direccion || data.Direccion,
          city: data.municipio || data.Municipio,
          postalCode: data.cp || data.CP || data['CP SIPS'],
          province: data.provincia || data.Provincia,
          cnae: data.cnae || data.CNAE || data['CNAE SIPS'],
          selfConsumptionType: autoConsumo ? String(autoConsumo) : null,
          distributor: reeCode || undefined,
          clientId: 'TEMPORAL'
        }
      });
    }

    const tarifaEsValida = lead.user.allowedAutoTariffs.includes(String(t));
    const consumoOk = Number(data.consumo) > 0 || (lead.estimatedMWh ?? 0) > 0;
    
    let newStatus = lead.status;
    if (tarifaEsValida && consumoOk && lead.status === 'NUEVO') {
      newStatus = 'BORRADOR GENERADO';
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { sipsOk: true, sipsMessages: 'SIPS Refrescado Correctamente', status: newStatus }
    });

    return { success: true, message: 'Datos SIPS actualizados correctamente' };
  } else {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { sipsOk: false, sipsMessages: data?.messages || 'Error al refrescar SIPS' }
    });
    return { success: false, message: data?.messages || 'Error de Ingebau' };
  }
}

export async function updateSolarDataAction(leadId: string, solarData: any) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  await prisma.lead.update({
    where: { id: leadId },
    data: { solarData }
  });

  return { success: true };
}

export async function updateLeadAction(leadId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  const businessName = formData.get('businessName') as string;
  const vatNumber = (formData.get('vatNumber') as string)?.toUpperCase()?.trim();
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const cups = (formData.get('cups') as string)?.toUpperCase()?.trim();
  const forceTariff = formData.get('tariff') as string;
  const userAddress = formData.get('direccion') as string;

  const sipsDataStr = formData.get('sipsData') as string;
  let parsedSipsData = null;
  if (sipsDataStr) {
    try { parsedSipsData = JSON.parse(sipsDataStr); } catch (e) {}
  }

  const contractDataStr = formData.get('contractData') as string;
  let contractData: any = {};
  if (contractDataStr) {
    try { contractData = JSON.parse(contractDataStr); } catch (e) {}
  }
  
  const documentsStr = formData.get('documents') as string;
  let documents: any[] = [];
  if (documentsStr) {
    try { documents = JSON.parse(documentsStr); } catch (e) {}
  }

  await prisma.$transaction(async (tx) => {
    // Actualizar Cliente si cambió NIF o Nombre
    let clientId: string | null = null;
    if (vatNumber) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email! }});
      const client = await tx.client.upsert({
        where: { vatNumber_brandId: { vatNumber, brandId: user!.brandId } },
        update: { businessName, contactEmail: email || null, contactPhone: phone || null },
        create: { vatNumber, businessName, contactEmail: email || null, contactPhone: phone || null, clientType: /^[ABJUV]/i.test(vatNumber) ? 'JURIDICA' : 'FISICA', brandId: user!.brandId }
      });
      clientId = client.id;
    }

    // Actualizar Suministro si hay CUPS
    if (cups) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email! }});
      const sp = await tx.supplyPoint.findFirst({ where: { cups, client: { brandId: user!.brandId } } });
      if (!sp) {
        await tx.supplyPoint.create({
          data: {
            cups,
            address: parsedSipsData?.direccion || userAddress || 'Pendiente de SIPS',
            city: parsedSipsData?.poblacion || 'Pendiente',
            postalCode: parsedSipsData?.cp || '00000',
            province: parsedSipsData?.provincia || 'Pendiente',
            tariff: forceTariff || parsedSipsData?.tarifa || '2.0TD',
            clientId: clientId || 'TEMPORAL'
          }
        });
      } else {
        await tx.supplyPoint.update({
          where: { id: sp.id },
          data: {
            tariff: forceTariff || parsedSipsData?.tarifa || sp.tariff,
            address: parsedSipsData?.direccion || userAddress || sp.address,
            city: parsedSipsData?.poblacion || sp.city,
            postalCode: parsedSipsData?.cp || sp.postalCode,
            province: parsedSipsData?.provincia || sp.province,
            clientId: clientId || sp.clientId
          }
        });
      }
    }

    await tx.lead.update({
      where: { id: leadId },
      data: {
        businessName,
        vatNumber: vatNumber || null,
        email: email || null,
        phone: phone || null,
        cups: cups || null,
        contractData,
        tariff: forceTariff || (parsedSipsData?.tarifa || '2.0TD'),
        
        generateOffer: contractData?.generateOffer ?? null,
        monthlyExpense: contractData?.monthlyExpense ? String(contractData?.monthlyExpense) : null,
        savings: contractData?.savings ? Number(contractData?.savings) : null,
        comparative: contractData?.comparative || null,
        comments: contractData?.comments || null,
        priceServiceActual: contractData?.priceServiceActual ? Number(contractData?.priceServiceActual) : null,
        
        p1eActual: contractData?.p1eActual ? Number(contractData?.p1eActual) : null,
        p2eActual: contractData?.p2eActual ? Number(contractData?.p2eActual) : null,
        p3eActual: contractData?.p3eActual ? Number(contractData?.p3eActual) : null,
        p4eActual: contractData?.p4eActual ? Number(contractData?.p4eActual) : null,
        p5eActual: contractData?.p5eActual ? Number(contractData?.p5eActual) : null,
        p6eActual: contractData?.p6eActual ? Number(contractData?.p6eActual) : null,

        p1pDaily: contractData?.p1pDaily ? Number(contractData?.p1pDaily) : null,
        p2pDaily: contractData?.p2pDaily ? Number(contractData?.p2pDaily) : null,
        p3pDaily: contractData?.p3pDaily ? Number(contractData?.p3pDaily) : null,
        p4pDaily: contractData?.p4pDaily ? Number(contractData?.p4pDaily) : null,
        p5pDaily: contractData?.p5pDaily ? Number(contractData?.p5pDaily) : null,
        p6pDaily: contractData?.p6pDaily ? Number(contractData?.p6pDaily) : null,
      }
    });

    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (doc.url) {
          await tx.document.create({
            data: {
              type: doc.type,
              url: doc.url,
              name: doc.name || doc.type,
              leadId: leadId
            }
          });
        }
      }
    }
  });

  return { success: true };
}
