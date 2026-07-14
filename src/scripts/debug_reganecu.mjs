import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.reganecuData.findFirst({
    where: { total: true },
    orderBy: { date: 'desc' }
  });
  console.log(JSON.stringify(data, null, 2));
}
main().then(() => process.exit(0));
