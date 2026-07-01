import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const mainZip = await JSZip.loadAsync(arrayBuffer);

    let processedCount = 0;

    async function processZip(zip: JSZip) {
      for (const relativePath of Object.keys(zip.files)) {
        const zipEntry = zip.files[relativePath];
        if (zipEntry.dir) continue;

        if (relativePath.endsWith('.zip')) {
          const nestedBuffer = await zipEntry.async('arraybuffer');
          const nestedZip = await JSZip.loadAsync(nestedBuffer);
          await processZip(nestedZip);
        } else if (relativePath.includes('_reganecu_') || relativePath.includes('_reganecuQH_')) {
          // Process reganecu (H) and reganecuQH (QH)
          const content = await zipEntry.async('text');
          await processReganecuData(content, relativePath);
          processedCount++;
        }
      }
    }

    async function processReganecuData(content: string, fileName: string) {
      // fileName is like C2_reganecu_20260301_18X000000000O0IA or C2_reganecuQH_...
      const nameParts = fileName.split('_');
      if (nameParts.length < 3) return;
      
      const cierre = nameParts[0]; // C2
      const typeStr = nameParts[1]; // reganecu or reganecuQH
      const dateStr = nameParts[2]; // 20260301
      if (dateStr.length !== 8) return;

      const resolution = typeStr.includes('QH') ? 'QH' : 'H';
      
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const date = new Date(Date.UTC(year, month, day));

      const lines = content.split('\n');
      
      // Structure to aggregate data:
      // We need to group by Total (aggregated) and Matricial (raw QH records)
      const recordsMap: Record<string, any> = {
        'TOTAL': { total: true, matricial: false, upr: false, jsonData: {} },
        'MATRICIAL': { total: false, matricial: true, upr: false, jsonData: [] }
      };

      for (const line of lines) {
        const parts = line.split(';');
        if (parts.length < 13) continue;
        
        let unit = parts[2].trim();
        let energy = Math.abs(parseFloat(parts[3]) || 0); // Keep positive for separating
        let price = parseFloat(parts[5]) || 0;
        let cost = Math.abs(parseFloat(parts[7]) || 0); // Keep positive
        let concept = parts[10].trim();
        let upr = parts[12] ? parts[12].trim() : '';
        let sign = parseFloat(parts[14]) || 1;

        // sometimes the file starts with header lines, check if it's data
        if (!concept || concept === '' || concept.length > 80) continue;

        let signCost = parseFloat(parts[14]) || 1;
        let signEnergy = parseFloat(parts[15]);
        if (isNaN(signEnergy) || signEnergy === 0) {
          signEnergy = signCost;
        }

        // Add to TOTAL (aggregated)
        let target = recordsMap['TOTAL'].jsonData;
        if (!target[concept]) {
          target[concept] = { 
            energyVentas: 0, energyCompras: 0, 
            costDerechos: 0, costObligaciones: 0, 
            count: 0 
          };
        }
        let stats = target[concept];

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

        // Add to MATRICIAL (raw records)
        if (unit) {
          recordsMap['MATRICIAL'].jsonData.push({
            period: parseInt(parts[1]) || 0,
            unit: unit,
            upr: upr,
            concept: concept,
            energyVentas: signEnergy === 1 ? energy : 0,
            energyCompras: signEnergy !== 1 ? energy : 0,
            costDerechos: signCost === 1 ? cost : 0,
            costObligaciones: signCost !== 1 ? cost : 0,
          });
        }
      }

      // Upsert into database
      for (const key of Object.keys(recordsMap)) {
        const rec = recordsMap[key];
        
        // Only save if there's actual data
        if (Array.isArray(rec.jsonData)) {
          if (rec.jsonData.length === 0) continue;
        } else {
          if (Object.keys(rec.jsonData).length === 0) continue;
        }

        await prisma.reganecuData.upsert({
          where: {
            date_cierre_region_matricial_total_upr_resolution: {
              date: date,
              cierre: cierre,
              region: 'peninsula', 
              matricial: rec.matricial,
              total: rec.total,
              upr: rec.upr,
              resolution: resolution
            }
          },
          update: {
            jsonData: rec.jsonData,
            fileName: fileName,
            updatedAt: new Date()
          },
          create: {
            date: date,
            cierre: cierre,
            region: 'peninsula',
            matricial: rec.matricial,
            total: rec.total,
            upr: rec.upr,
            resolution: resolution,
            jsonData: rec.jsonData,
            fileName: fileName
          }
        });
      }
    }

    await processZip(mainZip);

    return NextResponse.json({ message: `Importación exitosa. Se procesaron ${processedCount} archivos reganecu (Horarios/Cuartohorarios).` });
  } catch (error: any) {
    console.error('Error in reganecu import:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor al procesar el archivo.' }, { status: 500 });
  }
}
