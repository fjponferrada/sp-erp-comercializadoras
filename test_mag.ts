import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const result = await prisma.$queryRaw`SELECT DISTINCT mag FROM "ReganecuData"`;
  console.log(result);
}
main().finally(() => prisma.$disconnect());
