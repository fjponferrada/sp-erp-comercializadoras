import { prisma } from './src/lib/prisma';
async function run() {
  const jobs = await prisma.scrapingJob.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(jobs);
}
run();
