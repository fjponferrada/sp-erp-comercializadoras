'use client';

import Topbar from '@/components/Topbar';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CheckSquare, Square, RefreshCcw, Search, Info, FileText, ShieldAlert, X, Download } from 'lucide-react';
import {
  resolveSwitchingWarningAction,
  unresolveSwitchingWarningAction,
  getPaginatedSwitchingEventsAction,
  retryUnresolvedSwitchingEventsAction,
} from '@/app/actions/switchingActions';
import { generateRechazoD1Xml } from '@/app/actions/anulacionesActions';
import toast from 'react-hot-toast';

interface SwitchingWarningsClientProps {
  initialEvents: any[];
  initialTotalCount: number;
  userRole: string;
}

const PAGE_LIMIT = 100;

function extractCupsFromEvent(event: any): string {
  if (event?.supplyPoint?.cups) return event.supplyPoint.cups;
  const haystacks = [event?.warning, event?.observaciones, event?.xmlUrl];
  for (const h of haystacks) {
    if (typeof h === 'string') {
      const m = h.match(/ES\d{16}[A-Z0-9]{2,4}/i);
      if (m?.[0]) return m[0].toUpperCase();
    }
  }
  return '';
}

export default function SwitchingWarningsClient({
  initialEvents,
  initialTotalCount,
}: SwitchingWarningsClientProps) {
  const [events, setEvents] = useState(initialEvents);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('fechaSolicitud');
  const [resolveStatus, setResolveStatus] = useState('all');
  const [procesoFilter, setProcesoFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modal Rechazo D1_02
  const [d1ModalEvent, setD1ModalEvent] = useState<any | null>(null);
  const [d1Cups, setD1Cups] = useState('');
  const [d1Destino, setD1Destino] = useState('');
  const [d1Motivo, setD1Motivo] = useState<'E1' | 'F1' | 'I1'>('E1');
  const [d1Comentarios, setD1Comentarios] = useState('CUPS no corresponde a esta comercializadora.');
  const [d1Submitting, setD1Submitting] = useState(false);

  const fetchEvents = async (
    resetPage = false,
    newSortBy = sortBy,
    newSearchTerm = searchTerm,
    newResolveStatus = resolveStatus,
    newProcesoFilter = procesoFilter
  ) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page + 1;
    const result = await getPaginatedSwitchingEventsAction(
      currentPage,
      PAGE_LIMIT,
      newSearchTerm,
      false,
      newProcesoFilter,
      newSortBy,
      newResolveStatus
    );
    if (result.success) {
      if (resetPage) {
        setEvents(result.events || []);
        setPage(1);
      } else {
        setEvents([...events, ...(result.events || [])]);
        setPage(currentPage);
      }
      setTotalCount(result.totalCount || 0);
    } else {
      toast.error('Error recargando los eventos');
    }
    setLoading(false);
  };

  const handleToggleResolve = async (id: string, isCurrentlyResolved: boolean) => {
    try {
      setEvents(events.map(e => (e.id === id ? { ...e, isResolved: !isCurrentlyResolved } : e)));

      const result = isCurrentlyResolved
        ? await unresolveSwitchingWarningAction(id)
        : await resolveSwitchingWarningAction(id);

      if (result.success) {
        toast.success(isCurrentlyResolved ? 'Warning desmarcado' : 'Warning resuelto');
      } else {
        toast.error('Error: ' + result.error);
        fetchEvents(true);
      }
    } catch {
      toast.error('Error inesperado');
      fetchEvents(true);
    }
  };

  const openRechazoD1Modal = (event: any) => {
    const inferredCups = extractCupsFromEvent(event);
    const inferredDestino =
      event?.supplyPoint?.distributorReeCode ||
      (inferredCups.length >= 6 ? inferredCups.substring(2, 6) : '');
    setD1ModalEvent(event);
    setD1Cups(inferredCups);
    setD1Destino(inferredDestino);
    setD1Motivo('E1');
    setD1Comentarios('CUPS no corresponde a esta comercializadora.');
  };

  const handleGenerateD1Rechazo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d1ModalEvent) return;
    setD1Submitting(true);
    try {
      const res = await generateRechazoD1Xml({
        eventId: d1ModalEvent.id,
        destino: d1Destino,
        codigoSolicitud: d1ModalEvent.codigoSolicitud || '',
        cups: d1Cups,
        codigoMotivo: d1Motivo,
        comentarios: d1Comentarios,
      });

      if (!res.success || !res.xml) {
        toast.error(res.error || 'Error generando XML D1_02');
        return;
      }

      const blob = new Blob([res.xml], { type: 'application/xml;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || 'Rechazo_D1_02.xml';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`XML ${res.filename} descargado y evento marcado como resuelto`);
      setEvents(prev => prev.map(ev => (ev.id === d1ModalEvent.id ? { ...ev, isResolved: true } : ev)));
      setD1ModalEvent(null);
    } catch (err: any) {
      toast.error(err.message || 'Error inesperado generando D1_02');
    } finally {
      setD1Submitting(false);
    }
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return '-';
    }
  };

  const getObservacionesText = (event: any) => {
    const parts = [];
    if (event.observaciones) {
      parts.push(event.observaciones);
    }
    if (event.paso === '11' && event.fechaActivacionBaja) {
      parts.push(`Fecha Prevista Baja: ${formatDate(event.fechaActivacionBaja)}`);
    } else if (event.fechaPrevActivacion) {
      parts.push(`Fecha Prev. Activación: ${formatDate(event.fechaPrevActivacion)}`);
    }

    if (event.motivosRechazo && !String(event.observaciones || '').includes('[')) {
      try {
        const motivos =
          typeof event.motivosRechazo === 'string' ? JSON.parse(event.motivosRechazo) : event.motivosRechazo;
        if (Array.isArray(motivos)) {
          const texts = motivos.map((m: any) =>
            m?.codigo && m?.descripcion ? `[${m.codigo} - ${m.descripcion}]` : m?.descripcion || m?.codigo || String(m)
          );
          if (texts.length > 0) parts.push(`Motivos: ${texts.join(', ')}`);
        } else if (typeof motivos === 'object' && (motivos.descripcion || motivos.codigo)) {
          parts.push(`Motivo: ${motivos.descripcion || motivos.codigo}`);
        }
      } catch {
        // Ignore parse error
      }
    }
    return parts.join(' | ') || '-';
  };

  const emptyStateMessage =
    resolveStatus === 'unresolved'
      ? 'No hay warnings pendientes de revisión. ¡Buen trabajo!'
      : resolveStatus === 'resolved'
      ? 'No se encontraron eventos procesados con los filtros actuales.'
      : 'No se encontraron eventos de switching con los filtros actuales.';

  return (
    <div className="min-h-screen relative outline-none flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Topbar
        title="Eventos Switchings"
        subtitle={`Revisa todos los archivos XML subidos (Completados y Errores). Total: ${totalCount}`}
        customActions={
          <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
            <div className="relative flex-1 md:w-60">
              <input
                type="text"
                placeholder="Buscar CUPS, código..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg focus:ring-1 focus:ring-[var(--lime)] focus:border-[var(--lime)] text-sm text-gray-200 placeholder-gray-500"
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  if (e.target.value === '') {
                    fetchEvents(true, sortBy, '', resolveStatus, procesoFilter);
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && fetchEvents(true)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            </div>

            <select
              value={procesoFilter}
              onChange={e => {
                setProcesoFilter(e.target.value);
                fetchEvents(true, sortBy, searchTerm, resolveStatus, e.target.value);
              }}
              className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-[var(--lime)]"
            >
              <option value="">Proceso: Todos</option>
              <option value="C1">C1 (Cambio sin cambios)</option>
              <option value="C2">C2 (Cambio con cambios)</option>
              <option value="A3">A3 (Alta)</option>
              <option value="M1">M1 (Modificación)</option>
              <option value="M2">M2 (Modif. unilateral)</option>
              <option value="B1">B1 (Baja comercializador)</option>
              <option value="B2">B2 (Baja distribuidora)</option>
              <option value="T1">T1 (Traspaso COR)</option>
              <option value="E1">E1 (Desistimiento)</option>
              <option value="E2">E2 (Reposición)</option>
              <option value="D1">D1 (Notif. cambios ATR)</option>
            </select>

            <select
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value);
                fetchEvents(true, e.target.value, searchTerm, resolveStatus, procesoFilter);
              }}
              className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-[var(--lime)]"
            >
              <option value="fechaSolicitud">Fecha Solicitud</option>
              <option value="fechaAviso">Fecha Aviso</option>
            </select>

            <select
              value={resolveStatus}
              onChange={e => {
                setResolveStatus(e.target.value);
                fetchEvents(true, sortBy, searchTerm, e.target.value, procesoFilter);
              }}
              className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-[var(--lime)]"
            >
              <option value="all">Estado: Todos</option>
              <option value="resolved">Solo procesados</option>
              <option value="unresolved">Solo no procesados</option>
            </select>

            <button
              onClick={() => fetchEvents(true)}
              disabled={loading}
              className="flex items-center justify-center p-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-gray-400 transition-colors"
              title="Recargar"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={async () => {
                const toastId = toast.loading('Reintentando eventos...');
                const result = await retryUnresolvedSwitchingEventsAction();
                if (result.success) {
                  toast.success(`Eventos re-asociados: ${result.resolvedCount} de ${result.processedCount}`, {
                    id: toastId,
                  });
                  fetchEvents(true);
                } else {
                  toast.error(String(result.error || 'Error reintentando'), { id: toastId });
                }
              }}
              disabled={loading}
              className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-4 py-2 rounded-lg text-sm font-medium border border-blue-500/30 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCcw className="h-4 w-4" />
              Reintentar Asociación
            </button>
          </div>
        }
      />
      <div className="p-6 w-full max-w-[1920px] mx-auto space-y-6 flex-1">
        {/* TABLE */}
        <div className="bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[rgba(255,255,255,0.02)] border-b border-[var(--border)] text-xs text-gray-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4 text-center w-16">Marcar</th>
                  <th className="px-5 py-4">Fecha Aviso</th>
                  <th className="px-5 py-4">Contrato</th>
                  <th className="px-5 py-4">CUPS</th>
                  <th className="px-5 py-4">Fecha Solicitud</th>
                  <th className="px-5 py-4">Codigo Solicitud</th>
                  <th className="px-5 py-4">Proceso</th>
                  <th className="px-5 py-4 text-red-500">TipoError</th>
                  <th className="px-5 py-4 text-red-500 text-center">WARNING</th>
                  <th className="px-5 py-4">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-gray-300">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-gray-500">
                      {emptyStateMessage}
                    </td>
                  </tr>
                ) : (
                  events.map(event => {
                    const hasWarning = Boolean(event.warning);
                    const hasTipoError = Boolean(event.tipoError);
                    const displayCups = extractCupsFromEvent(event) || '-';
                    const canRejectD1 = event.procesoBase === 'D1' && event.paso === '01';

                    return (
                      <tr key={event.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                        <td className="px-5 py-4 text-center">
                          {!event.isResolved ? (
                            <button
                              onClick={() => handleToggleResolve(event.id, false)}
                              className="text-gray-500 hover:text-[var(--lime)] transition-colors"
                              title="Marcar como resuelto"
                            >
                              <Square className="h-5 w-5 mx-auto" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleResolve(event.id, true)}
                              className="text-[var(--lime)] hover:text-red-400 transition-colors"
                              title="Desmarcar (volver a mostrar como pendiente)"
                            >
                              <CheckSquare className="h-5 w-5 mx-auto" />
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4">{formatDate(event.fechaAviso)}</td>
                        <td className="px-5 py-4 font-medium text-[var(--lime)]">{event.contract?.contractCode || '-'}</td>
                        <td className="px-5 py-4 font-mono text-gray-400">{displayCups}</td>
                        <td className="px-5 py-4">{formatDate(event.fechaSolicitud)}</td>
                        <td className="px-5 py-4 font-mono text-gray-400">{event.codigoSolicitud || '-'}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded bg-[rgba(255,255,255,0.05)] text-gray-300 text-xs font-bold border border-[var(--border)]">
                              {event.proceso}
                              {event.paso && !String(event.proceso).includes('_') ? `_${event.paso}` : ''}
                            </span>
                            {event.xmlUrl && (
                              <a
                                href={event.xmlUrl.startsWith('http') ? event.xmlUrl : `https://${event.xmlUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-[var(--lime)] transition-colors p-1 bg-[rgba(255,255,255,0.05)] rounded border border-[var(--border)] hover:border-[var(--lime)]"
                                title="Ver XML Original"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            )}
                            {canRejectD1 && (
                              <button
                                onClick={() => openRechazoD1Modal(event)}
                                className="text-amber-400 hover:text-amber-300 transition-colors px-2 py-1 bg-amber-500/10 rounded border border-amber-500/30 hover:border-amber-400 text-xs font-semibold flex items-center gap-1"
                                title="Generar XML de rechazo CNMC D1_02"
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                                D1_02
                              </button>
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-5 py-4 font-bold ${
                            hasTipoError ? 'text-red-500 bg-[rgba(239,68,68,0.05)]' : 'text-gray-600'
                          }`}
                        >
                          {event.tipoError || '-'}
                        </td>
                        <td className={`px-5 py-4 relative text-center ${hasWarning ? 'bg-[rgba(239,68,68,0.02)]' : ''}`}>
                          {hasWarning ? (
                            <div className="group flex items-center justify-center">
                              <Info className="h-5 w-5 text-red-400 cursor-help hover:text-red-300 transition-colors" />
                              <div className="absolute z-50 right-full mr-2 top-1/2 -translate-y-1/2 hidden group-hover:block w-80 p-4 bg-[#1C1C1C] text-sm text-gray-200 border border-[var(--border-strong)] rounded-xl shadow-2xl shadow-black/60 pointer-events-none text-left">
                                <div className="text-red-400 font-bold mb-2 flex items-center gap-2 border-b border-red-500/20 pb-2">
                                  <AlertTriangle size={16} /> Detalle del Warning
                                </div>
                                <p className="whitespace-normal leading-relaxed text-[0.85rem]">{event.warning}</p>
                                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#1C1C1C] border-t border-r border-[var(--border-strong)] rotate-45"></div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-normal min-w-[200px] text-xs text-gray-300">
                          {getObservacionesText(event)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {events.length < totalCount && (
          <div className="flex justify-center pt-2 pb-6">
            <button
              onClick={() => fetchEvents(false)}
              disabled={loading}
              className="px-6 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-gray-300 hover:text-[var(--lime)] hover:border-[var(--lime)] transition-colors disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Cargar más registros'}
            </button>
          </div>
        )}
      </div>

      {/* MODAL RECHAZO D1_02 */}
      {d1ModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Generar Rechazo CNMC D1_02</h3>
              </div>
              <button
                onClick={() => setD1ModalEvent(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateD1Rechazo} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Cód. Solicitud D1</label>
                  <input
                    type="text"
                    value={d1ModalEvent.codigoSolicitud || ''}
                    readOnly
                    className="w-full px-3 py-2 bg-black/30 border border-[var(--border)] rounded-lg text-sm font-mono text-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                    Cód. REE Distribuidora
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={d1Destino}
                    onChange={e => setD1Destino(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Ej. 0021"
                    required
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">CUPS</label>
                <input
                  type="text"
                  maxLength={22}
                  value={d1Cups}
                  onChange={e => setD1Cups(e.target.value.toUpperCase().trim())}
                  placeholder="ES0021000000000000XX0F"
                  required
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">
                  Motivo Rechazo (Tabla 27 CNMC)
                </label>
                <select
                  value={d1Motivo}
                  onChange={e => {
                    const val = e.target.value as 'E1' | 'F1' | 'I1';
                    setD1Motivo(val);
                    if (val === 'E1') setD1Comentarios('CUPS no corresponde a esta comercializadora.');
                    if (val === 'F1') setD1Comentarios('Incongruencia de datos respecto al suministro registrado.');
                    if (val === 'I1') setD1Comentarios('Rechazo de notificación D1 por causas operativas.');
                  }}
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-white"
                >
                  <option value="E1">E1 - CUPS no corresponde a la comercializadora</option>
                  <option value="F1">F1 - Incongruencia de datos</option>
                  <option value="I1">I1 - Otras causas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Comentarios (Obligatorio)</label>
                <textarea
                  rows={3}
                  value={d1Comentarios}
                  onChange={e => setD1Comentarios(e.target.value)}
                  required
                  maxLength={4000}
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setD1ModalEvent(null)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-gray-300 hover:bg-white/5 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={d1Submitting}
                  className="px-4 py-2 rounded-lg bg-[var(--lime)] text-black font-bold text-sm flex items-center gap-2 hover:bg-opacity-90 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {d1Submitting ? 'Generando...' : 'Descargar XML D1_02'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
