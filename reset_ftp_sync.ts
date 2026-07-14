import { prisma } from './src/lib/prisma';

async function main() {
  // Rewind ftpLastSyncAt for all distributors by 3 months (or arbitrary duration)
  // Actually, we should probably set it to the beginning of the year or a specific date.
  // Let's set it to Jan 1, 2024 to catch all recent files if possible, or just subtract 6 months.
  
  const distributors = await prisma.distributor.findMany();
  
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() - 6); // Rewind 6 months

  for (const dist of distributors) {
    if (dist.ftpHost) {
      await prisma.distributor.update({
        where: { id: dist.id },
        data: { ftpLastSyncAt: targetDate }
      });
      console.log(`Rewound ${dist.name} ftpLastSyncAt to ${targetDate.toISOString()}`);
    }
  }

  // Clear or set to ERROR the SyncJobs for ftp-sync so the cron doesn't think it's done
  await prisma.syncJob.updateMany({
    where: { type: 'FTP_SYNC', status: 'RUNNING' },
    data: { status: 'ERROR', logs: 'Forced reset to trigger re-download' }
  });

  // Also reset pending files in jobs if any?
  // Wait, the cronjob uses pendingFiles from the latest job if status is OK. We can just delete the jobs or set them to ERROR.
  await prisma.syncJob.deleteMany({
    where: { type: 'FTP_SYNC' }
  });
  console.log('Deleted FTP_SYNC jobs to ensure clean slate.');

  console.log('Reset complete. Next cron execution will re-download files from FTP.');
}

main().catch(console.error).finally(() => process.exit(0));
