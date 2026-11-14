export type CnmcScaleLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface CnmcOriginMixItem {
  key: string;
  source: string;
  companyPct: number;
  nationalPct: number;
  color: string;
}

export interface CompanyCnmcLabelConfig {
  labelYear: number;
  is100RenewableGdo: boolean;
  nationalAvgLetter: CnmcScaleLetter;
  co2Letter: CnmcScaleLetter;
  co2CompanyGPerKwh: number;
  co2NationalGPerKwh: number;
  radLetter: CnmcScaleLetter;
  radCompanyUgPerKwh: number;
  radNationalUgPerKwh: number;
  mix: CnmcOriginMixItem[];
}

export const CNMC_SCALE_COLORS: Record<CnmcScaleLetter, string> = {
  A: '#009640',
  B: '#50b848',
  C: '#b5d334',
  D: '#ffdd00',
  E: '#f59c00',
  F: '#eb690b',
  G: '#e30613',
};

export const CNMC_SCALE_LETTERS: CnmcScaleLetter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export const DEFAULT_CNMC_MIX_ROWS: CnmcOriginMixItem[] = [
  { key: 'renovable', source: 'Renovable', companyPct: 100.0, nationalPct: 50.8, color: '#009640' },
  { key: 'cogen', source: 'Cogen. Alta Eficiencia', companyPct: 0.0, nationalPct: 2.6, color: '#63b3ed' },
  { key: 'cc_gas', source: 'CC Gas Natural', companyPct: 0.0, nationalPct: 18.3, color: '#f6ad55' },
  { key: 'carbon', source: 'Carbón', companyPct: 0.0, nationalPct: 1.5, color: '#4a5568' },
  { key: 'fuel_gas', source: 'Fuel / Gas', companyPct: 0.0, nationalPct: 1.2, color: '#b7791f' },
  { key: 'nuclear', source: 'Nuclear', companyPct: 0.0, nationalPct: 20.9, color: '#805ad5' },
  { key: 'otras', source: 'Otras no renovables', companyPct: 0.0, nationalPct: 4.7, color: '#a0aec0' },
];

export const DEFAULT_CNMC_LABEL_CONFIG: CompanyCnmcLabelConfig = {
  labelYear: 2024,
  is100RenewableGdo: true,
  nationalAvgLetter: 'D',
  co2Letter: 'A',
  co2CompanyGPerKwh: 0,
  co2NationalGPerKwh: 102,
  radLetter: 'A',
  radCompanyUgPerKwh: 0,
  radNationalUgPerKwh: 446,
  mix: DEFAULT_CNMC_MIX_ROWS.map((r) => ({ ...r })),
};

function normalizeLetter(val: any, fallback: CnmcScaleLetter): CnmcScaleLetter {
  const clean = String(val || '')
    .trim()
    .toUpperCase() as CnmcScaleLetter;
  return CNMC_SCALE_LETTERS.includes(clean) ? clean : fallback;
}

function normalizeFiniteNumber(val: any, fallback: number): number {
  if (val === undefined || val === null || val === '') return fallback;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 1000) / 1000 : fallback;
}

export function normalizeCnmcLabelConfig(raw: any): CompanyCnmcLabelConfig {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const rawMix = Array.isArray(obj.mix) ? obj.mix : [];
  const mix: CnmcOriginMixItem[] = DEFAULT_CNMC_MIX_ROWS.map((defRow, idx) => {
    const found =
      rawMix.find(
        (m: any) =>
          (m?.key && String(m.key) === defRow.key) ||
          (m?.source && String(m.source).toLowerCase() === defRow.source.toLowerCase())
      ) || rawMix[idx];
    return {
      key: defRow.key,
      source: defRow.source,
      color: defRow.color,
      companyPct: normalizeFiniteNumber(found?.companyPct, defRow.companyPct),
      nationalPct: normalizeFiniteNumber(found?.nationalPct, defRow.nationalPct),
    };
  });

  const renovableRow = mix.find((m) => m.key === 'renovable');
  const inferred100Renewable = renovableRow ? renovableRow.companyPct >= 99.95 : true;

  const yearNum = parseInt(String(obj.labelYear ?? DEFAULT_CNMC_LABEL_CONFIG.labelYear), 10);
  const labelYear =
    Number.isFinite(yearNum) && yearNum >= 2018 && yearNum <= 2100
      ? yearNum
      : DEFAULT_CNMC_LABEL_CONFIG.labelYear;

  return {
    labelYear,
    is100RenewableGdo:
      typeof obj.is100RenewableGdo === 'boolean' ? obj.is100RenewableGdo : inferred100Renewable,
    nationalAvgLetter: normalizeLetter(
      obj.nationalAvgLetter,
      DEFAULT_CNMC_LABEL_CONFIG.nationalAvgLetter
    ),
    co2Letter: normalizeLetter(obj.co2Letter, DEFAULT_CNMC_LABEL_CONFIG.co2Letter),
    co2CompanyGPerKwh: normalizeFiniteNumber(
      obj.co2CompanyGPerKwh,
      DEFAULT_CNMC_LABEL_CONFIG.co2CompanyGPerKwh
    ),
    co2NationalGPerKwh: normalizeFiniteNumber(
      obj.co2NationalGPerKwh,
      DEFAULT_CNMC_LABEL_CONFIG.co2NationalGPerKwh
    ),
    radLetter: normalizeLetter(obj.radLetter, DEFAULT_CNMC_LABEL_CONFIG.radLetter),
    radCompanyUgPerKwh: normalizeFiniteNumber(
      obj.radCompanyUgPerKwh,
      DEFAULT_CNMC_LABEL_CONFIG.radCompanyUgPerKwh
    ),
    radNationalUgPerKwh: normalizeFiniteNumber(
      obj.radNationalUgPerKwh,
      DEFAULT_CNMC_LABEL_CONFIG.radNationalUgPerKwh
    ),
    mix,
  };
}
