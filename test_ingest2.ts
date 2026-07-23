import { PrismaClient } from '@prisma/client';
import { processParsedSwitchingData } from './src/app/actions/switchingIngest';

const prisma = new PrismaClient();

async function run() {
  const event = await prisma.switchingEvent.findFirst({
    where: { contractId: 'PRJAV26210193FJ0F', proceso: 'M1_02' },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!event || !event.xmlUrl) {
    console.log('Event or xmlUrl not found');
    return;
  }
  
  const response = await fetch(event.xmlUrl);
  const xmlString = await response.text();
  
  // Minimal parser to bypass export issue
  const parsedData = {
    fechaSolicitud: null,
    codigoSolicitud: null,
    proceso: 'M1_02',
    procesoBase: 'M1',
    paso: '02',
    estadoAR: 'ACEPTADO',
    tipoReclamacion: null,
    subtipoReclamacion: null,
    fechaAR: null,
    fechaPrevActivacion: new Date('2026-07-01'),
    fechaActivacionAlta: null,
    fechaActivacionBaja: null,
    observaciones: 'Fecha Prev. Activación: 01/07/2026',
    motivosRechazo: null,
    actuacionCampo: null,
    codigoReclamacion: null
  };
  
  try {
    const result = await processParsedSwitchingData(parsedData, event.xmlUrl, event.id);
    console.log('Result:', result);
  } catch (e) {
    console.error('Error during process:', e);
  }
  
  process.exit(0);
}

run();
