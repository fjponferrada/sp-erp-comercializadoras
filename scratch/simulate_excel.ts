import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const result = await InternalBillingEngine.calculate('cmrahn7u2006u04k2rmcrmcgm', false, true);
  
  if (result.hourlyDetails && result.hourlyDetails.length > 0) {
    for (let i = 0; i < 10; i++) {
      const h = result.hourlyDetails[i];
      const dateObj = new Date(h.date);
      const fecha = dateObj.toLocaleDateString('es-ES');
      const hora = dateObj.getHours().toString().padStart(2, '0') + ':' + dateObj.getMinutes().toString().padStart(2, '0');
      console.log(`Row ${i}: Fecha=${fecha}, Hora=${hora}, original_date=${h.date}`);
    }
  } else {
    console.log("No hourly details returned");
  }
}

main().catch(console.error);
