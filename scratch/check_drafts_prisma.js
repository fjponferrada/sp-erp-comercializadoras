const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const res = await prisma.invoice.findFirst({
    where: { f1InvoiceId: 'cmrahn7u2006u04k2rmcrmcgm' },
    orderBy: { createdAt: 'desc' }
  });
  console.log('totalCchMWh:', res.totalCchMWh * 1000);
}

main().catch(console.error);
