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
      // We need to group by Matricial(unit), UPR, and Total
      // key: 'TOTAL', 'MATRICIAL', 'UPR'
      const recordsMap: Record<string, any> = {
        'TOTAL': { total: true, matricial: false, upr: false, jsonData: {} },
        'MATRICIAL': { total: false, matricial: true, upr: false, jsonData: {} },
        'UPR': { total: false, matricial: true, upr: true, jsonData: {} }
      };

      for (const line of lines) {
        const parts = line.split(';');
        if (parts.length < 13) continue;
        
        let unit = parts[2].trim();
        let energy = parseFloat(parts[3]) || 0;
        let price = parseFloat(parts[5]) || 0;
        let cost = parseFloat(parts[7]) || 0;
        let concept = parts[10].trim();
        let upr = parts[12] ? parts[12].trim() : '';

        // sometimes the file starts with header lines, check if it's data
        if (!concept || concept === '' || concept.length > 20) continue;

        // helper to add to jsonData
        const addData = (group: string) => {
          if (!recordsMap[group].jsonData[concept]) {
            recordsMap[group].jsonData[concept] = { energySum: 0, costSum: 0, count: 0 };
          }
          recordsMap[group].jsonData[concept].energySum += energy;
          recordsMap[group].jsonData[concept].costSum += cost;
          recordsMap[group].jsonData[concept].count += 1;
        };

        // Add to TOTAL
        addData('TOTAL');
        
        // Add to MATRICIAL (Unit level)
        if (unit) {
          addData('MATRICIAL');
        }
        
        // Add to UPR (UPR level)
        if (upr) {
          addData('UPR');
        }
      }

      // Upsert into database
      for (const key of Object.keys(recordsMap)) {
        const rec = recordsMap[key];
        
        // Only save if there's actual data
        if (Object.keys(rec.jsonData).length === 0) continue;

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
