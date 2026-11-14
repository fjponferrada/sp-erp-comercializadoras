import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Client } from 'basic-ftp';
import { isRecognizedCchFilename, processCchBuffer } from '@/lib/services/cchParser';
import { AggregationService } from '@/lib/services/AggregationService';
import { runCalculatePendingEnergy } from '@/scripts/calculate_pending_energy';
import SftpClient from 'ssh2-sftp-client';
import { PassThrough } from 'stream';

export const maxDuration = 300; // Allow Vercel / Next up to 5 minutes per invocation

export interface FtpConfigItem {
  configId: string;
  companyId: string;
  companyLabel?: string;
  distributorId: string;
  name: string;            // Display key in job results
  distributorName: string; // Canonical distributor name for LoadCurve.source
  ftpHost: string | null;
  ftpPort: number | null;
  ftpUser: string | null;
  ftpPassword: string | null;
  ftpTargetPath: string | null;
  ftpLastSyncAt: Date | null;
}

function shouldSkipDirectory(dirName: string, _modifyTime: Date | null, lastSync: Date): boolean {
  // Poda heurística únicamente por nombre de carpeta (YYYY o YYYYMM).
  // No se usa modifyTime del directorio padre porque añadir ficheros en subcarpetas no siempre lo actualiza.
  const lastSyncYear = lastSync.getUTCFullYear();
  const lastSyncMonth = lastSync.getUTCMonth() + 1; // 1-12

  if (/^\d{4}$/.test(dirName)) {
    const year = parseInt(dirName, 10);
    if (year < lastSyncYear) return true;
  }

  if (/^\d{6}$/.test(dirName)) {
    const year = parseInt(dirName.substring(0, 4), 10);
    const month = parseInt(dirName.substring(4, 6), 10);
    if (year < lastSyncYear) return true;
    if (year === lastSyncYear && month < lastSyncMonth) return true;
  }

  return false;
}

async function listSftpRecursive(
  sftpClient: SftpClient,
  currentPath: string,
  onProgress?: (path: string) => void,
  lastSync?: Date
): Promise<any[]> {
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
          fullPath,
          modifiedAt: new Date(item.modifyTime),
        });
      }
    }
  } catch (error) {
    console.error(`Error listing SFTP path ${currentPath}:`, error);
  }
  return files;
}

async function listFtpRecursive(
  ftpClient: Client,
  currentPath: string,
  onProgress?: (path: string) => void,
  lastSync?: Date
): Promise<any[]> {
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
        await ftpClient.cd(currentPath);
      } else {
        files.push({
          isDirectory: false,
          name: item.name,
          fullPath,
          modifiedAt: item.modifiedAt,
        });
      }
    }
  } catch (error) {
    console.error(`Error listing FTP path ${currentPath}:`, error);
  }
  return files;
}

function isSftpPort(port: number): boolean {
  return [22, 2222, 6222, 11022].includes(port);
}

export async function loadActiveFtpConfigs(companyId?: string): Promise<FtpConfigItem[]> {
  const rows = await prisma.distributorCompanyConfig.findMany({
    where: {
      ftpActive: true,
      ...(companyId ? { companyId } : {}),
    },
    include: {
      distributor: { select: { id: true, name: true } },
      company: { select: { id: true, name: true, codigo: true } },
    },
    orderBy: [
      { companyId: 'asc' },
      { distributor: { name: 'asc' } },
    ],
  });

  const multiCompany = !companyId && new Set(rows.map(r => r.companyId)).size > 1;

  return rows.map(r => {
    const companyTag = r.company.codigo || r.company.name;
    return {
      configId: r.id,
      companyId: r.companyId,
      companyLabel: companyTag,
      distributorId: r.distributorId,
      name: multiCompany ? `[${companyTag}] ${r.distributor.name}` : r.distributor.name,
      distributorName: r.distributor.name,
      ftpHost: r.ftpHost,
      ftpPort: r.ftpPort,
      ftpUser: r.ftpUser,
      ftpPassword: r.ftpPassword,
      ftpTargetPath: r.ftpTargetPath,
      ftpLastSyncAt: r.ftpLastSyncAt,
    };
  });
}

export async function executeFtpSync(configs: FtpConfigItem[], jobId?: string, requestUrl?: string) {
  const startTime = Date.now();
  const isLocal = Boolean(requestUrl?.includes('127.0.0.1') || requestUrl?.includes('localhost'));
  const MAX_EXECUTION_TIME_MS = isLocal ? 240000 : 50000;

  let results: Record<string, any> = {};
  let hasMore = false;
  let historyLog = '';

  const updateJobStatus = async (statusLine: string, progressPct?: number) => {
    if (!jobId) return;
    const combinedLogs = historyLog ? `${historyLog}\n${statusLine}` : statusLine;
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        ...(progressPct !== undefined ? { progress: progressPct } : {}),
        logs: combinedLogs,
      },
    }).catch(() => {});
  };

  try {
    if (jobId) {
      const existingJob = await prisma.syncJob.findUnique({ where: { id: jobId } });
      if (existingJob?.results) {
        results = typeof existingJob.results === 'string' ? JSON.parse(existingJob.results) : (existingJob.results as Record<string, any>);
      }
      historyLog = Array.isArray(results.__meta?.historyLogs) ? results.__meta.historyLogs.join('\n') : '';

      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING',
          logs: historyLog || 'Iniciando proceso de sincronización...',
        },
      });
    }

    const customSinceIso = results.__meta?.customSince as string | undefined;
    const customSinceDate = customSinceIso ? new Date(customSinceIso) : null;
    const historyLogs: string[] = Array.isArray(results.__meta?.historyLogs) ? [...results.__meta.historyLogs] : [];
    const affectedDatesSet = new Set<string>(
      Array.isArray(results.__meta?.affectedDates) ? results.__meta.affectedDates : []
    );

    const recordHistory = (line: string) => {
      historyLogs.push(line);
      historyLog = historyLogs.join('\n');
      results.__meta = {
        ...(results.__meta || {}),
        historyLogs,
        affectedDates: Array.from(affectedDatesSet),
      };
    };

    const totalConfigs = Math.max(1, configs.length);

    for (let cfgIdx = 0; cfgIdx < configs.length; cfgIdx++) {
      const config = configs[cfgIdx];
      const distKey = config.name;

      if (results[distKey]?.status === 'COMPLETED' || results[distKey]?.status === 'ERROR') {
        continue;
      }

      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        hasMore = true;
        break;
      }

      if (!config.ftpHost) {
        results[distKey] = {
          processed: 0,
          totalFiles: 0,
          newFiles: 0,
          success: 0,
          skipped: 0,
          errors: 1,
          status: 'ERROR',
          errorMsg: 'Host FTP no configurado',
        };
        recordHistory(`✗ ${distKey}: Host FTP no configurado`);
        continue;
      }

      let ftpClient: Client | null = null;
      let sftpClient: SftpClient | null = null;

      try {
        if (!results[distKey]) {
          results[distKey] = {
            processed: 0,
            totalFiles: 0,
            newFiles: 0,
            success: 0,
            skipped: 0,
            errors: 0,
            status: 'OK',
          };
        }

        const port = config.ftpPort || 21;
        const useSftp = isSftpPort(port);

        if (!Array.isArray(results[distKey].pendingFiles)) {
          const basePct = Math.floor((cfgIdx / totalConfigs) * 100);
          await updateJobStatus(`Conectando al servidor de ${distKey} (${config.ftpHost}:${port})...`, basePct);

          let lastExploreUpdate = 0;
          const onExploreProgress = (path: string) => {
            const now = Date.now();
            if (jobId && now - lastExploreUpdate > 1500) {
              lastExploreUpdate = now;
              updateJobStatus(`Explorando ${distKey}: ${path}`);
            }
          };

          const hasCustomSince = Boolean(customSinceDate && !isNaN(customSinceDate.getTime()));
          const hasSavedSyncCursor = !hasCustomSince && Boolean(config.ftpLastSyncAt);
          const effectiveSince = hasCustomSince
            ? customSinceDate!
            : config.ftpLastSyncAt || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

          let fileList: any[] = [];
          try {
            if (useSftp) {
              sftpClient = new SftpClient();
              await sftpClient.connect({
                host: config.ftpHost,
                port,
                username: config.ftpUser || '',
                password: config.ftpPassword || '',
                readyTimeout: 10000,
              });
              fileList = await listSftpRecursive(sftpClient, config.ftpTargetPath || '/', onExploreProgress, effectiveSince);
            } else {
              ftpClient = new Client(10000);
              await ftpClient.access({
                host: config.ftpHost,
                port,
                user: config.ftpUser || '',
                password: config.ftpPassword || '',
                secure: port === 21 ? false : 'implicit',
                secureOptions: { rejectUnauthorized: false },
              });
              fileList = await listFtpRecursive(ftpClient, config.ftpTargetPath || '/', onExploreProgress, effectiveSince);
            }
          } catch (connErr: any) {
            console.error(`FTP Connection/List Error for ${distKey}:`, connErr);
            results[distKey].status = 'ERROR';
            results[distKey].errorMsg = connErr.message;
            recordHistory(`✗ ${distKey}: Error de conexión (${connErr.message})`);
            await updateJobStatus(`Error conectando a ${distKey}`);
            continue;
          }

          const filesToProcess = fileList
            .filter(file => {
              if (file.isDirectory) return false;
              const fileDate = file.modifiedAt ? new Date(file.modifiedAt) : new Date();
              if (hasSavedSyncCursor ? fileDate <= effectiveSince : fileDate < effectiveSince) return false;
              return isRecognizedCchFilename(file.name, false);
            })
            .sort((a, b) => {
              const timeA = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
              const timeB = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
              return timeA - timeB;
            });

          results[distKey].pendingFiles = filesToProcess;
          results[distKey].totalFiles = filesToProcess.length;
          results[distKey].newFiles = filesToProcess.length;
        }

        // Reconectar si venimos de un chunk subsiguiente con ficheros pendientes
        if (results[distKey].pendingFiles.length > 0 && !ftpClient && !sftpClient) {
          try {
            if (useSftp) {
              sftpClient = new SftpClient();
              await sftpClient.connect({
                host: config.ftpHost,
                port,
                username: config.ftpUser || '',
                password: config.ftpPassword || '',
                readyTimeout: 10000,
              });
            } else {
              ftpClient = new Client(10000);
              await ftpClient.access({
                host: config.ftpHost,
                port,
                user: config.ftpUser || '',
                password: config.ftpPassword || '',
                secure: port === 21 ? false : 'implicit',
                secureOptions: { rejectUnauthorized: false },
              });
            }
          } catch (reconnErr: any) {
            console.error(`FTP Re-Connection Error for ${distKey}:`, reconnErr);
            results[distKey].status = 'ERROR';
            results[distKey].errorMsg = 'Error reconectando para pendientes: ' + reconnErr.message;
            recordHistory(`✗ ${distKey}: Error al reconectar (${reconnErr.message})`);
            continue;
          }
        }

        let newestDate: Date | null = config.ftpLastSyncAt ? new Date(config.ftpLastSyncAt) : null;

        while (results[distKey].pendingFiles.length > 0) {
          const file = results[distKey].pendingFiles[0];

          try {
            let buffer: Buffer;
            if (useSftp && sftpClient) {
              const raw = await sftpClient.get(file.fullPath);
              buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
            } else if (ftpClient) {
              const stream = new PassThrough();
              const chunks: Buffer[] = [];
              stream.on('data', (chunk: Buffer) => chunks.push(chunk));
              await ftpClient.downloadTo(stream, file.fullPath);
              buffer = Buffer.concat(chunks);
            } else {
              throw new Error('Cliente FTP/SFTP no inicializado');
            }

            const fileResult = await processCchBuffer(
              buffer,
              file.name,
              `FTP_${config.distributorName}`,
              true
            );

            results[distKey].success += fileResult.success;
            results[distKey].skipped += fileResult.skipped;
            results[distKey].errors += fileResult.errors;
            if (fileResult.affectedDates && fileResult.affectedDates.length > 0) {
              for (const d of fileResult.affectedDates) affectedDatesSet.add(d);
              results.__meta = {
                ...(results.__meta || {}),
                historyLogs,
                affectedDates: Array.from(affectedDatesSet),
              };
            }

            const fileDate = file.modifiedAt ? new Date(file.modifiedAt) : new Date();
            if (!isNaN(fileDate.getTime()) && (!newestDate || fileDate > newestDate)) {
              newestDate = fileDate;
            }
          } catch (fileErr: any) {
            console.error(`Error procesando fichero FTP ${file?.fullPath} en ${distKey}:`, fileErr);
            results[distKey].errors += 1;
            recordHistory(`⚠ ${distKey}: Error en fichero ${file?.name} (${fileErr.message})`);
          }

          results[distKey].processed++;
          results[distKey].pendingFiles.shift();

          const totalFiles = results[distKey].totalFiles || 1;
          const distFraction = Math.min(1, results[distKey].processed / totalFiles);
          const overallPct = Math.min(99, Math.floor(((cfgIdx + distFraction) / totalConfigs) * 100));

          await updateJobStatus(
            `Procesando ${distKey}... (${results[distKey].processed}/${totalFiles}) — ${file.name}`,
            overallPct
          );

          if (Date.now() - startTime > MAX_EXECUTION_TIME_MS && results[distKey].pendingFiles.length > 0) {
            hasMore = true;
            break;
          }
        }

        // Persistir siempre el avance real de fecha por distribuidora/compañía (incluso si corta por chunk)
        if (newestDate && (!config.ftpLastSyncAt || newestDate > config.ftpLastSyncAt)) {
          await prisma.distributorCompanyConfig.update({
            where: { id: config.configId },
            data: { ftpLastSyncAt: newestDate },
          });
          config.ftpLastSyncAt = newestDate;
        }

        if (hasMore) {
          break;
        }

        results[distKey].status = 'COMPLETED';
        recordHistory(
          `✓ ${distKey}: ${results[distKey].processed} archivos (${results[distKey].success} curvas guardadas, ${results[distKey].skipped} ignoradas, ${results[distKey].errors} errores)`
        );
      } catch (err: any) {
        console.error(`FTP Sync Error for ${distKey}:`, err);
        results[distKey].status = 'ERROR';
        results[distKey].errorMsg = err.message;
        recordHistory(`✗ ${distKey}: ${err.message}`);
        await updateJobStatus(`Error en ${distKey}: ${err.message}`);
      } finally {
        if (sftpClient) await sftpClient.end().catch(() => {});
        if (ftpClient && !ftpClient.closed) ftpClient.close();
      }
    }

    if (!hasMore && affectedDatesSet.size > 0) {
      try {
        const sortedDates = Array.from(affectedDatesSet).sort();
        await updateJobStatus(`Actualizando agregados horarios CCH (${sortedDates.length} días)...`, 99);
        await AggregationService.regenerateForDates(sortedDates);
        const affectedMonths = Array.from(new Set(sortedDates.map(d => d.slice(0, 7)))).sort();
        await runCalculatePendingEnergy(undefined, undefined, { targetMonths: affectedMonths });
        recordHistory(`✓ Agregados CCH y Energía Pendiente actualizados (${affectedMonths.join(', ')})`);
      } catch (aggErr: any) {
        console.error('Aviso: error actualizando agregados tras FTP Sync:', aggErr);
      }
    }

    if (jobId) {
      if (!hasMore) {
        await prisma.syncJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            results,
            progress: 100,
            logs: historyLog || 'Sincronización finalizada sin ficheros nuevos.',
          },
        });
      } else {
        await prisma.syncJob.update({
          where: { id: jobId },
          data: { results },
        });
      }
    }

    return { results, hasMore };
  } catch (globalErr: any) {
    if (jobId) {
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: 'ERROR',
          logs: `${historyLog ? historyLog + '\n' : ''}Error fatal: ${globalErr.message}`,
        },
      }).catch(() => {});
    }
    throw globalErr;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const jobId = url.searchParams.get('jobId');
  const companyId = url.searchParams.get('companyId') || undefined;
  const authHeader = req.headers.get('authorization');

  const expectedSecret = process.env.CRON_SECRET;
  const isAuthorized =
    Boolean(expectedSecret) &&
    (secret === expectedSecret || authHeader === `Bearer ${expectedSecret}`);

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron secret' }, { status: 401 });
  }

  const configs = await loadActiveFtpConfigs(companyId);

  if (configs.length === 0) {
    return NextResponse.json({ message: 'No hay configuraciones FTP activas.' });
  }

  let effectiveJobId = jobId || undefined;
  if (!effectiveJobId) {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const runningCronJob = await prisma.syncJob.findFirst({
      where: {
        type: 'CRON_FTP_SYNC',
        status: { in: ['PENDING', 'RUNNING'] },
        updatedAt: { gte: staleThreshold },
        ...(companyId ? { companyId } : { companyId: null }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (runningCronJob) {
      effectiveJobId = runningCronJob.id;
    } else {
      const createdCronJob = await prisma.syncJob.create({
        data: {
          type: 'CRON_FTP_SYNC',
          status: 'PENDING',
          companyId: companyId || null,
        },
      });
      effectiveJobId = createdCronJob.id;
    }
  }

  const { results, hasMore } = await executeFtpSync(configs, effectiveJobId, req.url);
  return NextResponse.json({
    message: hasMore ? 'Sincronización FTP chunk completado (quedan pendientes)' : 'Sincronización FTP completada',
    jobId: effectiveJobId,
    results,
    hasMore,
  });
}
