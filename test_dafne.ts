import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  console.log("Calculando DAFNE para 2026...");
  const startDate = new Date('2026-01-01T00:00:00.000Z');
  const endDate = new Date('2026-12-31T23:59:59.999Z');

  try {
    const result = await prisma.$queryRaw`
      SELECT SUM(val) as total
      FROM "LoadCurve", unnest(readings) as val
      WHERE date >= ${startDate} AND date <= ${endDate}
    `;
    console.log(result);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
