import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Iniciando restauración de IBANs desde airtableData...');

  // Recuperar todos los contratos que tengan IBAN en airtableData pero no en la base relacional
  const contracts = await prisma.contract.findMany({
    include: { supplyPoint: true }
  });

  let contractIbansFixed = 0;
  let spIbansFixed = 0;

  for (const contract of contracts) {
    const airtableData = contract.airtableData as any;
    if (!airtableData || !airtableData['IBAN']) continue;

    const correctIban = airtableData['IBAN'].replace(/\s/g, ''); // Limpiar espacios si los hubiera

    // Actualizar el contrato si le falta el IBAN
    if (!contract.iban || contract.iban !== correctIban) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { iban: correctIban }
      });
      contractIbansFixed++;
    }

    // Actualizar el Supply Point si le falta el IBAN
    if (!contract.supplyPoint.iban || contract.supplyPoint.iban !== correctIban) {
      await prisma.supplyPoint.update({
        where: { id: contract.supplyPoint.id },
        data: { iban: correctIban }
      });
      spIbansFixed++;
    }
  }

  console.log('--- RESUMEN ---');
  console.log(`IBANs de Contratos corregidos: ${contractIbansFixed}`);
  console.log(`IBANs de Supply Points corregidos: ${spIbansFixed}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
