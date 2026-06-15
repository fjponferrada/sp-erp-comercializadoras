require('dotenv').config({ path: '.env' });
const jwt = require('jsonwebtoken');

async function test() {
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
  const token = jwt.sign({
    iss: process.env.DOCUSIGN_INTEGRATION_KEY,
    sub: process.env.DOCUSIGN_USER_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    aud: 'account.docusign.com',
    scope: 'signature impersonation'
  }, privateKey, { algorithm: 'RS256' });

  const res = await fetch('https://account.docusign.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
  });
  const data = await res.json();
  console.log('DocuSign Auth Response:', data);
}
test().catch(console.error);
