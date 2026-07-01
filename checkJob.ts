import { prisma } from './src/lib/prisma';
async function main() {
  const job = await prisma.syncJob.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log(JSON.stringify(job, null, 2));
}
main().finally(() => prisma['$disconnect']());
