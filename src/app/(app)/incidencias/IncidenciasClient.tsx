'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import CreateTicketModal from '@/components/incidencias/CreateTicketModal';
import { Eye, Plus, MessageSquare } from 'lucide-react';

export default function IncidenciasClient({ userBrands }: { userBrands: any[] }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [selectedNivel, setSelectedNivel] = useState('Nivel 1 - Comercializadora');
  const [selectedEstado, setSelectedEstado] = useState('Todas');
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (selectedNivel) query.append('nivel', selectedNivel);
      if (selectedEstado) query.append('estado', selectedEstado);

      const res = await fetch(`/api/tickets?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, [selectedNivel, selectedEstado]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Tickets / Incidencias" subtitle="Gestión de reclamaciones e incidencias" />
      
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Panel Superior: Filtros */}
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select 
              className="form-input"
              value={selectedNivel}
              onChange={e => setSelectedNivel(e.target.value)}
              style={{ width: 'auto', fontSize: '0.8rem' }}
            >
              <option value="Nivel 1 - Comercializadora">Nivel 1 - Comercializadora</option>
              <option value="Nivel 2 - Administrador">Nivel 2 - Administrador</option>
            </select>
            <select 
              className="form-input"
              value={selectedEstado}
              onChange={e => setSelectedEstado(e.target.value)}
              style={{ width: 'auto', fontSize: '0.8rem' }}
            >
              <option value="Pendientes">Pendientes de resolución</option>
              <option value="Nuevas">Nuevas sin atender</option>
              <option value="Todas">Todas</option>
            </select>
            
            <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
              <button 
                onClick={loadTickets} 
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                <Eye size={14} /> Consultar
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                <Plus size={14} /> Crear Ticket
              </button>
            </div>
          </div>

        {/* Listado de Tickets */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID / Ref</th>
                  <th>Fecha</th>
                  <th>Últ. Actividad</th>
                  <th>CUPS</th>
                  <th>Motivo / Tipo</th>
                  <th>Abierto por</th>
                  <th style={{ textAlign: 'center' }}>Respuestas</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      <div className="animate-pulse flex flex-col items-center gap-2">
                        <div className="h-4 w-24 bg-slate-700 rounded"></div>
                        <div className="text-xs">Cargando tickets...</div>
                      </div>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <MessageSquare className="text-slate-600 mb-2" size={32} />
                        <div>No hay tickets que coincidan con estos filtros</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tickets.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--danger)', fontWeight: 500 }}>#{t.id.slice(-6).toUpperCase()}</td>
                      <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(t.lastActivityAt).toLocaleDateString()}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{t.supplyPoint?.cups || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{t.motivo}</td>
                      <td>{t.openedBy?.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="bg-slate-900 text-slate-300 px-2 py-1 rounded border border-slate-700 text-xs">
                          {t.numRespuestas}
                        </span>
                      </td>
                      <td>
                        {t.estado === 'NUEVA' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded">
                            NUEVA
                          </span>
                        ) : t.estado === 'RESUELTA' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">
                            RESUELTA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded">
                            {t.estado}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="bg-slate-700 hover:bg-slate-600 text-white p-1.5 rounded transition-colors" title="Ver Ticket">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreateTicketModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        brands={userBrands} 
        onCreated={() => {
          setSelectedEstado('Nuevas');
          loadTickets();
        }}
      />
    </div>
  );
}
