import { prisma } from '../src/lib/prisma';
import fs from 'fs';

function parseFloatSafe(val: string): number {
  if (!val) return 0;
  // Handle commas and scientific notation
  const cleanVal = val.replace(',', '.').trim();
  const num = parseFloat(cleanVal);
  return isNaN(num) ? 0 : num;
}

async function importProfile(year: number, filePath: string) {
  console.log(`Importando perfiles REE del año ${year}...`);
  if (!fs.existsSync(filePath)) {
    console.log(`No se encontró el archivo: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim() !== '');

  const dataToInsert = [];

  // Empezar en 1 para saltar cabecera
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 6) continue;

    const month = parseInt(cols[0], 10);
    const day = parseInt(cols[1], 10);
    const hour = parseInt(cols[2], 10); // 1-24

    const p20td = parseFloatSafe(cols[3]);
    const p30td = parseFloatSafe(cols[4]);
    const p30tdve = parseFloatSafe(cols[5]);

    if (!isNaN(month) && !isNaN(day) && !isNaN(hour)) {
      dataToInsert.push({
        year,
        month,
        day,
        hour,
        p20td,
        p30td,
        p30tdve
      });
    }
  }

  console.log(`Insertando ${dataToInsert.length} horas para ${year}...`);

  // Insert in batches of 5000 to avoid query limits
  const BATCH_SIZE = 5000;
  for (let i = 0; i < dataToInsert.length; i += BATCH_SIZE) {
    const batch = dataToInsert.slice(i, i + BATCH_SIZE);
    
    // We use createMany (faster than upsert for initial load). 
    // Wait, let's use a transaction or just createMany with skipDuplicates.
    await prisma.reeProfile.createMany({
      data: batch,
      skipDuplicates: true
    });
    console.log(` Insertados ${Math.min(i + BATCH_SIZE, dataToInsert.length)}/${dataToInsert.length}`);
  }

  console.log(`Perfiles ${year} importados correctamente.`);
}

async function main() {
  console.log('Limpiando perfiles anteriores...');
  await prisma.reeProfile.deleteMany();

  await importProfile(2024, 'Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/COTIZADOR/perfilesree_2024.csv');
  await importProfile(2025, 'Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/COTIZADOR/perfilesree_2025.csv');
  await importProfile(2026, 'Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/COTIZADOR/perfilesree_2026.csv');

  console.log('¡Importación completada!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
