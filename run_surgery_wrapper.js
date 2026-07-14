const fs = require('fs');
const { spawnSync } = require('child_process');

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/^DATABASE_URL="(.*?)"/m);

if (match) {
  const dbUrl = match[1].trim();
  console.log("Found DB URL, running script...");
  const child = spawnSync('node', ['db_surgery.js'], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit'
  });
  console.log("Exit code:", child.status);
} else {
  console.log("Could not find DATABASE_URL in .env");
}
