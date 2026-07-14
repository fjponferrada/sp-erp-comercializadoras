import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.product.findMany();
  console.log(products.map(p => ({name: p.name, tariff: p.tariff, type: p.type})));
}
main();
