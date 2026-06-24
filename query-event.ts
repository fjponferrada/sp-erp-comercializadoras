import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  try {
    const events = await prisma.switchingEvent.findMany({
      where: { 
        codigoSolicitud: { contains: '503709861475' }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Encontrados: ${events.length}`);
    for (const event of events) {
      console.log(`- ${event.id} | ${event.codigoSolicitud} | ${event.proceso} | ${event.paso} | ${event.observaciones}`);
      console.log(`  Motivos:`, event.motivosRechazo);
      console.log(`  Warning:`, event.warning);
      // Solo imprimir el string
      console.log(`  JSON:`, event.jsonData ? "Tiene JSON" : "No tiene JSON");
    }
  } catch (e: any) {
    console.error("Error:", e);
  }
}

main().finally(() => process.exit(0));
