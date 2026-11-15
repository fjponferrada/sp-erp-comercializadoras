import { prisma } from '@/lib/prisma';
import { pickSpanishPostalCode, getSpanishPostalPrefix } from '@/lib/postalCode';
import { canonicalProvince, matchesMunicipality, normalizeAsciiUpper } from '@/lib/taxUtils';

export interface IneMunicipalityEntry {
  id: string;
  code: string; // INE 5-digit code (e.g. "14007")
  name: string; // Official INE name (e.g. "Baena")
  provCode: string; // 2-digit province code ("01".."52")
  provName: string; // Official Province name ("Córdoba")
  normName: string; // Uppercase ASCII without apostrophes
  compactName: string; // Only A-Z0-9 (e.g. "TORREDELCAMPO", "RIBAROJADETURIA")
  variantsNorm: string[]; // Bilingual "/" variants normalized
  variantsCompact: string[];
  searchTokens: string; // Precomputed searchable string (name + province + code)
}

export interface ResolvedMunicipality {
  groupKey: string; // "INE:14007" or "RAW:DESCONOCIDO|14"
  ineCode: string | null;
  poblacion: string; // Canonical uppercase municipality display name
  provincia: string; // Canonical uppercase province display name
  provCode: string;
  cp: string;
  isOfficialIne: boolean;
}

const ARTICLES_SET = new Set(['EL', 'LA', 'LOS', 'LAS', 'LES', 'ELS', 'L', 'SA', 'SES', 'ES', 'A', 'AS', 'O', 'OS']);

/**
 * Mapa verificado de Códigos Postales / Pedanías / Entidades Locales Autónomas / Núcleos
 * hacia el nombre oficial del Ayuntamiento recaudador de la Tasa del 1,5% (Art. 24.1.c TRLRHL).
 */
const PEDANIA_BY_CP: Record<string, { municipality: string; provCode: string; aliasLabel?: string }> = {
  // Córdoba (14)
  '14859': { municipality: 'Baena', provCode: '14', aliasLabel: 'Albendín' },
  '14814': { municipality: 'Priego de Córdoba', provCode: '14', aliasLabel: 'Zamoranos' },
  '14815': { municipality: 'Priego de Córdoba', provCode: '14', aliasLabel: 'Castil de Campos' },
  '14816': { municipality: 'Priego de Córdoba', provCode: '14', aliasLabel: 'Zagrilla' },
  '14817': { municipality: 'Priego de Córdoba', provCode: '14', aliasLabel: 'Las Lagunillas' },
  '14820': { municipality: 'Córdoba', provCode: '14', aliasLabel: 'Santa Cruz' },
  '14610': { municipality: 'Córdoba', provCode: '14', aliasLabel: 'Alcolea' },
  '14350': { municipality: 'Córdoba', provCode: '14', aliasLabel: 'Cerro Muriano' },
  '14719': { municipality: 'Córdoba', provCode: '14', aliasLabel: 'Villarrubia' },
  '14193': { municipality: 'Córdoba', provCode: '14', aliasLabel: 'El Higuerón' },
  '14711': { municipality: 'Córdoba', provCode: '14', aliasLabel: 'Encinarejo de Córdoba' },
  // Jaén (23)
  '23669': { municipality: 'Alcaudete', provCode: '23', aliasLabel: 'Los Noguerones / Bobadilla' },
  '23685': { municipality: 'Alcaudete', provCode: '23', aliasLabel: 'Sabariego' },
  '23684': { municipality: 'Alcalá la Real', provCode: '23', aliasLabel: 'La Rábita' },
  '23640': { municipality: 'Torredelcampo', provCode: '23', aliasLabel: 'Torre del Campo / Megatín' },
  // Málaga (29)
  '29740': { municipality: 'Vélez-Málaga', provCode: '29', aliasLabel: 'Torre del Mar' },
  '29749': { municipality: 'Vélez-Málaga', provCode: '29', aliasLabel: 'Almayate' },
  '29792': { municipality: 'Vélez-Málaga', provCode: '29', aliasLabel: 'Caleta de Vélez / Cajiz' },
  '29716': { municipality: 'Vélez-Málaga', provCode: '29', aliasLabel: 'Chilches / Loma las Chozas' },
  '29793': { municipality: 'Torrox', provCode: '29', aliasLabel: 'Torrox Costa / El Morche' },
  '29639': { municipality: 'Benalmádena', provCode: '29', aliasLabel: 'Arroyo de la Miel / Benalmádena Costa' },
  '29140': { municipality: 'Málaga', provCode: '29', aliasLabel: 'Churriana' },
  '29130': { municipality: 'Alhaurín de la Torre', provCode: '29', aliasLabel: 'Alhaurín de la Torre / El Alamillo' },
  '29711': { municipality: 'Alcaucín', provCode: '29', aliasLabel: 'Puente Don Manuel / El Puente' },
  // Huelva (21)
  '21750': { municipality: 'Almonte', provCode: '21', aliasLabel: 'El Rocío' },
  '21760': { municipality: 'Almonte', provCode: '21', aliasLabel: 'Matalascañas' },
  // Granada (18)
  '18247': { municipality: 'Moclín', provCode: '18', aliasLabel: 'Puerto Lope' },
  '18293': { municipality: 'Íllora', provCode: '18', aliasLabel: 'Obéilar' },
  '18290': { municipality: 'Albolote', provCode: '18', aliasLabel: 'El Chaparral' },
  // Almería (04)
  '04110': { municipality: 'Níjar', provCode: '04', aliasLabel: 'Campohermoso / San Isidro' },
  // Badajoz (06)
  '06180': { municipality: 'Badajoz', provCode: '06', aliasLabel: 'Gévora' },
  // Tarragona (43)
  '43892': { municipality: 'Mont-roig del Camp', provCode: '43', aliasLabel: 'Miami Platja' },
  '43890': { municipality: "Vandellòs i l'Hospitalet de l'Infant", provCode: '43', aliasLabel: "L'Hospitalet de l'Infant" },
  // Barcelona (08)
  '08520': { municipality: 'Les Franqueses del Vallès', provCode: '08', aliasLabel: 'Bellavista' },
  // Valencia (46)
  '46182': { municipality: 'Paterna', provCode: '46', aliasLabel: 'La Cañada' },
  // Huesca (22)
  '22197': { municipality: 'Huesca', provCode: '22', aliasLabel: 'Cuarte' },
};

/**
 * Pedanías donde el CP coincide con el municipio matriz o es compartido, resueltas por (provCode|normCity).
 */
const PEDANIA_BY_PROV_AND_NAME: Record<string, string> = {
  '14|ALBENDIN': 'Baena',
  '14|PALOMAREJO': 'Baena',
  '14|MANOSALBA': 'Baena',
  '14|SANTA CRUZ': 'Córdoba',
  '14|ALCOLEA': 'Córdoba',
  '14|CERRO MURIANO': 'Córdoba',
  '14|VILLARRUBIA': 'Córdoba',
  '14|EL HIGUERON': 'Córdoba',
  '14|ENCINAREJO': 'Córdoba',
  '14|ENCINAREJO DE CORDOBA': 'Córdoba',
  '14|ZAMORANOS': 'Priego de Córdoba',
  '14|ZAGRILLA': 'Priego de Córdoba',
  '14|ZAGRILLA ALTA': 'Priego de Córdoba',
  '14|ZAGRILLA BAJA': 'Priego de Córdoba',
  '14|LAS LAGUNILLAS': 'Priego de Córdoba',
  '14|LA ESTACION': 'Luque',
  '14|ESTACION DE LUQUE': 'Luque',
  '14|OJUELOS ALTOS': 'Fuente Obejuna',
  '14|OJUELOS BAJOS': 'Fuente Obejuna',
  '14|PENILLAS': 'La Carlota',
  '14|LAS PENILLAS': 'La Carlota',
  '23|NOGUERONES': 'Alcaudete',
  '23|LOS NOGUERONES': 'Alcaudete',
  '23|BOBADILLA': 'Alcaudete',
  '23|SABARIEGO': 'Alcaudete',
  '23|LA RABITA': 'Alcalá la Real',
  '23|MEGATIN': 'Torredelcampo',
  '23|MONTE LOPE ALVAREZ': 'Martos',
  '23|MONTE LOPE-ALVAREZ MARTOS': 'Martos',
  '29|TORRE DEL MAR': 'Vélez-Málaga',
  '29|LOMA LAS CHOZAS': 'Vélez-Málaga',
  '29|CHURRIANA': 'Málaga',
  '29|EL ALAMILLO': 'Alhaurín de la Torre',
  '29|ARROYO DE LA MIEL': 'Benalmádena',
  '21|EL ROCIO': 'Almonte',
  '21|MATALASCANAS': 'Almonte',
  '04|CAMPO HERMOSO': 'Níjar',
  '04|CAMPOHERMOSO': 'Níjar',
  '06|GEVORA': 'Badajoz',
  '43|MIAMI PLATJA': 'Mont-roig del Camp',
  '08|BELLAVISTA': 'Les Franqueses del Vallès',
  '46|LA CANADA': 'Paterna',
  '18|PUERTO LOPE': 'Moclín',
  '18|OBEILAR': 'Íllora',
  '18|TOCON': 'Íllora',
  '18|EL CHAPARRAL': 'Albolote',
  '22|CUARTE': 'Huesca',
  '33|LUGONES': 'Siero',
  '33|LLUGONES': 'Siero',
};

interface IneCatalog {
  loadedAt: number;
  all: IneMunicipalityEntry[];
  byCode: Map<string, IneMunicipalityEntry>;
  byProvCode: Map<string, IneMunicipalityEntry[]>;
  provCodeToName: Map<string, string>;
  canonProvToCode: Map<string, string>;
}

let cachedCatalog: IneCatalog | null = null;
const CATALOG_TTL_MS = 10 * 60 * 1000;

function toNorm(s: string): string {
  return normalizeAsciiUpper(s).replace(/['’`´]/g, '');
}

function toCompact(s: string): string {
  return toNorm(s).replace(/[^A-Z0-9]/g, '');
}

/**
 * Reordena artículos invertidos ("POBLA DE FARNALS, LA" -> "LA POBLA DE FARNALS", "VERGER (EL)" -> "EL VERGER")
 */
function normalizeInvertedArticle(raw: string): string {
  const norm = toNorm(raw);
  // Caso "NOMBRE (EL)"
  const parenMatch = norm.match(/^(.+?)\s*\(([A-Z]+)\)$/);
  if (parenMatch && ARTICLES_SET.has(parenMatch[2])) {
    return `${parenMatch[2]} ${parenMatch[1].trim()}`;
  }
  // Caso "NOMBRE, LA"
  const commaMatch = norm.match(/^(.+?),\s*([A-Z]+)$/);
  if (commaMatch && ARTICLES_SET.has(commaMatch[2])) {
    return `${commaMatch[2]} ${commaMatch[1].trim()}`;
  }
  return norm;
}

export async function getIneCatalog(): Promise<IneCatalog> {
  if (cachedCatalog && Date.now() - cachedCatalog.loadedAt < CATALOG_TTL_MS) {
    return cachedCatalog;
  }

  const [provinces, municipalities] = await Promise.all([
    prisma.province.findMany(),
    prisma.municipality.findMany({ include: { province: true }, orderBy: { name: 'asc' } }),
  ]);

  const provCodeToName = new Map<string, string>();
  const canonProvToCode = new Map<string, string>();

  for (const p of provinces) {
    const code = p.code.padStart(2, '0');
    provCodeToName.set(code, p.name);
    const canon = canonicalProvince(p.name);
    if (canon) canonProvToCode.set(canon, code);
  }

  const all: IneMunicipalityEntry[] = [];
  const byCode = new Map<string, IneMunicipalityEntry>();
  const byProvCode = new Map<string, IneMunicipalityEntry[]>();

  for (const m of municipalities) {
    const provCode = m.province.code.padStart(2, '0');
    const provName = m.province.name;
    const normName = normalizeInvertedArticle(m.name);
    const compactName = toCompact(normName);

    const rawParts = m.name.split('/').map((v) => v.trim()).filter(Boolean);
    const variantsNorm = rawParts.map((v) => normalizeInvertedArticle(v));
    const variantsCompact = variantsNorm.map((v) => toCompact(v));

    const searchTokens = `${normName} ${compactName} ${variantsNorm.join(' ')} ${toNorm(provName)} ${m.code}`;

    const entry: IneMunicipalityEntry = {
      id: m.id,
      code: m.code,
      name: m.name,
      provCode,
      provName,
      normName,
      compactName,
      variantsNorm,
      variantsCompact,
      searchTokens,
    };

    all.push(entry);
    byCode.set(m.code, entry);
    if (!byProvCode.has(provCode)) byProvCode.set(provCode, []);
    byProvCode.get(provCode)!.push(entry);
  }

  cachedCatalog = {
    loadedAt: Date.now(),
    all,
    byCode,
    byProvCode,
    provCodeToName,
    canonProvToCode,
  };

  return cachedCatalog;
}

function findInProvinceList(
  candidates: IneMunicipalityEntry[],
  cityRaw: string
): IneMunicipalityEntry | null {
  if (!cityRaw || candidates.length === 0) return null;

  const norm = normalizeInvertedArticle(cityRaw);
  const compact = toCompact(norm);
  if (!compact || compact === 'DESCONOCIDO' || compact === 'DESCONOCIDA') return null;

  // 1. Coincidencia exacta normalizada o bilingüe
  for (const c of candidates) {
    if (c.normName === norm || c.variantsNorm.includes(norm)) return c;
  }

  // 2. Coincidencia compacta sin espacios ni guiones ("TORRE DEL CAMPO" === "TORREDELCAMPO", "RIBARROJA" === "RIBA-ROJA")
  for (const c of candidates) {
    if (c.compactName === compact || c.variantsCompact.includes(compact)) return c;
  }

  // 3. Sin artículo inicial ("GARRIGA" / "LA GARRIGA" vs "la Garriga", "PRAT DE LLOBREGAT" vs "el Prat de Llobregat")
  const stripLeadingArt = (s: string) => {
    const parts = s.split(/\s+/);
    if (parts.length > 1 && ARTICLES_SET.has(parts[0])) return parts.slice(1).join(' ');
    return s;
  };
  const normNoArt = stripLeadingArt(norm);
  const compactNoArt = toCompact(normNoArt);
  if (compactNoArt.length >= 4) {
    for (const c of candidates) {
      if (toCompact(stripLeadingArt(c.normName)) === compactNoArt) return c;
      if (c.variantsNorm.some((v) => toCompact(stripLeadingArt(v)) === compactNoArt)) return c;
    }
  }

  // 4. Si incluye municipio matriz entre paréntesis o tras coma/guion:
  //    ej. "ALBENDIN (BAENA)", "LOS CHOPOS (CASTILLO DE LOCUBIN)", "LAS NAVAS, PRIEGO DE CORDOBA", "ARROYO DE LA MIEL-BENALMADENA"
  const rawUpper = toNorm(cityRaw);
  const parenQualifier = rawUpper.match(/\(([^)]+)\)/);
  if (parenQualifier && !ARTICLES_SET.has(parenQualifier[1].trim())) {
    const innerHit = findInProvinceList(candidates, parenQualifier[1].trim());
    if (innerHit) return innerHit;
  }

  if (rawUpper.includes(',')) {
    const commaParts = rawUpper.split(',').map((p) => p.trim()).filter((p) => p && !ARTICLES_SET.has(p));
    for (const part of commaParts) {
      if (part !== rawUpper) {
        const hit = findInProvinceList(candidates, part);
        if (hit) return hit;
      }
    }
  }

  if (rawUpper.includes('-')) {
    const dashParts = rawUpper.split('-').map((p) => p.trim()).filter((p) => p.length >= 4 && p !== 'COSTA');
    for (const part of dashParts) {
      if (part !== rawUpper) {
        const hit = findInProvinceList(candidates, part);
        if (hit) return hit;
      }
    }
  }

  // 5. Sufijos/prefijos costeros, residenciales o ferroviarios habituales ("TORROX COSTA" -> "Torrox", "SESEÑA NUEVO" -> "Seseña", "ESTACION DE CABRA" -> "Cabra")
  const strippedAffix = norm
    .replace(/^(ESTACION DE|URBANIZACION|URB|BARRIO DE|NUCLEO)\s+/, '')
    .replace(/\s+(COSTA|COSTQA|PLAYA|NUEVO|NUEVA|VIEJO|VIEJA)$/, '')
    .trim();
  if (strippedAffix && strippedAffix !== norm && strippedAffix.length >= 4) {
    for (const c of candidates) {
      if (c.normName === strippedAffix || c.compactName === toCompact(strippedAffix)) return c;
    }
  }

  // 6. Fuzzy matching controlado (Regla 84 / matchesMunicipality: ej. "BOLLULLOS DEL CONDADO" -> "Bollullos Par del Condado")
  for (const c of candidates) {
    if (matchesMunicipality(cityRaw, c.provName, `${c.name} -- ${c.provName}`)) {
      return c;
    }
  }

  return null;
}

/**
 * Resuelve de forma determinista el Ayuntamiento oficial (INE) al que corresponde un suministro/factura.
 * Garantiza identidad 100% entre la vista "Todos los ayuntamientos" y "Ayuntamiento específico".
 */
export function resolveCanonicalMunicipalitySync(
  catalog: IneCatalog,
  params: {
    rawCity?: string | null;
    rawProvince?: string | null;
    postalCode?: string | null;
    sipsPostalCode?: string | null;
    invoiceCpPs?: any;
  }
): ResolvedMunicipality {
  const cp = pickSpanishPostalCode(params.invoiceCpPs, params.postalCode, params.sipsPostalCode);
  const cpPrefix = getSpanishPostalPrefix(cp);

  const canonProv = canonicalProvince(params.rawProvince);
  const provCodeFromText = canonProv ? catalog.canonProvToCode.get(canonProv) || '' : '';

  // El prefijo de 2 dígitos del Código Postal del Punto de Suministro (01..52) es autoridad física frente a textos erróneos
  const provCode = cpPrefix || provCodeFromText;
  const officialProvName =
    (provCode ? catalog.provCodeToName.get(provCode) : '') ||
    (params.rawProvince ? String(params.rawProvince).trim() : '');

  const rawCityStr = String(params.rawCity || '').trim();
  const normCity = toNorm(rawCityStr);
  const provCandidates = provCode ? catalog.byProvCode.get(provCode) || [] : [];

  // 1. Intentar casar directamente la ciudad declarada dentro de la provincia física
  if (rawCityStr && provCandidates.length > 0) {
    const directHit = findInProvinceList(provCandidates, rawCityStr);
    if (directHit) {
      return {
        groupKey: `INE:${directHit.code}`,
        ineCode: directHit.code,
        poblacion: directHit.name.toUpperCase(),
        provincia: directHit.provName.toUpperCase(),
        provCode: directHit.provCode,
        cp: cp || 'Desconocido',
        isOfficialIne: true,
      };
    }

    // 2. Comprobar diccionario de pedanías por (provCode|normCity)
    const pedaniaTargetByName = PEDANIA_BY_PROV_AND_NAME[`${provCode}|${normCity}`];
    if (pedaniaTargetByName) {
      const pedHit = findInProvinceList(provCandidates, pedaniaTargetByName);
      if (pedHit) {
        return {
          groupKey: `INE:${pedHit.code}`,
          ineCode: pedHit.code,
          poblacion: pedHit.name.toUpperCase(),
          provincia: pedHit.provName.toUpperCase(),
          provCode: pedHit.provCode,
          cp: cp || 'Desconocido',
          isOfficialIne: true,
        };
      }
    }
  }

  // 3. Comprobar diccionario de pedanías / núcleos por Código Postal de 5 dígitos (ej. 14859 Albendín -> Baena)
  if (cp && PEDANIA_BY_CP[cp]) {
    const pedRule = PEDANIA_BY_CP[cp];
    const pCandidates = catalog.byProvCode.get(pedRule.provCode) || [];
    const pedHit = findInProvinceList(pCandidates, pedRule.municipality);
    if (pedHit) {
      return {
        groupKey: `INE:${pedHit.code}`,
        ineCode: pedHit.code,
        poblacion: pedHit.name.toUpperCase(),
        provincia: pedHit.provName.toUpperCase(),
        provCode: pedHit.provCode,
        cp,
        isOfficialIne: true,
      };
    }
  }

  // 4. Si no había CP ni provincia válida, intentar casar en todo el catálogo cuando el nombre es inequívoco
  if (!provCode && rawCityStr) {
    const globalMatches = catalog.all.filter((m) => m.normName === normCity || m.compactName === toCompact(normCity));
    if (globalMatches.length === 1) {
      const single = globalMatches[0];
      return {
        groupKey: `INE:${single.code}`,
        ineCode: single.code,
        poblacion: single.name.toUpperCase(),
        provincia: single.provName.toUpperCase(),
        provCode: single.provCode,
        cp: cp || 'Desconocido',
        isOfficialIne: true,
      };
    }
  }

  // 5. Fallback sin pérdida: mantener aislado para auditoría (ej. "Desconocido" o CUPS con ciudad fiscal incoherente con su CP)
  const fallbackCityLabel =
    !normCity || normCity === 'DESCONOCIDO' || normCity === 'DESCONOCIDA'
      ? cp
        ? `SIN MUNICIPIO (CP ${cp})`
        : 'DESCONOCIDO'
      : cpPrefix && provCodeFromText && cpPrefix !== provCodeFromText
        ? `${normCity} (REVISAR CP ${cp})`
        : normCity;

  const fallbackKeyCity = normCity || (cp ? `CP_${cp}` : 'DESCONOCIDO');
  return {
    groupKey: `RAW:${fallbackKeyCity}|${provCode || 'XX'}`,
    ineCode: null,
    poblacion: fallbackCityLabel,
    provincia: officialProvName ? officialProvName.toUpperCase() : '',
    provCode: provCode || '',
    cp: cp || 'Desconocido',
    isOfficialIne: false,
  };
}

/**
 * Busca poblaciones en el catálogo INE de forma insensible a tildes, apóstrofes, guiones y espacios,
 * permitiendo además buscar por Provincia, Código INE o Código Postal / nombre de pedanía.
 */
export async function searchIneMunicipalities(rawQuery: string, limit = 50): Promise<Array<{ label: string; value: string; ineCode: string }>> {
  const qTrim = rawQuery.trim();
  if (qTrim.length < 2) return [];

  const catalog = await getIneCatalog();
  const qNorm = toNorm(qTrim);
  const qCompact = toCompact(qTrim);
  const qWords = qNorm.split(/\s+/).filter(Boolean);

  const results: Array<{ entry: IneMunicipalityEntry; score: number; aliasHint?: string }> = [];
  const seenCodes = new Set<string>();

  // Si el usuario escribe un CP de 5 dígitos, resolver tanto pedanías como cualquier CP presente en cartera
  if (/^\d{5}$/.test(qTrim)) {
    if (PEDANIA_BY_CP[qTrim]) {
      const ped = PEDANIA_BY_CP[qTrim];
      const hit = findInProvinceList(catalog.byProvCode.get(ped.provCode) || [], ped.municipality);
      if (hit) {
        seenCodes.add(hit.code);
        results.push({ entry: hit, score: 1000, aliasHint: `CP ${qTrim}${ped.aliasLabel ? ` - ${ped.aliasLabel}` : ''}` });
      }
    }
    const spMatches = await prisma.supplyPoint.findMany({
      where: { OR: [{ postalCode: qTrim }, { sipsPostalCode: qTrim }] },
      select: { city: true, province: true, postalCode: true, sipsPostalCode: true },
      take: 10,
    });
    for (const sp of spMatches) {
      const resolved = resolveCanonicalMunicipalitySync(catalog, {
        rawCity: sp.city,
        rawProvince: sp.province,
        postalCode: sp.postalCode,
        sipsPostalCode: sp.sipsPostalCode,
      });
      if (resolved.ineCode && !seenCodes.has(resolved.ineCode)) {
        const hit = catalog.byCode.get(resolved.ineCode);
        if (hit) {
          seenCodes.add(hit.code);
          results.push({ entry: hit, score: 990, aliasHint: `CP ${qTrim}` });
        }
      }
    }
  }

  for (const entry of catalog.all) {
    if (seenCodes.has(entry.code)) continue;

    let score = 0;
    if (entry.normName === qNorm || entry.compactName === qCompact || entry.variantsNorm.includes(qNorm)) {
      score = 950;
    } else if (
      entry.normName.startsWith(qNorm) ||
      entry.compactName.startsWith(qCompact) ||
      entry.variantsNorm.some((v) => v.startsWith(qNorm))
    ) {
      score = 800 - Math.min(50, entry.normName.length);
    } else if (
      entry.normName.includes(qNorm) ||
      (qCompact.length >= 3 && entry.compactName.includes(qCompact))
    ) {
      score = 600 - Math.min(50, entry.normName.length);
    } else if (
      qWords.length > 1 &&
      qWords.every((w) => entry.searchTokens.includes(w))
    ) {
      score = 500;
    } else if (qNorm.length >= 3 && toNorm(entry.provName).startsWith(qNorm)) {
      score = 300;
    }

    if (score > 0) {
      seenCodes.add(entry.code);
      results.push({ entry, score });
    }
  }

  // Si además coincide con el nombre específico de una pedanía cuyo ayuntamiento matriz aún no apareció directamente
  for (const [key, targetMuni] of Object.entries(PEDANIA_BY_PROV_AND_NAME)) {
    const [pCode, pedName] = key.split('|');
    if (pedName.includes(qNorm) || toCompact(pedName).includes(qCompact)) {
      const hit = findInProvinceList(catalog.byProvCode.get(pCode) || [], targetMuni);
      if (hit && !seenCodes.has(hit.code)) {
        seenCodes.add(hit.code);
        results.push({ entry: hit, score: 850, aliasHint: `incluye ${pedName}` });
      }
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.name.localeCompare(b.entry.name, 'es');
  });

  return results.slice(0, limit).map(({ entry, aliasHint }) => ({
    label: `${entry.name.toUpperCase()} -- ${entry.provName.toUpperCase()} -- ESPAÑA${aliasHint ? ` (${aliasHint})` : ''}`,
    value: `${entry.name} -- ${entry.provName}`,
    ineCode: entry.code,
  }));
}

/**
 * Resuelve el `groupKey` objetivo cuando el usuario selecciona una población del desplegable
 * ("Municipio -- Provincia") o hace drill-down directo desde una fila de la tabla agrupada (`groupKey`).
 */
export function resolveTargetGroupKeys(
  catalog: IneCatalog,
  municipalityQuery: string | null,
  explicitGroupKey: string | null
): Set<string> | null {
  if (explicitGroupKey && explicitGroupKey.trim()) {
    return new Set([explicitGroupKey.trim()]);
  }
  if (!municipalityQuery || !municipalityQuery.trim()) {
    return null;
  }

  const parts = municipalityQuery.split(' -- ').map((s) => s.trim());
  const muniPart = parts[0] || '';
  const provPart = parts[1] || '';

  const matchedKeys = new Set<string>();

  if (provPart) {
    const cProv = canonicalProvince(provPart);
    const pCode = cProv ? catalog.canonProvToCode.get(cProv) : undefined;
    if (pCode) {
      const hit = findInProvinceList(catalog.byProvCode.get(pCode) || [], muniPart);
      if (hit) {
        matchedKeys.add(`INE:${hit.code}`);
        return matchedKeys;
      }
    }
  }

  // Fallback si se pasó solo nombre de municipio sin provincia
  for (const entry of catalog.all) {
    if (matchesMunicipality(entry.name, entry.provName, municipalityQuery)) {
      matchedKeys.add(`INE:${entry.code}`);
    }
  }

  return matchedKeys;
}
