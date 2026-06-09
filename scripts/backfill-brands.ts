import { prisma } from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    include: { assignedBrands: true }
  });
  
  let updated = 0;
  for (const u of users) {
    if (u.role !== 'SUPERADMIN' && !u.assignedBrands.some(b => b.id === u.brandId)) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          assignedBrands: {
            connect: { id: u.brandId }
          }
        }
      });
      updated++;
    }
  }

  console.log(`Backfilled assignedBrands for ${updated} users.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
