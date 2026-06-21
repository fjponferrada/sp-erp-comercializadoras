import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.distributor.updateMany({
    where: { webScrapingActive: true },
    data: { webLastSyncAt: new Date() }
  });
  console.log("Updated webLastSyncAt for active distributors");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
