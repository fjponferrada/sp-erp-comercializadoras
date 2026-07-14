import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import { processParsedSwitchingData } from '../src/app/actions/switchingIngest';
import { parseSwitchingXml } from '../src/lib/switching/parser';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Obteniendo eventos no resueltos...');
    const unresolvedEvents = await prisma.switchingEvent.findMany({
      where: { isResolved: false, xmlUrl: { not: null } },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Encontrados ${unresolvedEvents.length} eventos para procesar.`);

    let processedCount = 0;
    let resolvedCount = 0;

    for (const event of unresolvedEvents) {
      try {
        const response = await fetch(event.xmlUrl!);
        if (!response.ok) {
            console.error(`No se pudo descargar ${event.xmlUrl}`);
            continue;
        }
        
        const xmlString = await response.text();
        const parsedData = parseSwitchingXml(xmlString);
        
        const result = await processParsedSwitchingData(parsedData, event.xmlUrl!, event.id);
        
        processedCount++;
        if (result.success && !result.warning) {
          resolvedCount++;
          console.log(`Evento ${event.id} resuelto correctamente.`);
        } else {
          console.log(`Evento ${event.id} procesado pero sigue con warnings: ${result.warning || result.error}`);
        }
      } catch (e) {
        console.error('Error retrying event:', event.id, e);
      }
    }

    console.log(`Proceso completado. Procesados: ${processedCount}. Resueltos: ${resolvedCount}.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
