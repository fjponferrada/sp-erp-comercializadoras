import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseMadridEndOfDay, parseMadridStartOfDay } from '@/lib/ppaEngine';
import {
  encodeIso88591Xml,
  escapeXmlEntities,
  isPhysicalPersonVat,
  logRegulatoryGeneration,
  mapCnaeToEscilaSector,
  requireRegulatoryContext,
  resolveIneProvinceCode,
} from '@/lib/regulacionServer';

interface EscilaSectorBucket {
  idCnae: string;
  descCnae: string;
  activeEmpresas: Set<string>;
  activeCups: Set<string>;
  invoicedCups: Set<string>;
  energiaMwh: number;
}

interface EscilaProvinceBucket {
  codigo: string;
  desc: string;
  cnaes: Record<string, EscilaSectorBucket>;
}

function cupsRoot20(cups?: string | null): string {
  return (cups || '').trim().toUpperCase().slice(0, 20);
}

function formatEscilaEnergia(val: number): string {
  const rounded = Math.abs(val) < 0.005 ? 0 : Number(val.toFixed(2));
  const sign = rounded < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(rounded).toFixed(2).split('.');
  return `${sign}${intPart.padStart(8, '0')},${decPart}`;
}

function normalizeSignedInvoiceMwh(
  totalMWh: number,
  totalAmount: number,
  invoiceType?: string | null,
  isAbonoStatus = false
): number {
  const t = (invoiceType || '').toUpperCase().trim();
  const isAbono =
    isAbonoStatus || t === 'A' || t === 'AR' || t === 'S' || t === 'R_NEG' || totalAmount < 0;
  if (isAbono && totalMWh > 0 && totalAmount < 0) {
    return -totalMWh;
  }
  return totalMWh;
}

export async function GET(req: Request) {
  try {
    const authRes = await requireRegulatoryContext();
    if (!authRes.ok) return authRes.response;
    const { ctx } = authRes;

    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get('year');
    const isPreview = searchParams.get('preview') === 'true';

    if (!yearStr || !/^\d{4}$/.test(yearStr)) {
      return NextResponse.json({ error: 'Falta o es inválido el parámetro year (AAAA)' }, { status: 400 });
    }
    const year = parseInt(yearStr, 10);

    const startDate = parseMadridStartOfDay(`${year}-01-01`);
    const endDate = parseMadridEndOfDay(`${year}-12-31`);

    const [invoices, internalInvoices, activeYearEndContracts] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          OR: [
            { companyId: ctx.companyId },
            { companyId: null, client: { brand: { companyId: ctx.companyId } } },
          ],
          billingEnd: { gte: startDate, lte: endDate },
        },
        include: {
          supplyPoint: {
            select: {
              id: true,
              cups: true,
              postalCode: true,
              sipsPostalCode: true,
              province: true,
              tariff: true,
              sipsTariff: true,
              cnae: true,
              sipsCnae: true,
            },
          },
          client: {
            select: {
              id: true,
              vatNumber: true,
              cnae: true,
              billingPostalCode: true,
              billingProvince: true,
            },
          },
        },
      }),
      prisma.internalInvoice.findMany({
        where: {
          OR: [
            { companyId: ctx.companyId },
            { companyId: null, client: { brand: { companyId: ctx.companyId } } },
          ],
          status: { in: ['EMITIDA', 'ABONO'] },
          hidden: false,
          billingEnd: { gte: startDate, lte: endDate },
        },
        include: {
          supplyPoint: {
            select: {
              id: true,
              cups: true,
              postalCode: true,
              sipsPostalCode: true,
              province: true,
              tariff: true,
              sipsTariff: true,
              cnae: true,
              sipsCnae: true,
            },
          },
          client: {
            select: {
              id: true,
              vatNumber: true,
              cnae: true,
              billingPostalCode: true,
              billingProvince: true,
            },
          },
        },
      }),
      prisma.contract.findMany({
        where: {
          OR: [
            { brand: { companyId: ctx.companyId } },
            { client: { brand: { companyId: ctx.companyId } } },
          ],
          status: { notIn: ['BORRADOR', 'CANCELADO', 'RECHAZADO', 'ANULADO'] },
          activationDate: { not: null, lte: endDate },
          AND: [
            {
              OR: [
                { terminationDate: null },
                { terminationDate: { gt: endDate } },
              ],
            },
          ],
        },
        select: {
          supplyPoint: {
            select: {
              cups: true,
              postalCode: true,
              sipsPostalCode: true,
              province: true,
              tariff: true,
              sipsTariff: true,
              cnae: true,
              sipsCnae: true,
            },
          },
          client: {
            select: {
              id: true,
              vatNumber: true,
              cnae: true,
              billingPostalCode: true,
              billingProvince: true,
            },
          },
        },
      }),
    ]);

    // Conjunto de CUPS (raíz 20 caracteres) activos a 31 de diciembre del ejercicio
    const activeCupsAtDec31 = new Set<string>();
    for (const ac of activeYearEndContracts) {
      const root = cupsRoot20(ac.supplyPoint?.cups);
      if (root) activeCupsAtDec31.add(root);
    }

    const provincesMap: Record<string, EscilaProvinceBucket> = {};
    const unmappedCupsSet = new Set<string>();
    const fallbackProvCupsSet = new Set<string>();

    const ensureBucket = (
      sp: {
        cups: string;
        postalCode?: string | null;
        sipsPostalCode?: string | null;
        province?: string | null;
        tariff?: string | null;
        sipsTariff?: string | null;
        cnae?: string | null;
        sipsCnae?: string | null;
      },
      client: {
        id: string;
        vatNumber?: string | null;
        cnae?: string | null;
        billingPostalCode?: string | null;
        billingProvince?: string | null;
      }
    ): EscilaSectorBucket => {
      const prov = resolveIneProvinceCode(
        sp.postalCode || client.billingPostalCode,
        sp.sipsPostalCode,
        sp.province || client.billingProvince
      );
      if (prov.isFallback && sp.cups) fallbackProvCupsSet.add(cupsRoot20(sp.cups));

      if (!provincesMap[prov.code]) {
        provincesMap[prov.code] = {
          codigo: prov.code,
          desc: prov.name,
          cnaes: {},
        };
      }

      const sector = mapCnaeToEscilaSector({
        cnae: sp.cnae,
        sipsCnae: sp.sipsCnae,
        clientCnae: client.cnae,
        tariff: sp.tariff || sp.sipsTariff,
        vatNumber: client.vatNumber,
      });
      if (sector.isUnmappedFallback && sp.cups) {
        unmappedCupsSet.add(cupsRoot20(sp.cups));
      }

      if (!provincesMap[prov.code].cnaes[sector.idCnae]) {
        provincesMap[prov.code].cnaes[sector.idCnae] = {
          idCnae: sector.idCnae,
          descCnae: sector.descCnae,
          activeEmpresas: new Set<string>(),
          activeCups: new Set<string>(),
          invoicedCups: new Set<string>(),
          energiaMwh: 0,
        };
      }

      return provincesMap[prov.code].cnaes[sector.idCnae];
    };

    const registerActiveSupply = (
      bucket: EscilaSectorBucket,
      cups: string,
      client: { id: string; vatNumber?: string | null }
    ) => {
      const root = cupsRoot20(cups);
      if (!root || !activeCupsAtDec31.has(root)) return;
      bucket.activeCups.add(root);
      if (!isPhysicalPersonVat(client.vatNumber)) {
        const companyKey = (client.vatNumber || client.id).trim().toUpperCase();
        if (companyKey) bucket.activeEmpresas.add(companyKey);
      }
    };

    // 1. Procesar facturas definitivas (Invoice)
    const seenF1Ids = new Set<string>();
    const seenInvNumbers = new Set<string>();

    for (const inv of invoices) {
      if (inv.f1InvoiceId) seenF1Ids.add(inv.f1InvoiceId);
      if (inv.invoiceNumber) seenInvNumbers.add(inv.invoiceNumber);
      if (!inv.supplyPoint) continue;

      const bucket = ensureBucket(inv.supplyPoint, inv.client);
      const signedMwh = normalizeSignedInvoiceMwh(
        inv.totalMWh || 0,
        inv.totalAmount || 0,
        inv.invoiceType,
        false
      );
      bucket.energiaMwh += signedMwh;
      bucket.invoicedCups.add(cupsRoot20(inv.supplyPoint.cups));
      registerActiveSupply(bucket, inv.supplyPoint.cups, inv.client);
    }

    // 2. Procesar facturas internas emitidas/abono aún no volcadas a Invoice
    for (const iInv of internalInvoices) {
      if (iInv.f1InvoiceId && seenF1Ids.has(iInv.f1InvoiceId)) continue;
      if (iInv.invoiceNumber && seenInvNumbers.has(iInv.invoiceNumber)) continue;
      if (!iInv.supplyPoint) continue;

      const bucket = ensureBucket(iInv.supplyPoint, iInv.client);
      const signedMwh = normalizeSignedInvoiceMwh(
        iInv.totalMWh || 0,
        iInv.totalAmount || 0,
        iInv.invoiceType,
        iInv.status === 'ABONO'
      );
      bucket.energiaMwh += signedMwh;
      bucket.invoicedCups.add(cupsRoot20(iInv.supplyPoint.cups));
      registerActiveSupply(bucket, iInv.supplyPoint.cups, iInv.client);
    }

    // 3. Incluir también suministros activos a 31 de diciembre sin consumo facturado aún (ENERGIA_COMERCIALIZADA = 0,00)
    for (const ac of activeYearEndContracts) {
      if (!ac.supplyPoint) continue;
      const bucket = ensureBucket(ac.supplyPoint, ac.client);
      registerActiveSupply(bucket, ac.supplyPoint.cups, ac.client);
    }

    // Ordenar provincias por código INE ("01".."52") y sectores por ORDEN numérico (1..76)
    const sortedProvinces = Object.values(provincesMap)
      .map(prov => {
        const validCnaes = Object.values(prov.cnaes)
          .filter(c => c.activeCups.size > 0 || Math.abs(c.energiaMwh) >= 0.005)
          .sort((a, b) => Number(a.idCnae) - Number(b.idCnae));
        return {
          codigo: prov.codigo,
          desc: prov.desc,
          cnaes: validCnaes,
        };
      })
      .filter(prov => prov.cnaes.length > 0)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    let totalMwh = 0;
    let totalActiveCups = 0;
    const globalActiveEmpresas = new Set<string>();

    const previewProvinces = sortedProvinces.map(p => {
      let provMwh = 0;
      let provActiveCups = 0;
      const sectorRows = p.cnaes.map(c => {
        totalMwh += c.energiaMwh;
        provMwh += c.energiaMwh;
        totalActiveCups += c.activeCups.size;
        provActiveCups += c.activeCups.size;
        c.activeEmpresas.forEach(e => globalActiveEmpresas.add(e));
        return {
          idCnae: c.idCnae,
          descCnae: c.descCnae,
          numEmpresas: c.activeEmpresas.size,
          numCups: c.activeCups.size,
          invoicedCups: c.invoicedCups.size,
          energiaMwh: Number(c.energiaMwh.toFixed(2)),
          energiaFormatted: formatEscilaEnergia(c.energiaMwh),
        };
      });
      return {
        codigo: p.codigo,
        desc: p.desc,
        provMwh: Number(provMwh.toFixed(2)),
        provActiveCups,
        sectors: sectorRows,
      };
    });

    const warnings: string[] = [];
    if (unmappedCupsSet.size > 0) {
      warnings.push(
        `${unmappedCupsSet.size} suministro(s) no domésticos carecen de código CNAE en ficha/SIPS y se han clasificado bajo el código oficial ESCILA 76 ("OTROS USOS NO ESPECIFICADOS").`
      );
    }
    if (fallbackProvCupsSet.size > 0) {
      warnings.push(
        `${fallbackProvCupsSet.size} suministro(s) no tenían código postal de 5 dígitos válido; revise sus provincias antes de entregar.`
      );
    }
    if (sortedProvinces.length === 0) {
      warnings.push(`No existen facturas ni suministros activos en ${year} para ${ctx.company.name}.`);
    }

    const companySlug = (ctx.company.codigo || ctx.company.name || 'EMPRESA')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20)
      .toUpperCase();

    const filename = `ESCILA_${companySlug}_${year}.xml`;

    const summary = {
      year,
      provincias: sortedProvinces.length,
      totalMwh: Number(totalMwh.toFixed(2)),
      totalGwh: Number((totalMwh / 1000).toFixed(6)),
      activeCupsDec31: totalActiveCups,
      activeEmpresasDec31: globalActiveEmpresas.size,
      unmappedCnaeCups: unmappedCupsSet.size,
    };

    if (isPreview) {
      return NextResponse.json({
        company: {
          name: ctx.company.name,
          cif: ctx.company.cif,
          contactPerson: ctx.company.contactPerson,
          phone: ctx.company.phone,
          email: ctx.company.email,
        },
        year,
        filename,
        summary,
        warnings,
        provinces: previewProvinces,
      });
    }

    if (sortedProvinces.length === 0) {
      return NextResponse.json(
        { error: `No existen datos de actividad en ${year} para generar el XML ESCILA (LISTA_PROVINCIAS requiere al menos una provincia según el XSD).` },
        { status: 422 }
      );
    }

    const cleanCif = (ctx.company.cif || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const cleanPhone = (ctx.company.phone || '').trim().slice(0, 20);
    const cleanEmail = (ctx.company.email || '').trim().slice(0, 150);
    const cleanContact = (ctx.company.contactPerson || '').trim();

    let xml = `<?xml version='1.0' encoding='ISO-8859-1'?>\n`;
    xml += `<FORMULARIO><CABECERA><VERSION_XML>1.0.0</VERSION_XML><TIPOCUESTIONARIO>${escapeXmlEntities(ctx.company.name)}</TIPOCUESTIONARIO><TIPOCUESTIONARIOID>3</TIPOCUESTIONARIOID><ANIO>${year}</ANIO></CABECERA>`;
    xml += `<EMPRESA><CIF_VAT>${escapeXmlEntities(cleanCif)}</CIF_VAT><NOMBRE_CONTACTO>${escapeXmlEntities(cleanContact)}</NOMBRE_CONTACTO><CARGO_EMPRESA>Administrador</CARGO_EMPRESA><TELEFONO_CONTACTO>${escapeXmlEntities(cleanPhone)}</TELEFONO_CONTACTO><EMAIL_CONTACTO>${escapeXmlEntities(cleanEmail)}</EMAIL_CONTACTO></EMPRESA>`;
    xml += `<CUESTIONARIO><LISTA_PROVINCIAS>`;

    for (const prov of sortedProvinces) {
      xml += `<PROVINCIA><DESC_PROVINCIA CODIGO="${escapeXmlEntities(prov.codigo)}">${escapeXmlEntities(prov.desc)}</DESC_PROVINCIA><LISTA_CNAES>`;
      for (const cnae of prov.cnaes) {
        xml += `<CNAE><ID_CNAE CODIGO="${escapeXmlEntities(cnae.idCnae)}">${escapeXmlEntities(cnae.descCnae)}</ID_CNAE>`;
        // Omitir <NUM_EMPRESAS> cuando es 0 (minOccurs="0" en XSD y evita warning en ValidacionesAdicionalesComercializadoras)
        if (cnae.activeEmpresas.size > 0) {
          xml += `<NUM_EMPRESAS>${cnae.activeEmpresas.size}</NUM_EMPRESAS>`;
        }
        xml += `<NUM_CUPS>${cnae.activeCups.size}</NUM_CUPS>`;
        xml += `<ENERGIA_COMERCIALIZADA>${formatEscilaEnergia(cnae.energiaMwh)}</ENERGIA_COMERCIALIZADA></CNAE>`;
      }
      xml += `</LISTA_CNAES></PROVINCIA>`;
    }

    const obsText =
      'Cuando NUM_CUPS es 0, se debe a que los suministros causaron baja antes del 31 de diciembre. La ENERGIA_COMERCIALIZADA puede ser 0,00 si no registra consumo durante el periodo activo.';
    xml += `</LISTA_PROVINCIAS><OBSERVACIONES>${escapeXmlEntities(obsText)}</OBSERVACIONES></CUESTIONARIO></FORMULARIO>`;

    // Codificación binaria ISO-8859-1 real (coherente con el prólogo XML)
    const isoBytes = encodeIso88591Xml(xml);

    await logRegulatoryGeneration({
      companyId: ctx.companyId,
      category: 'MITECO',
      reportType: 'ESCILA',
      period: String(year),
      version: null,
      filename,
      generatedBy: ctx.userName,
      summary,
    });

    return new NextResponse(Buffer.from(isoBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=ISO-8859-1',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('ESCILA error:', error);
    return NextResponse.json({ error: error.message || 'Error interno generando ESCILA' }, { status: 500 });
  }
}
