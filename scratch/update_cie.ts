import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const sp = await prisma.supplyPoint.updateMany({
    where: { cups: 'ES0031102722873001YA0F' },
    data: {
      cie: 'ES00041LA319P',
      ieDiscount: 85
    }
  });
  console.log(`Updated ${sp.count} supply points.`);
}
main();
