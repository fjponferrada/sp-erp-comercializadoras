async function main() {
  const { prisma } = await import('./src/lib/prisma');
  const inv = await prisma.issuedInvoice.findFirst({
    where: { xmlUrl: { not: null } }
  });
  console.log("IssuedInvoice with XML:", inv?.id, inv?.xmlUrl);
}
main().catch(console.error).finally(() => { process.exit(0); });
