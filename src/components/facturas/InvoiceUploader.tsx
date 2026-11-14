'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import * as xlsx from 'xlsx';
import { importInvoicesAction } from '@/app/actions/invoiceActions';

export default function InvoiceUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<{ total: number; imported: number; duplicates: number; errors: string[] } | null>(null);
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
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const processFile = async (file: File) => {
    setStatus('parsing');
    setMessage('Leyendo y decodificando archivo...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const isCsv = file.name.toLowerCase().endsWith('.csv');

      let workbook: xlsx.WorkBook;
      if (isCsv) {
        // Autodetección estricta UTF-8 vs Windows-1252 (ANSI habitual en exportaciones de escritorio como Ingebau)
        let decodedText: string;
        try {
          decodedText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          decodedText = new TextDecoder('windows-1252').decode(bytes);
        }
        workbook = xlsx.read(decodedText, { type: 'string', raw: true });
      } else {
        workbook = xlsx.read(bytes, { type: 'array', raw: true, codepage: 65001 });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convertimos a JSON usando la primera fila como cabecera y forzamos a plain object
      const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
      const jsonData = JSON.parse(JSON.stringify(rawData));

      if (!jsonData || jsonData.length === 0) {
        throw new Error('El archivo está vacío o no se pudo interpretar su cabecera.');
      }

      setStatus('uploading');

      const CHUNK_SIZE = 50;
      let totalImported = 0;
      let totalDuplicates = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < jsonData.length; i += CHUNK_SIZE) {
        const chunk = jsonData.slice(i, i + CHUNK_SIZE);
        setMessage(`Importando facturas ${i + 1} a ${Math.min(i + CHUNK_SIZE, jsonData.length)} de ${jsonData.length}...`);

        const res = await importInvoicesAction(chunk);
        if (!res.success) {
          throw new Error(res.error || 'Error desconocido en el servidor');
        }
        totalImported += res.results?.imported || 0;
        totalDuplicates += res.results?.duplicates || 0;
        if (res.results?.errors) {
          allErrors.push(...res.results.errors);
        }
      }

      setStatus('success');
      setResults({ total: jsonData.length, imported: totalImported, duplicates: totalDuplicates, errors: allErrors });
      setMessage(`¡Completado! Se han procesado ${jsonData.length} filas del fichero.`);
    } catch (err: any) {
      setStatus('error');
      setMessage(`Error procesando fichero: ${err.message}`);
    }
  };

  return (
    <div
      className="card transition-all flex flex-col items-center justify-center text-center relative overflow-hidden"
      style={{
        padding: '40px 32px',
        minHeight: '340px',
        borderStyle: 'dashed',
        borderWidth: '2px',
        borderColor: isDragging ? '#f43f5e' : 'var(--border-strong)',
        background: isDragging ? 'rgba(244, 63, 94, 0.05)' : 'var(--bg-surface)',
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
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleFileChange}
      />

      {status === 'idle' && (
        <>
          <div
            className="p-4 rounded-full mb-4 transition-transform hover:scale-105"
            style={{ background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.25)' }}
          >
            <UploadCloud className="w-8 h-8" style={{ color: '#f43f5e' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            1. Importador Automático de Facturas (CSV / Excel)
          </h3>
          <p className="max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
            Arrastra aquí el archivo CSV o Excel exportado desde Ingebau / Switching. El ERP creará los recibos y los vinculará automáticamente con Cliente, CUPS, Contrato y F1.
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <FileSpreadsheet size={14} />
            <span>Soporta codificación UTF-8 y ANSI (Windows-1252)</span>
          </div>
          <button type="button" className="btn-secondary mt-6">
            Seleccionar archivo CSV / Excel
          </button>
        </>
      )}

      {(status === 'parsing' || status === 'uploading') && (
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: '#f43f5e' }} />
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {status === 'parsing' ? 'Analizando archivo...' : 'Guardando y vinculando en BD...'}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center w-full">
          <div
            className="p-4 rounded-full mb-4"
            style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
          >
            <CheckCircle className="w-10 h-10" style={{ color: '#10b981' }} />
          </div>
          <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            ¡Importación Completada!
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{message}</p>

          {results && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl mb-5">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{results.total}</div>
                <div className="text-xs uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Leídas</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="text-2xl font-bold" style={{ color: '#10b981' }}>{results.imported}</div>
                <div className="text-xs uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Importadas</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{results.duplicates}</div>
                <div className="text-xs uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Duplicadas</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="text-2xl font-bold" style={{ color: results.errors.length > 0 ? '#f43f5e' : 'var(--text-muted)' }}>
                  {results.errors.length}
                </div>
                <div className="text-xs uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Incidencias</div>
              </div>
            </div>
          )}

          {results && results.errors.length > 0 && (
            <div
              className="w-full max-w-2xl text-left rounded-xl p-3 mb-5 max-h-40 overflow-y-auto"
              style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#fb7185' }}>
                Detalle de filas con incidencia ({results.errors.length}):
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
            Subir otro archivo
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center">
          <div
            className="p-4 rounded-full mb-4"
            style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)' }}
          >
            <AlertCircle className="w-10 h-10" style={{ color: '#f43f5e' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Error en la importación
          </h3>
          <p className="max-w-md text-sm mb-6" style={{ color: '#fb7185' }}>{message}</p>
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
