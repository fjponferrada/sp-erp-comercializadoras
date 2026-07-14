import municipios from './municipios_ine.json';

export function normalizeTipoVia(via: string): string {
  if (!via) return 'CL';
  const v = via.toLowerCase().trim();
  
  const map: Record<string, string> = {
    'calle': 'CL',
    'c/': 'CL',
    'cl': 'CL',
    'avenida': 'AV',
    'avda': 'AV',
    'av': 'AV',
    'plaza': 'PZ',
    'plza': 'PZ',
    'pz': 'PZ',
    'carretera': 'CR',
    'ctra': 'CR',
    'cr': 'CR',
    'paseo': 'PS',
    'pº': 'PS',
    'ps': 'PS',
    'camino': 'CM',
    'cno': 'CM',
    'cm': 'CM',
    'ronda': 'RD',
    'travesia': 'TR',
    'travesía': 'TR',
    'pasaje': 'PJ',
    'poligono': 'PG',
    'polígono': 'PG',
    'parque': 'PQ',
    'barrio': 'BR',
    'sector': 'SC',
    'urbanizacion': 'UR',
    'urbanización': 'UR',
    'urb': 'UR',
    'glorieta': 'GL',
    'cuesta': 'CU',
    'calleja': 'CJ',
    'callejon': 'CJ',
    'callejón': 'CJ',
    'rambla': 'RM',
    'via': 'VI',
    'vía': 'VI'
  };

  return map[v] || 'CL';
}

export function normalizeProvincia(codPostal: string): string {
  if (!codPostal || codPostal.length < 4) return '00';
  let cp = codPostal.padStart(5, '0');
  return cp.substring(0, 2);
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function normalizeMunicipio(codPostal: string, cityName: string): string {
  const provCode = normalizeProvincia(codPostal);
  if (provCode === '00' || !cityName) return '000';

  const normalizedInput = removeAccents(cityName);

  // Exact or contains match within the same province
  const matches = (municipios as any[]).filter(m => m.provincia_id === provCode);
  
  if (matches.length === 0) return '000';

  // 1. Exact match
  let found = matches.find(m => removeAccents(m.nombre) === normalizedInput);

  // 2. Contains match (e.g., input "MADRID", db "Madrid (Capital)")
  if (!found) {
    found = matches.find(m => removeAccents(m.nombre).includes(normalizedInput) || normalizedInput.includes(removeAccents(m.nombre)));
  }

  // 3. Just return the first one if not found
  if (!found) return '000';

  return String(found.cmun).padStart(3, '0');
}
