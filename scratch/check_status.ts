import { prisma } from '../src/lib/prisma';
async function main() {
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: 'cmridkp38001dq041ntpxdevl' },
    select: { status: true, repairData: true, totalAmount: true }
  });
  console.log("Status:", inv.status);
  console.log("Total:", inv.totalAmount);
  console.log("Repair Data:", inv.repairData);
}
main().finally(() => prisma.$disconnect());
