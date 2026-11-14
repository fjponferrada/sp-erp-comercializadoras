export const SETTLEMENT_ORDER = [
  'A1', 'C1',
  'A2', 'C2',
  'A3', 'C3',
  'A4', 'C4',
  'A5', 'C5',
  'A6', 'C6',
  'A7', 'C7',
  'A8', 'C8',
] as const;

export const SETTLEMENT_RANKS: Record<string, number> = SETTLEMENT_ORDER.reduce(
  (acc, code, idx) => {
    acc[code] = idx + 1;
    return acc;
  },
  {} as Record<string, number>
);

export const REGANECU_CONCEPT_ORDER = ['BS3', 'CBM', 'RAD3', 'CAD', 'DSV', 'PC3'];

export const REGANECU_CONCEPT_MAP: Record<string, string> = {
  BS3: 'Banda Secundaria CF',
  RAD3: 'Coste a BRP servicio de respuesta activa',
  CAD: 'Costes asignados a la demanda',
  PC3: 'Pagos capacidad (Financiación)',
  DSV: 'Desvíos',
  CBM: 'Contratos bilaterales mercado',
};

/**
 * Normaliza conceptos de REE que ocasionalmente llegan con su descripción larga (Regla 138)
 * a su acrónimo oficial (BS3, CBM, RAD3, CAD, DSV, PC3) para evitar duplicidades o desorden.
 */
export function normalizeReganecuConcept(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const upper = trimmed
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (REGANECU_CONCEPT_MAP[upper]) return upper;
  if (upper.includes('BANDA SECUNDARIA')) return 'BS3';
  if (upper.includes('RESPUESTA ACTIVA')) return 'RAD3';
  if (upper.includes('ASIGNADOS A LA DEMANDA')) return 'CAD';
  if (upper.includes('PAGOS CAPACIDAD') || upper.includes('PAGOS POR CAPACIDAD')) return 'PC3';
  if (upper === 'DESVIOS' || upper.startsWith('DESVIO')) return 'DSV';
  if (upper.includes('CONTRATOS BILATERALES')) return 'CBM';

  return trimmed;
}

/**
 * Selecciona y ordena las liquidaciones a mostrar en "Evolución Liquidaciones":
 * - Nunca resta una liquidación definitiva (C) contra una provisional (A): las C siempre
 *   se comparan contra la C inmediatamente anterior (C5-C4, C4-C3, C3-C2, C2-C1).
 * - Si existe alguna C consolidada, descarta todas las provisionales A cuyo número sea <= al mayor C,
 *   y como máximo conserva la provisional A más reciente posterior al último C (ej. A5-C4, A4-C3, A3-C2, A2-C1).
 * - Únicamente si NO existe ninguna definitiva C en el mes, muestra las provisionales A disponibles (ej. A2-A1).
 */
export function getEvolutionCierres(summaryData: Record<string, number> | null | undefined): string[] {
  if (!summaryData) return [];

  const keys = Object.keys(summaryData).filter(k => /^[AC]\d+$/i.test(k));
  const sortByNum = (a: string, b: string) =>
    parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);

  const cClosures = keys
    .filter(k => k.toUpperCase().startsWith('C'))
    .map(k => k.toUpperCase())
    .sort(sortByNum);

  const aClosures = keys
    .filter(k => k.toUpperCase().startsWith('A'))
    .map(k => k.toUpperCase())
    .sort(sortByNum);

  if (cClosures.length > 0) {
    const maxCNum = Math.max(...cClosures.map(c => parseInt(c.slice(1), 10)));
    const higherAs = aClosures.filter(a => parseInt(a.slice(1), 10) > maxCNum);
    if (higherAs.length > 0) {
      return [...cClosures, higherAs[higherAs.length - 1]];
    }
    return cClosures;
  }

  return aClosures;
}
