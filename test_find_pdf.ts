async function main() {
  const { prisma } = await import('./src/lib/prisma');
  const inv = await prisma.invoice.findUnique({
    where: { id: "cmqi6b7xj015hzs41qv3rk24c" }
  });
  console.log("PDF URL:", inv?.pdfUrl);
  console.log("XML URL:", inv?.xmlUrl);
}
main().catch(console.error).finally(() => { process.exit(0); });
