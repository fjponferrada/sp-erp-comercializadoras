import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const comp = await prisma.company.findFirst({ where: { name: 'AED Energía Eléctrica, S.L.' } });
  if (!comp) return;

  const startStr = '2026-04-01T00:00:00Z';
  const endStr = '2026-04-30T23:59:59Z';
  
  const records = await prisma.reganecuData.count({
    where: {
      companyId: comp.id,
      date: { gte: new Date(startStr), lte: new Date(endStr) },
      matricial: true,
      cierre: 'C2'
    }
  });

  console.log(`Registros matriciales en C2 para abril 2026: ${records}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
