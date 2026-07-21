import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

async function test() {
  const brandId = 'cmq6j25l50001d441e0c06g9t';
  const startDate = new Date('2022-01-01');
  const endDate = new Date('2028-12-31T23:59:59.999Z');
  const municipalityName = "VANDELLÒS I L'HOSPITALET DE L'INFANT -- TARRAGONA";
  const searchCity = normalizeString(municipalityName);

  console.log('Fetching all supply points for brand...');
  console.time('fetch_sps');
  const sps = await prisma.supplyPoint.findMany({
    where: { client: { brandId } },
    select: { id: true, city: true }
  });
  console.timeEnd('fetch_sps');

  console.log(`Fetched ${sps.length} SPs.`);

  console.time('filter_sps');
  const matchingSpIds = sps.filter(sp => {
    const city = normalizeString(sp.city);
    if (!city) return false;
    if (city === searchCity || city.includes(searchCity) || (city.length >= 4 && searchCity.includes(city))) return true;
    
    const cityWords = city.split(' ').filter(w => w.length >= 4);
    const searchWords = searchCity.split(' ').filter(w => w.length >= 4);
    
    for (const cw of cityWords) {
      if (cw.length >= 5 && searchWords.some(sw => sw === cw || sw.includes(cw) || cw.includes(sw))) {
        return true;
      }
    }
    return false;
  }).map(sp => sp.id);
  console.timeEnd('filter_sps');

  console.log(`Found ${matchingSpIds.length} matching supply points.`);

  console.time('fetch_invoices_by_sp');
  const invoices = await prisma.invoice.findMany({
    where: {
      client: { brandId },
      issueDate: {
        gte: startDate,
        lte: endDate,
      },
      supplyPointId: { in: matchingSpIds }
    },
    select: { id: true }
  });
  console.timeEnd('fetch_invoices_by_sp');

  console.log(`Fetched ${invoices.length} invoices using pre-filter.`);
}

test().catch(console.error).finally(() => prisma.$disconnect());
