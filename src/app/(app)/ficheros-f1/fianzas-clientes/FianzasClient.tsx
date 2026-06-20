'use client';

import Topbar from '@/components/Topbar';

import React, { useState, useEffect } from 'react';
import { getFianzasAction } from '@/app/actions/f1Actions';
import { Search, Loader2, Landmark, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function FianzasClient() {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  
  const [cups, setCups] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchFiles = async (currentPage = 1) => {
    setLoading(true);
    try {
      const res = await getFianzasAction(currentPage, limit, cups || undefined);
      if (res.success && res.files) {
        setFiles(res.files);
        setTotalCount(res.totalCount || 0);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar fianzas');
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

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="min-h-screen relative outline-none flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Topbar 
        title="Fianzas a Devolver"
        subtitle="Listado de abonos y compensaciones identificados como &quot;OtrasFacturas&quot; en los ficheros F1."
        customActions={
          <div className="flex gap-3 items-center">
            <div className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-lg text-sm font-medium border border-blue-500/20">
              Total fianzas: {totalCount}
            </div>
          </div>
        }
      />
      <div className="p-6 w-full max-w-[1600px] mx-auto space-y-6 flex-1">
        <div className="mb-2">
          <Link href="/ficheros-f1" className="text-gray-400 hover:text-white flex items-center gap-2 text-sm transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Volver al listado general
          </Link>
        </div>

        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl shadow-sm border border-[var(--border)]">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-gray-400">Filtrar por CUPS</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Buscar por CUPS..." 
                  value={cups} 
                  onChange={(e) => setCups(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 font-medium min-w-[140px] px-4 py-2 rounded-lg transition-colors text-sm"
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
                  <th className="px-4 py-3 font-medium">Titular (Cliente)</th>
                  <th className="px-4 py-3 font-medium">DNI/CIF</th>
                  <th className="px-4 py-3 font-medium">Contrato</th>
                  <th className="px-4 py-3 font-medium">CUPS</th>
                  <th className="px-4 py-3 font-medium text-center">Tipo</th>
                  <th className="px-4 py-3 font-medium text-right">Importe</th>
                  <th className="px-4 py-3 font-medium text-center">XML</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-gray-300">
                {loading && files.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-400" />
                      Cargando fianzas...
                    </td>
                  </tr>
                ) : files.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No se han encontrado devoluciones de fianzas o compensaciones.
                    </td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr key={file.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="px-4 py-3">{file.fechaEmision ? format(new Date(file.fechaEmision), 'dd/MM/yyyy') : '-'}</td>
                      <td className="px-4 py-3 font-medium text-gray-200">
                        {file.client?.businessName || (file.client?.firstName ? `${file.client.firstName} ${file.client.lastName}` : '-')}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{file.client?.vatNumber || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--lime)]">{file.contract?.contractCode || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{file.supplyPoint?.cups || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {file.motivoFacturacion === '06' || file.motivoFacturacion === '6' ? 'Fianza' : (file.motivoFacturacion === '04' || file.motivoFacturacion === '4' ? 'Derechos (Actuación/Acceso)' : 'Abono/Otros')}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${file.saldoFactura < 0 ? 'text-green-400' : 'text-white'}`}>
                        {file.saldoFactura != null ? `${file.saldoFactura.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}
                      </td>
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
