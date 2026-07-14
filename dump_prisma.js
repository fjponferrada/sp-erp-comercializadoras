const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const invs = await prisma.invoice.findMany({
    where: { OR: [ { pDF: { not: null } }, { xML: { not: null } } ] },
    take: 5
  });
  console.log('With pDF/xML:', invs.length);

  const colodrero = await prisma.invoice.findUnique({ where: { invoiceNumber: 'A260511025' } });
  if (colodrero) {
    console.log('A260511025 pDF:', colodrero.pDF);
    console.log('A260511025 xML:', colodrero.xML);
  }
}
main();
