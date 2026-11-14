'use client';

import Topbar from '@/components/Topbar';
import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Search,
  RefreshCcw,
  Download,
  ExternalLink,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { getClaimsAction, ClaimSummary } from '@/app/actions/claimsActions';
import {
  getTipoR1Label,
  getSubtipoR1Label,
  TIPOS_COMUNICACION_R1,
} from './utils/cnmc_codes';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface ReclamacionesClientProps {
  initialClaims: ClaimSummary[];
  initialTotalCount: number;
  initialStatusCounts: Record<string, number>;
  userRole: string;
}

const PAGE_SIZE = 100;

export default function ReclamacionesClient({
  initialClaims,
  initialTotalCount,
  initialStatusCounts,
}: ReclamacionesClientProps) {
  const [claims, setClaims] = useState<ClaimSummary[]>(initialClaims);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>(initialStatusCounts || { ALL: initialTotalCount });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [selectedClaim, setSelectedClaim] = useState<ClaimSummary | null>(null);

  const fetchClaims = async (
    resetPage = false,
    newSearchTerm = searchTerm,
    newStatusFilter = statusFilter
  ) => {
    setLoading(true);
    const targetPage = resetPage ? 1 : page + 1;
    const result = await getClaimsAction(undefined, targetPage, PAGE_SIZE, newSearchTerm, newStatusFilter);
    if (result.success) {
      if (resetPage) {
        setClaims(result.data);
        setPage(1);
      } else {
        setClaims((prev) => [...prev, ...result.data]);
        setPage(targetPage);
      }
      setTotalCount(result.totalCount);
      setStatusCounts(result.statusCounts);
    } else {
      toast.error('Error recargando reclamaciones');
    }
    setLoading(false);
  };

  const formatDate = (dateString: Date | string | null | undefined, withTime = true) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '-';
      return format(d, withTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: es });
    } catch {
      return '-';
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      // Obtener TODAS las reclamaciones que coinciden con la búsqueda y filtro activos en pantalla (limit = 0)
      let rowsToExport = claims;
      if (totalCount > claims.length) {
        const allRes = await getClaimsAction(undefined, 1, 0, searchTerm, statusFilter);
        if (allRes.success) {
          rowsToExport = allRes.data;
        }
      }

      if (rowsToExport.length === 0) {
        toast.error('No hay reclamaciones para exportar con el filtro actual');
        return;
      }

      const data = rowsToExport.map((c) => {
        const paso03Full = c.paso03?.historial?.length
          ? c.paso03.historial
              .map((h) => {
                const f = h.fecha ? `[${formatDate(h.fecha)}] ` : '';
                const t = h.tipoComunicacion ? `(${TIPOS_COMUNICACION_R1[h.tipoComunicacion] || h.tipoComunicacion}) ` : '';
                return `${f}${t}${h.comentario || ''}`.trim();
              })
              .filter(Boolean)
              .join('\n---\n')
          : c.paso03?.comentario || '';

        const paso04Full = c.paso04?.historial?.length
          ? c.paso04.historial
              .map((h) => `${h.fecha ? `[${formatDate(h.fecha)}] ` : ''}${h.comentario || ''}`.trim())
              .filter(Boolean)
              .join('\n---\n')
          : c.paso04?.comentario || '';

        return {
          'Código Solicitud': c.codigoSolicitud,
          'Cód. Reclamación Distribuidora': c.codigoReclamacion || '',
          CUPS: c.cups || '',
          Titular: c.titular || '',
          Tipo: getTipoR1Label(c.tipoReclamacion),
          Subtipo: getSubtipoR1Label(c.subtipoReclamacion),
          Estado: c.estadoIntegrado,
          'Resultado Cierre': c.paso05?.resultadoDescripcion || '',
          'Indemnización (€)': c.paso05?.indemnizacion ?? '',
          'Días Abierta': c.diasAbierta ?? '',
          'Paso 01 (Fecha)': c.paso01?.fecha ? formatDate(c.paso01.fecha) : '',
          'Mensaje Enviado (Paso 01)': c.paso01?.comentario || '',
          'Paso 02 (Fecha)': c.paso02?.fecha ? formatDate(c.paso02.fecha) : '',
          'Estado Paso 02': c.paso02?.estadoAR || '',
          'Respuesta Distribuidora (Paso 02)': c.paso02?.comentario || '',
          'Paso 03 (Fecha)': c.paso03?.fecha ? formatDate(c.paso03.fecha) : '',
          'Fecha Límite Envío (Paso 03)': c.paso03?.fechaLimiteEnvio ? formatDate(c.paso03.fechaLimiteEnvio, false) : '',
          'Información Adicional Distribuidora (Paso 03)': paso03Full,
          'Respuesta Comercializadora (Paso 04)': paso04Full,
          'Paso 05 (Fecha Cierre)': c.paso05?.fecha ? formatDate(c.paso05.fecha) : '',
          'Resolución Cierre Distribuidora (Paso 05)': c.paso05?.comentario || '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reclamaciones');
      XLSX.writeFile(wb, `Reclamaciones_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el fichero Excel');
    } finally {
      setExporting(false);
    }
  };

  const filterTabs: Array<{ key: string; label: string; highlight?: boolean }> = [
    { key: 'ALL', label: 'Todas' },
    { key: 'Pte. Info (Paso 03)', label: 'Pte. Info (Paso 03)', highlight: (statusCounts['Pte. Info (Paso 03)'] || 0) > 0 },
    { key: 'En Proceso', label: 'En Proceso' },
    { key: 'Aceptada', label: 'Aceptadas' },
    { key: 'Cerrada', label: 'Cerradas' },
    { key: 'Rechazada', label: 'Rechazadas' },
    ...(statusCounts['Anulada'] ? [{ key: 'Anulada', label: 'Anuladas' }] : []),
  ];

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'Cerrada':
        return 'bg-gray-800 text-gray-200 border border-gray-600';
      case 'Rechazada':
        return 'bg-red-900/30 text-red-400 border border-red-800';
      case 'Pte. Info (Paso 03)':
        return 'bg-amber-900/30 text-amber-300 border border-amber-700';
      case 'Aceptada':
        return 'bg-green-900/30 text-green-400 border border-green-800';
      case 'En Proceso':
        return 'bg-blue-900/30 text-blue-400 border border-blue-800';
      case 'Anulada':
        return 'bg-gray-900 text-gray-500 border border-gray-700';
      default:
        return 'bg-gray-800 text-gray-400 border border-gray-700';
    }
  };

  return (
    <div className="min-h-screen relative outline-none flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Topbar
        title="Reclamaciones"
        subtitle={`Listado general de procesos de reclamación (R1). Mostrando filtro: ${totalCount}`}
        customActions={
          <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
            <div className="relative flex-1 md:w-72">
              <input
                type="text"
                placeholder="Buscar CUPS, titular, solicitud, subtipo..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg focus:ring-1 focus:ring-[var(--lime)] focus:border-[var(--lime)] text-sm text-gray-200 placeholder-gray-500"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value === '') {
                    fetchClaims(true, '', statusFilter);
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && fetchClaims(true, searchTerm, statusFilter)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            </div>
            <button
              onClick={() => fetchClaims(true, searchTerm, statusFilter)}
              disabled={loading}
              className="flex items-center justify-center p-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-gray-400 transition-colors"
              title="Recargar"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-gray-300 font-semibold rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exportando...' : 'Descargar Excel'}
            </button>
            <a
              href="/reclamaciones/generar"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--lime)] text-[var(--bg-base)] font-semibold rounded-lg hover:bg-[#c9f07a] transition-colors"
            >
              Generar Reclamación
            </a>
          </div>
        }
      />

      <div className="p-6 w-full mx-auto space-y-4 flex-1">
        {/* FILTER TABS */}
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => {
            const active = statusFilter === tab.key;
            const count = statusCounts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setStatusFilter(tab.key);
                  fetchClaims(true, searchTerm, tab.key);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-2 ${
                  active
                    ? 'bg-[var(--lime)] text-[var(--bg-base)] border-[var(--lime)]'
                    : tab.highlight
                    ? 'bg-amber-950/30 text-amber-300 border-amber-700/70 hover:bg-amber-900/40'
                    : 'bg-[var(--bg-elevated)] text-gray-300 border-[var(--border)] hover:border-gray-600'
                }`}
              >
                {tab.highlight && !active && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] ${
                    active ? 'bg-black/20 text-[var(--bg-base)]' : 'bg-white/5 text-gray-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* TABLE */}
        <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[rgba(255,255,255,0.02)] border-b border-[var(--border)] text-xs text-gray-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4">Código Solicitud</th>
                  <th className="px-5 py-4">CUPS / Titular</th>
                  <th className="px-5 py-4">Tipo / Subtipo</th>
                  <th className="px-5 py-4 text-center">Estado</th>
                  <th className="px-5 py-4 text-center">Días</th>
                  <th className="px-5 py-4">Paso 01</th>
                  <th className="px-5 py-4">Paso 02</th>
                  <th className="px-5 py-4">Resolución / Última Comunicación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-gray-300">
                {claims.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-gray-500">
                      No se encontraron reclamaciones con los filtros actuales.
                    </td>
                  </tr>
                )}
                {claims.map((claim, idx) => {
                  const resolucionTexto =
                    claim.paso05?.comentario ||
                    claim.paso03?.comentario ||
                    (claim.estadoIntegrado === 'Rechazada' ? claim.paso02?.comentario : null) ||
                    '-';

                  return (
                    <tr
                      key={`${claim.codigoSolicitud}_${idx}`}
                      onClick={() => setSelectedClaim(claim)}
                      className="hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-mono text-gray-300">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span>{claim.codigoSolicitud}</span>
                            {claim.paso01?.xmlUrl && (
                              <a
                                href={claim.paso01.xmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Descargar XML Paso 01"
                                className="text-gray-500 hover:text-[var(--lime)]"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                          {claim.codigoReclamacion && (
                            <span className="text-[11px] text-gray-500">Dist: {claim.codigoReclamacion}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 font-mono text-gray-300">
                            <span>{claim.cups || '-'}</span>
                            {claim.contractId && (
                              <a
                                href={`/contratos/${claim.contractId}`}
                                onClick={(e) => e.stopPropagation()}
                                title="Abrir ficha del contrato"
                                className="text-gray-500 hover:text-[var(--lime)]"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          {claim.titular && (
                            <span className="text-xs text-gray-500 max-w-[210px] truncate" title={claim.titular}>
                              {claim.titular}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5 max-w-[260px]">
                          <span
                            className="text-xs font-semibold text-gray-200 truncate"
                            title={getTipoR1Label(claim.tipoReclamacion)}
                          >
                            {getTipoR1Label(claim.tipoReclamacion)}
                          </span>
                          <span
                            className="text-xs text-gray-400 truncate"
                            title={getSubtipoR1Label(claim.subtipoReclamacion)}
                          >
                            {getSubtipoR1Label(claim.subtipoReclamacion)}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(
                              claim.estadoIntegrado
                            )}`}
                          >
                            {claim.estadoIntegrado}
                          </span>
                          {claim.paso05?.resultadoDescripcion && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                claim.paso05.resultadoCodigo === '01'
                                  ? 'bg-green-900/30 text-green-300'
                                  : claim.paso05.resultadoCodigo === '02'
                                  ? 'bg-red-900/30 text-red-300'
                                  : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              {claim.paso05.resultadoDescripcion}
                            </span>
                          )}
                          {claim.estadoIntegrado === 'Pte. Info (Paso 03)' && claim.paso03?.fechaLimiteEnvio && (
                            <span className="text-[10px] text-amber-400 font-medium">
                              Límite: {formatDate(claim.paso03.fechaLimiteEnvio, false)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-bold text-center">
                        {claim.diasAbierta !== null ? claim.diasAbierta : '-'}
                      </td>

                      <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(claim.paso01?.fecha)}</td>

                      <td className="px-5 py-3.5 text-xs">
                        <div className="flex items-center gap-2 text-gray-400">
                          {formatDate(claim.paso02?.fecha)}
                          {claim.paso02?.xmlUrl && (
                            <a
                              href={claim.paso02.xmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Descargar XML Paso 02"
                              className="text-gray-500 hover:text-[var(--lime)]"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-gray-300">
                        <div className="flex items-center justify-between gap-3 max-w-xs">
                          <div className="truncate text-xs" title={resolucionTexto}>
                            {resolucionTexto}
                          </div>
                          {(claim.paso05?.xmlUrl || claim.paso03?.xmlUrl) && (
                            <a
                              href={claim.paso05?.xmlUrl || claim.paso03?.xmlUrl || ''}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Descargar XML Resolución / Paso 03"
                              className="text-gray-500 hover:text-[var(--lime)] shrink-0"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {claims.length < totalCount && (
            <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between bg-[rgba(255,255,255,0.01)]">
              <span className="text-xs text-gray-400">
                Mostrando {claims.length} de {totalCount} reclamaciones
              </span>
              <button
                onClick={() => fetchClaims(false)}
                disabled={loading}
                className="px-4 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs font-semibold text-gray-300 hover:border-[var(--lime)] hover:text-[var(--lime)] transition-colors disabled:opacity-50"
              >
                {loading ? 'Cargando...' : 'Cargar más reclamaciones'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedClaim && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setSelectedClaim(null)}
        >
          <div
            className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-start justify-between gap-4 bg-[rgba(255,255,255,0.02)]">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-lg font-bold text-white font-mono">
                    Solicitud {selectedClaim.codigoSolicitud}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClasses(
                      selectedClaim.estadoIntegrado
                    )}`}
                  >
                    {selectedClaim.estadoIntegrado}
                  </span>
                  {selectedClaim.paso05?.resultadoDescripcion && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        selectedClaim.paso05.resultadoCodigo === '01'
                          ? 'bg-green-900/40 text-green-300 border border-green-800'
                          : selectedClaim.paso05.resultadoCodigo === '02'
                          ? 'bg-red-900/40 text-red-300 border border-red-800'
                          : 'bg-gray-800 text-gray-300 border border-gray-700'
                      }`}
                    >
                      {selectedClaim.paso05.resultadoDescripcion}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    CUPS: <strong className="font-mono text-gray-200">{selectedClaim.cups || '-'}</strong>
                  </span>
                  {selectedClaim.titular && (
                    <span>
                      Titular: <strong className="text-gray-200">{selectedClaim.titular}</strong>
                    </span>
                  )}
                  {selectedClaim.codigoReclamacion && (
                    <span>
                      Cód. Distribuidora:{' '}
                      <strong className="font-mono text-gray-200">{selectedClaim.codigoReclamacion}</strong>
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-sm">
              {/* Summary grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-xs">
                <div>
                  <span className="text-gray-500 block mb-0.5">Tipo de Reclamación</span>
                  <span className="text-gray-200 font-semibold">{getTipoR1Label(selectedClaim.tipoReclamacion)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Subtipo</span>
                  <span className="text-gray-200 font-semibold">
                    {getSubtipoR1Label(selectedClaim.subtipoReclamacion)}
                  </span>
                </div>
                {selectedClaim.diasAbierta !== null && (
                  <div>
                    <span className="text-gray-500 block mb-0.5">Tiempo abierta</span>
                    <span className="text-[var(--lime)] font-bold">{selectedClaim.diasAbierta} días</span>
                  </div>
                )}
                {selectedClaim.paso05?.indemnizacion !== null &&
                  selectedClaim.paso05?.indemnizacion !== undefined && (
                    <div>
                      <span className="text-gray-500 block mb-0.5">Indemnización abonada</span>
                      <span className="text-green-400 font-bold">
                        {selectedClaim.paso05.indemnizacion.toFixed(2)} €
                      </span>
                    </div>
                  )}
              </div>

              {/* Timeline Steps */}
              <div className="space-y-3">
                {/* Paso 01 */}
                {selectedClaim.paso01 && (
                  <div className="p-4 rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.015)]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 font-semibold text-blue-300 text-xs uppercase tracking-wider">
                        <FileText className="h-4 w-4" />
                        Paso 01 · Solicitud Enviada ({formatDate(selectedClaim.paso01.fecha)})
                      </div>
                      {selectedClaim.paso01.xmlUrl && (
                        <a
                          href={selectedClaim.paso01.xmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--lime)] hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" /> XML Paso 01
                        </a>
                      )}
                    </div>
                    <p className="text-gray-300 text-xs whitespace-pre-wrap leading-relaxed">
                      {selectedClaim.paso01.comentario || 'Sin comentarios registrados en Paso 01.'}
                    </p>
                  </div>
                )}

                {/* Paso 02 */}
                {selectedClaim.paso02 && (
                  <div
                    className={`p-4 rounded-lg border ${
                      selectedClaim.paso02.estadoAR === 'RECHAZADO'
                        ? 'border-red-800/60 bg-red-950/15'
                        : 'border-green-800/50 bg-green-950/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div
                        className={`flex items-center gap-2 font-semibold text-xs uppercase tracking-wider ${
                          selectedClaim.paso02.estadoAR === 'RECHAZADO' ? 'text-red-400' : 'text-green-400'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Paso 02 · {selectedClaim.paso02.estadoAR === 'RECHAZADO' ? 'Rechazo' : 'Aceptación'} Distribuidora (
                        {formatDate(selectedClaim.paso02.fecha)})
                      </div>
                      {selectedClaim.paso02.xmlUrl && (
                        <a
                          href={selectedClaim.paso02.xmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--lime)] hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" /> XML Paso 02
                        </a>
                      )}
                    </div>
                    {selectedClaim.paso02.comentario && (
                      <p className="text-gray-200 text-xs whitespace-pre-wrap leading-relaxed">
                        {selectedClaim.paso02.comentario}
                      </p>
                    )}
                  </div>
                )}

                {/* Paso 03 */}
                {selectedClaim.paso03 &&
                  (selectedClaim.paso03.historial?.length ? selectedClaim.paso03.historial : [selectedClaim.paso03]).map(
                    (h: any, i: number) => (
                      <div
                        key={`p03_${i}`}
                        className="p-4 rounded-lg border border-amber-800/50 bg-amber-950/10"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2 font-semibold text-amber-300 text-xs uppercase tracking-wider">
                            <Clock className="h-4 w-4" />
                            <span>
                              Paso 03 ·{' '}
                              {h.tipoComunicacion
                                ? TIPOS_COMUNICACION_R1[h.tipoComunicacion] || `Comunicación ${h.tipoComunicacion}`
                                : 'Comunicación Intermedia'}{' '}
                              ({formatDate(h.fecha)})
                            </span>
                            {h.fechaLimiteEnvio && (
                              <span className="px-2 py-0.5 rounded bg-amber-900/50 text-amber-200 text-[11px] normal-case">
                                Fecha límite: {formatDate(h.fechaLimiteEnvio, false)}
                              </span>
                            )}
                          </div>
                          {h.xmlUrl && (
                            <a
                              href={h.xmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-[var(--lime)] hover:underline flex items-center gap-1 shrink-0"
                            >
                              <Download className="h-3.5 w-3.5" /> XML Paso 03
                            </a>
                          )}
                        </div>
                        <p className="text-gray-200 text-xs whitespace-pre-wrap leading-relaxed">
                          {h.comentario || '-'}
                        </p>
                      </div>
                    )
                  )}

                {/* Paso 04 */}
                {selectedClaim.paso04 &&
                  (selectedClaim.paso04.historial?.length ? selectedClaim.paso04.historial : [selectedClaim.paso04]).map(
                    (h: any, i: number) => (
                      <div key={`p04_${i}`} className="p-4 rounded-lg border border-blue-800/50 bg-blue-950/10">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 font-semibold text-blue-300 text-xs uppercase tracking-wider">
                            <FileText className="h-4 w-4" />
                            Paso 04 · Información Aportada por Comercializadora ({formatDate(h.fecha)})
                          </div>
                          {h.xmlUrl && (
                            <a
                              href={h.xmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-[var(--lime)] hover:underline flex items-center gap-1"
                            >
                              <Download className="h-3.5 w-3.5" /> XML Paso 04
                            </a>
                          )}
                        </div>
                        <p className="text-gray-200 text-xs whitespace-pre-wrap leading-relaxed">
                          {h.comentario || '-'}
                        </p>
                      </div>
                    )
                  )}

                {/* Paso 05 */}
                {selectedClaim.paso05 && (
                  <div className="p-4 rounded-lg border border-gray-600 bg-[rgba(255,255,255,0.03)]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 font-semibold text-white text-xs uppercase tracking-wider">
                        <CheckCircle2 className="h-4 w-4 text-[var(--lime)]" />
                        Paso 05 · Resolución y Cierre ({formatDate(selectedClaim.paso05.fecha)})
                      </div>
                      {selectedClaim.paso05.xmlUrl && (
                        <a
                          href={selectedClaim.paso05.xmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--lime)] hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" /> XML Paso 05
                        </a>
                      )}
                    </div>
                    {selectedClaim.paso05.detalleResultado && (
                      <div className="text-[11px] text-gray-400 mb-1.5">
                        Cód. Detalle Resultado (Tabla 73):{' '}
                        <span className="font-mono text-gray-300">{selectedClaim.paso05.detalleResultado}</span>
                      </div>
                    )}
                    <p className="text-gray-200 text-xs whitespace-pre-wrap leading-relaxed">
                      {selectedClaim.paso05.comentario || 'Cerrada sin comentarios adicionales.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-[var(--border)] bg-[rgba(255,255,255,0.02)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {selectedClaim.contractId && (
                  <a
                    href={`/contratos/${selectedClaim.contractId}`}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-xs font-semibold text-gray-200 hover:border-[var(--lime)] hover:text-[var(--lime)] transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Ver Contrato
                  </a>
                )}
                {selectedClaim.cups && (
                  <a
                    href={`/reclamaciones/generar?cups=${encodeURIComponent(selectedClaim.cups)}`}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-xs font-semibold text-gray-200 hover:border-[var(--lime)] hover:text-[var(--lime)] transition-colors"
                  >
                    Nueva Reclamación sobre este CUPS
                  </a>
                )}
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-white transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
