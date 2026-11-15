'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  Search,
  Loader2,
  FileSpreadsheet,
  Upload,
  Eye,
  Download,
  RotateCcw,
  Landmark,
  Zap,
  Receipt,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import {
  getPaginatedF1FilesAction,
  getF1SummaryKpisAction,
  getF1FilterOptionsAction,
  exportF1FilesAction,
  type F1BilledStatusFilter,
} from '@/app/actions/f1Actions';
import { ingestF1XmlAction } from '@/app/actions/f1Ingest';
import F1DetailModal from './F1DetailModal';

interface FicherosF1ClientProps {
  activeBrandId?: string | null;
}

interface SummaryKpis {
  totalCount: number;
  billedCount: number;
  pendingCount: number;
  totalMWh: number;
  sumBaseImponible: number;
  sumTotalPeajes: number;
  sumTotalCargos: number;
  sumTotalFactura: number;
}

function fmtIsoShort(iso: string | null | undefined, withCentury = false): string {
  if (!iso) return '-';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  const yr = withCentury ? parts[0] : parts[0].slice(2);
  return `${parts[2]}/${parts[1]}/${yr}`;
}

function fmtEur(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '-';
  return `${val.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function getTipoBadgeStyle(tipoDocumento: string, tipoFactura: string) {
  if (tipoDocumento === 'OtrasFacturas') {
    return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  }
  switch (tipoFactura) {
    case 'N':
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    case 'R':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case 'AR':
    case 'S':
    case 'A':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    case 'G':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    case 'C':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    default:
      return 'bg-white/10 text-gray-300 border-white/15';
  }
}

export default function FicherosF1Client({ activeBrandId }: FicherosF1ClientProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [files, setFiles] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<SummaryKpis | null>(null);
  const [distributorOptions, setDistributorOptions] = useState<Array<{ code: string; label: string }>>([]);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);

  // Filtros en edición
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [billedStatus, setBilledStatus] = useState<F1BilledStatusFilter>('ALL');
  const [tipoFactura, setTipoFactura] = useState('ALL');
  const [distributorCode, setDistributorCode] = useState('ALL');

  // Filtros aplicados actualmente
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: '',
    dateTo: '',
    search: '',
    billedStatus: 'ALL' as F1BilledStatusFilter,
    tipoFactura: 'ALL',
    distributorCode: 'ALL',
  });

  // Paginación estándar ERP: 100 registros por página (Regla 3)
  const [page, setPage] = useState(1);
  const limit = 100;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = useCallback(
    async (targetPage: number, f = appliedFilters) => {
      setLoading(true);
      try {
        const res = await getPaginatedF1FilesAction(
          targetPage,
          limit,
          f.dateFrom || undefined,
          f.dateTo || undefined,
          f.search || undefined,
          f.billedStatus,
          f.tipoFactura,
          f.distributorCode
        );
        if (res.success && res.files) {
          setFiles(res.files);
          setTotalCount(res.totalCount || 0);
        } else if (res.error) {
          toast.error(res.error);
        }
      } catch (e) {
        console.error(e);
        toast.error('Error al cargar ficheros F1');
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters]
  );

  const loadKpis = useCallback(
    async (f = appliedFilters) => {
      try {
        const res = await getF1SummaryKpisAction(
          f.dateFrom || undefined,
          f.dateTo || undefined,
          f.search || undefined,
          f.billedStatus,
          f.tipoFactura,
          f.distributorCode
        );
        if (res.success) {
          setKpis({
            totalCount: res.totalCount || 0,
            billedCount: res.billedCount || 0,
            pendingCount: res.pendingCount || 0,
            totalMWh: res.totalMWh || 0,
            sumBaseImponible: res.sumBaseImponible || 0,
            sumTotalPeajes: res.sumTotalPeajes || 0,
            sumTotalCargos: res.sumTotalCargos || 0,
            sumTotalFactura: res.sumTotalFactura || 0,
          });
        }
      } catch (e) {
        console.error(e);
      }
    },
    [appliedFilters]
  );

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await getF1FilterOptionsAction();
      if (res.success && res.distributors) {
        setDistributorOptions(res.distributors);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Recargar cuando cambia la página o los filtros aplicados
  useEffect(() => {
    loadFiles(page, appliedFilters);
  }, [page, appliedFilters, activeBrandId, loadFiles]);

  // Recargar KPIs cuando cambian los filtros aplicados o la marca activa
  useEffect(() => {
    loadKpis(appliedFilters);
  }, [appliedFilters, activeBrandId, loadKpis]);

  // Cargar opciones dinámicas de distribuidoras
  useEffect(() => {
    loadFilterOptions();
  }, [activeBrandId, loadFilterOptions]);

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const next = {
      dateFrom,
      dateTo,
      search: search.trim(),
      billedStatus,
      tipoFactura,
      distributorCode,
    };
    setPage(1);
    setAppliedFilters(next);
  };

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setBilledStatus('ALL');
    setTipoFactura('ALL');
    setDistributorCode('ALL');
    setPage(1);
    setAppliedFilters({
      dateFrom: '',
      dateTo: '',
      search: '',
      billedStatus: 'ALL',
      tipoFactura: 'ALL',
      distributorCode: 'ALL',
    });
  };

  const hasActiveFilters =
    Boolean(appliedFilters.dateFrom) ||
    Boolean(appliedFilters.dateTo) ||
    Boolean(appliedFilters.search) ||
    appliedFilters.billedStatus !== 'ALL' ||
    appliedFilters.tipoFactura !== 'ALL' ||
    appliedFilters.distributorCode !== 'ALL';

  const processUploadFiles = async (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((f) =>
      /\.(xml|zip|\d+)$/i.test(f.name)
    );
    if (validFiles.length === 0) {
      toast.error('Selecciona archivos .xml o .zip válidos de proceso F1');
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Procesando ${validFiles.length} archivo(s) F1...`);
    try {
      const formData = new FormData();
      for (const f of validFiles) {
        formData.append('files', f);
      }
      const res = await ingestF1XmlAction(formData);
      if (res.success) {
        const count = res.count || 0;
        if (count > 0) {
          toast.success(`Se importaron ${count} factura(s) F1 nuevas`, { id: toastId });
        } else {
          toast.success('Archivos revisados (todas las facturas F1 ya existían en BD)', {
            id: toastId,
          });
        }
        if (res.error) {
          toast.error(`Avisos: ${res.error}`, { duration: 6000 });
        }
        await Promise.all([loadFiles(page, appliedFilters), loadKpis(appliedFilters), loadFilterOptions()]);
      } else {
        toast.error(res.error || 'Error al procesar los archivos XML/ZIP', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error inesperado al subir F1', { id: toastId });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    const toastId = toast.loading('Generando exportación Excel completa...');
    try {
      const res = await exportF1FilesAction(
        appliedFilters.dateFrom || undefined,
        appliedFilters.dateTo || undefined,
        appliedFilters.search || undefined,
        appliedFilters.billedStatus,
        appliedFilters.tipoFactura,
        appliedFilters.distributorCode
      );
      if (!res.success || !res.rows) {
        toast.error(res.error || 'No se pudo exportar', { id: toastId });
        return;
      }

      const excelData = res.rows.map((r: any) => ({
        'F. Emisión': fmtIsoShort(r.fechaEmision, true),
        'Factura Nº (Código Fiscal)': r.numeroFactura,
        'Documento CNMC': r.tipoDocumento,
        'Tipo Factura': r.tipoFactura,
        'Descripción Tipo': r.tipoFacturaDesc,
        'Motivo Facturación': r.motivoFacturacion,
        'Estado Facturación': r.estadoFacturacion,
        CUPS: r.cups,
        Distribuidora: r.distribuidora,
        'Tarifa ATR': r.tarifaAtr,
        Contrato: r.contrato,
        Titular: r.titular,
        'NIF/CIF': r.nifCif,
        'Periodo Desde': fmtIsoShort(r.periodoInicio, true),
        'Periodo Hasta': fmtIsoShort(r.periodoFin, true),
        Días: r.dias,
        'Energía Activa (kWh)': r.energiaKwh,
        'Peajes Potencia (€)': r.peajesPotenciaEur,
        'Peajes Energía (€)': r.peajesEnergiaEur,
        'Excesos Potencia (€)': r.excesosPotenciaEur,
        'Reactiva (€)': r.reactivaEur,
        'Total Peajes (€)': r.totalPeajesEur,
        'Total Cargos (€)': r.totalCargosEur,
        'Alquiler Medida (€)': r.alquilerEquipoEur,
        'Impuesto Eléctrico (€)': r.impuestoElectricoEur,
        'Conceptos Repercutibles (€)': r.conceptosRepercutiblesEur,
        'Base Imponible (€)': r.baseImponibleEur,
        'IVA / IGIC (€)': r.ivaEur,
        'Total Factura F1 (€)': r.totalFacturaEur,
        'Saldo Neto XML (€)': r.saldoNetoXmlEur,
        'Factura Rectificada': r.facturaRectificada,
        'URL XML': r.xmlUrl,
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Facturas F1');
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Facturas_F1_${stamp}.xlsx`);
      toast.success(`Exportadas ${excelData.length} facturas F1 a Excel`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Error al generar archivo Excel', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(totalCount, page * limit);

  return (
    <div
      className="min-h-screen relative outline-none flex flex-col"
      style={{ background: 'var(--bg-base)' }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          processUploadFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-6 pointer-events-none">
          <div className="border-2 border-dashed border-[var(--lime)] bg-[var(--bg-elevated)] rounded-2xl p-10 text-center max-w-md shadow-2xl">
            <Upload className="w-12 h-12 text-[var(--lime)] mx-auto mb-3" />
            <div className="text-lg font-bold text-white">Suelta tus ficheros F1 aquí</div>
            <p className="text-xs text-gray-400 mt-1">
              Se admiten archivos XML individuales o comprimidos .ZIP del proceso F1 CNMC.
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".xml,.zip"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processUploadFiles(e.target.files);
          }
        }}
      />

      <Topbar
        title="Listado de Facturas F1"
        subtitle="Auditoría económica, consumos ATR y estado de refacturación de ficheros F1 de distribuidora."
        customActions={
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="bg-[var(--lime)] hover:opacity-90 text-black font-semibold px-3 py-1.5 rounded-lg text-xs transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Subir archivos F1 (.xml o .zip)"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Importar XML/ZIP</span>
            </button>

            <button
              type="button"
              disabled={exporting || totalCount === 0}
              onClick={handleExportExcel}
              className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Exportar el 100% de los registros filtrados a Excel (.xlsx)"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Excel</span>
            </button>

            <Link
              href="/ficheros-f1/fianzas-clientes"
              className="bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-500/30 transition-colors flex items-center gap-1.5"
            >
              <Landmark className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Fianzas y Otras</span>
            </Link>
          </div>
        }
      />

      <div className="px-4 sm:px-6 py-5 w-full space-y-4 flex-1 flex flex-col min-w-0">
        {/* KPI Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                Total Facturas F1
              </div>
              <div className="text-xl font-bold text-white mt-0.5">
                {(kpis?.totalCount ?? totalCount).toLocaleString('es-ES')}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                <span className="text-green-400">
                  {(kpis?.billedCount ?? 0).toLocaleString('es-ES')} facturadas
                </span>
                <span>·</span>
                <span className="text-yellow-400">
                  {(kpis?.pendingCount ?? 0).toLocaleString('es-ES')} pendientes
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[rgba(222,255,154,0.1)] text-[var(--lime)]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                Energía Pendiente Facturar
              </div>
              <div className="text-xl font-bold text-yellow-400 mt-0.5">
                {kpis
                  ? `${kpis.totalMWh.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} MWh`
                  : '...'}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                F1 sin factura de cliente asociada
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-yellow-500/10 text-yellow-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                Base Imponible F1 (Filtro)
              </div>
              <div className="text-xl font-bold text-white mt-0.5 truncate">
                {kpis ? fmtEur(kpis.sumBaseImponible) : '...'}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                Peajes: {kpis ? fmtEur(kpis.sumTotalPeajes) : '-'} · Cargos:{' '}
                {kpis ? fmtEur(kpis.sumTotalCargos) : '-'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                Total Facturas F1 (IVA incl.)
              </div>
              <div className="text-xl font-bold text-[var(--lime)] mt-0.5">
                {kpis ? fmtEur(kpis.sumTotalFactura) : '...'}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Suma neta de importes totales F1
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[rgba(222,255,154,0.1)] text-[var(--lime)]">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Structured Filter Bar (Regla 208) */}
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl shadow-xs border border-[var(--border)]">
          <form onSubmit={handleApplyFilters} className="space-y-3">
            {/* Row 1: Global Search + Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar por Nº Factura / Código Fiscal, CUPS, Contrato, NIF/CIF o Titular..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-gray-200 focus:border-[var(--lime)] focus:ring-1 focus:ring-[var(--lime)] outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-2.5 text-gray-500 hover:text-gray-300"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center bg-[var(--lime)] hover:opacity-90 text-black font-semibold px-5 py-2 rounded-lg transition-opacity text-sm cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Consultar
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="flex items-center justify-center px-3 py-2 bg-[var(--bg-base)] hover:bg-white/5 text-gray-300 border border-[var(--border)] rounded-lg text-sm transition-colors cursor-pointer"
                    title="Restablecer todos los filtros"
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Semantic Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">Emisión Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs text-gray-200 focus:border-[var(--lime)] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">Emisión Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs text-gray-200 focus:border-[var(--lime)] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">Estado Facturación</label>
                <select
                  value={billedStatus}
                  onChange={(e) => setBilledStatus(e.target.value as F1BilledStatusFilter)}
                  className="w-full px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs text-gray-200 focus:border-[var(--lime)] outline-none"
                >
                  <option value="ALL">Todos</option>
                  <option value="PENDING">Pendientes de facturar</option>
                  <option value="BILLED">Facturados al cliente</option>
                  <option value="INTERNAL_DRAFT">En borrador (Motor Interno)</option>
                  <option value="INTERNAL_EMITTED">Emitidos (Motor Interno)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">Tipo Factura CNMC</label>
                <select
                  value={tipoFactura}
                  onChange={(e) => setTipoFactura(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs text-gray-200 focus:border-[var(--lime)] outline-none"
                >
                  <option value="ALL">Todos</option>
                  <option value="N">N · Normal</option>
                  <option value="R">R · Rectificadora</option>
                  <option value="AR">AR · Abono Rectificativo</option>
                  <option value="S">S · Sustitutiva / Abono</option>
                  <option value="A">A · Anuladora</option>
                  <option value="G">G · Regularizadora</option>
                  <option value="C">C · Complementaria</option>
                  <option value="OTRAS">OtrasFacturas (Fianzas / Derechos)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400">Distribuidora</label>
                <select
                  value={distributorCode}
                  onChange={(e) => setDistributorCode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs text-gray-200 focus:border-[var(--lime)] outline-none"
                >
                  <option value="ALL">Todas</option>
                  {distributorOptions.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </form>
        </div>

        {/* Table Container */}
        <div className="bg-[var(--bg-elevated)] rounded-xl shadow-xs border border-[var(--border)] overflow-hidden flex flex-col flex-1 min-h-[480px]">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="text-[11px] text-gray-400 uppercase bg-[rgba(255,255,255,0.02)] sticky top-0 z-10 border-b border-[var(--border)]">
                <tr>
                  <th className="px-3 py-3 font-semibold">F. Emisión</th>
                  <th className="px-3 py-3 font-semibold">Factura Nº / Estado</th>
                  <th className="px-2.5 py-3 font-semibold">Tipo</th>
                  <th className="px-3 py-3 font-semibold">CUPS / Distribuidora</th>
                  <th className="px-3 py-3 font-semibold">Titular / Contrato</th>
                  <th className="px-3 py-3 font-semibold">Periodo ATR</th>
                  <th className="px-3 py-3 font-semibold text-right">Energía</th>
                  <th className="px-3 py-3 font-semibold text-right">Base Imp.</th>
                  <th className="px-3 py-3 font-semibold text-right">Peajes</th>
                  <th className="px-3 py-3 font-semibold text-right">Cargos</th>
                  <th className="px-3 py-3 font-semibold text-right">Total Factura</th>
                  <th className="px-3 py-3 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-gray-300">
                {loading && files.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center text-gray-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[var(--lime)]" />
                      Cargando ficheros F1...
                    </td>
                  </tr>
                ) : files.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center text-gray-400">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                      <div>No se han encontrado ficheros F1 con los filtros actuales.</div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        También puedes arrastrar archivos .XML o .ZIP directamente sobre esta pantalla.
                      </div>
                    </td>
                  </tr>
                ) : (
                  files.map((file) => {
                    const ex = file.extracted || {};
                    const isBilled = file.invoices && file.invoices.length > 0;
                    const hasInternal = file.internalInvoices && file.internalInvoices.length > 0;
                    const totalVal = Number(file.saldoFactura ?? 0);

                    return (
                      <tr
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        className="hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer"
                      >
                        {/* Fecha Emisión */}
                        <td className="px-3 py-2.5 text-gray-300 font-mono">
                          {fmtIsoShort(file.fechaEmisionIso, true)}
                        </td>

                        {/* Factura Nº + Estado */}
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedFile(file)}
                                className="font-mono font-semibold text-[var(--lime)] hover:underline text-left cursor-pointer"
                              >
                                {file.numeroFactura || '-'}
                              </button>

                              {isBilled ? (
                                <Link
                                  href={`/facturas/${file.invoices[0].id}`}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25"
                                  title={`Factura emitida: ${file.invoices[0].invoiceNumber || ''}`}
                                >
                                  Facturado
                                </Link>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/25">
                                  Pendiente
                                </span>
                              )}

                              {hasInternal && (
                                <Link
                                  href={
                                    file.internalInvoices[0].status === 'EMITIDA' ||
                                    file.internalInvoices[0].status === 'ABONO'
                                      ? `/facturas-internas/${file.internalInvoices[0].id}`
                                      : `/facturacion/interna?q=${encodeURIComponent(
                                          file.numeroFactura || ''
                                        )}`
                                  }
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/20"
                                  title={`Motor Interno: ${file.internalInvoices[0].status}`}
                                >
                                  Int.
                                </Link>
                              )}
                            </div>

                            {ex.codigoRectificada && (
                              <span className="text-[10px] font-mono text-gray-500">
                                Rectifica: {ex.codigoRectificada}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tipo CNMC + Tarifa */}
                        <td className="px-2.5 py-2.5">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getTipoBadgeStyle(
                                file.tipoDocumento,
                                ex.tipoFactura
                              )}`}
                              title={
                                file.tipoDocumento === 'OtrasFacturas'
                                  ? ex.motivoFacturacionLabel || 'OtrasFacturas'
                                  : `${ex.tipoFactura} - ${ex.tipoFacturaLabel}`
                              }
                            >
                              {file.tipoDocumento === 'OtrasFacturas'
                                ? file.motivoFacturacion === '6' || file.motivoFacturacion === '06'
                                  ? 'Fianza Dev.'
                                  : file.motivoFacturacion === '4' || file.motivoFacturacion === '04'
                                    ? 'Fianza'
                                    : 'Otras'
                                : ex.tipoFactura || 'N'}
                            </span>
                            {ex.tarifaAtrLabel && (
                              <span className="text-[10px] text-gray-500 font-mono">
                                {ex.tarifaAtrLabel}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* CUPS + Distribuidora (Regla 75) */}
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
                              <span className="font-mono text-gray-300">{file.cups || '-'}</span>
                            )}
                            <span className="text-[10px] text-gray-500 truncate max-w-[185px]">
                              {file.distributor?.shortName || '-'}
                            </span>
                          </div>
                        </td>

                        {/* Titular + Contrato (Regla 75) */}
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col max-w-[190px]">
                            {file.client?.id ? (
                              <Link
                                href={`/clientes/${file.client.id}`}
                                className="text-gray-200 hover:text-[var(--lime)] hover:underline truncate font-medium"
                                title={file.client.displayName}
                              >
                                {file.client.displayName || file.client.vatNumber || '-'}
                              </Link>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}

                            {file.contract?.id ? (
                              <Link
                                href={`/contratos/${file.contract.id}`}
                                className="font-mono text-[11px] text-gray-400 hover:text-[var(--lime)] hover:underline truncate"
                              >
                                {file.contract.contractCode}
                              </Link>
                            ) : (
                              <span className="text-[11px] text-gray-600">Sin contrato</span>
                            )}
                          </div>
                        </td>

                        {/* Periodo ATR inclusivo (Regla 170) */}
                        <td className="px-3 py-2.5 text-gray-300 font-mono">
                          {file.fechaDesdeIso && file.fechaHastaIso ? (
                            <div className="flex flex-col">
                              <span>
                                {fmtIsoShort(file.fechaDesdeIso)} - {fmtIsoShort(file.fechaHastaIso)}
                              </span>
                              {file.numeroDias ? (
                                <span className="text-[10px] text-gray-500 font-sans">
                                  {file.numeroDias} días
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>

                        {/* Energía Activa kWh */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-300">
                          {file.tipoDocumento === 'OtrasFacturas'
                            ? '-'
                            : `${Number(file.totalEnergiaKwh || 0).toLocaleString('es-ES', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                              })} kWh`}
                        </td>

                        {/* Base Imponible */}
                        <td
                          className={`px-3 py-2.5 text-right font-mono ${
                            (file.baseImponible || 0) < 0 ? 'text-green-400' : 'text-gray-200'
                          }`}
                        >
                          {fmtEur(file.baseImponible)}
                        </td>

                        {/* Peajes */}
                        <td
                          className={`px-3 py-2.5 text-right font-mono ${
                            (file.totalPeajes || 0) < 0 ? 'text-green-400' : 'text-gray-300'
                          }`}
                        >
                          {fmtEur(file.totalPeajes)}
                        </td>

                        {/* Cargos */}
                        <td
                          className={`px-3 py-2.5 text-right font-mono ${
                            (file.totalCargos || 0) < 0 ? 'text-green-400' : 'text-gray-300'
                          }`}
                        >
                          {fmtEur(file.totalCargos)}
                        </td>

                        {/* Total Factura (+ Saldo Neto en R si difiere) */}
                        <td className="px-3 py-2.5 text-right font-mono">
                          <div
                            className={`font-semibold ${
                              totalVal < 0 ? 'text-green-400' : 'text-white'
                            }`}
                          >
                            {fmtEur(totalVal)}
                          </div>
                          {file.hasDistinctSaldo && file.saldoFacturaXml !== null && (
                            <div
                              className="text-[10px] text-amber-300/90"
                              title="Saldo neto a liquidar tras compensar factura rectificada"
                            >
                              Saldo: {fmtEur(file.saldoFacturaXml)}
                            </div>
                          )}
                        </td>

                        {/* Acciones */}
                        <td
                          className="px-3 py-2.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedFile(file)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[var(--lime)] hover:bg-white/5 transition-colors cursor-pointer"
                              title="Ver desglose detallado del XML"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {file.xmlUrl ? (
                              <a
                                href={file.xmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                                title="Descargar XML original"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer (Regla 3: 100 por página) */}
          <div className="px-4 py-3 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[rgba(255,255,255,0.01)] text-xs">
            <span className="text-gray-400">
              Mostrando <span className="text-white font-medium">{rangeStart}</span>–
              <span className="text-white font-medium">{rangeEnd}</span> de{' '}
              <span className="text-white font-medium">{totalCount.toLocaleString('es-ES')}</span>{' '}
              facturas F1 (Página {page} de {totalPages})
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page === 1 || loading}
                  className="p-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-gray-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  title="Primera página"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-gray-300 hover:text-white disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="px-3 py-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-gray-300 hover:text-white disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages || loading}
                  className="p-1.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-gray-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  title="Última página"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Desglose F1 */}
      <F1DetailModal file={selectedFile} onClose={() => setSelectedFile(null)} />
    </div>
  );
}
