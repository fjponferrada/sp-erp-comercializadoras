import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const hash = await bcrypt.hash('SpEnergia2026!', 10);
  await prisma.user.updateMany({
    where: { role: 'SUPERADMIN' },
    data: { 
      email: 'fjponferrada@sp-energia.com',
      password: hash 
    }
  });
  console.log('Superadmin user updated successfully.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
