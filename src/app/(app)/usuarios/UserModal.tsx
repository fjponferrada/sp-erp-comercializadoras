'use client';

import React, { useState } from 'react';
import { X, Save, ShieldAlert } from 'lucide-react';

export default function UserModal({ user, brands, companies, channels, onClose, onSaved }: any) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'COMERCIAL',
    assignedCompanyIds: user?.companies?.map((c: any) => c.id) || [],
    assignedBrandIds: user?.assignedBrands?.map((b: any) => b.id) || [],
    channelId: user?.channelId || '',
    phone: user?.phone || '',
    codigo: user?.codigo || '',
    isChannelSupervisor: user?.isChannelSupervisor || false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    if (formData.role === 'CANAL' && !formData.channelId) {
      setError('El rol Jefe de Canal requiere obligatoriamente seleccionar un Canal de Ventas.');
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch(user ? `/api/users/${user.id}` : '/api/users', {
        method: user ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar el usuario');
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-base)', border: '1px solid var(--border-strong)',
        borderRadius: '12px', width: '100%', maxWidth: '500px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-elevated)'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            {user ? 'Editar Usuario' : 'Nuevo Usuario'}
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} /> {error}
          </div>}
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Nombre Completo</label>
            <input name="name" value={formData.name} onChange={handleChange} className="form-input" style={{ width: '100%' }} placeholder="Ej. Pablo Remacha" />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Email</label>
            <input name="email" value={formData.email} onChange={handleChange} className="form-input" style={{ width: '100%' }} placeholder="ejemplo@aedenergia.es" />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Contraseña {user && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Dejar en blanco para no cambiar)</span>}
            </label>
            <input name="password" type="password" value={formData.password} onChange={handleChange} className="form-input" style={{ width: '100%' }} placeholder={user ? "Nueva contraseña..." : "Contraseña de acceso..."} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Rol de Sistema</label>
              <select name="role" value={formData.role} onChange={handleChange} className="form-input" style={{ width: '100%' }}>
                <option value="COMERCIAL">Comercial</option>
                <option value="CANAL">Jefe de Canal</option>
                <option value="BACKOFFICE">Backoffice</option>
                <option value="COMPANYADMIN">Responsable Empresa</option>
                <option value="SUPERADMIN">Superadmin</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Teléfono</label>
              <input name="phone" value={formData.phone} onChange={handleChange} className="form-input" style={{ width: '100%' }} placeholder="+34..." />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Código (p.ej. MP)</label>
              <input name="codigo" value={formData.codigo} onChange={handleChange} className="form-input" style={{ width: '100%' }} placeholder="Código comercial..." />
            </div>
          </div>

          {(formData.role === 'CANAL' || formData.role === 'COMERCIAL') && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Canal de Ventas {formData.role === 'CANAL' ? '(Obligatorio)' : '(Opcional)'}</label>
              <select name="channelId" value={formData.channelId} onChange={handleChange} className="form-input" style={{ width: '100%' }}>
                <option value="">Sin canal específico</option>
                {channels.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {formData.channelId && formData.channelId !== '' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="isChannelSupervisor"
                    checked={formData.isChannelSupervisor}
                    onChange={(e) => setFormData({ ...formData, isChannelSupervisor: e.target.checked })}
                  />
                  Este usuario es el Supervisor del Canal
                </label>
              )}
            </div>
          )}

          {((formData.role !== 'CANAL' && formData.role !== 'COMERCIAL') || !formData.channelId) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Comercializadoras Autorizadas</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', background: 'var(--bg-elevated)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {companies.map((c: any) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.assignedCompanyIds.includes(c.id)}
                      onChange={(e) => {
                        let newCompanyIds = e.target.checked 
                          ? [...formData.assignedCompanyIds, c.id] 
                          : formData.assignedCompanyIds.filter((id: string) => id !== c.id);
                        
                        // Si desmarcamos, limpiamos las marcas asociadas a esa comercializadora
                        let newBrandIds = formData.assignedBrandIds;
                        if (!e.target.checked) {
                          const brandIdsToRemove = c.brands?.map((b: any) => b.id) || [];
                          newBrandIds = formData.assignedBrandIds.filter((id: string) => !brandIdsToRemove.includes(id));
                        }

                        setFormData({ ...formData, assignedCompanyIds: newCompanyIds, assignedBrandIds: newBrandIds });
                      }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Marcas Autorizadas</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', background: 'var(--bg-elevated)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                {formData.assignedCompanyIds.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selecciona una comercializadora primero</span>
                ) : (
                  brands.filter((b: any) => formData.assignedCompanyIds.includes(b.companyId)).map((b: any) => (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.assignedBrandIds.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, assignedBrandIds: [...formData.assignedBrandIds, b.id] });
                          } else {
                            setFormData({ ...formData, assignedBrandIds: formData.assignedBrandIds.filter((id: string) => id !== b.id) });
                          }
                        }}
                      />
                      {b.name}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          )}

        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-elevated)' }}>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={16} />
            {loading ? 'Guardando...' : 'Guardar Usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}
