const fs = require('fs');
const { InternalBillingEngine } = require('./dist/lib/services/InternalBillingEngine.js');
require('dotenv').config({ path: 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\.env' });

async function main() {
  const draftId = 'cmrf31ab80001ug41blork0nw';
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const draft = await prisma.internalInvoice.findUnique({
    where: { id: draftId }
  });
  const result = await InternalBillingEngine.calculate(draft.f1InvoiceId, false, true);
  
  let csv = "Fecha;Hora;OMIE\n";
  for(let i=0; i<15; i++) {
     const h = result.hourlyDetails[i];
     const dateObj = new Date(h.date);
     const fecha = dateObj.toLocaleDateString('es-ES');
     const hora = dateObj.getHours().toString().padStart(2, '0') + ':' + dateObj.getMinutes().toString().padStart(2, '0');
     csv += `${fecha};${hora};${h.omie}\n`;
  }
  fs.writeFileSync('C:\\Users\\Administrator\\sp-erp-comercializadoras\\scratch\\test_export.csv', csv);
  console.log("Wrote test_export.csv");
}
main().catch(console.error);
