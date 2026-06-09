import { prisma } from './src/lib/prisma';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'fjponferrada@sp-energia.com' },
    include: { brand: true }
  });
  console.log(user);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
