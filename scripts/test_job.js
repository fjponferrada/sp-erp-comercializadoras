const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const job = await prisma.syncJob.create({
    data: {
      type: 'FTP_SYNC',
      status: 'PENDING',
      logs: 'Test Job'
    }
  });
  console.log('Job created:', job);
  
  await prisma.syncJob.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', progress: 100 }
  });
  console.log('Job completed');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
