import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

import { prisma } from '../src/lib/prisma';

async function main() {
  const kData = await prisma.systemComponentPrice.findFirst({
    where: {
      date: new Date('2026-06-01T00:00:00Z'),
      component: { startsWith: 'K' }
    }
  });

  if (kData) {
    console.log(`Component: ${kData.component}`);
    console.log(`Values around index 20:`);
    console.log(`Index 19 (19:00): ${kData.values[19]}`);
    console.log(`Index 20 (20:00): ${kData.values[20]}`);
    console.log(`Index 21 (21:00): ${kData.values[21]}`);
    console.log(`Index 22 (22:00): ${kData.values[22]}`);
  } else {
    console.log("No K data found");
  }
}

main().catch(e => console.error(e));
