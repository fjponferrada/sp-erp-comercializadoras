'use client';

import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, RefreshCcw, FileText, Server, Loader2, ShieldAlert } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useSession } from 'next-auth/react';
import Topbar from '@/components/Topbar';
import { useBrandTheme } from '@/context/BrandThemeContext';
import { triggerFtpSyncManually, getDistributorSyncStatus } from '@/app/actions/ftpSync';

const ALLOWED_ROLES = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'];

async function safeParseJsonResponse(res: Response): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
  const rawText = await res.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, rawText };
}

export default function ImportadorCchPage() {
  const { data: session, status: sessionStatus } = useSession();
  const theme = useBrandTheme();

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);
  const [results, setResults] = useState<{ file: string; success: boolean; message: string; details?: any }[]>([]);
  const [finished, setFinished] = useState(false);
  const [syncingFtp, setSyncingFtp] = useState(false);
  const [ftpResults, setFtpResults] = useState<any>(null);
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncJobStatus, setSyncJobStatus] = useState<any>(null);
  const [distributorStatuses, setDistributorStatuses] = useState<any[]>([]);
  const [syncMode, setSyncMode] = useState<'auto' | 'custom'>('auto');
  const [syncDays, setSyncDays] = useState<number>(5);

  const [regenerating, setRegenerating] = useState(false);
  const [regenDays, setRegenDays] = useState(60);
  const [regenResult, setRegenResult] = useState<any>(null);

  const userRole = (session?.user as any)?.role as string | undefined;
  const isAuthorized = Boolean(userRole && ALLOWED_ROLES.includes(userRole));

  React.useEffect(() => {
    if (sessionStatus === 'authenticated' && isAuthorized) {
      getDistributorSyncStatus().then(setDistributorStatuses);
    }
  }, [sessionStatus, isAuthorized, theme.name]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (syncJobId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/sync/${syncJobId}`);
          if (res.ok) {
            const data = await res.json();
            setSyncJobStatus(data);
            if (data.status === 'COMPLETED' || data.status === 'ERROR') {
              setSyncingFtp(false);
              setSyncJobId(null);
              clearInterval(interval);
              getDistributorSyncStatus().then(setDistributorStatuses);
            }
          } else if (res.status === 401 || res.status === 403 || res.status === 404) {
            setSyncingFtp(false);
            setSyncJobId(null);
            clearInterval(interval);
          }
        } catch {
          // Ignorar fallos puntuales de red durante el polling
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [syncJobId]);

  const handleSyncFtp = async () => {
    try {
      setSyncingFtp(true);
      setFtpResults(null);
      setSyncJobId(null);
      setSyncJobStatus(null);

      const safeSyncDays = Math.min(Math.max(1, Math.floor(syncDays || 1)), 365);
      const res = await triggerFtpSyncManually(syncMode === 'custom' ? safeSyncDays : undefined);

      if (res.success === false) {
        setFtpResults({ success: false, message: res.message });
        setSyncingFtp(false);
        return;
      }

      if (res.jobId) {
        setSyncJobId(res.jobId);
        setSyncJobStatus({
          status: res.alreadyRunning ? 'RUNNING' : 'PENDING',
          progress: 0,
          logs: res.alreadyRunning
            ? 'Conectado a la sincronización FTP ya en curso...'
            : 'Iniciando sincronización en segundo plano...',
        });

        if (!res.alreadyRunning) {
          const executeChunks = async (id: string) => {
            let hasMore = true;
            while (hasMore) {
              try {
                const r = await fetch(`/api/cron/ftp-sync/execute?jobId=${id}`);
                const parsed = await safeParseJsonResponse(r);
                if (!parsed.ok) {
                  const errMsg =
                    parsed.data?.error ||
                    (parsed.status === 504
                      ? 'Tiempo de espera agotado en el servidor durante el bloque FTP.'
                      : `Error HTTP ${parsed.status} ejecutando sincronización FTP.`);
                  setSyncJobStatus((prev: any) => ({
                    ...(prev || {}),
                    status: 'ERROR',
                    logs: `${prev?.logs ? prev.logs + '\n' : ''}${errMsg}`,
                  }));
                  setSyncingFtp(false);
                  setSyncJobId(null);
                  break;
                }
                hasMore = Boolean(parsed.data?.hasMore);
              } catch (e: any) {
                console.error(e);
                setSyncJobStatus((prev: any) => ({
                  ...(prev || {}),
                  status: 'ERROR',
                  logs: `${prev?.logs ? prev.logs + '\n' : ''}Error de red: ${e.message || 'Conexión interrumpida'}`,
                }));
                setSyncingFtp(false);
                setSyncJobId(null);
                break;
              }
            }
          };
          executeChunks(res.jobId);
        }
      } else {
        setFtpResults({ success: true, message: res.message, results: (res as any).results });
        setSyncingFtp(false);
      }
    } catch (error: any) {
      setFtpResults({ success: false, message: error.message });
      setSyncingFtp(false);
    }
  };

  const processFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFinished(false);
    setTotalFiles(files.length);
    setProcessedFiles(0);
    setResults([]);
    setProgress(0);

    const newResults: { file: string; success: boolean; message: string; details?: any }[] = [];
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.');
    const MAX_VERCEL_BYTES = 4.5 * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFile(file.name);

      if (!isLocalHost && file.size > MAX_VERCEL_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        newResults.push({
          file: file.name,
          success: false,
          message: `El archivo pesa ${sizeMb} MB y supera el límite de 4.5 MB de Vercel. Divídelo en partes más pequeñas o súbelo desde el servidor local.`,
        });
        setResults([...newResults]);
        setProcessedFiles(i + 1);
        setProgress(Math.round(((i + 1) / files.length) * 100));
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/etl/cch', {
          method: 'POST',
          body: formData,
        });

        const parsed = await safeParseJsonResponse(res);

        if (parsed.ok && parsed.data) {
          newResults.push({
            file: file.name,
            success: true,
            message: 'Procesado correctamente',
            details: parsed.data.results,
          });
        } else {
          let errMsg = parsed.data?.error || 'Error de procesamiento';
          if (!parsed.data) {
            if (parsed.status === 413) {
              errMsg = 'Archivo demasiado grande para el límite HTTP del servidor (413 Payload Too Large).';
            } else if (parsed.status === 504) {
              errMsg = 'Tiempo máximo de ejecución superado (504 Gateway Timeout). Divide el ZIP en bloques más pequeños.';
            } else {
              errMsg = `Error del servidor (HTTP ${parsed.status})`;
            }
          }
          newResults.push({
            file: file.name,
            success: false,
            message: errMsg,
          });
        }
      } catch (e: any) {
        newResults.push({
          file: file.name,
          success: false,
          message: e.message || 'Error de red durante la subida',
        });
      }

      setResults([...newResults]);
      setProcessedFiles(i + 1);
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setUploading(false);
    setFinished(true);
    setCurrentFile('');
  }, []);

  const handleRegenerateAggregates = async () => {
    try {
      setRegenerating(true);
      setRegenResult(null);
      const safeDays = Math.min(Math.max(1, Math.floor(regenDays || 60)), 730);
      setRegenDays(safeDays);

      const res = await fetch(`/api/cron/aggregate-history?days=${safeDays}`);
      const parsed = await safeParseJsonResponse(res);
      if (parsed.ok && parsed.data) {
        setRegenResult({
          success: true,
          message: `Curva regenerada con éxito (${safeDays} días). Insertadas ${parsed.data.rowsInserted} agrupaciones.`,
        });
      } else {
        setRegenResult({
          success: false,
          message:
            parsed.data?.error ||
            (parsed.status === 504
              ? 'Tiempo de espera agotado regenerando la curva. Prueba con menos días hacia atrás.'
              : `Error al regenerar (HTTP ${parsed.status})`),
        });
      }
    } catch (e: any) {
      setRegenResult({ success: false, message: e.message });
    } finally {
      setRegenerating(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!uploading) {
        processFiles(acceptedFiles);
      }
    },
    [uploading, processFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: uploading,
    noKeyboard: uploading,
  });

  if (sessionStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Topbar title="Importar Curvas de Carga (CCH)" subtitle="Cargando permisos..." />
        <div className="flex justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--lime)]" />
        </div>
      </div>
    );
  }

  if (sessionStatus === 'authenticated' && !isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Topbar title="Importar Curvas de Carga (CCH)" subtitle="Acceso restringido" />
        <div className="max-w-2xl mx-auto mt-12 p-6 bg-red-900/20 border border-red-800 rounded-xl flex items-center gap-4 text-red-300">
          <ShieldAlert className="w-8 h-8 text-red-400 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-white">Acceso no autorizado</h3>
            <p className="text-sm mt-1">Esta herramienta está reservada a usuarios de Administración y Backoffice.</p>
          </div>
        </div>
      </div>
    );
  }

  const jobDistEntries =
    syncJobStatus?.results && typeof syncJobStatus.results === 'object'
      ? Object.entries(syncJobStatus.results as Record<string, any>)
      : [];
  const hasAnyDistError = jobDistEntries.some(([, info]) => info?.status === 'ERROR');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Importar Curvas de Carga (CCH)"
        subtitle="Arrastra o selecciona los archivos ZIP, CSV, GZ, BZ2 o XLSX de las distribuidoras (F5D, F1, F1QH, P1D, P2D...). El ETL los agrupará y guardará como curvas diarias."
      />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* FTP SYNC SECTION */}
        <div className="flex flex-col items-start gap-4 p-6 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between w-full gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                <Server className="w-5 h-5 text-[var(--lime)]" />
                Sincronización FTP Automática
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Conecta con los servidores FTP/SFTP configurados para la comercializadora activa y descarga nuevas curvas de carga.
              </p>
              {distributorStatuses.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {distributorStatuses.map(d => (
                    <span key={d.name} className="text-xs px-2 py-1 bg-gray-800 rounded-md border border-gray-700 text-gray-300">
                      <strong className="text-[var(--lime)]">{d.name}</strong>:{' '}
                      {d.ftpLastSyncAt ? new Date(d.ftpLastSyncAt).toLocaleString('es-ES') : 'Nunca'}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-yellow-500/90 mt-2">
                  No hay distribuidoras con sincronización FTP activa en esta comercializadora (configúralas en Distribuidoras → Datos Distribuidora).
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                  <input
                    type="radio"
                    name="syncMode"
                    value="auto"
                    checked={syncMode === 'auto'}
                    onChange={() => setSyncMode('auto')}
                    className="accent-[var(--lime)] cursor-pointer"
                  />
                  <span>Desde última fecha</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 ml-2">
                  <input
                    type="radio"
                    name="syncMode"
                    value="custom"
                    checked={syncMode === 'custom'}
                    onChange={() => setSyncMode('custom')}
                    className="accent-[var(--lime)] cursor-pointer"
                  />
                  <span>Hacia atrás:</span>
                </label>

                <input
                  type="number"
                  min="1"
                  max="365"
                  value={syncDays}
                  onChange={e => setSyncDays(Number(e.target.value))}
                  disabled={syncMode !== 'custom'}
                  className={`w-16 bg-gray-800 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-[var(--lime)] transition-colors ${
                    syncMode !== 'custom' ? 'border-gray-700 text-gray-500 opacity-50' : 'border-gray-600 text-white'
                  }`}
                />
                <span className={`text-sm ${syncMode !== 'custom' ? 'text-gray-500 opacity-50' : 'text-gray-300'}`}>días</span>
              </div>

              <button
                onClick={handleSyncFtp}
                disabled={syncingFtp || uploading || distributorStatuses.length === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
                  syncingFtp || uploading || distributorStatuses.length === 0
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-[var(--lime)] text-black hover:scale-105'
                }`}
              >
                {syncingFtp ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                {syncingFtp ? 'Sincronizando...' : 'Conectar FTPs Ahora'}
              </button>
            </div>
          </div>

          {syncJobStatus && (
            <div className="w-full p-4 rounded-lg mt-2 bg-gray-800/50 border border-gray-700">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-gray-300">
                  <span className="font-semibold text-[var(--lime)]">{syncJobStatus.status}</span>
                  <span>{syncJobStatus.progress ?? 0}%</span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2.5">
                  <div
                    className="bg-[var(--lime)] h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${syncJobStatus.progress ?? 0}%` }}
                  />
                </div>
                {syncJobStatus.logs && (
                  <pre className="mt-2 text-xs text-gray-400 bg-black/50 p-2.5 rounded-md max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {syncJobStatus.logs}
                  </pre>
                )}

                {syncJobStatus.status === 'COMPLETED' && (
                  <div
                    className={`mt-2 p-3 rounded-md border ${
                      hasAnyDistError
                        ? 'bg-yellow-900/20 border-yellow-700'
                        : 'bg-green-900/20 border-green-800'
                    }`}
                  >
                    <p
                      className={`font-medium flex items-center gap-2 ${
                        hasAnyDistError ? 'text-yellow-400' : 'text-green-400'
                      }`}
                    >
                      {hasAnyDistError ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      {hasAnyDistError
                        ? 'Sincronización finalizada con avisos en alguna distribuidora.'
                        : 'Sincronización finalizada con éxito.'}
                    </p>

                    {jobDistEntries.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-300 space-y-1">
                        {jobDistEntries.map(([distName, info]: [string, any]) => (
                          <li key={distName} className="flex flex-wrap gap-2">
                            <span className="font-mono text-gray-400">[{distName}]</span>
                            {info?.status === 'ERROR' ? (
                              <span className="text-red-400">Error: {info.errorMsg || 'Fallo de conexión'}</span>
                            ) : (
                              <span className="text-green-300">
                                {info?.processed || 0} archivos — Insertadas/Act.: {info?.success || 0}, Ignoradas: {info?.skipped || 0}, Errores: {info?.errors || 0}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {syncJobStatus.status === 'ERROR' && (
                  <div className="mt-2 p-3 bg-red-900/20 border border-red-800 rounded-md">
                    <p className="text-red-400 font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Ocurrió un error en la sincronización.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!syncJobStatus && ftpResults && (
            <div className={`w-full p-4 rounded-lg mt-2 ${ftpResults.success ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
              <div className="flex items-start">
                {ftpResults.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-medium ${ftpResults.success ? 'text-green-300' : 'text-red-300'}`}>{ftpResults.message}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* REGENERATE AGGREGATES SECTION */}
        <div className="flex flex-col items-start gap-4 p-6 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between w-full gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                <RefreshCcw className="w-5 h-5 text-[var(--lime)]" />
                Regenerar Curva Agregada
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Calcula y regenera las curvas horarias sumadas de la comercializadora activa (útil tras subidas masivas si no se quiere esperar al proceso nocturno).
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <label className="text-sm text-gray-300">Días hacia atrás:</label>
                <input
                  type="number"
                  min="1"
                  max="730"
                  value={regenDays}
                  onChange={e => setRegenDays(Number(e.target.value))}
                  className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-center text-white focus:outline-none focus:border-[var(--lime)] transition-colors"
                />
                <span className="text-sm text-gray-300">días</span>
              </div>
              <button
                onClick={handleRegenerateAggregates}
                disabled={regenerating || uploading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all ${
                  regenerating || uploading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-[var(--lime)] text-black hover:scale-105'
                }`}
              >
                {regenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                {regenerating ? 'Regenerando...' : 'Regenerar Ahora'}
              </button>
            </div>
          </div>
          {regenResult && (
            <div className={`w-full p-4 rounded-lg mt-2 ${regenResult.success ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
              <div className="flex items-start">
                {regenResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                )}
                <p className={`font-medium ${regenResult.success ? 'text-green-300' : 'text-red-300'}`}>{regenResult.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* DROPZONE */}
        {!uploading && !finished && (
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-[var(--lime)] bg-[rgba(205,255,100,0.05)] scale-[1.02]'
                : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`w-16 h-16 mx-auto mb-4 ${isDragActive ? 'text-[var(--lime)] animate-bounce' : 'text-gray-500'}`} />
            <h3 className="text-2xl font-bold text-gray-200 mb-2">
              {isDragActive ? 'Suelta los archivos aquí...' : 'Haz clic o arrastra archivos ZIP, CSV, GZ, BZ2 o XLSX'}
            </h3>
            <p className="text-gray-500">Soporta múltiples archivos simultáneos (consumo y excedentes CNMC v4.3). No cierres la ventana durante la subida.</p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-900/20 border border-yellow-800 text-yellow-500 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>
                En despliegue cloud (Vercel), procura que cada archivo individual pese <strong>menos de 4.5 MB</strong>.
              </span>
            </div>
          </div>
        )}

        {/* PROGRESS UI */}
        {uploading && (
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-8 space-y-6 shadow-xl">
            <div className="text-center space-y-2">
              <RefreshCcw className="w-12 h-12 text-[var(--lime)] mx-auto animate-spin" />
              <h2 className="text-2xl font-bold text-gray-100">Procesando Curvas...</h2>
              <p className="text-gray-400">
                Por favor, no cierres esta pestaña. {processedFiles} de {totalFiles} completados.
              </p>
            </div>

            <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
              <div className="bg-[var(--lime)] h-4 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 font-mono truncate max-w-md">Actual: {currentFile}</span>
              <span className="text-[var(--lime)] font-bold">{progress}%</span>
            </div>
          </div>
        )}

        {/* RESULTS LOG */}
        {results.length > 0 && (
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center bg-[#11151c]">
              <h3 className="text-lg font-bold text-gray-200 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-gray-400" />
                Registro de Importación
              </h3>
              {finished && (
                <button
                  onClick={() => {
                    setFinished(false);
                    setResults([]);
                  }}
                  className="text-sm bg-[var(--border)] hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
                >
                  Subir más archivos
                </button>
              )}
            </div>

            <div className="max-h-[500px] overflow-y-auto p-2">
              {results.map((res, idx) => (
                <div key={idx} className="flex items-start p-3 hover:bg-[rgba(255,255,255,0.02)] border-b border-[var(--border)] last:border-0 transition-colors">
                  <div className="mt-0.5 mr-3 flex-shrink-0">
                    {res.success ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200 truncate">{res.file}</p>
                    <p className={`text-xs mt-1 ${res.success ? 'text-gray-400' : 'text-red-300'}`}>{res.message}</p>
                    {res.details && (
                      <div className="flex space-x-4 mt-2 text-xs text-gray-500">
                        <span>
                          Insertadas/Act.: <span className="text-green-400">{res.details.success}</span>
                        </span>
                        <span>
                          Ignoradas: <span className="text-yellow-400">{res.details.skipped}</span>
                        </span>
                        <span>
                          Errores: <span className="text-red-400">{res.details.errors}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
