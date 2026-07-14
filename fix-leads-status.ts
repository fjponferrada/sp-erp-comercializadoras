import { prisma } from './src/lib/prisma';

async function main() {
  const leads = await prisma.lead.findMany({
    include: {
      contract: true,
      documents: true
    }
  });

  let toUpdate = 0;

  for (const l of leads) {
    if (l.status === 'FIRMADO') continue;

    let isSigned = false;
    if (l.contract?.signatureDate) {
      isSigned = true;
    }
    if (l.documents?.some(d => d.type === 'Contrato Firmado' || d.type === 'Contrato firmado' || d.type === 'Signed_PDF')) {
      isSigned = true;
    }
    if (l.airtableData && typeof l.airtableData === 'object' && 'PDF Contrato firmado' in l.airtableData) {
      const pdf = (l.airtableData as any)['PDF Contrato firmado'];
      if (Array.isArray(pdf) && pdf.length > 0) {
        isSigned = true;
      }
    }

    if (isSigned) {
      console.log(`Updating lead ${l.id} (${l.businessName}) to FIRMADO`);
      await prisma.lead.update({
        where: { id: l.id },
        data: { status: 'FIRMADO' }
      });
      toUpdate++;
    }
  }

  console.log(`Updated ${toUpdate} leads.`);
}

main().catch(console.error);
