import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const brandId = 'cmq6j25ko0000d44130cfn6oz';
  const targetZona = 'España';
  const year = 2026;
  
  const invoices = await prisma.invoice.findMany({
    where: {
      client: { brandId },
      issueDate: {
        gte: new Date('2026-04-01T00:00:00.000Z'),
        lte: new Date('2026-06-30T23:59:59.999Z')
      }
    },
    include: { supplyPoint: true, client: true }
  });
  
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: { company: true }
  });
  
  const cieDeclarante = brand?.company?.cif || '';
  const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
  
  let sbfoBaseImponible = 0;
  let sbfoCantidad = 0;
  let sbfoCuotaIntegra = 0;
  let sbfoCuotaMinima = 0;
  const fmt2 = (n: number) => n.toFixed(2);
  const fmt3 = (n: number) => n.toFixed(3);
  let csvContent = '';

  for (const inv of invoices) {
    const data = inv.invoiceData as any;
    let subtotal = data ? parseNum(data['Subtotal 1']) : 0;
    let taxAmount = data ? parseNum(data['Importe Impuesto']) : 0;
    let energy = data ? parseNum(data['Energía Total Consumida']) : 0;
    if (energy) energy = energy / 1000;

    if (taxAmount === 0) continue;

    let isMinApplied = false;
    const minSuperadoValue = data ? (data['Minimo Importe IE Superado'] ?? data.minimoImporteIESuperado) : undefined;
    if (minSuperadoValue !== undefined && String(minSuperadoValue).trim() !== '') {
        const flag = String(minSuperadoValue).trim().toLowerCase();
        isMinApplied = flag === '0' || flag === 'false';
    } else {
        if (energy !== 0) {
          const ratio = Math.abs(taxAmount / energy);
          if (Math.abs(ratio - 0.5) < 0.05 || Math.abs(ratio - 1.0) < 0.05) isMinApplied = true;
        }
    }

    const prov = (inv.supplyPoint?.province || '').toLowerCase();
    let zona = 'España';
    if (prov.includes('navarra')) zona = 'Navarra';
    else if (prov.includes('alava') || prov.includes('álava')) zona = 'Álava';
    else if (prov.includes('guipuzcoa') || prov.includes('guipúzcoa') || prov.includes('gipuzkoa')) zona = 'Guipúzcoa';
    else if (prov.includes('vizcaya') || prov.includes('bizkaia')) zona = 'Vizcaya';

    if (targetZona && targetZona !== zona) continue;

    let cuotaIntegra = 0;
    let cuotaMinima = 0;
    if (isMinApplied) cuotaMinima = taxAmount;
    else cuotaIntegra = taxAmount;

    if (inv.supplyPoint?.ieDiscount && inv.supplyPoint.ieDiscount > 0) {
        const reduccionValue = subtotal * (inv.supplyPoint.ieDiscount / 100);
        const baseLiquidableValue = subtotal - reduccionValue;
        csvContent += `98.1E;${cieDeclarante};${fmt2(subtotal)};${fmt2(reduccionValue)};${fmt2(baseLiquidableValue)};${fmt3(energy)};${inv.client?.vatNumber || ''};${inv.supplyPoint?.cie || ''};${data?.['Tarifa']?.toString().startsWith('6.') ? 'A' : ''};;${fmt2(cuotaIntegra)};${fmt2(cuotaMinima)}\n`;
    } else {
        sbfoBaseImponible += subtotal;
        sbfoCantidad += energy;
        sbfoCuotaIntegra += cuotaIntegra;
        sbfoCuotaMinima += cuotaMinima;
    }
  }

  if (sbfoBaseImponible !== 0 || sbfoCantidad !== 0) {
    csvContent += `SBFO;${cieDeclarante};${fmt2(sbfoBaseImponible)};0.00;${fmt2(sbfoBaseImponible)};${fmt3(sbfoCantidad)};;;;;${fmt2(sbfoCuotaIntegra)};${fmt2(sbfoCuotaMinima)}\n`;
  }
  
  console.log('--- OUTPUT CSV ---');
  console.log(csvContent);
}
main();
