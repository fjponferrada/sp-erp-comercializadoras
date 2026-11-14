'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { resolveActiveCompanyId } from '@/lib/companyContext';
import PizZip from 'pizzip';
import { getTramitationCodes } from '@/lib/tramitationMapper';
import { normalizeProvincia, normalizeMunicipio, normalizeTipoVia } from '@/lib/normalizeAddress';

function escapeXml(val: string | null | undefined): string {
  if (!val) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanXmlText(str: string | null | undefined, maxLen: number = 80): string {
  if (!str) return '';
  const clean = String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  return escapeXml(clean);
}

function detectTipoIdentificadorCnmc(rawVat: string): 'NI' | 'NE' | 'PS' {
  const vat = rawVat.trim().toUpperCase();
  if (/^[XYZ]\d{7}[A-Z]$/.test(vat)) return 'NE';
  if (/^(\d{8}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]|[KLM]\d{7}[A-Z])$/.test(vat)) return 'NI';
  return 'PS';
}

/**
 * Tabla 17 CNMC (TarifaATR):
 * 018 = 2.0TD | 019 = 3.0TD | 020 = 6.1TD | 021 = 6.2TD | 022 = 6.3TD | 023 = 6.4TD
 * 024 = 3.0TDVE | 025 = 6.1TDVE | 026 = 6.2TDVE
 */
const TARIFA_MAP_CNMC: Record<string, string> = {
  '2.0TD': '018',
  '3.0TD': '019',
  '6.1TD': '020',
  '6.2TD': '021',
  '6.3TD': '022',
  '6.4TD': '023',
  '3.0TDVE': '024',
  '6.1TDVE': '025',
  '6.2TDVE': '026',
};

const VALID_TARIFA_CODES = new Set(['018', '019', '020', '021', '022', '023', '024', '025', '026', '027', '028', '029']);

function getTarifaAtrCode(tariffText: string | null | undefined): string | null {
  if (!tariffText) return null;
  const t = String(tariffText).toUpperCase().replace(/\s+/g, '');
  if (VALID_TARIFA_CODES.has(t)) return t;
  return TARIFA_MAP_CNMC[t] || null;
}

function formatMadridDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`;
}

function formatMadridDate(date: Date): string {
  return formatMadridDateTime(date).split('T')[0];
}

let swSolicitudCounter = 0;
function generate12DigitSolicitud(codEmisora: string): string {
  swSolicitudCounter = (swSolicitudCounter + 1) % 1000;
  const prefix = codEmisora.slice(0, 4).padStart(4, '0');
  const tsPart = String(Date.now()).slice(-5); // 5 digits
  const seqPart = String(swSolicitudCounter).padStart(3, '0'); // 3 digits
  return `${prefix}${tsPart}${seqPart}`; // 12 digits [0-9]{12}
}

function buildCnmcDocProxyUrl(rawFileUrlOrKey: string | null | undefined): string | null {
  if (!rawFileUrlOrKey || typeof rawFileUrlOrKey !== 'string') return null;
  let clean = rawFileUrlOrKey.trim();
  if (!clean || clean.includes('airtableusercontent.com')) return null;

  const r2Pub = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (r2Pub && clean.startsWith(r2Pub)) {
    clean = clean.slice(r2Pub.length).replace(/^\/+/, '');
  } else if (/^https?:\/\//i.test(clean)) {
    try {
      const parsed = new URL(clean);
      clean = parsed.pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  } else {
    clean = clean.replace(/^\/+/, '');
  }

  if (!clean || clean.includes('..')) return null;
  const cnmcUser = process.env.CNMC_DOC_USER || 'AED-CNMC';
  const cnmcPassRaw = process.env.CNMC_DOC_PASSWORD || 'AED#2024Doc';
  const url = `https://ultra.sp-energia.com/api/cnmc/document?file=${encodeURIComponent(clean).replace(/%2F/g, '/')}&user=${encodeURIComponent(cnmcUser)}&password=${encodeURIComponent(cnmcPassRaw)}`;
  return url.length <= 255 ? url : null;
}

export async function fetchPendingSwitchingContracts() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'No autorizado. Inicia sesión de nuevo.' };
    }

    const activeCompanyId = await resolveActiveCompanyId(session);

    const contracts = await prisma.contract.findMany({
      where: {
        status: { notIn: ['ACTIVO', 'Activo', 'FINALIZADO', 'Finalizado', 'BAJA', 'RECHAZADO', 'Rechazado'] },
        activationDate: null,
        tipo: { notIn: ['R', 'E1'] }, // Ignorar Renovación y Desistimiento
        ...(activeCompanyId
          ? {
              OR: [{ brand: { companyId: activeCompanyId } }, { brandId: null }],
            }
          : {}),
      },
      include: {
        client: true,
        supplyPoint: true,
        brand: {
          include: { company: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    contracts.sort((a, b) => {
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;

      const dateA = (a.airtableData as any)?.['Fecha firma'] ? new Date((a.airtableData as any)['Fecha firma']).getTime() : 0;
      const dateB = (b.airtableData as any)?.['Fecha firma'] ? new Date((b.airtableData as any)['Fecha firma']).getTime() : 0;

      return dateB - dateA;
    });

    return {
      success: true,
      data: contracts.map(c => {
        const airtableData = (c.airtableData as any) || {};
        const hasAnexoAirtable =
          airtableData['PDF Anexo firmado'] &&
          Array.isArray(airtableData['PDF Anexo firmado']) &&
          airtableData['PDF Anexo firmado'].length > 0;
        const hasAnexo = !!c.fileAnexoFirmado || hasAnexoAirtable;

        const computedAddress =
          [
            c.supplyPoint.streetType,
            c.supplyPoint.street,
            c.supplyPoint.streetNumber ? `NÚM ${c.supplyPoint.streetNumber}` : null,
            c.supplyPoint.floor ? `Piso ${c.supplyPoint.floor}` : null,
            c.supplyPoint.door ? `Puerta ${c.supplyPoint.door}` : null,
            c.supplyPoint.addressAddition,
          ]
            .filter(Boolean)
            .join(' ') ||
          c.supplyPoint.address ||
          '';

        return {
          id: c.id,
          cups: c.supplyPoint.cups,
          direccion: `${computedAddress} ${c.supplyPoint.postalCode || ''} ${c.supplyPoint.city || ''}`
            .trim()
            .replace(/\s+/g, ' '),
          nif: c.client.vatNumber,
          nombre: c.client.businessName || `${c.client.firstName || ''} ${c.client.lastName || ''}`.trim(),
          proceso: c.tipo || getTramitationCodes(c.tramitationType).tipo || 'C1',
          tipoC2: c.tipoC2 || getTramitationCodes(c.tramitationType).tipoC2,
          contrato: c.contractCode || c.id,
          codDistribuidora:
            c.supplyPoint.distributorReeCode || c.supplyPoint.distributor || c.supplyPoint.cups?.substring(2, 6),
          codComercializadora: c.brand?.company?.codigoRee || '',
          tipoTramitacion: c.tramitationType,
          estado: c.status,
          hasAnexo,
        };
      }),
    };
  } catch (error: any) {
    console.error('Error fetching pending contracts:', error);
    return { success: false, error: error.message };
  }
}

export async function generateSwitchingXmls(contractIds: string[]) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'No autorizado. Inicia sesión de nuevo.' };
    }

    const activeCompanyId = await resolveActiveCompanyId(session);
    const activeCompany = activeCompanyId
      ? await prisma.company.findUnique({ where: { id: activeCompanyId }, select: { id: true, codigoRee: true } })
      : await prisma.company.findFirst({ select: { id: true, codigoRee: true } });

    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        ...(activeCompanyId
          ? {
              OR: [{ brand: { companyId: activeCompanyId } }, { brandId: null }],
            }
          : {}),
      },
      include: {
        client: true,
        supplyPoint: true,
        product: true,
        documents: true,
        brand: {
          include: { company: true },
        },
      },
    });

    const zip = new PizZip();
    let count = 0;
    const errors: { id: string; contrato: string; motivo: string }[] = [];
    const fechaSol = formatMadridDateTime(new Date());

    for (const c of contracts) {
      const contratoLabel = c.contractCode || c.id;
      const missingReasons: string[] = [];

      const proceso = (c.tipo || getTramitationCodes(c.tramitationType).tipo || 'C1').toUpperCase();
      const cAirtableFallback: any = c.airtableData || (c as any).client?.airtableData || {};
      const tipoC2 = c.tipoC2 || getTramitationCodes(c.tramitationType).tipoC2 || cAirtableFallback['Tipo_c2'] || 'C2_A';

      const codEmisora = (c.brand?.company?.codigoRee || activeCompany?.codigoRee || '').trim();
      if (!/^\d{4}$/.test(codEmisora)) {
        missingReasons.push('Falta Código REE válido (4 dígitos) en la Comercializadora');
      }

      const rawCups = (c.supplyPoint?.cups || '').trim().toUpperCase();
      if (!/^ES\d{16}[A-Z0-9]{2,4}$/.test(rawCups)) {
        missingReasons.push('CUPS ausente o con formato inválido');
      }
      const cupsFinal = rawCups.length === 20 ? `${rawCups}0F` : rawCups;

      const codDestinoRaw =
        c.supplyPoint?.distributorReeCode ||
        cAirtableFallback['CODIGO REE DISTRIBUIDORA'] ||
        (rawCups.length >= 6 ? rawCups.substring(2, 6) : '') ||
        c.supplyPoint?.distributor ||
        '';
      const codDestino = String(codDestinoRaw).match(/\d{4}/)?.[0] || '';
      if (!/^\d{4}$/.test(codDestino)) {
        missingReasons.push('No se pudo determinar el Código REE de la Distribuidora (4 dígitos)');
      }

      const vat = (c.client?.vatNumber || '').trim().toUpperCase();
      if (!vat || vat.length < 7) {
        missingReasons.push('Falta NIF/NIE/CIF válido del titular');
      }

      const isCompany = /^[ABCDEFGHJNPQRSUVW]/i.test(vat);
      const clientFallbackName =
        cAirtableFallback['NOMBRE Y APELLIDOS'] || cAirtableFallback['Titular'] || '';
      const companyName = (
        c.client.businessName ||
        cAirtableFallback['NOMBRERAZON SOCIAL'] ||
        cAirtableFallback['Razn Social'] ||
        clientFallbackName ||
        ''
      ).trim();

      let nombreDePila = (
        c.client.firstName ||
        cAirtableFallback['Nombre de pila'] ||
        ''
      ).trim();
      let primerApellido = (
        c.client.lastName ||
        cAirtableFallback['Primer Apellido'] ||
        ''
      ).trim();
      let segundoApellido = (
        c.client.lastName2 ||
        cAirtableFallback['Segundo Apellido'] ||
        ''
      ).trim();

      if (!isCompany && (!nombreDePila || !primerApellido) && companyName) {
        const parts = companyName.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          if (!nombreDePila) nombreDePila = parts[0];
          if (!primerApellido) primerApellido = parts[1];
          if (!segundoApellido && parts.length > 2) segundoApellido = parts.slice(2).join(' ');
        }
      }

      if (isCompany && !companyName) {
        missingReasons.push('Falta Razón Social de la empresa titular');
      } else if (!isCompany && (!nombreDePila || !primerApellido)) {
        missingReasons.push('Falta Nombre o Primer Apellido del titular persona física');
      }

      // Teléfono real obligatorio (cero fallback a 600000000)
      const rawPhone =
        c.client.contactPhone ||
        c.client.representativePhone ||
        cAirtableFallback['Teléfono'] ||
        cAirtableFallback['Telefono'] ||
        '';
      const cleanedPhone = String(rawPhone)
        .replace(/\D/g, '')
        .replace(/^(0034|34)(\d{9})$/, '$2');
      if (cleanedPhone.length < 6 || cleanedPhone.length > 12) {
        missingReasons.push('Falta teléfono de contacto válido del titular/representante');
      }

      const needsContractAndAddress = ['A3', 'C2', 'M1'].includes(proceso);

      let rawTariff = (c as any).tariff || c.supplyPoint.tariff || c.product?.tariff || '';
      if (!rawTariff) {
        if (typeof cAirtableFallback['tarifa'] === 'string') {
          rawTariff = cAirtableFallback['tarifa'];
        } else {
          const atTariff =
            (cAirtableFallback['Código Tarifa'] && cAirtableFallback['Código Tarifa'][0]) ||
            cAirtableFallback['Tarifa'] ||
            '';
          rawTariff = Array.isArray(atTariff) ? atTariff[0] : atTariff;
        }
      }
      const mappedTarifa = getTarifaAtrCode(rawTariff);

      const rawPeriods = [
        c.p1c ?? c.supplyPoint.p1c,
        c.p2c ?? c.supplyPoint.p2c,
        c.p3c ?? c.supplyPoint.p3c,
        c.p4c ?? c.supplyPoint.p4c,
        c.p5c ?? c.supplyPoint.p5c,
        c.p6c ?? c.supplyPoint.p6c,
      ];

      let potenciasXml = '';
      if (needsContractAndAddress) {
        if (!mappedTarifa) {
          missingReasons.push(`Tarifa ATR ausente o no reconocida (${rawTariff || 'vacía'})`);
        } else {
          const requiredPeriodCount = mappedTarifa === '018' ? 2 : 6;
          const missingPeriodNums: number[] = [];
          for (let i = 0; i < requiredPeriodCount; i++) {
            const pVal = rawPeriods[i];
            if (pVal === null || pVal === undefined || Number.isNaN(Number(pVal)) || Number(pVal) < 0) {
              missingPeriodNums.push(i + 1);
            } else {
              potenciasXml += `<Potencia Periodo="${i + 1}">${Math.round(Number(pVal) * 1000)}</Potencia>\n              `;
            }
          }
          if (missingPeriodNums.length > 0) {
            missingReasons.push(
              `Faltan potencias contratadas en periodo(s) P${missingPeriodNums.join(', P')} para tarifa ${rawTariff}`
            );
          }
        }
      }

      // Dirección y CNAE estrictos para A3, C2 y M1 (cero fallback a 28000 / 28079 / 3514)
      const cAirtable: any = c.airtableData || c.client.airtableData || {};
      const cityRaw = (
        c.client.billingCity ||
        c.supplyPoint.city ||
        cAirtable['POBLACIÓN'] ||
        cAirtable['Población'] ||
        ''
      ).trim();
      const postalCodeRaw =
        c.client.billingPostalCode ||
        c.supplyPoint.postalCode ||
        cAirtable['CP'] ||
        cAirtable['C.P.'] ||
        cAirtable['C. P.'] ||
        '';
      const postalCode = String(postalCodeRaw).trim().padStart(postalCodeRaw ? 5 : 0, '0');
      const normProvincia = /^\d{5}$/.test(postalCode) ? normalizeProvincia(postalCode) : '';
      const rawMuni = /^\d{5}$/.test(postalCode) ? normalizeMunicipio(postalCode, cityRaw) : '000';
      const normMunicipio = normProvincia && rawMuni && rawMuni !== '000' ? `${normProvincia}${rawMuni}` : '';
      const normTipoVia = normalizeTipoVia(c.client.billingStreetType || c.supplyPoint.streetType || 'CL');
      const fullStreet = (c.client.billingStreet || c.supplyPoint.street || c.supplyPoint.address || '').trim();
      const isBillingNumberValid =
        c.client.billingNumber && c.client.billingNumber !== '00' && c.client.billingNumber !== '0';
      const numeroFincaFinal = String(
        isBillingNumberValid
          ? c.client.billingNumber
          : c.supplyPoint.streetNumber
            ? c.supplyPoint.streetNumber
            : cAirtable['Número Titular'] !== undefined
              ? String(cAirtable['Número Titular'])
              : 'S/N'
      )
        .trim()
        .slice(0, 5);

      const rawCnae = String(c.supplyPoint.cnae || c.client.cnae || cAirtable['CNAE'] || '').trim();

      if (needsContractAndAddress) {
        if (!/^\d{5}$/.test(postalCode) || !/^\d{2}$/.test(normProvincia)) {
          missingReasons.push('Falta Código Postal español válido de 5 dígitos');
        }
        if (!/^\d{5}$/.test(normMunicipio)) {
          missingReasons.push(
            `No se pudo resolver el código INE de municipio para CP "${postalCode}" y población "${cityRaw || 'vacía'}"`
          );
        }
        if (!fullStreet) {
          missingReasons.push('Falta nombre de calle/vía en la dirección');
        }
        if (!/^\d{4}$/.test(rawCnae)) {
          missingReasons.push('Falta código CNAE válido de 4 dígitos');
        }
      }

      if (missingReasons.length > 0) {
        errors.push({
          id: c.id,
          contrato: contratoLabel,
          motivo: missingReasons.join('; '),
        });
        continue;
      }

      const isRejectedRetry = ['RECHAZO_DISTRIBUIDORA', 'Rechazo Distribuidora', 'RECHAZADO', 'Rechazado'].includes(
        c.status
      );
      let codSolicitud = (c.nSolicitud || '').trim();
      if (isRejectedRetry || !/^\d{12}$/.test(codSolicitud)) {
        codSolicitud = generate12DigitSolicitud(codEmisora);
      }

      const tipoIdentificador = detectTipoIdentificadorCnmc(vat);
      const nombreXml = isCompany
        ? `<RazonSocial>${cleanXmlText(companyName, 80)}</RazonSocial>`
        : `<NombreDePila>${cleanXmlText(nombreDePila, 80)}</NombreDePila><PrimerApellido>${cleanXmlText(primerApellido, 80)}</PrimerApellido>${
            segundoApellido ? `<SegundoApellido>${cleanXmlText(segundoApellido, 80)}</SegundoApellido>` : ''
          }`;

      const clienteXml = `
        <Cliente>
          <IdCliente>
            <TipoIdentificador>${tipoIdentificador}</TipoIdentificador>
            <Identificador>${escapeXml(vat)}</Identificador>
          </IdCliente>
          <Nombre>
            ${nombreXml}
          </Nombre>
          <Telefono>
            <PrefijoPais>0034</PrefijoPais>
            <Numero>${cleanedPhone}</Numero>
          </Telefono>
        </Cliente>
      `.trim();

      let personaContactoXml = '';
      if (!isCompany) {
        personaContactoXml = cleanXmlText(`${nombreDePila} ${primerApellido} ${segundoApellido}`, 80);
      } else {
        let repNameRaw = c.client.representativeName;
        if (!repNameRaw) {
          repNameRaw = cAirtable['Nombre Contacto']
            ? `${cAirtable['Nombre Contacto']} ${cAirtable['Apellidos Contacto'] || ''}`.trim()
            : cAirtable['Apoderado / Rep. Legal'] ||
              cAirtable['NOMBRE Y APELLIDOS'] ||
              cAirtable['Nombre Representante'] ||
              cAirtable['Apoderado'] ||
              '';
        }
        const repName = typeof repNameRaw === 'string' ? repNameRaw.trim() : '';
        const contactName = c.client.contactName
          ? `${c.client.contactName} ${c.client.contactLastName || ''}`.trim()
          : '';
        personaContactoXml = cleanXmlText(repName || contactName || companyName, 80);
      }

      const clienteConDireccionXml = `
        <Cliente>
          <IdCliente>
            <TipoIdentificador>${tipoIdentificador}</TipoIdentificador>
            <Identificador>${escapeXml(vat)}</Identificador>
          </IdCliente>
          <Nombre>
            ${nombreXml}
          </Nombre>
          <Telefono>
            <PrefijoPais>0034</PrefijoPais>
            <Numero>${cleanedPhone}</Numero>
          </Telefono>
          <IndicadorTipoDireccion>F</IndicadorTipoDireccion>
          <Direccion>
            <Pais>ESPAÑA</Pais>
            <Provincia>${normProvincia}</Provincia>
            <Municipio>${normMunicipio}</Municipio>
            <CodPostal>${postalCode}</CodPostal>
            <Via>
              <TipoVia>${normTipoVia}</TipoVia>
              <Calle>${cleanXmlText(fullStreet, 30)}</Calle>
              <NumeroFinca>${cleanXmlText(numeroFincaFinal, 5)}</NumeroFinca>
            </Via>
          </Direccion>
        </Cliente>
      `.trim();

      let autoconsumoXml = '';
      const autoType = (c.supplyPoint.selfConsumptionType || cAirtableFallback.selfConsumptionType || '').trim();
      const cau = (c.supplyPoint.cau || cAirtableFallback.cau || '').trim();

      let sendAutoconsumo = false;
      if (autoType && cau) {
        if (proceso === 'M1') {
          if (cAirtableFallback.isAutoconsumoModification) {
            sendAutoconsumo = true;
          }
        } else if (proceso === 'A3' || proceso === 'C2') {
          if (c.supplyPoint.hasSelfConsumption || cAirtableFallback.isAutoconsumoModification) {
            sendAutoconsumo = true;
          }
        }
      }

      if (sendAutoconsumo) {
        const tCups = (c.supplyPoint.tipoCups || cAirtableFallback.tipoCups || '01').trim();
        const tSub = (c.supplyPoint.cauSubtype || cAirtableFallback.cauSubtype || '21').trim();
        const col = (c.supplyPoint.cauCollective || cAirtableFallback.cauCollective || 'N').trim();
        const rawPGen = Number(c.supplyPoint.installedPowerGen ?? cAirtableFallback.installedPowerGen ?? 0);
        const potGenWatts =
          !Number.isNaN(rawPGen) && rawPGen > 0
            ? rawPGen < 1000
              ? Math.round(rawPGen * 1000)
              : Math.round(rawPGen)
            : 0;
        const tInst = String(c.supplyPoint.installationType || cAirtableFallback.installationType || '01').padStart(2, '0');
        const esq = (c.supplyPoint.meteringScheme || cAirtableFallback.meteringScheme || 'A').trim();
        const cil = (c.supplyPoint.cil || cAirtableFallback.cil || '').trim();

        autoconsumoXml = `
          <Autoconsumo>
            <DatosSuministro>
              <TipoCUPS>${escapeXml(tCups)}</TipoCUPS>
            </DatosSuministro>
            <DatosCAU>
              <CAU>${escapeXml(cau)}</CAU>
              <TipoAutoconsumo>${escapeXml(autoType)}</TipoAutoconsumo>
              <TipoSubseccion>${escapeXml(tSub)}</TipoSubseccion>
              <Colectivo>${escapeXml(col)}</Colectivo>
              <DatosInstGen>${cil ? `\n                <CIL>${escapeXml(cil)}</CIL>` : ''}
                <PotInstaladaGen>${potGenWatts}</PotInstaladaGen>
                <TipoInstalacion>${escapeXml(tInst)}</TipoInstalacion>
                <EsquemaMedida>${escapeXml(esq)}</EsquemaMedida>
                <SSAA>N</SSAA>
              </DatosInstGen>
            </DatosCAU>
          </Autoconsumo>
        `;
      }

      const contratoGenericoXml = `
        <Contrato>
          ${autoconsumoXml.trim()}
          <TipoContratoATR>01</TipoContratoATR>
          <CondicionesContractuales>
            <TarifaATR>${mappedTarifa}</TarifaATR>
            <PotenciasContratadas>
              ${potenciasXml.trim()}
            </PotenciasContratadas>
          </CondicionesContractuales>
          <Contacto>
            <PersonaDeContacto>${personaContactoXml}</PersonaDeContacto>
            <Telefono>
              <PrefijoPais>0034</PrefijoPais>
              <Numero>${cleanedPhone}</Numero>
            </Telefono>
          </Contacto>
        </Contrato>
      `.trim();

      const fechaPrevStr = c.fechaPrevista ? formatMadridDate(new Date(c.fechaPrevista)) : '';
      const indActivacion = fechaPrevStr ? 'F' : 'A';
      const fechaPrevXml = fechaPrevStr ? `\n              <FechaPrevistaAccion>${fechaPrevStr}</FechaPrevistaAccion>` : '';

      const docEntries: Array<{ tipo: string; url: string }> = [];
      if (['A3', 'C2', 'M1'].includes(proceso)) {
        const ciePath =
          c.supplyPoint.fileCie ||
          c.documents?.find(d => d.type === 'CIE' || d.type === 'BOLETIN_CIE')?.url ||
          null;
        const cieUrl = buildCnmcDocProxyUrl(ciePath);
        if (cieUrl) docEntries.push({ tipo: '01', url: cieUrl });

        if (sendAutoconsumo) {
          const cieAutoPath =
            c.supplyPoint.fileCieSelfConsump ||
            c.documents?.find(d => d.type === 'CIE_AUTOCONSUMO')?.url ||
            null;
          const cieAutoUrl = buildCnmcDocProxyUrl(cieAutoPath);
          if (cieAutoUrl) docEntries.push({ tipo: '10', url: cieAutoUrl });
        }

        const ownershipPath =
          c.documents?.find(d =>
            ['CAMBIO_TITULARIDAD', 'ACREDITACION_PROPIEDAD', 'JUSTIFICANTE_TITULARIDAD'].includes(d.type)
          )?.url || null;
        const ownershipUrl = buildCnmcDocProxyUrl(ownershipPath);
        if (ownershipUrl) docEntries.push({ tipo: '07', url: ownershipUrl });
      }
      const registrosDocumentoXml =
        docEntries.length > 0
          ? `\n            <RegistrosDocumento>${docEntries
              .map(
                d => `
              <RegistroDoc>
                <TipoDocAportado>${d.tipo}</TipoDocAportado>
                <DireccionUrl>${escapeXml(d.url)}</DireccionUrl>
              </RegistroDoc>`
              )
              .join('')}
            </RegistrosDocumento>`
          : '';

      let rootNode = '';
      let payloadNode = '';
      let payloadContent = '';

      switch (proceso) {
        case 'C1':
          rootNode = 'MensajeCambiodeComercializadorSinCambios';
          payloadNode = 'CambiodeComercializadorSinCambios';
          payloadContent = `
            <DatosSolicitud>
              <IndActivacion>${indActivacion}</IndActivacion>${fechaPrevXml}
              <ContratacionIncondicionalPS>N</ContratacionIncondicionalPS>
              <ContratacionIncondicionalBS>N</ContratacionIncondicionalBS>
            </DatosSolicitud>
            ${clienteXml}
          `;
          break;
        case 'C2': {
          rootNode = 'MensajeCambiodeComercializadorConCambios';
          payloadNode = 'CambiodeComercializadorConCambios';

          let tipoModificacion = 'A';
          if (tipoC2 === 'S' || tipoC2 === 'C2_S') tipoModificacion = 'S';
          if (tipoC2 === 'N' || tipoC2 === 'C2_N') tipoModificacion = 'N';

          let tipoSolAdminXml = '';
          if (tipoModificacion === 'S' || tipoModificacion === 'A') {
            const adminCode =
              cAirtable.tipoSolicitudAdministrativa ||
              (cAirtable.isSubrogation === true ? 'S' : 'T');
            tipoSolAdminXml = `<TipoSolicitudAdministrativa>${escapeXml(adminCode)}</TipoSolicitudAdministrativa>`;
          }

          payloadContent = `
            <DatosSolicitud>
              <TipoModificacion>${tipoModificacion}</TipoModificacion>
              ${tipoSolAdminXml}
              <CNAE>${escapeXml(rawCnae)}</CNAE>
              <IndActivacion>${indActivacion}</IndActivacion>${fechaPrevXml}
              <ContratacionIncondicionalPS>N</ContratacionIncondicionalPS>
              <ContratacionIncondicionalBS>N</ContratacionIncondicionalBS>
            </DatosSolicitud>
            ${contratoGenericoXml}
            ${clienteConDireccionXml}${registrosDocumentoXml}
          `;
          break;
        }
        case 'A3':
          rootNode = 'MensajeAlta';
          payloadNode = 'Alta';
          payloadContent = `
            <DatosSolicitud>
              <CNAE>${escapeXml(rawCnae)}</CNAE>
              <IndActivacion>${indActivacion}</IndActivacion>${fechaPrevXml}
            </DatosSolicitud>
            ${contratoGenericoXml}
            ${clienteConDireccionXml}${registrosDocumentoXml}
          `;
          break;
        case 'M1': {
          rootNode = 'MensajeModificacionDeATR';
          payloadNode = 'ModificacionDeATR';

          let tipoModificacionM1 = 'A';
          if (tipoC2 === 'S' || tipoC2 === 'M1_S') tipoModificacionM1 = 'S';
          if (tipoC2 === 'N' || tipoC2 === 'M1_N') tipoModificacionM1 = 'N';

          let tipoSolicitudAdministrativa = '';
          if (tipoModificacionM1 === 'S' || tipoModificacionM1 === 'A') {
            const adminCode =
              cAirtable.tipoSolicitudAdministrativa ||
              (cAirtable.isSubrogation === true ? 'S' : 'T');
            tipoSolicitudAdministrativa = `<TipoSolicitudAdministrativa>${escapeXml(adminCode)}</TipoSolicitudAdministrativa>`;
          }

          payloadContent = `
            <DatosSolicitud>
              <TipoModificacion>${tipoModificacionM1}</TipoModificacion>
              ${tipoSolicitudAdministrativa}
              <CNAE>${escapeXml(rawCnae)}</CNAE>
              <IndActivacion>${indActivacion}</IndActivacion>${fechaPrevXml}
            </DatosSolicitud>
            ${contratoGenericoXml}
            ${clienteConDireccionXml}${registrosDocumentoXml}
          `;
          break;
        }
        case 'B1': {
          rootNode = 'MensajeBajaSuspension';
          payloadNode = 'BajaSuspension';
          const motivoBaja = ['01', '02', '03', '04'].includes(String(cAirtable.motivoBaja))
            ? String(cAirtable.motivoBaja)
            : '01';
          payloadContent = `
            <DatosSolicitud>
              <IndActivacion>${indActivacion}</IndActivacion>${fechaPrevXml}
              <Motivo>${motivoBaja}</Motivo>
            </DatosSolicitud>
            ${clienteXml}
          `;
          break;
        }
        default:
          rootNode = 'MensajeCambiodeComercializadorSinCambios';
          payloadNode = 'CambiodeComercializadorSinCambios';
          payloadContent = `
            <DatosSolicitud>
              <IndActivacion>${indActivacion}</IndActivacion>${fechaPrevXml}
              <ContratacionIncondicionalPS>N</ContratacionIncondicionalPS>
              <ContratacionIncondicionalBS>N</ContratacionIncondicionalBS>
            </DatosSolicitud>
            ${clienteXml}
          `;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootNode} xmlns="http://localhost/elegibilidad">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${escapeXml(codEmisora)}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${escapeXml(codDestino)}</CodigoREEEmpresaDestino>
    <CodigoDelProceso>${escapeXml(proceso)}</CodigoDelProceso>
    <CodigoDePaso>01</CodigoDePaso>
    <CodigoDeSolicitud>${escapeXml(codSolicitud)}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${fechaSol}</FechaSolicitud>
    <CUPS>${escapeXml(cupsFinal)}</CUPS>
  </Cabecera>
  <${payloadNode}>
    ${payloadContent.trim()}
  </${payloadNode}>
</${rootNode}>`;

      zip.file(`${proceso}_01_${codSolicitud}_${cupsFinal}.xml`, xml);
      count++;

      if (c.nSolicitud !== codSolicitud) {
        await prisma.contract.update({
          where: { id: c.id },
          data: { nSolicitud: codSolicitud },
        });
      }
    }

    if (count === 0 && errors.length > 0) {
      return { success: false, error: 'Ningún XML generado. Revisa los errores de validación obligatorios.', validationErrors: errors };
    }

    if (count === 0) {
      return { success: false, error: 'No se generó ningún XML.' };
    }

    const zipBase64 = zip.generate({ type: 'base64' });

    return {
      success: true,
      fileContent: zipBase64,
      fileName: `Switching_Generados_${Date.now()}.zip`,
      count,
      validationErrors: errors,
    };
  } catch (error: any) {
    console.error('Error generating XMLs:', error);
    return { success: false, error: error.message };
  }
}
