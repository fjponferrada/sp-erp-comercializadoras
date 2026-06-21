import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, brandId: true }
  });
  const brands = await prisma.brand.findMany({
    select: { id: true, companyId: true }
  });
  console.log("USERS:", users);
  console.log("BRANDS:", brands);
}
main().catch(console.error);
