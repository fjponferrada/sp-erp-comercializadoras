import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { format } from 'date-fns';

async function main() {
  const comp = await prisma.company.findFirst({ where: { name: 'AED Energía Eléctrica, S.L.' } });
  if (!comp) return;

  const startStr = '2026-04-01T00:00:00Z';
  const endStr = '2026-04-30T23:59:59Z';
  const start = new Date(startStr);
  const end = new Date(endStr);

  const reganecuRecords = await prisma.reganecuData.findMany({
    where: {
      companyId: comp.id,
      date: { gte: start, lte: end },
      total: true,
      matricial: false,
      cierre: { in: ['C2', 'C3'] }
    }
  });

  if (reganecuRecords.length === 0) {
    console.log("No se encontraron registros de REGANECU para Abril 2026 en C2 o C3.");
    return;
  }

  const c2 = reganecuRecords.find(r => r.cierre === 'C2');
  const c3 = reganecuRecords.find(r => r.cierre === 'C3');

  console.log(`=== COMPARATIVA DE PRECIOS MEDIOS: ABRIL 2026 (C2 vs C3) ===\n`);

  if (!c2 || !c3) {
    console.log("Falta C2 o C3 en la base de datos.");
    return;
  }

  // Desvíos (DSV)
  const c2Desv = (c2.jsonData as any).DSV || { energyCompras: 0, costObligaciones: 0 };
  const c3Desv = (c3.jsonData as any).DSV || { energyCompras: 0, costObligaciones: 0 };
  
  const c2DesvMwh = c2Desv.energyCompras;
  const c2DesvEur = c2Desv.costObligaciones;
  const c2DesvPrice = c2DesvMwh ? c2DesvEur / c2DesvMwh : 0;

  const c3DesvMwh = c3Desv.energyCompras;
  const c3DesvEur = c3Desv.costObligaciones;
  const c3DesvPrice = c3DesvMwh ? c3DesvEur / c3DesvMwh : 0;

  // OS (Banda Secundaria EXD)
  const c2Banda = (c2.jsonData as any).EXD || { energyCompras: 0, costObligaciones: 0 };
  const c3Banda = (c3.jsonData as any).EXD || { energyCompras: 0, costObligaciones: 0 };
  
  const c2BandaMwh = c2Banda.energyCompras;
  const c2BandaEur = c2Banda.costObligaciones;
  const c2BandaPrice = c2BandaMwh ? c2BandaEur / c2BandaMwh : 0;

  const c3BandaMwh = c3Banda.energyCompras;
  const c3BandaEur = c3Banda.costObligaciones;
  const c3BandaPrice = c3BandaMwh ? c3BandaEur / c3BandaMwh : 0;

  // Costes asignados a la demanda (CAD)
  const c2Demanda = (c2.jsonData as any).CAD || { energyCompras: 0, costObligaciones: 0 };
  const c3Demanda = (c3.jsonData as any).CAD || { energyCompras: 0, costObligaciones: 0 };
  
  const c2DemandaMwh = c2Demanda.energyCompras;
  const c2DemandaEur = c2Demanda.costObligaciones;
  const c2DemandaPrice = c2DemandaMwh ? c2DemandaEur / c2DemandaMwh : 0;

  const c3DemandaMwh = c3Demanda.energyCompras;
  const c3DemandaEur = c3Demanda.costObligaciones;
  const c3DemandaPrice = c3DemandaMwh ? c3DemandaEur / c3DemandaMwh : 0;
  
  // Imprimir
  console.log(`DESVÍOS (COMPRA)`);
  console.log(`  - C2: ${c2DesvMwh.toFixed(2)} MWh | ${c2DesvEur.toFixed(2)} € -> ${c2DesvPrice.toFixed(2)} €/MWh`);
  console.log(`  - C3: ${c3DesvMwh.toFixed(2)} MWh | ${c3DesvEur.toFixed(2)} € -> ${c3DesvPrice.toFixed(2)} €/MWh`);
  console.log(`  -> Variación de precio medio: ${(c3DesvPrice - c2DesvPrice).toFixed(2)} €/MWh\n`);

  console.log(`BANDA SECUNDARIA (OS)`);
  console.log(`  - C2: ${c2BandaMwh.toFixed(2)} MWh | ${c2BandaEur.toFixed(2)} € -> ${c2BandaPrice.toFixed(2)} €/MWh`);
  console.log(`  - C3: ${c3BandaMwh.toFixed(2)} MWh | ${c3BandaEur.toFixed(2)} € -> ${c3BandaPrice.toFixed(2)} €/MWh`);
  console.log(`  -> Variación de precio medio: ${(c3BandaPrice - c2BandaPrice).toFixed(2)} €/MWh\n`);

  console.log(`COSTES ASIGNADOS A LA DEMANDA (RESTRICCIONES)`);
  console.log(`  - C2: ${c2DemandaMwh.toFixed(2)} MWh | ${c2DemandaEur.toFixed(2)} € -> ${c2DemandaPrice.toFixed(2)} €/MWh`);
  console.log(`  - C3: ${c3DemandaMwh.toFixed(2)} MWh | ${c3DemandaEur.toFixed(2)} € -> ${c3DemandaPrice.toFixed(2)} €/MWh`);
  console.log(`  -> Variación de precio medio: ${(c3DemandaPrice - c2DemandaPrice).toFixed(2)} €/MWh\n`);
  
  console.log('--- Raw Data C3 ---');
  console.log(JSON.stringify(c3.jsonData, null, 2).substring(0, 500) + '...');
}

main().catch(console.error).finally(() => prisma.$disconnect());
