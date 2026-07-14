import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const result = await InternalBillingEngine.calculate('cmrahn7u2006u04k2rmcrmcgm', false, true);
  console.log(`Hourly Details Length: ${result.hourlyDetails?.length}`);
  if (result.hourlyDetails && result.hourlyDetails.length > 0) {
    for (let i = 0; i < 5; i++) {
      console.log(result.hourlyDetails[i].date, "-> Local Madrid:", new Date(result.hourlyDetails[i].date).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }));
    }
  }
}

main().catch(console.error);
