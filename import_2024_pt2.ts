import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const TSV_FILE = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\c9a1ddfc-9914-43bc-94ae-b630d1db74de\\scratch\\2024_pt2.tsv';
const PDF_DIR = 'A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2024\\Emitidas\\Penalizaciones';

function getS3Client() {
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
  });
}

function parseCurrency(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[^0-9,-]+/g, '').replace(',', '.'));
}

function parseDate(str) {
  const [d, m, y] = str.split('/');
  return new Date(y, m - 1, d);
}

async function uploadToR2(filePath, key) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
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
  const raw = fs.readFileSync(TSV_FILE, 'utf-8');
  const lines = raw.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const cCode = parts[0].trim();
    const dateStr = parts[1].trim();
    let invNum = parts[2].trim();
    const baseStr = parts[3].trim();
    const totalStr = parts[4].trim();

    console.log(`Processing ${cCode} - ${invNum}`);

    const contract = await prisma.contract.findFirst({
      where: { contractCode: cCode }
    });

    if (!contract) {
      console.log(`Contract not found for ${cCode}`);
      continue;
    }

    // Check for duplicate invoice number and append suffix if needed
    let finalInvNum = invNum;
    let suffix = 1;
    while (true) {
      const existing = await prisma.penaltyInvoice.findUnique({ where: { invoiceNumber: finalInvNum } });
      if (!existing) break;
      finalInvNum = `${invNum}-${suffix}`;
      suffix++;
    }

    const pdfFile = path.join(PDF_DIR, `${invNum}.pdf`);
    let fileUrl = null;

    if (fs.existsSync(pdfFile)) {
      const key = `penalizaciones/${finalInvNum}_${cCode}.pdf`;
      try {
        await uploadToR2(pdfFile, key);
        fileUrl = key;
        console.log(`Uploaded PDF to ${key}`);
      } catch (err) {
        console.error(`Upload error for ${finalInvNum}:`, err);
      }
    } else {
      console.log(`PDF not found: ${pdfFile}`);
    }

    await prisma.penaltyInvoice.create({
      data: {
        invoiceNumber: finalInvNum,
        contractId: contract.id,
        issueDate: parseDate(dateStr),
        baseAmount: parseCurrency(baseStr),
        totalAmount: parseCurrency(totalStr),
        status: 'PAID',
        fileUrl
      }
    });

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        penaltyStatus: 'FACTURADA',
        penalization: parseCurrency(baseStr)
      }
    });

    console.log(`Created PenaltyInvoice ${finalInvNum} for ${cCode}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
