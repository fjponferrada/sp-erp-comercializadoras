import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from './src/lib/prisma';

async function main() {
  const sp = await prisma.supplyPoint.findFirst({
    where: { cups: { startsWith: 'ES0031105584375001HJ0F' } },
    select: {
      cups: true,
      cau: true,
      selfConsumptionType: true,
      cauSubtype: true,
      cauCollective: true,
      cil: true,
      generatorTechnology: true,
      installedPowerGen: true,
      installationType: true,
      meteringScheme: true,
      hasSelfConsumption: true
    }
  });
  console.log(JSON.stringify(sp, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
