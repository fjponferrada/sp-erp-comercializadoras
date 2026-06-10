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
  console.log('Iniciando cirugía de reasignación de CIFs...');
  
  // Buscar todos los contratos donde exista Copia de CIF link y sea diferente a NIF Contacto
  const contracts = await prisma.contract.findMany({
    include: { client: true }
  });

  let fixed = 0;

  for (const contract of contracts) {
    if (!contract.airtableData || typeof contract.airtableData !== 'object') continue;
    
    const data = contract.airtableData as any;
    const realCif = data['CIF'] ? data['CIF'].toString().trim() : (data['NIF'] ? data['NIF'].toString().trim() : null);
    const nifContacto = typeof data['NIF Contacto'] === 'string' ? data['NIF Contacto'].trim() : null;

    if (contract.contractCode === 'AEDJP2211301317J0F') {
      console.log('HIT QUEJIGO:', { realCif, currentVat: contract.client.vatNumber, lengthOk: !!realCif && realCif.length >= 5 });
    }

    if (!realCif || realCif.length < 5) continue;
    
    // Si la ficha actual del contrato no tiene el CIF real de la empresa
    if (contract.client.vatNumber !== realCif) {
      console.log(`\nContrato ${contract.contractCode} mal asignado:`);
      console.log(`  Cliente Actual: ${contract.client.businessName} (${contract.client.vatNumber})`);
      console.log(`  CIF Real (Airtable): ${realCif}`);

      // 1. Buscar o crear el Cliente correcto
      let correctClient = await prisma.client.findFirst({
        where: { vatNumber: realCif, brandId: contract.client.brandId }
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
            brandId: contract.client.brandId
          }
        });
      }

      // 2. Re-vincular el Contrato
      await prisma.contract.update({
        where: { id: contract.id },
        data: { clientId: correctClient.id }
      });

      // 3. Re-vincular el Supply Point si aplica
      if (contract.supplyPointId) {
        await prisma.supplyPoint.update({
          where: { id: contract.supplyPointId },
          data: { clientId: correctClient.id }
        });
      }

      // 4. Re-vincular las Facturas de ese Contrato
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
      fixed++;
    }
  }

  console.log(`\nCirugía completada. ${fixed} contratos reasignados.`);
}

run().finally(() => process.exit(0));
