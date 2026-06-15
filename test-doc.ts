import { generateContractDocxBuffer } from './src/lib/docGenerator';
import { prisma } from './src/lib/prisma';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: 'cmqcqc644000juw41vlceyn11' },
      include: { Lead: true, product: true, client: true, supplyPoint: true }
    });
    
    if (!contract) return;
    
    console.log("Generating DOCX...");
    const contractDataDocx = {
      numcontrato: contract.contractCode,
      nombretit: contract.client?.businessName,
    };
    
    const docxBuffer = await generateContractDocxBuffer(contractDataDocx, true);
    console.log("DOCX Buffer length:", docxBuffer.length);
    
    // Test docusign (simulated or real call if we extract it)
    // Actually, I can just upload the DOCX to R2 directly instead of trying DocuSign in this test,
    // to see if R2 is the one failing.
  } catch(e) {
    console.error("Error:", e);
  }
}
main();
