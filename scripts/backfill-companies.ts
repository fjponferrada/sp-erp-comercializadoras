import { prisma } from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    include: { companies: true, brand: true }
  });
  
  let updated = 0;
  for (const u of users) {
    if (u.role !== 'SUPERADMIN' && u.brand && u.brand.companyId) {
      if (!u.companies.some(c => c.id === u.brand.companyId)) {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            companies: {
              connect: { id: u.brand.companyId }
            }
          }
        });
        updated++;
      }
    }
  }

  console.log(`Backfilled companies for ${updated} users.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
