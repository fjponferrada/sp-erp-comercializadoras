import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function check() {
  const orphans = await prisma.$queryRaw`
    SELECT count(*) as count
    FROM "LoadCurve" lc
    LEFT JOIN "SupplyPoint" sp 
      ON substring(sp.cups from 1 for 20) = lc.cups OR sp.cups = lc.cups
    WHERE lc.date >= '2026-03-01' AND lc.date <= '2026-03-31'
      AND (sp.id IS NULL OR sp.segment IS NULL OR sp.segment = '')
  `;
  console.log('Orphaned LoadCurves in March 2026:', orphans);
  
  const orphanSum = await prisma.$queryRaw`
    SELECT sum(
      (SELECT sum(v::numeric) FROM jsonb_array_elements_text(lc.readings) as v)
    ) as total_missed_mwh
    FROM "LoadCurve" lc
    LEFT JOIN "SupplyPoint" sp 
      ON substring(sp.cups from 1 for 20) = lc.cups OR sp.cups = lc.cups
    WHERE lc.date >= '2026-03-01' AND lc.date <= '2026-03-31'
      AND (sp.id IS NULL OR sp.segment IS NULL OR sp.segment = '')
  `;
  console.log('Total Energy (MWh?) orphaned in March 2026:', orphanSum);
}
check().finally(() => prisma.$disconnect());
