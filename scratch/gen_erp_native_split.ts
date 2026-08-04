import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function run() {
  try {
    const brandId = 'cmq6j25l50001d441e0c06g9t';
    const year = 2026;
    
    const startDate = new Date(Date.UTC(year, 3, 1)); // 2026-04-01
    const endDate = new Date(Date.UTC(year, 5, 30, 23, 59, 59, 999)); // 2026-06-30

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

    const cieDeclarante = brand?.company?.cie || 'ES00014L3007C';

    const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
    const seenInvoices = new Set<string>();

    let csvContentAM = '';
    let csvContentJun = '';

    const dataAM = { sbfoBase: 0, sbfoCantidad: 0, sbfoCuotaIntegra: 0, sbfoCuotaMinima: 0, sbfiBase: 0, sbfiCantidad: 0, sbfiCuotaIntegra: 0, sbfiCuotaMinima: 0 };
    const dataJun = { sbfoBase: 0, sbfoCantidad: 0, sbfoCuotaIntegra: 0, sbfoCuotaMinima: 0, sbfiBase: 0, sbfiCantidad: 0, sbfiCuotaIntegra: 0, sbfiCuotaMinima: 0 };

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
    const fmt2 = (n: number) => round2(n).toFixed(2);
    const fmt3 = (n: number) => round3(n).toFixed(3);

    const targetDate = new Date(Date.UTC(year, 5, 1)); // 2026-06-01

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

      // Check date explicitly
      const isJunio = inv.issueDate.getTime() >= targetDate.getTime();
      const targetAgg = isJunio ? dataJun : dataAM;

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

         const line = `${regimenFiscalDB};${cieDeclarante};${baseImponibleStr};${reduccionStr};${baseLiquidableStr};${cantidadMWhStr};${nifDestinatario};${cieDestinatario};${tension};${concepto};${cuotaIntegraStr};${cuotaMinimaStr}\n`;
         
         if (isJunio) csvContentJun += line;
         else csvContentAM += line;

      } else {
         if (regimenFiscalDB === 'SBFI') {
           targetAgg.sbfiBase += subtotal;
           targetAgg.sbfiCantidad += energy;
           targetAgg.sbfiCuotaIntegra += cuotaIntegra;
           targetAgg.sbfiCuotaMinima += cuotaMinima;
         } else {
           targetAgg.sbfoBase += subtotal;
           targetAgg.sbfoCantidad += energy;
           targetAgg.sbfoCuotaIntegra += cuotaIntegra;
           targetAgg.sbfoCuotaMinima += cuotaMinima;
         }
      }
    }

    const finalize = (csv: string, data: any) => {
      let final = csv;
      if (data.sbfoBase !== 0 || data.sbfoCantidad !== 0) {
        final += `SBFO;${cieDeclarante};${fmt2(data.sbfoBase)};0.00;${fmt2(data.sbfoBase)};${fmt3(data.sbfoCantidad)};;;;;${fmt2(data.sbfoCuotaIntegra)};${fmt2(data.sbfoCuotaMinima)}\n`;
      }
      if (data.sbfiBase !== 0 || data.sbfiCantidad !== 0) {
        final += `SBFI;${cieDeclarante};${fmt2(data.sbfiBase)};0.00;${fmt2(data.sbfiBase)};${fmt3(data.sbfiCantidad)};;;;;${fmt2(data.sbfiCuotaIntegra)};${fmt2(data.sbfiCuotaMinima)}\n`;
      }
      return final;
    };

    csvContentAM = finalize(csvContentAM, dataAM);
    csvContentJun = finalize(csvContentJun, dataJun);

    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_ERP_NATIVO.txt', csvContentAM);
    fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Junio_ERP_NATIVO.txt', csvContentJun);

    console.log("ERP Native Split generated.");
    console.log("AM:", dataAM);
    console.log("Jun:", dataJun);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
