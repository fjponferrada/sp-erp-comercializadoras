import { config } from 'dotenv';
config({ path: '.env.local' });
import { prisma } from '../lib/prisma';

async function main() {
  const allClients = await prisma.client.findMany({
    include: {
      contracts: { select: { id: true, contractCode: true } },
      supplyPoints: { select: { id: true, cups: true } }
    }
  });

  const dnis = /^[XYZ0-9][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/i;
  
  // Find companies with physical person VAT
  const suspicious = allClients.filter(c => {
    const isCompanyFormat = c.businessName && c.businessName.match(/S\.?L\.?|S\.?A\.?|COOP/i);
    const isPhysicalVat = c.vatNumber && c.vatNumber.match(/^[0-9XYZ]/i);
    
    // Or just check if there's another client with the EXACT same businessName but starting with A or B
    return isPhysicalVat;
  });

  // Group by business name
  const byName = {};
  for (const c of allClients) {
    const name = c.businessName ? c.businessName.trim().toUpperCase() : '';
    if (!name) continue;
    if (!byName[name]) byName[name] = [];
    byName[name].push(c);
  }

  const duplicates = [];
  for (const [name, clients] of Object.entries(byName)) {
    if (clients.length > 1) {
      // Check if one is a CIF and the other is a DNI
      const hasCif = clients.some(c => c.vatNumber.match(/^[AB]/i));
      const hasDni = clients.some(c => c.vatNumber.match(/^[0-9XYZ]/i));
      if (hasCif && hasDni) {
        duplicates.push({ name, clients });
      }
    }
  }

  console.log(`Encontrados ${duplicates.length} casos de empresas duplicadas (una con CIF y otra con DNI).`);
  for (const dup of duplicates.slice(0, 5)) {
    console.log(`\n--- ${dup.name} ---`);
    for (const c of dup.clients) {
      console.log(`ID: ${c.id} | NIF/CIF: ${c.vatNumber} | Contratos: ${c.contracts.length} | CUPS: ${c.supplyPoints.length}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
