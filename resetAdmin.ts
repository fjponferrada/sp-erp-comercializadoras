import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  await prisma.user.updateMany({
    where: { email: 'admin@migracion.com' },
    data: { password: hash }
  });
  console.log('Password reset to 123456 for admin@migracion.com');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
