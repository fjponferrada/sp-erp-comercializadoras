import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { format } from 'date-fns';

async function main() {
  const comp = await prisma.company.findFirst({ where: { name: 'AED Energía Eléctrica, S.L.' } });
  if (!comp) return;

  const startStr = '2026-04-01T00:00:00Z';
  const endStr = '2026-04-30T23:59:59Z';

  // Obtener matriciales C2
  const c2Matricial = await prisma.reganecuData.findMany({
    where: {
      companyId: comp.id,
      date: { gte: new Date(startStr), lte: new Date(endStr) },
      matricial: true,
      cierre: 'C2'
    }
  });

  // Obtener matriciales C3
  const c3Matricial = await prisma.reganecuData.findMany({
    where: {
      companyId: comp.id,
      date: { gte: new Date(startStr), lte: new Date(endStr) },
      matricial: true,
      cierre: 'C3'
    }
  });

  // Mapear precios por día y hora
  const c2Prices = new Map<string, number>();
  const c3Prices = new Map<string, number>();

  const processMatricial = (records: any[], map: Map<string, number>) => {
    for (const r of records) {
      const dayKey = format(r.date, 'yyyy-MM-dd');
      const jData = r.jsonData as any[];
      if (!Array.isArray(jData)) continue;

      const isQh = r.resolution === 'QH';
      const aggDsv: Record<number, { eC: number, cO: number }> = {};
      
      for (const item of jData) {
        const period = isQh ? Math.floor((item.period - 1) / 4) + 1 : item.period;
        if (item.concept === 'DSV' || item.concept === 'DVS') {
          if (!aggDsv[period]) aggDsv[period] = { eC: 0, cO: 0 };
          aggDsv[period].eC += (item.energyCompras || 0);
          aggDsv[period].cO += (item.costObligaciones || 0);
        }
      }

      for (const p of Object.keys(aggDsv)) {
        const data = aggDsv[parseInt(p)];
        if (data.eC > 0) {
          map.set(`${dayKey}_${p}`, data.cO / data.eC);
        }
      }
    }
  };

  processMatricial(c2Matricial, c2Prices);
  processMatricial(c3Matricial, c3Prices);

  let hoursCompared = 0;
  let totalDrop = 0;
  
  const drops: { key: string, drop: number, p2: number, p3: number }[] = [];

  for (const [key, p2] of c2Prices.entries()) {
    const p3 = c3Prices.get(key);
    if (p3 !== undefined) {
      hoursCompared++;
      const drop = p2 - p3;
      totalDrop += drop;
      drops.push({ key, drop, p2, p3 });
    }
  }

  drops.sort((a, b) => b.drop - a.drop);

  console.log(`=== ANÁLISIS HORARIO DE DESVÍOS (C2 vs C3) - ABRIL 2026 ===`);
  console.log(`Horas comparadas: ${hoursCompared}`);
  if (hoursCompared > 0) {
    console.log(`Caída media del precio de desvío por hora: ${(totalDrop / hoursCompared).toFixed(2)} €/MWh`);
    console.log(`\n--- TOP 5 HORAS CON MAYOR CAÍDA DE PRECIO ---`);
    for (let i = 0; i < Math.min(5, drops.length); i++) {
      const d = drops[i];
      console.log(`Hora ${d.key}: de ${d.p2.toFixed(2)} a ${d.p3.toFixed(2)} €/MWh (Caída de ${d.drop.toFixed(2)} €/MWh)`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
