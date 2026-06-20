'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, RefreshCcw, FileText, Check, X, Server, Loader2 } from 'lucide-react';
import { ingestSwitchingXmlAction } from '@/app/actions/switchingIngest';
import { ingestF1XmlAction } from '@/app/actions/f1Ingest';
import { retryUnresolvedSwitchingEventsAction, getDistributorScrapingStatus } from '@/app/actions/switchingActions';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';
import Topbar from '@/components/Topbar';

interface ImportarSwitchingClientProps {
  userRole: string;
}

export default function ImportarSwitchingClient({ userRole }: ImportarSwitchingClientProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);
  const [results, setResults] = useState<{ file: string; success: boolean; message: string; type: string }[]>([]);
  const [finished, setFinished] = useState(false);
  
  // Scraping states
  const [isScraping, setIsScraping] = useState(false);
  const [distributorStatuses, setDistributorStatuses] = useState<{name: string; webLastSyncAt: Date | null}[]>([]);
  const [scrapingJobId, setScrapingJobId] = useState<string | null>(null);
  const [scrapingJobStatus, setScrapingJobStatus] = useState<any>(null);

  const fetchStatuses = async () => {
    const statuses = await getDistributorScrapingStatus();
    setDistributorStatuses(statuses);
  };

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scrapingJobId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/scraping/${scrapingJobId}`);
          if (res.ok) {
            const data = await res.json();
            setScrapingJobStatus(data);
            if (data.status === 'COMPLETED' || data.status === 'ERROR') {
              setIsScraping(false);
              clearInterval(interval);
              fetchStatuses();
            }
          }
        } catch (e) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [scrapingJobId]);

  const handleTriggerScraping = async () => {
    setScrapingJobId(null);
    setScrapingJobStatus(null);
    setIsScraping(true);
    try {
      const res = await fetch('/api/cron/trigger-scraping', { method: 'POST' });
      const data = await res.json();
      if (data.success || data.jobId) {
        if (data.jobId) {
          setScrapingJobId(data.jobId);
          setScrapingJobStatus({ status: 'PENDING', logs: 'Iniciando scraping en segundo plano...' });
        }
        toast.success(data.message || 'Scraping encolado correctamente. El Worker local lo ejecutará en breve.');
      } else {
        toast.error(data.error || 'Error al encolar el scraping');
        setIsScraping(false);
      }
    } catch (e: any) {
      toast.error('Error de red al contactar con la API.');
      setIsScraping(false);
    }
  };

  const processFiles = async (files: File[], isF1: boolean) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFinished(false);
    setTotalFiles(files.length);
    setProcessedFiles(0);
    setResults([]);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;
    const newResults: { file: string; success: boolean; message: string; type: string }[] = [];

    const fileTypeStr = isF1 ? 'F1' : 'SCTD';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFile(file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      let result;
      if (isF1) {
        result = await ingestF1XmlAction(formData);
      } else {
        result = await ingestSwitchingXmlAction(formData);
      }
      
      let message = '';
      let isSuccess = false;

      if (result.success) {
        successCount++;
        isSuccess = true;
        if ('warning' in result && result.warning) {
           message = `Aviso: Guardado pero requiere revisión`;
        } else {
           message = 'Ingestado correctamente';
        }
      } else {
        errorCount++;
        isSuccess = false;
        message = 'error' in result ? result.error : 'Error desconocido';
      }

      newResults.push({ file: file.name, success: isSuccess, message, type: fileTypeStr });
      setResults([...newResults]);
      
      setProcessedFiles(i + 1);
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    if (!isF1 && successCount > 0) {
      setCurrentFile('Realizando barrido de eventos pendientes...');
      const retryResult = await retryUnresolvedSwitchingEventsAction();
      if (retryResult.success && retryResult.processedCount! > 0) {
        newResults.push({ 
          file: 'Sistema de Barrido', 
          success: true, 
          message: `${retryResult.resolvedCount}/${retryResult.processedCount} warnings resueltos automáticamente`,
          type: 'SCTD'
        });
        setResults([...newResults]);
      }
    }

    setUploading(false);
    setFinished(true);
    setCurrentFile('');
  };

  const onDropSctd = useCallback((acceptedFiles: File[]) => {
    if (!uploading) processFiles(acceptedFiles, false);
  }, [uploading]);

  const onDropF1 = useCallback((acceptedFiles: File[]) => {
    if (!uploading) processFiles(acceptedFiles, true);
  }, [uploading]);

  const dropzoneSctd = useDropzone({
    onDrop: onDropSctd,
    accept: { 'text/xml': ['.xml'] },
    noClick: uploading, 
    noKeyboard: uploading
  });

  const dropzoneF1 = useDropzone({
    onDrop: onDropF1,
    accept: { 'text/xml': ['.xml'] },
    noClick: uploading, 
    noKeyboard: uploading
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar 
        title="Importador de Archivos XML" 
        subtitle="Sube los archivos XML enviados por las distribuidoras. Selecciona el cajón correcto según sea un archivo de Switching (SCTD) o de Facturación ATR (F1)." 
      />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* AUTOMATIC SCRAPING */}
      {!uploading && !finished && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-8 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                <Server className="w-6 h-6 text-[var(--lime)]" />
                Scraping Automático (Worker)
              </h2>
              <p className="text-gray-400 max-w-2xl text-sm">
                Al pulsar este botón, se añadirá un trabajo a la cola. El Worker local descargará automáticamente los ficheros (tanto F1 como SCTD) y los enrutará por ti.
              </p>
              
              {distributorStatuses.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-4">
                  {distributorStatuses.map((s, idx) => (
                    <div key={idx} className="bg-[var(--bg-base)] border border-[var(--border)] rounded px-3 py-1.5 text-xs flex items-center gap-2">
                      <span className="font-semibold text-gray-300">{s.name}:</span>
                      <span className="text-[var(--lime)]">
                        {s.webLastSyncAt ? new Date(s.webLastSyncAt).toLocaleString('es-ES') : 'Nunca'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleTriggerScraping}
              disabled={isScraping && !scrapingJobStatus}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all shadow-lg ${
                isScraping && !scrapingJobStatus
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-[var(--lime)] text-black hover:bg-opacity-90'
              }`}
            >
              {isScraping && !scrapingJobStatus ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Encolando...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-5 h-5" />
                  Gatillar Scraping Ahora
                </>
              )}
            </button>
          </div>

          {scrapingJobStatus && (
            <div className="w-full p-4 rounded-lg mt-6 bg-gray-800/50 border border-gray-700">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-gray-300">
                  <span className="font-semibold text-[var(--lime)]">{scrapingJobStatus.status}</span>
                </div>
                {scrapingJobStatus.status === 'PENDING' || scrapingJobStatus.status === 'PROCESSING' ? (
                  <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-[var(--lime)] h-2.5 rounded-full transition-all duration-500 w-full animate-pulse"></div>
                  </div>
                ) : null}
                {scrapingJobStatus.logs && (
                  <pre className="mt-2 text-xs text-gray-400 bg-black/50 p-2 rounded-md max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {scrapingJobStatus.logs}
                  </pre>
                )}
                {scrapingJobStatus.status === 'COMPLETED' && (
                  <div className="mt-2 p-3 bg-green-900/20 border border-green-800 rounded-md">
                    <p className="text-green-400 font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Scraping finalizado con éxito.</p>
                  </div>
                )}
                {scrapingJobStatus.status === 'ERROR' && (
                  <div className="mt-2 p-3 bg-red-900/20 border border-red-800 rounded-md">
                    <p className="text-red-400 font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Ocurrió un error en el scraping.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DUAL DROPZONES */}
      {!uploading && !finished && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CAJÓN SCTD */}
          <div 
            {...dropzoneSctd.getRootProps()} 
            className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              dropzoneSctd.isDragActive 
                ? 'border-[var(--lime)] bg-[rgba(205,255,100,0.05)] scale-[1.02]' 
                : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:border-gray-400'
            }`}
          >
            <input {...dropzoneSctd.getInputProps()} />
            <UploadCloud className={`w-16 h-16 mx-auto mb-4 ${dropzoneSctd.isDragActive ? 'text-[var(--lime)] animate-bounce' : 'text-gray-500'}`} />
            <h3 className="text-2xl font-bold text-gray-200 mb-2">
              Importar XML Switching (SCTD)
            </h3>
            <p className="text-gray-500">Procesos C1, C2, M1, A3, R1...</p>
          </div>

          {/* CAJÓN F1 */}
          <div 
            {...dropzoneF1.getRootProps()} 
            className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              dropzoneF1.isDragActive 
                ? 'border-[var(--lime)] bg-[rgba(205,255,100,0.05)] scale-[1.02]' 
                : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:border-gray-400'
            }`}
          >
            <input {...dropzoneF1.getInputProps()} />
            <FileText className={`w-16 h-16 mx-auto mb-4 ${dropzoneF1.isDragActive ? 'text-[var(--lime)] animate-bounce' : 'text-blue-500'}`} />
            <h3 className="text-2xl font-bold text-gray-200 mb-2">
              Importar XML Facturación (F1)
            </h3>
            <p className="text-gray-500">Facturas de Peajes ATR</p>
          </div>
        </div>
      )}

      {/* PROGRESS UI */}
      {uploading && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-8 space-y-6 shadow-xl">
          <div className="text-center space-y-2">
            <RefreshCcw className="w-12 h-12 text-[var(--lime)] mx-auto animate-spin" />
            <h2 className="text-2xl font-bold text-gray-100">Procesando Archivos...</h2>
            <p className="text-gray-400">Por favor, no cierres esta pestaña. {processedFiles} de {totalFiles} completados.</p>
          </div>

          <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
            <div 
              className="bg-[var(--lime)] h-4 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 font-mono truncate max-w-md">Actual: {currentFile}</span>
            <span className="text-[var(--lime)] font-bold">{progress}%</span>
          </div>
        </div>
      )}

      {/* RESULT UI */}
      {finished && (
        <div className="space-y-6">
          <div className="bg-[rgba(205,255,100,0.05)] border border-[var(--lime)] rounded-xl p-8 text-center shadow-xl">
            <CheckCircle className="w-16 h-16 text-[var(--lime)] mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">Importación Finalizada</h2>
            <p className="text-gray-400 text-lg mb-6">
              Se han procesado {totalFiles} archivos correctamente.
            </p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => setFinished(false)}
                className="bg-[var(--bg-elevated)] border border-[var(--border)] text-white px-6 py-3 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors font-medium"
              >
                Subir más archivos
              </button>
              <Link href="/switching-warnings">
                <button className="bg-[var(--lime)] text-black px-6 py-3 rounded-lg hover:bg-opacity-90 transition-colors font-bold shadow-lg">
                  Revisar Warnings Generados
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* LOG HISTORY */}
      {(uploading || finished) && results.length > 0 && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-6 max-h-96 overflow-y-auto custom-scrollbar">
          <h3 className="text-lg font-bold text-gray-200 mb-4 sticky top-0 bg-[var(--bg-elevated)] py-2 border-b border-[var(--border)]">Registro de Operaciones</h3>
          <ul className="space-y-3 text-sm">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                {r.success ? (
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="overflow-hidden w-full flex justify-between items-center pr-2">
                  <div>
                    <p className="font-mono text-gray-300 truncate" title={r.file}>
                      <span className="text-[var(--lime)] font-bold mr-2">[{r.type}]</span>
                      {r.file}
                    </p>
                    <p className={`text-xs mt-1 ${r.success ? 'text-gray-500' : 'text-red-400 font-semibold'}`}>
                      {r.message}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </div>
  );
}
