import { prisma } from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    include: { assignedBrands: true }
  });
  
  let noAssigned = 0;
  users.forEach(u => {
    if (u.role !== 'SUPERADMIN' && u.assignedBrands.length === 0) {
      noAssigned++;
    }
  });

  console.log(`${noAssigned} out of ${users.length} users have NO assignedBrands!`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
