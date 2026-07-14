const { PrismaClient } = require('@prisma/client');
const { fromZonedTime } = require('date-fns-tz');

async function main() {
  const prisma = new PrismaClient();
  
  const parseAndShiftDate = (dStr, shiftDays = 0) => {
    if (!dStr) return undefined;
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      const d = parseInt(parts[2]) + shiftDays;
      
      const overflowDate = new Date(Date.UTC(y, m - 1, d));
      const dateStr = overflowDate.toISOString().substring(0, 10) + 'T00:00:00';
      
      return fromZonedTime(dateStr, 'Europe/Madrid');
    }
    return undefined;
  };

  const f1s = await prisma.f1Invoice.findMany({
    select: { id: true, jsonData: true }
  });

  let count = 0;
  for (const f1 of f1s) {
    if (f1.jsonData && f1.jsonData.FacturaATR && f1.jsonData.FacturaATR.Cabecera) {
      const cab = f1.jsonData.FacturaATR.Cabecera;
      const ini = parseAndShiftDate(cab.FechaDesdeFactura, 0);
      const fin = parseAndShiftDate(cab.FechaHastaFactura, 1);
      
      if (ini && fin) {
        await prisma.f1Invoice.update({
          where: { id: f1.id },
          data: {
            fechaInicio: ini,
            fechaFin: fin
          }
        });
        count++;
      }
    }
  }

  console.log(`Updated ${count} F1 Invoices with accurate dates.`);
}

main().catch(console.error);
