'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Plus, Search, Edit2, Mail, Shield, Building2 } from 'lucide-react';
import UserModal from './UserModal';
import { useRouter } from 'next/navigation';

export default function UsersClient({ initialUsers, brands, companies, channels }: any) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const router = useRouter();

  const filteredUsers = initialUsers.filter((u: any) => 
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenModal = (user = null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Topbar
        title="Usuarios y Accesos"
        subtitle="Gestiona los accesos, roles y marcas de tu equipo"
        action={{ label: 'Nuevo Usuario', onClick: () => handleOpenModal() }}
      />

      <main style={{ padding: '28px 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
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
                Base de Usuarios
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                    name="search-users-new"
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck="false"
                    className="form-input"
                    style={{ paddingLeft: 32, width: 260, fontSize: '0.85rem' }}
                    placeholder="Buscar por nombre, email o rol..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>USUARIO</th>
                  <th>ROL</th>
                  <th>MARCA PRINCIPAL</th>
                  <th>CANAL ASIGNADO</th>
                  <th>FECHA ALTA</th>
                  <th style={{ textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user: any) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'rgba(222, 255, 154, 0.1)', color: 'var(--lime)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                        }}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-strong)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <Shield size={12} color="var(--lime)" />
                        {user.role === 'CLIENT' ? 'CLIENTE' : user.role}
                      </div>
                    </td>
                    <td>
                      {user.brand ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                          <Building2 size={14} color="var(--text-muted)" />
                          {user.brand.name}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {user.channel ? <span style={{ fontSize: '0.8rem' }}>{user.channel.name}</span> : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>-</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(user.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-ghost" onClick={() => handleOpenModal(user)} style={{ padding: '6px 12px', fontSize: '0.78rem', gap: 5 }}>
                        <Edit2 size={14} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <UserModal 
          user={editingUser} 
          brands={brands}
          companies={companies}
          channels={channels}
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
