import { SupplyPoint, Contract } from '@prisma/client';

export const CNAES_HOGAR = ['9820', '9821'];

/**
 * Clean numeric string and safely cast to float
 */
function cleanNumber(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0.0;
  if (typeof value === 'number') return value;
  const s = value.replace(',', '.').trim();
  const num = parseFloat(s);
  return isNaN(num) ? 0.0 : num;
}

/**
 * Clean CNAE strings e.g. "9820.0" -> "9820"
 */
function cleanCnae(value: string | null | undefined): string {
  if (!value || value.trim() === '') return '';
  const s = value.trim();
  if (s.includes('.')) {
    return s.split('.')[0];
  }
  return s;
}

/**
 * Calculates the segment of a supply point exactly as the python generador_maestro.py did.
 * Note: Provide annualConsumption in MWh if possible, or we assume it's in kWh based on standard DB usage.
 * Actually, the Python script assumed it was MWh if < 1000, and kWh if > 1000. Let's standardize.
 * In the DB, `annualConsumption` is usually stored in kWh. Let's convert to MWh for the checks.
 */
export function calculateSegment(
  tariff: string | null,
  annualConsumptionKwh: number | null,
  p1c: number | null,
  cnaeRaw: string | null
): string {
  const t = (tariff || '').toUpperCase().trim();
  const consumoMwh = cleanNumber(annualConsumptionKwh); // DB already stores in MWh
  const p1 = cleanNumber(p1c);
  const cnae = cleanCnae(cnaeRaw);

  // 1. VEHÍCULO ELÉCTRICO (PRIORIDAD MÁXIMA)
  if (t.includes('VE')) {
    if (consumoMwh < 15) return 'VE <15 MWh';
    else return 'VE >15 MWh';
  }

  // VIP
  if (consumoMwh > 100) {
    return 'VIP';
  }

  // 2. FILTRO CNAE
  if (cnae && !CNAES_HOGAR.includes(cnae)) {
    // Es un negocio
    if (consumoMwh < 50) return 'PYME <50 MWh';
    else return 'PYME >50 MWh';
  }

  // 3. LÓGICA ESTÁNDAR
  if (t.startsWith('2')) {
    if (p1 <= 5) return 'HOGAR 0-5kW';
    else if (p1 <= 10) return 'HOGAR 5-10kW';
    else return 'HOGAR 10-15kW';
  } else {
    if (consumoMwh < 50) return 'PYME <50 MWh';
    else return 'PYME >50 MWh';
  }
}
