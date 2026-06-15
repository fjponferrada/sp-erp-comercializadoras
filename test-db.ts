import { prisma } from './src/lib/prisma';

async function main() {
  const c = await prisma.contract.findFirst({
    where: { contractCode: 'AEDJPP2606141916AF0F' },
  });
  console.log("filePdfSigned:", c?.filePdfSigned);
  console.log("airtableData keys:", c?.airtableData ? Object.keys(c.airtableData) : null);
  if (c?.airtableData) {
    const data: any = c.airtableData;
    console.log("PDF Contrato firmado:", data['PDF Contrato firmado']);
    console.log("Contrato .PDF:", data['Contrato .PDF']);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
