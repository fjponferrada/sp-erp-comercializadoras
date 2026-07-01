import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function check() {
  const sps = await prisma.supplyPoint.findMany({ select: { cups: true, segment: true }}); 
  const spsMap = new Map(); 
  for (const sp of sps) { 
    const base = sp.cups.length === 22 ? sp.cups.substring(0, 20) : sp.cups; 
    spsMap.set(base, sp.segment); 
    spsMap.set(sp.cups, sp.segment); 
  } 
  
  const lc = await prisma.$queryRaw`
    SELECT cups, 
      (SELECT sum(v) FROM unnest(readings) as v) as total_missed_kwh 
    FROM "LoadCurve" 
    WHERE date >= '2026-03-01' AND date <= '2026-03-31'
  ` as any[]; 
  
  let sum = 0; 
  for (const row of lc) { 
    const segment = spsMap.get(row.cups); 
    if (!segment) {
      sum += Number(row.total_missed_kwh || 0); 
    }
  } 
  console.log('Total missed MWh from empty segment CUPS:', sum / 1000); 
} 
check().finally(() => prisma.$disconnect());
