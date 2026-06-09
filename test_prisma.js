const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.contract.findUnique({ where: { id: 'cmq511iy8001k1c41h6h9euco' }, include: { lead: true, supplyPoint: true } });
  console.log('Contract p1Efrom:', c.p1EfromPRODUCTOS);
  console.log('Lead p1Efrom:', c.lead?.p1EfromPRODUCTOS);
  console.log('Contract keys:', Object.keys(c).filter(k => k.toLowerCase().includes('p1e')));
}
main();
