import { prisma } from '../src/lib/prisma';
async function main() {
  const inv = await prisma.internalInvoice.findUnique({
    where: { id: 'cmridkp38001dq041ntpxdevl' },
    select: { invoiceData: true }
  });
  console.log("DB excedentesAutoconsumo:", (inv.invoiceData as any).excedentesAutoconsumo);
}
main().finally(() => prisma.$disconnect());
