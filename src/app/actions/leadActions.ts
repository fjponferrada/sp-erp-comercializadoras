'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { findOrUpdateSupplyPointByCups } from '@/lib/supplyPointHelper';
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
  
  // Movido arriba

  // Ahora leemos contractData como un JSON completo enviado desde el cliente
  const contractDataStr = formData.get('contractData') as string;
  let contractData: any = {};
  if (contractDataStr) {
    try { contractData = JSON.parse(contractDataStr); } catch (e) {}
  }

  const sipsDataStr = formData.get('sipsData') as string;
  let parsedSipsData = null;
  if (sipsDataStr) {
    try { 
      parsedSipsData = JSON.parse(sipsDataStr); 
    } catch (e) {}
  }

  if (parsedSipsData) {
    const sCnae = parsedSipsData.cnae || parsedSipsData.CNAE || parsedSipsData['CNAE SIPS'];
    if (sCnae) contractData.cnae = sCnae;
    
    const sCp = parsedSipsData.cp || parsedSipsData.CP || parsedSipsData['CP SIPS'];
    if (sCp) {
      if (!contractData.direccionSuministro) contractData.direccionSuministro = {};
      contractData.direccionSuministro.postalCode = sCp;
    }
  }

  const documentsStr = formData.get('documents') as string;
  let documents: any[] = [];
  if (documentsStr) {
    try { documents = JSON.parse(documentsStr); } catch (e) {}
  }

  // 2. AUTOMATIZACIÓN: Validación B2B instantánea
  // Evaluamos la primera letra del NIF/CIF
  const esJuridica = vatNumber ? !/^([0-9XYZ])/i.test(vatNumber) : false;
  const clientType = esJuridica ? 'JURIDICA' : 'FISICA'; // B2B logic resuelta nativamente

  // ==========================================
  // VALIDACIONES DE NEGOCIO (Reglas 73, 74, 75)
  // ==========================================
  if (contractData?.generateOffer === false && type === 'LUZ') {
    // Regla 75: Validación Representante Legal (B2B)
    if (esJuridica) {
      const repName = contractData.representativeName || '';
      const repLast = contractData.representativeLastName || '';
      const repVat = contractData.representativeVat || '';
      if (!repName.trim() || !repLast.trim() || !repVat.trim()) {
        throw new Error('Validación fallida (Regla 75): Los contratos para personas jurídicas requieren obligatoriamente los datos del representante legal (DNI, Nombre y Apellidos).');
      }
    }

    const technicalTariff = forceTariff || parsedSipsData?.tarifa || '2.0TD';
    
    // Regla 73: Congruencia Producto vs Tarifa
    if (product) {
      let productTariff: string | null = null;
      if (product.startsWith('cm')) {
        const dbProduct = await prisma.product.findUnique({ where: { id: product } });
        if (dbProduct) productTariff = dbProduct.tariff;
      } else {
        const dbProduct = await prisma.product.findFirst({ where: { name: product.trim() } });
        if (dbProduct) productTariff = dbProduct.tariff;
      }
      
      if (productTariff && productTariff !== technicalTariff) {
        throw new Error(`Validación fallida (Regla 73): Incongruencia de producto/tarifa. El producto exige tarifa ${productTariff}, pero el suministro tiene tarifa ${technicalTariff}.`);
      }
    }

    // Regla 74: Validación Cruzada SIPS
    if (parsedSipsData) {
      const tramType = contractData.tramitationType || '';
      if (tramType === 'Cambio comercializadora sin cambios' || tramType === 'Modificación de datos administrativos' || tramType === 'Cambio comercializadora con cambios administrativos') {
        if (technicalTariff !== parsedSipsData.tarifa) {
          throw new Error('Validación fallida (Regla 74): Para este tipo de tramitación, la Tarifa de Acceso solicitada debe coincidir exactamente con la de SIPS.');
        }

        const sP1 = Number(parsedSipsData.p1 || 0); const sP2 = Number(parsedSipsData.p2 || 0); const sP3 = Number(parsedSipsData.p3 || 0);
        const sP4 = Number(parsedSipsData.p4 || 0); const sP5 = Number(parsedSipsData.p5 || 0); const sP6 = Number(parsedSipsData.p6 || 0);
        const rP1 = Number(contractData.p1c || 0); const rP2 = Number(contractData.p2c || 0); const rP3 = Number(contractData.p3c || 0);
        const rP4 = Number(contractData.p4c || 0); const rP5 = Number(contractData.p5c || 0); const rP6 = Number(contractData.p6c || 0);

        if (Math.abs(sP1 - rP1) > 0.01 || Math.abs(sP2 - rP2) > 0.01 || Math.abs(sP3 - rP3) > 0.01 || 
            Math.abs(sP4 - rP4) > 0.01 || Math.abs(sP5 - rP5) > 0.01 || Math.abs(sP6 - rP6) > 0.01) {
          throw new Error('Validación fallida (Regla 74): Para este tipo de tramitación, las Potencias solicitadas deben coincidir exactamente con las registradas en SIPS.');
        }
      }
    }
  }
  // ==========================================


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
        contractData,
        ...(parsedSipsData ? { sipsRawData: parsedSipsData } : {}),
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
        // ELIMINADO: No sobrescribimos la información base del SupplyPoint existente al crear un Lead.
        // La actualización de SupplyPoint solo se hace si no existía, o cuando el contrato se activa definitivamente.
        
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
            sipsRawData: sipsData,
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

// Helper para normalizar números y tipos
const getScalar = (val: any) => {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.length > 0 ? String(val[0]) : '';
  if (typeof val === 'object') return '';
  return String(val);
};

const normNum = (val: any) => {
  const upper = String(val || '').toUpperCase().trim();
  if (upper.includes('NÚM') || upper.includes('NUM')) return 'NÚMERO';
  if (upper.includes('KM')) return 'KM';
  if (upper.includes('S/N') || upper.includes('SN')) return 'S/N';
  return 'NÚMERO';
};

const normProdType = (val: any) => {
  const upper = String(val || '').toUpperCase().trim();
  if (upper === 'FIJO' || upper === 'INDEXADO' || upper === 'FIJO_PERS' || upper === 'INDEXADO_PERS') return upper;
  if (upper.includes('INDEX')) return 'INDEXADO';
  return 'FIJO';
};

// Convierte un lead bruto de Airtable al formato limpio del CRM
function translateAirtableToNativeCRM(oldLead: any) {
  const cd = oldLead.contractData || {};
  const ad = oldLead.airtableData || {};

  // Logica de extracción copiada de NewLeadModal
  let vat = oldLead.vatNumber || cd.vatNumber || getScalar(ad['NIF / CIF Titular']) || getScalar(ad['DNI / CIF Titular']) || getScalar(ad['DNI/CIF Titular']) || '';
  let rawBusinessName = oldLead.businessName || cd.businessName || getScalar(ad['Razón social / Nombre']) || getScalar(ad['Nombre Titular']) || getScalar(ad['NOMBRE Y APELLIDOS']) || getScalar(ad['Nombre completo Titular']) || '';
  
  const esJuridica = vat && /^[A-HJ-NP-SW]\d{7}[0-9A-J]$/i.test(vat);
  let pAp = cd.primerApellido || getScalar(ad['Primer Apellido']) || getScalar(ad['Primer apellido Titular']) || '';
  let sAp = cd.segundoApellido || getScalar(ad['Segundo Apellido']) || getScalar(ad['Segundo apellido Titular']) || '';

  if (rawBusinessName) rawBusinessName = rawBusinessName.replace(/\(Copia\)/ig, '').trim();
  if (pAp) pAp = pAp.replace(/\(Copia\)/ig, '').trim();
  if (sAp) sAp = sAp.replace(/\(Copia\)/ig, '').trim();

  // Reconstruir el nombre completo si es una persona física y los apellidos no están ya incluidos
  let finalBusinessName = rawBusinessName;
  const tipoPersona = cd.tipoPersona || (esJuridica ? 'JURIDICA' : 'FISICA');
  if (tipoPersona === 'FISICA') {
    if (pAp && !finalBusinessName.toUpperCase().includes(pAp.toUpperCase())) {
      finalBusinessName += ` ${pAp}`;
    }
    if (sAp && !finalBusinessName.toUpperCase().includes(sAp.toUpperCase())) {
      finalBusinessName += ` ${sAp}`;
    }
  }
  finalBusinessName = finalBusinessName.replace(/\s+/g, ' ').trim();

  const rawTipoProducto = normProdType(oldLead.productType || cd.tipoProducto || getScalar(ad['Tipo de producto']));

  // Formato nativo para ContractData (JSON Estructurado)
  const contractData = {
    tipoPersona: cd.tipoPersona || (esJuridica ? 'JURIDICA' : 'FISICA'),
    primerApellido: pAp,
    segundoApellido: sAp,
    cnae: oldLead.sipsCnae || cd.cnae || getScalar(ad['CNAE']) || getScalar(ad['SIPS Cnae']) || '',
    direccion: {
      tipoVia: cd.tipoVia || getScalar(ad['Tipo de vía Titular']) || 'Calle',
      nombreVia: cd.nombreVia || getScalar(ad['Calle Titular']) || getScalar(ad['DOMICILIO SOC']) || '',
      tipoNumeracion: cd.tipoNumeracion || normNum(getScalar(ad['Tipo de numeración Titular'])),
      numKm: cd.numKm || getScalar(ad['Número Titular']) || '',
      adicional: cd.adicional || getScalar(ad['Adicional Titular']) || '',
      cp: cd.cp || getScalar(ad['CP SOC']) || '',
      poblacion: cd.poblacion || getScalar(ad['Población Titular']) || getScalar(ad['POBLACION SOC']) || '',
      provincia: cd.provincia || getScalar(ad['Provincia Titular']) || getScalar(ad['PROVINCIA SOC']) || '',
      pais: cd.pais || getScalar(ad['País Titular']) || 'España'
    },
    direccionSuministro: {
      tipoVia: cd.sTipoVia || getScalar(ad['Tipo de vía Instalación']) || 'Calle',
      nombreVia: cd.sNombreVia || getScalar(ad['Calle Instalación']) || getScalar(ad['DOMICILIO PS']) || getScalar(ad['DOMICILIO PS COMPLETO']) || '',
      tipoNumeracion: cd.sTipoNumeracion || normNum(getScalar(ad['Tipo de numeración Instalación'])),
      numKm: cd.sNumKm || getScalar(ad['Número Instalación']) || '',
      adicional: cd.sAdicional || getScalar(ad['Adicional Instalación']) || '',
      cp: cd.sCp || getScalar(ad['Código Postal Instalación']) || getScalar(ad['CP_CONT']) || '',
      poblacion: cd.sPoblacion || getScalar(ad['Población Instalación']) || getScalar(ad['POBLACION_CONT']) || '',
      provincia: cd.sProvincia || getScalar(ad['Provincia Instalación']) || getScalar(ad['PROVINCIA_CONT']) || '',
      pais: cd.sPais || 'España'
    },
    contactoNombre: oldLead.contactName || cd.contactoNombre || getScalar(ad['Nombre Contacto']) || '',
    contactoApellidos: oldLead.contactLastName || cd.contactoApellidos || getScalar(ad['Apellidos Contacto']) || '',
    contactoNif: oldLead.contactVat || cd.contactoNif || getScalar(ad['NIF Contacto']) || '',
    
    nombreInstalacion: cd.nombreInstalacion || '',
    tipoTramitacion: oldLead.tramitationType || cd.tipoTramitacion || getScalar(ad['Tramitación a realizar']) || getScalar(ad['Tipo']) || 'Alta nueva',
    firmaManuscrita: cd.firmaManuscrita || false,
    bolsilloSolar: cd.bolsilloSolar || (getScalar(ad['¿Asociar a Bolsillo Solar?']) === 'SI' || getScalar(ad['CG Bolsillo Solar']) ? 'SI' : 'NO'),
    
    iban: oldLead.iban || cd.iban || getScalar(ad['IBAN']) || getScalar(ad['Certificado IBAN']) || '',
    formaPago: oldLead.paymentMethod || cd.formaPago || 'Domiciliación',
    envioFactura: oldLead.invoiceDelivery || cd.envioFactura || (getScalar(ad['¿Facturas papel?']) === 'true' || getScalar(ad['¿Facturas papel?']) === 'SI' || getScalar(ad['¿Facturas papel?']) === 'Sí' ? 'Postal' : 'Email'),
    
    potencias: {
      p1: cd.potencias?.p1 || cd.p1c || String(oldLead.p1c || getScalar(ad['P1C']) || ''),
      p2: cd.potencias?.p2 || cd.p2c || String(oldLead.p2c || getScalar(ad['P2C']) || ''),
      p3: cd.potencias?.p3 || cd.p3c || String(oldLead.p3c || getScalar(ad['P3C']) || ''),
      p4: cd.potencias?.p4 || cd.p4c || String(oldLead.p4c || getScalar(ad['P4C']) || ''),
      p5: cd.potencias?.p5 || cd.p5c || String(oldLead.p5c || getScalar(ad['P5C']) || ''),
      p6: cd.potencias?.p6 || cd.p6c || String(oldLead.p6c || getScalar(ad['P6C']) || '')
    },
    indexado: {
      ip1: cd.indexado?.ip1 || cd.ip1 || String(getScalar(ad['IP1']) || ''),
      ip2: cd.indexado?.ip2 || cd.ip2 || String(getScalar(ad['IP2']) || ''),
      ip3: cd.indexado?.ip3 || cd.ip3 || String(getScalar(ad['IP3']) || ''),
      ip4: cd.indexado?.ip4 || cd.ip4 || String(getScalar(ad['IP4']) || ''),
      ip5: cd.indexado?.ip5 || cd.ip5 || String(getScalar(ad['IP5']) || ''),
      ip6: cd.indexado?.ip6 || cd.ip6 || String(getScalar(ad['IP6']) || ''),
      fee: cd.indexado?.fee || cd.feeIndex || String(getScalar(ad['FEE']) || '')
    },
    pexc: cd.pexc || String(getScalar(ad['PExc']) || getScalar(ad['PExc Personalizado']) || '')
  };

  return {
    contractData,
    nativeFields: {
      businessName: finalBusinessName,
      vatNumber: vat,
      email: oldLead.email || cd.email || getScalar(ad['EMAIL']) || getScalar(ad['Email Contacto']) || '',
      phone: oldLead.phone || cd.phone || getScalar(ad['TLF']) || getScalar(ad['Teléfono Contacto']) || '',
      cups: oldLead.cups || cd.cups || getScalar(ad['CUPS']) || getScalar(ad['CUPS2']) || '',
      tariff: oldLead.tariff || cd.tarifa || getScalar(ad['Tarifa']) || '2.0TD',
      productType: rawTipoProducto,
      product: String(oldLead.product || cd.product || getScalar(ad['Producto']) || getScalar(ad['Producto y Servicio']) || '').trim(),
      additionalServices: oldLead.additionalServices || cd.serviciosAdicionales || ''
    }
  };
}

export async function duplicateLeadAction(leadId: string) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new Error('No autorizado');
  
    const oldLead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!oldLead) throw new Error('Lead no encontrado');
  
    const { id, createdAt, updatedAt, contractId, docusignEnvelopeId, triggerDuplicate, status, airtableId, airtableData, contractData: oldCd, ...rest } = oldLead as any;
  
    // Limpieza de estructura al duplicar (Traducción definitiva a CRM nativo)
    const { contractData, nativeFields } = translateAirtableToNativeCRM(oldLead);

    const newLead = await prisma.lead.create({
      data: {
        ...rest,
        ...nativeFields,
        contractData, // Guardamos el JSON estructurado limpio
        airtableData: null, // Destruimos el JSON sucio en la copia
        status: 'NUEVO', // El clon siempre empieza en NUEVO
      }
    });
  
    return { success: true, leadId: newLead.id };
  } catch (error: any) {
    console.error('Error in duplicateLeadAction:', error);
    return { success: false, error: error.message };
  }
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
      let sp = await findOrUpdateSupplyPointByCups(prisma, newCups, 'TEMPORAL', {
        tariff: String(t),
        address: data.direccion || data.Direccion,
        city: data.municipio || data.Municipio,
        postalCode: data.cp || data.CP || data['CP SIPS'],
        province: data.provincia || data.Provincia,
        cnae: data.cnae || data.CNAE || data['CNAE SIPS'],
        selfConsumptionType: autoConsumo ? String(autoConsumo) : null,
        distributor: reeCode || undefined,
      });

      const tarifaEsValida = lead.user.allowedAutoTariffs.includes(String(t));
      const consumoOk = Number(data.consumo) > 0 || (lead.estimatedMWh ?? 0) > 0;
      
      let newStatus = lead.status;
      if (tarifaEsValida && consumoOk && lead.status === 'NUEVO') {
        newStatus = 'BORRADOR GENERADO';
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { sipsOk: true, sipsRawData: data, sipsMessages: 'SIPS Validado tras cambio de CUPS', status: newStatus }
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

    let sp = await findOrUpdateSupplyPointByCups(prisma, effectiveCups, 'TEMPORAL', {
      tariff: String(t),
      address: data.direccion || data.Direccion,
      city: data.municipio || data.Municipio,
      postalCode: data.cp || data.CP || data['CP SIPS'],
      province: data.provincia || data.Provincia,
      cnae: data.cnae || data.CNAE || data['CNAE SIPS'],
      selfConsumptionType: autoConsumo ? String(autoConsumo) : null,
      distributor: reeCode || undefined,
    });

    const tarifaEsValida = lead.user.allowedAutoTariffs.includes(String(t));
    const consumoOk = Number(data.consumo) > 0 || (lead.estimatedMWh ?? 0) > 0;
    
    let newStatus = lead.status;
    if (tarifaEsValida && consumoOk && lead.status === 'NUEVO') {
      newStatus = 'BORRADOR GENERADO';
    }

    const cData = typeof lead.contractData === 'object' && lead.contractData ? lead.contractData : {};

    const sCnae = data.cnae || data.CNAE || data['CNAE SIPS'];
    if (sCnae) (cData as any).cnae = sCnae;
    
    const sCp = data.cp || data.CP || data['CP SIPS'];
    if (sCp) {
      if (!(cData as any).direccionSuministro) (cData as any).direccionSuministro = {};
      (cData as any).direccionSuministro.postalCode = sCp;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { 
        sipsOk: true,
        sipsRawData: data,
        sipsMessages: 'SIPS Refrescado Correctamente', 
        status: newStatus,
        contractData: cData
      }
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

  if (parsedSipsData) {
    const sCnae = parsedSipsData.cnae || parsedSipsData.CNAE || parsedSipsData['CNAE SIPS'];
    if (sCnae) contractData.cnae = sCnae;
    
    const sCp = parsedSipsData.cp || parsedSipsData.CP || parsedSipsData['CP SIPS'];
    if (sCp) {
      if (!contractData.direccionSuministro) contractData.direccionSuministro = {};
      contractData.direccionSuministro.postalCode = sCp;
    }
  }
  
  const documentsStr = formData.get('documents') as string;
  let documents: any[] = [];
  if (documentsStr) {
    try { documents = JSON.parse(documentsStr); } catch (e) {}
  }

  // ==========================================
  // VALIDACIONES DE NEGOCIO (Reglas 73, 74, 75)
  // ==========================================
  if (contractData?.generateOffer === false) {
    const esJuridica = vatNumber ? !/^([0-9XYZ])/i.test(vatNumber) : false;
    // Regla 75: Validación Representante Legal (B2B)
    if (esJuridica) {
      const repName = contractData.representativeName || '';
      const repLast = contractData.representativeLastName || '';
      const repVat = contractData.representativeVat || '';
      if (!repName.trim() || !repLast.trim() || !repVat.trim()) {
        throw new Error('Validación fallida (Regla 75): Los contratos para personas jurídicas requieren obligatoriamente los datos del representante legal (DNI, Nombre y Apellidos).');
      }
    }

    const technicalTariff = forceTariff || parsedSipsData?.tarifa || '2.0TD';
    
    // Regla 73: Congruencia Producto vs Tarifa
    const product = formData.get('product') as string;
    if (product) {
      let productTariff: string | null = null;
      if (product.startsWith('cm')) {
        const dbProduct = await prisma.product.findUnique({ where: { id: product } });
        if (dbProduct) productTariff = dbProduct.tariff;
      } else {
        const dbProduct = await prisma.product.findFirst({ where: { name: product.trim() } });
        if (dbProduct) productTariff = dbProduct.tariff;
      }
      
      if (productTariff && productTariff !== technicalTariff) {
        throw new Error(`Validación fallida (Regla 73): Incongruencia de producto/tarifa. El producto exige tarifa ${productTariff}, pero el suministro tiene tarifa ${technicalTariff}.`);
      }
    }

    // Regla 74: Validación Cruzada SIPS
    if (parsedSipsData) {
      const tramType = contractData.tramitationType || '';
      if (tramType === 'Cambio comercializadora sin cambios' || tramType === 'Modificación de datos administrativos' || tramType === 'Cambio comercializadora con cambios administrativos') {
        if (technicalTariff !== parsedSipsData.tarifa) {
          throw new Error('Validación fallida (Regla 74): Para este tipo de tramitación, la Tarifa de Acceso solicitada debe coincidir exactamente con la de SIPS.');
        }

        const sP1 = Number(parsedSipsData.p1 || 0); const sP2 = Number(parsedSipsData.p2 || 0); const sP3 = Number(parsedSipsData.p3 || 0);
        const sP4 = Number(parsedSipsData.p4 || 0); const sP5 = Number(parsedSipsData.p5 || 0); const sP6 = Number(parsedSipsData.p6 || 0);
        const rP1 = Number(contractData.p1c || 0); const rP2 = Number(contractData.p2c || 0); const rP3 = Number(contractData.p3c || 0);
        const rP4 = Number(contractData.p4c || 0); const rP5 = Number(contractData.p5c || 0); const rP6 = Number(contractData.p6c || 0);

        if (Math.abs(sP1 - rP1) > 0.01 || Math.abs(sP2 - rP2) > 0.01 || Math.abs(sP3 - rP3) > 0.01 || 
            Math.abs(sP4 - rP4) > 0.01 || Math.abs(sP5 - rP5) > 0.01 || Math.abs(sP6 - rP6) > 0.01) {
          throw new Error('Validación fallida (Regla 74): Para este tipo de tramitación, las Potencias solicitadas deben coincidir exactamente con las registradas en SIPS.');
        }
      }
    }
  }
  // ==========================================

  await prisma.$transaction(async (tx) => {
    // Actualizar Cliente si cambió NIF o Nombre
    let clientId: string | null = null;
    if (vatNumber) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email! }});
      const client = await tx.client.upsert({
        where: { vatNumber_brandId: { vatNumber, brandId: user!.brandId } },
        update: { businessName, contactEmail: email || null, contactPhone: phone || null },
        create: { vatNumber, businessName, contactEmail: email || null, contactPhone: phone || null, clientType: /^([0-9XYZ])/i.test(vatNumber) ? 'FISICA' : 'JURIDICA', brandId: user!.brandId }
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

export async function getLeadStatsAction(filters: any) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  const { getUserVisibilityFilter } = await import('@/lib/permissions');
  const visibilityFilter = await getUserVisibilityFilter();

  const where: any = { AND: [visibilityFilter] };

  if (filters.search) {
    const terms = filters.search.split(/\s+/).filter(Boolean);
    terms.forEach((term: string) => {
      where.AND.push({
        OR: [
          { businessName: { contains: term, mode: 'insensitive' } },
          { vatNumber: { contains: term, mode: 'insensitive' } },
          { cups: { contains: term, mode: 'insensitive' } }
        ]
      });
    });
  }

  if (filters.status && filters.status !== 'Todos') {
    where.AND.push({ status: filters.status });
  }
  if (filters.type && filters.type !== 'Todos') {
    where.AND.push({ type: filters.type });
  }

  const totalLeads = await prisma.lead.count({ where });
  
  const statusGroup = await prisma.lead.groupBy({
    by: ['status'],
    where,
    _count: { status: true }
  });
  
  const statusCounts: Record<string, number> = {};
  statusGroup.forEach(g => {
    statusCounts[g.status] = g._count.status;
  });
  
  const estimatedMWhResult = await prisma.lead.aggregate({
    where,
    _sum: { estimatedMWh: true }
  });
  const totalMWh = estimatedMWhResult._sum.estimatedMWh || 0;

  return { totalLeads, statusCounts, totalMWh };
}

export async function getPaginatedLeadsAction(filters: any, page: number = 1, pageSize: number = 100) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  const { getUserVisibilityFilter } = await import('@/lib/permissions');
  const visibilityFilter = await getUserVisibilityFilter();

  const where: any = { AND: [visibilityFilter] };

  if (filters.search) {
    const terms = filters.search.split(/\s+/).filter(Boolean);
    terms.forEach((term: string) => {
      where.AND.push({
        OR: [
          { businessName: { contains: term, mode: 'insensitive' } },
          { vatNumber: { contains: term, mode: 'insensitive' } },
          { cups: { contains: term, mode: 'insensitive' } }
        ]
      });
    });
  }

  if (filters.status && filters.status !== 'Todos') {
    where.AND.push({ status: filters.status });
  }
  if (filters.type && filters.type !== 'Todos') {
    where.AND.push({ type: filters.type });
  }

  const skip = (page - 1) * pageSize;

  const leadsDB = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: pageSize,
    include: {
      documents: true,
      user: true,
      contract: true
    }
  });

  const cupsList = leadsDB.map(l => l.cups).filter(Boolean) as string[];
  const supplyPoints = await prisma.supplyPoint.findMany({
    where: { cups: { in: cupsList } },
    select: { cups: true, address: true }
  });
  const spMap = new Map(supplyPoints.map(sp => [sp.cups, sp.address]));

  const mappedLeads = leadsDB.map(l => {
    let direccion = l.cups ? spMap.get(l.cups) || 'Pendiente' : 'Pendiente';
    let fechaRegistro = l.createdAt.toISOString();
    let comercialName = l.user?.name || 'Sistema';
    let canalName = l.source || 'Directo';
    let cupsDisplay = l.cups || '';

    if (l.contractData && typeof l.contractData === 'object') {
      const data = l.contractData as any;
      if ('DOMICILIO PS COMPLETO' in data) direccion = data['DOMICILIO PS COMPLETO'];
      else if ('DOMICILIO PS' in data) direccion = data['DOMICILIO PS'];
      else if ('DOMICILIO SOC' in data) direccion = data['DOMICILIO SOC'];
      else if ('direccion' in data) {
        if (typeof data.direccion === 'object' && data.direccion !== null) {
          const d = data.direccion;
          direccion = `${d.tipoVia || ''} ${d.nombreVia || ''} ${d.numero || ''}, ${d.cp || ''} ${d.poblacion || ''} ${d.provincia || ''}`.replace(/\s+/g, ' ').trim();
        } else {
          direccion = data.direccion;
        }
      }
    }

    const airtableData = l.airtableData as any || null;
    const isImported = !!airtableData;

    if (isImported) {
      if (airtableData['DOMICILIO PS COMPLETO']) direccion = airtableData['DOMICILIO PS COMPLETO'];
      else if (airtableData['DOMICILIO PS']) direccion = airtableData['DOMICILIO PS'];

      if (airtableData['Fecha Registro']) fechaRegistro = new Date(airtableData['Fecha Registro']).toISOString();

      if ((!cupsDisplay || cupsDisplay.startsWith('CUPS_MOCK')) && airtableData['CUPS2']) {
        cupsDisplay = airtableData['CUPS2'];
      }

      if (airtableData['CANAL'] && airtableData['CANAL'] !== '') {
        canalName = Array.isArray(airtableData['CANAL']) ? airtableData['CANAL'][0] : airtableData['CANAL'];
      }
      
      if (canalName !== 'Directo' && !airtableData['Comercial']) {
          comercialName = canalName;
      }
    }

    return {
      id: l.id,
      titular: l.businessName,
      empresa: l.businessName,
      nif: l.vatNumber || 'Pendiente',
      cups: cupsDisplay,
      tarifa: l.tariff || '2.0TD',
      status: l.status || 'NUEVO',
      canal: canalName,
      comercial: comercialName,
      fechaRegistro: fechaRegistro,
      comisionEst: l.estimatedMWh ? l.estimatedMWh * 15 : 0,
      sipsOk: l.cups || cupsDisplay ? true : false,
      potencia: 'Varios',
      documentsCount: l.documents.length,
      rawLead: l as any,
      type: l.type,
      address: direccion,
      contractId: l.contractId || undefined,
      contractCode: l.contract?.contractCode || (l.contractData as any)?.['CONTRATO'] || undefined
    };
  });

  return { leads: mappedLeads };
}
