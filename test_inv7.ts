async function main() {
  const { prisma } = await import('./src/lib/prisma');
  const inv = await prisma.f1Invoice.findUnique({
    where: { id: "cmqlldz3p00037841bx4e25vk" },
    include: { invoices: true }
  });
  console.log("Factura 7 Dates:", inv?.billingStart, "to", inv?.billingEnd);
  console.log("Total MWh:", inv?.invoices[0]?.totalMWh);
}
main().catch(console.error).finally(() => { process.exit(0); });
