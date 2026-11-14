import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { normalizeReganecuConcept } from './reganecuShared';

export const ALLOWED_COMPRAS_ROLES = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'];

export function isComprasAuthorized(session: any): boolean {
  return Boolean(session?.user && ALLOWED_COMPRAS_ROLES.includes(session.user.role));
}

/**
 * Resuelve el companyId activo respetando el selector multi-marca (cookie 'active-brand')
 * y haciendo fallback al companyId de la sesión del usuario.
 */
export async function resolveActiveCompanyId(sessionUser: any): Promise<string | null> {
  if (!sessionUser) return null;

  try {
    const cookieStore = await cookies();
    const cookieBrandId = cookieStore.get('active-brand')?.value;

    if (cookieBrandId && cookieBrandId !== sessionUser.brandId) {
      const allowedBrands: any[] = sessionUser.allowedBrands || [];
      const canAccessBrand =
        sessionUser.role === 'SUPERADMIN' ||
        allowedBrands.some((b: any) => b.id === cookieBrandId);

      if (canAccessBrand) {
        const brand = await prisma.brand.findUnique({
          where: { id: cookieBrandId },
          select: { companyId: true },
        });
        if (brand?.companyId) {
          return brand.companyId;
        }
      }
    }
  } catch {
    // Fallback a sessionUser.companyId si cookies() no está disponible en algún contexto
  }

  return sessionUser.companyId || null;
}

function normalizeTotalJsonData(rawJson: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) return result;

  for (const rawKey of Object.keys(rawJson)) {
    const concept = normalizeReganecuConcept(rawKey);
    if (!concept) continue;
    const vals = rawJson[rawKey] || {};

    if (!result[concept]) {
      result[concept] = {
        energyVentas: 0,
        energyCompras: 0,
        costDerechos: 0,
        costObligaciones: 0,
        count: 0,
      };
    }

    if (vals.energyVentas !== undefined || vals.costDerechos !== undefined) {
      result[concept].energyVentas += vals.energyVentas || 0;
      result[concept].energyCompras += vals.energyCompras || 0;
      result[concept].costDerechos += vals.costDerechos || 0;
      result[concept].costObligaciones += vals.costObligaciones || 0;
    } else {
      result[concept].energyVentas += vals.energySum || 0;
      result[concept].costDerechos += vals.costSum || 0;
    }
    result[concept].count += vals.count || 0;
  }

  return result;
}

function normalizeMatricialJsonData(rawJson: any): any[] {
  if (!Array.isArray(rawJson)) return [];
  return rawJson.map(row => ({
    ...row,
    concept: normalizeReganecuConcept(row.concept || ''),
  }));
}

/**
 * Regla 137: Fusión inteligente de ficheros H y QH por día y a nivel de concepto.
 * - Prioriza todos los conceptos presentes en el fichero cuartohorario (QH).
 * - Rescata e incorpora los conceptos exclusivos del fichero horario (H), como CAD y PC3,
 *   sin duplicar conceptos comunes (ej. CBM).
 * Funciona de manera idéntica tanto para TOTAL como para MATRICIAL.
 */
export function mergeDailyReganecuRecords(rawRecords: any[], matricial: boolean): any[] {
  const groupedByDate = new Map<string, any[]>();
  for (const rec of rawRecords) {
    const d = rec.date.toISOString().split('T')[0];
    if (!groupedByDate.has(d)) groupedByDate.set(d, []);
    groupedByDate.get(d)!.push(rec);
  }

  const sortedDates = Array.from(groupedByDate.keys()).sort();

  return sortedDates.map(dateKey => {
    const recs = groupedByDate.get(dateKey)!;
    const hRec = recs.find(r => r.resolution === 'H' && !r.upr) || recs.find(r => r.resolution === 'H');
    const qhRec = recs.find(r => r.resolution === 'QH' && !r.upr) || recs.find(r => r.resolution === 'QH');

    if (!matricial) {
      if (qhRec && hRec) {
        const hData = normalizeTotalJsonData(hRec.jsonData);
        const qhData = normalizeTotalJsonData(qhRec.jsonData);
        return {
          ...qhRec,
          jsonData: {
            ...hData,
            ...qhData, // QH prevalece en conceptos comunes; H aporta conceptos exclusivos (CAD, PC3)
          },
        };
      }
      const chosen = (qhRec || hRec)!;
      return {
        ...chosen,
        jsonData: normalizeTotalJsonData(chosen.jsonData),
      };
    } else {
      if (qhRec && hRec) {
        const qhRows = normalizeMatricialJsonData(qhRec.jsonData);
        const hRows = normalizeMatricialJsonData(hRec.jsonData);
        const qhConcepts = new Set(qhRows.map(r => r.concept));
        const exclusiveHRows = hRows.filter(r => !qhConcepts.has(r.concept));
        return {
          ...qhRec,
          jsonData: [...qhRows, ...exclusiveHRows],
        };
      }
      const chosen = (qhRec || hRec)!;
      return {
        ...chosen,
        jsonData: normalizeMatricialJsonData(chosen.jsonData),
      };
    }
  });
}
