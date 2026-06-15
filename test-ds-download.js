require('dotenv').config({ path: '.env' });
const jwt = require('jsonwebtoken');

async function testDownload() {
  const envelopeId = 'a1e0fb16-f2b7-8272-81dc-f67239c88638';
  
  const authServer = process.env.DOCUSIGN_OAUTH_BASE_PATH || 'account.docusign.com';
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
  
  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://eu.docusign.net/restapi';
  
  const downloadUrl = `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`;
  console.log('Downloading from:', downloadUrl);
  
  const res = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
     console.error(`Error downloading PDF: ${res.statusText}`);
     const errText = await res.text();
     console.error(errText);
     return;
  }
  
  const pdfArrayBuffer = await res.arrayBuffer();
  console.log('Downloaded PDF, size:', pdfArrayBuffer.byteLength);
}

testDownload().catch(console.error);
