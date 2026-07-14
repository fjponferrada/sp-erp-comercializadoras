import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const invoices = await prisma.invoice.findMany({
    take: 100,
    include: {
      supplyPoint: true,
      client: true,
    },
    where: {
      issueDate: {
        gte: new Date('2026-04-01T00:00:00.000Z'),
        lte: new Date('2026-06-30T23:59:59.999Z')
      }
    }
  });

  const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
  let printed = 0;

  console.log("--- 3 LÍNEAS ALEATORIAS DEL FICHERO ---");
  for (const inv of invoices.sort(() => 0.5 - Math.random())) {
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

    const fmt2 = (n: number) => n.toFixed(2);
    const fmt3 = (n: number) => n.toFixed(3);

    let regimenFiscal = 'SBFO';
    let reduccionValue = 0;
    let baseLiquidableValue = subtotal;

    if (inv.supplyPoint?.ieDiscount && inv.supplyPoint.ieDiscount > 0) {
        reduccionValue = subtotal * (inv.supplyPoint.ieDiscount / 100);
        baseLiquidableValue = subtotal - reduccionValue;
        regimenFiscal = '98.1E'; 
    }

    const baseImponible = fmt2(subtotal);
    const reduccion = fmt2(reduccionValue);
    const baseLiquidable = fmt2(baseLiquidableValue);
    const cantidadMWh = fmt3(energy);
    const nifDestinatario = inv.client?.vatNumber || '';
    const cieDestinatario = inv.supplyPoint?.cie || ''; 
    const tarifa = data?.['Tarifa']?.toString() || '';
    const tension = tarifa.startsWith('6.') ? 'A' : '';
    const concepto = ''; 
    let cuotaIntegra = '0.00';
    let cuotaIntegraMinima = '0.00';
    
    if (isMinApplied) {
      cuotaIntegraMinima = fmt2(taxAmount);
    } else {
      cuotaIntegra = fmt2(taxAmount);
    }

    const line = `${regimenFiscal};;${baseImponible};${reduccion};${baseLiquidable};${cantidadMWh};${nifDestinatario};${cieDestinatario};${tension};${concepto};${cuotaIntegra};${cuotaIntegraMinima}`;
    console.log(line);
    
    printed++;
    if (printed >= 3) break;
  }
}
main();
