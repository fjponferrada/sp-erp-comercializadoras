import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';
import { normalizeReganecuConcept } from '@/lib/reganecuShared';
import { isComprasAuthorized, resolveActiveCompanyId } from '@/lib/reganecuServer';
import { runCalculatePendingEnergy } from '@/scripts/calculate_pending_energy';

export const maxDuration = 300;

function parseDecimal(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.trim().replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!isComprasAuthorized(session)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = await resolveActiveCompanyId(session!.user);
    if (!companyId) {
      return NextResponse.json({ error: 'No se encontró comercializadora activa en la sesión' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'El archivo debe tener extensión .zip' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const mainZip = await JSZip.loadAsync(arrayBuffer);

    let processedCount = 0;
    const pendingUpserts: Array<{
      date: Date;
      cierre: string;
      region: string;
      matricial: boolean;
      total: boolean;
      upr: boolean;
      resolution: string;
      jsonData: any;
      fileName: string;
      companyId: string;
    }> = [];

    async function processZip(zip: JSZip) {
      for (const relativePath of Object.keys(zip.files)) {
        const zipEntry = zip.files[relativePath];
        if (zipEntry.dir) continue;
        if (relativePath.includes('__MACOSX')) continue;

        const lowerPath = relativePath.toLowerCase();
        const baseName = relativePath.replace(/\\/g, '/').split('/').pop() || relativePath;
        const lowerBase = baseName.toLowerCase();
        if (lowerBase.startsWith('._')) continue;

        if (lowerPath.endsWith('.zip')) {
          const nestedBuffer = await zipEntry.async('arraybuffer');
          const nestedZip = await JSZip.loadAsync(nestedBuffer);
          await processZip(nestedZip);
        } else if (lowerBase.includes('_reganecu_') || lowerBase.includes('_reganecuqh_')) {
          const content = await zipEntry.async('text');
          collectReganecuUpserts(content, baseName);
          processedCount++;
        }
      }
    }

    function collectReganecuUpserts(content: string, baseFileName: string) {
      // baseFileName ej: C2_reganecu_20260301_18X000000000O0IA o C2_reganecuQH_20260301_...
      const cleanBase = baseFileName.replace(/\.[^.]+$/, '');
      const nameParts = cleanBase.split('_');
      if (nameParts.length < 3) return;

      const cierre = nameParts[0].trim().toUpperCase();
      const typeStr = nameParts[1].trim();
      const dateStr = nameParts[2].trim();
      if (!/^[AC]\d+$/i.test(cierre) || !/^\d{8}$/.test(dateStr)) return;

      const resolution = typeStr.toUpperCase().includes('QH') ? 'QH' : 'H';

      const year = parseInt(dateStr.substring(0, 4), 10);
      const month = parseInt(dateStr.substring(4, 6), 10) - 1;
      const day = parseInt(dateStr.substring(6, 8), 10);
      const date = new Date(Date.UTC(year, month, day));

      const lines = content.split(/\r?\n/);

      const recordsMap: Record<string, { total: boolean; matricial: boolean; upr: boolean; jsonData: any }> = {
        TOTAL: { total: true, matricial: false, upr: false, jsonData: {} },
        MATRICIAL: { total: false, matricial: true, upr: false, jsonData: [] },
      };

      for (const line of lines) {
        const parts = line.split(';');
        if (parts.length < 13) continue;

        const unit = parts[2].trim();
        const energy = Math.abs(parseDecimal(parts[3]));
        const cost = Math.abs(parseDecimal(parts[7]));
        const rawConcept = parts[10].trim();

        // Regla 138: soportar nombres descriptivos hasta 80 caracteres y normalizar acrónimo
        if (!rawConcept || rawConcept.length > 80) continue;
        const concept = normalizeReganecuConcept(rawConcept);
        if (!concept) continue;

        const upr = parts[12] ? parts[12].trim() : '';

        const signCostRaw = parseDecimal(parts[14]);
        const signCost = signCostRaw === 0 ? 1 : signCostRaw;
        const signEnergyRaw = parseDecimal(parts[15]);
        const signEnergy = signEnergyRaw === 0 ? signCost : signEnergyRaw;

        const target = recordsMap.TOTAL.jsonData;
        if (!target[concept]) {
          target[concept] = {
            energyVentas: 0,
            energyCompras: 0,
            costDerechos: 0,
            costObligaciones: 0,
            count: 0,
          };
        }
        const stats = target[concept];

        if (signEnergy === 1) {
          stats.energyVentas += energy;
        } else {
          stats.energyCompras += energy;
        }

        if (signCost === 1) {
          stats.costDerechos += cost;
        } else {
          stats.costObligaciones += cost;
        }
        stats.count += 1;

        if (unit) {
          // Regla 140: Deducir periodo exacto (1-96 en QH o 1-24 en H) desde columna 0 si columna 1 viene vacía
          let parsedPeriod = parseInt(parts[1], 10);
          if (isNaN(parsedPeriod)) {
            const timeMatch = parts[0].match(/\s+(\d{2}):(\d{2}):\d{2}/);
            if (timeMatch) {
              const h = parseInt(timeMatch[1], 10);
              const m = parseInt(timeMatch[2], 10);
              parsedPeriod = resolution === 'QH' ? h * 4 + Math.floor(m / 15) + 1 : h + 1;
            } else {
              parsedPeriod = 0;
            }
          }

          recordsMap.MATRICIAL.jsonData.push({
            period: parsedPeriod || 0,
            unit,
            upr,
            concept,
            energyVentas: signEnergy === 1 ? energy : 0,
            energyCompras: signEnergy !== 1 ? energy : 0,
            costDerechos: signCost === 1 ? cost : 0,
            costObligaciones: signCost !== 1 ? cost : 0,
          });
        }
      }

      for (const key of Object.keys(recordsMap)) {
        const rec = recordsMap[key];
        const isEmpty = Array.isArray(rec.jsonData)
          ? rec.jsonData.length === 0
          : Object.keys(rec.jsonData).length === 0;
        if (isEmpty) continue;

        pendingUpserts.push({
          date,
          cierre,
          region: 'peninsula',
          matricial: rec.matricial,
          total: rec.total,
          upr: rec.upr,
          resolution,
          jsonData: rec.jsonData,
          fileName: baseFileName,
          companyId: companyId!,
        });
      }
    }

    await processZip(mainZip);

    if (processedCount === 0) {
      return NextResponse.json(
        { error: 'No se encontraron ficheros REGANECU válidos dentro del ZIP.' },
        { status: 400 }
      );
    }

    const CHUNK_SIZE = 20;
    for (let i = 0; i < pendingUpserts.length; i += CHUNK_SIZE) {
      const chunk = pendingUpserts.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(item =>
          prisma.reganecuData.upsert({
            where: {
              date_cierre_region_matricial_total_upr_resolution_companyId: {
                date: item.date,
                cierre: item.cierre,
                region: item.region,
                matricial: item.matricial,
                total: item.total,
                upr: item.upr,
                resolution: item.resolution,
                companyId: item.companyId,
              },
            },
            update: {
              jsonData: item.jsonData,
              fileName: item.fileName,
              updatedAt: new Date(),
            },
            create: item,
          })
        )
      );
    }

    const affectedMonths = Array.from(
      new Set(pendingUpserts.map(item => item.date.toISOString().slice(0, 7)))
    ).sort();

    if (affectedMonths.length > 0) {
      try {
        await runCalculatePendingEnergy(undefined, companyId, { targetMonths: affectedMonths });
      } catch (syncErr) {
        console.error('Aviso: error recalculando energía pendiente tras importar REGANECU:', syncErr);
      }
    }

    revalidatePath('/compras/importar-reganecu');
    revalidatePath('/compras/reganecu');
    revalidatePath('/gestion/energia-pendiente');

    return NextResponse.json({
      message: `Importación exitosa. Se procesaron ${processedCount} archivos REGANECU (Horarios/Cuartohorarios).`,
    });
  } catch (error: any) {
    console.error('Error in reganecu import:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor al procesar el archivo.' },
      { status: 500 }
    );
  }
}
