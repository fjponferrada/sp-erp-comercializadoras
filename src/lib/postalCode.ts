/**
 * Utilidades centralizadas de normalización y validación de Códigos Postales de España.
 *
 * En importaciones desde Excel, Airtable, CSV o SIPS, las celdas numéricas de las provincias
 * 01..09 (Álava, Albacete, Alicante, Almería, Ávila, Badajoz, Baleares, Barcelona y Burgos)
 * pierden el cero a la izquierda (ej. 05230 Ávila -> 5230, 03510 Alicante -> 3510).
 * Sin esta normalización, comparaciones por prefijo confunden:
 *   - "5230" (05230 Ávila) con "52xxx" (Melilla -> IPSI en vez de IVA 21%)
 *   - "51xx" (051xx Ávila) con "51xxx" (Ceuta -> IPSI en vez de IVA 21%)
 *   - "35xx"/"38xx" (035xx/038xx Alicante) con "35xxx"/"38xxx" (Canarias -> IGIC)
 *   - "31xx" (031xx Alicante) con "31xxx" (Navarra -> Hacienda Foral)
 *   - "20xx" (020xx Albacete) con "20xxx" (Guipúzcoa -> Hacienda Foral)
 *   - "48xx" (048xx Almería) con "48xxx" (Vizcaya -> Hacienda Foral)
 */

export function normalizeSpanishPostalCode(raw: unknown, fallback = ''): string {
  if (raw === null || raw === undefined) return fallback;
  const trimmed = String(raw).trim();
  if (!trimmed) return fallback;

  // Limpia sufijos decimales enteros típicos de celdas numéricas (ej. "5230.0" -> "5230")
  const cleanDecimal = trimmed.replace(/\.0+$/, '');

  // Provincias 01..09 representadas como entero de 4 cifras (1000..9999 -> 01000..09999)
  if (/^[1-9]\d{3}$/.test(cleanDecimal)) {
    return `0${cleanDecimal}`;
  }

  if (/^\d{5}$/.test(cleanDecimal)) {
    return cleanDecimal;
  }

  return trimmed;
}

export function normalizeSpanishPostalCodeOrNull(raw: unknown): string | null {
  const normalized = normalizeSpanishPostalCode(raw, '');
  return normalized ? normalized : null;
}

/**
 * Extrae el prefijo provincial oficial INE/Correos ("01".."52") únicamente cuando el código
 * postal normalizado tiene exactamente 5 dígitos válidos. Evita falsos positivos con cadenas
 * truncadas, placeholders ("00000") o erratas de longitud ("52", "296004").
 */
export function getSpanishPostalPrefix(raw: unknown): string | null {
  const cp = normalizeSpanishPostalCode(raw, '');
  if (!/^\d{5}$/.test(cp)) return null;
  const prefixNum = parseInt(cp.substring(0, 2), 10);
  if (prefixNum < 1 || prefixNum > 52) return null;
  return cp.substring(0, 2);
}

/**
 * Selecciona el primer código postal español válido de 5 dígitos ("01001".."52999",
 * ignorando placeholders como "00000") entre varios candidatos por orden de prioridad.
 * Si ninguno cumple formato oficial de 5 dígitos, devuelve el primer valor no vacío normalizado.
 */
export function pickSpanishPostalCode(...candidates: unknown[]): string {
  let firstNonEmpty = '';
  for (const c of candidates) {
    const norm = normalizeSpanishPostalCode(c, '');
    if (!norm) continue;
    if (!firstNonEmpty && norm !== '00000') {
      firstNonEmpty = norm;
    }
    if (getSpanishPostalPrefix(norm) !== null) {
      return norm;
    }
  }
  return firstNonEmpty;
}
