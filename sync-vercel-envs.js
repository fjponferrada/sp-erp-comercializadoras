const fs = require('fs');
const { execSync } = require('child_process');

const envContent = fs.readFileSync('.env', 'utf8');
const lines = envContent.split('\n');

const vars = {};
let currentKey = null;
let currentValue = '';

for (const line of lines) {
  if (currentKey) {
    currentValue += '\n' + line;
    if (line.endsWith('"')) {
      vars[currentKey] = currentValue.slice(0, -1); // remove trailing quote
      currentKey = null;
      currentValue = '';
    }
  } else {
    if (line.startsWith('DOCUSIGN_') && line.includes('=')) {
      const idx = line.indexOf('=');
      const key = line.substring(0, idx);
      let val = line.substring(idx + 1);
      
      if (val.startsWith('"') && val.endsWith('"') && val.length > 1) {
        vars[key] = val.slice(1, -1);
      } else if (val.startsWith('"')) {
        currentKey = key;
        currentValue = val.slice(1);
      } else {
        vars[key] = val;
      }
    }
  }
}

const keysToAdd = [
  'DOCUSIGN_OAUTH_BASE_PATH',
  'DOCUSIGN_BASE_PATH',
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_USER_ID',
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_PRIVATE_KEY'
];

for (const key of keysToAdd) {
  if (vars[key]) {
    console.log(`Adding ${key}...`);
    try {
      fs.writeFileSync('temp_val.txt', vars[key]);
      execSync(`npx vercel env add ${key} production --force < temp_val.txt`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Error adding ${key}:`, e.message);
    }
  } else {
    console.warn(`Key ${key} not found in .env`);
  }
}

if (fs.existsSync('temp_val.txt')) fs.unlinkSync('temp_val.txt');
console.log('Done.');
