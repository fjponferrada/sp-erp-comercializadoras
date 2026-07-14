import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const brandId = 'cmq6j25l50001d441e0c06g9t'; // Correct Brand ID for AED
  const year = 2026;
  
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { company: true },
  });
  const cieDeclarante = brand?.company?.cie || '';

  const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
  
  const allInvoices = await prisma.invoice.findMany({
    where: {
      companyId: brand?.companyId,
      issueDate: {
        gte: new Date(2026, 3, 1),
        lte: new Date(2026, 5, 31)
      }
    },
    include: { client: true, supplyPoint: true }
  });

  const invoices05 = [];
  const invoices511 = [];

  const targetZona = 'España';
  const seenInvoicesGlobal = new Set<string>();
  for (const inv of allInvoices) {
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

    if (zona !== targetZona) {
      continue;
    }

    const devengoDate = inv.billingEnd || inv.issueDate;
    if (devengoDate < new Date(2026, 5, 1)) {
      invoices05.push(inv);
    } else {
      invoices511.push(inv);
    }
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
  const fmt2 = (n: number) => round2(n).toFixed(2);
  const fmt3 = (n: number) => round3(n).toFixed(3);

  function generateTxt(invoicesSubset: any[]) {
    let csvContent = '';

    let sbfoBaseImponible = 0;
    let sbfoCantidad = 0;
    let sbfoCuotaIntegra = 0;
    let sbfoCuotaMinima = 0;

    let sbfiBaseImponible = 0;
    let sbfiCantidad = 0;
    let sbfiCuotaIntegra = 0;
    let sbfiCuotaMinima = 0;

    for (const inv of invoicesSubset) {
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
      const baseImponibleStr = fmt2(sbfoBaseImponible);
      const cuotaIntegraStr = fmt2(sbfoCuotaIntegra);
      const cuotaMinimaStr = fmt2(sbfoCuotaMinima);
      csvContent += `SBFO;${cieDeclarante};${baseImponibleStr};0.00;${baseImponibleStr};${fmt3(sbfoCantidad)};;;;;${cuotaIntegraStr};${cuotaMinimaStr}\n`;
    }

    if (sbfiBaseImponible !== 0 || sbfiCantidad !== 0) {
      const baseImponibleStr = fmt2(sbfiBaseImponible);
      const cuotaIntegraStr = fmt2(sbfiCuotaIntegra);
      const cuotaMinimaStr = fmt2(sbfiCuotaMinima);
      csvContent += `SBFI;${cieDeclarante};${baseImponibleStr};0.00;${baseImponibleStr};${fmt3(sbfiCantidad)};;;;;${cuotaIntegraStr};${cuotaMinimaStr}\n`;
    }

    return csvContent;
  }

  const outDir = 'Z:\\AED\\AEAT (hasta 16jul)\\560';
  
  const content05 = generateTxt(invoices05);
  fs.writeFileSync(path.join(outDir, 'Desglose_560_Espaa_2026_T2_Abril_Mayo_0.5.txt'), content05);
  console.log('Generated 0.5 file with ' + invoices05.length + ' invoices');

  const content511 = generateTxt(invoices511);
  fs.writeFileSync(path.join(outDir, 'Desglose_560_Espaa_2026_T2_Junio_5.11.txt'), content511);
  console.log('Generated 5.11 file with ' + invoices511.length + ' invoices');
}

main().catch(console.error).finally(() => prisma.$disconnect());
