import { prisma } from '../src/lib/prisma';

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { commissionFinal: null, airtableData: { not: Prisma.AnyNull } }
  });

  let updated = 0;
  for (const c of contracts) {
    const data = c.airtableData as any;
    if (!data) continue;

    let comision = null;
    if (typeof data['COMISION FINAL'] === 'number') comision = data['COMISION FINAL'];
    else if (typeof data['COMISION ESTIMADA'] === 'number') comision = data['COMISION ESTIMADA'];
    else if (typeof data['COMISION_ESTIMADA'] === 'number') comision = data['COMISION_ESTIMADA'];
    else if (Array.isArray(data['COMISION (from COMISIONES)']) && typeof data['COMISION (from COMISIONES)'][0] === 'number') {
      comision = data['COMISION (from COMISIONES)'][0];
    }

    if (comision !== null && !isNaN(comision)) {
      await prisma.contract.update({
        where: { id: c.id },
        data: { commissionFinal: comision }
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} contracts with missing commissionFinal.`);
}

import { Prisma } from '@prisma/client';
main().finally(() => prisma.$disconnect());
