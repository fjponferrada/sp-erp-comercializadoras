import { prisma } from './src/lib/prisma';

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      invoiceNumber: {
        in: ['A260100331', 'A260202753', 'A260305292']
      }
    },
    include: {
      supplyPoint: true
    }
  });

  console.log(JSON.stringify(invoices.map(i => ({
    number: i.invoiceNumber,
    supplyPointCity: i.supplyPoint?.city,
    invoiceDataPOB: (i.invoiceData as any)?.['POBLACION PS'],
    invoiceDataPOB2: (i.invoiceData as any)?.['Poblacion PS'],
    invoiceDataPOB3: (i.invoiceData as any)?.['Población PS'],
    invoiceDataPOB_SOC: (i.invoiceData as any)?.['POBLACION SOC'],
    cp: (i.invoiceData as any)?.['CP PS'] || i.supplyPoint?.postalCode,
  })), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
