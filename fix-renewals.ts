import { prisma } from './src/lib/prisma';

async function main() {
  const renewals = await prisma.contract.findMany({
    where: {
      tipo: 'R',
      status: 'ACTIVO',
    }
  });

  let count = 0;
  for (const r of renewals) {
    if (r.activationDate) {
      await prisma.contract.update({
        where: { id: r.id },
        data: {
          permanenceStartDate: r.activationDate
        }
      });
      count++;
    }
  }

  console.log('Fixed', count, 'renewals');
}

main().catch(console.error).finally(() => process.exit(0));
