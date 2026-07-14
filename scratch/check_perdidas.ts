import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

import { prisma } from '../src/lib/prisma';

async function main() {
  const regCosts = await prisma.regulatedCost.findMany({
    where: {
      concept: 'PERDIDAS',
      tariff: '3.0TDVE'
    }
  });

  console.log(`PERDIDAS BOE for 3.0TDVE:`, regCosts);
}

main()
  .catch(e => console.error(e))
  //.finally(() => prisma.$disconnect());
