import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const latestJobs = await prisma.syncJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  
  for (const job of latestJobs) {
    console.log(`Job ID: ${job.id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Progress: ${job.progress}`);
    console.log(`CreatedAt: ${job.createdAt}`);
    console.log(`Logs: \n${job.logs?.substring(0, 500)}...\n`);
    console.log(`Results: ${JSON.stringify(job.results, null, 2)}`);
    console.log('-------------------------');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
