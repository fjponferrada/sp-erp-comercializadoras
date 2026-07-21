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

  console.log('Fetching invoices...');
  console.time('fetch_invoices');
  
  const invoices = await prisma.invoice.findMany({
    where: {
      client: { brandId },
      issueDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      pdfUrl: true,
      issueDate: true,
      billingStart: true,
      billingEnd: true,
      invoiceNumber: true,
      invoiceType: true,
      taxAmount: true,
      totalMWh: true,
      subtotal1: true,
      invoiceData: true,
      client: { select: { vatNumber: true } },
      supplyPoint: {
        select: {
          cups: true,
          city: true,
          tariff: true,
          postalCode: true,
          distributor: true,
          distributorName: true
        }
      }
    },
    orderBy: { issueDate: 'asc' }
  });
  console.timeEnd('fetch_invoices');

  console.log(`Fetched ${invoices.length} invoices.`);

  const searchCity = normalizeString(municipalityName);
  console.log(`Searching for city: ${searchCity}`);

  const filteredInvoices = invoices.filter(inv => {
    const data = inv.invoiceData as Record<string, any> | null;
    const rawCity = inv.supplyPoint?.city || (data ? (data['POBLACION PS'] || data['Poblacion PS'] || data['Población PS']) : null);
    const city = normalizeString(rawCity as string);
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
  });

  console.log(`Filtered down to ${filteredInvoices.length} invoices.`);
}

test().catch(console.error).finally(() => prisma.$disconnect());
