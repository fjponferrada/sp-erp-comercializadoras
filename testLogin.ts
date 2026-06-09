import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'fjponferrada@sp-energia.com' }
  });
  if (!user) {
    console.log('User not found');
    return;
  }
  const passwordOk = await bcrypt.compare('SpEnergia2026!', user.password);
  console.log('Password match:', passwordOk);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
