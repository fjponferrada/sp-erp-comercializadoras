async function main() {
  const { prisma } = await import('./src/lib/prisma');
  const rc = await prisma.regulatedCost.findMany({
    where: { concept: 'BONO_SOCIAL' }
  });
  console.log("BONO_SOCIAL:", rc);
}
main().catch(console.error).finally(() => { process.exit(0); });
