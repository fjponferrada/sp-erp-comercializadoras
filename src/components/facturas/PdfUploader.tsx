'use client';

import React, { useState, useRef } from 'react';
import { FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function PdfUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ total: number, success: number, errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (files: File[]) => {
    // Solo PDFs y XMLs
    const validFiles = files.filter(f => f.name.endsWith('.pdf') || f.name.endsWith('.xml'));
    
    if (validFiles.length === 0) {
      setStatus('error');
      setResults({ total: 0, success: 0, errors: ['No se seleccionó ningún PDF o XML válido.'] });
      return;
    }

    setStatus('uploading');
    setProgress(0);
    
    const currentResults = { total: validFiles.length, success: 0, errors: [] as string[] };

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload-pdf', {
          method: 'POST',
          body: formData,
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
          currentResults.success++;
        } else {
          currentResults.errors.push(`${file.name}: ${data.error}`);
        }
      } catch (err: any) {
        currentResults.errors.push(`${file.name}: Error de conexión`);
      }

      setProgress(Math.round(((i + 1) / validFiles.length) * 100));
    }

    setResults(currentResults);
    setStatus(currentResults.errors.length > 0 && currentResults.success === 0 ? 'error' : 'success');
  };

  return (
    <div 
      className={`bg-slate-800/30 border-2 border-dashed rounded-2xl p-10 transition-colors flex flex-col items-center justify-center text-center cursor-pointer relative overflow-hidden ${
        isDragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 hover:border-indigo-500/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => status === 'idle' && fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept=".pdf,.xml"
        multiple
        onChange={handleFileChange}
      />

      {status === 'idle' && (
        <>
          <div className="bg-slate-900 p-4 rounded-full mb-4 transform transition-transform hover:scale-110">
            <FileText className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Adjuntar PDFs / XMLs</h3>
          <p className="text-slate-400 max-w-md text-sm">
            Arrastra aquí decenas de PDFs al mismo tiempo. El CRM los enlazará a las facturas automáticamente usando el nombre del archivo.
          </p>
          <button className="mt-6 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-medium transition-colors text-sm">
            Seleccionar PDFs
          </button>
        </>
      )}

      {status === 'uploading' && (
        <div className="flex flex-col items-center w-full max-w-sm">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Subiendo archivos...</h3>
          <p className="text-slate-400 mb-4">{progress}% Completado</p>
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {status === 'success' && results && (
        <div className="flex flex-col items-center">
          <div className="bg-emerald-500/20 p-4 rounded-full mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Carga Finalizada</h3>
          
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-4">
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-400">{results.success}</div>
              <div className="text-xs text-slate-500 uppercase">Enlazados</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-2xl font-bold text-rose-400">{results.errors.length}</div>
              <div className="text-xs text-slate-500 uppercase">Fallidos</div>
            </div>
          </div>

          {results.errors.length > 0 && (
            <div className="w-full max-w-md text-left bg-rose-500/10 rounded-lg p-3 mb-6 max-h-32 overflow-y-auto border border-rose-500/20">
              <p className="text-xs font-semibold text-rose-400 mb-1">Errores (Archivos no encontrados en BD):</p>
              <ul className="text-xs text-rose-300/80 space-y-1 list-disc pl-4">
                {results.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          
          <button 
            onClick={(e) => { e.stopPropagation(); setStatus('idle'); setResults(null); }}
            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-xl font-medium text-sm"
          >
            Subir más
          </button>
        </div>
      )}

      {status === 'error' && results && (
        <div className="flex flex-col items-center">
          <div className="bg-rose-500/20 p-4 rounded-full mb-4">
            <AlertCircle className="w-10 h-10 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Error General</h3>
          <p className="text-rose-400 max-w-md text-sm mb-6">{results.errors[0]}</p>
          <button 
            onClick={(e) => { e.stopPropagation(); setStatus('idle'); }}
            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-xl font-medium text-sm"
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
