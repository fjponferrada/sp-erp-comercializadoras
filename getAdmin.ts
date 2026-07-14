import { prisma } from './src/lib/prisma';

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: 'SUPERADMIN' }
  });
  console.log('SuperAdmins:');
  for (const a of admins) {
    console.log(`Email: ${a.email} | Role: ${a.role}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
