import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to:", process.env.DATABASE_URL);
  try {
    const count = await prisma.contract.count();
    console.log("Count:", count);
  } catch (e: any) {
    console.error("Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
