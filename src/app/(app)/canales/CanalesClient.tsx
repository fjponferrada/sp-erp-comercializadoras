'use client';

import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Search, Share2, Users, TrendingUp, Edit2, Phone, Mail } from 'lucide-react';
import PaginationFooter from '@/components/PaginationFooter';
import ChannelModal from './ChannelModal';

export interface CanalData {
  id?: string;
  codigo: string;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  adminEmail: string;
  managerEmail: string;
  supportEmail: string;
  autoGenerateContract: boolean;
  maxRenewalDays: number;
  contratos: number;
  activos: number;
  estado: 'ACTIVO' | 'INACTIVO';
  comisionFijo: number;
  comisionVariable: number;
  products?: any[];
  commissionTierId?: string | null;
}

interface Props {
  initialCanales: CanalData[];
  commissionTiers: { id: string, name: string }[];
}

export default function CanalesClient({ initialCanales, commissionTiers }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<CanalData | null>(null);

  const handleEdit = (channel: CanalData) => {
    setEditingChannel(channel);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingChannel(null);
    setIsModalOpen(true);
  };

  const filtered = initialCanales.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.contacto.toLowerCase().includes(search.toLowerCase()) ||
    c.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalContratos = initialCanales.reduce((s, c) => s + c.activos, 0);
  const totalCanales   = initialCanales.filter(c => c.estado === 'ACTIVO').length;
  
  const topCanal = [...initialCanales].sort((a, b) => b.activos - a.activos)[0];

  return (
    <>
      <Topbar title="Canales" subtitle="Red de agentes comerciales y colaboradores" action={{ label: 'Nuevo Canal', onClick: handleNew }} />

      <div style={{ padding: '24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Canales Activos',     value: String(totalCanales),          color: 'var(--lime)',    icon: Share2 },
            { label: 'Contratos via Canal', value: String(totalContratos),        color: 'var(--success)', icon: TrendingUp },
            { label: 'Canal Top',           value: topCanal ? topCanal.codigo : '—', color: 'var(--warning)', icon: Users },
            { label: 'Contratos Top Canal', value: topCanal ? String(topCanal.activos) : '0', color: 'var(--info)',    icon: TrendingUp },
          ].map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`card-stat animate-fade-in-up delay-${(i + 1) * 100}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</p>
                  <Icon size={15} color={k.color} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: k.color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{k.value}</div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" placeholder="Buscar canal, contacto o código..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: '32px', fontSize: '0.8rem' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace" }}>
              {filtered.length} canales
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre Canal</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right' }}>Contratos</th>
                  <th style={{ textAlign: 'right' }}>Activos</th>
                  <th style={{ textAlign: 'right' }}>Com. Fijo (€)</th>
                  <th style={{ textAlign: 'right' }}>Com. Var. (%)</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'center' }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                      No se encontraron canales con los filtros aplicados.
                    </td>
                  </tr>
                ) : paginated.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }}>
                    <td className="mono-cell" style={{ color: 'var(--lime)', fontWeight: 700 }}>{c.codigo}</td>
                    <td className="primary-cell">{c.nombre}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.contacto}</td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {c.telefono !== '—' && (
                        <a href={`tel:${c.telefono}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                          <Phone size={11} /> {c.telefono}
                        </a>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {c.email !== '—' && (
                        <a href={`mailto:${c.email}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                          <Mail size={11} /> {c.email}
                        </a>
                      )}
                    </td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{c.contratos}</td>
                    <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--lime)', fontWeight: 600 }}>{c.activos}</td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{c.comisionFijo > 0 ? `${c.comisionFijo.toFixed(2)} €` : '—'}</td>
                    <td className="mono-cell" style={{ textAlign: 'right' }}>{c.comisionVariable > 0 ? `${c.comisionVariable.toFixed(1)}%` : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {c.estado === 'ACTIVO'
                        ? <span className="badge badge-active">Activo</span>
                        : <span className="badge badge-draft">Inactivo</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-ghost" style={{ padding: '5px 8px' }} onClick={() => handleEdit(c)}>
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationFooter
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            itemName="canales"
            onPageChange={setPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </div>

      {isModalOpen && (
        <ChannelModal
          channel={editingChannel}
          commissionTiers={commissionTiers}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
