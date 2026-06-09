import { authConfig } from './src/auth.config';
import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const credentials = { email: 'fjponferrada@sp-energia.com', password: 'SpEnergia2026!' };
  
  if (!credentials?.email || !credentials?.password) {
    console.log('No credentials');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: credentials.email as string },
    include: { 
      brand: { include: { company: true } }, 
      assignedBrands: { include: { company: true } } 
    },
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  const passwordOk = await bcrypt.compare(
    credentials.password as string,
    user.password,
  );
  
  if (!passwordOk) {
    console.log('Password mismatch');
    return;
  }

  console.log('Login successful inside authorize mock!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
