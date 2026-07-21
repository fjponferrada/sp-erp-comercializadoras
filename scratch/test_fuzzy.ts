const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function checkMatch(invoiceCityRaw: string, searchCityRaw: string): boolean {
  // 1. Clean strings
  const searchCity = normalizeString(searchCityRaw.includes(' -- ') ? searchCityRaw.split(' -- ')[0] : searchCityRaw);
  const city = normalizeString(invoiceCityRaw);
  
  if (!city) return false;
  
  // 2. Exact or Substring Match
  if (city === searchCity || searchCity.includes(city) || city.includes(searchCity)) return true;
  
  // 3. Mixed Fuzzy Word Match
  const cityWords = city.split(/[\s\-']+/).filter(w => w.length >= 4);
  const searchWords = searchCity.split(/[\s\-']+/).filter(w => w.length >= 4);
  
  if (cityWords.length === 0) return false;
  
  // Every significant word in the invoice city must match at least one word in the search city with <= 1 typo
  let allWordsMatched = true;
  for (const cw of cityWords) {
    let wordMatched = false;
    for (const sw of searchWords) {
      // Allow 1 typo for words < 7 chars, 2 typos for words >= 7 chars
      const maxTypos = sw.length >= 7 ? 2 : 1;
      if (levenshtein(cw, sw) <= maxTypos) {
        wordMatched = true;
        break;
      }
    }
    if (!wordMatched) {
      allWordsMatched = false;
      break;
    }
  }
  
  return allWordsMatched;
}

const tests = [
  { inv: "LOSPITALET DE LINFANT", search: "VANDELLÒS I L'HOSPITALET DE L'INFANT -- TARRAGONA", expected: true },
  { inv: "L'HOSPITALET DE L'INFANT", search: "VANDELLÒS I L'HOSPITALET DE L'INFANT -- TARRAGONA", expected: true },
  { inv: "L'HOSPITALET DE LLOBREGAT", search: "VANDELLÒS I L'HOSPITALET DE L'INFANT -- TARRAGONA", expected: false },
  { inv: "TARRAGONA", search: "VANDELLÒS I L'HOSPITALET DE L'INFANT -- TARRAGONA", expected: false },
  { inv: "VANDELLOS", search: "VANDELLÒS I L'HOSPITALET DE L'INFANT -- TARRAGONA", expected: true },
  { inv: "SANT QUIRCE DEL VALLES", search: "SANT QUIRZE DEL VALLES -- BARCELONA", expected: true },
  { inv: "SANT QUIRCE DE BESORA", search: "SANT QUIRZE DEL VALLES -- BARCELONA", expected: false },
];

for (const t of tests) {
  const result = checkMatch(t.inv, t.search);
  console.log(`inv: "${t.inv}" | search: "${t.search}" => ${result} (Expected: ${t.expected})`);
}
