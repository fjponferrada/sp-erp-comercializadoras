import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processParsedSwitchingData } from '@/app/actions/switchingIngest';
import { parseSwitchingXml } from '@/lib/switching/parser';

export async function GET() {
  const baseCups = 'ES0031101445366001GN';
  const evs = await prisma.switchingEvent.findMany({
    where: { 
      supplyPoint: { cups: { startsWith: baseCups } },
      isResolved: false
    }
  });

  const results = [];
  results.push(`Found ${evs.length} unresolved events for this CUPS.`);

  for (const event of evs) {
    if (!event.xmlUrl) continue;
    try {
      const response = await fetch(event.xmlUrl);
      const xmlString = await response.text();
      const parsedData = parseSwitchingXml(xmlString);
      const result = await processParsedSwitchingData(parsedData, event.xmlUrl, event.id);
      results.push(`Result for ${event.id}: ${JSON.stringify(result)}`);
    } catch(e: any) {
      results.push(`Error for ${event.id}: ${e.message}`);
    }
  }

  return NextResponse.json(results);
}
