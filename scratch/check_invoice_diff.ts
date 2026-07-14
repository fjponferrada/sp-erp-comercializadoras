import { prisma } from '../src/lib/prisma';

async function main() {
  const invoice = await prisma.internalInvoice.findFirst({
    where: {
      contract: {
        supplyPoint: {
          cups: 'ES0031405446869086QD0F'
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!invoice) {
    console.log('Invoice not found');
    return;
  }

  console.log('--- INVOICE DETAILS ---');
  console.log('Base:', invoice.subtotal1);
  console.log('Total:', invoice.totalAmount);
  
  const data = invoice.invoiceData as any;
  console.log('Power Cost:', data.powerCost);
  console.log('FEE Cost:', data.feeCost);
  console.log('FNEE Cost:', data.fneeCost);
  console.log('Energy Cost:', data.energyCost);
  console.log('Alquiler:', data.alquilerEquipo);
  console.log('Bono Social:', data.bonoSocial);
  console.log('Tax Electric:', data.taxElectric);

  console.log('\n--- POWER DETAILS ---');
  console.log(JSON.stringify(data.powerDetails, null, 2));

  console.log('\n--- ENERGY ATR DETAILS ---');
  console.log(JSON.stringify(data.energyAtrDetails, null, 2));

  console.log('\n--- ENERGY MARKET DETAILS ---');
  console.log(JSON.stringify(data.energyMarketDetails, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
