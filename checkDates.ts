import { prisma } from './src/lib/prisma';
async function run() {
  const d = await prisma.distributor.findMany({ where: { webScrapingActive: true }, select: { name: true, webLastSyncAt: true, webScrapingActive: true } });
  console.log(d);
}
run();
