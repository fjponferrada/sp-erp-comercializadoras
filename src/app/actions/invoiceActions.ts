'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

export async function importInvoicesAction(invoicesData: any[]) {
  try {
    const results = {
      total: invoicesData.length,
      imported: 0,
      errors: [] as string[]
    };

    const session = await auth();
    const cookieStore = await cookies();
    const cookieBrandId = cookieStore.get('active-brand')?.value;
    let activeBrandId = cookieBrandId || (session?.user as any)?.brandId;
    if (!activeBrandId) {
      const b = await prisma.brand.findFirst();
      activeBrandId = b?.id || '';
    }

    for (const row of invoicesData) {
      // Mapeo defensivo de columnas (puede venir de CSV o Excel)
      const invoiceNumber = row['Numero Factura'] || row['Número Factura'] || row['NUMERO FACTURA'];
      const cupsRaw = row['CUPS'];
      const cups = cupsRaw ? String(cupsRaw).trim().substring(0, 20) : null;
      const vatNumber = row['CIF'] || row['NIF'] || row['DNI'];
      
      if (!invoiceNumber || !cups) {
        results.errors.push(`Fila sin Numero de Factura o CUPS (CIF: ${vatNumber})`);
        continue;
      }

      // 1. Buscar Cliente por CIF
      let client = null;
      if (vatNumber) {
        client = await prisma.client.findFirst({
          where: { vatNumber, brandId: activeBrandId }
        });
      }

      // Si no existe, lo creamos como "Importado desde Facturación"
      if (!client && vatNumber) {
        client = await prisma.client.create({
          data: {
            vatNumber: vatNumber,
            businessName: row['NOMBRE/RAZON SOCIAL'] || 'Desconocido',
            firstName: row['Primer Apellido'] || '',
            lastName: row['Segundo Apellido'] || '',
            contactEmail: row['Email Emisora'] || '', // Fallback
            brandId: activeBrandId,
          }
        });
      }

      // 2. Buscar SupplyPoint por CUPS
      let supplyPoint = await prisma.supplyPoint.findFirst({
        where: { cups, client: { brandId: activeBrandId } }
      });

      if (!supplyPoint) {
        // Lo creamos vacío vinculado al cliente
        supplyPoint = await prisma.supplyPoint.create({
          data: {
            clientId: client!.id,
            cups,
            address: row['DOMICILIO PS'] || '',
            city: row['POBLACION PS'] || '',
            postalCode: row['CP PS']?.toString() || '00000',
            province: row['PROVINCIA PS'] || '',
            tariff: row['Tarifa'] || '2.0TD',
          }
        });
      }

      // 4. Fechas
      const rawDate = row['Fecha Cobro'] || new Date().toISOString();
      const issueDate = new Date(rawDate);

      // 3. Buscar Contrato correcto para ese CUPS en esa fecha
      const rawDateDesde = row['Fecha Desde'] || row['Desde'] || row['desde'] || row['Fecha Cobro'] || new Date().toISOString();
      const fechaDesdeFactura = new Date(rawDateDesde);

      // Lógica de Desempate Temporal (Estilo Airtable Script V2):
      // Si el contrato terminó ANTES de que empezara esta factura, no es el correcto.
      // Si no tiene fecha de baja (vacío) o es >= que el inicio de la factura, es el ganador.
      let contract = await prisma.contract.findFirst({
        where: { 
          supplyPointId: supplyPoint.id,
          status: { in: ['ACTIVO', 'Activo', 'Finalizado', 'FINALIZADO'] },
          OR: [
            { terminationDate: null },
            { terminationDate: { gte: fechaDesdeFactura } }
          ]
        },
        orderBy: { activationDate: 'desc' }
      });

      // Fallback: Si no encaja por fechas exactas, cogemos el último Activo o el más reciente
      if (!contract) {
        contract = await prisma.contract.findFirst({
          where: { supplyPointId: supplyPoint.id },
          orderBy: { activationDate: 'desc' }
        });
      }

      // Extraer importes
      const totalAmount = parseFloat(row['Total'] || row['TOTAL'] || '0');
      const subtotal1 = parseFloat(row['Subtotal 1'] || '0');
      const taxAmount = parseFloat(row['Importe Impuesto CORR'] || row['Importe Impuesto'] || '0');
      const taxPercentage = parseFloat(row['Impuesto (%)'] || '5.11');
      const cantidadEnergia = parseFloat(row['Cantidad Energía Total Consumida CORR'] || row['Energía Total Consumida'] || '0');
      const totalMWh = cantidadEnergia / 1000;

      // Cálculo de Margen
      const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
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
        margenEstimado = baseImponibleIva - taxAmount - baseImponibleF1 - 0.09 * cantidadEnergia;
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
        results.errors.push(`Factura duplicada ignorada: ${invoiceNumber}`);
        continue;
      }

      await prisma.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: tipoFactura,
          clientId: client?.id || supplyPoint.id,
          contractId: contract?.id,
          supplyPointId: supplyPoint.id,
          issueDate,
          totalAmount,
          subtotal1,
          taxAmount,
          taxPercentage,
          totalMWh,
          pdfUrl: row['PATH'] || null,
          rectifiedInvoiceId,
          margenEnergia,
          margenPotencia,
          margenFactura,
          fijoIndex,
          fee,
          baseImponibleIva,
          baseImponibleF1,
          margin,
          invoiceData: row as any,
        }
      });
      
      results.imported++;
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
        const brandColor = brand?.accentColor || '#4F46E5';
        const logoHtml = brand?.logoUrl 
          ? `<img src="${brand.logoUrl}" alt="${brandName}" style="max-height: 60px; margin-bottom: 20px;" />`
          : '';

        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
            ${logoHtml}
            <p>Hola <b>${invoice.client.businessName || invoice.client.firstName}</b>,</p>
            <p>Te adjuntamos (enlace seguro) la factura con número <b>${invoice.invoiceNumber}</b>, correspondiente a tu suministro <b>${invoice.supplyPoint?.cups || 'Desconocido'}</b>.</p>
            <p><a href="${invoice.pdfUrl}" style="background-color: ${brandColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; font-weight: bold;">Descargar Factura en PDF</a></p>
            <p>Para cualquier duda que tengas, puedes ponerte en contacto con nosotros respondiendo a este email.</p>
            <p>Gracias por confiar en nosotros,</p>
            <p><b>El Equipo de ${brandName}</b></p>
          </div>
        `;

        await resend.emails.send({
          from: `facturacion@${brand?.slug || 'crm'}.com`, // Se asume que los dominios están configurados en Resend
          to: invoice.client.contactEmail!,
          subject: `[${brandName}] Aviso de factura emitida - ${invoice.invoiceNumber}`,
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
      subject: `[${brandName}] Incumplimiento de Contrato - Factura de Penalización`,
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
    const logoHtml = brand?.logoUrl 
      ? `<img src="${brand.logoUrl}" alt="${brandName}" style="max-height: 60px; margin-bottom: 20px;" />`
      : '';

    const banks = [];
    if (brand?.bankName1 && brand?.bankIban1) banks.push({ name: brand.bankName1, iban: brand.bankIban1 });
    if (brand?.bankName2 && brand?.bankIban2) banks.push({ name: brand.bankName2, iban: brand.bankIban2 });
    if (brand?.bankName3 && brand?.bankIban3) banks.push({ name: brand.bankName3, iban: brand.bankIban3 });
    if (banks.length === 0) banks.push({ name: 'Cuenta por defecto', iban: 'ES53 2100 4013 4922 0034 1288' });

    let banksHtml = '';
    banks.forEach((b, i) => {
      banksHtml += `
        <table style="width: 100%; border-collapse: collapse; margin-top: ${i===0 ? '20px' : '0'}; margin-bottom: ${i===banks.length-1 ? '20px' : '0'};">
          <tr>
            <td style="padding: 10px; border: 1px solid #ccc; font-weight: bold; width: 30%; border-bottom: none;">Entidad</td>
            <td style="padding: 10px; border: 1px solid #ccc; border-left: none; border-bottom: none;">${b.name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ccc; font-weight: bold;">IBAN</td>
            <td style="padding: 10px; border: 1px solid #ccc; border-left: none; font-family: monospace; font-size: 16px;">${b.iban}</td>
          </tr>
        </table>
      `;
    });

    const textIntro = type === 'overdue' 
      ? `Te recordamos que <b>tienes vencido el pago</b> de tu factura adjunta, por importe de <b><span style="color: ${brandColor}">${invoice.totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></b>.`
      : `Te recordamos que no tienes domiciliado el pago de tu factura adjunta, por importe de <b><span style="color: ${brandColor}">${invoice.totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></b>.`;

    const textAction = type === 'overdue'
      ? `Para el abono de la cantidad pendiente puedes realizarnos transferencia o ingreso en cajero automático en la siguiente cuenta, indicando tu nombre y el número de factura (<b>${invoice.invoiceNumber}</b>):`
      : `Para liquidar tu factura puedes realizarnos transferencia bancaria o ingreso en cajero, en la siguiente cuenta bancaria, indicando tu nombre y el número de factura (<b>${invoice.invoiceNumber}</b>):`;

    const subject = type === 'overdue'
      ? `[${brandName}] Factura Vencida - ${invoice.invoiceNumber}`
      : `[${brandName}] Pago Pendiente - Factura ${invoice.invoiceNumber}`;

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
        ${logoHtml}
        <p>Estimad@ cliente, <b>${invoice.client.businessName || invoice.client.firstName}</b>:</p>
        <p>${textIntro}</p>
        <p><a href="${invoice.pdfUrl}" style="background-color: ${brandColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; font-weight: bold;">Descargar Factura</a></p>
        <p>${textAction}</p>
        
        ${banksHtml}
        
        <p>Un saludo.</p>
        <p><b>Atención al Cliente - ${brandName}</b></p>
      </div>
    `;

    await resend.emails.send({
      from: `facturacion@${brand?.slug || 'crm'}.com`,
      to: invoice.client.contactEmail,
      subject: subject,
      html: emailContent
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
  dateTo?: string
) {
  try {
    const { getInvoiceVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getInvoiceVisibilityFilter();
    
    const whereClause: any = { ...visibilityFilter };

    if (filterType) {
      whereClause.invoiceType = filterType;
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
      whereClause.OR = [
        { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
        { client: { businessName: { contains: searchTerm, mode: 'insensitive' } } },
        { client: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { client: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        { invoiceData: { path: ['NOMBRE/RAZON SOCIAL'], string_contains: searchTerm } },
      ];
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
      let proc = inv.procedenciaHasta || inv.origin;
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
