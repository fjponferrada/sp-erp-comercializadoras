import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const comp = await prisma.company.findFirst({ where: { name: 'AED Energía Eléctrica, S.L.' } });
  if (!comp) return;

  const results = await prisma.pendingEnergySummary.findMany({
    where: { companyId: comp.id, month: { in: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'] } },
    orderBy: { month: 'asc' }
  });

  const accountingCosts = {
    '2026-01': 239070.79,
    '2026-02': 92138.47,
    '2026-03': 218190.61,
    '2026-04': 163929.48,
    '2026-05': 245908.52,
  };

  for (const r of results) {
    const cost = accountingCosts[r.month as keyof typeof accountingCosts];
    const eurMwh = cost / r.estimatedBcMwh;
    console.log(`${r.month} | Demanda BC: ${r.estimatedBcMwh.toFixed(2)} MWh | Coste Conta: ${cost} € | Precio Medio: ${eurMwh.toFixed(2)} €/MWh`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
