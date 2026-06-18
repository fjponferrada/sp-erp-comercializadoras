'use client';

import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, RefreshCcw, FileText, Check, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Topbar from '@/components/Topbar';

export default function ImportadorCchPage() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);
  const [results, setResults] = useState<{ file: string; success: boolean; message: string; details?: any }[]>([]);
  const [finished, setFinished] = useState(false);

  const processFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFinished(false);
    setTotalFiles(files.length);
    setProcessedFiles(0);
    setResults([]);
    setProgress(0);

    const newResults: { file: string; success: boolean; message: string; details?: any }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFile(file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const res = await fetch('/api/etl/cch', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        
        if (res.ok) {
          newResults.push({ 
            file: file.name, 
            success: true, 
            message: 'Procesado correctamente',
            details: data.results
          });
        } else {
          newResults.push({ 
            file: file.name, 
            success: false, 
            message: data.error || 'Error de procesamiento' 
          });
        }
      } catch (e: any) {
        newResults.push({ 
          file: file.name, 
          success: false, 
          message: e.message || 'Error de red' 
        });
      }

      setResults([...newResults]);
      setProcessedFiles(i + 1);
      setProgress(Math.round(((i + 1) / files.length) * 100));
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
    noClick: uploading, 
    noKeyboard: uploading
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar 
        title="Importar Curvas de Carga (CCH)" 
        subtitle="Arrastra o selecciona los archivos ZIP o CSV de las distribuidoras (F5D, F1, P1D...). El ETL los agrupará y guardará como arrays diarios." 
      />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

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
              {isDragActive ? 'Suelta los archivos aquí...' : 'Haz clic o arrastra archivos ZIP o CSV'}
            </h3>
            <p className="text-gray-500">Soporta múltiples archivos a la vez. No cierres la ventana durante la subida.</p>
          </div>
        )}

        {/* PROGRESS UI */}
        {uploading && (
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-8 space-y-6 shadow-xl">
            <div className="text-center space-y-2">
              <RefreshCcw className="w-12 h-12 text-[var(--lime)] mx-auto animate-spin" />
              <h2 className="text-2xl font-bold text-gray-100">Procesando Curvas...</h2>
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

        {/* RESULTS LOG */}
        {(results.length > 0) && (
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center bg-[#11151c]">
              <h3 className="text-lg font-bold text-gray-200 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-gray-400" />
                Registro de Importación
              </h3>
              {finished && (
                <button 
                  onClick={() => { setFinished(false); setResults([]); }}
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
                    {res.success ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200 truncate">{res.file}</p>
                    <p className={`text-xs mt-1 ${res.success ? 'text-gray-400' : 'text-red-300'}`}>
                      {res.message}
                    </p>
                    {res.details && (
                      <div className="flex space-x-4 mt-2 text-xs text-gray-500">
                        <span>Insertadas: <span className="text-green-400">{res.details.success}</span></span>
                        <span>Ignoradas: <span className="text-yellow-400">{res.details.skipped}</span></span>
                        <span>Errores: <span className="text-red-400">{res.details.errors}</span></span>
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
