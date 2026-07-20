'use server';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { findOrUpdateSupplyPointByCups } from '@/lib/supplyPointHelper';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

export async function importInvoicesAction(invoicesData: any[]) {
  try {
    const results = {
      total: invoicesData.length,
      imported: 0,
      duplicates: 0,
      errors: [] as string[]
    };
    
    const insertedInvoiceNumbers: string[] = [];

    const session = await auth();
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

      const vatNumbers = invoicesData.map(r => r['CIF'] || r['NIF'] || r['DNI']).filter(Boolean);
      const cupsRaw = invoicesData.map(r => r['CUPS']).filter(Boolean);
      const cupsSet = Array.from(new Set(cupsRaw.map(c => String(c).trim().substring(0, 20))));
      const vatSet = Array.from(new Set(vatNumbers));

      const existingClients = await prisma.client.findMany({
        where: { vatNumber: { in: vatSet }, brandId: activeBrandId }
      });
      const clientMap = new Map(existingClients.map(c => [c.vatNumber, c]));

      const existingSupplyPoints = await prisma.supplyPoint.findMany({
        where: { cups: { in: cupsSet } }
      });
      const supplyPointMap = new Map(existingSupplyPoints.map(sp => [sp.cups, sp]));

      for (const row of invoicesData) {
        // Mapeo defensivo de columnas
        const invoiceNumber = row['Numero Factura'] || row['Número Factura'] || row['NUMERO FACTURA'];
        const cupsRaw = row['CUPS'];
        const cups = cupsRaw ? String(cupsRaw).trim().substring(0, 20) : null;
        const vatNumber = row['CIF'] || row['NIF'] || row['DNI'];
        
        if (!invoiceNumber || !cups) {
          results.errors.push(`Fila sin Numero de Factura o CUPS (CIF: ${vatNumber})`);
          continue;
        }

        // 1. Buscar Cliente en el Map
        let client = vatNumber ? clientMap.get(vatNumber) : null;

        // Si no existe, lo creamos y lo guardamos en el Map
        if (!client && vatNumber) {
          client = await prisma.client.create({
            data: {
              vatNumber: vatNumber,
              businessName: row['NOMBRE/RAZON SOCIAL'] || 'Desconocido',
              firstName: row['Primer Apellido'] || '',
              lastName: row['Segundo Apellido'] || '',
              contactEmail: row['Email Emisora'] || '',
              brandId: activeBrandId,
            }
          });
          clientMap.set(vatNumber, client);
        }

        // 2. Buscar SupplyPoint en el Map
        let supplyPoint = supplyPointMap.get(cups);

        if (!supplyPoint && client) {
          supplyPoint = await findOrUpdateSupplyPointByCups(prisma, cups, client.id, {
            address: row['DOMICILIO PS'] || '',
            city: row['POBLACION PS'] || '',
            postalCode: row['CP PS']?.toString() || '00000',
            province: row['PROVINCIA PS'] || '',
            tariff: row['Tarifa'] || '2.0TD',
          });
          if (supplyPoint) {
            supplyPointMap.set(cups, supplyPoint as any);
          }
        }

      // Helper para parsear fechas de Excel (serial) o strings (DD/MM/YYYY)
      const parseExcelDate = (val: any): Date => {
        if (!val) return new Date();
        let d: Date;
        if (typeof val === 'number') {
          d = new Date((val - 25569) * 86400 * 1000);
        } else if (typeof val === 'string') {
          if (val.includes('/')) {
            const parts = val.split('/');
            if (parts.length === 3) {
               d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
            } else {
               d = new Date(val);
            }
          } else if (/^\d+$/.test(val)) {
            d = new Date((parseInt(val, 10) - 25569) * 86400 * 1000);
          } else {
            d = new Date(val);
          }
        } else {
          d = new Date(val);
        }
        
        if (isNaN(d.getTime())) return new Date();
        
        // Forzamos que la hora sea las 12:00 UTC para evitar que, por cambios de zona horaria (UTC+2 en España), 
        // caiga a las 22:00 del día anterior.
        d.setUTCHours(12, 0, 0, 0);
        return d;
      };

      // 4. Fechas
      const rawDate = row['Fecha Factura'] || row['FECHA FACTURA'] || row['Fecha factura'] || row['Fecha Cobro'] || new Date().toISOString();
      const issueDate = parseExcelDate(rawDate);

      // 3. Buscar Contrato correcto para ese CUPS en esa fecha
      const rawDateDesde = row['Fecha Desde'] || row['Desde'] || row['desde'] || row['Fecha Cobro'] || new Date().toISOString();
      const fechaDesdeFactura = parseExcelDate(rawDateDesde);

      // Cargar todos los contratos candidatos para este CUPS
      const candidateContracts = await prisma.contract.findMany({
        where: { 
          supplyPointId: supplyPoint!.id,
          status: { in: ['ACTIVO', 'Activo', 'Finalizado', 'FINALIZADO'] }
        },
        orderBy: { activationDate: 'desc' }
      });

      const inputPotencias = [
        parseFloat(row['P1C'] || '0'),
        parseFloat(row['P2C'] || '0'),
        parseFloat(row['P3C'] || '0'),
        parseFloat(row['P4C'] || '0'),
        parseFloat(row['P5C'] || '0'),
        parseFloat(row['P6C'] || '0')
      ];

      let contract = null;

      // 3. FILTRO DE PRECISIÓN + LÓGICA TEMPORAL (Estilo Airtable Script V2)
      for (const record of candidateContracts) {
        // C) Potencias
        const comparar = (val1: any, val2: any) => {
            const n1 = parseFloat(val1) || 0;
            const n2 = parseFloat(val2) || 0;
            return Math.abs(n1 - n2) < 0.01; 
        };
        
        const potenciasOk = 
            comparar(record.p1c, inputPotencias[0]) &&
            comparar(record.p2c, inputPotencias[1]) &&
            comparar(record.p3c, inputPotencias[2]) &&
            comparar(record.p4c, inputPotencias[3]) &&
            comparar(record.p5c, inputPotencias[4]) &&
            comparar(record.p6c, inputPotencias[5]);
        
        if (!potenciasOk) continue;

        // D) LÓGICA DE DESEMPATE TEMPORAL
        if (record.terminationDate) {
            // Si el contrato terminó ANTES de que empezara esta factura, no es el correcto
            if (record.terminationDate < fechaDesdeFactura) continue;
        }
        
        // Match encontrado!
        contract = record;
        break;
      }

      // Fallback 1: Buscar el contrato que coincida temporalmente con las fechas de la factura
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

      // Fallback 2: Si aún no hay contrato, cogemos el último Activo o el más reciente
      if (!contract) {
        contract = candidateContracts[0] || null;
      }

      const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;

      // Extraer importes
      const totalAmount = parseNum(row['Total'] || row['TOTAL']);
      const subtotal1 = parseNum(row['Subtotal 1']);
      const taxAmount = parseNum(row['Importe Impuesto CORR'] || row['Importe Impuesto']);
      const taxPercentage = parseNum(row['Impuesto (%)'] || '5.11');
      const cantidadEnergia = parseNum(row['Cantidad Energía Total Consumida CORR'] || row['Energía Total Consumida']);
      const totalMWh = cantidadEnergia;

      // Fechas de periodo facturado
      const billingStartRaw = row['Desde(EA)'] || row['Desde(P)'] || row['Desde'] || row['Fecha Desde'];
      const billingEndRaw = row['Hasta(EA)'] || row['Hasta(P)'] || row['Hasta'] || row['Fecha Hasta'];
      const billingStart = billingStartRaw ? parseExcelDate(billingStartRaw) : null;
      const billingEnd = billingEndRaw ? parseExcelDate(billingEndRaw) : null;

      // Cálculo de Margen
      let margenEnergia = parseNum(row['Margen Energia']);
      let margenFactura = parseNum(row['Margen Factura']);
      let margenPotencia = parseNum(row['Margen Potencia']);
      let fijoIndex = row['FIJO / INDEX'] || 'Fijo';
      
      let fee = contract && contract.fee != null ? contract.fee : (parseNum(row['Fee Index']) || parseNum(row['FEE']) || 0);

      let baseImponibleF1 = parseNum(row['BaseImponibleF1 CORR'] || row['BaseImponibleF1']);
      let tipoFactura = row['Tipo Factura'] || 'Normal';
      
      let baseImponibleIva = parseNum(row['Base Imponible IVA CORR'] || row['Base Imponible IVA']);
      if (tipoFactura === 'Abono' && baseImponibleIva > 0) {
        baseImponibleIva = -baseImponibleIva;
      }

      let margenRelIngebau = 0;
      if (cantidadEnergia !== 0) {
        margenRelIngebau = 1000 * margenEnergia / cantidadEnergia;
      }

      let margenFacturaCorr = (tipoFactura === 'Abono' ? -1 : 1) * margenFactura;

      let margenEstimado = 0;
      if (fijoIndex === 'Indexado') {
        margenEstimado = margenPotencia + fee * (cantidadEnergia / 1000);
      } else {
        margenEstimado = Math.abs(baseImponibleIva) - taxAmount - baseImponibleF1 - 0.09 * cantidadEnergia;
      }
      if (tipoFactura === 'Abono') {
        margenEstimado = -Math.abs(margenEstimado);
      }

      let margin = 0;
      if (margenRelIngebau < 70 && margenRelIngebau > -70) {
        margin = margenFacturaCorr;
      } else {
        margin = margenEstimado;
      }

      // Buscar si es rectificativa
      const rectifiedInvoiceNum = row['Numero factura rectificada'] || null;
      let rectifiedInvoiceId = null;
      if (rectifiedInvoiceNum) {
        const rect = await prisma.invoice.findFirst({ where: { invoiceNumber: rectifiedInvoiceNum, client: { brandId: activeBrandId } } });
        if (rect) rectifiedInvoiceId = rect.id;
      }

      // 5. Crear la Factura si no existe
      const existingInvoice = await prisma.invoice.findFirst({ where: { invoiceNumber, client: { brandId: activeBrandId } } });
      if (existingInvoice) {
        results.duplicates++;
        continue;
      }

      await prisma.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: tipoFactura,
          clientId: contract?.clientId || client?.id || supplyPoint?.clientId || '',
          companyId: activeCompanyId,
          contractId: contract?.id,
          supplyPointId: supplyPoint?.id,
          issueDate,
          billingStart,
          billingEnd,
          totalAmount,
          subtotal1,
          taxAmount,
          taxPercentage,
          totalMWh,
          pdfUrl: row['PATH'] || null,
          rectifiedInvoiceId,
          margin,
          invoiceData: row as any,
        }
      });
      
      insertedInvoiceNumbers.push(invoiceNumber);
      results.imported++;
    }

    // Auto-link new invoices to existing F1 files based on JSON data
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
        console.error("Error auto-linking invoices to F1:", err);
      }
    }

    revalidatePath('/facturas');
    return { success: true, results };
    
  } catch (error: any) {
    console.error("Error importando facturas:", error);
    return { success: false, error: error.message };
  }
}

import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

function extractClientFirstName(client: any): string {
  if (client.firstName?.trim()) {
    return client.firstName.trim();
  }

  const airtableData = typeof client.airtableData === 'string' 
    ? JSON.parse(client.airtableData) 
    : (client.airtableData || {});
    
  if (airtableData) {
    const airtableNombre = airtableData['Nombre'] || airtableData['NOMBRE'] || airtableData['nombre'];
    if (airtableNombre) return String(airtableNombre).trim();
  }

  const fullName = client.businessName || '';
  const apellidos = `${client.lastName || ''} ${client.lastName2 || ''}`.trim();
  
  if (apellidos && fullName.toLowerCase().includes(apellidos.toLowerCase())) {
    const regex = new RegExp(apellidos, 'i');
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
  
  const formatDate = (date: Date) => date ? new Date(date).toLocaleDateString('es-ES') : '';
  const billingPeriod = (invoice.billingStart && invoice.billingEnd) 
    ? `, por el periodo facturado del ${formatDate(invoice.billingStart)} al ${formatDate(invoice.billingEnd)}`
    : '';

  let contactMethods = `respondiendo a este email`;
  if (brand?.whatsappPhone || brand?.phone) {
    contactMethods += `, o `;
    const methods = [];
    if (brand?.phone) methods.push(`en el <a href="tel:${brand.phone.replace(/\\D/g, '')}" style="color: ${brandColor}; text-decoration: none; font-weight: bold;">${brand.phone}</a>`);
    if (brand?.whatsappPhone) methods.push(`por Whatsapp <a href="https://wa.me/${brand.whatsappPhone.replace(/\\D/g, '')}" style="color: ${brandColor}; text-decoration: none; font-weight: bold;">haciendo clic aquí</a>`);
    contactMethods += methods.join(' o ');
  }

  const isAbono = invoice.invoiceType === 'Abono';
  const totalLabel = isAbono ? 'Total a tu favor' : 'Total a pagar';
  const displayAmount = isAbono ? -Math.abs(invoice.totalAmount) : invoice.totalAmount;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; color: #333;">
      <p>Hola <b>${clientName}</b>,</p>
      <p>Te adjuntamos mediante enlace seguro la factura con número <b>${invoice.invoiceNumber}</b>, asociada a tu suministro <b>${invoice.supplyPoint?.cups || 'Desconocido'}</b>${billingPeriod}.</p>
      
      <div style="margin: 30px 0; padding: 20px; background: ${brandColor}15; border-left: 4px solid ${brandColor}; border-radius: 4px;">
        <p style="margin: 0 0 10px 0;"><b>${totalLabel}:</b> <span style="font-size: 1.2rem; color: ${brandColor};">${displayAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></p>
        <p style="margin: 0;"><b>Fecha de vencimiento:</b> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('es-ES') : 'A la vista'}</p>
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
    // Buscar facturas que tengan PDF, email de cliente, y no hayan sido comunicadas
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        communicatedAt: null,
        pdfUrl: { not: null },
        client: { contactEmail: { not: "" } }
      },
      include: {
        client: {
          include: { brand: true } // Cargar info de la Comercializadora / Marca
        },
        supplyPoint: true
      }
    });

    if (pendingInvoices.length === 0) {
      return { success: true, sentCount: 0, message: "No hay facturas pendientes de envío con PDF y Email válidos." };
    }

    let sentCount = 0;

    for (const invoice of pendingInvoices) {
      try {
        const brand = invoice.client.brand;
        const brandName = brand?.name || 'Su Comercializadora';
        const emailContent = generateInvoiceEmailContent(invoice, brand);

        await resend.emails.send({
          from: `facturacion@${brand?.slug || 'crm'}.com`, // Se asume que los dominios están configurados en Resend
          to: invoice.client.contactEmail!,
          subject: `Aviso de factura emitida - ${invoice.invoiceNumber}`,
          html: emailContent
        });

        // Marcar como enviada
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { communicatedAt: new Date() }
        });

        sentCount++;
      } catch (err) {
        console.error(`Error enviando factura ${invoice.id}:`, err);
        // Continuamos con la siguiente
      }
    }

    revalidatePath('/facturas');
    return { success: true, sentCount, message: `Se han enviado ${sentCount} facturas correctamente.` };

  } catch (error: any) {
    console.error("Error en envío masivo:", error);
    return { success: false, error: error.message };
  }
}

export async function forceResendInvoiceAction(invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { include: { brand: true } },
        supplyPoint: true
      }
    });

    if (!invoice || !invoice.pdfUrl || !invoice.client.contactEmail) {
      return { success: false, error: "La factura no tiene PDF o el cliente no tiene Email válido." };
    }

    const brand = invoice.client.brand;
    const brandName = brand?.name || 'Su Comercializadora';
    const emailContent = generateInvoiceEmailContent(invoice, brand);

    await resend.emails.send({
      from: brand?.supportEmail ? `${brandName} <${brand.supportEmail}>` : `${brandName} <facturacion@${brand?.domain || 'aed-energia.com'}>`,
      to: invoice.client.contactEmail,
      subject: `Aviso de factura emitida - ${invoice.invoiceNumber}`,
      html: emailContent,
      ...(brand?.supportEmail && { reply_to: brand.supportEmail })
    });

    // Actualizar fecha de comunicación
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { communicatedAt: new Date() }
    });

    return { success: true, message: "Factura reenviada correctamente." };
  } catch (error: any) {
    console.error("Error forzando reenvío:", error);
    return { success: false, error: error.message };
  }
}

export async function sendSelectedInvoicesAction(invoiceIds: string[]) {
  try {
    if (!invoiceIds || invoiceIds.length === 0) {
      return { success: false, error: "No se han seleccionado facturas." };
    }

    // Buscar facturas seleccionadas que tengan PDF, email de cliente, y no hayan sido comunicadas
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        communicatedAt: null,
        pdfUrl: { not: null },
        client: { contactEmail: { not: "" } }
      },
      include: {
        client: {
          include: { brand: true } // Cargar info de la Comercializadora / Marca
        },
        supplyPoint: true
      }
    });

    if (pendingInvoices.length === 0) {
      return { success: true, sentCount: 0, message: "Las facturas seleccionadas ya fueron comunicadas, no tienen PDF o no tienen Email válido." };
    }

    let sentCount = 0;

    for (const invoice of pendingInvoices) {
      try {
        const brand = invoice.client.brand;
        const brandName = brand?.name || 'Su Comercializadora';
        const emailContent = generateInvoiceEmailContent(invoice, brand);

        await resend.emails.send({
          from: brand?.supportEmail ? `${brandName} <${brand.supportEmail}>` : `${brandName} <facturacion@${brand?.domain || 'aed-energia.com'}>`,
          to: invoice.client.contactEmail!,
          subject: `Aviso de factura emitida - ${invoice.invoiceNumber}`,
          html: emailContent,
          ...(brand?.supportEmail && { reply_to: brand.supportEmail })
        });

        // Marcar como enviada
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { communicatedAt: new Date() }
        });

        sentCount++;
      } catch (err) {
        console.error(`Error enviando factura ${invoice.id}:`, err);
        // Continuamos con la siguiente
      }
    }

    revalidatePath('/facturas');
    return { success: true, sentCount, message: `Se han enviado ${sentCount} facturas correctamente.` };

  } catch (error: any) {
    console.error("Error en envío seleccionado:", error);
    return { success: false, error: error.message };
  }
}

export async function markSelectedInvoicesAsCommunicatedAction(invoiceIds: string[]) {
  try {
    if (!invoiceIds || invoiceIds.length === 0) {
      return { success: false, error: "No se han seleccionado facturas." };
    }

    const res = await prisma.invoice.updateMany({
      where: { 
        id: { in: invoiceIds },
        communicatedAt: null
      },
      data: { communicatedAt: new Date() }
    });

    revalidatePath('/facturas');
    return { success: true, count: res.count, message: `Se han marcado ${res.count} facturas como comunicadas.` };

  } catch (error: any) {
    console.error("Error al marcar como comunicadas:", error);
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
    const contract = await prisma.contract.findUnique({
      where: { id: data.contractId },
      include: {
        client: { include: { brand: true } },
        supplyPoint: true
      }
    });

    if (!contract) throw new Error("Contrato no encontrado");

    // Crear la factura
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
        communicatedAt: new Date() // Ya que se envía ahora mismo
      }
    });

    // Enviar el correo electrónico
    const brand = contract.client.brand;
    const brandName = brand?.name || 'Su Comercializadora';
    const brandColor = brand?.accentColor || '#4F46E5';
    const logoHtml = brand?.logoUrl 
      ? `<img src="${brand.logoUrl}" alt="${brandName}" style="max-height: 60px; margin-bottom: 20px;" />`
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

    await resend.emails.send({
      from: `facturacion@${brand?.slug || 'crm'}.com`,
      to: contract.client.contactEmail || contract.client.invoiceEmail || 'dummy@example.com',
      subject: `Incumplimiento de Contrato - Factura de Penalización`,
      html: emailContent
    });

    revalidatePath(`/clientes/${contract.clientId}`);
    revalidatePath('/facturas');
    return { success: true, invoice };

  } catch (error: any) {
    console.error("Error creando penalización:", error);
    return { success: false, error: error.message };
  }
}

export async function requestPaymentTransferAction(invoiceId: string, type: 'transfer' | 'overdue' = 'transfer') {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { include: { brand: true } },
        supplyPoint: true
      }
    });

    if (!invoice) throw new Error("Factura no encontrada");
    if (!invoice.pdfUrl) throw new Error("La factura debe tener un PDF generado para poder enviarla");
    if (!invoice.client.contactEmail) throw new Error("El cliente no tiene un email de contacto asignado");

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
      banksHtml = ''; // No enviamos nuestras cuentas bancarias si les debemos dinero
    } else {
      subject = type === 'overdue'
        ? `Factura Vencida - ${invoice.invoiceNumber}`
        : `Pago Pendiente - Factura ${invoice.invoiceNumber}`;

      textIntro = type === 'overdue' 
        ? `Te recordamos que <b>tienes vencido el pago</b> de tu factura adjunta, por importe de <b><span style="color: ${brandColor}">${displayAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></b>.`
        : `Te recordamos que no tienes domiciliado el pago de tu factura adjunta, por importe de <b><span style="color: ${brandColor}">${displayAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></b>.`;

      textAction = type === 'overdue'
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

    await resend.emails.send({
      from: brand?.supportEmail ? `${brandName} <${brand.supportEmail}>` : `${brandName} <facturacion@${brand?.domain || 'aed-energia.com'}>`,
      to: invoice.client.contactEmail,
      subject: subject,
      html: emailContent,
      ...(brand?.supportEmail && { reply_to: brand.supportEmail })
    });

    return { success: true, message: `Aviso de ${type === 'overdue' ? 'factura vencida' : 'pago'} enviado correctamente` };
  } catch (error: any) {
    console.error("Error enviando aviso de pago:", error);
    return { success: false, error: error.message };
  }
}

export async function getPaginatedInvoicesAction(
  page: number, 
  itemsPerPage: number, 
  searchTerm: string, 
  filterType: string,
  dateFrom?: string,
  dateTo?: string,
  communicationFilter?: string
) {
  try {
    const { getInvoiceVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getInvoiceVisibilityFilter();
    
    const whereClause: any = { ...visibilityFilter };

    if (filterType === 'Bolsillo Solar') {
      try {
        const matchingIdsRes = await prisma.$queryRaw<any[]>`
          SELECT id FROM "Invoice"
          WHERE ("invoiceData"->>'Descuento Bolsillo Solar') IS NOT NULL
            AND TRIM("invoiceData"->>'Descuento Bolsillo Solar') != ''
            AND REPLACE("invoiceData"->>'Descuento Bolsillo Solar', ',', '.')::numeric != 0
        `;
        const matchingIds = matchingIdsRes.map((r: any) => r.id);
        whereClause.id = { in: matchingIds };
      } catch (e) {
        console.error("Error filtrando por Bolsillo Solar:", e);
      }
    } else if (filterType) {
      whereClause.invoiceType = filterType;
    }

    if (communicationFilter === 'communicated') {
      whereClause.communicatedAt = { not: null };
    } else if (communicationFilter === 'pending') {
      whereClause.communicatedAt = null;
    }

    if (dateFrom || dateTo) {
      whereClause.issueDate = {};
      if (dateFrom) {
        whereClause.issueDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Al final del día para incluir la fecha "hasta" completa
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        whereClause.issueDate.lte = endOfDay;
      }
    }

    if (searchTerm) {
      const isCups = searchTerm.toUpperCase().startsWith('ES') && searchTerm.length >= 18;
      const isVatNumber = /^[A-Z0-9]{8,10}$/i.test(searchTerm) && !isCups;
      const isInvoiceNumber = /^[A-Z0-9]{6,}$/i.test(searchTerm) && !isCups && !isVatNumber;

      if (isCups) {
        whereClause.OR = [
          { supplyPoint: { cups: { contains: searchTerm, mode: 'insensitive' } } },
          { invoiceData: { path: ['CUPS'], string_contains: searchTerm } },
        ];
      } else if (isVatNumber) {
        whereClause.OR = [
          { client: { vatNumber: { contains: searchTerm, mode: 'insensitive' } } },
          { invoiceData: { path: ['NIF/CIF'], string_contains: searchTerm } },
          { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
        ];
      } else if (isInvoiceNumber && !searchTerm.includes(' ')) {
        whereClause.OR = [
          { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
        ];
      } else {
        whereClause.OR = [
          { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
          { client: { businessName: { contains: searchTerm, mode: 'insensitive' } } },
          { client: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
          { client: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
          { client: { vatNumber: { contains: searchTerm, mode: 'insensitive' } } },
          { supplyPoint: { cups: { contains: searchTerm, mode: 'insensitive' } } },
          { invoiceData: { path: ['NOMBRE/RAZON SOCIAL'], string_contains: searchTerm } },
          { invoiceData: { path: ['NIF/CIF'], string_contains: searchTerm } },
          { invoiceData: { path: ['CUPS'], string_contains: searchTerm } },
        ];
      }
    }

    const skip = (page - 1) * itemsPerPage;
    
    const [invoicesRaw, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        include: { client: true, contract: true, supplyPoint: true },
        orderBy: [
          { issueDate: 'desc' },
          { invoiceNumber: 'desc' }
        ],
        skip,
        take: itemsPerPage,
      }),
      prisma.invoice.count({ where: whereClause })
    ]);

    const invoices = invoicesRaw.map(inv => {
      let proc = inv.origin;
      if (!proc && inv.invoiceData && typeof inv.invoiceData === 'object') {
        const d = inv.invoiceData as any;
        if (d['Procedencia Hasta']) proc = d['Procedencia Hasta'];
      }
      return {
        ...inv,
        origin: proc,
        desde: (inv as any).desde,
        hasta: (inv as any).hasta,
      };
    });

    return { success: true, invoices, totalCount };
  } catch (error: any) {
    console.error("Error fetching paginated invoices:", error);
    return { success: false, error: error.message };
  }
}
