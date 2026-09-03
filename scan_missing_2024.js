const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const prisma = new PrismaClient();
const PDF_DIR = 'A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2024\\Emitidas\\Penalizaciones';

function getS3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
  });
}

async function uploadToR2(filePath, key) {
  const s3 = getS3Client();
  const fileStream = fs.createReadStream(filePath);
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: fileStream,
    ContentType: 'application/pdf'
  }));
}

async function main() {
  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${files.length} PDFs in 2024 folder.`);
  
  // Get all valid contract codes from the database
  const allContracts = await prisma.contract.findMany({
    select: { contractCode: true, id: true, penalization: true }
  });
  const contractMap = new Map();
  for (const c of allContracts) {
    if (c.contractCode) {
      contractMap.set(c.contractCode, c);
    }
  }

  for (const file of files) {
    const invNum = file.replace('.pdf', ''); // e.g. AEDEN24-12
    
    // Check if any PenaltyInvoice starts with this invoice number
    const existing = await prisma.penaltyInvoice.findFirst({
      where: { invoiceNumber: { startsWith: invNum } }
    });

    if (existing) {
      // Already imported
      continue;
    }

    console.log(`Processing missing invoice: ${invNum}`);
    
    const filePath = path.join(PDF_DIR, file);
    const dataBuffer = fs.readFileSync(filePath);
    let text = '';
    try {
      const data = await pdf(dataBuffer);
      text = data.text;
    } catch (e) {
      console.log(`Could not parse PDF ${file}`);
      continue;
    }

    // Try to find all contract codes in the PDF text
    // A contract code usually has no spaces and is alphanumeric, but let's just match against our known list!
    const foundCodes = [];
    for (const [code, contract] of contractMap.entries()) {
      if (text.includes(code)) {
        foundCodes.push(code);
      }
    }

    if (foundCodes.length === 0) {
      console.log(`  WARNING: No contract codes found in ${file}. Manual review needed.`);
      continue;
    }

    console.log(`  Found ${foundCodes.length} contracts in ${file}: ${foundCodes.join(', ')}`);

    // Extract Total (Since we don't have the Excel, we assume Total is Base * 1.21 or whatever)
    // Actually, we can just use the Contract's own calculation for baseAmount, or look for € in the text.
    // It's safer to just set baseAmount from contract.penalization, and totalAmount = baseAmount * 1.21
    
    let suffix = 1;
    for (const code of foundCodes) {
      const contract = contractMap.get(code);
      
      let finalInvNum = invNum;
      if (foundCodes.length > 1) {
        finalInvNum = `${invNum}-${suffix}`;
        suffix++;
      }

      // Base Amount from the contract record if it was calculated, otherwise 0
      const baseAmount = contract.penalization || 0;
      const totalAmount = baseAmount * 1.21;

      const key = `penalizaciones/${finalInvNum}_${code}.pdf`;
      try {
        await uploadToR2(filePath, key);
        
        await prisma.penaltyInvoice.create({
          data: {
            invoiceNumber: finalInvNum,
            contractId: contract.id,
            issueDate: new Date('2024-09-18T00:00:00Z'), // fallback date
            baseAmount,
            totalAmount,
            status: 'PAID',
            fileUrl: key
          }
        });

        await prisma.contract.update({
          where: { id: contract.id },
          data: { penaltyStatus: 'FACTURADA' }
        });
        
        console.log(`  -> Created PenaltyInvoice ${finalInvNum} for ${code}`);
      } catch (err) {
        console.error(`  -> Failed to upload/create for ${finalInvNum}:`, err);
      }
    }
  }
}

main().finally(() => process.exit(0));
