import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const inv = await prisma.invoice.findFirst({ 
    where: { invoiceNumber: 'A260512637' },
    include: { supplyPoint: true, client: true, contract: { include: { supplyPoint: true, client: true } } }
  });
  console.log('Invoice A260512637:');
  console.log('Invoice CUPS:', inv?.supplyPoint?.cups);
  console.log('Invoice Client:', inv?.client?.businessName || inv?.client?.firstName + ' ' + inv?.client?.lastName, 'CIF:', inv?.client?.vatNumber);
  console.log('Contract Code:', inv?.contract?.contractCode);
  console.log('Contract CUPS:', inv?.contract?.supplyPoint?.cups);
  console.log('Contract Client:', inv?.contract?.client?.businessName || inv?.contract?.client?.firstName + ' ' + inv?.contract?.client?.lastName, 'CIF:', inv?.contract?.client?.vatNumber);

  // Check if Quejigo exists by CIF B56045537
  const quejigoClient = await prisma.client.findFirst({ where: { vatNumber: 'B56045537' } });
  console.log('Quejigo Client (B56045537):', quejigoClient ? quejigoClient.businessName || quejigoClient.firstName : 'NOT FOUND');

  const quejigoContracts = await prisma.contract.findMany({ 
    where: { 
      airtableData: { path: ['NOMBRERAZON SOCIAL'], string_contains: 'QUEJIGO' } as any 
    } 
  });
  console.log('Contracts with Quejigo in Airtable:', quejigoContracts.map(c => c.contractCode));
}

run().finally(() => process.exit(0));
