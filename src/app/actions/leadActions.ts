'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { findOrUpdateSupplyPointByCups } from '@/lib/supplyPointHelper';
import { getSipsData } from '@/lib/sips';
import { normalizeSpanishPostalCode } from '@/lib/postalCode';
import { getActiveBrand, getLeadVisibilityFilter } from '@/lib/permissions';

function buildStructuredStreet(addrObj: any): string {
  if (!addrObj || typeof addrObj !== 'object') return '';
  const nombreVia = String(addrObj.nombreVia || addrObj.sNombreVia || '').trim();
  if (!nombreVia) return '';
  const tipoVia = String(addrObj.tipoVia || addrObj.sTipoVia || '').trim();
  const tipoNum = String(addrObj.tipoNumeracion || addrObj.sTipoNumeracion || '').trim();
  const num = String(addrObj.numKm ?? addrObj.numero ?? addrObj.sNumero ?? '').trim();
  const adicional = String(addrObj.adicional || addrObj.sAdicional || '').trim();
  const numPart = num ? (tipoNum && tipoNum !== 'S/N' ? `${tipoNum} ${num}` : num) : (tipoNum === 'S/N' ? 'S/N' : '');
  return [tipoVia, nombreVia, numPart, adicional].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

async function validateContractLeadRules(params: {
  isJuridica: boolean;
  contractData: any;
  technicalTariff: string;
  product: string | null;
  targetBrandId: string;
  parsedSipsData: any;
}): Promise<string | null> {
  const { isJuridica, contractData, technicalTariff, product, targetBrandId, parsedSipsData } = params;

  // Regla 75: Validación Representante Legal / Apoderado (B2B)
  if (isJuridica) {
    const repName = String(contractData?.contactoNombre || contractData?.representativeName || '').trim();
    const repLast = String(contractData?.contactoApellidos || contractData?.representativeLastName || '').trim();
    const repVat = String(contractData?.contactoNif || contractData?.representativeVat || '').trim();
    if (!repName || !repLast || !repVat) {
      return 'Para personas jurídicas (empresas o comunidades), es obligatorio rellenar Nombre, Apellidos y NIF del Apoderado (Regla 75).';
    }
  }

  // Regla 73: Congruencia Producto vs Tarifa (soporta IDs CUID c*, Airtable rec* o nombre)
  if (product && product.trim()) {
    const prodRef = product.trim();
    const dbProduct =
      (await prisma.product.findUnique({ where: { id: prodRef } })) ||
      (await prisma.product.findFirst({ where: { name: prodRef, brandId: targetBrandId } })) ||
      (await prisma.product.findFirst({ where: { name: prodRef } }));
    const productTariff: string | null = dbProduct?.tariff ?? null;

    if (productTariff && productTariff !== technicalTariff) {
      return `Incongruencia de producto/tarifa (Regla 73): El producto seleccionado exige tarifa ${productTariff}, pero el suministro tiene tarifa ${technicalTariff}.`;
    }
  }

  // Regla 74: Validación Cruzada SIPS
  if (parsedSipsData && parsedSipsData.result !== 'ERROR') {
    const sipsPs = parsedSipsData?.data?.ps?.[0] || {};
    const sipsTariff = String(parsedSipsData.tarifa || sipsPs.TarifaATR || '').trim();
    const tramType = String(contractData?.tipoTramitacion || contractData?.tramitationType || '').trim();

    if (
      tramType === 'Cambio comercializadora sin cambios' ||
      tramType === 'Modificación de datos administrativos' ||
      tramType === 'Cambio comercializadora con cambios administrativos'
    ) {
      if (sipsTariff && technicalTariff !== sipsTariff) {
        return `Para "${tramType}", la Tarifa de Acceso solicitada (${technicalTariff}) debe coincidir con la registrada en SIPS (${sipsTariff}) (Regla 74).`;
      }

      const periodsToCheck = technicalTariff === '2.0TD' ? [1, 2] : [1, 2, 3, 4, 5, 6];
      for (const i of periodsToCheck) {
        const sValRaw = parsedSipsData[`p${i}`] ?? sipsPs[`PotenciaContratadaP${i}kW`];
        const rValRaw = contractData?.potencias?.[`p${i}`] ?? contractData?.[`p${i}c`] ?? contractData?.[`p${i}`];
        if (sValRaw !== undefined && sValRaw !== null && rValRaw !== undefined && rValRaw !== '') {
          const sP = Number(String(sValRaw).replace(',', '.'));
          const rP = Number(String(rValRaw).replace(',', '.'));
          if (!Number.isNaN(sP) && !Number.isNaN(rP) && Math.abs(sP - rP) > 0.01) {
            return `La potencia P${i} solicitada (${rP} kW) no coincide con la registrada en SIPS (${sP} kW). Selecciona un trámite "con cambios técnicos" si deseas modificar potencias (Regla 74).`;
          }
        }
      }
    }
  }

  return null;
}

export async function createLeadAction(
  formData: FormData,
  apiContext?: { userId: string; brandId: string; allowedAutoTariffs: string[]; defaultSource: string }
): Promise<{
  success: boolean;
  leadId: string;
  contractId?: string;
  message?: string;
  error?: string;
  contractValidationErrors?: string[];
}> {
  try {
    let user: any;
    let targetBrandId: string;
    let userRole = 'CANAL';

    if (apiContext) {
      user = {
        id: apiContext.userId,
        brandId: apiContext.brandId,
        allowedAutoTariffs: apiContext.allowedAutoTariffs,
        defaultSource: apiContext.defaultSource,
      };
      targetBrandId = apiContext.brandId;
    } else {
      const session = await auth();
      if (!session?.user?.email) {
        return { success: false, leadId: '', message: 'No autorizado', error: 'No autorizado' };
      }

      const dbUser = await prisma.user.findFirst({
        where: { email: { equals: session.user.email.trim(), mode: 'insensitive' } },
        include: { brand: true, channel: true },
      });

      if (!dbUser || dbUser.isActive === false) {
        return { success: false, leadId: '', message: 'Usuario no autorizado', error: 'Usuario no autorizado' };
      }
      user = dbUser;
      userRole = dbUser.role;
      targetBrandId = ['CANAL', 'COMERCIAL'].includes(dbUser.role)
        ? dbUser.brandId
        : ((await getActiveBrand(dbUser)) || dbUser.brandId);
    }

    const rawVat = (formData.get('vatNumber') as string) || '';
    const vatNumber = rawVat.trim().toUpperCase();
    const businessName = ((formData.get('businessName') as string) || '').trim();
    const rawCups = (formData.get('cups') as string) || '';
    let cups = rawCups.trim().toUpperCase().replace(/\s+/g, '');
    const rawEstimatedMWh = parseFloat(((formData.get('estimatedMWh') as string) || '0').replace(',', '.'));
    const genContratoAuto = formData.get('genContratoAuto') === 'true';
    const autoGenerateContract = formData.get('autoGenerateContract') === 'true';
    const wantsComparison = formData.get('wantsComparison') === 'true';
    const email = ((formData.get('email') as string) || '').trim();
    const phone = ((formData.get('phone') as string) || '').trim();
    const productType = (formData.get('productType') as string) || '';
    const product = (formData.get('product') as string) || '';
    const additionalServices = (formData.get('additionalServices') as string) || '';
    const forceTariff = (formData.get('tariff') as string) || '';
    const type = ((formData.get('type') as string) || 'LUZ').trim();
    const userAddress = ((formData.get('direccion') as string) || '').trim();
    const solarDataStr = formData.get('solarData') as string;
    const solarData = solarDataStr ? JSON.parse(solarDataStr) : null;

    const contractDataStr = formData.get('contractData') as string;
    let contractData: any = {};
    if (contractDataStr) {
      try {
        contractData = JSON.parse(contractDataStr);
      } catch {}
    }

    const sipsDataStr = formData.get('sipsData') as string;
    let parsedSipsData: any = null;
    if (sipsDataStr) {
      try {
        parsedSipsData = JSON.parse(sipsDataStr);
      } catch {}
    }

    // Si es un Alta Luz directo y no se pulsó SIPS manualmente, consultamos nuestro SIPS corporativo de forma síncrona si hay CUPS válido
    const isOffer = contractData?.generateOffer === true || wantsComparison;
    if (!parsedSipsData && cups && cups.length >= 20 && type === 'LUZ' && (!isOffer || autoGenerateContract)) {
      try {
        const fetchedSips = await getSipsData(cups);
        if (fetchedSips && fetchedSips.result !== 'ERROR') {
          parsedSipsData = fetchedSips;
        }
      } catch (e) {
        console.warn('[SIPS] Fallo en pre-consulta síncrona SIPS al crear Lead:', e);
      }
    }

    const sipsPs = parsedSipsData?.data?.ps?.[0] || {};
    if (sipsPs.CUPS && String(sipsPs.CUPS).length >= 20) {
      cups = String(sipsPs.CUPS).trim().toUpperCase();
    }

    if (parsedSipsData && parsedSipsData.result !== 'ERROR') {
      const sCnae = parsedSipsData.cnae || sipsPs.CNAE || parsedSipsData.CNAE || parsedSipsData['CNAE SIPS'];
      if (sCnae && !contractData.cnae) contractData.cnae = String(sCnae);

      const sCp = normalizeSpanishPostalCode(
        parsedSipsData.cp || sipsPs.CódigoPostalPS || parsedSipsData.CP || parsedSipsData['CP SIPS']
      );
      if (sCp) {
        if (!contractData.direccionSuministro) contractData.direccionSuministro = {};
        if (!contractData.direccionSuministro.cp) contractData.direccionSuministro.cp = sCp;
        else contractData.direccionSuministro.cp = normalizeSpanishPostalCode(contractData.direccionSuministro.cp);
        contractData.direccionSuministro.postalCode = sCp;
        if (!contractData.sCp) contractData.sCp = sCp;
        else contractData.sCp = normalizeSpanishPostalCode(contractData.sCp);
      }
      const sMun = parsedSipsData.poblacion || sipsPs.MunicipioPS;
      if (sMun) {
        if (!contractData.direccionSuministro) contractData.direccionSuministro = {};
        if (!contractData.direccionSuministro.poblacion) contractData.direccionSuministro.poblacion = String(sMun);
        if (!contractData.sPoblacion) contractData.sPoblacion = String(sMun);
      }
      const sProv = parsedSipsData.provincia || sipsPs.ProvinciaPS;
      if (sProv) {
        if (!contractData.direccionSuministro) contractData.direccionSuministro = {};
        if (!contractData.direccionSuministro.provincia) contractData.direccionSuministro.provincia = String(sProv);
        if (!contractData.sProvincia) contractData.sProvincia = String(sProv);
      }
    }

    const sipsConsumoMWh =
      parsedSipsData && Number(parsedSipsData.consumo || sipsPs.ConsumoAnualkWh || 0) > 0
        ? Number(parsedSipsData.consumo || sipsPs.ConsumoAnualkWh) / 1000
        : 0;
    const effectiveEstimatedMWh = rawEstimatedMWh > 0 ? rawEstimatedMWh : sipsConsumoMWh;

    const documentsStr = formData.get('documents') as string;
    let documents: any[] = [];
    if (documentsStr) {
      try {
        documents = JSON.parse(documentsStr);
      } catch {}
    }

    const esJuridica = vatNumber ? !/^([0-9XYZ])/i.test(vatNumber) : contractData?.tipoPersona === 'JURIDICA';
    const clientType = esJuridica ? 'JURIDICA' : 'FISICA';
    const technicalTariff = forceTariff || parsedSipsData?.tarifa || sipsPs.TarifaATR || '2.0TD';

    if (!isOffer && type === 'LUZ') {
      const validationMsg = await validateContractLeadRules({
        isJuridica: esJuridica,
        contractData,
        technicalTariff,
        product: product || null,
        targetBrandId,
        parsedSipsData,
      });
      if (validationMsg) {
        return { success: false, leadId: '', message: validationMsg, error: validationMsg };
      }
    }

    const leadSource = user?.channel?.name || user?.defaultSource || 'Directo';
    const supplyStreet = buildStructuredStreet(contractData?.direccionSuministro) || userAddress;

    const lead = await prisma.$transaction(async (tx) => {
      const effectiveVat = vatNumber || `TEMP-${Date.now()}`;
      const client = await tx.client.upsert({
        where: { vatNumber_brandId: { vatNumber: effectiveVat, brandId: targetBrandId } },
        update: {},
        create: {
          vatNumber: effectiveVat,
          businessName: businessName || 'Sin Nombre',
          clientType,
          contactEmail: email || null,
          contactPhone: phone || null,
          brandId: targetBrandId,
        },
      });

      // Regla 72: NUNCA sobrescribir un SupplyPoint existente al dar de alta un Lead; solo crear si no existe ninguno para ese CUPS en la marca
      if (cups && cups.length >= 20 && type === 'LUZ') {
        const cups20 = cups.substring(0, 20);
        const existingSp = await tx.supplyPoint.findFirst({
          where: { cups: { startsWith: cups20 }, client: { brandId: targetBrandId } },
        });
        if (!existingSp) {
          const { calculateSegment } = await import('@/lib/services/SegmentService');
          const newSegment = calculateSegment(
            technicalTariff,
            effectiveEstimatedMWh || null,
            Number(contractData?.potencias?.p1 || contractData?.p1c || parsedSipsData?.p1 || 0) || null,
            contractData?.cnae || null
          );

          await tx.supplyPoint.create({
            data: {
              cups,
              segment: newSegment,
              address: supplyStreet || parsedSipsData?.direccion || 'Pendiente',
              city: contractData?.direccionSuministro?.poblacion || parsedSipsData?.poblacion || sipsPs.MunicipioPS || 'Pendiente',
              postalCode: contractData?.direccionSuministro?.cp || parsedSipsData?.cp || sipsPs.CódigoPostalPS || '00000',
              province: contractData?.direccionSuministro?.provincia || parsedSipsData?.provincia || sipsPs.ProvinciaPS || 'Pendiente',
              tariff: technicalTariff,
              cnae: contractData?.cnae || parsedSipsData?.cnae || sipsPs.CNAE || null,
              annualConsumption: effectiveEstimatedMWh > 0 ? effectiveEstimatedMWh : null,
              distributorReeCode: parsedSipsData?.codigoDistribuidora || (cups.startsWith('ES') ? cups.substring(2, 6) : null),
              distributorName: parsedSipsData?.distribuidora || sipsPs.NombreDistribuidora || null,
              sipsRawData: parsedSipsData && parsedSipsData.result !== 'ERROR' ? parsedSipsData : undefined,
              sipsTariff: parsedSipsData?.tarifa || sipsPs.TarifaATR || null,
              sipsPostalCode: parsedSipsData?.cp || sipsPs.CódigoPostalPS || null,
              sipsCnae: parsedSipsData?.cnae || sipsPs.CNAE || null,
              sipsP1c: parsedSipsData?.p1 !== undefined ? Number(parsedSipsData.p1) : null,
              sipsP2c: parsedSipsData?.p2 !== undefined ? Number(parsedSipsData.p2) : null,
              sipsP3c: parsedSipsData?.p3 !== undefined ? Number(parsedSipsData.p3) : null,
              sipsP4c: parsedSipsData?.p4 !== undefined ? Number(parsedSipsData.p4) : null,
              sipsP5c: parsedSipsData?.p5 !== undefined ? Number(parsedSipsData.p5) : null,
              sipsP6c: parsedSipsData?.p6 !== undefined ? Number(parsedSipsData.p6) : null,
              clientId: client.id,
            },
          });
        }
      }

      const hasValidSips = Boolean(parsedSipsData && parsedSipsData.result !== 'ERROR');

      const createdLead = await tx.lead.create({
        data: {
          businessName: businessName || 'Sin Nombre',
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
          ...(hasValidSips ? { sipsRawData: parsedSipsData } : {}),
          wantsComparison,
          productType: productType || null,
          product: product || null,
          additionalServices: additionalServices || null,
          tariff: technicalTariff,
          estimatedMWh: effectiveEstimatedMWh > 0 ? effectiveEstimatedMWh : null,
          generateOffer: isOffer,
          monthlyExpense: contractData?.monthlyExpense ? String(contractData.monthlyExpense) : null,
          savings: contractData?.savings ? Number(contractData.savings) : null,
          comparative: contractData?.comparative || null,
          sipsOk: type === 'FV' ? true : hasValidSips,
          sipsMessages:
            type === 'FV'
              ? 'Estudio Fotovoltaico'
              : hasValidSips
                ? 'Validado correctamente contra SIPS'
                : null,
        },
      });

      if (documents && documents.length > 0) {
        for (const doc of documents) {
          if (doc.url) {
            const isIdentityDoc = ['DNI', 'ESCRITURAS', 'DNI_APODERADO'].includes(doc.type);
            let linkClientId: string | undefined = undefined;
            if (isIdentityDoc && client?.id) {
              const alreadyOnClient = await tx.document.findFirst({
                where: { clientId: client.id, type: doc.type, url: doc.url },
                select: { id: true },
              });
              if (!alreadyOnClient) {
                linkClientId = client.id;
              }
            }

            await tx.document.create({
              data: {
                type: doc.type,
                url: doc.url,
                name: doc.name || doc.type,
                leadId: createdLead.id,
                ...(linkClientId ? { clientId: linkClientId } : {}),
              },
            });
          }
        }
      }

      return createdLead;
    });

    // Si es una Oferta rápida y no traía SIPS precargado, enriquecemos SIPS en background sin bloquear la respuesta
    if (lead.id && cups && cups.length >= 20 && type === 'LUZ' && (!parsedSipsData || parsedSipsData.result === 'ERROR')) {
      getSipsData(cups)
        .then(async (sipsData) => {
          if (sipsData && sipsData.result !== 'ERROR') {
            const t = forceTariff || sipsData.tarifa || '2.0TD';
            const allowedTariffs: string[] = Array.isArray(user.allowedAutoTariffs) ? user.allowedAutoTariffs : [];
            const tarifaEsValida = allowedTariffs.includes(String(t));
            const sipsMWh = Number(sipsData.consumo || 0) > 0 ? Number(sipsData.consumo) / 1000 : 0;
            const consumoOk = effectiveEstimatedMWh > 0 || sipsMWh > 0;

            let newStatus = 'NUEVO';
            if (tarifaEsValida && consumoOk && genContratoAuto && !isOffer) {
              newStatus = 'BORRADOR GENERADO';
            }

            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                sipsOk: true,
                sipsRawData: sipsData as any,
                sipsMessages: 'Validado correctamente contra SIPS',
                status: newStatus,
                ...(effectiveEstimatedMWh <= 0 && sipsMWh > 0 ? { estimatedMWh: sipsMWh } : {}),
              },
            });
          } else {
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                sipsOk: false,
                sipsMessages: sipsData?.messages || 'No se pudo validar el CUPS en SIPS',
              },
            });
          }
        })
        .catch(console.error);
    }

    // Generación directa del Borrador de Contrato si se solicitó desde Alta Luz por un usuario autorizado
    if (
      autoGenerateContract &&
      !isOffer &&
      ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole)
    ) {
      const { convertLeadToContractAction } = await import('@/app/actions/contractActions');
      const convRes = await convertLeadToContractAction(lead.id);
      if (convRes.success && convRes.contractId) {
        revalidatePath('/leads');
        revalidatePath('/contratos');
        return { success: true, leadId: lead.id, contractId: convRes.contractId };
      }
      const errs =
        convRes.validationErrors && convRes.validationErrors.length > 0
          ? convRes.validationErrors
          : [convRes.error || 'No se pudo generar el borrador automáticamente'];
      revalidatePath('/leads');
      return {
        success: true,
        leadId: lead.id,
        contractValidationErrors: errs,
      };
    }

    revalidatePath('/leads');
    return { success: true, leadId: lead.id };
  } catch (error: any) {
    console.error('Error en createLeadAction:', error);
    const msg = error?.message || 'Error inesperado al crear el Lead';
    return { success: false, leadId: '', message: msg, error: msg };
  }
}

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
  const raw = String(val || '').trim();
  return raw || 'Precio fijo único';
};

function translateAirtableToNativeCRM(oldLead: any) {
  const cd = oldLead.contractData || {};
  const ad = oldLead.airtableData || {};

  const vat = (
    oldLead.vatNumber ||
    cd.vatNumber ||
    getScalar(ad['NIF / CIF Titular']) ||
    getScalar(ad['DNI / CIF Titular']) ||
    getScalar(ad['DNI/CIF Titular']) ||
    ''
  )
    .trim()
    .toUpperCase();
  let rawBusinessName =
    oldLead.businessName ||
    cd.businessName ||
    getScalar(ad['Razón social / Nombre']) ||
    getScalar(ad['Nombre Titular']) ||
    getScalar(ad['NOMBRE Y APELLIDOS']) ||
    getScalar(ad['Nombre completo Titular']) ||
    '';

  const esJuridica = vat ? !/^([0-9XYZ])/i.test(vat) : false;
  let pAp = cd.primerApellido || getScalar(ad['Primer Apellido']) || getScalar(ad['Primer apellido Titular']) || '';
  let sAp = cd.segundoApellido || getScalar(ad['Segundo Apellido']) || getScalar(ad['Segundo apellido Titular']) || '';

  if (rawBusinessName) rawBusinessName = rawBusinessName.replace(/\(Copia\)/gi, '').trim();
  if (pAp) pAp = pAp.replace(/\(Copia\)/gi, '').trim();
  if (sAp) sAp = sAp.replace(/\(Copia\)/gi, '').trim();

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

  const contractData = {
    tipoPersona,
    primerApellido: pAp,
    segundoApellido: sAp,
    cnae: oldLead.sipsCnae || cd.cnae || getScalar(ad['CNAE']) || getScalar(ad['SIPS Cnae']) || '',
    direccion: {
      tipoVia: cd.direccion?.tipoVia || cd.tipoVia || getScalar(ad['Tipo de vía Titular']) || 'Calle',
      nombreVia: cd.direccion?.nombreVia || cd.nombreVia || getScalar(ad['Calle Titular']) || getScalar(ad['DOMICILIO SOC']) || '',
      tipoNumeracion: cd.direccion?.tipoNumeracion || cd.tipoNumeracion || normNum(getScalar(ad['Tipo de numeración Titular'])),
      numKm: cd.direccion?.numKm || cd.numKm || getScalar(ad['Número Titular']) || '',
      adicional: cd.direccion?.adicional || cd.adicional || getScalar(ad['Adicional Titular']) || '',
      cp: normalizeSpanishPostalCode(cd.direccion?.cp || cd.cp || getScalar(ad['CP SOC']) || ''),
      poblacion: cd.direccion?.poblacion || cd.poblacion || getScalar(ad['Población Titular']) || getScalar(ad['POBLACION SOC']) || '',
      provincia: cd.direccion?.provincia || cd.provincia || getScalar(ad['Provincia Titular']) || getScalar(ad['PROVINCIA SOC']) || '',
      pais: cd.direccion?.pais || cd.pais || getScalar(ad['País Titular']) || 'España',
    },
    direccionSuministro: {
      tipoVia: cd.direccionSuministro?.tipoVia || cd.sTipoVia || getScalar(ad['Tipo de vía Instalación']) || 'Calle',
      nombreVia:
        cd.direccionSuministro?.nombreVia ||
        cd.sNombreVia ||
        getScalar(ad['Calle Instalación']) ||
        getScalar(ad['DOMICILIO PS']) ||
        getScalar(ad['DOMICILIO PS COMPLETO']) ||
        '',
      tipoNumeracion: cd.direccionSuministro?.tipoNumeracion || cd.sTipoNumeracion || normNum(getScalar(ad['Tipo de numeración Instalación'])),
      numKm: cd.direccionSuministro?.numKm || cd.sNumero || cd.sNumKm || getScalar(ad['Número Instalación']) || '',
      adicional: cd.direccionSuministro?.adicional || cd.sAdicional || getScalar(ad['Adicional Instalación']) || '',
      cp: normalizeSpanishPostalCode(cd.direccionSuministro?.cp || cd.sCp || getScalar(ad['Código Postal Instalación']) || getScalar(ad['CP_CONT']) || ''),
      poblacion: cd.direccionSuministro?.poblacion || cd.sPoblacion || getScalar(ad['Población Instalación']) || getScalar(ad['POBLACION_CONT']) || '',
      provincia: cd.direccionSuministro?.provincia || cd.sProvincia || getScalar(ad['Provincia Instalación']) || getScalar(ad['PROVINCIA_CONT']) || '',
      pais: cd.direccionSuministro?.pais || cd.sPais || 'España',
    },
    contactoNombre: oldLead.contactName || cd.contactoNombre || getScalar(ad['Nombre Contacto']) || '',
    contactoApellidos: oldLead.contactLastName || cd.contactoApellidos || getScalar(ad['Apellidos Contacto']) || '',
    contactoNif: oldLead.contactVat || cd.contactoNif || getScalar(ad['NIF Contacto']) || '',
    nombreInstalacion: cd.nombreInstalacion || '',
    tipoTramitacion: oldLead.tramitationType || cd.tipoTramitacion || getScalar(ad['Tramitación a realizar']) || getScalar(ad['Tipo']) || 'Cambio comercializadora sin cambios',
    autoconsumo: cd.autoconsumo || 'NO',
    firmaManuscrita: cd.firmaManuscrita || false,
    bolsilloSolar:
      cd.bolsilloSolar ||
      (getScalar(ad['¿Asociar a Bolsillo Solar?']) === 'SI' || getScalar(ad['CG Bolsillo Solar']) ? 'SI' : 'NO'),
    iban: oldLead.iban || cd.iban || getScalar(ad['IBAN']) || getScalar(ad['Certificado IBAN']) || '',
    formaPago: oldLead.paymentMethod || cd.formaPago || 'Domiciliación',
    envioFactura:
      oldLead.invoiceDelivery ||
      cd.envioFactura ||
      (getScalar(ad['¿Facturas papel?']) === 'true' ||
      getScalar(ad['¿Facturas papel?']) === 'SI' ||
      getScalar(ad['¿Facturas papel?']) === 'Sí'
        ? 'Postal'
        : 'Email'),
    potencias: {
      p1: cd.potencias?.p1 || cd.p1c || String(oldLead.p1c || getScalar(ad['P1C']) || ''),
      p2: cd.potencias?.p2 || cd.p2c || String(oldLead.p2c || getScalar(ad['P2C']) || ''),
      p3: cd.potencias?.p3 || cd.p3c || String(oldLead.p3c || getScalar(ad['P3C']) || ''),
      p4: cd.potencias?.p4 || cd.p4c || String(oldLead.p4c || getScalar(ad['P4C']) || ''),
      p5: cd.potencias?.p5 || cd.p5c || String(oldLead.p5c || getScalar(ad['P5C']) || ''),
      p6: cd.potencias?.p6 || cd.p6c || String(oldLead.p6c || getScalar(ad['P6C']) || ''),
    },
    indexado: {
      ip1: cd.indexado?.ip1 || cd.ip1 || String(getScalar(ad['IP1']) || ''),
      ip2: cd.indexado?.ip2 || cd.ip2 || String(getScalar(ad['IP2']) || ''),
      ip3: cd.indexado?.ip3 || cd.ip3 || String(getScalar(ad['IP3']) || ''),
      ip4: cd.indexado?.ip4 || cd.ip4 || String(getScalar(ad['IP4']) || ''),
      ip5: cd.indexado?.ip5 || cd.ip5 || String(getScalar(ad['IP5']) || ''),
      ip6: cd.indexado?.ip6 || cd.ip6 || String(getScalar(ad['IP6']) || ''),
      fee: cd.indexado?.fee || cd.feeIndex || String(getScalar(ad['FEE']) || ''),
    },
    pexc: cd.pexc || String(getScalar(ad['PExc']) || getScalar(ad['PExc Personalizado']) || ''),
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
      additionalServices: oldLead.additionalServices || cd.serviciosAdicionales || '',
    },
  };
}

export async function duplicateLeadAction(leadId: string) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new Error('No autorizado');

    const visibilityFilter = await getLeadVisibilityFilter();
    const oldLead = await prisma.lead.findFirst({ where: { AND: [{ id: leadId }, visibilityFilter] } });
    if (!oldLead) throw new Error('Lead no encontrado');

    const {
      id,
      createdAt,
      updatedAt,
      contractId,
      docusignEnvelopeId,
      triggerDuplicate,
      status,
      airtableId,
      airtableData,
      contractData: oldCd,
      ...rest
    } = oldLead as any;

    const { contractData, nativeFields } = translateAirtableToNativeCRM(oldLead);

    const newLead = await prisma.lead.create({
      data: {
        ...rest,
        ...nativeFields,
        contractData,
        airtableData: null,
        status: 'NUEVO',
      },
    });

    revalidatePath('/leads');
    return { success: true, leadId: newLead.id };
  } catch (error: any) {
    console.error('Error in duplicateLeadAction:', error);
    return { success: false, error: error.message };
  }
}

export async function updateLeadCupsAction(leadId: string, newCups: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  const visibilityFilter = await getLeadVisibilityFilter();
  const lead = await prisma.lead.findFirst({
    where: { AND: [{ id: leadId }, visibilityFilter] },
    include: { user: true },
  });
  if (!lead) throw new Error('Lead no encontrado');

  const cleanCups = newCups.trim().toUpperCase().replace(/\s+/g, '');

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      cups: cleanCups,
      sipsOk: false,
      sipsMessages: 'Actualizando CUPS...',
    },
  });

  getSipsData(cleanCups)
    .then(async (data) => {
      if (data && data.result !== 'ERROR') {
        const t = data.tarifa || data.Tarifa || '2.0TD';
        const allowedTariffs: string[] = Array.isArray(lead.user.allowedAutoTariffs) ? lead.user.allowedAutoTariffs : [];
        const tarifaEsValida = allowedTariffs.includes(String(t));
        const sipsMWh = Number(data.consumo || 0) > 0 ? Number(data.consumo) / 1000 : 0;
        const consumoOk = sipsMWh > 0 || (lead.estimatedMWh ?? 0) > 0;

        let newStatus = lead.status;
        if (tarifaEsValida && consumoOk && lead.status === 'NUEVO' && !lead.generateOffer) {
          newStatus = 'BORRADOR GENERADO';
        }

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            sipsOk: true,
            sipsRawData: data as any,
            sipsMessages: 'SIPS validado tras cambio de CUPS',
            status: newStatus,
            ...(sipsMWh > 0 && !(lead.estimatedMWh && lead.estimatedMWh > 0) ? { estimatedMWh: sipsMWh } : {}),
          },
        });
      } else {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { sipsOk: false, sipsMessages: data?.messages || 'Error de SIPS al cambiar CUPS' },
        });
      }
    })
    .catch(console.error);

  return { success: true };
}

export async function forceRefreshSipsAction(leadId: string) {
  const session = await auth();
  if (!session?.user?.email) return { success: false, message: 'No autorizado' };

  const visibilityFilter = await getLeadVisibilityFilter();
  const lead = await prisma.lead.findFirst({
    where: { AND: [{ id: leadId }, visibilityFilter] },
    include: { user: true },
  });
  if (!lead) return { success: false, message: 'Lead no encontrado' };

  const airtableData = (lead.airtableData as any) || {};
  let effectiveCups = lead.cups;
  if ((!effectiveCups || effectiveCups.startsWith('CUPS_MOCK')) && airtableData['CUPS2']) {
    effectiveCups = airtableData['CUPS2'];
  }

  if (!effectiveCups || effectiveCups.startsWith('CUPS_MOCK')) {
    return { success: false, message: 'El Lead no tiene un CUPS válido configurado' };
  }

  const data = await getSipsData(effectiveCups, { skipCache: true });

  if (data && data.result !== 'ERROR') {
    const sipsPs = data.data?.ps?.[0] || {};
    const t = data.tarifa || sipsPs.TarifaATR || '2.0TD';
    const sipsMWh = Number(data.consumo || sipsPs.ConsumoAnualkWh || 0) > 0
      ? Number(data.consumo || sipsPs.ConsumoAnualkWh) / 1000
      : 0;

    const cData = typeof lead.contractData === 'object' && lead.contractData ? { ...(lead.contractData as any) } : {};

    const sCnae = data.cnae || sipsPs.CNAE || data.CNAE || data['CNAE SIPS'];
    if (sCnae) cData.cnae = String(sCnae);

    const sCp = data.cp || sipsPs.CódigoPostalPS || data.CP || data['CP SIPS'];
    if (sCp) {
      if (!cData.direccionSuministro) cData.direccionSuministro = {};
      cData.direccionSuministro.postalCode = String(sCp);
      if (!cData.direccionSuministro.cp) cData.direccionSuministro.cp = String(sCp);
      if (!cData.sCp) cData.sCp = String(sCp);
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        cups: sipsPs.CUPS || effectiveCups,
        sipsOk: true,
        sipsRawData: data as any,
        sipsMessages: 'SIPS refrescado correctamente',
        contractData: cData,
        ...(sipsMWh > 0 && !(lead.estimatedMWh && lead.estimatedMWh > 0) ? { estimatedMWh: sipsMWh } : {}),
      },
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${lead.id}`);
    return { success: true, message: 'Datos SIPS actualizados correctamente' };
  } else {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { sipsOk: false, sipsMessages: data?.messages || 'Error al refrescar SIPS' },
    });
    return { success: false, message: data?.messages || 'Error al consultar SIPS' };
  }
}

export async function updateSolarDataAction(leadId: string, solarData: any) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  await prisma.lead.update({
    where: { id: leadId },
    data: { solarData },
  });

  return { success: true };
}

export async function updateLeadAction(
  leadId: string,
  formData: FormData
): Promise<{
  success: boolean;
  leadId?: string;
  contractId?: string;
  message?: string;
  error?: string;
  contractValidationErrors?: string[];
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, message: 'No autorizado', error: 'No autorizado' };
    }

    const dbUser = await prisma.user.findFirst({
      where: { email: { equals: session.user.email.trim(), mode: 'insensitive' } },
    });
    if (!dbUser || dbUser.isActive === false) {
      return { success: false, message: 'Usuario no autorizado', error: 'Usuario no autorizado' };
    }

    const visibilityFilter = await getLeadVisibilityFilter();
    const existingLead = await prisma.lead.findFirst({
      where: { AND: [{ id: leadId }, visibilityFilter] },
      include: { user: true },
    });
    if (!existingLead) {
      return { success: false, message: 'Lead no encontrado o sin permisos', error: 'Lead no encontrado' };
    }

    const isAdminOrBackoffice = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(dbUser.role);
    // Los comerciales/canales solo pueden completar una Oferta propia que aún NO se haya convertido en Contrato
    if (!isAdminOrBackoffice && (existingLead.contractId || existingLead.status === 'CONTRATADO')) {
      return {
        success: false,
        message: 'No tienes permisos para modificar un Lead ya contratado.',
        error: 'Permiso denegado',
      };
    }

    const targetBrandId = ['CANAL', 'COMERCIAL'].includes(dbUser.role)
      ? dbUser.brandId
      : (existingLead.user?.brandId || (await getActiveBrand(dbUser)) || dbUser.brandId);

    const businessName = ((formData.get('businessName') as string) || '').trim();
    const vatNumber = ((formData.get('vatNumber') as string) || '').trim().toUpperCase();
    const email = ((formData.get('email') as string) || '').trim();
    const phone = ((formData.get('phone') as string) || '').trim();
    let cups = ((formData.get('cups') as string) || '').trim().toUpperCase().replace(/\s+/g, '');
    const forceTariff = ((formData.get('tariff') as string) || '').trim();
    const productType = ((formData.get('productType') as string) || '').trim();
    const product = ((formData.get('product') as string) || '').trim();
    const additionalServices = ((formData.get('additionalServices') as string) || '').trim();
    const userAddress = ((formData.get('direccion') as string) || '').trim();
    const rawEstimatedMWh = parseFloat(((formData.get('estimatedMWh') as string) || '0').replace(',', '.'));
    const autoGenerateContract = formData.get('autoGenerateContract') === 'true';

    const sipsDataStr = formData.get('sipsData') as string;
    let parsedSipsData: any = null;
    if (sipsDataStr) {
      try {
        parsedSipsData = JSON.parse(sipsDataStr);
      } catch {}
    }
    if (!parsedSipsData && existingLead.sipsRawData && (!cups || cups.substring(0, 20) === (existingLead.cups || '').substring(0, 20))) {
      parsedSipsData = existingLead.sipsRawData;
    }

    const contractDataStr = formData.get('contractData') as string;
    let contractData: any = {};
    if (contractDataStr) {
      try {
        contractData = JSON.parse(contractDataStr);
      } catch {}
    }

    const isOffer = contractData?.generateOffer === true;
    if (!parsedSipsData && cups && cups.length >= 20 && (!isOffer || autoGenerateContract)) {
      try {
        const fetchedSips = await getSipsData(cups);
        if (fetchedSips && fetchedSips.result !== 'ERROR') {
          parsedSipsData = fetchedSips;
        }
      } catch {}
    }

    const sipsPs = parsedSipsData?.data?.ps?.[0] || {};
    if (sipsPs.CUPS && String(sipsPs.CUPS).length >= 20) {
      cups = String(sipsPs.CUPS).trim().toUpperCase();
    }

    if (parsedSipsData && parsedSipsData.result !== 'ERROR') {
      const sCnae = parsedSipsData.cnae || sipsPs.CNAE || parsedSipsData.CNAE || parsedSipsData['CNAE SIPS'];
      if (sCnae && !contractData.cnae) contractData.cnae = String(sCnae);

      const sCp = normalizeSpanishPostalCode(
        parsedSipsData.cp || sipsPs.CódigoPostalPS || parsedSipsData.CP || parsedSipsData['CP SIPS']
      );
      if (sCp) {
        if (!contractData.direccionSuministro) contractData.direccionSuministro = {};
        if (!contractData.direccionSuministro.cp) contractData.direccionSuministro.cp = sCp;
        else contractData.direccionSuministro.cp = normalizeSpanishPostalCode(contractData.direccionSuministro.cp);
        contractData.direccionSuministro.postalCode = sCp;
        if (!contractData.sCp) contractData.sCp = sCp;
        else contractData.sCp = normalizeSpanishPostalCode(contractData.sCp);
      }
    }

    const sipsConsumoMWh =
      parsedSipsData && Number(parsedSipsData.consumo || sipsPs.ConsumoAnualkWh || 0) > 0
        ? Number(parsedSipsData.consumo || sipsPs.ConsumoAnualkWh) / 1000
        : 0;
    const effectiveEstimatedMWh =
      rawEstimatedMWh > 0 ? rawEstimatedMWh : (existingLead.estimatedMWh && existingLead.estimatedMWh > 0 ? existingLead.estimatedMWh : sipsConsumoMWh);

    const documentsStr = formData.get('documents') as string;
    let documents: any[] = [];
    if (documentsStr) {
      try {
        documents = JSON.parse(documentsStr);
      } catch {}
    }

    const esJuridica = vatNumber ? !/^([0-9XYZ])/i.test(vatNumber) : contractData?.tipoPersona === 'JURIDICA';
    const technicalTariff = forceTariff || parsedSipsData?.tarifa || sipsPs.TarifaATR || existingLead.tariff || '2.0TD';

    if (!isOffer) {
      const validationMsg = await validateContractLeadRules({
        isJuridica: esJuridica,
        contractData,
        technicalTariff,
        product: product || existingLead.product || null,
        targetBrandId,
        parsedSipsData,
      });
      if (validationMsg) {
        return { success: false, message: validationMsg, error: validationMsg };
      }
    }

    const supplyStreet = buildStructuredStreet(contractData?.direccionSuministro) || userAddress;
    const hasValidSips = Boolean(parsedSipsData && parsedSipsData.result !== 'ERROR');

    await prisma.$transaction(async (tx) => {
      let clientId: string | null = null;
      if (vatNumber) {
        const client = await tx.client.upsert({
          where: { vatNumber_brandId: { vatNumber, brandId: targetBrandId } },
          update: {},
          create: {
            vatNumber,
            businessName: businessName || 'Sin Nombre',
            contactEmail: email || null,
            contactPhone: phone || null,
            clientType: esJuridica ? 'JURIDICA' : 'FISICA',
            brandId: targetBrandId,
          },
        });
        clientId = client.id;
      }

      // Regla 72: Solo crear SupplyPoint si no existe; jamás pisar un SupplyPoint existente desde un Lead
      if (cups && cups.length >= 20 && clientId) {
        const cups20 = cups.substring(0, 20);
        const existingSp = await tx.supplyPoint.findFirst({
          where: { cups: { startsWith: cups20 }, client: { brandId: targetBrandId } },
        });
        if (!existingSp) {
          const { calculateSegment } = await import('@/lib/services/SegmentService');
          const newSegment = calculateSegment(
            technicalTariff,
            effectiveEstimatedMWh || null,
            Number(contractData?.potencias?.p1 || contractData?.p1c || parsedSipsData?.p1 || 0) || null,
            contractData?.cnae || null
          );

          await tx.supplyPoint.create({
            data: {
              segment: newSegment,
              cups,
              address: supplyStreet || parsedSipsData?.direccion || 'Pendiente',
              city: contractData?.direccionSuministro?.poblacion || parsedSipsData?.poblacion || sipsPs.MunicipioPS || 'Pendiente',
              postalCode: contractData?.direccionSuministro?.cp || parsedSipsData?.cp || sipsPs.CódigoPostalPS || '00000',
              province: contractData?.direccionSuministro?.provincia || parsedSipsData?.provincia || sipsPs.ProvinciaPS || 'Pendiente',
              tariff: technicalTariff,
              cnae: contractData?.cnae || parsedSipsData?.cnae || sipsPs.CNAE || null,
              annualConsumption: effectiveEstimatedMWh > 0 ? effectiveEstimatedMWh : null,
              clientId,
            },
          });
        }
      }

      await tx.lead.update({
        where: { id: leadId },
        data: {
          businessName: businessName || existingLead.businessName,
          vatNumber: vatNumber || null,
          email: email || null,
          phone: phone || null,
          cups: cups || null,
          contractData,
          tariff: technicalTariff,
          productType: productType || existingLead.productType || null,
          product: product || existingLead.product || null,
          additionalServices: additionalServices || existingLead.additionalServices || null,
          estimatedMWh: effectiveEstimatedMWh > 0 ? effectiveEstimatedMWh : existingLead.estimatedMWh,
          ...(hasValidSips
            ? {
                sipsOk: true,
                sipsRawData: parsedSipsData,
                sipsMessages: existingLead.sipsMessages || 'Validado correctamente contra SIPS',
              }
            : {}),
          generateOffer: isOffer,
          monthlyExpense: contractData?.monthlyExpense ? String(contractData.monthlyExpense) : null,
          savings: contractData?.savings ? Number(contractData.savings) : null,
          comparative: contractData?.comparative || null,
        },
      });

      if (documents && documents.length > 0) {
        const existingDocs = await tx.document.findMany({ where: { leadId } });
        for (const doc of documents) {
          if (!doc.url) continue;
          const match = existingDocs.find(
            (ed) => ed.type === doc.type && (ed.name === doc.name || !doc.name)
          );
          if (match) {
            if (match.url !== doc.url) {
              await tx.document.update({
                where: { id: match.id },
                data: { url: doc.url, name: doc.name || match.name },
              });
            }
          } else {
            await tx.document.create({
              data: {
                type: doc.type,
                url: doc.url,
                name: doc.name || doc.type,
                leadId,
              },
            });
          }
        }
      }
    });

    if (autoGenerateContract && !isOffer && isAdminOrBackoffice && !existingLead.contractId) {
      const { convertLeadToContractAction } = await import('@/app/actions/contractActions');
      const convRes = await convertLeadToContractAction(leadId);
      if (convRes.success && convRes.contractId) {
        revalidatePath('/leads');
        revalidatePath(`/leads/${leadId}`);
        revalidatePath('/contratos');
        return { success: true, leadId, contractId: convRes.contractId };
      }
      const errs =
        convRes.validationErrors && convRes.validationErrors.length > 0
          ? convRes.validationErrors
          : [convRes.error || 'No se pudo generar el borrador automáticamente'];
      revalidatePath('/leads');
      revalidatePath(`/leads/${leadId}`);
      return { success: true, leadId, contractValidationErrors: errs };
    }

    revalidatePath('/leads');
    revalidatePath(`/leads/${leadId}`);
    return { success: true, leadId };
  } catch (error: any) {
    console.error('Error en updateLeadAction:', error);
    const msg = error?.message || 'Error inesperado al actualizar el Lead';
    return { success: false, message: msg, error: msg };
  }
}

function buildLeadFiltersWhere(visibilityFilter: any, filters: any) {
  const where: any = { AND: [visibilityFilter] };

  if (filters?.search) {
    const terms = filters.search.split(/\s+/).filter(Boolean);
    terms.forEach((term: string) => {
      where.AND.push({
        OR: [
          { businessName: { contains: term, mode: 'insensitive' } },
          { vatNumber: { contains: term, mode: 'insensitive' } },
          { cups: { contains: term, mode: 'insensitive' } },
          { contract: { contractCode: { contains: term, mode: 'insensitive' } } },
        ],
      });
    });
  }

  if (filters?.status && filters.status !== 'Todos') {
    if (filters.status === 'FIRMADO') {
      where.AND.push({
        OR: [{ status: 'FIRMADO' }, { contract: { signatureDate: { not: null } } }],
      });
    } else if (filters.status === 'ENVIADO A FIRMA') {
      where.AND.push({
        status: filters.status,
        OR: [{ contractId: null }, { contract: { signatureDate: null } }],
      });
    } else {
      where.AND.push({ status: filters.status });
    }
  }

  if (filters?.canal && filters.canal !== 'Todos') {
    where.AND.push({
      OR: [
        { source: { equals: filters.canal, mode: 'insensitive' } },
        { user: { channel: { name: { equals: filters.canal, mode: 'insensitive' } } } },
      ],
    });
  }

  if (filters?.type && filters.type !== 'Todos') {
    where.AND.push({ type: filters.type });
  }

  return where;
}

export async function getLeadStatsAction(filters: any) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  const visibilityFilter = await getLeadVisibilityFilter();
  const where = buildLeadFiltersWhere(visibilityFilter, filters);

  const allForStats = await prisma.lead.findMany({
    where,
    select: { status: true, contract: { select: { signatureDate: true } }, estimatedMWh: true },
  });

  const statusCounts: Record<string, number> = {};
  let totalMWh = 0;

  allForStats.forEach((l) => {
    let s = l.status;
    if (l.contract?.signatureDate) s = 'FIRMADO';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    totalMWh += l.estimatedMWh || 0;
  });

  const totalLeads = allForStats.length;

  return { totalLeads, statusCounts, totalMWh };
}

export async function getPaginatedLeadsAction(filters: any, page: number = 1, pageSize: number = 100) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autorizado');

  const visibilityFilter = await getLeadVisibilityFilter();
  const where = buildLeadFiltersWhere(visibilityFilter, filters);

  const skip = (page - 1) * pageSize;

  const leadsDB = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: pageSize,
    include: {
      documents: true,
      user: { include: { channel: true } },
      contract: true,
    },
  });

  const cups20List = Array.from(
    new Set(
      leadsDB
        .map((l) => (l.cups && !l.cups.startsWith('CUPS_MOCK') ? l.cups.substring(0, 20) : null))
        .filter(Boolean) as string[]
    )
  );

  const spMap = new Map<string, string>();
  if (cups20List.length > 0) {
    const supplyPoints = await prisma.supplyPoint.findMany({
      where: {
        OR: cups20List.map((c20) => ({ cups: { startsWith: c20 } })),
      },
      select: { cups: true, address: true, city: true, province: true },
    });
    for (const sp of supplyPoints) {
      const key = sp.cups.substring(0, 20);
      if (!spMap.has(key) && sp.address && sp.address !== 'Pendiente' && sp.address !== 'Pendiente de SIPS') {
        const loc = [sp.city, sp.province].filter((v) => v && v !== 'Pendiente').join(', ');
        spMap.set(key, loc ? `${sp.address} (${loc})` : sp.address);
      }
    }
  }

  const mappedLeads = leadsDB.map((l) => {
    const cups20 = l.cups ? l.cups.substring(0, 20) : '';
    let direccion = cups20 ? spMap.get(cups20) || 'Pendiente' : 'Pendiente';
    let fechaRegistro = l.createdAt.toISOString();
    let comercialName = l.user?.name || 'Sistema';
    let canalName = l.user?.channel?.name || l.source || 'Directo';
    let cupsDisplay = l.cups || '';

    if (l.contractData && typeof l.contractData === 'object') {
      const data = l.contractData as any;
      if (data['DOMICILIO PS COMPLETO']) {
        direccion = data['DOMICILIO PS COMPLETO'];
      } else if (data['DOMICILIO PS']) {
        direccion = data['DOMICILIO PS'];
      } else if (data.direccionSuministro && typeof data.direccionSuministro === 'object') {
        const ds = data.direccionSuministro;
        const street = buildStructuredStreet(ds);
        const loc = [ds.cp, ds.poblacion, ds.provincia].filter(Boolean).join(' ').trim();
        const combined = [street, loc].filter(Boolean).join(', ');
        if (combined) direccion = combined;
      } else if (data.direccion && typeof data.direccion === 'object') {
        const d = data.direccion;
        const street = buildStructuredStreet(d);
        const loc = [d.cp, d.poblacion, d.provincia].filter(Boolean).join(' ').trim();
        const combined = [street, loc].filter(Boolean).join(', ');
        if (combined) direccion = combined;
      } else if (typeof data.direccion === 'string' && data.direccion.trim() && !/^Calle\s+NÚMERO$/i.test(data.direccion.trim())) {
        direccion = data.direccion.trim();
      }
    }

    const airtableData = (l.airtableData as any) || null;
    if (airtableData) {
      if (airtableData['DOMICILIO PS COMPLETO']) direccion = airtableData['DOMICILIO PS COMPLETO'];
      else if (airtableData['DOMICILIO PS']) direccion = airtableData['DOMICILIO PS'];

      if (airtableData['Fecha Registro']) fechaRegistro = new Date(airtableData['Fecha Registro']).toISOString();

      if ((!cupsDisplay || cupsDisplay.startsWith('CUPS_MOCK')) && airtableData['CUPS2']) {
        cupsDisplay = airtableData['CUPS2'];
      }

      if (airtableData['CANAL'] && airtableData['CANAL'] !== '') {
        canalName = Array.isArray(airtableData['CANAL']) ? airtableData['CANAL'][0] : airtableData['CANAL'];
      }

      if (canalName !== 'Directo' && !airtableData['Comercial'] && !l.user?.name) {
        comercialName = canalName;
      }
    }

    let finalStatus = l.status || 'NUEVO';
    if (l.contract?.signatureDate) {
      finalStatus = 'FIRMADO';
    }

    return {
      id: l.id,
      titular: l.businessName,
      empresa: l.businessName,
      nif: l.vatNumber || 'Pendiente',
      cups: cupsDisplay,
      tarifa: l.tariff || '2.0TD',
      status: finalStatus,
      canal: canalName,
      comercial: comercialName,
      fechaRegistro,
      comisionEst: l.estimatedMWh ? l.estimatedMWh * 15 : 0,
      sipsOk: Boolean(l.sipsOk),
      potencia: 'Varios',
      documentsCount: l.documents.length,
      rawLead: l as any,
      type: l.type,
      address: direccion,
      contractId: l.contractId || undefined,
      contractCode: l.contract?.contractCode || (l.contractData as any)?.['CONTRATO'] || undefined,
    };
  });

  return { leads: mappedLeads };
}

/**
 * Calcula en servidor la comisión anual estimada (12 meses) de una Oferta o Alta en curso,
 * devolviendo únicamente el importe resultante sin exponer márgenes internos (marginFC, ip1..ip6)
 * ni reglas confidenciales de nivel al navegador.
 */
export async function estimateLeadCommissionAction(input: {
  productNameOrId: string;
  productType: string;
  tarifa: string;
  estimatedMWh: number;
  potencias: [number, number, number, number, number, number];
  feeIndex?: number | null;
  ips?: [number | null, number | null, number | null, number | null, number | null, number | null];
  additionalServiceIds?: string[];
  leadOwnerUserId?: string | null;
}): Promise<{
  available: boolean;
  commissionTotal: number;
  commissionEnergy: number;
  commissionServices: number;
  channelName?: string;
}> {
  const empty = { available: false, commissionTotal: 0, commissionEnergy: 0, commissionServices: 0 };
  try {
    const session = await auth();
    if (!session?.user?.email) return empty;

    const dbUser = await prisma.user.findFirst({
      where: { email: { equals: session.user.email.trim(), mode: 'insensitive' } },
      include: { channel: true },
    });
    if (!dbUser || dbUser.isActive === false) return empty;

    const targetBrandId = ['CANAL', 'COMERCIAL'].includes(dbUser.role)
      ? dbUser.brandId
      : ((await getActiveBrand(dbUser)) || dbUser.brandId);

    let targetChannel = dbUser.channel;
    if (
      input.leadOwnerUserId &&
      ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(dbUser.role)
    ) {
      const ownerUser = await prisma.user.findUnique({
        where: { id: input.leadOwnerUserId },
        include: { channel: true },
      });
      if (ownerUser?.channel) {
        targetChannel = ownerUser.channel;
      }
    }

    const tierId = targetChannel?.commissionTierId;
    if (!tierId) {
      return empty;
    }

    const prodKey = String(input.productNameOrId || '').trim();
    if (!prodKey) return empty;

    const dbProduct =
      (await prisma.product.findUnique({ where: { id: prodKey } })) ||
      (await prisma.product.findFirst({ where: { name: prodKey, brandId: targetBrandId } })) ||
      (await prisma.product.findFirst({ where: { name: prodKey } }));

    const tierRules = await prisma.commissionRule.findMany({
      where: { tierId },
      include: {
        products: { select: { id: true } },
        additionalServices: { select: { id: true } },
      },
    });

    if (tierRules.length === 0) return empty;

    const {
      extractContractMarginSnapshots,
      matchBestCommissionRule,
      matchBestServiceRule,
    } = await import('@/lib/services/CommissionEngine');

    const cData = {
      feeIndex: input.feeIndex ?? undefined,
      ip1: input.ips?.[0] ?? undefined,
      ip2: input.ips?.[1] ?? undefined,
      ip3: input.ips?.[2] ?? undefined,
      ip4: input.ips?.[3] ?? undefined,
      ip5: input.ips?.[4] ?? undefined,
      ip6: input.ips?.[5] ?? undefined,
    };

    const extracted = extractContractMarginSnapshots(cData, dbProduct, input.productType);
    const snapProductType = extracted.productTypeSnapshot || input.productType || dbProduct?.type || '';
    const potencias = input.potencias.map((p) => (Number.isFinite(Number(p)) ? Number(p) : 0)) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const avgPower = (potencias[0] + potencias[1]) / 2;
    const tarifa = input.tarifa || dbProduct?.tariff || '2.0TD';

    const matchParams = {
      tarifa,
      productType: snapProductType,
      productId: dbProduct?.id,
      avgPower,
    };

    const matchedRule = matchBestCommissionRule(tierRules, matchParams);
    let commissionEnergy = 0;

    if (matchedRule) {
      if (matchedRule.commissionType === 'FIXED') {
        commissionEnergy = matchedRule.value;
      } else if (matchedRule.commissionType === 'PERCENTAGE') {
        const consumoMWh = Number.isFinite(Number(input.estimatedMWh)) ? Math.max(0, Number(input.estimatedMWh)) : 0;
        const energyMargin = consumoMWh * (extracted.marginFC ?? 0);
        const powerMargin =
          potencias[0] * (extracted.ip1 ?? 0) +
          potencias[1] * (extracted.ip2 ?? 0) +
          potencias[2] * (extracted.ip3 ?? 0) +
          potencias[3] * (extracted.ip4 ?? 0) +
          potencias[4] * (extracted.ip5 ?? 0) +
          potencias[5] * (extracted.ip6 ?? 0);

        commissionEnergy = (energyMargin + powerMargin) * (matchedRule.value / 100);
      }
    }

    let commissionServices = 0;
    if (Array.isArray(input.additionalServiceIds) && input.additionalServiceIds.length > 0) {
      const svcs = await prisma.additionalService.findMany({
        where: { id: { in: input.additionalServiceIds } },
      });
      for (const s of svcs) {
        if (s.isCommissionable) {
          const serviceRule = matchBestServiceRule(tierRules, s.id, matchParams);
          if (serviceRule) {
            if (serviceRule.commissionType === 'FIXED') {
              commissionServices += serviceRule.value;
            } else if (serviceRule.commissionType === 'PERCENTAGE') {
              const monthlyPrice =
                s.monthlyPrice !== null && s.monthlyPrice !== undefined
                  ? Number(s.monthlyPrice)
                  : s.dailyPrice !== null && s.dailyPrice !== undefined
                    ? Number(s.dailyPrice) * (365 / 12)
                    : 0;
              commissionServices += monthlyPrice * 12 * (serviceRule.value / 100);
            }
          }
        }
      }
    }

    if (!matchedRule && commissionServices === 0) {
      return empty;
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      available: true,
      commissionTotal: round2(commissionEnergy + commissionServices),
      commissionEnergy: round2(commissionEnergy),
      commissionServices: round2(commissionServices),
      channelName: targetChannel?.name || undefined,
    };
  } catch (err) {
    console.error('Error en estimateLeadCommissionAction:', err);
    return empty;
  }
}
