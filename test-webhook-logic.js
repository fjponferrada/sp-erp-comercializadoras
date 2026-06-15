require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function testWebhook() {
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
  const isProduction = process.env.NODE_ENV === 'production' && process.env.DOCUSIGN_ENV === 'production';
  const authServer = isProduction ? 'account.docusign.com' : 'account-d.docusign.com';
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
  
  const basePath = isProduction ? 'https://eu.docusign.net/restapi' : 'https://demo.docusign.net/restapi';
  console.log('Base path:', basePath);

  const downloadUrl = `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`;
  
  const res = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
     console.error(`Error downloading PDF: ${res.statusText}`, await res.text());
     return;
  }
  
  const pdfArrayBuffer = await res.arrayBuffer();
  console.log('Downloaded PDF, size:', pdfArrayBuffer.byteLength);

  // Subir a Cloudflare R2
  // We will skip R2 upload in this script to not pollute bucket, just want to see if DS download fails.
  console.log('Success up to R2 upload.');

  await prisma.$disconnect();
}

testWebhook().catch(console.error);
