'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getPaginatedF1FilesAction } from '@/app/actions/f1Actions';
import { ingestF1XmlAction } from '@/app/actions/f1Ingest';
import { Search, Loader2, UploadCloud, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

export default function FicherosF1Client() {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  
  // Filtros
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cups, setCups] = useState('');
  
  // Paginación
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchFiles = async (currentPage = 1) => {
    setLoading(true);
    try {
      const res = await getPaginatedF1FilesAction(
        currentPage,
        limit,
        dateFrom || undefined,
        dateTo || undefined,
        cups || undefined
      );
      if (res.success && res.files) {
        setFiles(res.files);
        setTotalCount(res.totalCount || 0);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar ficheros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(page);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchFiles(1);
  };

  const processFiles = async (acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    const toastId = toast.loading(`Procesando 0/${acceptedFiles.length} archivos F1...`);

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await ingestF1XmlAction(formData);
      if (result.success) {
        successCount++;
        toast.success(`OK: ${file.name}`, { id: toastId });
      } else {
        errorCount++;
        const errMsg = 'error' in result ? result.error : 'Error desconocido';
        toast.error(`Error: ${file.name} - ${errMsg}`, { id: toastId });
      }
      toast.loading(`Procesando ${i + 1}/${acceptedFiles.length} archivos F1...`, { id: toastId });
    }

    setUploading(false);
    toast.success(`Subida completada: ${successCount} correctos, ${errorCount} errores`, { id: toastId });
    fetchFiles(1);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    processFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/xml': ['.xml'] },
    noClick: true,
    noKeyboard: true
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div {...getRootProps()} className="min-h-screen relative outline-none" style={{ background: 'var(--bg-base)' }}>
      {isDragActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg-base)] bg-opacity-90 backdrop-blur-sm border-2 border-dashed border-[var(--lime)] m-4 rounded-xl">
          <UploadCloud className="w-20 h-20 text-[var(--lime)] mb-4 animate-bounce" />
          <h2 className="text-3xl font-bold text-white">Suelta los archivos F1 aquí</h2>
          <p className="text-gray-400 mt-2">El motor de facturación los procesará automáticamente</p>
        </div>
      )}

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <UploadCloud className="h-6 w-6 text-[var(--lime)]" />
              Ficheros F1 (Facturación)
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Sube y revisa los ficheros XML de facturación ATR (F1).
            </p>
          </div>
          
          <div className="flex gap-3 items-center">
            <input 
              type="file" 
              multiple 
              accept=".xml" 
              ref={fileInputRef} 
              onChange={(e) => {
                if (e.target.files) {
                  processFiles(Array.from(e.target.files));
                  e.target.value = '';
                }
              }} 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-gray-200 px-4 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors text-sm font-medium"
            >
              {uploading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : 'Subir XMLs F1'}
            </button>
            <div className="bg-[rgba(222,255,154,0.1)] text-[var(--lime)] px-4 py-2 rounded-lg text-sm font-medium border border-[rgba(222,255,154,0.2)]">
              Total registros: {totalCount}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl shadow-sm border border-[var(--border)]">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400">Fecha Inicio</label>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
                className="w-[160px] px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-gray-200 focus:border-[var(--lime)] focus:ring-1 focus:ring-[var(--lime)] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400">Fecha Fin</label>
              <input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)} 
                className="w-[160px] px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-gray-200 focus:border-[var(--lime)] focus:ring-1 focus:ring-[var(--lime)] outline-none"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-gray-400">CUPS</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Buscar por CUPS..." 
                  value={cups} 
                  onChange={(e) => setCups(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-gray-200 focus:border-[var(--lime)] focus:ring-1 focus:ring-[var(--lime)] outline-none"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex items-center justify-center bg-[var(--lime)] hover:bg-opacity-90 text-black font-semibold min-w-[140px] px-4 py-2 rounded-lg transition-colors text-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Consultar
            </button>
          </form>
        </div>

        <div className="bg-[var(--bg-elevated)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden flex flex-col h-[calc(100vh-320px)]">
          <div className="overflow-x-auto flex-1 no-scrollbar">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-gray-400 uppercase bg-[rgba(255,255,255,0.02)] sticky top-0 z-10 border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 font-medium">F. Emisión</th>
                  <th className="px-4 py-3 font-medium">Factura Nº</th>
                  <th className="px-4 py-3 font-medium">CUPS</th>
                  <th className="px-4 py-3 font-medium">Contrato</th>
                  <th className="px-4 py-3 font-medium">Periodo</th>
                  <th className="px-4 py-3 font-medium text-right">Base Imponible</th>
                  <th className="px-4 py-3 font-medium text-right">Peajes</th>
                  <th className="px-4 py-3 font-medium text-right">Cargos</th>
                  <th className="px-4 py-3 font-medium text-right">Total Factura</th>
                  <th className="px-4 py-3 font-medium text-center">XML</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-gray-300">
                {loading && files.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[var(--lime)]" />
                      Cargando ficheros F1...
                    </td>
                  </tr>
                ) : files.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      No se han encontrado ficheros F1. Arrastra archivos XML aquí para procesarlos.
                    </td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr key={file.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-4 py-3">{file.fechaEmision ? format(new Date(file.fechaEmision), 'dd/MM/yyyy') : '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--lime)]">{file.numeroFactura || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{file.supplyPoint?.cups || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{file.contract?.contractCode || '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {file.fechaInicio && file.fechaFin 
                          ? `${format(new Date(file.fechaInicio), 'dd/MM/yy')} - ${format(new Date(file.fechaFin), 'dd/MM/yy')}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">{file.baseImponible != null ? `${file.baseImponible.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}</td>
                      <td className="px-4 py-3 text-right">{file.totalPeajes != null ? `${file.totalPeajes.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}</td>
                      <td className="px-4 py-3 text-right">{file.totalCargos != null ? `${file.totalCargos.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">{file.saldoFactura != null ? `${file.saldoFactura.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {file.xmlUrl ? (
                          <a href={file.xmlUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-xs">Descargar</a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-[var(--border)] flex items-center justify-between bg-[rgba(255,255,255,0.01)]">
              <span className="text-sm text-gray-500">
                Mostrando página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-1 bg-[var(--bg-base)] border border-[var(--border)] rounded text-sm text-gray-300 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="px-3 py-1 bg-[var(--bg-base)] border border-[var(--border)] rounded text-sm text-gray-300 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
