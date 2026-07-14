import { prisma } from './src/lib/prisma';
async function run() {
  await prisma.distributor.updateMany({
    where: { webScrapingActive: true },
    data: { webLastSyncAt: new Date() }
  });
  console.log("Updated");
}
run();
