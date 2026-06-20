'use client';

import Topbar from '@/components/Topbar';

import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CheckSquare, Square, RefreshCcw, Search, Info } from 'lucide-react';
import { resolveSwitchingWarningAction, unresolveSwitchingWarningAction, getPaginatedSwitchingEventsAction, retryUnresolvedSwitchingEventsAction } from '@/app/actions/switchingActions';
import toast from 'react-hot-toast';

interface SwitchingWarningsClientProps {
  initialEvents: any[];
  initialTotalCount: number;
  userRole: string;
}

export default function SwitchingWarningsClient({
  initialEvents,
  initialTotalCount,
  userRole
}: SwitchingWarningsClientProps) {
  const [events, setEvents] = useState(initialEvents);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('fechaSolicitud');
  const [page, setPage] = useState(1);

  const fetchEvents = async (resetPage = false, newSortBy = sortBy, newSearchTerm = searchTerm) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page + 1;
    // Cambiado a false para mostrar absolutamente todos
    const result = await getPaginatedSwitchingEventsAction(currentPage, 50, newSearchTerm, false, '', newSortBy);
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
      toast.error('Error recargando los warnings');
    }
    setLoading(false);
  };

  const handleToggleResolve = async (id: string, isCurrentlyResolved: boolean) => {
    try {
      // Optimistic update in UI
      setEvents(events.map(e => e.id === id ? { ...e, isResolved: !isCurrentlyResolved } : e));
      
      let result;
      if (isCurrentlyResolved) {
        result = await unresolveSwitchingWarningAction(id);
      } else {
        result = await resolveSwitchingWarningAction(id);
      }

      if (result.success) {
        toast.success(isCurrentlyResolved ? 'Warning desmarcado' : 'Warning resuelto');
      } else {
        toast.error('Error: ' + result.error);
        fetchEvents(true);
      }
    } catch (error) {
      toast.error('Error inesperado');
      fetchEvents(true);
    }
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch (e) {
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
    
    if (event.motivosRechazo) {
      try {
        const motivos = typeof event.motivosRechazo === 'string' ? JSON.parse(event.motivosRechazo) : event.motivosRechazo;
        if (Array.isArray(motivos)) {
           const texts = motivos.map((m: any) => m.descripcion || m.codigo || JSON.stringify(m));
           if (texts.length > 0) parts.push(`Motivos: ${texts.join(', ')}`);
        } else if (typeof motivos === 'object' && (motivos.descripcion || motivos.codigo)) {
           parts.push(`Motivo: ${motivos.descripcion || motivos.codigo}`);
        }
      } catch(e) {}
    }
    return parts.join(' | ') || '-';
  };

  return (
    <div className="min-h-screen relative outline-none flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Topbar 
        title="Eventos Switchings"
        subtitle={`Revisa todos los archivos XML subidos (Completados y Errores). Total: ${totalCount}`}
        customActions={
          <div className="flex gap-3 w-full md:w-auto items-center">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="Buscar CUPS, código..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg focus:ring-1 focus:ring-[var(--lime)] focus:border-[var(--lime)] text-sm text-gray-200 placeholder-gray-500"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value === '') {
                    fetchEvents(true, sortBy, '');
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && fetchEvents(true)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            </div>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                fetchEvents(true, e.target.value);
              }}
              className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-[var(--lime)]"
            >
              <option value="fechaSolicitud">Fecha Solicitud</option>
              <option value="fechaAviso">Fecha Aviso</option>
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
                  toast.success(`Eventos re-asociados: ${result.resolvedCount} de ${result.processedCount}`, { id: toastId });
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
                  <th className="px-5 py-4 text-red-500">WARNING</th>
                  <th className="px-5 py-4">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-gray-300">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-gray-500">
                      No hay warnings pendientes de revisión. ¡Buen trabajo!
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.id} className="hover:bg-[rgba(255,255,255,0.01)] transition-colors">
                      <td className="px-5 py-4 text-center">
                        {!event.isResolved ? (
                          <button 
                            onClick={() => handleToggleResolve(event.id, false)}
                            className="text-gray-500 hover:text-[var(--lime)] transition-colors"
                            title="Marcar como resuelto"
                          >
                            <Square className="h-5 w-5" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleToggleResolve(event.id, true)}
                            className="text-[var(--lime)] hover:text-red-400 transition-colors"
                            title="Desmarcar (volver a mostrar warning)"
                          >
                            <CheckSquare className="h-5 w-5 mx-auto" />
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4">{formatDate(event.fechaAviso)}</td>
                      <td className="px-5 py-4 font-medium text-[var(--lime)]">{event.contract?.contractCode || '-'}</td>
                      <td className="px-5 py-4 font-mono text-gray-400">{event.supplyPoint?.cups || '-'}</td>
                      <td className="px-5 py-4">{formatDate(event.fechaSolicitud)}</td>
                      <td className="px-5 py-4 font-mono text-gray-400">{event.codigoSolicitud || '-'}</td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-1 rounded bg-[rgba(255,255,255,0.05)] text-gray-300 text-xs font-bold border border-[var(--border)]">
                          {event.proceso}{event.paso ? `_${event.paso}` : ''}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-red-500 bg-[rgba(239,68,68,0.05)]">{event.tipoError || '-'}</td>
                      <td className="px-5 py-4 bg-[rgba(239,68,68,0.02)] relative">
                        <div className="group flex items-center justify-center">
                          <Info className="h-5 w-5 text-red-400 cursor-help hover:text-red-300 transition-colors" />
                          <div className="absolute z-50 right-full mr-2 top-1/2 -translate-y-1/2 hidden group-hover:block w-80 p-4 bg-[#1C1C1C] text-sm text-gray-200 border border-[var(--border-strong)] rounded-xl shadow-2xl shadow-black/60 pointer-events-none">
                            <div className="text-red-400 font-bold mb-2 flex items-center gap-2 border-b border-red-500/20 pb-2">
                              <AlertTriangle size={16} /> Detalle del Warning
                            </div>
                            <p className="whitespace-normal leading-relaxed text-[0.85rem]">{event.warning}</p>
                            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#1C1C1C] border-t border-r border-[var(--border-strong)] rotate-45"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-normal min-w-[200px] text-xs text-gray-300">
                        {getObservacionesText(event)}
                      </td>
                    </tr>
                  ))
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
    </div>
  );
}
