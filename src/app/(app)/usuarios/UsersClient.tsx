'use client';

import React, { useState, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import PaginationFooter from '@/components/PaginationFooter';
import {
  Search,
  Edit2,
  Mail,
  Shield,
  Building2,
  Users,
  UserCheck,
  AlertTriangle,
  X,
} from 'lucide-react';
import UserModal from './UserModal';
import { useRouter } from 'next/navigation';

type UserTab = 'STAFF' | 'CLIENTS' | 'ALL';

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'SUPERADMIN',
  COMPANYADMIN: 'RESP. EMPRESA',
  BACKOFFICE: 'BACKOFFICE',
  CANAL: 'JEFE DE CANAL',
  COMERCIAL: 'COMERCIAL',
  CLIENT: 'CLIENTE',
};

function getEffectiveBrandNames(user: any): string[] {
  if (user.role === 'SUPERADMIN') {
    return ['Todas las marcas'];
  }
  if (user.role === 'CLIENT') {
    return user.brand?.name ? [user.brand.name] : [];
  }
  if (user.role === 'COMPANYADMIN') {
    const names = new Set<string>();
    user.companies?.forEach((c: any) => {
      c.brands?.forEach((b: any) => {
        if (b?.name) names.add(b.name);
      });
    });
    user.assignedBrands?.forEach((b: any) => {
      if (b?.name) names.add(b.name);
    });
    return Array.from(names);
  }
  // BACKOFFICE, CANAL, COMERCIAL: gobernados por assignedBrands
  return (user.assignedBrands || []).map((b: any) => b.name).filter(Boolean);
}

function hasEffectiveAccess(user: any): boolean {
  if (user.isActive === false) return false;
  if (user.role === 'SUPERADMIN') return true;
  if (user.role === 'CLIENT') return Boolean(user.brand?.id || user.brandId);
  return getEffectiveBrandNames(user).length > 0;
}

export default function UsersClient({
  initialUsers,
  brands,
  companies,
  channels,
  currentUserRole,
  currentUserId,
}: any) {
  const [activeTab, setActiveTab] = useState<UserTab>('STAFF');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const router = useRouter();

  const staffCount = useMemo(
    () => initialUsers.filter((u: any) => u.role !== 'CLIENT').length,
    [initialUsers]
  );
  const clientsCount = useMemo(
    () => initialUsers.filter((u: any) => u.role === 'CLIENT').length,
    [initialUsers]
  );

  // Opciones dinámicas de rol según usuarios presentes y pestaña activa (Regla 208)
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    initialUsers.forEach((u: any) => {
      if (activeTab === 'STAFF' && u.role === 'CLIENT') return;
      if (activeTab === 'CLIENTS' && u.role !== 'CLIENT') return;
      if (currentUserRole !== 'SUPERADMIN' && u.role === 'SUPERADMIN') return;
      if (u.role) set.add(u.role);
    });
    return Array.from(set).sort();
  }, [initialUsers, activeTab, currentUserRole]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return initialUsers.filter((u: any) => {
      if (activeTab === 'STAFF' && u.role === 'CLIENT') return false;
      if (activeTab === 'CLIENTS' && u.role !== 'CLIENT') return false;

      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

      if (brandFilter !== 'ALL') {
        const matchesPrimary = u.brandId === brandFilter;
        const matchesAssigned = u.assignedBrands?.some((b: any) => b.id === brandFilter);
        const matchesCompanyBrand = u.companies?.some((c: any) =>
          c.brands?.some((b: any) => b.id === brandFilter)
        );
        if (u.role === 'CLIENT') {
          if (!matchesPrimary) return false;
        } else if (u.role !== 'SUPERADMIN') {
          if (!matchesAssigned && !(u.role === 'COMPANYADMIN' && matchesCompanyBrand)) return false;
        }
      }

      if (channelFilter !== 'ALL') {
        if (channelFilter === 'NONE') {
          if (u.channelId) return false;
        } else if (u.channelId !== channelFilter) {
          return false;
        }
      }

      if (statusFilter !== 'ALL') {
        const canLogin = hasEffectiveAccess(u);
        if (statusFilter === 'ACTIVE' && !canLogin) return false;
        if (statusFilter === 'BLOCKED' && canLogin) return false;
      }

      if (q) {
        const nameMatch = (u.name || '').toLowerCase().includes(q);
        const emailMatch = (u.email || '').toLowerCase().includes(q);
        const codeMatch = (u.codigo || '').toLowerCase().includes(q);
        const roleLabelMatch = (ROLE_LABELS[u.role] || u.role || '').toLowerCase().includes(q);
        const channelMatch = (u.channel?.name || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !codeMatch && !roleLabelMatch && !channelMatch) {
          return false;
        }
      }

      return true;
    });
  }, [initialUsers, activeTab, roleFilter, brandFilter, channelFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = useMemo(
    () => filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredUsers, currentPage, itemsPerPage]
  );

  const hasActiveFilters =
    search.trim() !== '' ||
    roleFilter !== 'ALL' ||
    brandFilter !== 'ALL' ||
    channelFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('ALL');
    setBrandFilter('ALL');
    setChannelFilter('ALL');
    setStatusFilter('ALL');
    setPage(1);
  };

  const handleTabChange = (tab: UserTab) => {
    setActiveTab(tab);
    setRoleFilter('ALL');
    if (tab === 'CLIENTS') setChannelFilter('ALL');
    setPage(1);
  };

  const handleOpenModal = (user: any = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>
      <Topbar
        title="Usuarios y Accesos"
        subtitle={
          currentUserRole === 'SUPERADMIN'
            ? 'Gestiona los accesos, roles, canales y marcas de todo el ecosistema'
            : 'Gestiona los accesos, roles y canales de tus comercializadoras'
        }
        action={{ label: 'Nuevo Usuario', onClick: () => handleOpenModal() }}
      />

      <main
        style={{
          padding: '24px 32px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          minWidth: 0,
        }}
      >
        {/* Selector de Pestañas: Equipo vs Clientes Portal vs Todos */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { id: 'STAFF' as UserTab, label: 'Equipo y Red Comercial', count: staffCount, icon: Users },
            { id: 'CLIENTS' as UserTab, label: 'Clientes Portal', count: clientsCount, icon: UserCheck },
            { id: 'ALL' as UserTab, label: 'Todos los Usuarios', count: initialUsers.length, icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: active ? '1px solid var(--lime)' : '1px solid var(--border)',
                  background: active ? 'rgba(222, 255, 154, 0.08)' : 'var(--bg-surface)',
                  color: active ? 'var(--lime)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.83rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                <span
                  style={{
                    background: active ? 'var(--lime)' : 'var(--bg-elevated)',
                    color: active ? 'var(--bg-base)' : 'var(--text-muted)',
                    borderRadius: 99,
                    padding: '1px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Cabecera + Buscador y Filtros Dinámicos (Regla 208) */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="lime-dot" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {activeTab === 'STAFF'
                    ? 'Equipo Interno y Red Comercial'
                    : activeTab === 'CLIENTS'
                      ? 'Usuarios del Portal de Clientes'
                      : 'Base Completa de Usuarios'}
                </span>
                <span
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 99,
                    padding: '2px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {filteredUsers.length} resultados
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: 11,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="search"
                    name="search-users-filter"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="form-input"
                    style={{ paddingLeft: 32, width: 280, maxWidth: '100%', fontSize: '0.84rem' }}
                    placeholder="Buscar por nombre, email, código o canal..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Fila independiente de filtros semánticos */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              {activeTab !== 'CLIENTS' && (
                <select
                  className="form-input"
                  style={{ width: 'auto', minWidth: '160px', fontSize: '0.8rem' }}
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">Rol: Todos</option>
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] || r}
                    </option>
                  ))}
                </select>
              )}

              {brands.length > 1 && (
                <select
                  className="form-input"
                  style={{ width: 'auto', minWidth: '170px', fontSize: '0.8rem' }}
                  value={brandFilter}
                  onChange={(e) => {
                    setBrandFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">Marca: Todas</option>
                  {brands.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}

              {activeTab !== 'CLIENTS' && channels.length > 0 && (
                <select
                  className="form-input"
                  style={{ width: 'auto', minWidth: '180px', fontSize: '0.8rem' }}
                  value={channelFilter}
                  onChange={(e) => {
                    setChannelFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">Canal: Todos</option>
                  <option value="NONE">Sin canal asignado</option>
                  {channels.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}

              <select
                className="form-input"
                style={{ width: 'auto', minWidth: '160px', fontSize: '0.8rem' }}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Estado: Todos</option>
                <option value="ACTIVE">Con acceso activo</option>
                <option value="BLOCKED">Bloqueados / Sin marcas</option>
              </select>

              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="btn-ghost"
                  style={{ fontSize: '0.78rem', padding: '6px 10px', gap: '4px' }}
                >
                  <X size={13} />
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>USUARIO</th>
                  <th>ROL</th>
                  <th>MARCAS AUTORIZADAS</th>
                  {activeTab !== 'CLIENTS' && <th>CANAL ASIGNADO</th>}
                  <th>ESTADO</th>
                  <th>FECHA ALTA</th>
                  <th style={{ textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={activeTab !== 'CLIENTS' ? 7 : 6}
                      style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}
                    >
                      No se han encontrado usuarios con los criterios seleccionados.
                    </td>
                  </tr>
                )}

                {paginatedUsers.map((user: any) => {
                  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
                  const effectiveBrands = getEffectiveBrandNames(user);
                  const isBlocked = user.isActive === false;
                  const lacksBrands = !isBlocked && effectiveBrands.length === 0;

                  return (
                    <tr
                      key={user.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        opacity: isBlocked ? 0.65 : 1,
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: isBlocked
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'rgba(222, 255, 154, 0.1)',
                              color: isBlocked ? 'var(--danger)' : 'var(--lime)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span>{user.name || 'Sin nombre'}</span>
                              {user.codigo && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-strong)',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'JetBrains Mono, monospace',
                                  }}
                                >
                                  {user.codigo}
                                </span>
                              )}
                              {user.id === currentUserId && (
                                <span
                                  style={{
                                    fontSize: '0.66rem',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(222, 255, 154, 0.14)',
                                    color: 'var(--lime)',
                                  }}
                                >
                                  Tú
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Mail size={12} /> {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'var(--bg-elevated)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-strong)',
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            <Shield size={12} color="var(--lime)" />
                            {ROLE_LABELS[user.role] || user.role}
                          </div>
                          {user.isChannelSupervisor && user.role !== 'CANAL' && (
                            <span className="badge badge-process" style={{ fontSize: '0.68rem' }}>
                              Supervisor
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        {effectiveBrands.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {effectiveBrands.map((bName) => (
                              <span
                                key={bName}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.76rem',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <Building2 size={12} color="var(--text-muted)" />
                                {bName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.75rem',
                              color: 'var(--warning)',
                            }}
                          >
                            <AlertTriangle size={13} />
                            Sin marcas asignadas
                          </span>
                        )}
                      </td>

                      {activeTab !== 'CLIENTS' && (
                        <td>
                          {user.channel ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                              {user.channel.name}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                      )}

                      <td>
                        {isBlocked ? (
                          <span className="badge badge-danger">Bloqueado</span>
                        ) : lacksBrands ? (
                          <span className="badge badge-warning">Sin acceso</span>
                        ) : (
                          <span className="badge badge-active">Activo</span>
                        )}
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(user.createdAt).toLocaleDateString('es-ES')}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-ghost"
                          onClick={() => handleOpenModal(user)}
                          style={{ padding: '6px 12px', fontSize: '0.78rem', gap: 5 }}
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>
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
            totalItems={filteredUsers.length}
            itemName="usuarios"
            onPageChange={setPage}
            onItemsPerPageChange={(items) => {
              setItemsPerPage(items);
              setPage(1);
            }}
          />
        </div>
      </main>

      {isModalOpen && (
        <UserModal
          user={editingUser}
          brands={brands}
          companies={companies}
          channels={channels}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
