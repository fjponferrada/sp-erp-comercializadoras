'use server';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { findOrUpdateSupplyPointByCups } from '@/lib/supplyPointHelper';
import { normalizeSpanishPostalCode, normalizeSpanishPostalCodeOrNull } from '@/lib/postalCode';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { fromZonedTime } from 'date-fns-tz';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

const WRITE_ALLOWED_ROLES = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'];

async function assertWritePermission() {
  const session = await auth();
  const role = (session?.user as any)?.role || 'user';
  if (!session?.user || !WRITE_ALLOWED_ROLES.includes(role)) {
    throw new Error('No tienes permisos suficientes para ejecutar esta operación.');
  }
  return session;
}

export async function parseSpanishNumberServer(v: any): Promise<number> {
  return parseSpanishNumber(v);
}

function parseSpanishNumber(v: any): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).trim();
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

function parseOptionalExcelDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;
  let d: Date;
  if (typeof val === 'number') {
    d = new Date((val - 25569) * 86400 * 1000);
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        d = new Date(`${year}-${month}-${day}T12:00:00Z`);
      } else {
        d = new Date(trimmed);
      }
    } else if (/^\d+$/.test(trimmed)) {
      d = new Date((parseInt(trimmed, 10) - 25569) * 86400 * 1000);
    } else {
      d = new Date(trimmed);
    }
  } else {
    d = new Date(val);
  }

  if (isNaN(d.getTime())) return null;
  // Normalizamos a las 12:00 UTC para evitar desfases de día por huso horario (UTC+1 / UTC+2)
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function parseExcelDate(val: any): Date {
  return parseOptionalExcelDate(val) || (() => {
    const now = new Date();
    now.setUTCHours(12, 0, 0, 0);
    return now;
  })();
}

function normalizeInvoiceType(raw: any): string {
  const s = String(raw || '').trim();
  if (!s) return 'Normal';
  const upper = s.toUpperCase();
  // Códigos oficiales CNMC Tabla 102 (TiposSencillos.xsd V3.0)
  if (upper === 'N' || upper === 'NORMAL') return 'Normal';
  if (upper === 'A' || upper === 'ABONO' || upper === 'ANULADORA') return 'Abono';
  if (upper === 'R' || upper === 'RECTIFICATIVA' || upper === 'RECTIFICADORA') return 'Rectificativa';
  if (upper === 'C' || upper === 'COMPLEMENTARIA') return 'Complementaria';
  if (upper === 'G' || upper === 'REGULARIZADORA') return 'Regularizadora';
  return s;
}

function isValidHttpUrl(url: any): boolean {
  return typeof url === 'string' && (url.trim().startsWith('http://') || url.trim().startsWith('https://'));
}

function isValidCloudPdf(url: any): boolean {
  return isValidHttpUrl(url) && !String(url).includes('airtable');
}

function resolveClientRecipientEmail(client: any): string {
  const candidate = (client?.invoiceEmail || client?.contactEmail || '').trim();
  if (!candidate) return '';
  if (candidate.toLowerCase() === 'clientes@aed-energia.com') return '';
  return candidate;
}

function resolveSenderHeader(brand: any): { from: string; replyTo?: string } {
  const brandName = brand?.name || 'Su Comercializadora';
  if (brand?.supportEmail) {
    return {
      from: `${brandName} <${brand.supportEmail}>`,
      replyTo: brand.supportEmail,
    };
  }
  return {
    from: `${brandName} <facturacion@${brand?.domain || 'aed-energia.com'}>`,
  };
}

export async function importInvoicesAction(invoicesData: any[]) {
  try {
    const session = await assertWritePermission();

    const results = {
      total: invoicesData.length,
      imported: 0,
      duplicates: 0,
      errors: [] as string[],
    };

    const insertedInvoiceNumbers: string[] = [];

    const cookieStore = await cookies();
    const cookieBrandId = cookieStore.get('active-brand')?.value;
    let activeBrandId = cookieBrandId || (session?.user as any)?.brandId;
    let activeCompanyId: string | null = null;

    if (activeBrandId) {
      const b = await prisma.brand.findUnique({ where: { id: activeBrandId } });
      if (b) activeCompanyId = b.companyId;
    }

    if (!activeBrandId || !activeCompanyId) {
      const b = await prisma.brand.findFirst();
      activeBrandId = b?.id || '';
      activeCompanyId = b?.companyId || null;
    }

    // 0. Pre-cargar facturas existentes en este lote para detección rápida O(1) respetando @@unique([invoiceNumber, companyId])
    const chunkInvoiceNumbers = Array.from(
      new Set(
        invoicesData
          .map((r) => r['Numero Factura'] || r['Número Factura'] || r['NUMERO FACTURA'])
          .filter(Boolean)
          .map((n) => String(n).trim())
      )
    );

    const existingInvoicesList = chunkInvoiceNumbers.length > 0
      ? await prisma.invoice.findMany({
          where: {
            invoiceNumber: { in: chunkInvoiceNumbers },
            OR: [
              ...(activeCompanyId ? [{ companyId: activeCompanyId }] : []),
              { client: { brandId: activeBrandId } },
            ],
          },
          select: { invoiceNumber: true },
        })
      : [];
    const existingInvoiceSet = new Set(existingInvoicesList.map((i) => i.invoiceNumber));

    // Pre-cargar también posibles facturas rectificadas referenciadas en el lote
    const rectifiedNums = Array.from(
      new Set(
        invoicesData
          .map((r) => r['Numero factura rectificada'])
          .filter(Boolean)
          .map((n) => String(n).trim())
      )
    );
    const existingRectifiedList = rectifiedNums.length > 0
      ? await prisma.invoice.findMany({
          where: {
            invoiceNumber: { in: rectifiedNums },
            OR: [
              ...(activeCompanyId ? [{ companyId: activeCompanyId }] : []),
              { client: { brandId: activeBrandId } },
            ],
          },
          select: { id: true, invoiceNumber: true },
        })
      : [];
    const rectifiedMap = new Map(existingRectifiedList.map((r) => [r.invoiceNumber, r.id]));

    // Pre-cargar Clientes del lote por CIF/NIF
    const vatSet = Array.from(
      new Set(
        invoicesData
          .map((r) => {
            const v = r['CIF'] || r['NIF'] || r['DNI'] || r['NIF/CIF'];
            return v ? String(v).trim().toUpperCase() : null;
          })
          .filter(Boolean) as string[]
      )
    );

    const existingClients = vatSet.length > 0
      ? await prisma.client.findMany({
          where: { vatNumber: { in: vatSet }, brandId: activeBrandId },
        })
      : [];
    const clientMap = new Map(existingClients.map((c) => [c.vatNumber.toUpperCase(), c]));

    // Pre-cargar Puntos de Suministro indexados por clave compuesta [clientId + CUPS20] (Reglas 21, 92, 104)
    const existingSupplyPoints = existingClients.length > 0
      ? await prisma.supplyPoint.findMany({
          where: { clientId: { in: existingClients.map((c) => c.id) } },
        })
      : [];
    const supplyPointMap = new Map<string, any>();
    for (const sp of existingSupplyPoints) {
      const spKey = `${sp.clientId}_${sp.cups.substring(0, 20).toUpperCase()}`;
      supplyPointMap.set(spKey, sp);
    }

    // Pre-cargar Contratos por código explícito CONTRATO si viene informado en el CSV
    const csvContractCodes = Array.from(
      new Set(
        invoicesData
          .map((r) => r['CONTRATO'] || r['Contrato'])
          .filter(Boolean)
          .map((c) => String(c).trim())
          .filter(Boolean)
      )
    );
    const contractsByCodeList = csvContractCodes.length > 0
      ? await prisma.contract.findMany({
          where: {
            contractCode: { in: csvContractCodes },
            OR: [{ brandId: activeBrandId }, { client: { brandId: activeBrandId } }],
          },
          orderBy: [{ version: 'desc' }, { activationDate: 'desc' }],
        })
      : [];
    const contractsByCodeMap = new Map<string, any[]>();
    for (const c of contractsByCodeList) {
      if (!c.contractCode) continue;
      const arr = contractsByCodeMap.get(c.contractCode) || [];
      arr.push(c);
      contractsByCodeMap.set(c.contractCode, arr);
    }

    for (let rowIndex = 0; rowIndex < invoicesData.length; rowIndex++) {
      const row = invoicesData[rowIndex];
      try {
        const rawInvNum = row['Numero Factura'] || row['Número Factura'] || row['NUMERO FACTURA'];
        const invoiceNumber = rawInvNum ? String(rawInvNum).trim() : '';

        const cupsRaw = row['CUPS'];
        const fullCups = cupsRaw ? String(cupsRaw).trim().toUpperCase() : '';
        const cups20 = fullCups ? fullCups.substring(0, 20) : '';

        const rawVat = row['CIF'] || row['NIF'] || row['DNI'] || row['NIF/CIF'];
        const vatNumber = rawVat ? String(rawVat).trim().toUpperCase() : '';

        if (!invoiceNumber || !cups20 || !vatNumber) {
          results.errors.push(
            `Fila ${rowIndex + 1}: Faltan datos obligatorios (Factura: "${invoiceNumber || '-'}", CUPS: "${fullCups || '-'}", CIF: "${vatNumber || '-'}")`
          );
          continue;
        }

        // Evitar duplicados en BD o dentro del mismo archivo CSV
        if (existingInvoiceSet.has(invoiceNumber)) {
          results.duplicates++;
          continue;
        }

        // 1. Buscar o crear Cliente respetando Reglas 39, 61, 68, 79 y 153
        let client = clientMap.get(vatNumber) || null;

        if (!client) {
          const tipoClienteCsv = String(row['Tipo de cliente'] || '').trim().toUpperCase();
          const isPersonaFisica =
            tipoClienteCsv === 'F' ||
            (tipoClienteCsv !== 'J' && /^[0-9XYZKL]/i.test(vatNumber));

          const rawNombre = String(row['NOMBRE/RAZON SOCIAL'] || '').trim();
          const ap1 = String(row['Primer Apellido'] || '').trim();
          const ap2 = String(row['Segundo Apellido'] || '').trim();

          let businessName = rawNombre || 'Desconocido';
          let firstName: string | null = null;
          let lastName: string | null = null;
          let lastName2: string | null = null;

          if (isPersonaFisica || ap1 || ap2) {
            firstName = rawNombre || null;
            lastName = ap1 || null;
            lastName2 = ap2 || null;
            if (ap1 && !rawNombre.toUpperCase().includes(ap1.toUpperCase())) {
              businessName = [rawNombre, ap1, ap2].filter(Boolean).join(' ') || 'Desconocido';
            } else {
              businessName = rawNombre || [ap1, ap2].filter(Boolean).join(' ') || 'Desconocido';
            }
          }

          // Nunca usar Email Emisora ni Telefono (900 averías distribuidora) como datos del cliente
          const rawClientEmail = String(row['Email Cliente'] || row['EMAIL CLIENTE'] || '').trim();
          const emitterEmail = String(row['Email Emisora'] || '').trim().toLowerCase();
          const safeContactEmail =
            rawClientEmail &&
            rawClientEmail.toLowerCase() !== emitterEmail &&
            !rawClientEmail.toLowerCase().endsWith('@aed-energia.com')
              ? rawClientEmail
              : '';

          const rawClientPhone = String(row['Telefono Cliente'] || row['Teléfono Cliente'] || row['Movil'] || '').trim();
          const safeContactPhone = rawClientPhone && !rawClientPhone.startsWith('900') ? rawClientPhone : null;

          const normalizedCpSoc = normalizeSpanishPostalCodeOrNull(row['CP SOC']);
          const normalizedCpPs = normalizeSpanishPostalCodeOrNull(row['CP PS']);
          if (normalizedCpSoc) row['CP SOC'] = normalizedCpSoc;
          if (normalizedCpPs) row['CP PS'] = normalizedCpPs;

          client = await prisma.client.create({
            data: {
              vatNumber,
              clientType: isPersonaFisica ? 'Persona física' : 'Empresa',
              businessName,
              firstName,
              lastName,
              lastName2,
              contactEmail: safeContactEmail,
              contactPhone: safeContactPhone,
              billingAddress: String(row['DOMICILIO SOC'] || row['DOMICILIO PS'] || '').trim() || null,
              billingPostalCode: normalizedCpSoc || normalizedCpPs || null,
              billingCity: String(row['POBLACION SOC'] || row['Ciudad'] || row['POBLACION PS'] || '').trim() || null,
              billingProvince: String(row['PROVINCIA SOC'] || row['Provincia'] || row['PROVINCIA PS'] || '').trim() || null,
              brandId: activeBrandId,
            },
          });
          clientMap.set(vatNumber, client);
        } else {
          if (row['CP SOC']) row['CP SOC'] = normalizeSpanishPostalCode(row['CP SOC']);
          if (row['CP PS']) row['CP PS'] = normalizeSpanishPostalCode(row['CP PS']);
        }

        // 2. Buscar o crear SupplyPoint preservando los 22 caracteres del CUPS y unicidad [CUPS20 + clientId]
        const spMapKey = `${client.id}_${cups20}`;
        let supplyPoint = supplyPointMap.get(spMapKey) || null;

        if (!supplyPoint) {
          supplyPoint = await findOrUpdateSupplyPointByCups(prisma, fullCups, client.id, {
            address: String(row['DOMICILIO PS'] || '').trim(),
            city: String(row['POBLACION PS'] || row['Ciudad'] || '').trim(),
            postalCode: normalizeSpanishPostalCode(row['CP PS'], '00000'),
            province: String(row['PROVINCIA PS'] || row['Provincia'] || '').trim(),
            tariff: String(row['Tarifa ATR'] || row['Tarifa'] || '2.0TD').trim(),
            distributorName: row['DISTRIBUIDORA'] ? String(row['DISTRIBUIDORA']).trim() : undefined,
            cnae: row['CNAE'] ? String(row['CNAE']).trim() : undefined,
            p1c: parseSpanishNumber(row['P1C'] || row['P1 Potencia Contratada']) || undefined,
            p2c: parseSpanishNumber(row['P2C'] || row['P2 Potencia Contratada']) || undefined,
            p3c: parseSpanishNumber(row['P3C'] || row['P3 Potencia Contratada']) || undefined,
            p4c: parseSpanishNumber(row['P4C'] || row['P4 Potencia Contratada']) || undefined,
            p5c: parseSpanishNumber(row['P5C'] || row['P5 Potencia Contratada']) || undefined,
            p6c: parseSpanishNumber(row['P6C'] || row['P6 Potencia Contratada']) || undefined,
          });
          if (supplyPoint) {
            supplyPointMap.set(spMapKey, supplyPoint);
          }
        }

        if (!supplyPoint) {
          results.errors.push(`Factura ${invoiceNumber}: No se pudo resolver ni crear el Punto de Suministro (${fullCups}).`);
          continue;
        }

        // 3. Fechas principales
        const rawDate =
          row['Fecha Factura'] ||
          row['FECHA FACTURA'] ||
          row['Fecha factura'] ||
          row['Fecha Cobro'] ||
          new Date().toISOString();
        const issueDate = parseExcelDate(rawDate);
        const paymentDate = parseOptionalExcelDate(row['Fecha Cobro']);

        const rawDateDesde =
          row['Desde(EA)'] ||
          row['Desde(P)'] ||
          row['Desde'] ||
          row['Fecha Desde'] ||
          row['desde'] ||
          rawDate;
        const fechaDesdeFactura = parseExcelDate(rawDateDesde);

        // 4. Vincular Contrato (1º código explícito CONTRATO, 2º potencias + ventana temporal, 3º ventana temporal, 4º último contrato del PS)
        let contract: any = null;
        const csvContractCode = String(row['CONTRATO'] || row['Contrato'] || '').trim();

        if (csvContractCode && contractsByCodeMap.has(csvContractCode)) {
          const codeMatches = contractsByCodeMap.get(csvContractCode)!;
          contract =
            codeMatches.find((record) => {
              const actDate = record.activationDate || record.signatureDate;
              const termDate = record.terminationDate;
              if (actDate && fechaDesdeFactura < actDate) return false;
              if (termDate && fechaDesdeFactura > termDate) return false;
              return true;
            }) || codeMatches[0];
        }

        if (!contract) {
          const candidateContracts = await prisma.contract.findMany({
            where: {
              supplyPointId: supplyPoint.id,
              status: { in: ['ACTIVO', 'Activo', 'EN_VIGOR', 'Finalizado', 'FINALIZADO', 'BAJA', 'Baja'] },
            },
            orderBy: [{ activationDate: 'desc' }, { version: 'desc' }],
          });

          const inputPotencias = [
            parseSpanishNumber(row['P1C'] || row['P1 Potencia Contratada']),
            parseSpanishNumber(row['P2C'] || row['P2 Potencia Contratada']),
            parseSpanishNumber(row['P3C'] || row['P3 Potencia Contratada']),
            parseSpanishNumber(row['P4C'] || row['P4 Potencia Contratada']),
            parseSpanishNumber(row['P5C'] || row['P5 Potencia Contratada']),
            parseSpanishNumber(row['P6C'] || row['P6 Potencia Contratada']),
          ];

          const comparar = (val1: any, val2: number) => {
            const n1 = parseSpanishNumber(val1);
            return Math.abs(n1 - val2) < 0.01;
          };

          for (const record of candidateContracts) {
            const potenciasOk =
              comparar(record.p1c, inputPotencias[0]) &&
              comparar(record.p2c, inputPotencias[1]) &&
              comparar(record.p3c, inputPotencias[2]) &&
              comparar(record.p4c, inputPotencias[3]) &&
              comparar(record.p5c, inputPotencias[4]) &&
              comparar(record.p6c, inputPotencias[5]);

            if (!potenciasOk) continue;
            if (record.terminationDate && record.terminationDate < fechaDesdeFactura) continue;

            contract = record;
            break;
          }

          if (!contract) {
            for (const record of candidateContracts) {
              const actDate = record.activationDate || record.signatureDate;
              const termDate = record.terminationDate;
              if (actDate && fechaDesdeFactura < actDate) continue;
              if (termDate && fechaDesdeFactura > termDate) continue;
              contract = record;
              break;
            }
          }

          if (!contract) {
            contract = candidateContracts[0] || null;
          }
        }

        // 5. Importes, Fechas de Periodo y Margen (Regla 178)
        const totalAmount = parseSpanishNumber(row['Total'] ?? row['TOTAL']);
        const subtotal1 = parseSpanishNumber(row['Subtotal 1']);
        const taxAmount = parseSpanishNumber(row['Importe Impuesto CORR'] ?? row['Importe Impuesto']);
        const taxPercentage = parseSpanishNumber(row['Impuesto (%)'] ?? '5.112696');
        const cantidadEnergia = parseSpanishNumber(
          row['Cantidad Energía Total Consumida CORR'] ?? row['Energía Total Consumida'] ?? row['Consumo']
        );
        const totalMWh = cantidadEnergia;

        const billingStartRaw = row['Desde(EA)'] || row['Desde(P)'] || row['Desde'] || row['Fecha Desde'];
        const billingEndRaw = row['Hasta(EA)'] || row['Hasta(P)'] || row['Hasta'] || row['Fecha Hasta'];
        const billingStart = parseOptionalExcelDate(billingStartRaw);
        const billingEnd = parseOptionalExcelDate(billingEndRaw);

        const margenEnergia = parseSpanishNumber(row['Margen Energia']);
        const margenFactura = parseSpanishNumber(row['Margen Factura']);
        const margenPotencia = parseSpanishNumber(row['Margen Potencia']);
        const fijoIndex = row['FIJO / INDEX'] || 'Fijo';
        const fee =
          contract && contract.fee != null
            ? contract.fee
            : parseSpanishNumber(row['Fee Index']) || parseSpanishNumber(row['FEE']) || 0;

        const baseImponibleF1 = parseSpanishNumber(row['BaseImponibleF1 CORR'] ?? row['BaseImponibleF1']);
        const tipoFactura = normalizeInvoiceType(row['Tipo Factura']);

        let baseImponibleIva = parseSpanishNumber(row['Base Imponible IVA CORR'] ?? row['Base Imponible IVA']);
        if (tipoFactura === 'Abono' && baseImponibleIva > 0) {
          baseImponibleIva = -baseImponibleIva;
        }

        let margenRelIngebau = 0;
        if (cantidadEnergia !== 0) {
          margenRelIngebau = (1000 * margenEnergia) / cantidadEnergia;
        }

        const margenFacturaCorr = (tipoFactura === 'Abono' ? -1 : 1) * margenFactura;

        let margenEstimado = 0;
        if (fijoIndex === 'Indexado') {
          margenEstimado = margenPotencia + fee * (cantidadEnergia / 1000);
        } else {
          margenEstimado = Math.abs(baseImponibleIva) - taxAmount - baseImponibleF1 - 0.09 * cantidadEnergia;
        }
        if (tipoFactura === 'Abono') {
          margenEstimado = -Math.abs(margenEstimado);
        }

        const margin = margenRelIngebau < 70 && margenRelIngebau > -70 ? margenFacturaCorr : margenEstimado;

        // 6. Enlace a factura rectificada (si aplica)
        const rectifiedInvoiceNum = row['Numero factura rectificada']
          ? String(row['Numero factura rectificada']).trim()
          : null;
        let rectifiedInvoiceId: string | null = null;
        if (rectifiedInvoiceNum) {
          rectifiedInvoiceId = rectifiedMap.get(rectifiedInvoiceNum) || null;
          if (!rectifiedInvoiceId) {
            const rect = await prisma.invoice.findFirst({
              where: { invoiceNumber: rectifiedInvoiceNum, client: { brandId: activeBrandId } },
              select: { id: true },
            });
            if (rect) {
              rectifiedInvoiceId = rect.id;
              rectifiedMap.set(rectifiedInvoiceNum, rect.id);
            }
          }
        }

        // 7. Validar URLs (ignorar rutas locales como O:/ISM/...csv en pdfUrl)
        const rawPdfCandidate = row['output_pdf'] || row['PDF'] || row['PATH'] || null;
        const validPdfUrl = isValidHttpUrl(rawPdfCandidate) ? String(rawPdfCandidate).trim() : null;

        const rawXmlCandidate = row['xmlUrl'] || row['XML'] || row['xML'] || null;
        const validXmlUrl = isValidHttpUrl(rawXmlCandidate) ? String(rawXmlCandidate).trim() : null;

        const origin = row['Procedencia Hasta']
          ? String(row['Procedencia Hasta']).trim()
          : row['Procedencia Desde']
            ? String(row['Procedencia Desde']).trim()
            : null;

        const created = await prisma.invoice.create({
          data: {
            invoiceNumber,
            invoiceType: tipoFactura,
            clientId: contract?.clientId || client.id || supplyPoint.clientId,
            companyId: activeCompanyId,
            contractId: contract?.id || null,
            supplyPointId: supplyPoint.id,
            issueDate,
            paymentDate,
            billingStart,
            billingEnd,
            origin,
            totalAmount,
            subtotal1,
            taxAmount,
            taxPercentage,
            totalMWh,
            pdfUrl: validPdfUrl,
            xmlUrl: validXmlUrl,
            rectifiedInvoiceId,
            margin,
            invoiceData: row as any,
          },
          select: { id: true, invoiceNumber: true },
        });

        existingInvoiceSet.add(invoiceNumber);
        rectifiedMap.set(created.invoiceNumber, created.id);
        insertedInvoiceNumbers.push(invoiceNumber);
        results.imported++;
      } catch (rowErr: any) {
        console.error(`Error importando fila ${rowIndex + 1}:`, rowErr);
        results.errors.push(`Fila ${rowIndex + 1}: ${rowErr.message || 'Error al guardar la factura'}`);
      }
    }

    // Auto-link de las nuevas facturas con F1 de distribuidora (con soporte de códigos CNMC V3.0 Tabla 102)
    if (insertedInvoiceNumbers.length > 0) {
      try {
        await prisma.$executeRaw`
          UPDATE "Invoice" i
          SET "f1InvoiceId" = f1.id
          FROM "F1Invoice" f1
          WHERE i."invoiceNumber" IN (${Prisma.join(insertedInvoiceNumbers)})
          AND i."f1InvoiceId" IS NULL AND (
            LTRIM(TRIM(REPLACE(REPLACE(i."invoiceData"->>'Codigo Fiscal', 'CF ', ''), 'CF', '')), '0') = LTRIM(f1."numeroFactura", '0')
            OR LTRIM(i."invoiceData"->>'Numero Factura .xml', '0') = LTRIM(CONCAT(f1."numeroFactura", '.xml'), '0')
            OR LTRIM(i."invoiceData"->>'FechaFtra_NumFtra', '0') LIKE CONCAT('%', LTRIM(f1."numeroFactura", '0'))
            OR (
              i."supplyPointId" = f1."supplyPointId"
              AND i."supplyPointId" IS NOT NULL
              AND DATE(i."billingStart") = DATE(f1."fechaInicio")
              AND DATE(i."billingEnd") = DATE(f1."fechaFin")
              AND i."billingStart" IS NOT NULL
              AND i."rectifiedInvoiceId" IS NULL
              AND (
                (i."invoiceType" = 'Abono' AND (
                   f1."numeroFactura" LIKE 'AR-%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":"S"%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":"A"%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":"AR"%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":["S"]%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":["A"]%'
                   OR f1."jsonData"::text LIKE '%"TipoFactura":["AR"]%'
                )) OR
                ((i."invoiceType" IS NULL OR i."invoiceType" != 'Abono') AND (
                   f1."numeroFactura" NOT LIKE 'AR-%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":"S"%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":"A"%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":"AR"%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":["S"]%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":["A"]%'
                   AND f1."jsonData"::text NOT LIKE '%"TipoFactura":["AR"]%'
                ))
              )
            )
          )
        `;
      } catch (err) {
        console.error('Error auto-linking invoices to F1:', err);
      }
    }

    revalidatePath('/facturas');
    return { success: true, results };
  } catch (error: any) {
    console.error('Error importando facturas:', error);
    return { success: false, error: error.message };
  }
}

function extractClientFirstName(client: any): string {
  if (client.firstName?.trim()) {
    return client.firstName.trim();
  }

  const airtableData =
    typeof client.airtableData === 'string'
      ? JSON.parse(client.airtableData)
      : client.airtableData || {};

  if (airtableData) {
    const airtableNombre = airtableData['Nombre'] || airtableData['NOMBRE'] || airtableData['nombre'];
    if (airtableNombre) return String(airtableNombre).trim();
  }

  const fullName = client.businessName || '';
  const apellidos = `${client.lastName || ''} ${client.lastName2 || ''}`.trim();

  if (apellidos && fullName.toLowerCase().includes(apellidos.toLowerCase())) {
    const escaped = apellidos.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const extracted = fullName.replace(regex, '').trim();
    if (extracted) return extracted;
  }

  return fullName || 'Cliente';
}

function generateInvoiceEmailContent(invoice: any, brand: any) {
  const brandName = brand?.name || 'Su Comercializadora';
  const brandColor = brand?.accentColor || '#4F46E5';
  const logoUrl = brand?.invoiceLogoUrl || brand?.logoUrl;
  const logoHtml = logoUrl
    ? `<div style="text-align: left; margin-top: 40px;"><img src="${logoUrl}" alt="${brandName}" style="max-height: 80px;" /></div>`
    : '';

  const clientName = extractClientFirstName(invoice.client);

  const formatDate = (date: Date) => (date ? new Date(date).toLocaleDateString('es-ES') : '');
  const billingPeriod =
    invoice.billingStart && invoice.billingEnd
      ? `, por el periodo facturado del ${formatDate(invoice.billingStart)} al ${formatDate(invoice.billingEnd)}`
      : '';

  let contactMethods = `respondiendo a este email`;
  if (brand?.whatsappPhone || brand?.phone) {
    contactMethods += `, o `;
    const methods = [];
    if (brand?.phone)
      methods.push(
        `en el <a href="tel:${brand.phone.replace(/\D/g, '')}" style="color: ${brandColor}; text-decoration: none; font-weight: bold;">${brand.phone}</a>`
      );
    if (brand?.whatsappPhone)
      methods.push(
        `por Whatsapp <a href="https://wa.me/${brand.whatsappPhone.replace(/\D/g, '')}" style="color: ${brandColor}; text-decoration: none; font-weight: bold;">haciendo clic aquí</a>`
      );
    contactMethods += methods.join(' o ');
  }

  const isAbono = invoice.invoiceType === 'Abono';
  const totalLabel = isAbono ? 'Total a tu favor' : 'Total a pagar';
  const displayAmount = isAbono ? -Math.abs(invoice.totalAmount) : invoice.totalAmount;
  const dueDateDisplay = invoice.paymentDate || invoice.dueDate;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; color: #333;">
      <p>Hola <b>${clientName}</b>,</p>
      <p>Te adjuntamos mediante enlace seguro la factura con número <b>${invoice.invoiceNumber}</b>, asociada a tu suministro <b>${invoice.supplyPoint?.cups || 'Desconocido'}</b>${billingPeriod}.</p>
      
      <div style="margin: 30px 0; padding: 20px; background: ${brandColor}15; border-left: 4px solid ${brandColor}; border-radius: 4px;">
        <p style="margin: 0 0 10px 0;"><b>${totalLabel}:</b> <span style="font-size: 1.2rem; color: ${brandColor};">${displayAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></p>
        <p style="margin: 0;"><b>Fecha de vencimiento:</b> ${dueDateDisplay ? new Date(dueDateDisplay).toLocaleDateString('es-ES') : 'A la vista'}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${invoice.pdfUrl}" style="background-color: ${brandColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver y Descargar Factura</a>
      </div>

      <p>Para cualquier duda que tengas, puedes ponerte en contacto con nosotros ${contactMethods}.</p>
      <p>Gracias por confiar en nosotros,</p>
      <p><b>El Equipo ${brandName}</b></p>
      
      ${logoHtml}
    </div>
  `;
}

export async function sendPendingInvoicesAction() {
  try {
    await assertWritePermission();
    const { getInvoiceVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getInvoiceVisibilityFilter();

    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        ...visibilityFilter,
        communicatedAt: null,
        AND: [
          { pdfUrl: { startsWith: 'http' } },
          { NOT: { pdfUrl: { contains: 'airtable' } } },
        ],
        client: {
          OR: [
            { invoiceEmail: { not: null }, NOT: { invoiceEmail: '' } },
            { contactEmail: { not: null }, NOT: { contactEmail: '' } },
          ],
        },
      },
      include: {
        client: { include: { brand: true } },
        supplyPoint: true,
      },
    });

    if (pendingInvoices.length === 0) {
      return {
        success: true,
        sentCount: 0,
        message: 'No hay facturas pendientes de envío con PDF en nube y Email válidos.',
      };
    }

    let sentCount = 0;

    for (const invoice of pendingInvoices) {
      try {
        const recipient = resolveClientRecipientEmail(invoice.client);
        if (!recipient || !isValidCloudPdf(invoice.pdfUrl)) continue;

        const brand = invoice.client.brand;
        const { from, replyTo } = resolveSenderHeader(brand);
        const emailContent = generateInvoiceEmailContent(invoice, brand);

        await resend.emails.send({
          from,
          to: recipient,
          subject: `Aviso de factura emitida - ${invoice.invoiceNumber}`,
          html: emailContent,
          ...(replyTo && { reply_to: replyTo }),
        });

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { communicatedAt: new Date() },
        });

        sentCount++;
      } catch (err) {
        console.error(`Error enviando factura ${invoice.id}:`, err);
      }
    }

    revalidatePath('/facturas');
    return { success: true, sentCount, message: `Se han enviado ${sentCount} facturas correctamente.` };
  } catch (error: any) {
    console.error('Error en envío masivo:', error);
    return { success: false, error: error.message };
  }
}

export async function forceResendInvoiceAction(invoiceId: string) {
  try {
    await assertWritePermission();

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { include: { brand: true } },
        supplyPoint: true,
      },
    });

    const recipient = resolveClientRecipientEmail(invoice?.client);
    if (!invoice || !isValidCloudPdf(invoice.pdfUrl) || !recipient) {
      return {
        success: false,
        error: 'La factura no dispone de un PDF válido en la nube o el cliente no tiene Email configurado.',
      };
    }

    const brand = invoice.client.brand;
    const { from, replyTo } = resolveSenderHeader(brand);
    const emailContent = generateInvoiceEmailContent(invoice, brand);

    await resend.emails.send({
      from,
      to: recipient,
      subject: `Aviso de factura emitida - ${invoice.invoiceNumber}`,
      html: emailContent,
      ...(replyTo && { reply_to: replyTo }),
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { communicatedAt: new Date() },
    });

    return { success: true, message: 'Factura reenviada correctamente.' };
  } catch (error: any) {
    console.error('Error forzando reenvío:', error);
    return { success: false, error: error.message };
  }
}

export async function sendSelectedInvoicesAction(invoiceIds: string[]) {
  try {
    await assertWritePermission();

    if (!invoiceIds || invoiceIds.length === 0) {
      return { success: false, error: 'No se han seleccionado facturas.' };
    }

    const { getInvoiceVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getInvoiceVisibilityFilter();

    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        ...visibilityFilter,
        id: { in: invoiceIds },
        communicatedAt: null,
        AND: [
          { pdfUrl: { startsWith: 'http' } },
          { NOT: { pdfUrl: { contains: 'airtable' } } },
        ],
      },
      include: {
        client: { include: { brand: true } },
        supplyPoint: true,
      },
    });

    const sendableInvoices = pendingInvoices.filter(
      (inv) => isValidCloudPdf(inv.pdfUrl) && Boolean(resolveClientRecipientEmail(inv.client))
    );

    if (sendableInvoices.length === 0) {
      return {
        success: true,
        sentCount: 0,
        message:
          'Las facturas seleccionadas ya fueron comunicadas, carecen de PDF válido en la nube (R2) o el cliente no tiene Email.',
      };
    }

    let sentCount = 0;

    for (const invoice of sendableInvoices) {
      try {
        const recipient = resolveClientRecipientEmail(invoice.client);
        const brand = invoice.client.brand;
        const { from, replyTo } = resolveSenderHeader(brand);
        const emailContent = generateInvoiceEmailContent(invoice, brand);

        await resend.emails.send({
          from,
          to: recipient,
          subject: `Aviso de factura emitida - ${invoice.invoiceNumber}`,
          html: emailContent,
          ...(replyTo && { reply_to: replyTo }),
        });

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { communicatedAt: new Date() },
        });

        sentCount++;
      } catch (err) {
        console.error(`Error enviando factura ${invoice.id}:`, err);
      }
    }

    revalidatePath('/facturas');
    return { success: true, sentCount, message: `Se han enviado ${sentCount} facturas correctamente.` };
  } catch (error: any) {
    console.error('Error en envío seleccionado:', error);
    return { success: false, error: error.message };
  }
}

export async function markSelectedInvoicesAsCommunicatedAction(invoiceIds: string[]) {
  try {
    await assertWritePermission();

    if (!invoiceIds || invoiceIds.length === 0) {
      return { success: false, error: 'No se han seleccionado facturas.' };
    }

    const { getInvoiceVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getInvoiceVisibilityFilter();

    const res = await prisma.invoice.updateMany({
      where: {
        ...visibilityFilter,
        id: { in: invoiceIds },
        communicatedAt: null,
      },
      data: { communicatedAt: new Date() },
    });

    revalidatePath('/facturas');
    return {
      success: true,
      count: res.count,
      message: `Se han marcado ${res.count} facturas como comunicadas.`,
    };
  } catch (error: any) {
    console.error('Error al marcar como comunicadas:', error);
    return { success: false, error: error.message };
  }
}

export async function createPenalizationInvoiceAction(data: {
  contractId: string;
  invoiceNumber: string;
  amount: number;
  pdfUrl: string;
}) {
  try {
    await assertWritePermission();

    const contract = await prisma.contract.findUnique({
      where: { id: data.contractId },
      include: {
        client: { include: { brand: true } },
        supplyPoint: true,
      },
    });

    if (!contract) throw new Error('Contrato no encontrado');

    const recipient = resolveClientRecipientEmail(contract.client);

    const invoice = await prisma.invoice.create({
      data: {
        totalMWh: 0,
        invoiceNumber: data.invoiceNumber,
        invoiceType: 'Penalización',
        clientId: contract.clientId,
        companyId: contract.client.brand?.companyId,
        contractId: contract.id,
        supplyPointId: contract.supplyPointId,
        issueDate: new Date(),
        totalAmount: data.amount,
        subtotal1: data.amount,
        pdfUrl: data.pdfUrl,
        communicatedAt: recipient ? new Date() : null,
      },
    });

    if (recipient) {
      const brand = contract.client.brand;
      const brandName = brand?.name || 'Su Comercializadora';
      const brandColor = brand?.accentColor || '#4F46E5';
      const logoUrl = brand?.invoiceLogoUrl || brand?.logoUrl;
      const logoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${brandName}" style="max-height: 60px; margin-bottom: 20px;" />`
        : '';

      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
          ${logoHtml}
          <p>Muy Sr/Sra. Nuestro/a, <b>${contract.client.businessName || contract.client.firstName}</b>,</p>
          <p>En el enlace seguro a continuación puede descargar la factura emitida en concepto de penalización por resolución unilateral de contrato con incumplimiento de compromiso mínimo de permanencia.</p>
          <p><a href="${data.pdfUrl}" style="background-color: ${brandColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; font-weight: bold;">Descargar Factura de Penalización</a></p>
          <p>${brandName} no busca obtener un beneficio mediante el cobro de la penalización, sino evitar el perjuicio que toda baja le ocasiona, por esto, nos gustaría nos indicara un teléfono y el mejor horario para hablar con Usted consiguiendo que su permanencia en nuestra compañía sea lo más satisfactoria posible, en cuyo caso procederíamos con el abono de la penalización repercutida.</p>
          <p>Reciba un cordial saludo.</p>
          <p><b>Atención al Cliente - ${brandName}</b></p>
        </div>
      `;

      const { from, replyTo } = resolveSenderHeader(brand);
      await resend.emails.send({
        from,
        to: recipient,
        subject: `Incumplimiento de Contrato - Factura de Penalización (${data.invoiceNumber})`,
        html: emailContent,
        ...(replyTo && { reply_to: replyTo }),
      });
    }

    revalidatePath(`/clientes/${contract.clientId}`);
    revalidatePath('/facturas');
    return { success: true, invoice };
  } catch (error: any) {
    console.error('Error creando penalización:', error);
    return { success: false, error: error.message };
  }
}

export async function requestPaymentTransferAction(
  invoiceId: string,
  type: 'transfer' | 'overdue' = 'transfer'
) {
  try {
    await assertWritePermission();

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { include: { brand: true } },
        supplyPoint: true,
      },
    });

    if (!invoice) throw new Error('Factura no encontrada');
    if (!isValidCloudPdf(invoice.pdfUrl)) {
      throw new Error('La factura debe disponer de un PDF válido en la nube (R2) para poder enviarla');
    }
    const recipient = resolveClientRecipientEmail(invoice.client);
    if (!recipient) {
      throw new Error('El cliente no tiene un email de facturación o contacto válido asignado');
    }

    const brand = invoice.client.brand;
    const brandName = brand?.name || 'Su Comercializadora';
    const brandColor = brand?.accentColor || '#4F46E5';
    const logoUrl = brand?.invoiceLogoUrl || brand?.logoUrl;
    const logoHtml = logoUrl
      ? `<div style="text-align: left; margin-top: 40px;"><img src="${logoUrl}" alt="${brandName}" style="max-height: 80px;" /></div>`
      : '';

    const clientName = extractClientFirstName(invoice.client);

    const banks = [];
    if (brand?.bankName1 && brand?.bankIban1) banks.push({ name: brand.bankName1, iban: brand.bankIban1 });
    if (brand?.bankName2 && brand?.bankIban2) banks.push({ name: brand.bankName2, iban: brand.bankIban2 });
    if (brand?.bankName3 && brand?.bankIban3) banks.push({ name: brand.bankName3, iban: brand.bankIban3 });
    if (banks.length === 0) banks.push({ name: 'Cuenta por defecto', iban: 'ES53 2100 4013 4922 0034 1288' });

    let banksHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 10px; border: 1px solid #ccc; text-align: left; font-weight: bold;">Entidad</th>
            <th style="padding: 10px; border: 1px solid #ccc; text-align: left; font-weight: bold;">IBAN</th>
          </tr>
        </thead>
        <tbody>
    `;
    banks.forEach((b) => {
      banksHtml += `
          <tr>
            <td style="padding: 10px; border: 1px solid #ccc;">${b.name}</td>
            <td style="padding: 10px; border: 1px solid #ccc; font-family: monospace; font-size: 14px;">${b.iban}</td>
          </tr>
      `;
    });
    banksHtml += `
        </tbody>
      </table>
    `;

    const isAbono = invoice.invoiceType === 'Abono';
    const displayAmount = isAbono ? -Math.abs(invoice.totalAmount) : invoice.totalAmount;

    let textIntro = '';
    let textAction = '';
    let subject = '';

    if (isAbono) {
      subject = `Saldo a tu favor - Factura ${invoice.invoiceNumber}`;
      textIntro = `Te informamos que tienes a tu favor la factura adjunta, por importe de <b><span style="color: ${brandColor}">${displayAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></b>.`;
      textAction = `Esta cantidad se compensará automáticamente en tus próximas facturas, o se te devolverá a tu cuenta bancaria si así corresponde.`;
      banksHtml = '';
    } else {
      subject =
        type === 'overdue'
          ? `Factura Vencida - ${invoice.invoiceNumber}`
          : `Pago Pendiente - Factura ${invoice.invoiceNumber}`;

      textIntro =
        type === 'overdue'
          ? `Te recordamos que <b>tienes vencido el pago</b> de tu factura adjunta, por importe de <b><span style="color: ${brandColor}">${displayAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></b>.`
          : `Te recordamos que no tienes domiciliado el pago de tu factura adjunta, por importe de <b><span style="color: ${brandColor}">${displayAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></b>.`;

      textAction =
        type === 'overdue'
          ? `Para el abono de la cantidad pendiente puedes realizarnos transferencia o ingreso en cajero automático en la siguiente cuenta, indicando tu nombre y el número de factura (<b>${invoice.invoiceNumber}</b>):`
          : `Para liquidar tu factura puedes realizarnos transferencia bancaria o ingreso en cajero, en la siguiente cuenta bancaria, indicando tu nombre y el número de factura (<b>${invoice.invoiceNumber}</b>):`;
    }

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
        <p>Estimad@ cliente, <b>${clientName}</b>:</p>
        <p>${textIntro}</p>
        <p><a href="${invoice.pdfUrl}" style="background-color: ${brandColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; font-weight: bold;">Descargar Factura</a></p>
        <p>${textAction}</p>
        
        ${banksHtml}
        
        <p>Un saludo.</p>
        <p><b>El Equipo ${brandName}</b></p>
        ${logoHtml}
      </div>
    `;

    const { from, replyTo } = resolveSenderHeader(brand);

    await resend.emails.send({
      from,
      to: recipient,
      subject,
      html: emailContent,
      ...(replyTo && { reply_to: replyTo }),
    });

    return {
      success: true,
      message: `Aviso de ${type === 'overdue' ? 'factura vencida' : 'pago'} enviado correctamente`,
    };
  } catch (error: any) {
    console.error('Error enviando aviso de pago:', error);
    return { success: false, error: error.message };
  }
}

export async function getInvoiceFilterOptionsAction(): Promise<string[]> {
  try {
    const { getInvoiceVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getInvoiceVisibilityFilter();

    const groups = await prisma.invoice.groupBy({
      by: ['invoiceType'],
      where: visibilityFilter,
    });

    const distinctTypes = groups
      .map((g) => g.invoiceType)
      .filter((t): t is string => Boolean(t && t.trim()))
      .sort((a, b) => a.localeCompare(b, 'es'));

    return distinctTypes;
  } catch (error) {
    console.error('Error obteniendo tipos de factura:', error);
    return ['Abono', 'Complementaria', 'Normal', 'Rectificativa', 'Regularizadora'];
  }
}

export async function buildInvoiceListWhereClause(params: {
  visibilityFilter: any;
  searchTerm?: string;
  filterType?: string;
  dateFrom?: string;
  dateTo?: string;
  communicationFilter?: string;
  pdfFilter?: string;
  selectedIds?: string[];
}): Promise<Prisma.InvoiceWhereInput> {
  const andConditions: Prisma.InvoiceWhereInput[] = [];

  if (params.visibilityFilter && Object.keys(params.visibilityFilter).length > 0) {
    andConditions.push(params.visibilityFilter);
  }

  if (params.selectedIds && params.selectedIds.length > 0) {
    andConditions.push({ id: { in: params.selectedIds } });
  }

  if (params.filterType === 'Bolsillo Solar') {
    andConditions.push({
      OR: [
        { invoiceData: { path: ['BOLSILLO SOLAR'], equals: 'SI' } },
        {
          AND: [
            { invoiceData: { path: ['Descuento Bolsillo Solar'], not: Prisma.AnyNull } },
            { NOT: { invoiceData: { path: ['Descuento Bolsillo Solar'], equals: '' } } },
            { NOT: { invoiceData: { path: ['Descuento Bolsillo Solar'], equals: '0' } } },
            { NOT: { invoiceData: { path: ['Descuento Bolsillo Solar'], equals: '0,00' } } },
            { NOT: { invoiceData: { path: ['Descuento Bolsillo Solar'], equals: '0.00' } } },
            { NOT: { invoiceData: { path: ['Descuento Bolsillo Solar'], equals: 0 } } },
          ],
        },
        {
          AND: [
            { invoiceData: { path: ['Carga Bolsillo Solar'], not: Prisma.AnyNull } },
            { NOT: { invoiceData: { path: ['Carga Bolsillo Solar'], equals: '' } } },
            { NOT: { invoiceData: { path: ['Carga Bolsillo Solar'], equals: '0' } } },
            { NOT: { invoiceData: { path: ['Carga Bolsillo Solar'], equals: '0,00' } } },
            { NOT: { invoiceData: { path: ['Carga Bolsillo Solar'], equals: '0.00' } } },
            { NOT: { invoiceData: { path: ['Carga Bolsillo Solar'], equals: 0 } } },
          ],
        },
      ],
    });
  } else if (params.filterType) {
    if (params.filterType === 'Rectificativa' || params.filterType === 'Rectificadora') {
      andConditions.push({ invoiceType: { in: ['Rectificativa', 'Rectificadora'] } });
    } else {
      andConditions.push({ invoiceType: params.filterType });
    }
  }

  if (params.communicationFilter === 'communicated') {
    andConditions.push({ communicatedAt: { not: null } });
  } else if (params.communicationFilter === 'pending') {
    andConditions.push({ communicatedAt: null });
  }

  if (params.pdfFilter === 'cloud') {
    andConditions.push({
      AND: [
        { pdfUrl: { startsWith: 'http' } },
        { NOT: { pdfUrl: { contains: 'airtable' } } },
      ],
    });
  } else if (params.pdfFilter === 'missing') {
    andConditions.push({
      OR: [
        { pdfUrl: null },
        { pdfUrl: '' },
        { pdfUrl: { contains: 'airtable' } },
        { NOT: { pdfUrl: { startsWith: 'http' } } },
      ],
    });
  }

  // Regla 112: Límites diarios exactos en zona horaria Europe/Madrid
  if (params.dateFrom || params.dateTo) {
    const issueDateFilter: Prisma.DateTimeFilter = {};
    if (params.dateFrom) {
      issueDateFilter.gte = fromZonedTime(`${params.dateFrom}T00:00:00.000`, 'Europe/Madrid');
    }
    if (params.dateTo) {
      issueDateFilter.lte = fromZonedTime(`${params.dateTo}T23:59:59.999`, 'Europe/Madrid');
    }
    andConditions.push({ issueDate: issueDateFilter });
  }

  if (params.searchTerm && params.searchTerm.trim()) {
    let effectiveSearchTerm = params.searchTerm.trim();
    if (effectiveSearchTerm.toUpperCase().startsWith('ES') && effectiveSearchTerm.length > 20) {
      effectiveSearchTerm = effectiveSearchTerm.substring(0, 20);
    }

    andConditions.push({
      OR: [
        { invoiceNumber: { contains: effectiveSearchTerm, mode: 'insensitive' } },
        { client: { businessName: { contains: effectiveSearchTerm, mode: 'insensitive' } } },
        { client: { firstName: { contains: effectiveSearchTerm, mode: 'insensitive' } } },
        { client: { lastName: { contains: effectiveSearchTerm, mode: 'insensitive' } } },
        { client: { lastName2: { contains: effectiveSearchTerm, mode: 'insensitive' } } },
        { client: { vatNumber: { contains: effectiveSearchTerm, mode: 'insensitive' } } },
        { supplyPoint: { cups: { contains: effectiveSearchTerm, mode: 'insensitive' } } },
        { contract: { contractCode: { contains: effectiveSearchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  if (andConditions.length === 0) return {};
  if (andConditions.length === 1) return andConditions[0];
  return { AND: andConditions };
}

export async function getPaginatedInvoicesAction(
  page: number,
  itemsPerPage: number,
  searchTerm: string,
  filterType: string,
  dateFrom?: string,
  dateTo?: string,
  communicationFilter?: string,
  pdfFilter?: string
) {
  try {
    const { getInvoiceVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getInvoiceVisibilityFilter();

    const whereClause = await buildInvoiceListWhereClause({
      visibilityFilter,
      searchTerm,
      filterType,
      dateFrom,
      dateTo,
      communicationFilter,
      pdfFilter,
    });

    const skip = (page - 1) * itemsPerPage;

    const [invoicesRaw, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        select: {
          id: true,
          invoiceNumber: true,
          invoiceType: true,
          issueDate: true,
          paymentDate: true,
          totalAmount: true,
          totalMWh: true,
          pdfUrl: true,
          xmlUrl: true,
          clientId: true,
          supplyPointId: true,
          contractId: true,
          billingStart: true,
          billingEnd: true,
          origin: true,
          communicatedAt: true,
          client: {
            select: {
              id: true,
              businessName: true,
              firstName: true,
              lastName: true,
              lastName2: true,
              contactEmail: true,
              invoiceEmail: true,
              contactPhone: true,
            },
          },
          supplyPoint: {
            select: {
              id: true,
              cups: true,
              address: true,
              postalCode: true,
              city: true,
              province: true,
            },
          },
        },
        orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
        skip,
        take: itemsPerPage,
      }),
      prisma.invoice.count({ where: whereClause }),
    ]);

    // Para las facturas del Motor Interno de la página actual (máx. 100), resolvemos la procedencia CNMC real
    // ('Telegestión', 'Telemedida', 'Estimada') desde invoiceData['Procedencia Hasta'] sin cargar el JSON de Ingebau.
    const internalIds = invoicesRaw
      .filter((inv) => inv.origin === 'INTERNAL_ENGINE')
      .map((inv) => inv.id);

    let invoices = invoicesRaw;
    if (internalIds.length > 0) {
      const internalMeta = await prisma.invoice.findMany({
        where: { id: { in: internalIds } },
        select: { id: true, invoiceData: true },
      });
      const procById = new Map<string, string>();
      for (const row of internalMeta) {
        const d = (row.invoiceData as Record<string, any>) || {};
        const proc = d['Procedencia Hasta'] ? String(d['Procedencia Hasta']).trim() : '';
        procById.set(row.id, proc || 'Motor Interno');
      }
      invoices = invoicesRaw.map((inv) =>
        inv.origin === 'INTERNAL_ENGINE'
          ? { ...inv, origin: procById.get(inv.id) || 'Motor Interno' }
          : inv
      );
    }

    return { success: true, invoices, totalCount };
  } catch (error: any) {
    console.error('Error fetching paginated invoices:', error);
    return { success: false, error: error.message };
  }
}
