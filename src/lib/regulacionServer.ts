import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import { toMadridYmd } from '@/lib/ppaEngine';

export interface RegulatoryCompanyContext {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  companyId: string;
  company: {
    id: string;
    name: string;
    cif: string;
    codigo: string | null;
    address: string | null;
    email: string | null;
    contactPerson: string | null;
    phone: string | null;
    codigoRee: string | null;
    ordenCnmc: string | null;
    cie: string | null;
    brands: Array<{ id: string; name: string }>;
  };
  codigoAgente: string;
  ownReeCodes: string[];
  brandIds: string[];
  isSingleCompanyDeployment: boolean;
}

export async function requireRegulatoryContext(): Promise<
  { ok: true; ctx: RegulatoryCompanyContext } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado. Inicia sesión para continuar.' }, { status: 401 }),
    };
  }

  const user = session.user as any;
  if (!hasAdminOrBackofficeRole(user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Permisos insuficientes para generar reportes regulatorios.' },
        { status: 403 }
      ),
    };
  }

  let companyId = await resolveActiveCompanyId(session);
  if (!companyId && user.brandId) {
    const userBrand = await prisma.brand.findUnique({
      where: { id: user.brandId },
      select: { companyId: true },
    });
    companyId = userBrand?.companyId || null;
  }
  if (!companyId && user.role === 'SUPERADMIN') {
    const firstCompany = await prisma.company.findFirst({ select: { id: true } });
    companyId = firstCompany?.id || null;
  }

  if (!companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No se pudo resolver la empresa comercializadora activa.' },
        { status: 400 }
      ),
    };
  }

  const [company, totalCompanies] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        cif: true,
        codigo: true,
        address: true,
        email: true,
        contactPerson: true,
        phone: true,
        codigoRee: true,
        ordenCnmc: true,
        cie: true,
        brands: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
    }),
    prisma.company.count(),
  ]);

  if (!company) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'La comercializadora seleccionada no existe.' },
        { status: 404 }
      ),
    };
  }

  const codigoAgente = (company.ordenCnmc || 'R2-950').trim().toUpperCase();
  const normRee = company.codigoRee?.trim()
    ? /^\d{1,4}$/.test(company.codigoRee.trim())
      ? company.codigoRee.trim().padStart(4, '0')
      : company.codigoRee.trim()
    : null;

  return {
    ok: true,
    ctx: {
      userId: user.id || '',
      userEmail: user.email || '',
      userName: user.name || user.email || 'Usuario',
      userRole: user.role || 'BACKOFFICE',
      companyId: company.id,
      company,
      codigoAgente,
      ownReeCodes: normRee ? [normRee] : [],
      brandIds: company.brands.map(b => b.id),
      isSingleCompanyDeployment: totalCompanies <= 1,
    },
  };
}

/**
 * Construye el filtro Prisma multi-comercializadora para SwitchingEvent.
 */
export function buildSwitchingCompanyWhere(companyId: string, isSingleCompanyDeployment: boolean): any {
  const orClauses: any[] = [
    { supplyPoint: { client: { brand: { companyId } } } },
    { contract: { brand: { companyId } } },
    { contract: { client: { brand: { companyId } } } },
  ];
  if (isSingleCompanyDeployment) {
    orClauses.push({ supplyPointId: null, contractId: null });
  }
  return { OR: orClauses };
}

/**
 * Diferencia en días naturales (calendario Europe/Madrid, nunca negativa) según Manual CNMC SCC v6.0 Apdo. 11.
 */
export function daysBetweenMadridDates(
  earlier: Date | string | null | undefined,
  later: Date | string | null | undefined
): number {
  const ymdA = toMadridYmd(earlier);
  const ymdB = toMadridYmd(later);
  if (!ymdA || !ymdB) return 0;
  const [y1, m1, d1] = ymdA.split('-').map(Number);
  const [y2, m2, d2] = ymdB.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((utc2 - utc1) / 86_400_000));
}

export function isDateInMadridRange(
  dateVal: Date | string | null | undefined,
  startYmdInclusive: string,
  endYmdExclusive: string
): boolean {
  const ymd = toMadridYmd(dateVal);
  if (!ymd) return false;
  return ymd >= startYmdInclusive && ymd < endYmdExclusive;
}

/**
 * Clasificación TipoRetraso CNMC:
 * - '00': en plazo
 * - '05': retraso <= 15 días naturales
 * - '15': retraso > 15 días naturales
 */
export function classifyResponseTipoRetraso(responseDays: number): '00' | '05' | '15' {
  // Plazo legal respuesta electricidad (BT y AT): 7 días naturales (Apdo. 11.2 Manual CNMC)
  const delayOverDeadline = responseDays - 7;
  if (delayOverDeadline <= 0) return '00';
  if (delayOverDeadline <= 15) return '05';
  return '15';
}

export function classifyActivationTipoRetraso(operationalDelayDays: number): '00' | '05' | '15' {
  // En activación, operationalDelayDays ya es FechaEfectiva - FechaActivacionPrevista (Apdo. 11.3 y 11.5)
  if (operationalDelayDays <= 0) return '00';
  if (operationalDelayDays <= 15) return '05';
  return '15';
}

export function createDistributorCnmcMapper(
  distributorsList: Array<{ reeCode: string; name: string; registroCnmc: string | null }>
) {
  const byRee = new Map<string, string>();
  const normalizedNames: Array<{ upperName: string; cnmc: string }> = [];

  for (const dist of distributorsList) {
    if (!dist.registroCnmc) continue;
    const cnmc = dist.registroCnmc.trim().toUpperCase();
    if (dist.reeCode) {
      const cleanRee = dist.reeCode.trim();
      byRee.set(cleanRee, cnmc);
      if (/^\d{1,4}$/.test(cleanRee)) {
        byRee.set(cleanRee.padStart(4, '0'), cnmc);
      }
    }
    if (dist.name) {
      normalizedNames.push({ upperName: dist.name.trim().toUpperCase(), cnmc });
    }
  }

  return function resolveDistributorCnmc(sp: {
    distributorReeCode?: string | null;
    distributor?: string | null;
    distributorName?: string | null;
  } | null | undefined): { code: string; isFallback: boolean } {
    const rawRee = sp?.distributorReeCode?.trim();
    if (rawRee) {
      if (/^R1-\d{3}$/i.test(rawRee)) {
        return { code: rawRee.toUpperCase(), isFallback: false };
      }
      const paddedRee = /^\d{1,4}$/.test(rawRee) ? rawRee.padStart(4, '0') : rawRee;
      const fromRee = byRee.get(paddedRee) || byRee.get(rawRee);
      if (fromRee) {
        return { code: fromRee, isFallback: false };
      }
    }

    const nameCandidate = (sp?.distributor || sp?.distributorName || '').trim().toUpperCase();
    if (nameCandidate) {
      if (/^R1-\d{3}$/.test(nameCandidate)) {
        return { code: nameCandidate, isFallback: false };
      }
      const matched = normalizedNames.find(
        d => d.upperName === nameCandidate || nameCandidate.includes(d.upperName) || d.upperName.includes(nameCandidate)
      );
      if (matched) {
        return { code: matched.cnmc, isFallback: false };
      }

      // Fallbacks verificados contra censo oficial CNMC (R1)
      if (nameCandidate.includes('I-DE') || nameCandidate.includes('IBERDROLA')) {
        return { code: 'R1-001', isFallback: false };
      }
      if (nameCandidate.includes('UFD') || nameCandidate.includes('UNION FENOSA') || nameCandidate.includes('UNIÓN FENOSA')) {
        return { code: 'R1-002', isFallback: false };
      }
      if (nameCandidate.includes('EDISTRIBUCION') || nameCandidate.includes('EDISTRIBUCIÓN') || nameCandidate.includes('ENDESA')) {
        return { code: 'R1-299', isFallback: false };
      }
      if (nameCandidate.includes('HIDROCANT') || nameCandidate.includes('E-REDES') || nameCandidate.includes('CANTABRICO')) {
        return { code: 'R1-008', isFallback: false };
      }
      if (nameCandidate.includes('VIESGO') || nameCandidate.includes('BEGASA')) {
        return { code: 'R1-005', isFallback: false };
      }
    }

    return { code: 'R1-299', isFallback: true };
  };
}

export function mapTarifaAtrCnmc(tariff?: string | null): string {
  const t = (tariff || '').toUpperCase().trim();
  if (!t) return 'E1';
  if (t.includes('2.0') || t.includes('2.1')) return 'E1';
  if (t.includes('3.0') || t.includes('3.1')) return 'E2';
  if (t.includes('6.1')) return 'E3';
  if (t.includes('6.2')) return 'E4';
  if (t.includes('6.3')) return 'E5';
  if (t.includes('6.4')) return 'E6';
  return 'E1';
}

/**
 * Tipo de punto de medida según RD 1110/2007 (1..5) en función de la potencia máxima contratada (kW).
 */
export function mapTipoPuntoCnmc(sp?: {
  tariff?: string | null;
  p1c?: number | null;
  p2c?: number | null;
  p3c?: number | null;
  p4c?: number | null;
  p5c?: number | null;
  p6c?: number | null;
  sipsP1c?: number | null;
  sipsP2c?: number | null;
  sipsP3c?: number | null;
  sipsP4c?: number | null;
  sipsP5c?: number | null;
  sipsP6c?: number | null;
} | null): '1' | '2' | '3' | '4' | '5' {
  if (!sp) return '5';
  const powers = [
    sp.p1c, sp.p2c, sp.p3c, sp.p4c, sp.p5c, sp.p6c,
    sp.sipsP1c, sp.sipsP2c, sp.sipsP3c, sp.sipsP4c, sp.sipsP5c, sp.sipsP6c,
  ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);

  if (powers.length === 0) {
    const t = (sp.tariff || '').toUpperCase();
    if (t.includes('6.')) return '3';
    if (t.includes('3.0')) return '4';
    return '5';
  }

  const maxKw = Math.max(...powers);
  if (maxKw >= 10_000) return '1';
  if (maxKw > 450) return '2';
  if (maxKw > 50) return '3';
  if (maxKw > 15) return '4';
  return '5';
}

/**
 * Extrae el código oficial CNMC de 2 caracteres de motivo de rechazo (Tabla 27)
 * soportando tanto el formato nuevo de parser.ts ([{ codigo, descripcion, comentarios }])
 * como formatos legacy (strings u objetos XML crudos).
 */
export function extractMotivoRechazoCnmc(motivosRechazo: unknown, observaciones?: string | null): string {
  const normalizeCode = (raw: unknown): string | null => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    const clean = String(raw).trim().toUpperCase();
    if (!clean || clean.startsWith('[OBJECT')) return null;
    if (/^\d$/.test(clean)) return `0${clean}`;
    if (/^[A-Z0-9]{2}$/.test(clean)) return clean;
    return null;
  };

  if (motivosRechazo) {
    if (Array.isArray(motivosRechazo) && motivosRechazo.length > 0) {
      const first = motivosRechazo[0] as any;
      if (typeof first === 'string' || typeof first === 'number') {
        const c = normalizeCode(first);
        if (c) return c;
      } else if (first && typeof first === 'object') {
        const c = normalizeCode(first.codigo ?? first.CodigoMotivo ?? first.CodigoMotivoRechazo);
        if (c) return c;
      }
    } else if (typeof motivosRechazo === 'object') {
      const obj = motivosRechazo as any;
      const inner = obj.Motivo ?? obj.MotivoRechazo ?? obj.Rechazo ?? obj;
      if (Array.isArray(inner) && inner.length > 0) {
        const c = normalizeCode(inner[0]?.codigo ?? inner[0]?.CodigoMotivo ?? inner[0]?.CodigoMotivoRechazo ?? inner[0]);
        if (c) return c;
      } else if (inner && typeof inner === 'object') {
        const c = normalizeCode(inner.codigo ?? inner.CodigoMotivo ?? inner.CodigoMotivoRechazo);
        if (c) return c;
      }
    }
  }

  if (observaciones) {
    // Ej. "[84 - Reclamación duplicada]" o "[03 - NIF-CIF...]"
    const bracketMatch = observaciones.match(/\[([A-Z0-9]{1,2})(?:\s|-|\])/i);
    if (bracketMatch?.[1]) {
      const c = normalizeCode(bracketMatch[1]);
      if (c) return c;
    }
    try {
      const parsedObs = JSON.parse(observaciones);
      return extractMotivoRechazoCnmc(parsedObs, null);
    } catch {
      // ignore non-JSON text
    }
  }

  return '99';
}

/**
 * Catálogo oficial de provincias INE / ESCILA (Hoja "Provincias" de ESCILA_Códigos CNAEs.xlsx).
 */
export const ESCILA_PROVINCES: Record<string, string> = {
  '01': 'ARABA/ÁLAVA',
  '02': 'ALBACETE',
  '03': 'ALICANTE/ALACANT',
  '04': 'ALMERÍA',
  '05': 'ÁVILA',
  '06': 'BADAJOZ',
  '07': 'BALEARS (ILLES)',
  '08': 'BARCELONA',
  '09': 'BURGOS',
  '10': 'CÁCERES',
  '11': 'CÁDIZ',
  '12': 'CASTELLÓN/CASTELLÓ',
  '13': 'CIUDAD REAL',
  '14': 'CÓRDOBA',
  '15': 'CORUÑA (A)',
  '16': 'CUENCA',
  '17': 'GIRONA',
  '18': 'GRANADA',
  '19': 'GUADALAJARA',
  '20': 'GIPUZKOA',
  '21': 'HUELVA',
  '22': 'HUESCA',
  '23': 'JAÉN',
  '24': 'LEÓN',
  '25': 'LLEIDA',
  '26': 'RIOJA (LA)',
  '27': 'LUGO',
  '28': 'MADRID',
  '29': 'MÁLAGA',
  '30': 'MURCIA',
  '31': 'NAVARRA',
  '32': 'OURENSE',
  '33': 'ASTURIAS',
  '34': 'PALENCIA',
  '35': 'PALMAS (LAS)',
  '36': 'PONTEVEDRA',
  '37': 'SALAMANCA',
  '38': 'SANTA CRUZ TENERIFE',
  '39': 'CANTABRIA',
  '40': 'SEGOVIA',
  '41': 'SEVILLA',
  '42': 'SORIA',
  '43': 'TARRAGONA',
  '44': 'TERUEL',
  '45': 'TOLEDO',
  '46': 'VALENCIA/VALÈNCIA',
  '47': 'VALLADOLID',
  '48': 'BIZKAIA',
  '49': 'ZAMORA',
  '50': 'ZARAGOZA',
  '51': 'CEUTA',
  '52': 'MELILLA',
  '60': 'EXTRANJERO',
};

export function resolveIneProvinceCode(
  postalCode?: string | null,
  sipsPostalCode?: string | null,
  provinceName?: string | null
): { code: string; name: string; isFallback: boolean } {
  for (const pc of [postalCode, sipsPostalCode]) {
    const clean = (pc || '').trim();
    if (/^\d{5}$/.test(clean)) {
      const prefix = clean.slice(0, 2);
      if (ESCILA_PROVINCES[prefix]) {
        return { code: prefix, name: ESCILA_PROVINCES[prefix], isFallback: false };
      }
    }
  }

  const normText = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  if (provinceName) {
    const target = normText(provinceName);
    for (const [code, officialName] of Object.entries(ESCILA_PROVINCES)) {
      const normOfficial = normText(officialName);
      if (normOfficial === target || normOfficial.includes(target) || target.includes(normOfficial)) {
        return { code, name: officialName, isFallback: false };
      }
    }
  }

  return { code: '28', name: ESCILA_PROVINCES['28'], isFallback: true };
}

/**
 * Catálogo oficial de sectores ESCILA (Hoja "CNAE Sectores" de ESCILA_Códigos CNAEs.xlsx, códigos ORDEN 1..76).
 */
export const ESCILA_SECTORS: Record<string, string> = {
  '1': 'AGRICULTURA, GANADERÍA, CAZA Y SERVICIOS RELACIONADOS CON LAS MISMAS',
  '2': 'SILVICULTURA Y EXPLOTACIÓN FORESTAL',
  '3': 'PESCA',
  '4': 'EXTRACCION DE CARBONES (ANTRACITA, HULLA Y LIGNITO) Y TURBA',
  '5': 'EXTRACCION Y ACTIVIDADES DE APOYO A LA EXTRACCION DE PETRÓLEO Y GAS (PROSPECCIÓN, PERFORACIÓN, SONDEO, DRENAJE Y BOMBEO DE TERCEROS, ETC.)',
  '6': 'EXTRACCIÓN DE MINERALES METÁLICOS',
  '7': 'EXTRACCIÓN DE MINERALES DE URANIO Y TORIO',
  '8': 'OTRAS INDUSTRIAS EXTRACTIVAS',
  '9': 'ACTIVIDADES DE APOYO A OTRAS INDUSTRIAS EXTRACTIVAS (PROSPECCIÓN, PERFORACIÓN, SONDEO, DRENAJE Y BOMBEO DE TERCEROS, VOLADURAS)',
  '10': 'INDUSTRIA DE LA ALIMENTACIÓN',
  '11': 'FABRICACIÓN DE BEBIDAS',
  '12': 'INDUSTRIA DEL TABACO',
  '13': 'IND. TEXTIL, CONFECCION, CUERO Y CALZADO',
  '14': 'IND. DE MADERA Y CORCHO (EXC. FABRICACION DE MUEBLES)',
  '15': 'FABRICACIÓN DE PASTA DE PAPEL',
  '16': 'OTROS PRODUCTOS DE PAPEL Y CARTÓN',
  '17': 'ARTES GRÁFICAS Y REPRODUCCIÓN DE SOPORTES GRABADOS',
  '18': 'COQUERIAS',
  '19': 'REFINERÍAS DE PETROLEO',
  '20': 'INDUSTRIA QUÍMICA (QUÍMICOS BÁSICOS, COMPUESTOS NIGROGENADOS, FERTILIZANTES Y PLÁSTICOS Y CAUCHO SINTÉTICO EN FORMAS PRIMARIAS)',
  '21': 'FABRICACIÓN DE PRODUCTOS FARMACÉUTICOS',
  '22': 'FABRICACIÓN DE PRODUCTOS DE CAUCHO Y PLÁSTICOS',
  '23': 'FABRICACIÓN DE OTROS PRODUCTOS MINERALES NO METÁLICOS (LOZA, PORCELANA, REFRACTARIOS, ETC.) excepto VIDRIO, CEMENTO, CALES Y YESOS',
  '24': 'INDUSTRIA DEL VIDRIO',
  '25': 'FABRICACIÓN DE CEMENTO, CALES Y YESOS',
  '26': 'METALURGIA FÉRREA, FABRICACIÓN DE PRODUCTOS DE HIERRO, ACERO Y FERROALEACIONES (SIDERURGIA) Y FUNDICIÓN DE ACERO Y HIERRO',
  '27': 'PRODUCCIÓN DE ALUMINIO',
  '28': 'OTRAS INDUSTRIAS DE METALES NO FERROSOS',
  '29': 'FABRICACIÓN DE PRODUCTOS METÁLICOS EXCEPTO MAQUINARIA Y EQUIPOS',
  '30': 'FABRICACIÓN DE PRODUCTOS INFORMÁTICOS, ELECTRÓNICOS Y ÓPTICOS',
  '31': 'FABRICACIÓN DE MATERIAL Y EQUIPO ELÉCTRICO',
  '32': 'FABRICACIÓN DE MAQUINARIA Y EQUIPO',
  '33': 'CONSTRUCCION DE VEHÍCULOS A MOTOR. MOTOCICLETAS Y BICICLETAS',
  '34': 'CONSTRUCCION NAVAL',
  '35': 'CONSTRUCCION DE OTROS MEDIOS DE TRANSPORTE',
  '36': 'FABRICACIÓN DE MUEBLES',
  '37': 'OTRAS INDUSTRIAS MANUFACTURERAS',
  '38': 'SECCIÓN C: REPARACIÓN E INSTALACIÓN DE MAQUINARIA Y EQUIPO',
  '39': 'PRODUCCIÓN, TRANSPORTE Y DISTRIBUCION DE ENERGIA ELECTRICA',
  '40': 'PRODUCCIÓN DE GAS; DISTRIBUCIÓN POR TUBERÍA',
  '41': 'SUMINISTRO DE VAPOR Y AIRE ACONDICIONADO',
  '42': 'SECCIÓN E: CAPTACIÓN, DEPURACIÓN Y DISTRIBUCIÓN DE AGUA',
  '43': 'SECCIÓN E: RECOGIDA Y TRATAMIENTO DE AGUAS RESIDUALES',
  '44': 'SECCIÓN E: RECOGIDA, TRATAMIENTO Y ELIMINACIÓN DE RESIDUOS; VALORIZACIÓN',
  '45': 'SECCIÓN E: ACTIVIDADES DE DESCONTAMINACIÓN Y OTROS SERVICIOS DE GESTIÓN DE RESIDUOS',
  '46': 'CONSTRUCCION Y OBRAS PUBLICAS',
  '47': 'SECCIÓN G: VENTA Y REPARACIÓN DE VEHÍCULOS DE MOTOR Y MOTOCICLETAS',
  '48': 'SECCIÓN G: COMERCIO AL POR MAYOR E INTERMEDIARIOS DEL COMERCIO, EXCEPTO DE VEHÍCULOS DE MOTOR Y MOTOCICLETAS',
  '49': 'SECCIÓN G: COMERCIO AL POR MENOR, EXCEPTO DE VEHÍCULOS DE MOTOR Y MOTOCICLETAS',
  '50': 'SECCIÓN G: COMERCIO AL POR MENOR DE COMBUSTIBLE PARA LA AUTOMOCIÓN EN ESTABLECIMIENTOS ESPECIALIZADOS',
  '51': 'TRANSPORTE INTERURBANO POR FF. CC.',
  '52': 'TRANSPORTE INTERURBANO POR CARRETERA (VIAJEROS, MERCANCIAS)',
  '53': 'OTRAS EMPRESAS DE TRANSPORTE',
  '54': 'SECCIÓN H: ALMACENAMIENTO Y ACTIVIDADES ANEXAS AL TRANSPORTE',
  '55': 'SECCIÓN H: ACTIVIDADES POSTALES Y DE CORREOS',
  '56': 'SECCIÓN I: HOSTELERÍA',
  '57': 'SECCIÓN I: SERVICIOS DE COMIDAS Y BEBIDAS',
  '58': 'SECTION J: INFORMACIÓN Y COMUNICACIONES',
  '59': 'SECCIÓN J: PROCESO DE DATOS, HOSTINGS Y ACTIVIDADES RELACIONADAS (DATA CENTRES)',
  '60': 'SECCIÓN K: ACTIVIDADES FINANCIERAS Y DE SEGUROS',
  '61': 'SECCIÓN L: ACTIVIDADES INMOBILIARIAS',
  '62': 'SECCIÓN M: ACTIVIDADES PROFESIONALES, CIENTÍFICAS Y TÉCNICAS EXCEPTO INVESTIGACIÓN Y DESARROLLO',
  '63': 'SECCIÓN M: INVESTIGACIÓN Y DESARROLLO',
  '64': 'SECCIÓN N: ACTIVIDADES ADMINISTRATIVAS Y SERVICIOS AUXILIARES EXCEPTO ACTIVIDADES DE INVESTIGACIÓN',
  '65': 'SECCIÓN N: ACTIVIDADES DE INVESTIGACIÓN',
  '66': 'SECCIÓN O: ADMINISTRACIÓN PÚBLICA Y DEFENSA; SEGURIDAD SOCIAL OBLIGATORIA',
  '67': 'DEFENSA Y CONSUMO MILITAR',
  '68': 'SECCIÓN P: EDUCACIÓN',
  '69': 'SECCIÓN Q: ACTIVIDADES HOSPITALARIAS',
  '70': 'SECCIÓN Q: ACTIVIDADES DE SERVICIOS SOCIALES Y SANITARIAS EXCEPTO ACTIVIDADES HOSPITALARIAS',
  '71': 'SECCIÓN R: ACTIVIDADES ARTÍSTICAS, RECREATIVAS Y DE ENTRETENIMIENTO',
  '72': 'SECCIÓN R: ACTIVIDADES DEPORTIVAS, RECREATIVAS Y DE ENTRETENIMIENTO',
  '73': 'SECCIÓN S: OTROS SERVICIOS',
  '74': 'USOS DOMESTICOS',
  '75': 'SECCIÓN U: ACTIVIDADES DE ORGANIZACIONES Y ORGANISMOS EXTRATERRITORIALES',
  '76': 'OTROS USOS NO ESPECIFICADOS',
};

export function isPhysicalPersonVat(vat?: string | null): boolean {
  if (!vat) return false;
  const clean = vat.trim().toUpperCase().replace(/[\s.-]/g, '');
  // NIF español (8 dígitos + letra) o NIE (X/Y/Z + 7 dígitos + letra)
  return /^[0-9]{8}[A-Z]$/.test(clean) || /^[XYZ][0-9]{7}[A-Z]$/.test(clean);
}

/**
 * Mapea un código CNAE-2009 (2, 3 o 4 dígitos, con o sin punto) al ORDEN oficial de ESCILA (1..76).
 */
export function mapCnaeToEscilaSector(params: {
  cnae?: string | null;
  sipsCnae?: string | null;
  clientCnae?: string | null;
  tariff?: string | null;
  vatNumber?: string | null;
}): { idCnae: string; descCnae: string; isUnmappedFallback: boolean } {
  const pickDigits = (raw?: string | null): string => {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 2 ? digits.slice(0, 4) : '';
  };

  const digits = pickDigits(params.cnae) || pickDigits(params.sipsCnae) || pickDigits(params.clientCnae);
  const d2 = digits.slice(0, 2);
  const d3 = digits.length >= 3 ? digits.slice(0, 3) : '';
  const d4 = digits.length >= 4 ? digits.slice(0, 4) : '';

  const build = (code: string, isUnmappedFallback = false) => ({
    idCnae: code,
    descCnae: ESCILA_SECTORS[code] || ESCILA_SECTORS['76'],
    isUnmappedFallback,
  });

  // CNAE explícito doméstico (97xx, 98xx)
  if (d2 === '97' || d2 === '98') return build('74');

  if (d2) {
    switch (d2) {
      case '01': return build('1');
      case '02': return build('2');
      case '03': return build('3');
      case '05': return build('4');
      case '06': return build('5');
      case '07': return d4 === '0721' ? build('7') : build('6');
      case '08': return d4 === '0892' ? build('4') : build('8');
      case '09': return d3 === '091' ? build('5') : build('9');
      case '10': return build('10');
      case '11': return build('11');
      case '12': return build('12');
      case '13':
      case '14':
      case '15': return build('13');
      case '16': return build('14');
      case '17': return d4 === '1711' ? build('15') : build('16');
      case '18': return build('17');
      case '19': return d3 === '191' ? build('18') : build('19');
      case '20': return build('20');
      case '21': return build('21');
      case '22': return build('22');
      case '23':
        if (d3 === '231') return build('24');
        if (d3 === '235') return build('25');
        return build('23');
      case '24':
        if (d4 === '2442') return build('27');
        if (d3 === '244' || d4 === '2453' || d4 === '2454') return build('28');
        return build('26');
      case '25': return build('29');
      case '26': return build('30');
      case '27': return build('31');
      case '28': return build('32');
      case '29': return build('33');
      case '30':
        if (d3 === '301') return build('34');
        if (d3 === '309') return build('33');
        return build('35');
      case '31': return build('36');
      case '32': return build('37');
      case '33': return build('38');
      case '35':
        if (d3 === '352') return build('40');
        if (d3 === '353') return build('41');
        return build('39');
      case '36': return build('42');
      case '37': return build('43');
      case '38': return build('44');
      case '39': return build('45');
      case '41':
      case '42':
      case '43': return build('46');
      case '45': return build('47');
      case '46': return build('48');
      case '47': return d3 === '473' ? build('50') : build('49');
      case '49':
        if (d3 === '491' || d3 === '492') return build('51');
        if (d4 === '4939' || d3 === '494') return build('52');
        return build('53');
      case '50':
      case '51': return build('53');
      case '52': return build('54');
      case '53': return build('55');
      case '55': return build('56');
      case '56': return build('57');
      case '58':
      case '59':
      case '60':
      case '61':
      case '62': return build('58');
      case '63': return d4 === '6311' ? build('59') : build('58');
      case '64':
      case '65':
      case '66': return build('60');
      case '68': return build('61');
      case '69':
      case '70':
      case '71':
      case '73':
      case '74':
      case '75': return build('62');
      case '72': return build('63');
      case '77':
      case '78':
      case '79':
      case '81':
      case '82': return build('64');
      case '80': return d3 === '803' ? build('65') : build('64');
      case '84': return d4 === '8422' ? build('67') : build('66');
      case '85': return build('68');
      case '86': return d3 === '861' ? build('69') : build('70');
      case '87':
      case '88': return build('70');
      case '90':
      case '91':
      case '92': return build('71');
      case '93': return build('72');
      case '94':
      case '95':
      case '96': return build('73');
      case '99': return build('75');
    }
  }

  // Si no hay CNAE válido pero es suministro 2.0TD de persona física, es Uso Doméstico (74)
  const is20Td = (params.tariff || '').toUpperCase().includes('2.0');
  if (is20Td && isPhysicalPersonVat(params.vatNumber)) {
    return build('74');
  }

  return build('76', true);
}

export function escapeXmlEntities(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convierte un string XML con declaración ISO-8859-1 a bytes reales ISO-8859-1 (latin1),
 * reemplazando cualquier carácter fuera de U+0000..U+00FF por su entidad numérica XML (&#xxxx;)
 * para evitar corrupción binaria de caracteres Unicode extendidos.
 */
export function encodeIso88591Xml(xmlString: string): Uint8Array {
  let safeLatin1 = '';
  for (const ch of xmlString) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0xff) {
      safeLatin1 += ch;
    } else {
      safeLatin1 += `&#${cp};`;
    }
  }
  return new Uint8Array(Buffer.from(safeLatin1, 'latin1'));
}

export interface RegulatorySubmissionRecord {
  id: string;
  companyId: string | null;
  status: string; // 'GENERATED' | 'SUBMITTED'
  createdAt: string;
  updatedAt: string;
  category: 'CNMC' | 'MITECO';
  reportType: string;
  period: string;
  version?: string | null;
  filename: string;
  generatedBy: string;
  summary?: Record<string, any>;
  receiptUrl?: string | null;
  receiptName?: string | null;
  submittedAt?: string | null;
  notes?: string | null;
}

export async function logRegulatoryGeneration(params: {
  companyId: string;
  category: 'CNMC' | 'MITECO';
  reportType: string;
  period: string;
  version?: string | null;
  filename: string;
  generatedBy: string;
  summary?: Record<string, any>;
}): Promise<string | null> {
  try {
    const created = await prisma.syncJob.create({
      data: {
        companyId: params.companyId,
        type: 'REGULATORY_SUBMISSION',
        status: 'GENERATED',
        progress: 100,
        total: 1,
        logs: `${params.category} ${params.reportType} (${params.period}) generado por ${params.generatedBy}`,
        results: {
          category: params.category,
          reportType: params.reportType,
          period: params.period,
          version: params.version || null,
          filename: params.filename,
          generatedBy: params.generatedBy,
          summary: params.summary || {},
          receiptUrl: null,
          receiptName: null,
          submittedAt: null,
          notes: null,
        },
      },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    console.error('Non-fatal error logging regulatory generation:', err);
    return null;
  }
}

export async function listRegulatorySubmissions(
  companyId: string,
  category?: 'CNMC' | 'MITECO',
  limit = 40
): Promise<RegulatorySubmissionRecord[]> {
  const jobs = await prisma.syncJob.findMany({
    where: {
      companyId,
      type: 'REGULATORY_SUBMISSION',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const mapped: RegulatorySubmissionRecord[] = [];
  for (const job of jobs) {
    const r = (job.results || {}) as Record<string, any>;
    const cat = (r.category === 'MITECO' ? 'MITECO' : 'CNMC') as 'CNMC' | 'MITECO';
    if (category && cat !== category) continue;
    mapped.push({
      id: job.id,
      companyId: job.companyId,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      category: cat,
      reportType: String(r.reportType || ''),
      period: String(r.period || ''),
      version: r.version ? String(r.version) : null,
      filename: String(r.filename || ''),
      generatedBy: String(r.generatedBy || ''),
      summary: r.summary || {},
      receiptUrl: r.receiptUrl || null,
      receiptName: r.receiptName || null,
      submittedAt: r.submittedAt || null,
      notes: r.notes || null,
    });
  }
  return mapped;
}
