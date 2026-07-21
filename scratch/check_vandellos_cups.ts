import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

async function check() {
  const brandId = 'cmq6j25l50001d441e0c06g9t';
  const municipalityName = "VANDELLÒS I L'HOSPITALET DE L'INFANT -- TARRAGONA";
  const searchCity = normalizeString(municipalityName);

  const sps = await prisma.supplyPoint.findMany({
    where: { client: { brandId } },
    select: { id: true, city: true, cups: true, postalCode: true }
  });

  const matchingSps = sps.filter(sp => {
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
  });

  console.log("Matching Supply Points found by our algorithm:");
  matchingSps.forEach(sp => {
    console.log(`- CUPS: ${sp.cups} | City: ${sp.city} | Postal Code: ${sp.postalCode}`);
  });

  console.log("\nChecking the specific CUPS mentioned by the user: ES0031408741046001MS0F");
  const specificSp = sps.find(s => s.cups === 'ES0031408741046001MS0F');
  if (specificSp) {
    console.log(`- CUPS: ${specificSp.cups} | City: ${specificSp.city} | Postal Code: ${specificSp.postalCode}`);
    const city = normalizeString(specificSp.city);
    console.log(`Normalized City: ${city}`);
    const matched = matchingSps.some(m => m.cups === specificSp.cups);
    console.log(`Did it match our algorithm? ${matched}`);
  } else {
    console.log("CUPS ES0031408741046001MS0F not found in the database for this brand!");
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
