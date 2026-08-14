import { prisma } from '../src/lib/prisma';
import * as xlsx from 'xlsx';

async function main() {
  console.log('Reading Excel file...');
  const wb = xlsx.readFile('C:/Users/Administrator/sp-energia-crm/sp-energia-crm/docs/importar.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws);

  console.log(`Found ${data.length} rows to process.`);

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const row of data as any[]) {
    if (!row.CUPS || !row.IBAN) continue;

    const cupsStr = String(row.CUPS).trim();
    const ibanStr = String(row.IBAN).trim();

    // The CUPS might not be unique (a CUPS can belong to multiple clients over time),
    // but the user says "update the iban of each supply point".
    // updateMany is safer for non-unique CUPS.
    const result = await prisma.supplyPoint.updateMany({
      where: { cups: cupsStr },
      data: { iban: ibanStr }
    });

    if (result.count > 0) {
      updatedCount++;
    } else {
      notFoundCount++;
      console.log(`CUPS not found in DB: ${cupsStr}`);
    }
  }

  console.log(`Successfully updated IBANs for ${updatedCount} CUPS. (${notFoundCount} not found)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
