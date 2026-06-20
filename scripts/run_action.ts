import { config } from 'dotenv';
config({ path: '.env.development.local' });
config({ path: '.env.local' });
config({ path: '.env' });

import { triggerFtpSyncManually } from '../src/app/actions/ftpSync';

async function main() {
  console.log('Triggering FTP sync...');
  const res = await triggerFtpSyncManually();
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
