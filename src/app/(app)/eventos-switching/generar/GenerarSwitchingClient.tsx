'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchPendingSwitchingContracts, generateSwitchingXmls } from '@/app/actions/switchingGenerarActions';
import { Loader2, Download, CheckSquare, Square, Eye, AlertCircle, Search } from 'lucide-react';
import Topbar from '@/components/Topbar';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface ContractRow {
  id: string;
  cups: string;
  direccion: string;
  nif: string;
  nombre: string;
  proceso: string;
  tipoC2: string | null;
  contrato: string;
  codDistribuidora: string;
  codComercializadora: string;
  estado: string;
  hasAnexo?: boolean;
}

export default function GenerarSwitchingClient() {
  const [data, setData] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<{ contrato: string; motivo: string }[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACEPTADO');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPendingSwitchingContracts();
      if (res.success) {
        const rows = (res.data || []) as ContractRow[];
        setData(rows);
      } else {
        setError(res.error || 'Error al cargar los contratos');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of data) {
      const st = (d.estado || '').toUpperCase() || 'SIN ESTADO';
      counts[st] = (counts[st] || 0) + 1;
    }
    return counts;
  }, [data]);

  const uniqueStatuses = useMemo(() => {
    const list = Object.keys(statusCounts).sort();
    if (!list.includes('ACEPTADO')) list.unshift('ACEPTADO');
    return list;
  }, [statusCounts]);

  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return data.filter(d => {
      const matchesSearch =
        !q ||
        (d.cups || '').toLowerCase().includes(q) ||
        (d.contrato || '').toLowerCase().includes(q) ||
        (d.nombre || '').toLowerCase().includes(q) ||
        (d.nif || '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'ALL' || (d.estado || '').toUpperCase() === statusFilter.toUpperCase();

      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter]);

  const selectableFilteredIds = useMemo(
    () => filteredData.filter(d => Boolean(d.cups && d.nif && d.codDistribuidora)).map(d => d.id),
    [filteredData]
  );

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setSelectedIds(new Set());
  };

  const handleSearchChange = (newSearch: string) => {
    setSearchTerm(newSearch);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectableFilteredIds.length === 0) return;
    const allSelected = selectableFilteredIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableFilteredIds));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;
    setGenerating(true);
    setError(null);
    setValidationWarnings([]);
    try {
      // Garantizar que solo se envían IDs actualmente visibles y seleccionados
      const visibleSet = new Set(filteredData.map(d => d.id));
      const ids = Array.from(selectedIds).filter(id => visibleSet.has(id));
      if (ids.length === 0) {
        setSelectedIds(new Set());
        return;
      }

      const res = await generateSwitchingXmls(ids);

      if (res.success && res.fileContent) {
        const link = document.createElement('a');
        link.href = `data:application/zip;base64,${res.fileContent}`;
        link.download = res.fileName || 'Switching_Generados.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        const failedIds = new Set(res.validationErrors?.map((e: any) => e.id || e.contrato) || []);
        setData(prev => prev.filter(p => !ids.includes(p.id) || failedIds.has(p.id) || failedIds.has(p.contrato)));
        setSelectedIds(new Set());

        if (res.validationErrors && res.validationErrors.length > 0) {
          setValidationWarnings(res.validationErrors);
          toast.success(`ZIP descargado (${res.count} generados, ${res.validationErrors.length} con datos incompletos)`);
        } else {
          toast.success(`ZIP descargado correctamente (${res.count} XML generados)`);
        }
      } else {
        setError(res.error || 'Error generando XMLs');
        if (res.validationErrors && res.validationErrors.length > 0) {
          setValidationWarnings(res.validationErrors);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Generar Switching" subtitle="Emisión masiva de archivos XML (Paso 01 CNMC V3.0)" />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Top Banner Widget */}
        <div className="card animate-fade-in-up" style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <h2 style={{ color: 'var(--lime)', fontSize: '0.875rem', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Pendientes Iniciar {statusFilter !== 'ALL' ? `(${statusFilter.replace(/_/g, ' ')})` : '(TODOS)'}
          </h2>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.05em' }}>
            {filteredData.length}
          </div>
          {data.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => handleStatusChange('ALL')}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                style={{
                  background: statusFilter === 'ALL' ? 'var(--lime)' : 'rgba(255,255,255,0.05)',
                  color: statusFilter === 'ALL' ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                Todos: {data.length}
              </button>
              {uniqueStatuses.map(st => {
                const c = statusCounts[st] || 0;
                if (c === 0 && st !== 'ACEPTADO') return null;
                const isRechazo = st.includes('RECHAZ');
                const isActive = statusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                    style={{
                      background: isActive ? (isRechazo ? 'rgba(239,68,68,0.25)' : 'var(--lime)') : 'rgba(255,255,255,0.05)',
                      color: isActive ? (isRechazo ? '#f87171' : '#000') : isRechazo ? '#f87171' : 'var(--text-secondary)',
                      border: `1px solid ${isRechazo ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {st.replace(/_/g, ' ')}: {c}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="card animate-fade-in-up delay-200" style={{ padding: '16px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={e => handleStatusChange(e.target.value)}
            className="form-input"
            style={{ width: 'auto', fontSize: '0.8rem' }}
          >
            <option value="ALL">Todos los estados ({data.length})</option>
            {uniqueStatuses.map(st => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')} ({statusCounts[st] || 0})
              </option>
            ))}
          </select>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por CUPS, Contrato, NIF, Nombre..."
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
            />
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={handleGenerate}
              disabled={generating || selectedIds.size === 0}
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generating ? 'Generando...' : `Generar ZIP (${selectedIds.size})`}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {validationWarnings.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 font-bold mb-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <h3>Atención: Algunos contratos no se pudieron generar ({validationWarnings.length})</h3>
            </div>
            <ul className="list-disc pl-8 text-sm space-y-1">
              {validationWarnings.map((v, idx) => (
                <li key={idx}>
                  Contrato <span className="font-mono">{v.contrato}</span>: {v.motivo}
                </li>
              ))}
            </ul>
            <p className="text-xs text-yellow-500/80 italic mt-2">
              El resto de contratos seleccionados sí se han incluido en el .zip.
            </p>
          </div>
        )}

        <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: '50px' }}>
                    <button
                      onClick={toggleSelectAll}
                      className="hover:text-gray-200"
                      title="Seleccionar todos los contratos completos visibles"
                    >
                      {selectableFilteredIds.length > 0 && selectableFilteredIds.every(id => selectedIds.has(id)) ? (
                        <CheckSquare className="w-4 h-4 mx-auto" />
                      ) : (
                        <Square className="w-4 h-4 mx-auto" />
                      )}
                    </button>
                  </th>
                  <th>Cups</th>
                  <th>Dirección</th>
                  <th>NIF</th>
                  <th>Nombre</th>
                  <th>Proceso</th>
                  <th>Estado</th>
                  <th>Contrato</th>
                  <th style={{ textAlign: 'center' }}>Cod Dist</th>
                  <th style={{ textAlign: 'center', width: '60px' }}>Ver</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--lime)]" />
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No hay contratos pendientes en este filtro
                      {statusFilter !== 'ALL' && data.length > 0
                        ? ` (existen ${data.length} contratos en otros estados — pulsa "Todos" arriba)`
                        : ''}
                    </td>
                  </tr>
                ) : (
                  filteredData.map(row => {
                    const isSelected = selectedIds.has(row.id);
                    const isMissingData = !row.cups || !row.nif || !row.codDistribuidora;
                    return (
                      <tr
                        key={row.id}
                        style={{
                          background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                          borderLeft: isSelected
                            ? '2px solid var(--lime)'
                            : isMissingData
                              ? '2px solid var(--danger)'
                              : '2px solid transparent',
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => toggleSelect(row.id)}
                            style={{ color: isSelected ? 'var(--lime)' : 'var(--text-muted)' }}
                          >
                            {isSelected ? <CheckSquare className="w-4 h-4 mx-auto" /> : <Square className="w-4 h-4 mx-auto" />}
                          </button>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-secondary)' }}>
                          {row.cups || <span className="badge badge-draft">Falta CUPS</span>}
                        </td>
                        <td
                          style={{
                            maxWidth: '250px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                          }}
                          title={row.direccion}
                        >
                          {row.direccion}
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {row.nif || <span className="badge badge-draft">Falta NIF</span>}
                        </td>
                        <td
                          style={{
                            maxWidth: '200px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontWeight: 500,
                            color: '#fff',
                          }}
                          title={row.nombre}
                        >
                          {row.nombre}
                        </td>
                        <td>
                          <span className="badge badge-draft">
                            {row.proceso}
                            {row.tipoC2 ? `-${row.tipoC2}` : ''}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              row.estado === 'PDTE_TRAMITAR'
                                ? 'badge-draft'
                                : row.estado === 'EN_PROCESO'
                                  ? 'badge-active'
                                  : row.estado === 'RECHAZADO' || row.estado === 'RECHAZO_DISTRIBUIDORA'
                                    ? 'badge-draft'
                                    : 'badge-draft'
                            }`}
                            style={
                              row.estado === 'RECHAZADO' || row.estado === 'RECHAZO_DISTRIBUIDORA'
                                ? { color: 'var(--danger)', borderColor: 'var(--danger)' }
                                : {}
                            }
                          >
                            {row.estado?.replace(/_/g, ' ') || 'SIN ESTADO'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Link href={`/contratos/${row.id}`} className="hover:underline text-[var(--lime)]">
                              {row.contrato}
                            </Link>
                            {row.proceso.startsWith('M1') && row.estado?.toUpperCase() === 'ACEPTADO' && !row.hasAnexo && (
                              <span title="Falta PDF Anexo firmado">
                                <AlertCircle size={14} style={{ color: 'var(--danger)' }} />
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {row.codDistribuidora || <span className="badge badge-draft">Falta</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Link href={`/contratos/${row.id}`} style={{ color: 'var(--text-muted)' }} title="Ver ficha del contrato">
                            <Eye size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
