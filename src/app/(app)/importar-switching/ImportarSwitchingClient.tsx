'use client';

import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, RefreshCcw, FileText, Check, X } from 'lucide-react';
import { ingestSwitchingXmlAction } from '@/app/actions/switchingIngest';
import { retryUnresolvedSwitchingEventsAction } from '@/app/actions/switchingActions';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';

interface ImportarSwitchingClientProps {
  userRole: string;
}

export default function ImportarSwitchingClient({ userRole }: ImportarSwitchingClientProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);
  const [results, setResults] = useState<{ file: string; success: boolean; message: string }[]>([]);
  const [finished, setFinished] = useState(false);

  const processFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFinished(false);
    setTotalFiles(files.length);
    setProcessedFiles(0);
    setResults([]);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;
    const newResults: { file: string; success: boolean; message: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFile(file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await ingestSwitchingXmlAction(formData);
      
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

      newResults.push({ file: file.name, success: isSuccess, message });
      setResults([...newResults]); // Update state to show log
      
      setProcessedFiles(i + 1);
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    if (successCount > 0) {
      setCurrentFile('Realizando barrido de eventos pendientes...');
      const retryResult = await retryUnresolvedSwitchingEventsAction();
      if (retryResult.success && retryResult.processedCount! > 0) {
        newResults.push({ 
          file: 'Sistema de Barrido', 
          success: true, 
          message: `${retryResult.resolvedCount}/${retryResult.processedCount} warnings resueltos automáticamente` 
        });
        setResults([...newResults]);
      }
    }

    setUploading(false);
    setFinished(true);
    setCurrentFile('');
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!uploading) {
      processFiles(acceptedFiles);
    }
  }, [uploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/xml': ['.xml'] },
    noClick: uploading, 
    noKeyboard: uploading
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3 text-[var(--lime)]">
          <UploadCloud className="h-8 w-8" />
          Importar XML SCTD
        </h1>
        <p className="text-gray-400 mt-2 text-lg">
          Arrastra o selecciona los archivos XML de distribuidora (Procesos C1, M1, A3, R1, etc.). 
          El sistema los parseará, subirá a Cloudflare R2 y creará los eventos asociados.
        </p>
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
            {isDragActive ? 'Suelta los archivos aquí...' : 'Haz clic o arrastra archivos XML'}
          </h3>
          <p className="text-gray-500">Soporta múltiples archivos a la vez. No cierres la ventana durante la subida.</p>
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
                <div className="overflow-hidden">
                  <p className="font-mono text-gray-300 truncate" title={r.file}>{r.file}</p>
                  <p className={`text-xs mt-1 ${r.success ? 'text-gray-500' : 'text-red-400 font-semibold'}`}>
                    {r.message}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
