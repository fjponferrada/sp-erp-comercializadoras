'use client';

import React, { useState, useEffect } from 'react';
import { fetchPendingSwitchingContracts, generateSwitchingXmls } from '@/app/actions/switchingGenerarActions';
import { Loader2, Download, CheckSquare, Square, Eye, AlertCircle, Search } from 'lucide-react';
import Topbar from '@/components/Topbar';
import Link from 'next/link';

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
  
  // Para paginación local o filtro
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
        setData(res.data as ContractRow[]);
      } else {
        setError(res.error || 'Error al cargar los contratos');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(d => d.id)));
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
      const ids = Array.from(selectedIds);
      const res = await generateSwitchingXmls(ids);
      
      if (res.success && res.fileContent) {
        // Download zip
        const link = document.createElement('a');
        link.href = `data:application/zip;base64,${res.fileContent}`;
        link.download = res.fileName || 'Switching_Generados.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Remove processed items EXCEPT the ones that failed validation
        const failedIds = new Set(res.validationErrors?.map((e: any) => e.contrato) || []);
        setData(prev => prev.filter(p => !selectedIds.has(p.id) || failedIds.has(p.contrato)));
        setSelectedIds(new Set());
        
        if (res.validationErrors && res.validationErrors.length > 0) {
           setValidationWarnings(res.validationErrors);
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

  const filteredData = data.filter(d => {
    const matchesSearch = d.cups.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.nif.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || (d.estado || '').toUpperCase() === statusFilter.toUpperCase();
    
    return matchesSearch && matchesStatus;
  });

  const uniqueStatuses = Array.from(new Set(data.map(d => (d.estado || '').toUpperCase()))).filter(Boolean).sort();
  if (!uniqueStatuses.includes('ACEPTADO')) uniqueStatuses.unshift('ACEPTADO'); // Ensure it exists in the list

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Generar Switching" subtitle="Emisión masiva de archivos XML" />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Top Banner Widget */}
        <div className="card animate-fade-in-up" style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <h2 style={{ color: 'var(--lime)', fontSize: '0.875rem', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Pendientes Iniciar</h2>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.05em' }}>
            {filteredData.length}
          </div>
        </div>

        <div className="card animate-fade-in-up delay-200" style={{ padding: '16px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-input"
            style={{ width: 'auto', fontSize: '0.8rem' }}
          >
            <option value="ALL">Todos los estados</option>
            {uniqueStatuses.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Buscar por CUPS, NIF, Nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              <li key={idx}>Contrato <span className="font-mono">{v.contrato}</span>: {v.motivo}</li>
            ))}
          </ul>
          <p className="text-xs text-yellow-500/80 italic mt-2">El resto de contratos seleccionados sí se han incluido en el .zip.</p>
        </div>
      )}

      <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '50px' }}>
                  <button onClick={toggleSelectAll} className="hover:text-gray-200">
                    {selectedIds.size > 0 && selectedIds.size === filteredData.length ? <CheckSquare className="w-4 h-4 mx-auto" /> : <Square className="w-4 h-4 mx-auto" />}
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
                    No hay contratos pendientes
                  </td>
                </tr>
              ) : (
                filteredData.map((row, i) => {
                  const isSelected = selectedIds.has(row.id);
                  const isMissingData = !row.cups || !row.nif || !row.codDistribuidora;
                  return (
                    <tr 
                      key={row.id} 
                      style={{ 
                        background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                        borderLeft: isSelected ? '2px solid var(--lime)' : isMissingData ? '2px solid var(--danger)' : '2px solid transparent'
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <button onClick={() => toggleSelect(row.id)} style={{ color: isSelected ? 'var(--lime)' : 'var(--text-muted)' }}>
                          {isSelected ? <CheckSquare className="w-4 h-4 mx-auto" /> : <Square className="w-4 h-4 mx-auto" />}
                        </button>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-secondary)' }}>{row.cups || <span className="badge badge-draft">Falta CUPS</span>}</td>
                      <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', color: 'var(--text-muted)' }} title={row.direccion}>{row.direccion}</td>
                      <td style={{ fontWeight: 500 }}>{row.nif || <span className="badge badge-draft">Falta NIF</span>}</td>
                      <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, color: '#fff' }} title={row.nombre}>{row.nombre}</td>
                      <td>
                        <span className="badge badge-draft">
                          {row.proceso}{row.tipoC2 ? `-${row.tipoC2}` : ''}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          row.estado === 'PDTE_TRAMITAR' ? 'badge-draft' :
                          row.estado === 'EN_PROCESO' ? 'badge-active' :
                          row.estado === 'RECHAZADO' || row.estado === 'RECHAZO_DISTRIBUIDORA' ? 'badge-draft' :
                          'badge-draft'
                        }`} style={row.estado === 'RECHAZADO' || row.estado === 'RECHAZO_DISTRIBUIDORA' ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}}>
                          {row.estado?.replace(/_/g, ' ') || 'SIN ESTADO'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{row.contrato}</span>
                          {row.proceso.startsWith('M1') && row.estado?.toUpperCase() === 'ACEPTADO' && !row.hasAnexo && (
                            <AlertCircle size={14} style={{ color: 'var(--danger)' }} />
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{row.codDistribuidora || <span className="badge badge-draft">Falta</span>}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Link href={`/contratos/${row.id}`} style={{ color: 'var(--text-muted)' }}>
                           <Eye size={16} />
                        </Link>
                      </td>
                    </tr>
                  )
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
