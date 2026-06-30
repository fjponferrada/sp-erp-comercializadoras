import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Client } from 'basic-ftp';
import { processCchCsv } from '@/lib/services/cchParser';
import JSZip from 'jszip';
import SftpClient from 'ssh2-sftp-client';

function shouldSkipDirectory(dirName: string, modifyTime: Date | null, lastSync: Date): boolean {
  // NOTA: No usamos la fecha de modificación (modifyTime) de las carpetas para podar.
  // En muchos servidores FTP/Linux, añadir un fichero en una subcarpeta NO actualiza
  // la fecha de modificación de la carpeta padre. Si usáramos modifyTime, podríamos
  // saltarnos carpetas raíz enteras (ej. /0021-1713) solo porque fueron creadas en 2022.
  // Por tanto, la poda se hace ÚNICAMENTE por reglas heurísticas de nombre (YYYY o YYYYMM).

  // Poda heurística por nombre de carpeta (YYYY o YYYYMM)
  const lastSyncYear = lastSync.getFullYear();
  const lastSyncMonth = lastSync.getMonth() + 1; // 1-12

  // Carpeta tipo "2023"
  if (/^\d{4}$/.test(dirName)) {
    const year = parseInt(dirName, 10);
    if (year < lastSyncYear) return true;
  }

  // Carpeta tipo "202301"
  if (/^\d{6}$/.test(dirName)) {
    const year = parseInt(dirName.substring(0, 4), 10);
    const month = parseInt(dirName.substring(4, 6), 10);
    if (year < lastSyncYear) return true;
    if (year === lastSyncYear && month < lastSyncMonth) return true;
  }

  return false;
}

async function listSftpRecursive(sftpClient: SftpClient, currentPath: string, onProgress?: (path: string) => void, lastSync?: Date): Promise<any[]> {
  const files: any[] = [];
  try {
    if (onProgress) onProgress(currentPath);
    const list = await sftpClient.list(currentPath);
    for (const item of list) {
      if (item.name === '.' || item.name === '..') continue;
      const fullPath = currentPath.endsWith('/') ? `${currentPath}${item.name}` : `${currentPath}/${item.name}`;
      if (item.type === 'd') {
        if (lastSync) {
          const modTime = new Date(item.modifyTime);
          if (shouldSkipDirectory(item.name, isNaN(modTime.getTime()) ? null : modTime, lastSync)) {
            continue;
          }
        }
        const subFiles = await listSftpRecursive(sftpClient, fullPath, onProgress, lastSync);
        files.push(...subFiles);
      } else {
        files.push({
          isDirectory: false,
          name: item.name,
          fullPath: fullPath,
          modifiedAt: new Date(item.modifyTime)
        });
      }
    }
  } catch (error) {
    console.error(`Error listing SFTP path ${currentPath}:`, error);
  }
  return files;
}

async function listFtpRecursive(ftpClient: Client, currentPath: string, onProgress?: (path: string) => void, lastSync?: Date): Promise<any[]> {
  const files: any[] = [];
  try {
    if (onProgress) onProgress(currentPath);
    await ftpClient.cd(currentPath);
    const list = await ftpClient.list();
    for (const item of list) {
      if (item.name === '.' || item.name === '..') continue;
      const fullPath = currentPath.endsWith('/') ? `${currentPath}${item.name}` : `${currentPath}/${item.name}`;
      if (item.isDirectory) {
        if (lastSync) {
          const modTime = item.modifiedAt ? new Date(item.modifiedAt) : null;
          if (shouldSkipDirectory(item.name, modTime && !isNaN(modTime.getTime()) ? modTime : null, lastSync)) {
            continue;
          }
        }
        const subFiles = await listFtpRecursive(ftpClient, fullPath, onProgress, lastSync);
        files.push(...subFiles);
        await ftpClient.cd(currentPath); // volver al padre
      } else {
        files.push({
          isDirectory: false,
          name: item.name,
          fullPath: fullPath,
          modifiedAt: item.modifiedAt
        });
      }
    }
  } catch (error) {
    console.error(`Error listing FTP path ${currentPath}:`, error);
  }
  return files;
}
export const maxDuration = 300; // Allow Vercel / Next up to 5 minutes to run this script

export async function executeFtpSync(configs: any[], jobId?: string) {
  const startTime = Date.now();
  const MAX_EXECUTION_TIME_MS = 8000; // Vercel Hobby límite seguro de 8 segundos

  let results: any = {};
  const PRIORIDAD_MAP = ['F1', 'C1', 'Q1', 'F1H', 'F1QH', 'F5D', 'A5D', 'B5D', 'P5D', 'P1', 'P1D', 'P2', 'P2D', 'P0'];
  let hasMore = false;

  try {
    if (jobId) {
      const existingJob = await prisma.syncJob.findUnique({ where: { id: jobId } });
      if (existingJob?.results) {
        results = typeof existingJob.results === 'string' ? JSON.parse(existingJob.results) : existingJob.results;
      }
      
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', logs: 'Iniciando proceso de sincronización...\n' }
      });
    }

    for (const config of configs) {
      if (results[config.name]?.status === 'COMPLETED' || results[config.name]?.status === 'ERROR') {
        continue;
      }

      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        hasMore = true;
        break;
      }

      const port = config.ftpPort || 21;
      const isSftp = [22, 11022, 6222].includes(port);
      
      let ftpClient: Client | null = null;
      let sftpClient: SftpClient | null = null;
      
      if (!results[config.name]) {
        results[config.name] = { processed: 0, newFiles: 0, success: 0, skipped: 0, errors: 0, status: 'OK' };
      }

      if (jobId) {
        await prisma.syncJob.update({
          where: { id: jobId },
          data: { logs: `Conectando al FTP de ${config.name}...\n` }
        });
      }

    try {
      let fileList: any[] = [];
      
      const updateProgress = (path: string) => {
        if (jobId) {
          prisma.syncJob.update({
            where: { id: jobId },
            data: { logs: `Conectado a ${config.name}. \nExplorando directorios buscando ficheros recientes...\nDirectorio actual: ${path}` }
          }).catch(() => {});
        }
      };

      const lastSync = config.ftpLastSyncAt || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      if (isSftp) {
        sftpClient = new SftpClient();
        await sftpClient.connect({
          host: config.ftpHost || '',
          port: port,
          username: config.ftpUser || '',
          password: config.ftpPassword || '',
          readyTimeout: 5000
        });
        
        fileList = await listSftpRecursive(sftpClient, config.ftpTargetPath || '/', updateProgress, lastSync);
      } else {
        ftpClient = new Client(5000);
        await ftpClient.access({
          host: config.ftpHost || '',
          port: port,
          user: config.ftpUser || '',
          password: config.ftpPassword || '',
          secure: port === 21 ? false : 'implicit',
          secureOptions: { rejectUnauthorized: false }
        });
        fileList = await listFtpRecursive(ftpClient, config.ftpTargetPath || '/', updateProgress, lastSync);
      }
      
      let newestDate = lastSync;

      const filesToProcess = fileList.filter(file => {
        if (file.isDirectory) return false;
        
        const fileDate = file.modifiedAt ? new Date(file.modifiedAt) : new Date();
        // Usamos < en lugar de <= para que si hay ficheros en el mismo milisegundo no nos los saltemos
        // El parser de CSV es idempotente así que procesarlos de nuevo es seguro.
        if (fileDate < lastSync) return false;

        const filenameUpper = file.name.toUpperCase();
        return PRIORIDAD_MAP.some(pat => filenameUpper.includes(pat)) || filenameUpper.endsWith('.ZIP');
      }).sort((a, b) => {
        const timeA = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
        const timeB = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
        return timeA - timeB;
      });

      // Guardar el total inicial si es el primer chunk de esta config para que el progreso visual sea correcto
      if (!results[config.name].totalFiles) {
        results[config.name].totalFiles = filesToProcess.length;
      }

      results[config.name].newFiles = filesToProcess.length;

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        let buffer: Buffer;

        if (isSftp && sftpClient) {
          buffer = (await sftpClient.get(file.fullPath)) as Buffer;
        } else if (ftpClient) {
          const stream = require('stream').PassThrough();
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          await ftpClient.downloadTo(stream, file.fullPath);
          buffer = Buffer.concat(chunks);
        } else {
          continue;
        }

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
        const totalFiles = results[config.name].totalFiles || filesToProcess.length || 1;
        const pct = Math.floor((results[config.name].processed / totalFiles) * 100);
        
        const fileDate = file.modifiedAt ? new Date(file.modifiedAt) : new Date();
        if (fileDate > newestDate) {
          newestDate = fileDate;
        }

        if (jobId) {
          await prisma.syncJob.update({
            where: { id: jobId },
            data: { 
              progress: pct,
              logs: `Procesando ${config.name}... (${results[config.name].processed}/${totalFiles})` 
            }
          });
        }

        // CHUNKING: Cortar ejecución si nos acercamos a los 8 segundos
        if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
          hasMore = true;
          break; // Rompe el bucle de ficheros
        }
      }

      // Guardamos el progreso de tiempo para no repetir lo procesado
      await prisma.distributor.update({
        where: { id: config.id },
        data: { ftpLastSyncAt: newestDate }
      });

      if (hasMore) {
        break; // Rompe el bucle de configuraciones (distribuidoras) si se acabó el tiempo
      }
      
      results[config.name].status = 'COMPLETED';

    } catch (err: any) {
      console.error(`FTP Sync Error for ${config.name}:`, err);
      results[config.name].status = 'ERROR';
      results[config.name].errorMsg = err.message;
      if (jobId) {
        await prisma.syncJob.update({
          where: { id: jobId },
          data: { logs: `Error en ${config.name}: ${err.message}\n` }
        });
      }
    } finally {
      if (sftpClient) await sftpClient.end();
      if (ftpClient && !ftpClient.closed) ftpClient.close();
    }
  }

  if (jobId) {
    if (!hasMore) {
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', results: results, progress: 100 }
      });
    } else {
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { results: results }
      });
    }
  }

  return { results, hasMore };
} catch (globalErr: any) {
  if (jobId) {
    await prisma.syncJob.update({
      where: { id: jobId },
      data: { status: 'ERROR', logs: `Error fatal: ${globalErr.message}` }
    });
  }
  throw globalErr;
}
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const jobId = url.searchParams.get('jobId');
  
  const expectedSecret = process.env.CRON_SECRET || 'fallback_secret';
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron secret' }, { status: 401 });
  }

  const configs = await prisma.distributor.findMany({
    where: { ftpActive: true }
  });

  if (configs.length === 0) {
    return NextResponse.json({ message: 'No hay configuraciones FTP activas.' });
  }

  if (jobId) {
    // Modo asíncrono
    // Lanzamos la promesa y no la esperamos (el cliente la llamará en bucle)
    executeFtpSync(configs, jobId).catch(console.error);
    return NextResponse.json({ message: 'Sincronización FTP iniciada en segundo plano', jobId, hasMore: true });
  } else {
    // Modo síncrono (legacy / vercel cron)
    const { results, hasMore } = await executeFtpSync(configs);
    return NextResponse.json({ message: 'Sincronización FTP chunk completado', results, hasMore });
  }
}

