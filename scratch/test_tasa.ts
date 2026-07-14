import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

async function main() {
  const startDate = new Date('2022-01-01');
  const endDate = new Date('2025-12-31T23:59:59.999Z');
  
  try {
    console.log('Fetching invoices with brandId filter...');
    const brandId = 'cmq6j25l50001d441e0c06g9t'; // AED
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
        invoiceData: true,
        supplyPoint: {
          select: { city: true }
        }
      }
    });
    console.log(`Fetched ${invoices.length} invoices.`);
  } catch (err) {
    console.error('Crash during fetch:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
