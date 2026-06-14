import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log("Iniciando reparación de direcciones de Puntos de Suministro...");

  const supplyPoints = await prisma.supplyPoint.findMany();

  console.log(`Procesando ${supplyPoints.length} Puntos de Suministro locales...`);

  let updatedCount = 0;

  for (const sp of supplyPoints) {
    if (!sp.airtableData) continue;
    
    const f = sp.airtableData as any;
    
    const getVal = (key: string) => {
      const val = f[key];
      if (typeof val === 'string' && val.trim() === '') return null;
      return val;
    };

    const streetNumber = getVal('Número Instalación') ? getVal('Número Instalación').toString().trim() : null;
    const floor = getVal('Piso Instalación') ? getVal('Piso Instalación').toString().trim() : null;
    const door = getVal('Puerta Instalación') ? getVal('Puerta Instalación').toString().trim() : null;

    let needsUpdate = false;
    const dataToUpdate: any = {};

    if (streetNumber && sp.streetNumber !== streetNumber) {
      dataToUpdate.streetNumber = streetNumber;
      needsUpdate = true;
    }
    if (floor && sp.floor !== floor) {
      dataToUpdate.floor = floor;
      needsUpdate = true;
    }
    if (door && sp.door !== door) {
      dataToUpdate.door = door;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.supplyPoint.update({
        where: { id: sp.id },
        data: dataToUpdate
      });
      updatedCount++;
    }
  }

  console.log(`\n¡Completado! Se han reparado campos de dirección en ${updatedCount} Puntos de Suministro.`);
  process.exit(0);
}

run().catch((e) => {
  console.error("Error ejecutando reparación:", e);
  process.exit(1);
});
