import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const clientsWithoutBrands = await prisma.user.count({
    where: {
      role: 'CLIENT',
      assignedBrands: {
        none: {}
      }
    }
  });

  console.log(`Clients without assignedBrands: ${clientsWithoutBrands}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
