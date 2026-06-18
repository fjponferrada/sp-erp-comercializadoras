import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Client } from 'basic-ftp';
import { processCchCsv } from '@/lib/services/cchParser';
import JSZip from 'jszip';

export const maxDuration = 300; // Allow Vercel / Next up to 5 minutes to run this script

export async function GET(req: Request) {
  // Protección del endpoint
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron secret' }, { status: 401 });
  }

  const configs = await prisma.distributor.findMany({
    where: { ftpActive: true }
  });

  if (configs.length === 0) {
    return NextResponse.json({ message: 'No hay configuraciones FTP activas.' });
  }

  const results: any = {};
  const PRIORIDAD_MAP = ['F1', 'C1', 'Q1', 'F1H', 'F1QH', 'F5D', 'A5D', 'B5D', 'P5D', 'P1', 'P1D', 'P2', 'P2D', 'P0'];

  for (const config of configs) {
    const client = new Client();
    
    results[config.name] = { processed: 0, newFiles: 0, success: 0, skipped: 0, errors: 0, status: 'OK' };

    try {
      await client.access({
        host: config.ftpHost || '',
        port: config.ftpPort || 21,
        user: config.ftpUser || '',
        password: config.ftpPassword || '',
        secure: config.ftpPort === 21 ? false : 'implicit', // Soporte básico para FTPS
        secureOptions: { rejectUnauthorized: false }
      });

      await client.cd(config.ftpTargetPath || '');
      const fileList = await client.list();
      
      const lastSync = config.ftpLastSyncAt || new Date(0);
      let newestDate = lastSync;

      const filesToProcess = fileList.filter(file => {
        if (file.isDirectory) return false;
        
        const fileDate = file.modifiedAt ? new Date(file.modifiedAt) : new Date();
        if (fileDate <= lastSync) return false;

        const filenameUpper = file.name.toUpperCase();
        return PRIORIDAD_MAP.some(pat => filenameUpper.includes(pat)) || filenameUpper.endsWith('.ZIP');
      });

      results[config.name].newFiles = filesToProcess.length;

      for (const file of filesToProcess) {
        const stream = require('stream').PassThrough();
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        
        await client.downloadTo(stream, file.name);
        
        const buffer = Buffer.concat(chunks);

        if (file.name.toLowerCase().endsWith('.zip')) {
          const zip = await JSZip.loadAsync(buffer);
          for (const filename of Object.keys(zip.files)) {
            if (!zip.files[filename].dir) {
              const innerUpper = filename.toUpperCase();
              if (PRIORIDAD_MAP.some(pat => innerUpper.includes(pat))) {
                const content = await zip.files[filename].async('string');
                const fileResult = await processCchCsv(content, filename, `FTP_${config.name}`);
                results[config.name].success += fileResult.success;
                results[config.name].skipped += fileResult.skipped;
                results[config.name].errors += fileResult.errors;
              }
            }
          }
        } else {
          const decoder = new TextDecoder('utf-8'); // Asumimos utf-8
          const content = decoder.decode(buffer);
          const fileResult = await processCchCsv(content, file.name, `FTP_${config.name}`);
          results[config.name].success += fileResult.success;
          results[config.name].skipped += fileResult.skipped;
          results[config.name].errors += fileResult.errors;
        }

        results[config.name].processed++;

        const fileDate = file.modifiedAt ? new Date(file.modifiedAt) : new Date();
        if (fileDate > newestDate) {
          newestDate = fileDate;
        }
      }

      if (filesToProcess.length > 0) {
        await prisma.distributor.update({
          where: { id: config.id },
          data: { ftpLastSyncAt: newestDate }
        });
      }

    } catch (err: any) {
      console.error(`FTP Sync Error for ${config.name}:`, err);
      results[config.name].status = 'ERROR';
      results[config.name].errorMsg = err.message;
    } finally {
      client.close();
    }
  }

  return NextResponse.json({ message: 'Sincronización FTP completada', results });
}
