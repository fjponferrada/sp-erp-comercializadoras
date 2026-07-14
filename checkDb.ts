import { prisma } from './src/lib/prisma';
async function run() {
  const comps = await prisma.systemComponentPrice.findMany({
    distinct: ['component'],
    select: { component: true }
  });
  console.log(comps);
}
run().finally(() => prisma['$disconnect']());
