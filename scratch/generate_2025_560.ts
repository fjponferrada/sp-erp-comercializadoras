import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const brandId = 'cmq6j25l50001d441e0c06g9t'; // AED
  const year = 2025;
  
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { company: true },
  });
  const cieDeclarante = brand?.company?.cie || '';

  const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
  const fmt2 = (n: number) => round2(n).toFixed(2);
  const fmt3 = (n: number) => round3(n).toFixed(3);

  const quarters = [
    { q: 1, start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 2, 31, 23, 59, 59, 999)) },
    { q: 2, start: new Date(Date.UTC(year, 3, 1)), end: new Date(Date.UTC(year, 5, 30, 23, 59, 59, 999)) },
    { q: 3, start: new Date(Date.UTC(year, 6, 1)), end: new Date(Date.UTC(year, 8, 30, 23, 59, 59, 999)) },
    { q: 4, start: new Date(Date.UTC(year, 9, 1)), end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)) }
  ];

  for (const { q, start, end } of quarters) {
    const invoices = await prisma.invoice.findMany({
      where: {
        client: { brandId },
        issueDate: { gte: start, lte: end },
      },
      include: { client: true, supplyPoint: true }
    });

    const targetZona = 'España';
    const seenInvoicesGlobal = new Set<string>();
    const filteredInvoices = [];

    for (const inv of invoices) {
      if (inv.invoiceNumber) {
        if (seenInvoicesGlobal.has(inv.invoiceNumber)) continue;
        seenInvoicesGlobal.add(inv.invoiceNumber);
      }
      
      const prov = (inv.supplyPoint?.province || '').toLowerCase();
      let zona = 'España';
      if (prov.includes('navarra')) zona = 'Navarra';
      else if (prov.includes('alava') || prov.includes('álava')) zona = 'Álava';
      else if (prov.includes('guipuzcoa') || prov.includes('guipúzcoa') || prov.includes('gipuzkoa')) zona = 'Guipúzcoa';
      else if (prov.includes('vizcaya') || prov.includes('bizkaia')) zona = 'Vizcaya';

      if (zona === targetZona) {
        filteredInvoices.push(inv);
      }
    }

    let csvContent = '';
    let sbfoBaseImponible = 0;
    let sbfoCantidad = 0;
    let sbfoCuotaIntegra = 0;
    let sbfoCuotaMinima = 0;

    let sbfiBaseImponible = 0;
    let sbfiCantidad = 0;
    let sbfiCuotaIntegra = 0;
    let sbfiCuotaMinima = 0;

    for (const inv of filteredInvoices) {
      const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
      const data = inv.invoiceData as any;

      let subtotal = data ? parseNum(data['Subtotal 1']) : 0;
      let taxAmount = data ? parseNum(data['Importe Impuesto']) : 0;
      let energy = data ? parseNum(data['Energía Total Consumida']) : 0;
      if (energy) energy = energy / 1000;

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

    if (sbfoBaseImponible !== 0 || sbfoCantidad !== 0) {
      csvContent += `SBFO;${cieDeclarante};${fmt2(sbfoBaseImponible)};0.00;${fmt2(sbfoBaseImponible)};${fmt3(sbfoCantidad)};;;;;${fmt2(sbfoCuotaIntegra)};${fmt2(sbfoCuotaMinima)}\n`;
    }

    if (sbfiBaseImponible !== 0 || sbfiCantidad !== 0) {
      csvContent += `SBFI;${cieDeclarante};${fmt2(sbfiBaseImponible)};0.00;${fmt2(sbfiBaseImponible)};${fmt3(sbfiCantidad)};;;;;${fmt2(sbfiCuotaIntegra)};${fmt2(sbfiCuotaMinima)}\n`;
    }

    const outDir = 'Z:\\AED\\AEAT (hasta 16jul)\\560';
    const filePath = path.join(outDir, `Desglose_560_Espaa_2025_T${q}.txt`);
    fs.writeFileSync(filePath, csvContent);
    console.log(`Generated T${q} 2025 with ${filteredInvoices.length} invoices`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
