import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function compare() {
  const brandId = 'cmq6j25l50001d441e0c06g9t';
  const year = 2026;
  const quarter = 1;

  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 2, 31, 23, 59, 59, 999));

  const invoices = await prisma.invoice.findMany({
    where: { client: { brandId }, issueDate: { gte: startDate, lte: endDate } },
    include: { supplyPoint: true },
  });

  const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
  
  let ui_total = 0;
  let txt_total = 0;
  
  for (const inv of invoices) {
    const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
    const data = inv.invoiceData as any;

    let subtotal = data ? parseNum(data['Subtotal 1']) : 0;
    let taxAmount = data ? parseNum(data['Importe Impuesto']) : 0;
    let energy = data ? parseNum(data['Energía Total Consumida']) : 0;

    if (subtotal === 0 && energy === 0 && taxAmount === 0) continue;
    if (taxAmount === 0) continue;

    if (isAbono) {
      if (subtotal > 0) subtotal = -subtotal;
      if (taxAmount > 0) taxAmount = -taxAmount;
      if (energy > 0) energy = -energy;
    }

    // UI Zona logic
    const prov = (inv.supplyPoint?.province || '').toLowerCase();
    let zonaUI = 'España';
    if (prov.includes('navarra')) zonaUI = 'Navarra';
    else if (prov.includes('alava') || prov.includes('álava')) zonaUI = 'Álava';
    else if (prov.includes('guipuzcoa') || prov.includes('guipúzcoa') || prov.includes('gipuzkoa')) zonaUI = 'Guipúzcoa';
    else if (prov.includes('vizcaya') || prov.includes('bizkaia')) zonaUI = 'Vizcaya';

    // TXT Zona logic
    const cp = inv.supplyPoint?.postalCode?.trim() || '';
    let zonaTXT = 'España';
    if (cp.startsWith('31') || prov.includes('navarra')) zonaTXT = 'Navarra';
    else if (cp.startsWith('01') || prov.includes('alava') || prov.includes('álava')) zonaTXT = 'Álava';
    else if (cp.startsWith('20') || prov.includes('guipuzcoa') || prov.includes('guipúzcoa') || prov.includes('gipuzkoa')) zonaTXT = 'Guipúzcoa';
    else if (cp.startsWith('48') || prov.includes('vizcaya') || prov.includes('bizkaia')) zonaTXT = 'Vizcaya';

    let isMinApplied = false;
    const minSuperadoValue = data ? (data['Minimo Importe IE Superado'] ?? data.minimoImporteIESuperado) : undefined;
    if (minSuperadoValue !== undefined && String(minSuperadoValue).trim() !== '') {
       const flag = String(minSuperadoValue).trim().toLowerCase();
       isMinApplied = flag === '0' || flag === 'false';
    } else {
       if (energy !== 0) {
          const ratio = Math.abs(taxAmount / energy);
          if (Math.abs(ratio - 0.5) < 0.05 || Math.abs(ratio - 1.0) < 0.05) {
             isMinApplied = true;
          }
       }
    }

    if (!isMinApplied) {
      if (zonaUI === 'España') {
        ui_total += taxAmount;
      }
      
      if (zonaTXT === 'España') {
        txt_total += taxAmount;
      }

      if (zonaUI === 'España' && zonaTXT !== 'España') {
        console.log(`Invoice ${inv.invoiceNumber} (ID: ${inv.id}) is in UI España but TXT ${zonaTXT}. TaxAmount: ${taxAmount}`);
      }
      if (zonaTXT === 'España' && zonaUI !== 'España') {
        console.log(`Invoice ${inv.invoiceNumber} (ID: ${inv.id}) is in TXT España but UI ${zonaUI}. TaxAmount: ${taxAmount}`);
      }
    }
  }

  console.log(`\nUI Total Impuesto Base España: ${ui_total}`);
  console.log(`TXT Total Impuesto Base España: ${txt_total}`);
  console.log(`Difference: ${ui_total - txt_total}`);
}

compare().catch(console.error).finally(() => prisma.$disconnect());
