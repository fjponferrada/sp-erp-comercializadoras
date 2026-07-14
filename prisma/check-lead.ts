import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { prisma } from '../src/lib/prisma';

async function main() {
  const lead = await prisma.lead.findUnique({
    where: { id: 'cmqcx49uh00004k412pkd1bz0' }
  });
  console.log('Lead found:', lead ? 'YES' : 'NO');
}

main().then(() => prisma.$disconnect());
