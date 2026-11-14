'use client';

import React, { useState, useRef } from 'react';
import { FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function PdfUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [overwrite, setOverwrite] = useState(false);
  const [results, setResults] = useState<{ total: number; success: number; errors: string[] } | null>(null);
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
      e.target.value = '';
    }
  };

  const processFiles = async (files: File[]) => {
    // Filtrado insensible a mayúsculas (.pdf, .PDF, .xml, .XML)
    const validFiles = files.filter((f) => {
      const lower = f.name.toLowerCase();
      return lower.endsWith('.pdf') || lower.endsWith('.xml');
    });

    if (validFiles.length === 0) {
      setStatus('error');
      setResults({ total: 0, success: 0, errors: ['No se seleccionó ningún archivo .pdf o .xml válido.'] });
      return;
    }

    setStatus('uploading');
    setProgress(0);
    setProcessedCount(0);
    setTotalFiles(validFiles.length);

    const currentResults = { total: validFiles.length, success: 0, errors: [] as string[] };
    let completed = 0;

    // Subida en lotes paralelos controlados (5 simultáneos) para multiplicar velocidad sin saturar BD/R2
    const CONCURRENCY = 5;
    for (let i = 0; i < validFiles.length; i += CONCURRENCY) {
      const batch = validFiles.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('overwrite', overwrite ? 'true' : 'false');

          try {
            const res = await fetch('/api/upload-pdf', {
              method: 'POST',
              body: formData,
            });

            const data = await res.json();
            if (res.ok && data.success) {
              currentResults.success++;
            } else {
              currentResults.errors.push(`${file.name}: ${data.error || 'Error al adjuntar'}`);
            }
          } catch {
            currentResults.errors.push(`${file.name}: Error de red/conexión`);
          } finally {
            completed++;
            setProcessedCount(completed);
            setProgress(Math.round((completed / validFiles.length) * 100));
          }
        })
      );
    }

    setResults(currentResults);
    setStatus(currentResults.errors.length > 0 && currentResults.success === 0 ? 'error' : 'success');
  };

  return (
    <div
      className="card transition-all flex flex-col items-center justify-center text-center relative overflow-hidden"
      style={{
        padding: '40px 32px',
        minHeight: '340px',
        borderStyle: 'dashed',
        borderWidth: '2px',
        borderColor: isDragging ? '#6366f1' : 'var(--border-strong)',
        background: isDragging ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-surface)',
        cursor: status === 'idle' ? 'pointer' : 'default',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => status === 'idle' && fileInputRef.current?.click()}
    >
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        accept=".pdf,.PDF,.xml,.XML"
        multiple
        onChange={handleFileChange}
      />

      {status === 'idle' && (
        <>
          <div
            className="p-4 rounded-full mb-4 transition-transform hover:scale-105"
            style={{ background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)' }}
          >
            <FileText className="w-8 h-8" style={{ color: '#6366f1' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            2. Adjuntar PDFs y XMLs en Nube (R2)
          </h3>
          <p className="max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
            Arrastra decenas o cientos de archivos <code style={{ fontFamily: 'monospace' }}>NºFactura.pdf</code> o <code style={{ fontFamily: 'monospace' }}>NºFactura.xml</code> a la vez. Se enlazarán automáticamente por nombre de archivo.
          </p>

          <label
            className="flex items-center gap-2 mt-4 text-xs cursor-pointer select-none"
            style={{ color: 'var(--text-muted)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Sobrescribir si la factura ya tiene un PDF/XML en la nube</span>
          </label>

          <button type="button" className="btn-secondary mt-5">
            Seleccionar PDFs / XMLs
          </button>
        </>
      )}

      {status === 'uploading' && (
        <div className="flex flex-col items-center w-full max-w-sm">
          <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: '#6366f1' }} />
          <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Subiendo documentos a R2...
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            {processedCount} de {totalFiles} archivos ({progress}%)
          </p>
          <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
            <div
              className="h-2.5 rounded-full transition-all duration-200"
              style={{ width: `${progress}%`, background: '#6366f1' }}
            />
          </div>
        </div>
      )}

      {status === 'success' && results && (
        <div className="flex flex-col items-center w-full">
          <div
            className="p-4 rounded-full mb-4"
            style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
          >
            <CheckCircle className="w-10 h-10" style={{ color: '#10b981' }} />
          </div>
          <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Carga Finalizada
          </h3>

          <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-4">
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div className="text-2xl font-bold" style={{ color: '#10b981' }}>{results.success}</div>
              <div className="text-xs uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Enlazados</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div className="text-2xl font-bold" style={{ color: results.errors.length > 0 ? '#f43f5e' : 'var(--text-muted)' }}>
                {results.errors.length}
              </div>
              <div className="text-xs uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Omitidos / Error</div>
            </div>
          </div>

          {results.errors.length > 0 && (
            <div
              className="w-full max-w-lg text-left rounded-xl p-3 mb-5 max-h-40 overflow-y-auto"
              style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#fb7185' }}>
                Detalle de incidencias ({results.errors.length}):
              </p>
              <ul className="text-xs space-y-1 list-disc pl-4" style={{ color: 'var(--text-secondary)' }}>
                {results.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setStatus('idle');
              setResults(null);
            }}
            className="btn-secondary"
          >
            Subir más archivos
          </button>
        </div>
      )}

      {status === 'error' && results && (
        <div className="flex flex-col items-center w-full">
          <div
            className="p-4 rounded-full mb-4"
            style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)' }}
          >
            <AlertCircle className="w-10 h-10" style={{ color: '#f43f5e' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            No se pudo completar la carga
          </h3>
          {results.errors.length === 1 ? (
            <p className="max-w-md text-sm mb-6" style={{ color: '#fb7185' }}>{results.errors[0]}</p>
          ) : (
            <div
              className="w-full max-w-lg text-left rounded-xl p-3 mb-6 max-h-40 overflow-y-auto"
              style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ul className="text-xs space-y-1 list-disc pl-4" style={{ color: '#fb7185' }}>
                {results.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setStatus('idle');
            }}
            className="btn-secondary"
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
