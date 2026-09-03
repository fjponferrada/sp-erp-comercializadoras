const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { Client } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const PDF_DIR = 'A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2024\\Emitidas\\Penalizaciones';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
  });

  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.docx'));
  console.log(`Found ${files.length} DOCX in 2024 folder.`);

  const res = await client.query('SELECT id, "contractCode", penalization FROM "Contract"');
  const allContracts = res.rows;
  console.log(`Loaded ${allContracts.length} contracts from DB.`);

  for (const file of files) {
    const invNum = file.replace('.docx', '');

    const invRes = await client.query('SELECT id FROM "PenaltyInvoice" WHERE "invoiceNumber" LIKE $1 LIMIT 1', [invNum + '%']);
    if (invRes.rows.length > 0) {
      continue;
    }

    console.log(`Processing missing invoice: ${invNum}`);
    const docxPath = path.join(PDF_DIR, file);
    
    // We upload the PDF, not the DOCX! So we check if PDF exists
    const pdfPath = path.join(PDF_DIR, invNum + '.pdf');
    if (!fs.existsSync(pdfPath)) {
       console.log(`  -> No PDF equivalent found for ${file}, skipping.`);
       continue;
    }

    let text = '';
    try {
      const result = await mammoth.extractRawText({path: docxPath});
      text = result.value;
    } catch (e) {
      console.log(`  -> Could not parse DOCX ${file}`);
      continue;
    }

    const foundContracts = [];
    for (const c of allContracts) {
      if (c.contractCode && text.includes(c.contractCode)) {
        foundContracts.push(c);
      }
    }

    if (foundContracts.length === 0) {
      console.log(`  -> WARNING: No contract codes found in ${file}.`);
      continue;
    }

    console.log(`  -> Found ${foundContracts.length} contracts in ${file}`);

    let suffix = 1;
    for (const contract of foundContracts) {
      let finalInvNum = invNum;
      if (foundContracts.length > 1) {
        finalInvNum = `${invNum}-${suffix}`;
        suffix++;
      }

      const baseAmount = contract.penalization || 0;
      const totalAmount = baseAmount * 1.21;
      const key = `penalizaciones/${finalInvNum}_${contract.contractCode}.pdf`;

      try {
        await s3.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: key,
          Body: fs.createReadStream(pdfPath),
          ContentType: 'application/pdf'
        }));

        const id = require('crypto').randomUUID();
        
        await client.query(`
          INSERT INTO "PenaltyInvoice" (id, "invoiceNumber", "contractId", "issueDate", "baseAmount", "totalAmount", status, "fileUrl", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        `, [
          id, finalInvNum, contract.id, new Date('2024-09-18T00:00:00Z'), baseAmount, totalAmount, 'PAID', key
        ]);

        await client.query(`
          UPDATE "Contract" SET "penaltyStatus" = 'FACTURADA' WHERE id = $1
        `, [contract.id]);

        console.log(`  -> SUCCESS: Created PenaltyInvoice ${finalInvNum} for ${contract.contractCode}`);
      } catch (err) {
        console.error(`  -> Failed for ${finalInvNum}:`, err.message);
      }
    }
  }

  await client.end();
}

main().catch(console.error);
