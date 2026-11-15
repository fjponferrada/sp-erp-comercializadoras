'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { normalizeProvincia, normalizeMunicipio, normalizeTipoVia } from '@/lib/normalizeAddress';
import { unstable_noStore as noStore } from 'next/cache';
import { getSupplyPointVisibilityFilter, getInvoiceVisibilityFilter } from '@/lib/permissions';
import { ingestXmlStringInternal } from '@/app/actions/switchingIngest';
import { SUBTIPOS_CLIENTE_OPCIONAL, isCupsOptionalForSubtipo } from '@/app/(app)/reclamaciones/utils/casuisticas';
import { normalizeSubtipoR1 } from '@/app/(app)/reclamaciones/utils/cnmc_codes';
import PizZip from 'pizzip';

const escapeXml = (unsafe: string | null | undefined) => {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

const removeAccentsAndEscape = (str: string | null | undefined) => {
  if (!str) return '';
  const noAccents = String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return escapeXml(noAccents);
};

const cleanPhone = (raw: string | null | undefined, fallback: string) => {
  const digits = String(raw || '').replace(/\D/g, '').replace(/^34(\d{9})$/, '$1');
  return digits.length >= 6 ? digits.slice(0, 12) : fallback;
};

/**
 * Formateo estricto en zona horaria Europe/Madrid (Regla 112), independiente del reloj UTC de Vercel.
 */
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
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`;
}

function formatMadridDate(date: Date): string {
  return formatMadridDateTime(date).split('T')[0];
}

let solicitudSeqCounter = 0;
function generate12DigitSolicitudCode(): string {
  solicitudSeqCounter = (solicitudSeqCounter + 1) % 1000;
  const tsPart = String(Date.now()).slice(-7); // 7 digits
  const seqPart = String(solicitudSeqCounter).padStart(3, '0'); // 3 digits
  const rndPart = String(Math.floor(Math.random() * 100)).padStart(2, '0'); // 2 digits
  return `${tsPart}${seqPart}${rndPart}`; // Exactamente 12 dígitos numéricos sin colisión en ráfagas masivas
}

export interface OpenR1BadgeInfo {
  codigoSolicitud: string;
  subtipo: string | null;
  fecha: string | null;
  estado: string;
}

/**
 * Detecta reclamaciones R1 actualmente abiertas (sin Paso 05, sin rechazo en Paso 02 y no anuladas)
 * para un conjunto de CUPS (por prefijo de 20 caracteres).
 */
async function getOpenR1ByBaseCups(baseCupsList: string[]): Promise<Map<string, OpenR1BadgeInfo[]>> {
  const result = new Map<string, OpenR1BadgeInfo[]>();
  const uniqueBases = Array.from(new Set(baseCupsList.map((c) => c.trim().substring(0, 20)).filter((c) => c.length >= 20)));
  if (uniqueBases.length === 0) return result;

  const sps = await prisma.supplyPoint.findMany({
    where: {
      OR: uniqueBases.map((b) => ({ cups: { startsWith: b, mode: 'insensitive' as const } })),
    },
    select: { id: true, cups: true },
  });
  if (sps.length === 0) return result;

  const spToBase = new Map<string, string>();
  for (const sp of sps) {
    spToBase.set(sp.id, sp.cups.substring(0, 20).toUpperCase());
  }

  const r1Events = await prisma.switchingEvent.findMany({
    where: {
      procesoBase: 'R1',
      supplyPointId: { in: Array.from(spToBase.keys()) },
    },
    select: {
      codigoSolicitud: true,
      paso: true,
      estadoAR: true,
      isAnnulled: true,
      subtipoReclamacion: true,
      fechaSolicitud: true,
      createdAt: true,
      supplyPointId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Agrupar por codigoSolicitud
  const grouped = new Map<
    string,
    {
      baseCups: string;
      codigoSolicitud: string;
      subtipo: string | null;
      fecha: Date | null;
      closed: boolean;
      rejected: boolean;
      annulled: boolean;
      accepted: boolean;
    }
  >();

  for (const ev of r1Events) {
    if (!ev.codigoSolicitud || !ev.supplyPointId) continue;
    const baseCups = spToBase.get(ev.supplyPointId);
    if (!baseCups) continue;

    if (!grouped.has(ev.codigoSolicitud)) {
      grouped.set(ev.codigoSolicitud, {
        baseCups,
        codigoSolicitud: ev.codigoSolicitud,
        subtipo: normalizeSubtipoR1(ev.subtipoReclamacion),
        fecha: ev.fechaSolicitud || ev.createdAt,
        closed: false,
        rejected: false,
        annulled: false,
        accepted: false,
      });
    }
    const g = grouped.get(ev.codigoSolicitud)!;
    const normSub = normalizeSubtipoR1(ev.subtipoReclamacion);
    if (normSub) g.subtipo = normSub;
    if (ev.isAnnulled || (ev.paso === '09' && ev.estadoAR === 'ACEPTADO')) g.annulled = true;
    if (ev.paso === '05') g.closed = true;
    if (ev.paso === '02' && ev.estadoAR === 'RECHAZADO') g.rejected = true;
    if (ev.paso === '02' && ev.estadoAR === 'ACEPTADO') g.accepted = true;
    if (ev.paso === '01' && ev.fechaSolicitud) g.fecha = ev.fechaSolicitud;
  }

  for (const g of grouped.values()) {
    if (!g.closed && !g.rejected && !g.annulled) {
      const list = result.get(g.baseCups) || [];
      list.push({
        codigoSolicitud: g.codigoSolicitud,
        subtipo: g.subtipo,
        fecha: g.fecha ? g.fecha.toISOString() : null,
        estado: g.accepted ? 'Aceptada' : 'En Proceso',
      });
      result.set(g.baseCups, list);
    }
  }

  return result;
}

export async function searchCupsForClaim(cups: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const cleanInput = cups.trim().toUpperCase();
    const cups20 = cleanInput.substring(0, 20);
    if (cups20.length < 18) {
      return { success: false, error: 'Introduce un código CUPS válido (mínimo 20 caracteres)' };
    }

    const spFilter = await getSupplyPointVisibilityFilter();

    const supplyPoints = await prisma.supplyPoint.findMany({
      where: {
        ...spFilter,
        cups: { startsWith: cups20, mode: 'insensitive' },
      },
      include: {
        client: true,
        contracts: {
          orderBy: { activationDate: 'desc' },
          include: { client: true },
        },
        f1Invoices: {
          orderBy: { fechaEmision: 'desc' },
          take: 25,
        },
      },
    });

    if (supplyPoints.length === 0) {
      return { success: false, notFoundInErp: true, error: 'CUPS no encontrado en la cartera activa' };
    }

    // Seleccionar el SupplyPoint con contrato ACTIVO o el más reciente
    let supplyPoint = supplyPoints.find((s) =>
      s.contracts?.some((c) => ['ACTIVO', 'Activo', 'ACTIVE'].includes(c.status))
    );
    if (!supplyPoint) {
      let latestDate = new Date(0);
      for (const s of supplyPoints) {
        for (const c of s.contracts || []) {
          const tDate = c.terminationDate || c.expectedEndDate || c.activationDate;
          if (tDate && tDate > latestDate) {
            latestDate = tDate;
            supplyPoint = s;
          }
        }
      }
      if (!supplyPoint) supplyPoint = supplyPoints[0];
    }

    // Consolidar las F1 de todos los clones del mismo CUPS (Regla 21) sin duplicar por numeroFactura
    const seenF1Keys = new Set<string>();
    const allF1s = supplyPoints
      .flatMap((spItem) => spItem.f1Invoices || [])
      .sort((a, b) => {
        const da = a.fechaEmision ? new Date(a.fechaEmision).getTime() : 0;
        const db = b.fechaEmision ? new Date(b.fechaEmision).getTime() : 0;
        return db - da;
      })
      .filter((f1) => {
        const key = f1.numeroFactura || f1.id;
        if (seenF1Keys.has(key)) return false;
        seenF1Keys.add(key);
        return true;
      })
      .slice(0, 25);

    const activeContract =
      supplyPoint.contracts?.find((c) => ['ACTIVO', 'Activo', 'ACTIVE'].includes(c.status)) ||
      supplyPoint.contracts?.[0];
    const activeClient = activeContract?.client || supplyPoint.client;

    const openMap = await getOpenR1ByBaseCups([supplyPoint.cups]);
    const openClaims = openMap.get(supplyPoint.cups.substring(0, 20).toUpperCase()) || [];

    return {
      success: true,
      data: {
        supplyPointId: supplyPoint.id,
        cups: supplyPoint.cups,
        tariff: supplyPoint.tariff || (activeClient as any)?.airtableData?.TARIFA || '',
        clientName: activeClient.businessName || `${activeClient.firstName || ''} ${activeClient.lastName || ''}`.trim(),
        clientVat: activeClient.vatNumber,
        openClaims,
        f1Invoices: allF1s.map((f1) => {
          const jsonData: any = f1.jsonData || {};
          const dGenFact = jsonData?.DatosGeneralesFacturaATR?.DatosGeneralesFactura || {};

          const getArray = (obj: any) => (obj ? (Array.isArray(obj) ? obj : [obj]) : []);
          const pEnergia = getArray(jsonData?.EnergiaActiva?.TerminoEnergiaActiva?.Periodo);
          const pPotencia = getArray(jsonData?.Potencia?.TerminoPotencia?.Periodo);

          const getE = (i: number, k1: string, k2: string) =>
            pEnergia[i]?.ValorEnergiaActiva ?? (jsonData[k1] ?? (jsonData[k2] ?? '0'));
          const getP = (i: number, k1: string, k2: string) =>
            pPotencia[i]?.PotenciaAFacturar ?? (pPotencia[i]?.PotenciaContratada ?? (jsonData[k1] ?? (jsonData[k2] ?? '0')));

          const dFacturaAtr = jsonData?.DatosGeneralesFacturaATR?.DatosFacturaATR || jsonData?.DatosFacturaATR || {};
          return {
            id: f1.id,
            codigoFiscal:
              f1.numeroFactura || dGenFact.CodigoFiscalFactura || jsonData.codigoFiscal || jsonData['Codigo Fiscal'] || '',
            fechaEmision: f1.fechaEmision,
            fechaInicio: f1.fechaInicio || dFacturaAtr.Periodo?.FechaDesdeFactura || dFacturaAtr.FechaInicioPeriodo,
            fechaFin: f1.fechaFin || dFacturaAtr.Periodo?.FechaHastaFactura || dFacturaAtr.FechaFinPeriodo,
            tipoFactura: dGenFact.TipoFactura || jsonData.tipoFactura || 'Normal',
            motivoFactura: dGenFact.MotivoFacturacion || jsonData.motivoFactura || 'De ciclo',
            excedentes: jsonData.excedentes || '0',
            energiaP1: getE(0, 'energiaP1', 'P1E'),
            energiaP2: getE(1, 'energiaP2', 'P2E'),
            energiaP3: getE(2, 'energiaP3', 'P3E'),
            energiaP4: getE(3, 'energiaP4', 'P4E'),
            energiaP5: getE(4, 'energiaP5', 'P5E'),
            energiaP6: getE(5, 'energiaP6', 'P6E'),
            potenciaP1: getP(0, 'potenciaP1', 'P1C'),
            potenciaP2: getP(1, 'potenciaP2', 'P2C'),
            potenciaP3: getP(2, 'potenciaP3', 'P3C'),
            potenciaP4: getP(3, 'potenciaP4', 'P4C'),
            potenciaP5: getP(4, 'potenciaP5', 'P5C'),
            potenciaP6: getP(5, 'potenciaP6', 'P6C'),
            jsonData,
          };
        }),
      },
    };
  } catch (error: any) {
    console.error('Error in searchCupsForClaim:', error);
    return { success: false, error: 'Error buscando CUPS' };
  }
}

export async function searchInvoicesForMassClaim(
  desde: string,
  hasta: string,
  procedencia: string,
  tipoFactura: string = 'Normal'
) {
  noStore();
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autorizado' };

    const invVisibility = await getInvoiceVisibilityFilter();
    const whereClause: any = { ...invVisibility };

    if (desde || hasta) {
      whereClause.issueDate = {};
      if (desde) {
        const d = new Date(desde + 'T00:00:00.000Z');
        d.setHours(d.getHours() - 3); // Cubre 00:00 Europe/Madrid (UTC+1 / UTC+2)
        whereClause.issueDate.gte = d;
      }
      if (hasta) {
        const h = new Date(hasta + 'T23:59:59.999Z');
        h.setHours(h.getHours() + 2);
        whereClause.issueDate.lte = h;
      }
    }

    if (tipoFactura) {
      whereClause.invoiceType = { equals: tipoFactura, mode: 'insensitive' };
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: { client: true, supplyPoint: true, contract: true },
      orderBy: { issueDate: 'desc' },
      take: 5000,
    });

    const mapped = invoices.map((inv) => {
      const d = inv.invoiceData && typeof inv.invoiceData === 'object' ? (inv.invoiceData as any) : {};

      const procHasta =
        (inv.origin && inv.origin !== 'INTERNAL_ENGINE' ? inv.origin : '') ||
        d['Procedencia Hasta'] ||
        inv.origin ||
        '';
      const procDesde = d['Procedencia Desde'] || '';
      let cf = String(d['Codigo Fiscal'] || '').trim();
      if (cf.startsWith('CF ')) cf = cf.substring(3).trim();
      else if (cf.startsWith('CF')) cf = cf.substring(2).trim();

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client?.businessName || `${inv.client?.firstName || ''} ${inv.client?.lastName || ''}`.trim(),
        cups: inv.supplyPoint?.cups || '',
        contractCode: inv.contract?.contractCode || '',
        codigoFiscal: cf,
        invoiceType: inv.invoiceType || d['Tipo Factura'] || '',
        issueDate: inv.issueDate,
        procedenciaDesde: procDesde,
        procedenciaHasta: procHasta,
        billingStart: inv.billingStart,
        billingEnd: inv.billingEnd,
        totalAmount: inv.totalAmount,
        pdfUrl: inv.pdfUrl || d['pdfUrl'] || d['Factura PDF'] || '',
        origin: procHasta,
      };
    });

    const filtered = procedencia
      ? mapped.filter((i) => i.origin?.toLowerCase().includes(procedencia.toLowerCase()))
      : mapped;

    const openMap = await getOpenR1ByBaseCups(filtered.map((i) => i.cups).filter(Boolean));
    const final = filtered.map((inv) => {
      const base = inv.cups ? inv.cups.substring(0, 20).toUpperCase() : '';
      const openList = base ? openMap.get(base) || [] : [];
      const open009 = openList.find((o) => o.subtipo === '009') || openList[0] || null;
      return {
        ...inv,
        openClaim: open009,
      };
    });

    return { success: true, invoices: final };
  } catch (err: any) {
    console.error('Error in searchInvoicesForMassClaim:', err);
    return { success: false, error: err.message };
  }
}

export async function generateClaim(data: any) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const {
      mode,
      motivo,
      submotivo,
      cups,
      selectedF1Id,
      comentarios,
      csvContent,
      dynamicFields,
      fechaLectura,
      lecturas,
      attachment, // { r2Path: string, tipoDocAportado?: string }
      registerInErp = true,
      destinoOverride,
    } = data;

    // Resolver empresa/comercializadora por defecto (marca activa en cookie o asignada al usuario)
    const cookieStore = await cookies();
    const activeBrandCookie = cookieStore.get('active-brand')?.value;
    let fallbackBrand = activeBrandCookie
      ? await prisma.brand.findUnique({ where: { id: activeBrandCookie }, include: { company: true } })
      : null;
    if (!fallbackBrand && session.user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { brand: { include: { company: true } } },
      });
      fallbackBrand = dbUser?.brand || null;
    }

    const buildR1Xml = async (claimCups: string | undefined, claimMotivo: string, claimSubmotivo: string, f1Id?: string) => {
      const now = new Date();
      const formattedDate = formatMadridDateTime(now);
      const limitDateObj = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const limitDate = formatMadridDate(limitDateObj);

      const code = generate12DigitSolicitudCode();

      const tipo = claimMotivo ? claimMotivo.split('-')[0].trim().padStart(2, '0') : '';
      const subtipo = claimSubmotivo ? claimSubmotivo.split('-')[0].trim().padStart(3, '0') : '';

      const rawCupsTrimmed = (claimCups || '').trim().toUpperCase();
      const cups20 = rawCupsTrimmed.substring(0, 20);

      let sp: any = null;
      if (cups20.length >= 18) {
        const supplyPoints = await prisma.supplyPoint.findMany({
          where: { cups: { startsWith: cups20, mode: 'insensitive' } },
          include: {
            client: { include: { brand: { include: { company: true } } } },
            contracts: {
              orderBy: { activationDate: 'desc' },
              include: { client: { include: { brand: { include: { company: true } } } } },
            },
          },
        });

        if (supplyPoints.length > 0) {
          sp = supplyPoints.find((s) =>
            s.contracts?.some((c) => ['ACTIVO', 'Activo', 'ACTIVE'].includes(c.status))
          );
          if (!sp) {
            let latestDate = new Date(0);
            for (const s of supplyPoints) {
              for (const c of s.contracts || []) {
                const tDate = c.terminationDate || c.expectedEndDate || c.activationDate;
                if (tDate && tDate > latestDate) {
                  latestDate = tDate;
                  sp = s;
                }
              }
            }
            if (!sp) sp = supplyPoints[0];
          }
        }
      }

      // Resolver CUPS completo de 22 caracteres si existe en BD
      const finalCups = (sp?.cups ? sp.cups.trim().toUpperCase() : rawCupsTrimmed);

      if (!finalCups && !isCupsOptionalForSubtipo(subtipo, dynamicFields)) {
        throw new Error(`El subtipo ${subtipo} requiere informar obligatoriamente un código CUPS.`);
      }

      const activeContract =
        sp?.contracts?.find((c: any) => ['ACTIVO', 'Activo', 'ACTIVE'].includes(c.status)) ||
        sp?.contracts?.[0];
      const activeClient = activeContract?.client || sp?.client || null;

      const brandRef = activeClient?.brand || fallbackBrand;
      const emisora = brandRef?.company?.codigoRee || '1713';
      const destino =
        sp?.distributorReeCode ||
        (destinoOverride && /^\d{4}$/.test(String(destinoOverride).trim()) ? String(destinoOverride).trim() : '') ||
        (finalCups && finalCups.length >= 6 ? finalCups.substring(2, 6) : '0031');

      // Dirección y datos del titular (si existe cliente o si <Cliente> es obligatorio en XSD/Campos Min)
      const omitClienteNode = !activeClient && SUBTIPOS_CLIENTE_OPCIONAL.has(subtipo);

      let province = activeClient?.billingProvince;
      let city = activeClient?.billingCity;
      let zip = activeClient?.billingPostalCode;
      let streetType = 'CL';
      let street = activeClient?.billingAddress;
      let number = '0';

      const cAirtable: any = activeClient?.airtableData || {};

      if (!zip || zip === '00000') {
        zip = cAirtable['Código Postal Titular'] || cAirtable['Código Postal Instalación'] || sp?.postalCode || '28001';
      }
      zip = zip ? String(zip).trim().padStart(5, '0') : '28001';

      if (!province || province === '00') {
        province = cAirtable['PROVINCIA SOC'] || sp?.province || '28';
      }
      if (!city || city === '000000') {
        city = cAirtable['POBLACION SOC'] || sp?.city || '28079';
      }
      if (!street || street === 'DESCONOCIDA') {
        street = cAirtable['Calle Titular'] || cAirtable['DOMICILIO SOC'] || sp?.street || sp?.address || 'SIN DATOS';
        streetType = cAirtable['Tipo de vía Titular'] || sp?.streetType || 'CL';
        number = cAirtable['Número Titular'] !== undefined ? String(cAirtable['Número Titular']) : sp?.streetNumber || '0';
      }

      const normProvincia = normalizeProvincia(zip || '');
      const rawMuni = normalizeMunicipio(zip || '', city || '');
      const normMunicipio = rawMuni === '000' ? '00000' : `${normProvincia}${rawMuni}`;
      const normTipoVia = normalizeTipoVia(streetType);

      let clienteXmlBlock = '';
      if (!omitClienteNode) {
        const vat = (activeClient?.vatNumber || '00000000T').trim().toUpperCase();
        const isCif = /^[ABCDEFGHJNPQRSUVW]/i.test(vat);
        const tipoIdentificador = /^[XYZ]\d{7}[A-Z]$/.test(vat)
          ? 'NE'
          : /^(\d{8}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]|[KLM]\d{7}[A-Z])$/.test(vat)
            ? 'NI'
            : 'PS';
        const tipoPersona = isCif ? 'J' : 'F';

        let xmlNombre = '';
        if (tipoPersona === 'J') {
          const razonSocial =
            activeClient?.businessName ||
            `${activeClient?.firstName || ''} ${activeClient?.lastName || ''}`.trim() ||
            'DESCONOCIDO';
          xmlNombre = `<RazonSocial>${removeAccentsAndEscape(razonSocial)}</RazonSocial>`;
        } else {
          const nombrePila = activeClient?.firstName || activeClient?.businessName || 'DESCONOCIDO';
          const primerApellido = activeClient?.lastName || 'DESCONOCIDO';
          const segundoApellido = activeClient?.lastName2 || '';

          xmlNombre = `<NombreDePila>${removeAccentsAndEscape(nombrePila)}</NombreDePila>\n<PrimerApellido>${removeAccentsAndEscape(primerApellido)}</PrimerApellido>`;
          if (segundoApellido.trim()) {
            xmlNombre += `\n<SegundoApellido>${removeAccentsAndEscape(segundoApellido.trim())}</SegundoApellido>`;
          }
        }

        const phone = cleanPhone(activeClient?.contactPhone, '900000000');

        clienteXmlBlock = `\n<Cliente>
<IdCliente>
<TipoIdentificador>${tipoIdentificador}</TipoIdentificador>
<Identificador>${escapeXml(vat)}</Identificador>
<TipoPersona>${tipoPersona}</TipoPersona>
</IdCliente>
<Nombre>
${xmlNombre}
</Nombre>
<Telefono>
<PrefijoPais>34</PrefijoPais>
<Numero>${phone}</Numero>
</Telefono>
<IndicadorTipoDireccion>F</IndicadorTipoDireccion>
<Direccion>
<Pais>ESPAÑA</Pais>
<Provincia>${normProvincia}</Provincia>
<Municipio>${normMunicipio}</Municipio>
<CodPostal>${zip}</CodPostal>
<Via>
<TipoVia>${normTipoVia}</TipoVia>
<Calle>${removeAccentsAndEscape(street || '').substring(0, 30)}</Calle>
<NumeroFinca>${escapeXml(number)}</NumeroFinca>
</Via>
</Direccion>
</Cliente>`;
      }

      const companyContact =
        brandRef?.company?.contactPerson || brandRef?.contactPerson || 'RESPONSABLE DE RECLAMACIONES';
      const companyPhone = cleanPhone(brandRef?.company?.phone || brandRef?.phone, '900000000');
      const companyEmail =
        brandRef?.company?.email || brandRef?.email || 'reclamaciones@comercializadora.com';

      let numFacturaAtrXml = '';
      if (f1Id) {
        const f1 = await prisma.f1Invoice.findFirst({
          where: {
            OR: [{ id: f1Id }, { numeroFactura: f1Id }],
          },
        });
        if (f1 && f1.numeroFactura) {
          numFacturaAtrXml = `\n<NumFacturaATR>${escapeXml(f1.numeroFactura)}</NumFacturaATR>`;
        } else {
          numFacturaAtrXml = `\n<NumFacturaATR>${escapeXml(f1Id)}</NumFacturaATR>`;
        }
      } else if (dynamicFields && dynamicFields['NUM FACTURA ATR']) {
        numFacturaAtrXml = `\n<NumFacturaATR>${escapeXml(dynamicFields['NUM FACTURA ATR'])}</NumFacturaATR>`;
      }

      let lecturasXml = '';
      if (lecturas) {
        const periodos = Object.keys(lecturas).filter((k) => lecturas[k] !== '' && lecturas[k] !== null && lecturas[k] !== undefined);
        if (periodos.length > 0) {
          lecturasXml += '\n<LecturasAportadas>';
          for (const p of periodos) {
            const pNum = p.replace('P', '');
            // Regla 189 (B): mantener 91..96 intacto para periodos TD
            const codPeriodo = `9${pNum}`;
            lecturasXml += `\n<LecturaAportada>\n<Integrador>AE</Integrador>\n<CodigoPeriodoDH>${codPeriodo}</CodigoPeriodoDH>\n<LecturaPropuesta>${escapeXml(lecturas[p])}</LecturaPropuesta>\n</LecturaAportada>`;
          }
          lecturasXml += '\n</LecturasAportadas>';
        }
      }

      const contactoXml = `\n<Contacto>\n<PersonaDeContacto>${escapeXml(companyContact)}</PersonaDeContacto>\n<Telefono>\n<PrefijoPais>34</PrefijoPais>\n<Numero>${escapeXml(companyPhone)}</Numero>\n</Telefono>\n<CorreoElectronico>${escapeXml(companyEmail)}</CorreoElectronico>\n</Contacto>`;

      const XSD_ORDER = [
        'NumExpedienteAcometida', 'NumExpedienteFraude', 'FechaIncidente', 'NumFacturaATR',
        'TipoConceptoFacturado', 'FechaLectura', 'TipoDHEdM', 'CAU', 'LecturasAportadas',
        'DisconformidadAutoconsumo', 'CodigoIncidencia', 'CodigoSolicitud', 'ParametroContratacion',
        'ConceptoDisconformidad', 'TipoDeAtencionIncorrecta', 'MotivoConsulta', 'IBAN',
        'Contacto', 'CodigoSolicitudReclamacion', 'FechaDesde', 'FechaHasta', 'ImporteReclamado',
        'UbicacionIncidencia',
      ];

      const uiToXsdMapping: Record<string, string> = {
        'SOL. NUEVO SUMINISTRO': 'NumExpedienteAcometida',
        'NUMERO EXPEDIENTE FRAUDE': 'NumExpedienteFraude',
        'FECHA INCIDENTE': 'FechaIncidente',
        'TIPO CONCEPTO FACTURADO': 'TipoConceptoFacturado',
        'CAU': 'CAU',
        'TIPO DISCONFORME AUTOCONSUMO': 'DisconformidadAutoconsumo',
        'CODIGO INCIDENCIA': 'CodigoIncidencia',
        'CODIGO SOLICITUD': 'CodigoSolicitud',
        'CONCEPTO CONTRATACION': 'ParametroContratacion',
        'TIPO ATENCION INCORRECTA': 'TipoDeAtencionIncorrecta',
        'MOTIVO CONSULTA': 'MotivoConsulta',
        'IBAN': 'IBAN',
        'COD SOLICITUD RECLAMACION ANTERIOR': 'CodigoSolicitudReclamacion',
        'FECHA DESDE': 'FechaDesde',
        'FECHA HASTA': 'FechaHasta',
        'IMPORTE RECLAMADO': 'ImporteReclamado',
        'UBICACION INCIDENCIA': 'UbicacionIncidencia',
      };

      const variableDetalleElements: Record<string, string> = {};

      if (numFacturaAtrXml) {
        variableDetalleElements['NumFacturaATR'] = numFacturaAtrXml.trim();
      }
      if (lecturasXml) {
        variableDetalleElements['LecturasAportadas'] = lecturasXml.trim();
      }
      if (fechaLectura) {
        variableDetalleElements['FechaLectura'] = `<FechaLectura>${escapeXml(fechaLectura)}</FechaLectura>`;
      }
      variableDetalleElements['Contacto'] = contactoXml.trim();

      if (dynamicFields) {
        for (const [key, value] of Object.entries(dynamicFields)) {
          if (value && typeof value === 'string' && value.trim() !== '') {
            if (key === 'NUM FACTURA ATR' || key === 'LECTURA' || key === 'FECHA LECTURA') continue;

            const xsdTag = uiToXsdMapping[key];
            if (xsdTag) {
              if (xsdTag === 'DisconformidadAutoconsumo') {
                variableDetalleElements[xsdTag] = `<DisconformidadAutoconsumo>\n<TipoDisconformidadAutoconsumo>${escapeXml(value)}</TipoDisconformidadAutoconsumo>\n</DisconformidadAutoconsumo>`;
              } else if (xsdTag === 'UbicacionIncidencia') {
                variableDetalleElements[xsdTag] = `<UbicacionIncidencia>\n<DesUbicacionIncidencia>${removeAccentsAndEscape(value).substring(0, 45)}</DesUbicacionIncidencia>\n<Provincia>${normProvincia}</Provincia>\n<Municipio>${normMunicipio}</Municipio>\n<CodPostal>${zip}</CodPostal>\n</UbicacionIncidencia>`;
              } else {
                variableDetalleElements[xsdTag] = `<${xsdTag}>${escapeXml(value.trim())}</${xsdTag}>`;
              }
            } else {
              const normalizedKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const xmlTag = normalizedKey
                .split(' ')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join('');
              if (XSD_ORDER.includes(xmlTag)) {
                variableDetalleElements[xmlTag] = `<${xmlTag}>${escapeXml(value.trim())}</${xmlTag}>`;
              }
            }
          }
        }
      }

      let variablesDetalleReclamacionXml = '\n<VariableDetalleReclamacion>';
      for (const tag of XSD_ORDER) {
        if (variableDetalleElements[tag]) {
          variablesDetalleReclamacionXml += `\n${variableDetalleElements[tag]}`;
        }
      }
      variablesDetalleReclamacionXml += '\n</VariableDetalleReclamacion>';

      // Regla 189 (C): omitir <CUPS> en <CabeceraReclamacion> si no aplica o está vacío
      const cupsXmlLine = finalCups ? `\n<CUPS>${escapeXml(finalCups)}</CUPS>` : '';

      // Reglas 52, 192 y 193: Documentación adjunta <RegistrosDocumento> mediante endpoint seguro CNMC
      let registrosDocXml = '';
      if (attachment?.r2Path && typeof attachment.r2Path === 'string' && attachment.r2Path.trim() !== '') {
        const cleanR2Path = attachment.r2Path.replace(/^\/+/, '').trim();
        const tipoDoc = (attachment.tipoDocAportado || '04').trim().padStart(2, '0');
        const cnmcUser = process.env.CNMC_DOC_USER || 'AED-CNMC';
        const cnmcPassRaw = process.env.CNMC_DOC_PASSWORD || 'AED#2024Doc';
        const cnmcUrl = `https://ultra.sp-energia.com/api/cnmc/document?file=${encodeURIComponent(cleanR2Path).replace(/%2F/g, '/')}&user=${encodeURIComponent(cnmcUser)}&password=${encodeURIComponent(cnmcPassRaw)}`;
        registrosDocXml = `\n<RegistrosDocumento>\n<RegistroDoc>\n<TipoDocAportado>${escapeXml(tipoDoc)}</TipoDocAportado>\n<DireccionUrl>${escapeXml(cnmcUrl)}</DireccionUrl>\n</RegistroDoc>\n</RegistrosDocumento>`;
      }

      // Regla 189 (C): omitir <Comentarios> si está vacío o solo contiene espacios
      const trimmedComentarios = (comentarios || '').trim().substring(0, 4000);
      const comentariosXmlLine = trimmedComentarios ? `\n<Comentarios>${escapeXml(trimmedComentarios)}</Comentarios>` : '';

      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<MensajeReclamacionPeticion xmlns="http://localhost/elegibilidad">
<CabeceraReclamacion>
<CodigoREEEmpresaEmisora>${emisora}</CodigoREEEmpresaEmisora>
<CodigoREEEmpresaDestino>${destino}</CodigoREEEmpresaDestino>
<CodigoDelProceso>R1</CodigoDelProceso>
<CodigoDePaso>01</CodigoDePaso>
<CodigoDeSolicitud>${code}</CodigoDeSolicitud>
<SecuencialDeSolicitud>01</SecuencialDeSolicitud>
<FechaSolicitud>${formattedDate}</FechaSolicitud>${cupsXmlLine}
</CabeceraReclamacion>
<SolicitudReclamacion>
<DatosSolicitud>
<Tipo>${tipo}</Tipo>
<Subtipo>${subtipo}</Subtipo>
<FechaLimite>${limitDate}</FechaLimite>
<Prioritario>S</Prioritario>
</DatosSolicitud>
<VariablesDetalleReclamacion>${variablesDetalleReclamacionXml}
</VariablesDetalleReclamacion>${clienteXmlBlock}
<TipoReclamante>06</TipoReclamante>${comentariosXmlLine}${registrosDocXml}
</SolicitudReclamacion>
</MensajeReclamacionPeticion>`;

      const stdFileName = `${code}_01_${finalCups || 'SINCUPS'}_${emisora}_R1_01.xml`;
      return { xml: xmlContent, fileName: stdFileName, codigoSolicitud: code, finalCups };
    };

    // Helper para registrar en ERP (R2 + SwitchingEvent) en lotes paralelos de 10
    const registerBatchInErp = async (items: Array<{ xml: string; fileName: string }>): Promise<number> => {
      if (!registerInErp || items.length === 0) return 0;
      let registered = 0;
      const BATCH_SIZE = 10;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const chunk = items.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          chunk.map((it) => ingestXmlStringInternal(it.xml, it.fileName))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value?.success) registered++;
        }
      }
      return registered;
    };

    if (mode === 'Individual') {
      const built = await buildR1Xml(cups, motivo, submotivo, selectedF1Id);
      const registeredCount = await registerBatchInErp([{ xml: built.xml, fileName: built.fileName }]);
      const base64 = Buffer.from(built.xml, 'utf-8').toString('base64');
      return {
        success: true,
        isZip: false,
        fileName: built.fileName,
        fileContent: base64,
        registeredCount,
        codigoSolicitud: built.codigoSolicitud,
      };
    } else if (mode === 'Masiva' && csvContent) {
      const lines = csvContent.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l);
      const rows = lines.slice(1);

      const zip = new PizZip();
      const generatedItems: Array<{ xml: string; fileName: string }> = [];

      for (const row of rows) {
        const [c, codigoFiscal] = row.split(';').map((s: string) => s?.trim());
        if (!c) continue;
        const built = await buildR1Xml(c, motivo, submotivo, codigoFiscal);
        zip.file(built.fileName, built.xml);
        generatedItems.push({ xml: built.xml, fileName: built.fileName });
      }

      if (generatedItems.length === 0) {
        return { success: false, error: 'El CSV no contiene filas válidas con CUPS' };
      }

      const registeredCount = await registerBatchInErp(generatedItems);
      const zipBase64 = zip.generate({ type: 'base64' });
      return {
        success: true,
        isZip: true,
        fileName: `Reclamaciones_Masivas_CSV_${Date.now()}.zip`,
        fileContent: zipBase64,
        generatedCount: generatedItems.length,
        registeredCount,
      };
    } else if (mode === 'Masiva' && data.invoiceIds && Array.isArray(data.invoiceIds) && data.invoiceIds.length > 0) {
      const zip = new PizZip();
      const generatedItems: Array<{ xml: string; fileName: string }> = [];

      const invVisibility = await getInvoiceVisibilityFilter();
      const invoices = await prisma.invoice.findMany({
        where: { ...invVisibility, id: { in: data.invoiceIds } },
        include: { supplyPoint: true },
      });

      for (const inv of invoices) {
        if (!inv.supplyPoint?.cups) continue;

        let f1IdToUse = '';

        if (inv.invoiceData && typeof inv.invoiceData === 'object') {
          const d = inv.invoiceData as any;
          if (d['Codigo Fiscal']) {
            let cf = String(d['Codigo Fiscal']).trim();
            if (cf.startsWith('CF ')) cf = cf.substring(3).trim();
            else if (cf.startsWith('CF')) cf = cf.substring(2).trim();
            f1IdToUse = cf;
          }
        }

        if (!f1IdToUse && inv.billingEnd) {
          const f1 = await prisma.f1Invoice.findFirst({
            where: {
              supplyPointId: inv.supplyPointId,
              fechaFin: {
                gte: new Date(inv.billingEnd.getTime() - 2 * 24 * 60 * 60 * 1000),
                lte: new Date(inv.billingEnd.getTime() + 2 * 24 * 60 * 60 * 1000),
              },
            },
            orderBy: { fechaFin: 'desc' },
          });
          if (f1) {
            f1IdToUse = f1.id;
          }
        }

        const built = await buildR1Xml(inv.supplyPoint.cups, motivo, submotivo, f1IdToUse);
        zip.file(built.fileName, built.xml);
        generatedItems.push({ xml: built.xml, fileName: built.fileName });
      }

      if (generatedItems.length === 0) {
        return { success: false, error: 'No se pudieron generar reclamaciones para las facturas seleccionadas' };
      }

      const registeredCount = await registerBatchInErp(generatedItems);
      const zipBase64 = zip.generate({ type: 'base64' });
      return {
        success: true,
        isZip: true,
        fileName: `Reclamaciones_Masivas_Facturas_${Date.now()}.zip`,
        fileContent: zipBase64,
        generatedCount: generatedItems.length,
        registeredCount,
      };
    } else if (mode === 'Masiva' && data.cupsIds && Array.isArray(data.cupsIds) && data.cupsIds.length > 0) {
      const zip = new PizZip();
      const generatedItems: Array<{ xml: string; fileName: string }> = [];

      for (const targetCups of data.cupsIds) {
        if (!targetCups) continue;
        const built = await buildR1Xml(targetCups, motivo, submotivo);
        zip.file(built.fileName, built.xml);
        generatedItems.push({ xml: built.xml, fileName: built.fileName });
      }

      const registeredCount = await registerBatchInErp(generatedItems);
      const zipBase64 = zip.generate({ type: 'base64' });
      return {
        success: true,
        isZip: true,
        fileName: `Reclamaciones_Masivas_Retrasos_${Date.now()}.zip`,
        fileContent: zipBase64,
        generatedCount: generatedItems.length,
        registeredCount,
      };
    }

    return { success: false, error: 'Modo no soportado o falta seleccionar datos (CSV / Facturas / CUPS)' };
  } catch (error: any) {
    console.error('Error in generateClaim:', error);
    return { success: false, error: error.message || 'Error al generar la reclamación' };
  }
}

export async function searchCupsWithBillingDelay(minDays: number = 45) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'No autorizado' };

    const spFilter = await getSupplyPointVisibilityFilter();

    // Buscar CUPS con contratos relevantes respetando visibilidad multi-marca (Regla 32 y 96)
    const supplyPoints = await prisma.supplyPoint.findMany({
      where: {
        ...spFilter,
        contracts: {
          some: { status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'BAJA', 'Baja', 'FINALIZADO', 'Finalizado'] } },
        },
      },
      include: {
        client: { select: { businessName: true, firstName: true, lastName: true, vatNumber: true, airtableData: true } },
        contracts: {
          where: { status: { in: ['ACTIVO', 'Activo', 'ACTIVE', 'BAJA', 'Baja', 'FINALIZADO', 'Finalizado'] } },
          select: { contractCode: true, activationDate: true, terminationDate: true, expectedEndDate: true, status: true },
          orderBy: { activationDate: 'desc' },
        },
      },
    });

    if (supplyPoints.length === 0) {
      return { success: true, data: [] };
    }

    // Consolidar SupplyPoints clonados por CUPS base de 20 caracteres (Regla 21)
    const groupedByBaseCups = new Map<
      string,
      {
        primarySp: (typeof supplyPoints)[number];
        allContracts: Array<(typeof supplyPoints)[number]['contracts'][number]>;
        spIds: string[];
      }
    >();

    for (const sp of supplyPoints) {
      if (!sp.cups || sp.cups.startsWith('CUPS_MOCK')) continue;
      const baseCups = sp.cups.substring(0, 20).toUpperCase();
      const existing = groupedByBaseCups.get(baseCups);
      const hasActive = sp.contracts.some((c) => ['ACTIVO', 'Activo', 'ACTIVE'].includes(c.status));

      if (!existing) {
        groupedByBaseCups.set(baseCups, {
          primarySp: sp,
          allContracts: [...sp.contracts],
          spIds: [sp.id],
        });
      } else {
        existing.spIds.push(sp.id);
        existing.allContracts.push(...sp.contracts);
        if (hasActive || (sp.cups.length === 22 && existing.primarySp.cups.length < 22)) {
          existing.primarySp = sp;
        }
      }
    }

    const allSpIds = supplyPoints.map((s) => s.id);

    // 1) Facturas emitidas en ERP (Invoice.billingEnd)
    const invoices = await prisma.invoice.findMany({
      where: {
        supplyPointId: { in: allSpIds },
        billingEnd: { not: null },
      },
      select: { billingEnd: true, supplyPoint: { select: { cups: true } } },
    });

    // 2) Facturas F1 recibidas de Distribuidora (F1Invoice.fechaFin) — evita reclamar retraso a distribuidora si ya envió F1
    const f1Invoices = await prisma.f1Invoice.findMany({
      where: {
        supplyPointId: { in: allSpIds },
        fechaFin: { not: null },
      },
      select: { fechaFin: true, supplyPoint: { select: { cups: true } } },
    });

    const latestErpByCups = new Map<string, Date>();
    for (const inv of invoices) {
      if (inv.supplyPoint?.cups && inv.billingEnd) {
        const base = inv.supplyPoint.cups.substring(0, 20).toUpperCase();
        const dt = new Date(inv.billingEnd);
        const prev = latestErpByCups.get(base);
        if (!prev || dt > prev) latestErpByCups.set(base, dt);
      }
    }

    const latestF1ByCups = new Map<string, Date>();
    for (const f1 of f1Invoices) {
      if (f1.supplyPoint?.cups && f1.fechaFin) {
        const base = f1.supplyPoint.cups.substring(0, 20).toUpperCase();
        const dt = new Date(f1.fechaFin);
        const prev = latestF1ByCups.get(base);
        if (!prev || dt > prev) latestF1ByCups.set(base, dt);
      }
    }

    const openMap = await getOpenR1ByBaseCups(Array.from(groupedByBaseCups.keys()));

    const results = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const [baseCups, entry] of groupedByBaseCups.entries()) {
      const sp = entry.primarySp;
      const sortedContracts = entry.allContracts
        .filter((c) => c.activationDate)
        .sort((a, b) => new Date(b.activationDate!).getTime() - new Date(a.activationDate!).getTime());

      const latestContract = sortedContracts[0];
      if (!latestContract || !latestContract.activationDate) continue;

      let effectiveStartDate = new Date(latestContract.activationDate);
      let effectiveEndDate: Date | null = null;

      if (!['ACTIVO', 'Activo', 'ACTIVE'].includes(latestContract.status)) {
        effectiveEndDate = latestContract.terminationDate || latestContract.expectedEndDate || null;
      }

      // Encadenar contratos contiguos (incluyendo renovaciones/modificaciones entre clones)
      let currentStart = new Date(effectiveStartDate);
      for (let i = 1; i < sortedContracts.length; i++) {
        const prevContract = sortedContracts[i];
        if (!prevContract.activationDate) continue;
        const prevEnd = prevContract.terminationDate || prevContract.expectedEndDate;
        if (!prevEnd) break;
        const diffDays = (currentStart.getTime() - new Date(prevEnd).getTime()) / (1000 * 3600 * 24);
        if (diffDays <= 2 && diffDays >= -2) {
          currentStart = new Date(prevContract.activationDate);
        } else {
          break;
        }
      }
      effectiveStartDate = currentStart;

      // Tomar la fecha más reciente entre Factura ERP y F1 recibida de Distribuidora
      const erpEnd = latestErpByCups.get(baseCups) || null;
      const f1End = latestF1ByCups.get(baseCups) || null;
      let latestBillingEnd: Date | null = null;
      let fuenteUltimaFactura: 'ERP' | 'F1' | 'ALTA' = 'ALTA';

      if (erpEnd && f1End) {
        if (f1End > erpEnd) {
          latestBillingEnd = f1End;
          fuenteUltimaFactura = 'F1';
        } else {
          latestBillingEnd = erpEnd;
          fuenteUltimaFactura = 'ERP';
        }
      } else if (f1End) {
        latestBillingEnd = f1End;
        fuenteUltimaFactura = 'F1';
      } else if (erpEnd) {
        latestBillingEnd = erpEnd;
        fuenteUltimaFactura = 'ERP';
      }

      let lastBilledDate: Date;
      if (latestBillingEnd && latestBillingEnd >= effectiveStartDate) {
        lastBilledDate = new Date(latestBillingEnd);
      } else {
        lastBilledDate = new Date(effectiveStartDate.getTime() - 24 * 3600 * 1000);
        fuenteUltimaFactura = 'ALTA';
      }

      lastBilledDate.setHours(0, 0, 0, 0);

      if (effectiveEndDate) {
        const endNorm = new Date(effectiveEndDate);
        endNorm.setHours(0, 0, 0, 0);
        if (lastBilledDate >= endNorm) {
          continue;
        }
      }

      let delayDays = Math.floor((now.getTime() - lastBilledDate.getTime()) / (1000 * 3600 * 24));
      if (sp.isBimonthly) {
        delayDays -= 30;
      }

      if (delayDays >= minDays) {
        const openList = openMap.get(baseCups) || [];
        const open006 = openList.find((o) => o.subtipo === '006') || openList[0] || null;

        results.push({
          cupsId: sp.id,
          cups: sp.cups,
          titular: sp.client.businessName || `${sp.client.firstName || ''} ${sp.client.lastName || ''}`.trim(),
          tarifa: (sp as any).tariff || (sp.client.airtableData as any)?.TARIFA || '',
          contrato: latestContract.contractCode || 'N/A',
          inicioPeriodoContinuo: effectiveStartDate.toISOString(),
          ultimoDiaFacturado: lastBilledDate.toISOString(),
          fuenteUltimaFactura,
          diasRetraso: delayDays,
          openClaim: open006,
        });
      }
    }

    results.sort((a, b) => b.diasRetraso - a.diasRetraso);
    return { success: true, data: results };
  } catch (error: any) {
    console.error('Error en searchCupsWithBillingDelay:', error);
    return { success: false, error: 'Error al calcular retrasos' };
  }
}
