import { prisma } from '../src/lib/prisma';
async function main() {
  const draft = await prisma.internalInvoice.findUnique({
    where: { id: 'cmridkp38001dq041ntpxdevl' },
    include: { f1Invoice: { include: { contract: true } } }
  });
  console.log("f1InvoiceId:", draft.f1InvoiceId);
  console.log("f1Invoice contract:", draft.f1Invoice?.contract?.id);
}
main().finally(() => prisma.$disconnect());
