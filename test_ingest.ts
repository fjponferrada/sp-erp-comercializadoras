import { PrismaClient } from '@prisma/client';
import { processParsedSwitchingData, parseSwitchingXml } from './src/app/actions/switchingIngest';

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
  const parsedData = parseSwitchingXml(xmlString);
  
  console.log('Parsed Data:', parsedData);
  
  const result = await processParsedSwitchingData(parsedData, event.xmlUrl, event.id);
  console.log('Result:', result);
  
  const eventAfter = await prisma.switchingEvent.findUnique({ where: { id: event.id } });
  console.log('Event After:', eventAfter);
  
  process.exit(0);
}

run();
