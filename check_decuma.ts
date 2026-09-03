import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
  const decumaLike = await prisma.penaltyInvoice.findMany({
    where: { invoiceNumber: { startsWith: 'AEDEN24-12' } },
    include: { contract: true }
  });
  console.log('AEDEN24-12-x invoices:', decumaLike.map(x => ({ num: x.invoiceNumber, cId: x.contractId, code: x.contract?.contractCode })));

  const decumaLike9 = await prisma.penaltyInvoice.findMany({
    where: { invoiceNumber: { startsWith: 'AEDEN24-09' } },
    include: { contract: true }
  });
  console.log('AEDEN24-09-x invoices:', decumaLike9.map(x => ({ num: x.invoiceNumber, cId: x.contractId, code: x.contract?.contractCode })));

  const contracts = await prisma.contract.findMany({
    where: { client: { businessName: { contains: 'DECUMA' } } },
    select: { contractCode: true, penaltyStatus: true, penalization: true, penaltyInvoices: true }
  });
  console.log('DECUMA Contracts:', JSON.stringify(contracts, null, 2));
}
check().finally(()=>process.exit(0));
