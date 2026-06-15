require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

async function uploadFileToR2(key, fileBuffer, contentType) {
  const S3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const uploadParams = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  };

  await S3.send(new PutObjectCommand(uploadParams));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

async function fixWebhook() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const envelopeId = 'a1e0fb16-f2b7-8272-81dc-f67239c88638';
  
  const contract = await prisma.contract.findUnique({
    where: { docusignEnvelopeId: envelopeId }
  });

  if (!contract) {
    console.log('Contract not found for envelope', envelopeId);
    return;
  }
  console.log('Found contract:', contract.contractCode);

  const jwt = require('jsonwebtoken');
  const authServer = process.env.DOCUSIGN_OAUTH_BASE_PATH || 'account-d.docusign.com';
  console.log('Auth server:', authServer);

  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

  const token = jwt.sign({
    iss: process.env.DOCUSIGN_INTEGRATION_KEY,
    sub: process.env.DOCUSIGN_USER_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    aud: authServer,
    scope: "signature impersonation"
  }, privateKey, { algorithm: 'RS256' });

  const oauthUrl = `https://${authServer}/oauth/token`;
  const tokenRes = await fetch(oauthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
  });
  const results = await tokenRes.json();
  
  if (results.error) {
    console.error('Auth Error:', results);
    return;
  }

  const accessToken = results.access_token;
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID || '';
  
  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
  console.log('Base path:', basePath);

  const downloadUrl = `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined?certificate=true`;
  
  const res = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
     console.error(`Error downloading PDF: ${res.statusText}`);
     return;
  }
  
  const pdfArrayBuffer = await res.arrayBuffer();
  const pdfBuffer = Buffer.from(pdfArrayBuffer);
  console.log('Downloaded PDF, size:', pdfBuffer.byteLength);

  const fileName = `contrato_firmado_${contract.contractCode}.pdf`;
  console.log('Uploading to R2...');
  const r2Url = await uploadFileToR2(`contracts/signed/${fileName}`, pdfBuffer, 'application/pdf');

  console.log('R2 URL:', r2Url);
  
  const sigDate = new Date();
  
  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: 'ACEPTADO',
      filePdfSigned: r2Url,
      signatureDate: sigDate
    }
  });

  console.log('Updated database successfully!');

  await prisma.$disconnect();
}

fixWebhook().catch(console.error);
