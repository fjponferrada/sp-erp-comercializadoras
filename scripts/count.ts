import { prisma } from '../src/lib/prisma';

async function run() {
  const c = await prisma.contract.findMany({
    where: { status: 'ACTIVO' },
    include: { supplyPoint: true }
  });
  let res: any = {};
  for(let row of c) {
    let seg = row.supplyPoint?.segment || 'unknown';
    res[seg] = (res[seg] || 0) + 1;
  }
  console.log(res);
  await prisma.$disconnect();
}
run();
