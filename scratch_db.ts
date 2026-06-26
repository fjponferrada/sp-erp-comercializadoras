import { prisma } from './src/lib/prisma';

async function main() {
  const omie = await prisma.systemComponentPrice.findFirst({
    where: { component: 'OMIE' }
  });
  console.log("OMIE values length:", omie ? omie.values.length : "NOT FOUND");
  if (omie) {
    console.log("First 5 values:", omie.values.slice(0, 5));
  }
}
main();
