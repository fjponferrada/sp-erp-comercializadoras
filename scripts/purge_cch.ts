import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Purging LoadCurve...');
  await prisma.$executeRaw`TRUNCATE TABLE "LoadCurve" CASCADE`;
  console.log('Purging AggregatedLoadCurve...');
  await prisma.$executeRaw`TRUNCATE TABLE "AggregatedLoadCurve" CASCADE`;
  console.log('Done purging.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
