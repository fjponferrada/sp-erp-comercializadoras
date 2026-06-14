export const TIPO_TRAMITACION_MAPPING: Record<string, { tipo: string; tipoC2: string | null }> = {
  'Alta nueva': { tipo: 'A3', tipoC2: null },
  'Cambio comercializadora sin cambios': { tipo: 'C1', tipoC2: null },
  'Cambio comercializadora con cambios administrativos': { tipo: 'C2', tipoC2: 'S' },
  'Cambio comercializadora con cambios técnicos': { tipo: 'C2', tipoC2: 'N' },
  'Cambio comercializadora con cambios técnicos y administrativos': { tipo: 'C2', tipoC2: 'A' },
  'Activación por desistimiento': { tipo: 'E1', tipoC2: null },
  'Modificación de datos administrativos': { tipo: 'M1', tipoC2: 'S' },
  'Modificación de datos técnicos': { tipo: 'M1', tipoC2: 'N' },
  'Modificación de datos administrativos y técnicos': { tipo: 'M1', tipoC2: 'A' },
  'Renovación': { tipo: 'R', tipoC2: null }
};

export function getTramitationCodes(tramitationType: string | null | undefined): { tipo: string | null; tipoC2: string | null } {
  if (!tramitationType) return { tipo: null, tipoC2: null };
  const mapped = TIPO_TRAMITACION_MAPPING[tramitationType.trim()];
  if (mapped) {
    return mapped;
  }
  return { tipo: null, tipoC2: null };
}
