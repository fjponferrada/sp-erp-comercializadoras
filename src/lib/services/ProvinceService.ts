import { getSpanishPostalPrefix } from '@/lib/postalCode';

export interface ProvinceGeo {
  name: string;
  lat: number;
  lon: number;
}

export const PROVINCES_GEO: Record<string, ProvinceGeo> = {
  '01': { name: 'Álava', lat: 42.8467, lon: -2.6716 },
  '02': { name: 'Albacete', lat: 38.9942, lon: -1.8564 },
  '03': { name: 'Alicante', lat: 38.3453, lon: -0.4831 },
  '04': { name: 'Almería', lat: 36.8381, lon: -2.4597 },
  '05': { name: 'Ávila', lat: 40.6565, lon: -4.6818 },
  '06': { name: 'Badajoz', lat: 38.8786, lon: -6.9703 },
  '07': { name: 'Islas Baleares', lat: 39.5694, lon: 2.6502 },
  '08': { name: 'Barcelona', lat: 41.3888, lon: 2.1590 },
  '09': { name: 'Burgos', lat: 42.3439, lon: -3.6969 },
  '10': { name: 'Cáceres', lat: 39.4765, lon: -6.3722 },
  '11': { name: 'Cádiz', lat: 36.5267, lon: -6.2891 },
  '12': { name: 'Castellón', lat: 39.9864, lon: -0.0513 },
  '13': { name: 'Ciudad Real', lat: 38.9861, lon: -3.9273 },
  '14': { name: 'Córdoba', lat: 37.8845, lon: -4.7796 },
  '15': { name: 'A Coruña', lat: 43.3713, lon: -8.3960 },
  '16': { name: 'Cuenca', lat: 40.0704, lon: -2.1374 },
  '17': { name: 'Girona', lat: 41.9831, lon: 2.8249 },
  '18': { name: 'Granada', lat: 37.1773, lon: -3.5986 },
  '19': { name: 'Guadalajara', lat: 40.6328, lon: -3.1601 },
  '20': { name: 'Gipuzkoa', lat: 43.3128, lon: -1.9750 },
  '21': { name: 'Huelva', lat: 37.2664, lon: -6.9400 },
  '22': { name: 'Huesca', lat: 42.1362, lon: -0.4087 },
  '23': { name: 'Jaén', lat: 37.7692, lon: -3.7903 },
  '24': { name: 'León', lat: 42.5987, lon: -5.5671 },
  '25': { name: 'Lleida', lat: 41.6148, lon: 0.6267 },
  '26': { name: 'La Rioja', lat: 42.4667, lon: -2.4500 },
  '27': { name: 'Lugo', lat: 43.0099, lon: -7.5560 },
  '28': { name: 'Madrid', lat: 40.4165, lon: -3.7026 },
  '29': { name: 'Málaga', lat: 36.7202, lon: -4.4203 },
  '30': { name: 'Murcia', lat: 37.9870, lon: -1.1300 },
  '31': { name: 'Navarra', lat: 42.8169, lon: -1.6432 },
  '32': { name: 'Ourense', lat: 42.3367, lon: -7.8641 },
  '33': { name: 'Asturias', lat: 43.3614, lon: -5.8593 },
  '34': { name: 'Palencia', lat: 42.0095, lon: -4.5241 },
  '35': { name: 'Las Palmas', lat: 28.1248, lon: -15.4300 },
  '36': { name: 'Pontevedra', lat: 42.4338, lon: -8.6479 },
  '37': { name: 'Salamanca', lat: 40.9688, lon: -5.6639 },
  '38': { name: 'Santa Cruz de Tenerife', lat: 28.4682, lon: -16.2546 },
  '39': { name: 'Cantabria', lat: 43.4647, lon: -3.8044 },
  '40': { name: 'Segovia', lat: 40.9481, lon: -4.1184 },
  '41': { name: 'Sevilla', lat: 37.3828, lon: -5.9732 },
  '42': { name: 'Soria', lat: 41.7636, lon: -2.4650 },
  '43': { name: 'Tarragona', lat: 41.1167, lon: 1.2500 },
  '44': { name: 'Teruel', lat: 40.3440, lon: -1.1069 },
  '45': { name: 'Toledo', lat: 39.8581, lon: -4.0226 },
  '46': { name: 'Valencia', lat: 39.4697, lon: -0.3774 },
  '47': { name: 'Valladolid', lat: 41.6520, lon: -4.7286 },
  '48': { name: 'Bizkaia', lat: 43.2627, lon: -2.9253 },
  '49': { name: 'Zamora', lat: 41.5033, lon: -5.7463 },
  '50': { name: 'Zaragoza', lat: 41.6561, lon: -0.8773 },
  '51': { name: 'Ceuta', lat: 35.8883, lon: -5.3162 },
  '52': { name: 'Melilla', lat: 35.2923, lon: -2.9381 }
};

/**
 * Returns the province prefix (01 to 52) based on postal code.
 */
export function getProvinceCode(postalCode: string | null): string {
  const prefix = getSpanishPostalPrefix(postalCode);
  if (prefix && PROVINCES_GEO[prefix]) return prefix;
  return '28';
}

export function getProvinceGeo(postalCode: string | null): ProvinceGeo {
  const code = getProvinceCode(postalCode);
  return PROVINCES_GEO[code];
}

export const PROVINCE_NAMES: string[] = Object.values(PROVINCES_GEO).map((p) => p.name);

function stripAccentsLower(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const CANONICAL_BY_NORMALIZED: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const geo of Object.values(PROVINCES_GEO)) {
    map[stripAccentsLower(geo.name)] = geo.name;
  }
  // Variantes históricas, bilingües y erratas detectadas en importaciones reales
  const aliases: Record<string, string> = {
    araba: 'Álava',
    'araba/alava': 'Álava',
    'alava/araba': 'Álava',
    'alicante/alacant': 'Alicante',
    alacant: 'Alicante',
    'balears, illes': 'Islas Baleares',
    'illes balears': 'Islas Baleares',
    baleares: 'Islas Baleares',
    'islas baleares': 'Islas Baleares',
    'castellon/castello': 'Castellón',
    'castello/castellon': 'Castellón',
    castello: 'Castellón',
    'la coruna': 'A Coruña',
    coruna: 'A Coruña',
    gerona: 'Girona',
    guipuzcoa: 'Gipuzkoa',
    lerida: 'Lleida',
    madrd: 'Madrid',
    mavarra: 'Navarra',
    orense: 'Ourense',
    'valencia/valencia': 'Valencia',
    vizcaya: 'Bizkaia',
    tenerife: 'Santa Cruz de Tenerife',
    'sta. cruz de tenerife': 'Santa Cruz de Tenerife',
    'sta cruz de tenerife': 'Santa Cruz de Tenerife',
  };
  for (const [alias, canonical] of Object.entries(aliases)) {
    map[alias] = canonical;
  }
  return map;
})();

const CODE_BY_NAME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [code, geo] of Object.entries(PROVINCES_GEO)) {
    map[geo.name] = code;
  }
  return map;
})();

/**
 * Resuelve siempre uno de los 52 nombres canónicos de PROVINCES_GEO:
 * 1) Si existe un código postal válido (01..52), tiene prioridad geográfica exacta.
 * 2) En caso contrario, normaliza tildes/mayúsculas/alias sobre el texto libre de provincia.
 * 3) Fallback seguro a 'Madrid' cuando el dato es nulo o inválido ('-', 'Desconocida').
 */
export function normalizeProvinceName(
  rawProvince?: string | null,
  postalCode?: string | null
): string {
  const prefix = getSpanishPostalPrefix(postalCode);
  if (prefix && PROVINCES_GEO[prefix]) {
    return PROVINCES_GEO[prefix].name;
  }

  if (rawProvince) {
    const cleaned = stripAccentsLower(rawProvince);
    if (cleaned && cleaned !== '-' && cleaned !== 'desconocida') {
      if (CANONICAL_BY_NORMALIZED[cleaned]) {
        return CANONICAL_BY_NORMALIZED[cleaned];
      }
      // Si viene separada por '/' (ej. bilingüe), probar cada parte
      if (cleaned.includes('/')) {
        for (const part of cleaned.split('/')) {
          const p = part.trim();
          if (CANONICAL_BY_NORMALIZED[p]) return CANONICAL_BY_NORMALIZED[p];
        }
      }
    }
  }

  return 'Madrid';
}

export function getProvinceCodeByName(provinceName?: string | null): string {
  const canonical = normalizeProvinceName(provinceName);
  return CODE_BY_NAME[canonical] || '28';
}

export function getProvinceGeoByName(provinceName?: string | null): ProvinceGeo {
  const code = getProvinceCodeByName(provinceName);
  return PROVINCES_GEO[code];
}
