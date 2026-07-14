import { prisma } from '../src/lib/prisma';

async function main() {
  const contract = await prisma.contract.findUnique({
    where: { id: 'cmq6yjjae08i1ic4161eq08mw' },
    select: { airtableData: true }
  });

  console.log(JSON.stringify(contract?.airtableData, null, 2));
}

main().finally(() => prisma.$disconnect());
