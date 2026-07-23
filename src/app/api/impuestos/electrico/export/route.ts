import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.brandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const brandId = session.user.brandId;
    const url = new URL(req.url);
    const yearStr = url.searchParams.get('year');
    const quarterStr = url.searchParams.get('quarter');
    const targetZona = url.searchParams.get('zona');

    if (!yearStr || !quarterStr) {
      return NextResponse.json({ error: 'Falta year o quarter' }, { status: 400 });
    }

    const year = parseInt(yearStr);
    const quarter = parseInt(quarterStr);

    let startDate: Date;
    let endDate: Date;

    if (quarter === 1) {
      startDate = new Date(Date.UTC(year, 0, 1));
      endDate = new Date(Date.UTC(year, 2, 31, 23, 59, 59, 999));
    } else if (quarter === 2) {
      startDate = new Date(Date.UTC(year, 3, 1));
      endDate = new Date(Date.UTC(year, 5, 30, 23, 59, 59, 999));
    } else if (quarter === 3) {
      startDate = new Date(Date.UTC(year, 6, 1));
      endDate = new Date(Date.UTC(year, 8, 30, 23, 59, 59, 999));
    } else {
      startDate = new Date(Date.UTC(year, 9, 1));
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        client: { brandId },
        issueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        supplyPoint: true,
        client: true,
      },
    });

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { company: true },
    });

    const cieDeclarante = brand?.company?.cie || '';

    const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
    const seenInvoices = new Set<string>();

    let csvContent = '';

    // Aggregators for SBFO and SBFI
    let sbfoBaseImponible = 0;
    let sbfoCantidad = 0;
    let sbfoCuotaIntegra = 0;
    let sbfoCuotaMinima = 0;

    let sbfiBaseImponible = 0;
    let sbfiCantidad = 0;
    let sbfiCuotaIntegra = 0;
    let sbfiCuotaMinima = 0;

    // Helper for formatting
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
    const fmt2 = (n: number) => round2(n).toFixed(2);
    const fmt3 = (n: number) => round3(n).toFixed(3);

    for (const inv of invoices) {
      if (inv.invoiceNumber) {
        if (seenInvoices.has(inv.invoiceNumber)) continue;
        seenInvoices.add(inv.invoiceNumber);
      }

      const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
      const data = inv.invoiceData as any;

      let subtotal = data ? parseNum(data['Subtotal 1']) : 0;
      let taxAmount = data ? parseNum(data['Importe Impuesto']) : 0;
      let energy = data ? parseNum(data['Energía Total Consumida']) : 0;
      if (energy) energy = energy / 1000; // Convert to MWh

      // Skip entirely empty invoices
      if (subtotal === 0 && energy === 0 && taxAmount === 0) continue;

      if (isAbono) {
        if (subtotal > 0) subtotal = -subtotal;
        if (taxAmount > 0) taxAmount = -taxAmount;
        if (energy > 0) energy = -energy;
      }

      let isMinApplied = false;
      const minSuperadoValue = data ? (data['Minimo Importe IE Superado'] ?? data.minimoImporteIESuperado) : undefined;
      
      if (minSuperadoValue !== undefined && String(minSuperadoValue).trim() !== '') {
         const flag = String(minSuperadoValue).trim().toLowerCase();
         isMinApplied = flag === '0' || flag === 'false';
      } else {
         if (energy !== 0 && taxAmount !== 0) {
            const ratio = Math.abs(taxAmount / energy);
            if (Math.abs(ratio - 0.5) < 0.05 || Math.abs(ratio - 1.0) < 0.05) {
               isMinApplied = true;
            }
         }
      }

      const cp = inv.supplyPoint?.postalCode?.trim() || '';
      const prov = (inv.supplyPoint?.province || '').toLowerCase();
      
      let zona = 'España';
      
      if (cp.startsWith('31') || prov.includes('navarra')) {
        zona = 'Navarra';
      } else if (cp.startsWith('01') || prov.includes('alava') || prov.includes('álava')) {
        zona = 'Álava';
      } else if (cp.startsWith('20') || prov.includes('guipuzcoa') || prov.includes('guipúzcoa') || prov.includes('gipuzkoa')) {
        zona = 'Guipúzcoa';
      } else if (cp.startsWith('48') || prov.includes('vizcaya') || prov.includes('bizkaia')) {
        zona = 'Vizcaya';
      }

      if (targetZona && targetZona !== zona) {
        continue;
      }

      let cuotaIntegra = 0;
      let cuotaMinima = 0;
      if (isMinApplied) {
        cuotaMinima = taxAmount;
      } else {
        cuotaIntegra = taxAmount;
      }

      let regimenFiscalDB = inv.supplyPoint?.regimenFiscal;

      if (!regimenFiscalDB || regimenFiscalDB === 'SBFO' || regimenFiscalDB === 'SBFI') {
         const cnaeStr = (inv.supplyPoint?.cnae || '').trim();
         const cnaePrefix = parseInt(cnaeStr.substring(0, 2), 10);
         if (!isNaN(cnaePrefix) && cnaePrefix >= 5 && cnaePrefix <= 33) {
            regimenFiscalDB = 'SBFI';
         } else {
            regimenFiscalDB = 'SBFO';
         }
      }

      if (regimenFiscalDB !== 'SBFO' && regimenFiscalDB !== 'SBFI') {
         // EXENTO/REDUCIDO: Individual line
         const reduccionValue = (inv.supplyPoint?.ieDiscount && inv.supplyPoint.ieDiscount > 0) 
            ? round2(subtotal * (inv.supplyPoint.ieDiscount / 100)) 
            : 0;
         const baseLiquidableValue = round2(subtotal - reduccionValue);

         const baseImponibleStr = fmt2(subtotal);
         const reduccionStr = fmt2(reduccionValue);
         const baseLiquidableStr = fmt2(baseLiquidableValue);
         const cantidadMWhStr = fmt3(energy);
         let nifDestinatario = inv.client?.vatNumber || '';
         let cieDestinatario = inv.supplyPoint?.cie || ''; 
         
         // Enforce PDF validation matrix for empty NIF/CIE
         const noNifRegimes = ['94.1', '94.2', '94.3', '94.4', '94.10'];
         if (noNifRegimes.includes(regimenFiscalDB)) nifDestinatario = '';

         const noCieRegimes = ['94.1', '94.2', '94.3', '94.4', '94.8', '94.9', '94.10', '98.2', '98.3'];
         if (noCieRegimes.includes(regimenFiscalDB)) cieDestinatario = '';

         const tarifa = data?.['Tarifa']?.toString() || '';
         const tension = tarifa.startsWith('6.') ? 'A' : '';
         const concepto = ''; 
         const cuotaIntegraStr = fmt2(cuotaIntegra);
         const cuotaMinimaStr = fmt2(cuotaMinima);

         csvContent += `${regimenFiscalDB};${cieDeclarante};${baseImponibleStr};${reduccionStr};${baseLiquidableStr};${cantidadMWhStr};${nifDestinatario};${cieDestinatario};${tension};${concepto};${cuotaIntegraStr};${cuotaMinimaStr}\n`;
      } else {
         // NORMAL (SBFO or SBFI): Aggregate
         if (regimenFiscalDB === 'SBFI') {
           sbfiBaseImponible += subtotal;
           sbfiCantidad += energy;
           sbfiCuotaIntegra += cuotaIntegra;
           sbfiCuotaMinima += cuotaMinima;
         } else {
           sbfoBaseImponible += subtotal;
           sbfoCantidad += energy;
           sbfoCuotaIntegra += cuotaIntegra;
           sbfoCuotaMinima += cuotaMinima;
         }
      }
    }

    // Add the aggregated SBFO line if there is any data
    if (sbfoBaseImponible !== 0 || sbfoCantidad !== 0) {
      const baseImponibleStr = fmt2(sbfoBaseImponible);
      const cuotaIntegraStr = fmt2(sbfoCuotaIntegra);
      const cuotaMinimaStr = fmt2(sbfoCuotaMinima);
      csvContent += `SBFO;${cieDeclarante};${baseImponibleStr};0.00;${baseImponibleStr};${fmt3(sbfoCantidad)};;;;;${cuotaIntegraStr};${cuotaMinimaStr}\n`;
    }

    // Add the aggregated SBFI line if there is any data
    if (sbfiBaseImponible !== 0 || sbfiCantidad !== 0) {
      const baseImponibleStr = fmt2(sbfiBaseImponible);
      const cuotaIntegraStr = fmt2(sbfiCuotaIntegra);
      const cuotaMinimaStr = fmt2(sbfiCuotaMinima);
      csvContent += `SBFI;${cieDeclarante};${baseImponibleStr};0.00;${baseImponibleStr};${fmt3(sbfiCantidad)};;;;;${cuotaIntegraStr};${cuotaMinimaStr}\n`;
    }

    // Retornamos el archivo de texto
    const filenameZona = targetZona ? targetZona.replace(/[^a-zA-Z0-9]/g, '') : 'Global';
    const response = new NextResponse(csvContent);
    response.headers.set('Content-Type', 'text/plain; charset=utf-8');
    response.headers.set('Content-Disposition', `attachment; filename=Desglose_560_${filenameZona}_${year}_T${quarter}.txt`);
    return response;

  } catch (error: any) {
    console.error('Error exportando AEAT TXT:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
