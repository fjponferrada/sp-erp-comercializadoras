'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  Search,
  Loader2,
  ArrowLeft,
  FileSpreadsheet,
  Eye,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import { getFianzasAction } from '@/app/actions/f1Actions';
import F1DetailModal from '../F1DetailModal';

interface FianzasClientProps {
  activeBrandId?: string | null;
}

function fmtIsoDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtEur(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '-';
  return `${val.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

export default function FianzasClient({ activeBrandId }: FianzasClientProps) {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [sumImporte, setSumImporte] = useState(0);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [motivoFilter, setMotivoFilter] = useState<'ALL' | 'FIANZA' | 'DERECHOS' | 'OTROS'>('ALL');

  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    motivoFilter: 'ALL' as 'ALL' | 'FIANZA' | 'DERECHOS' | 'OTROS',
  });

  // Regla 3: 100 registros por defecto
  const [page, setPage] = useState(1);
  const limit = 100;

  const fetchFiles = useCallback(
    async (targetPage: number, f = appliedFilters) => {
      setLoading(true);
      try {
        const res = await getFianzasAction(
          targetPage,
          limit,
          f.search || undefined,
          f.dateFrom || undefined,
          f.dateTo || undefined,
          f.motivoFilter
        );
        if (res.success && res.files) {
          setFiles(res.files);
          setTotalCount(res.totalCount || 0);
          setSumImporte(res.sumImporte || 0);
        } else if (res.error) {
          toast.error(res.error);
        }
      } catch (e) {
        console.error(e);
        toast.error('Error al cargar fianzas y otras facturas');
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters]
  );

  useEffect(() => {
    fetchFiles(page, appliedFilters);
  }, [page, appliedFilters, activeBrandId, fetchFiles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters({
      search: search.trim(),
      dateFrom,
      dateTo,
      motivoFilter,
    });
  };

  const handleReset = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setMotivoFilter('ALL');
    setPage(1);
    setAppliedFilters({
      search: '',
      dateFrom: '',
      dateTo: '',
      motivoFilter: 'ALL',
    });
  };

  const handleExportExcel = async () => {
    setExporting(true);
    const toastId = toast.loading('Exportando listado de fianzas a Excel...');
    try {
      const res = await getFianzasAction(
        1,
        0,
        appliedFilters.search || undefined,
        appliedFilters.dateFrom || undefined,
        appliedFilters.dateTo || undefined,
        appliedFilters.motivoFilter
      );
      if (!res.success || !res.files) {
        toast.error(res.error || 'Error al exportar', { id: toastId });
        return;
      }

      const rows = res.files.map((f: any) => ({
        'F. Emisión': fmtIsoDate(f.fechaEmisionIso),
        'Factura Nº': f.numeroFactura || '',
        Titular: f.client?.displayName || '',
        'NIF/CIF': f.client?.vatNumber || '',
        Contrato: f.contract?.contractCode || '',
        CUPS: f.cups || '',
        Distribuidora: f.distributor?.name || '',
        'Motivo CNMC': f.extracted?.motivoFacturacionLabel || f.motivoFacturacion || '',
        'Base Imponible (€)': f.baseImponible ?? 0,
        'Importe Total (€)': f.saldoFactura ?? 0,
        Comentarios: f.extracted?.comentarios || '',
        'URL XML': f.xmlUrl || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Fianzas_OtrasFacturas');
      XLSX.writeFile(wb, `Fianzas_OtrasFacturas_F1_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Exportados ${rows.length} registros a Excel`, { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('Error al generar Excel', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div
      className="min-h-screen relative outline-none flex flex-col"
      style={{ background: 'var(--bg-base)' }}
    >
      <Topbar
        title="Fianzas y Otras Facturas (F1)"
        subtitle='Listado de depósitos de garantía, devoluciones de fianzas y derechos ("OtrasFacturas") recibidos de distribuidora.'
        customActions={
          <div className="flex gap-2.5 items-center">
            <button
              type="button"
              disabled={exporting || totalCount === 0}
              onClick={handleExportExcel}
              className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              Exportar Excel
            </button>
            <div className="bg-blue-500/10 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-500/20">
              Registros: {totalCount} · Neto: {fmtEur(sumImporte)}
            </div>
          </div>
        }
      />

      <div className="px-4 sm:px-6 py-5 w-full space-y-4 flex-1 flex flex-col min-w-0">
        <div>
          <Link
            href="/ficheros-f1"
            className="text-gray-400 hover:text-white inline-flex items-center gap-2 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al listado general de Facturas F1
          </Link>
        </div>

        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl shadow-xs border border-[var(--border)]">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar por CUPS, Nº Factura, Contrato, NIF/CIF o Titular..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-gray-200 focus:border-blue-400 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 font-semibold px-5 py-2 rounded-lg transition-colors text-sm cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Consultar
                </button>
                {(appliedFilters.search ||
                  appliedFilters.dateFrom ||
                  appliedFilters.dateTo ||
                  appliedFilters.motivoFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center justify-center px-3 py-2 bg-[var(--bg-base)] text-gray-300 border border-[var(--border)] rounded-lg text-sm hover:bg-white/5 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">Emisión Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs text-gray-200 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">Emisión Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs text-gray-200 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">Concepto / Motivo</label>
                <select
                  value={motivoFilter}
                  onChange={(e) => setMotivoFilter(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs text-gray-200 outline-none"
                >
                  <option value="ALL">Todos</option>
                  <option value="FIANZA">Fianzas / Depósitos de garantía (04 / 06)</option>
                  <option value="DERECHOS">Derechos / Verificaciones (01 / 02)</option>
                  <option value="OTROS">Otros conceptos repercutibles</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        <div className="bg-[var(--bg-elevated)] rounded-xl shadow-xs border border-[var(--border)] overflow-hidden flex flex-col flex-1 min-h-[420px]">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="text-[11px] text-gray-400 uppercase bg-[rgba(255,255,255,0.02)] sticky top-0 z-10 border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 py-3 font-semibold">F. Emisión</th>
                  <th className="px-3 py-3 font-semibold">Factura Nº</th>
                  <th className="px-3 py-3 font-semibold">Titular / NIF</th>
                  <th className="px-3 py-3 font-semibold">Contrato</th>
                  <th className="px-3 py-3 font-semibold">CUPS / Distribuidora</th>
                  <th className="px-3 py-3 font-semibold">Concepto / Observaciones</th>
                  <th className="px-3 py-3 font-semibold text-right">Base Imp.</th>
                  <th className="px-3 py-3 font-semibold text-right">Importe Total</th>
                  <th className="px-3 py-3 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-gray-300">
                {loading && files.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-gray-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-400" />
                      Cargando fianzas...
                    </td>
                  </tr>
                ) : files.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-gray-400">
                      No se han encontrado devoluciones de fianzas o compensaciones con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className="hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2.5 font-mono">{fmtIsoDate(file.fechaEmisionIso)}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-[var(--lime)]">
                        {file.numeroFactura || '-'}
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col max-w-[210px]">
                          {file.client?.id ? (
                            <Link
                              href={`/clientes/${file.client.id}`}
                              className="text-gray-200 hover:text-[var(--lime)] hover:underline truncate font-medium"
                            >
                              {file.client.displayName || '-'}
                            </Link>
                          ) : (
                            <span>-</span>
                          )}
                          <span className="text-[10px] font-mono text-gray-500">
                            {file.client?.vatNumber || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono" onClick={(e) => e.stopPropagation()}>
                        {file.contract?.id ? (
                          <Link
                            href={`/contratos/${file.contract.id}`}
                            className="text-[var(--lime)] hover:underline"
                          >
                            {file.contract.contractCode}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col">
                          {file.supplyPointId ? (
                            <Link
                              href={`/puntos-suministro/${file.supplyPointId}`}
                              className="font-mono text-gray-200 hover:text-[var(--lime)] hover:underline"
                            >
                              {file.cups || '-'}
                            </Link>
                          ) : (
                            <span className="font-mono">{file.cups || '-'}</span>
                          )}
                          <span className="text-[10px] text-gray-500">
                            {file.distributor?.shortName || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col max-w-[240px]">
                          <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            {file.extracted?.motivoFacturacionLabel || 'Concepto Repercutible'}
                          </span>
                          {file.extracted?.comentarios && (
                            <span
                              className="text-[10px] text-gray-500 truncate mt-0.5"
                              title={file.extracted.comentarios}
                            >
                              {file.extracted.comentarios}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono ${
                          (file.baseImponible || 0) < 0 ? 'text-green-400' : 'text-gray-200'
                        }`}
                      >
                        {fmtEur(file.baseImponible)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-semibold ${
                          (file.saldoFactura || 0) < 0 ? 'text-green-400' : 'text-white'
                        }`}
                      >
                        {fmtEur(file.saldoFactura)}
                      </td>
                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedFile(file)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {file.xmlUrl && (
                            <a
                              href={file.xmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              title="Descargar XML"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between bg-[rgba(255,255,255,0.01)] text-xs">
              <span className="text-gray-400">
                Página {page} de {totalPages} ({totalCount} registros)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-gray-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-gray-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <F1DetailModal file={selectedFile} onClose={() => setSelectedFile(null)} />
    </div>
  );
}
