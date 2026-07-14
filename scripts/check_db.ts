import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const comp = await prisma.company.findFirst({ where: { name: 'AED Energía Eléctrica, S.L.' } });
  if (!comp) return;

  const res = await prisma.pendingEnergySummary.findMany({
    where: { companyId: comp.id, month: '2026-05' }
  });
  console.log("DB content for 2026-05:", res);
}

main().catch(console.error).finally(() => prisma.$disconnect());
