import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function fixContract(contractCode: string) {
  const contract = await prisma.contract.findFirst({
    where: { contractCode },
    include: { client: true }
  });
  if (!contract) {
    console.log(`Contract ${contractCode} not found.`);
    return;
  }
  
  const data = contract.airtableData as any;
  const realCif = data['CIF'] ? data['CIF'].toString().trim() : (data['NIF'] ? data['NIF'].toString().trim() : null);
  
  if (!realCif) {
    console.log(`Contract ${contractCode} missing CIF in airtableData.`);
    return;
  }
  
  console.log(`\nFixing ${contractCode}:`);
  console.log(`  Current VAT: ${contract.client?.vatNumber}`);
  console.log(`  Real CIF: ${realCif}`);
  
  if (contract.client?.vatNumber !== realCif) {
    let correctClient = await prisma.client.findFirst({
      where: { vatNumber: realCif, brandId: contract.client!.brandId }
    });

    if (!correctClient) {
      console.log(`  Creando nueva sociedad con CIF: ${realCif}`);
      correctClient = await prisma.client.create({
        data: {
          vatNumber: realCif,
          businessName: data['NOMBRERAZON SOCIAL'] || data['NOMBRE Y APELLIDOS'] || 'Sociedad Desconocida',
          firstName: data['Primer Apellido'] || '',
          lastName: data['Segundo Apellido'] || '',
          contactEmail: data['Email Contacto'] || '',
          contactPhone: data['Teléfono Contacto'] || '',
          brandId: contract.client!.brandId
        }
      });
    }

    await prisma.contract.update({
      where: { id: contract.id },
      data: { clientId: correctClient.id }
    });

    if (contract.supplyPointId) {
      await prisma.supplyPoint.update({
        where: { id: contract.supplyPointId },
        data: { clientId: correctClient.id }
      });
    }

    const invoices = await prisma.invoice.findMany({
      where: { contractId: contract.id }
    });
    
    for (const inv of invoices) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { clientId: correctClient.id }
      });
    }

    console.log(`  -> Corregido. Reasignadas ${invoices.length} facturas.`);
  } else {
    console.log(`  Already correctly assigned.`);
  }
}

async function run() {
  await fixContract('AEDJP2211301317J0F'); // Quejigo
  await fixContract('TRIPG264141633LZ0F'); // Aljaval (I need its exact contractCode actually, let me find it if not Aljaval)
  
  // Wait, Aljaval invoice is A260512164. What is its contract ID?
  const aljavalInv = await prisma.invoice.findUnique({ where: { invoiceNumber: 'A260512164' } });
  if (aljavalInv) {
    const aljavalCont = await prisma.contract.findUnique({ where: { id: aljavalInv.contractId } });
    if (aljavalCont) {
      await fixContract(aljavalCont.contractCode);
    }
  }
}

run().finally(() => process.exit(0));
