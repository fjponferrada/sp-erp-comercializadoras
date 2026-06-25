import fs from 'fs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const filePath = 'Z:\\AED\\Compras Energia\\SCRIPT FACTURACION PPA FIN\\BD_OMIE.csv';
  console.log(`Leyendo archivo: ${filePath}`);

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n');

  // Skip header "datetime;omie"
  const dataLines = lines.slice(1).filter(l => l.trim() !== '');

  // Map to group by Date string (YYYY-MM-DD)
  // Structure: { "2024-01-01": [63.33, 50.09, ...] }
  const groupedByDate: Record<string, number[]> = {};

  console.log(`Procesando ${dataLines.length} filas horarias...`);

  for (const line of dataLines) {
    const [datetimeStr, priceStr] = line.split(';');
    if (!datetimeStr || !priceStr) continue;

    const dateStr = datetimeStr.split('T')[0]; // "2024-01-01"
    
    // El precio en el CSV viene con coma decimal (ej. "63,33")
    const price = parseFloat(priceStr.replace(',', '.'));

    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = [];
    }
    groupedByDate[dateStr].push(price);
  }

  const dates = Object.keys(groupedByDate);
  console.log(`Se han agrupado en ${dates.length} días distintos.`);

  // Upsert into DB
  console.log('Inyectando en la base de datos...');
  let count = 0;
  for (const dateStr of dates) {
    const hourlyPrices = groupedByDate[dateStr];
    
    // Transformar datos horarios (N horas) en quinceminutales (N * 4 cuartos)
    // Normalmente N=24, resultando en 96. En días de cambio de hora puede ser 23 o 25 (92 o 100 cuartos).
    // OJO: Si ya vienen 96 (o aprox, es decir, es cuarto-horario), no multiplicamos por 4.
    const quarterHourlyPrices: number[] = [];
    if (hourlyPrices.length >= 90) { // Ya es cuarto horario
      quarterHourlyPrices.push(...hourlyPrices);
    } else { // Es horario
      for (const p of hourlyPrices) {
        quarterHourlyPrices.push(p, p, p, p);
      }
    }

    const dateObj = new Date(`${dateStr}T00:00:00Z`);

    await prisma.systemComponentPrice.upsert({
      where: {
        component_date: {
          component: 'OMIE',
          date: dateObj
        }
      },
      update: {
        values: quarterHourlyPrices
      },
      create: {
        component: 'OMIE',
        date: dateObj,
        values: quarterHourlyPrices
      }
    });

    count++;
    if (count % 100 === 0) {
      console.log(`[${count}/${dates.length}] Días guardados...`);
    }
  }

  console.log(`¡Importación completada! ${count} registros insertados/actualizados.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
