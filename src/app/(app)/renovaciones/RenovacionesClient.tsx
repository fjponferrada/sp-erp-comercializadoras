'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Search, RefreshCcw, Calendar, Zap, CheckCircle2, XCircle, AlertTriangle, MapPin, Phone, Mail, MoreHorizontal } from 'lucide-react';
import PaginationFooter from '@/components/PaginationFooter';
import Link from 'next/link';
import RenovarModal from '@/components/renovaciones/RenovarModal';

export interface RenovacionData {
  id: string;
  contractId: string;
  clientId: string;
  cups: string;
  direccion: string;
  cliente: string;
  telefonoContacto: string;
  emailComercial: string;
  fechaActivacion: string;
  tarifa: string;
  mwh: number;
  vencimiento: string;
  diasRestantes: number;
  producto: string;
  canal: string;
  estado: string; // 'URGENTE' | 'PROXIMO' | 'PENDIENTE'
  hasSelfConsumption: boolean;
}

const estadoBadge = (estado: string, dias: number) => {
  if (estado === 'URGENTE')  return <span className="badge badge-danger"><AlertTriangle size={10} /> {dias} días</span>;
  if (estado === 'PROXIMO')  return <span className="badge badge-warning"><Calendar size={10} /> {dias} días</span>;
  return <span className="badge badge-draft">{dias} días</span>;
};

export default function RenovacionesClient({ initialRenovaciones, products = [] }: { initialRenovaciones: RenovacionData[], products?: any[] }) {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');
  const [tarifaFilter, setTarifaFilter] = useState('TODAS');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [renovados, setRenovados] = useState<string[]>([]);
  const [ocultos, setOcultos] = useState<string[]>([]);
  
  const [renovarModalOpen, setRenovarModalOpen] = useState(false);
  const [selectedRenovacion, setSelectedRenovacion] = useState<RenovacionData | null>(null);

  const tarifasUnicas = Array.from(new Set(initialRenovaciones.map(r => r.tarifa))).sort();

  const filtered = initialRenovaciones.filter(r => {
    const matchSearch = r.cliente.toLowerCase().includes(search.toLowerCase()) ||
      r.cups.toLowerCase().includes(search.toLowerCase());
    const matchEstado = estadoFilter === 'TODOS' || r.estado === estadoFilter;
    const matchTarifa = tarifaFilter === 'TODAS' || r.tarifa === tarifaFilter;
    const matchOculto = !ocultos.includes(r.id);
    return matchSearch && matchEstado && matchTarifa && matchOculto;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const urgentes = initialRenovaciones.filter(r => r.estado === 'URGENTE').length;
  const proximos = initialRenovaciones.filter(r => r.estado === 'PROXIMO').length;
  const totalMwhRenovar = filtered.reduce((s, r) => s + r.mwh, 0);

  return (
    <>
      <Topbar title="Renovaciones" subtitle="Contratos próximos a vencimiento · Gestión de retención de cartera" />

      <div style={{ padding: '24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Renovaciones Urgentes', value: String(urgentes),  sub: '< 20 días',     color: 'var(--danger)',  icon: AlertTriangle },
            { label: 'Próximas (20–40 días)', value: String(proximos),  sub: 'Planificar ya',  color: 'var(--warning)', icon: Calendar },
            { label: 'Total en Cola',         value: String(filtered.length), sub: 'pendientes', color: 'var(--lime)', icon: RefreshCcw },
            { label: 'MWh en Riesgo',         value: `${totalMwhRenovar.toFixed(0)}`, sub: 'MWh/año',    color: 'var(--info)',    icon: Zap },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</p>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={k.color} />
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: k.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>{k.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Filters & Table wrapper */}
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="Buscar cliente o CUPS..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '32px', fontSize: '0.8rem' }} />
            </div>
            
            <select className="form-input" value={tarifaFilter} onChange={e => { setTarifaFilter(e.target.value); setPage(1); }} style={{ width: 'auto', fontSize: '0.8rem' }}>
              <option value="TODAS">Todas las Tarifas</option>
              {tarifasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select className="form-input" value={estadoFilter} onChange={e => { setEstadoFilter(e.target.value); setPage(1); }} style={{ width: 'auto', fontSize: '0.8rem' }}>
              <option value="TODOS">Todos los estados</option>
              <option value="URGENTE">Urgente (&lt;20 días)</option>
              <option value="PROXIMO">Próximo (20–40d)</option>
              <option value="PENDIENTE">Pendiente (+40d)</option>
            </select>
            
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace" }}>
              {filtered.length} contratos
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4">Cliente / Contacto</th>
                  <th className="px-6 py-4">Suministro</th>
                  <th className="px-6 py-4">Contrato</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      No hay contratos que venzan próximamente con los filtros actuales.
                    </td>
                  </tr>
                ) : paginated.map((r) => {
                  const renovado = renovados.includes(r.id);
                  return (
                    <tr key={r.id} style={{ opacity: renovado ? 0.5 : 1, transition: 'opacity 0.3s' }} className="hover:bg-slate-800/30">
                      
                      {/* CLIENTE */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-white mb-2">{r.cliente}</div>
                        <div className="flex flex-col gap-1 text-xs text-slate-400">
                          <div className="flex items-center gap-2"><Phone size={12} className="text-slate-500"/> {r.telefonoContacto}</div>
                          <div className="flex items-center gap-2"><Mail size={12} className="text-slate-500"/> {r.emailComercial}</div>
                        </div>
                      </td>

                      {/* SUMINISTRO */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-mono text-lime-400 font-bold mb-2">{r.cups}</div>
                        <div className="flex items-start gap-2 text-xs text-slate-400">
                          <MapPin size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                          <span className="whitespace-normal max-w-[200px]">{r.direccion}</span>
                        </div>
                      </td>

                      {/* CONTRATO */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="badge badge-process">{r.tarifa}</span>
                          <span className="text-xs font-mono bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300">{r.mwh.toFixed(1)} MWh</span>
                        </div>
                        <div className="text-xs text-slate-400 flex flex-col gap-1">
                          <div><span className="text-slate-500">Producto:</span> <span className="text-amber-400 font-medium">{r.producto}</span></div>
                          <div><span className="text-slate-500">Activación:</span> {r.fechaActivacion}</div>
                          <div><span className="text-slate-500">Vencimiento:</span> <span className="text-white font-medium">{r.vencimiento}</span></div>
                        </div>
                      </td>

                      {/* ESTADO */}
                      <td className="px-6 py-4 text-center align-top">
                        <div className="mt-2">{estadoBadge(r.estado, r.diasRestantes)}</div>
                      </td>

                      {/* ACCIONES */}
                      <td className="px-6 py-4 text-right align-top">
                        {renovado ? (
                          <span className="badge badge-active inline-flex mt-2"><CheckCircle2 size={10} /> Renovado</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-1.5 rounded-lg text-xs transition-colors shadow-sm" onClick={() => { setSelectedRenovacion(r); setRenovarModalOpen(true); }}>
                              Renovar
                            </button>
                            <button className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium px-4 py-1.5 rounded-lg text-xs transition-colors shadow-sm" onClick={() => setOcultos(p => [...p, r.id])}>
                              Borrar
                            </button>
                            <Link href={`/contratos/${r.contractId}`} className="btn-ghost" style={{ padding: '6px' }} title="Ficha Contrato">
                              <MoreHorizontal size={16} />
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationFooter
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            itemName="renovaciones"
            onPageChange={setPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </div>

      <RenovarModal 
        isOpen={renovarModalOpen} 
        onClose={() => setRenovarModalOpen(false)} 
        renovacion={selectedRenovacion}
        products={products}
        onRenovado={(id) => setRenovados(p => [...p, id])}
      />
    </>
  );
}
