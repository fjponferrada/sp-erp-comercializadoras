'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Zap, 
  MapPin, 
  Building, 
  FileText, 
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Activity
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import PaginationFooter from '@/components/PaginationFooter';

export interface InstalacionData {
  id: string;
  cups: string;
  address: string;
  city: string;
  province: string;
  tariff: string;
  isActive: boolean;
  clientName: string;
  clientId: string;
  activeContractId: string | null;
  productName: string;
}

export default function InstalacionesClient({ instalaciones, userRole }: { instalaciones: InstalacionData[], userRole: string }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Activos' | 'Inactivos'>('Todos');

  const filtered = useMemo(() => {
    return instalaciones.filter((inst) => {
      const matchSearch = search === '' || 
        inst.cups.toLowerCase().includes(search.toLowerCase()) || 
        inst.clientName.toLowerCase().includes(search.toLowerCase()) ||
        inst.address.toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === 'Todos' || 
        (statusFilter === 'Activos' ? inst.isActive : !inst.isActive);
      
      return matchSearch && matchStatus;
    });
  }, [instalaciones, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const pageData = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  const activeCount = instalaciones.filter(i => i.isActive).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '100px' }}>
      <Topbar 
        title="Instalaciones (CUPS)" 
        subtitle="Base de datos de puntos de suministro" 
      />

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card animate-fade-in-up delay-100" style={{ padding: '24px' }}>
            <div className="flex items-center gap-3 mb-2">
              <Zap size={18} className="text-gray-400" />
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total CUPS Registrados</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{instalaciones.length}</div>
          </div>
          <div className="card animate-fade-in-up delay-200" style={{ padding: '24px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.02)' }}>
            <div className="flex items-center gap-3 mb-2">
              <Activity size={18} className="text-emerald-400" />
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase' }}>CUPS Activos (Con contrato)</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeCount}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{instalaciones.length > 0 ? Math.round((activeCount / instalaciones.length) * 100) : 0}% del total</div>
          </div>
          <div className="card animate-fade-in-up delay-300" style={{ padding: '24px' }}>
            <div className="flex items-center gap-3 mb-2">
              <XCircle size={18} className="text-rose-400" />
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase' }}>CUPS Inactivos</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{instalaciones.length - activeCount}</div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="card animate-fade-in-up delay-400" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="p-5 border-b border-[var(--border)] flex flex-wrap gap-4 justify-between items-center bg-[var(--bg-elevated)]">
            <div className="flex items-center gap-3">
              <div className="lime-dot" />
              <span className="font-bold text-[0.95rem] text-[var(--text-primary)]">Base de Instalaciones</span>
              <span className="badge font-mono">{filtered.length} resultados</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  className="form-input pl-9 w-64 text-sm" 
                  placeholder="Buscar CUPS, dirección, cliente..." 
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <select 
                className="form-input text-sm w-40 cursor-pointer"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
              >
                <option value="Todos">Todos los Estados</option>
                <option value="Activos">Solo Activos</option>
                <option value="Inactivos">Solo Inactivos</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CUPS</th>
                  <th>Estado</th>
                  <th>Cliente Vinculado</th>
                  <th>Dirección</th>
                  <th>Tarifa</th>
                  <th>Producto Activo</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      No se encontraron instalaciones.
                    </td>
                  </tr>
                ) : (
                  pageData.map(inst => (
                    <tr key={inst.id} onClick={() => router.push(`/instalaciones/${inst.id}`)} className="cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="font-mono text-[0.85rem] font-medium tracking-wide">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className={inst.isActive ? "text-emerald-400" : "text-gray-500"} />
                          {inst.cups}
                        </div>
                      </td>
                      <td>
                        {inst.isActive ? (
                          <span className="badge badge-lime flex items-center gap-1 w-fit"><CheckCircle2 size={10} /> ACTIVO</span>
                        ) : (
                          <span className="badge flex items-center gap-1 w-fit" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}><XCircle size={10} /> INACTIVO</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-semibold text-[0.85rem] truncate max-w-[200px]">{inst.clientName}</span>
                          <span className="text-xs text-gray-500 font-mono">ID: {inst.clientId.substring(0,8)}...</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-[0.82rem] text-gray-300">
                          <MapPin size={12} className="text-gray-500 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{inst.address}, {inst.city}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge font-mono">{inst.tariff || '-'}</span>
                      </td>
                      <td className="text-[0.82rem] text-gray-400">
                        {inst.productName}
                      </td>
                      <td className="text-center">
                        <button 
                          className="btn-ghost" 
                          style={{ padding: '6px 12px', fontSize: '0.78rem', gap: 5 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/instalaciones/${inst.id}`);
                          }}
                        >
                          <ExternalLink size={12} />
                          Ver Ficha
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationFooter 
            currentPage={safePage}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            itemName="instalaciones"
            onPageChange={setPage}
            onItemsPerPageChange={v => { setItemsPerPage(v); setPage(1); }}
          />
        </div>
      </div>
    </div>
  );
}
