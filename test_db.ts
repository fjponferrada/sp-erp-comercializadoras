import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const count = await prisma.loadCurve.count({ where: { cups: 'ES0031105637126001AF0F' } });
  console.log('Count for CUPS ES0031105637126001AF0F:', count);
  const sample = await prisma.loadCurve.findFirst({ select: { cups: true, date: true } });
  console.log('Sample record from DB:', sample);
}

main().catch(console.error).finally(() => process.exit(0));
