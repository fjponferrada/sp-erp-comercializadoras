/**
 * Validadores matemáticos en tiempo real para documentos e identificadores españoles:
 * - DNI / NIE / CIF (algoritmo oficial AEAT / Ministerio del Interior)
 * - IBAN (ISO 13616 MOD-97 + formateo en bloques de 4 + catálogo de entidades bancarias españolas)
 * - CUPS eléctrico (Real Decreto 1435/2002 — Módulo 529 sobre los 16 dígitos distribuidora+suministro)
 */

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const CIF_CONTROL_LETTERS = 'JABCDEFGHI';

export interface TaxIdValidationResult {
  empty: boolean;
  valid: boolean;
  kind: 'DNI' | 'NIE' | 'CIF' | 'NIF_ESPECIAL' | null;
  clean: string;
  expectedControl?: string;
  message: string;
}

export function validateSpanishTaxId(raw: string): TaxIdValidationResult {
  const clean = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[-\s.]/g, '');

  if (!clean) {
    return { empty: true, valid: false, kind: null, clean: '', message: '' };
  }

  if (clean.length < 8) {
    return {
      empty: false,
      valid: false,
      kind: null,
      clean,
      message: 'Introduce los 9 caracteres del NIF/NIE/CIF',
    };
  }

  // 1. DNI: 8 dígitos + 1 letra
  if (/^\d{8}[A-Z]$/.test(clean)) {
    const num = parseInt(clean.slice(0, 8), 10);
    const expected = DNI_LETTERS[num % 23];
    const actual = clean[8];
    if (actual === expected) {
      return { empty: false, valid: true, kind: 'DNI', clean, expectedControl: expected, message: 'DNI válido' };
    }
    return {
      empty: false,
      valid: false,
      kind: 'DNI',
      clean,
      expectedControl: expected,
      message: `Letra de DNI incorrecta (corresponde ${expected})`,
    };
  }

  // 2. NIE: X/Y/Z + 7 dígitos + 1 letra
  if (/^[XYZ]\d{7}[A-Z]$/.test(clean)) {
    const prefixMap: Record<string, string> = { X: '0', Y: '1', Z: '2' };
    const num = parseInt(prefixMap[clean[0]] + clean.slice(1, 8), 10);
    const expected = DNI_LETTERS[num % 23];
    const actual = clean[8];
    if (actual === expected) {
      return { empty: false, valid: true, kind: 'NIE', clean, expectedControl: expected, message: 'NIE válido' };
    }
    return {
      empty: false,
      valid: false,
      kind: 'NIE',
      clean,
      expectedControl: expected,
      message: `Letra de NIE incorrecta (corresponde ${expected})`,
    };
  }

  // 3. NIF especial personas físicas (K, L, M) + 7 dígitos + control
  if (/^[KLM]\d{7}[A-Z0-9]$/.test(clean)) {
    const cifControl = computeCifControl(clean.slice(1, 8));
    const dniExpected = DNI_LETTERS[parseInt(clean.slice(1, 8), 10) % 23];
    const actual = clean[8];
    if (actual === cifControl.letter || actual === cifControl.digit || actual === dniExpected) {
      return { empty: false, valid: true, kind: 'NIF_ESPECIAL', clean, message: 'NIF válido' };
    }
    return {
      empty: false,
      valid: false,
      kind: 'NIF_ESPECIAL',
      clean,
      expectedControl: cifControl.letter,
      message: `Carácter de control NIF incorrecto (esperado ${cifControl.letter})`,
    };
  }

  // 4. CIF personas jurídicas / entidades (A-H, J, N, P-S, U, V, W) + 7 dígitos + control
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(clean)) {
    const orgType = clean[0];
    const digits = clean.slice(1, 8);
    const actual = clean[8];
    const { digit, letter } = computeCifControl(digits);

    const mustBeLetter = 'PQRSNW'.includes(orgType) || digits.slice(0, 2) === '00';
    const mustBeDigit = 'ABEH'.includes(orgType);

    if (mustBeLetter) {
      if (actual === letter) {
        return { empty: false, valid: true, kind: 'CIF', clean, expectedControl: letter, message: 'CIF válido' };
      }
      return {
        empty: false,
        valid: false,
        kind: 'CIF',
        clean,
        expectedControl: letter,
        message: `Dígito de control CIF incorrecto (corresponde ${letter})`,
      };
    }

    if (mustBeDigit) {
      if (actual === digit) {
        return { empty: false, valid: true, kind: 'CIF', clean, expectedControl: digit, message: 'CIF válido' };
      }
      return {
        empty: false,
        valid: false,
        kind: 'CIF',
        clean,
        expectedControl: digit,
        message: `Dígito de control CIF incorrecto (corresponde ${digit})`,
      };
    }

    if (actual === digit || actual === letter) {
      return { empty: false, valid: true, kind: 'CIF', clean, expectedControl: actual, message: 'CIF válido' };
    }

    return {
      empty: false,
      valid: false,
      kind: 'CIF',
      clean,
      expectedControl: `${digit} o ${letter}`,
      message: `Control CIF incorrecto (corresponde ${digit} o ${letter})`,
    };
  }

  return {
    empty: false,
    valid: false,
    kind: null,
    clean,
    message: 'Formato NIF/NIE/CIF no reconocido',
  };
}

function computeCifControl(sevenDigits: string): { digit: string; letter: string } {
  let evenSum = 0;
  let oddSum = 0;
  for (let i = 0; i < 7; i++) {
    const n = parseInt(sevenDigits[i], 10);
    if ((i + 1) % 2 === 0) {
      evenSum += n;
    } else {
      const doubled = n * 2;
      oddSum += Math.floor(doubled / 10) + (doubled % 10);
    }
  }
  const total = evenSum + oddSum;
  const unit = (10 - (total % 10)) % 10;
  return {
    digit: String(unit),
    letter: CIF_CONTROL_LETTERS[unit],
  };
}

const SPANISH_BANKS: Record<string, string> = {
  '0019': 'Deutsche Bank',
  '0030': 'Banco Santander',
  '0049': 'Banco Santander',
  '0061': 'Banca March',
  '0073': 'Openbank',
  '0075': 'Banco Santander',
  '0078': 'Banca Pueyo',
  '0081': 'Banco Sabadell',
  '0128': 'Bankinter',
  '0138': 'ABANCA',
  '0182': 'BBVA',
  '0186': 'Banco Mediolanum',
  '0198': 'Banco Cooperativo Español',
  '0216': 'Targobank',
  '0229': 'Wizink / Bancopopular-e',
  '0232': 'Banco Inversis',
  '0234': 'CBNK',
  '0239': 'EVO Banco',
  '1465': 'ING',
  '1491': 'Triodos Bank',
  '1563': 'N26',
  '1583': 'Revolut',
  '2038': 'CaixaBank',
  '2048': 'Unicaja Banco',
  '2080': 'ABANCA',
  '2085': 'Ibercaja',
  '2095': 'Kutxabank',
  '2100': 'CaixaBank',
  '2103': 'Unicaja Banco',
  '3008': 'Caja Rural de Navarra',
  '3023': 'Caja Rural de Granada',
  '3035': 'Laboral Kutxa',
  '3058': 'Cajamar',
  '3060': 'CajaViva Caja Rural',
  '3081': 'Eurocaja Rural',
  '3085': 'Caja Rural de Zamora',
  '3183': 'Arquia Banca',
  '3187': 'Caja Rural del Sur',
  '3190': 'Globalcaja',
};

export function formatIbanPretty(raw: string): string {
  const clean = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 34);
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

export interface IbanValidationResult {
  empty: boolean;
  valid: boolean;
  clean: string;
  formatted: string;
  bankName: string | null;
  message: string;
}

export function validateIban(raw: string): IbanValidationResult {
  const clean = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!clean) {
    return { empty: true, valid: false, clean: '', formatted: '', bankName: null, message: '' };
  }

  const formatted = formatIbanPretty(clean);
  const bankName = clean.startsWith('ES') && clean.length >= 8 ? SPANISH_BANKS[clean.slice(4, 8)] || null : null;

  if (clean.startsWith('ES') && clean.length < 24) {
    return {
      empty: false,
      valid: false,
      clean,
      formatted,
      bankName,
      message: `IBAN español incompleto (${clean.length}/24 caracteres)${bankName ? ` · ${bankName}` : ''}`,
    };
  }

  if (clean.startsWith('ES') && !/^ES\d{22}$/.test(clean)) {
    return {
      empty: false,
      valid: false,
      clean,
      formatted,
      bankName,
      message: 'Un IBAN español debe tener formato ES + 22 dígitos',
    };
  }

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(clean)) {
    return {
      empty: false,
      valid: false,
      clean,
      formatted,
      bankName,
      message: 'Formato IBAN no válido',
    };
  }

  // ISO 13616 MOD-97 sin desbordamiento numérico
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let remainder = 0;
  for (let i = 0; i < rearranged.length; i++) {
    const ch = rearranged[i];
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      // A=10 .. Z=35 (dos dígitos)
      const val = code - 55;
      remainder = (remainder * 100 + val) % 97;
    } else {
      remainder = (remainder * 10 + (code - 48)) % 97;
    }
  }

  if (remainder === 1) {
    return {
      empty: false,
      valid: true,
      clean,
      formatted,
      bankName,
      message: bankName ? `IBAN válido · ${bankName}` : 'IBAN válido (MOD-97 verificado)',
    };
  }

  return {
    empty: false,
    valid: false,
    clean,
    formatted,
    bankName,
    message: `Dígitos de control IBAN incorrectos${bankName ? ` (${bankName})` : ''} — revisa los números`,
  };
}

export interface CupsValidationResult {
  empty: boolean;
  validFormat: boolean;
  checksumOk: boolean;
  clean: string;
  expectedControl?: string;
  message: string;
}

export function validateSpanishCups(raw: string): CupsValidationResult {
  const clean = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  if (!clean) {
    return { empty: true, validFormat: false, checksumOk: false, clean: '', message: '' };
  }

  if (clean.length < 20) {
    return {
      empty: false,
      validFormat: false,
      checksumOk: false,
      clean,
      message: `CUPS incompleto (${clean.length}/20 caracteres)`,
    };
  }

  if (clean.length !== 20 && clean.length !== 22) {
    return {
      empty: false,
      validFormat: false,
      checksumOk: false,
      clean,
      message: 'El CUPS español debe tener 20 o 22 caracteres',
    };
  }

  if (!/^ES\d{16}[A-Z]{2}([0-9][A-Z])?$/.test(clean)) {
    return {
      empty: false,
      validFormat: /^[A-Z]{2}[A-Z0-9]{18,20}$/.test(clean),
      checksumOk: false,
      clean,
      message: 'Estructura CUPS no estándar (ES + 16 dígitos + 2 letras)',
    };
  }

  const digits16 = clean.slice(2, 18);
  let mod529 = 0;
  for (let i = 0; i < 16; i++) {
    mod529 = (mod529 * 10 + (digits16.charCodeAt(i) - 48)) % 529;
  }
  const c = Math.floor(mod529 / 23);
  const r = mod529 % 23;
  const expectedControl = DNI_LETTERS[c] + DNI_LETTERS[r];
  const actualControl = clean.slice(18, 20);

  if (actualControl === expectedControl) {
    return {
      empty: false,
      validFormat: true,
      checksumOk: true,
      clean,
      expectedControl,
      message: 'CUPS válido (control CNMC verificado)',
    };
  }

  return {
    empty: false,
    validFormat: true,
    checksumOk: false,
    clean,
    expectedControl,
    message: `Posible error tipográfico en CUPS (letras control esperadas: ${expectedControl})`,
  };
}
