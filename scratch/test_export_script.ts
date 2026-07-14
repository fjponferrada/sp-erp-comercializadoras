import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';
import * as fs from 'fs';

async function main() {
  const draftId = 'cmrf31ab80001ug41blork0nw';
  const prisma = new PrismaClient();
  const draft = await prisma.internalInvoice.findUnique({
    where: { id: draftId }
  });
  if (!draft || !draft.f1InvoiceId) {
    console.log("No draft found");
    return;
  }
  const result = await InternalBillingEngine.calculate(draft.f1InvoiceId, false, true);
  
  if (!result.hourlyDetails) return;

  let csv = "Fecha;Hora;OMIE\n";
  for(let i=0; i<15; i++) {
     const h = result.hourlyDetails[i];
     if(!h) continue;
     const dateObj = new Date(h.date);
     const fecha = dateObj.toLocaleDateString('es-ES');
     const hora = dateObj.getHours().toString().padStart(2, '0') + ':' + dateObj.getMinutes().toString().padStart(2, '0');
     csv += `${fecha};${hora};${h.omie}\n`;
  }
  fs.writeFileSync('C:\\Users\\Administrator\\sp-erp-comercializadoras\\scratch\\test_export.csv', csv);
  console.log("Wrote test_export.csv");
}

main().catch(console.error);
