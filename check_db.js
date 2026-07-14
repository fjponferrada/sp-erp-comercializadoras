const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const f1s = await prisma.f1Invoice.findMany({
      where: { supplyPoint: { cups: 'ES0031102722873001YA0F' } },
      include: { internalInvoices: true }
    });
    console.log(JSON.stringify(f1s, null, 2));
  } catch(e) { console.error(e) }
}
main().finally(()=>prisma.$disconnect());
