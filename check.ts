import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import { getUserVisibilityFilter } from './src/lib/permissions';

async function main() {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        contract: {},
        issueDate: { not: null }
      },
      select: {
        issueDate: true,
        baseImponibleIva: true,
        invoiceType: true,
        totalMWh: true,
        margin: true
      }
    });
    console.log("Found invoices:", invoices.length);

    const contracts = await prisma.contract.findMany({
      where: {
        status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] }
      },
      select: {
        activationDate: true,
        terminationDate: true,
        supplyPoint: {
          select: { annualConsumption: true }
        }
      }
    });
    console.log("Found contracts:", contracts.length);

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
