import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const cups = "ES0031104801705005DF0F";
  const sol = "202668036222";

  console.log(`\n--- CONTRATOS PARA CUPS ${cups} ---`);
  const contracts = await prisma.contract.findMany({
    where: { supplyPoint: { cups: { startsWith: cups.substring(0, 20) } } }
  });
  
  for (const c of contracts) {
    console.log(`Contrato ID: ${c.id}`);
    console.log(` - Status: ${c.status}`);
    console.log(` - Fecha Prevista Baja: ${c.fechaPrevistaBaja}`);
    console.log(` - Termination Date: ${c.terminationDate}`);
  }

  console.log(`\n--- EVENTOS SWITCHING PARA CÓDIGO ${sol} ---`);
  const events = await prisma.switchingEvent.findMany({
    where: { codigoSolicitud: sol }
  });

  for (const e of events) {
    console.log(`Event ID: ${e.id}`);
    console.log(` - Tipo Error: ${e.tipoError}`);
    console.log(` - Paso: ${e.paso}`);
    console.log(` - Proceso Base: ${e.procesoBase}`);
    console.log(` - xmlReference: ${e.xmlReference}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
