'use client';

import Topbar from '@/components/Topbar';

import React, { useState, useEffect } from 'react';
import { getPaginatedF1FilesAction, getPendingF1EnergyAction } from '@/app/actions/f1Actions';
import { Search, Loader2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function FicherosF1Client() {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingMWh, setPendingMWh] = useState<number | null>(null);
  
  // Filtros
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cups, setCups] = useState('');
  const [billedStatus, setBilledStatus] = useState<'ALL' | 'BILLED' | 'PENDING'>('ALL');

  
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
        cups || undefined,
        billedStatus
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

  const fetchPendingEnergy = async () => {
    try {
      const res = await getPendingF1EnergyAction();
      if (res.success && res.totalMWh != null) {
        setPendingMWh(res.totalMWh);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFiles(page);
  }, [page]);

  useEffect(() => {
    fetchPendingEnergy();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchFiles(1);
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="min-h-screen relative outline-none flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Topbar 
        title="Listado de Facturas F1"
        subtitle="Revisa y filtra las facturas F1 importadas en el sistema."
        customActions={
          <div className="flex gap-3 items-center">
            {pendingMWh !== null && (
              <div className="bg-yellow-500/10 text-yellow-400 px-4 py-2 rounded-lg text-sm font-medium border border-yellow-500/20 flex items-center gap-2" title="Energía total de los F1 que aún no tienen factura vinculada">
                <FileText className="w-4 h-4" />
                Pendiente facturar: {pendingMWh.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWh
              </div>
            )}
            <a href="/ficheros-f1/fianzas-clientes" className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-4 py-2 rounded-lg text-sm font-medium border border-blue-500/30 transition-colors flex items-center gap-2">
              Ver Fianzas a Devolver
            </a>
            <div className="bg-[rgba(222,255,154,0.1)] text-[var(--lime)] px-4 py-2 rounded-lg text-sm font-medium border border-[rgba(222,255,154,0.2)]">
              Total registros: {totalCount}
            </div>
          </div>
        }
      />

      <div className="p-6 w-full max-w-[1600px] mx-auto space-y-6 flex-1">
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
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400">Estado Facturación</label>
              <select 
                value={billedStatus}
                onChange={(e) => setBilledStatus(e.target.value as any)}
                className="w-[160px] px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-gray-200 focus:border-[var(--lime)] focus:ring-1 focus:ring-[var(--lime)] outline-none"
              >
                <option value="ALL">Todos</option>
                <option value="BILLED">Facturados</option>
                <option value="PENDING">Pendientes</option>
              </select>
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
                      <td className="px-4 py-3 font-mono text-xs text-[var(--lime)]">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <span>{file.numeroFactura || '-'}</span>
                            {file.invoices && file.invoices.length > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                Facturado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                Pendiente
                              </span>
                            )}
                          </div>
                          {file.tipoDocumento === 'OtrasFacturas' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {file.motivoFacturacion === '06' || file.motivoFacturacion === '6' ? 'Fianza' : (file.motivoFacturacion === '04' || file.motivoFacturacion === '4' ? 'Fianza / Derechos' : 'Abono/Otros')}
                            </span>
                          )}
                        </div>
                      </td>
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
