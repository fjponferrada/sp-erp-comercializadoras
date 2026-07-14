import { prisma } from './src/lib/prisma';

async function main() {
  const now = new Date();
  await prisma.distributor.updateMany({
    data: { ftpLastSyncAt: now }
  });
  console.log(`Restored ftpLastSyncAt to ${now.toISOString()} to prevent re-downloads.`);
}

main().catch(console.error).finally(() => process.exit(0));
