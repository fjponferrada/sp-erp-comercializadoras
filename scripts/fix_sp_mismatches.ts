import { prisma } from '../src/lib/prisma';
import * as dotenv from 'dotenv';
dotenv.config({path: '.env'});

async function run() {
  try {
    const query = `
      SELECT c.id as contract_id, c."contractCode", c.status, c."clientId" as contract_client_id, 
             sp.id as sp_id, sp.cups, sp."clientId" as sp_client_id
      FROM "Contract" c
      JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
      WHERE c."clientId" != sp."clientId";
    `;
    const mismatches = await prisma.$queryRawUnsafe<any[]>(query);
    
    console.log(`Found ${mismatches.length} mismatched contracts.`);
    let fixed = 0;

    for (const m of mismatches) {
      console.log(`\n- Processing Contract ${m.contractCode} (ID: ${m.contract_id}): Contract Client = ${m.contract_client_id}, SP Client = ${m.sp_client_id}, CUPS = ${m.cups}`);
      
      const correctSpQuery = `
        SELECT id FROM "SupplyPoint" 
        WHERE cups = $1 AND "clientId" = $2;
      `;
      const correctSps = await prisma.$queryRawUnsafe<any[]>(correctSpQuery, m.cups, m.contract_client_id);
      
      if (correctSps.length > 0) {
        const targetSpId = correctSps[0].id;
        console.log(`  => ACTION: Move contract to EXISTING SP ${targetSpId}`);
        await prisma.contract.update({
          where: { id: m.contract_id },
          data: { supplyPointId: targetSpId }
        });
        fixed++;
      } else {
        console.log(`  => ACTION: Need to CREATE new SP for client ${m.contract_client_id} with CUPS ${m.cups}`);
        
        const wrongSp = await prisma.supplyPoint.findUnique({
          where: { id: m.sp_id }
        });

        if (wrongSp) {
          const { id, createdAt, updatedAt, clientId, airtableId, airtableData, pdfUrl, ...clonedData } = wrongSp;
          
          const newSp = await prisma.supplyPoint.create({
            data: {
              ...clonedData,
              clientId: m.contract_client_id
            }
          });
          
          console.log(`     -> Created new SP: ${newSp.id}`);
          
          await prisma.contract.update({
            where: { id: m.contract_id },
            data: { supplyPointId: newSp.id }
          });
          fixed++;
        }
      }
    }
    
    console.log(`\n✅ Finished fixing ${fixed}/${mismatches.length} contracts.`);
  } catch (e) {
    console.error(e);
  }
}
run();
