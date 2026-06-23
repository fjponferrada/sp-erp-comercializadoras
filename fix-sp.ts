import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local' });

import { prisma } from './src/lib/prisma';

async function run() {
  const sp = await prisma.supplyPoint.findFirst({
    where: { cups: 'ES0031104442493001QW0F' }
  });
  console.log("Current SP Data:");
  console.log(sp);
  
  if (sp && sp.address && !sp.street) {
    // We will extract from the address
    const match = sp.address.match(/^(CL|AV|PZ|CR|CT)\s+(.+)\s+NÚM\s+(\d+)/i) || 
                  sp.address.match(/^(CL|AV|PZ|CR|CT)\s+(.+)/i);
    if (match) {
        const type = match[1];
        const name = match[2].trim();
        const number = match[3] || '8'; // we know it was 8 from XML
        
        await prisma.supplyPoint.update({
            where: { id: sp.id },
            data: {
                streetType: type,
                street: name,
                streetNumber: number
            }
        });
        console.log("Updated to:", { streetType: type, street: name, streetNumber: number });
    }
  }
}
run();
