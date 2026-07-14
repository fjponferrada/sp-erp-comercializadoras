import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Buscando eventos mal vinculados...');
    const events = await prisma.switchingEvent.findMany({
        where: {
            warning: "No se encontró un contrato reciente para asignar este evento.",
            supplyPointId: null,
            xmlUrl: { not: null }
        }
    });

    console.log(`Encontrados ${events.length} eventos para revincular.`);

    // Resetear isResolved a false para que el sweep los vuelva a coger
    if (events.length > 0) {
        await prisma.switchingEvent.updateMany({
            where: { id: { in: events.map(e => e.id) } },
            data: { isResolved: false, warning: null }
        });
        console.log('Eventos reseteados. Ahora puedes forzar el Sweep desde el Frontend o ejecutar el código de Sweep aquí.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
