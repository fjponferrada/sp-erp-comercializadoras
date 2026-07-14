import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel.local') });

import { prisma } from './src/lib/prisma';

async function main() {
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
  console.log("V1:", c1 ? { code: c1.internalCode, status: c1.status } : 'Not found');
  console.log("V2:", c2 ? { code: c2.internalCode, status: c2.status, act: c2.activationDate } : 'Not found');
  console.log("Client B88759287 exists:", !!clientB88);

  if (c1 && c0True && c2) {
    console.log("\nPerforming surgery...");

    let v1ActDate = new Date('2026-04-28T00:00:00Z');
    let v1TermDate = new Date(c2.activationDate || '2026-06-23T00:00:00Z');
    v1TermDate.setDate(v1TermDate.getDate() - 1);

    await prisma.contract.update({
      where: { id: c1.id },
      data: {
        status: 'FINALIZADO',
        activationDate: v1ActDate,
        terminationDate: v1TermDate
      }
    });
    console.log("Updated V1");

    if (clientB88) {
      await prisma.contract.update({
        where: { id: c2.id },
        data: {
          clientId: clientB88.id
        }
      });
      console.log(`Linked V2 to client ${clientB88.id}`);
      
      if (['ACTIVO', 'ACTIVE', 'Activo'].includes(c2.status)) {
        await prisma.supplyPoint.update({
          where: { id: c2.supplyPointId },
          data: {
            clientId: clientB88.id
          }
        });
        console.log(`Linked SupplyPoint to client ${clientB88.id}`);
      }
    } else {
      console.log("Client B88759287 not found in DB! Cannot link.");
    }
  }

}

main().catch(console.error).finally(() => process.exit(0));
