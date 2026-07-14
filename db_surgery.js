process.env.DATABASE_URL = "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true";

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c0 = await prisma.contract.findFirst({
    where: { internalCode: 'NUEA26331151QW0F' }, // wait, what is version 0's internal code? I'll find by CUPS and version
  });
  
  const c0True = await prisma.contract.findFirst({
    where: { supplyPoint: { cups: 'ES0031104442493001QW0F' }, version: 0 }
  });

  const c1 = await prisma.contract.findFirst({ 
    where: { internalCode: 'NUEB26331151QW0F' },
    include: { client: true }
  });
  
  const c2 = await prisma.contract.findFirst({ 
    where: { internalCode: 'NUFR26331151QW0F' },
    include: { client: true }
  });

  const clientB88 = await prisma.client.findFirst({
    where: { documentNumber: 'B88759287' }
  });

  console.log("=== BEFORE SURGERY ===");
  console.log("V0:", c0True ? { code: c0True.internalCode, status: c0True.status, end: c0True.terminationDate } : 'Not found');
  console.log("V1:", c1 ? { code: c1.internalCode, status: c1.status, act: c1.activationDate, end: c1.terminationDate, client: c1.client?.documentNumber } : 'Not found');
  console.log("V2:", c2 ? { code: c2.internalCode, status: c2.status, act: c2.activationDate, end: c2.terminationDate, client: c2.client?.documentNumber } : 'Not found');
  console.log("Client B88759287 exists:", !!clientB88, clientB88?.id);

  if (c1 && c0True && c2) {
    console.log("\nPerforming surgery...");

    // 1. V1 should be FINALIZADO, with activationDate = V0's terminationDate? Wait, user says V0 has terminationDate 28 April 2026.
    // If V0 has 28 April 2026, then V1 should have activationDate = 28 April 2026.
    // And what is V1's terminationDate? It should be 1 day before V2's activationDate.
    // V2's activationDate is 23/06/2026. So V1's terminationDate = 22/06/2026.
    
    let v1ActDate = new Date('2026-04-28T00:00:00Z');
    let v1TermDate = new Date(c2.activationDate);
    v1TermDate.setDate(v1TermDate.getDate() - 1);

    await prisma.contract.update({
      where: { id: c1.id },
      data: {
        status: 'FINALIZADO',
        activationDate: v1ActDate,
        terminationDate: v1TermDate
      }
    });
    console.log(`Updated V1 status to FINALIZADO, actDate=${v1ActDate.toISOString()}, termDate=${v1TermDate.toISOString()}`);

    // 2. Link the Cambio de Titular contract to the new Client (B88759287)
    if (clientB88) {
      // Is V2 the Cambio Titular? Yes, because M1_05 activated V2. 
      // User says: "LA NUEVA VERSION ESTABA A NOMBRE DEL CIF B88759287"
      await prisma.contract.update({
        where: { id: c2.id },
        data: {
          clientId: clientB88.id
        }
      });
      console.log(`Linked V2 to client ${clientB88.id} (${clientB88.documentNumber})`);
      
      // Also update SupplyPoint's client if this is the active contract
      if (c2.status === 'ACTIVO' || c2.status === 'ACTIVE' || c2.status === 'Activo') {
        await prisma.supplyPoint.update({
          where: { id: c2.supplyPointId },
          data: {
            clientId: clientB88.id
          }
        });
        console.log(`Linked SupplyPoint ${c2.supplyPointId} to client ${clientB88.id}`);
      }
    } else {
      console.log("Client B88759287 not found in DB! Cannot link.");
    }
  }

}

main().catch(console.error).finally(() => process.exit(0));
