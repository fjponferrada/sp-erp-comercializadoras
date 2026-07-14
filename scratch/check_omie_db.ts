import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

import { prisma } from '../src/lib/prisma';

async function main() {
  const priceData = await prisma.systemComponentPrice.findFirst({
    where: {
      date: new Date('2026-06-01T00:00:00Z'),
      component: 'OMIE'
    }
  });

  if (priceData) {
    console.log(`OMIE Array for June 1st:`);
    priceData.values.forEach((v, i) => {
      console.log(`Index ${i} (Hour ${i}): ${v}`);
    });
  } else {
    console.log("No OMIE data found for June 1st");
  }
}

main()
  .catch(e => console.error(e))
