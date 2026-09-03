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
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
  });

  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.docx'));
  
  // Get SupplyPoint CUPS
  const res = await client.query('SELECT c.id, c."clientId", c."supplyPointId", c."contractCode", c.penalization, s.cups FROM "Contract" c JOIN "SupplyPoint" s ON c."supplyPointId" = s.id');
  const allContracts = res.rows;

  for (const file of files) {
    const invNum = file.replace('.docx', '');

    const invRes = await client.query('SELECT id FROM "PenaltyInvoice" WHERE "invoiceNumber" LIKE $1 LIMIT 1', [invNum + '%']);
    if (invRes.rows.length > 0) continue;

    const docxPath = path.join(PDF_DIR, file);
    const pdfPath = path.join(PDF_DIR, invNum + '.pdf');
    if (!fs.existsSync(pdfPath)) continue;

    let text = '';
    try {
      const result = await mammoth.extractRawText({path: docxPath});
      text = result.value.replace(/\\s+/g, ''); // strip spaces for CUPS matching
    } catch (e) {
      continue;
    }

    const foundContracts = [];
    for (const c of allContracts) {
      // Look for the first 20 chars of CUPS (ES00...)
      if (c.cups && text.includes(c.cups.substring(0, 20))) {
        foundContracts.push(c);
      }
    }

    if (foundContracts.length === 0) {
      console.log(`  -> WARNING: No CUPS found in ${file}.`);
      continue;
    }

    let suffix = 1;
    for (const contract of foundContracts) {
      let finalInvNum = invNum;
      if (foundContracts.length > 1) {
        finalInvNum = `${invNum}-${suffix}`;
        suffix++;
      }
      const key = `penalizaciones/${finalInvNum}_${contract.contractCode}.pdf`;

      try {
        const baseAmount = contract.penalization || 0;
        const totalAmount = baseAmount * 1.21;
        await s3.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: fs.createReadStream(pdfPath),
          ContentType: 'application/pdf'
        }));
        const id = require('crypto').randomUUID();
        await client.query(`
          INSERT INTO "PenaltyInvoice" (id, "invoiceNumber", "contractId", "clientId", "supplyPointId", "issueDate", "amount", status, "pdfUrl", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `, [
          id, finalInvNum, contract.id, contract.clientId, contract.supplyPointId, new Date('2024-09-18T00:00:00Z'), totalAmount, 'PAID', key
        ]);
        await client.query(`UPDATE "Contract" SET "penaltyStatus" = 'FACTURADA' WHERE id = $1`, [contract.id]);
        console.log(`  -> SUCCESS: Created PenaltyInvoice ${finalInvNum} for ${contract.contractCode} (matched CUPS)`);
      } catch (err) {
        console.error(`  -> Failed for ${finalInvNum}:`, err.message);
      }
    }
  }
  await client.end();
}
main().catch(console.error);
