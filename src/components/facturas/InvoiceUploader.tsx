'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as xlsx from 'xlsx';
import { importInvoicesAction } from '@/app/actions/invoiceActions';

export default function InvoiceUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<any>(null);
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
    }
  };

  const processFile = async (file: File) => {
    setStatus('parsing');
    setMessage('Leyendo archivo...');
    
    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          // Leemos el workbook (soporta CSV y XLSX)
          // Usamos raw: true para que si es un CSV, no intente parsear las fechas/números con locale US
          const workbook = xlsx.read(data, { type: 'binary', raw: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convertimos a JSON usando la primera fila como cabecera y forzamos a plain object
          const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
          const jsonData = JSON.parse(JSON.stringify(rawData));
          
          if (!jsonData || jsonData.length === 0) {
            throw new Error("El archivo está vacío o no se pudo parsear correctamente.");
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
              throw new Error(res.error || "Error desconocido en el servidor");
            }
            totalImported += res.results?.imported || 0;
            totalDuplicates += res.results?.duplicates || 0;
            if (res.results?.errors) {
              allErrors.push(...res.results.errors);
            }
          }
          
          setStatus('success');
          setResults({ total: jsonData.length, imported: totalImported, duplicates: totalDuplicates, errors: allErrors });
          setMessage(`¡Completado! Se han procesado ${jsonData.length} facturas.`);
        } catch (err: any) {
          setStatus('error');
          setMessage(`Error procesando Excel: ${err.message}`);
        }
      };

      reader.onerror = () => {
        setStatus('error');
        setMessage("Error al leer el archivo desde el navegador.");
      };

      // Si es CSV, a veces es mejor leerlo como texto, pero XLSX soporta binary string para ambos.
      reader.readAsBinaryString(file);
      
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message);
    }
  };

  return (
    <div 
      className={`bg-slate-800/30 border-2 border-dashed rounded-2xl p-10 transition-colors flex flex-col items-center justify-center text-center cursor-pointer relative overflow-hidden ${
        isDragging ? 'border-rose-500 bg-rose-500/5' : 'border-slate-700 hover:border-rose-500/50'
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
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        onChange={handleFileChange}
      />

      {status === 'idle' && (
        <>
          <div className="bg-slate-900 p-4 rounded-full mb-4 transform transition-transform hover:scale-110">
            <UploadCloud className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Importador Automático de Facturas</h3>
          <p className="text-slate-400 max-w-md text-sm">
            Arrastra aquí el archivo CSV/Excel exportado desde el software de Switching. 
            El CRM creará automáticamente los recibos y los vinculará.
          </p>
          <button className="mt-6 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-medium transition-colors text-sm">
            Seleccionar archivo
          </button>
        </>
      )}

      {(status === 'parsing' || status === 'uploading') && (
        <div className="flex flex-col items-center animate-pulse">
          <Loader2 className="w-12 h-12 text-rose-500 animate-spin mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">{status === 'parsing' ? 'Analizando archivo...' : 'Guardando en BD...'}</h3>
          <p className="text-slate-400">{message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center">
          <div className="bg-emerald-500/20 p-4 rounded-full mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">¡Importación Exitosa!</h3>
          <p className="text-slate-400 mb-6">{message}</p>
          
          {results && (
            <div className="grid grid-cols-4 gap-4 w-full max-w-2xl mb-6">
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-2xl font-bold text-white">{results.total}</div>
                <div className="text-xs text-slate-500 uppercase">Leídas</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-2xl font-bold text-emerald-400">{results.imported}</div>
                <div className="text-xs text-slate-500 uppercase">Importadas</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-2xl font-bold text-amber-400">{results.duplicates}</div>
                <div className="text-xs text-slate-500 uppercase">Omitidas</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-2xl font-bold text-rose-400">{results.errors.length}</div>
                <div className="text-xs text-slate-500 uppercase">Errores</div>
              </div>
            </div>
          )}
          
          <button 
            onClick={(e) => { e.stopPropagation(); setStatus('idle'); setResults(null); }}
            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-xl font-medium text-sm"
          >
            Subir otro archivo
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center">
          <div className="bg-rose-500/20 p-4 rounded-full mb-4">
            <AlertCircle className="w-10 h-10 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Error en la importación</h3>
          <p className="text-rose-400 max-w-md text-sm mb-6">{message}</p>
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
