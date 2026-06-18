'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Building2, Search, Edit2, Save, X, Check, Eye, EyeOff, Info, ArrowRight, Settings } from 'lucide-react';

export default function ComercializadorasClient({ initialCompanies }: { initialCompanies: any[] }) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const startEdit = (company: any) => {
    setEditingId(company.id);
    setFormData({ ...company });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(null);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const updated = await res.json();
        setCompanies(companies.map(c => c.id === updated.id ? updated : c));
        setEditingId(null);
      } else {
        alert('Error al guardar datos');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
    setLoading(false);
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Comercializadoras" subtitle="Gestión de empresas y datos regulatorios" />
      
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card animate-fade-in-up delay-200" style={{ padding: '16px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar comercializadora..." 
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
            />
          </div>
        </div>

        <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre Empresa</th>
                  <th>Código CRM</th>
                  <th>Dirección</th>
                  <th>Email</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>CIF</th>
                  <th>Orden CNMC</th>
                  <th>Alta CNMC</th>
                  <th>Baja CNMC</th>
                  <th>Alta SP</th>
                  <th>Baja SP</th>
                  <th>Representado</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(c => (
                  <React.Fragment key={c.id}>
                    <tr style={{ background: editingId === c.id ? 'var(--bg-elevated)' : 'transparent' }}>
                      <td style={{ fontWeight: 500, color: '#fff' }}>{c.name}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--amber)', fontWeight: 500 }}>{c.codigo || '-'}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.address || ''}>{c.address || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.email || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.contactPerson || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '-'}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{c.cif}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.ordenCnmc || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.fechaActivacionCnmc ? new Date(c.fechaActivacionCnmc).toLocaleDateString() : '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.fechaBajaCnmc ? new Date(c.fechaBajaCnmc).toLocaleDateString() : '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.fechaActivacionIsm ? new Date(c.fechaActivacionIsm).toLocaleDateString() : '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.fechaBajaIsm ? new Date(c.fechaBajaIsm).toLocaleDateString() : '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{c.representadoPor || '-'}</td>
                      <td>
                        {c.empresaVisible ? (
                          <span className="badge badge-active inline-flex"><Check size={10}/> Activa</span>
                        ) : (
                          <span className="badge badge-draft inline-flex">Inactiva</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {editingId === c.id ? (
                          <div className="flex justify-end gap-2">
                            <button className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors" onClick={cancelEdit}><X size={18} /></button>
                            <button className="bg-amber-500 hover:bg-amber-600 text-slate-900 p-1.5 rounded transition-colors" onClick={handleSave} disabled={loading}>
                              <Save size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition-colors" onClick={() => startEdit(c)}>
                              <Edit2 size={18} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    
                    {/* Editor en línea expandido */}
                    {editingId === c.id && (
                      <tr>
                        <td colSpan={15} style={{ padding: 0 }}>
                          <div style={{ padding: '24px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                              
                              {/* Columna Izquierda */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Building2 size={18} /> Datos de Empresa
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Comercializadora (Nombre)</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.name || ''} onChange={e => handleChange('name', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">CIF</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.cif || ''} onChange={e => handleChange('cif', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Código Interno CRM</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.codigo || ''} onChange={e => handleChange('codigo', e.target.value)} />
                                  </div>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <label className="text-xs text-slate-400 mb-1 block">Dirección</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Email</label>
                                    <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.email || ''} onChange={e => handleChange('email', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Teléfono</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.phone || ''} onChange={e => handleChange('phone', e.target.value)} />
                                  </div>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <label className="text-xs text-slate-400 mb-1 block">Persona de Contacto</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.contactPerson || ''} onChange={e => handleChange('contactPerson', e.target.value)} />
                                  </div>
                                </div>

                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                                  <Settings size={18} /> Configuración General
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input type="checkbox" checked={formData.residenciaCanarias} onChange={e => handleChange('residenciaCanarias', e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" /> Residencia en Canarias
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input type="checkbox" checked={formData.exportableOdoo} onChange={e => handleChange('exportableOdoo', e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" /> Exportable a ODOO
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input type="checkbox" checked={formData.empresaVisible} onChange={e => handleChange('empresaVisible', e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" /> Empresa visible
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input type="checkbox" checked={formData.emisionFacturasCliente} onChange={e => handleChange('emisionFacturasCliente', e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" /> Emisión facturas cliente
                                  </label>
                                </div>
                              </div>

                              {/* Columna Derecha */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Info size={18} /> Códigos de Mercado (OMIE/REE/CNMC)
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Código REE</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.codigoRee || ''} onChange={e => handleChange('codigoRee', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Código ACER</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.codigoAcer || ''} onChange={e => handleChange('codigoAcer', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Unidad Oferta OMIE</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.unidadOfertaOmie || ''} onChange={e => handleChange('unidadOfertaOmie', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">REMIT</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.remit || ''} onChange={e => handleChange('remit', e.target.value)} />
                                  </div>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <label className="text-xs text-slate-400 mb-1 block">Código Sujeto Mercado</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.codigoSujetoMercado || ''} onChange={e => handleChange('codigoSujetoMercado', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Orden CNMC</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.ordenCnmc || ''} onChange={e => handleChange('ordenCnmc', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Representado por</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.representadoPor || ''} onChange={e => handleChange('representadoPor', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Fecha Activación CNMC</label>
                                    <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.fechaActivacionCnmc ? new Date(formData.fechaActivacionCnmc).toISOString().split('T')[0] : ''} onChange={e => handleChange('fechaActivacionCnmc', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Fecha Baja CNMC</label>
                                    <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.fechaBajaCnmc ? new Date(formData.fechaBajaCnmc).toISOString().split('T')[0] : ''} onChange={e => handleChange('fechaBajaCnmc', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Fecha Activación SP</label>
                                    <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.fechaActivacionIsm ? new Date(formData.fechaActivacionIsm).toISOString().split('T')[0] : ''} onChange={e => handleChange('fechaActivacionIsm', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Fecha Baja SP</label>
                                    <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.fechaBajaIsm ? new Date(formData.fechaBajaIsm).toISOString().split('T')[0] : ''} onChange={e => handleChange('fechaBajaIsm', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={15} className="text-center py-8 text-slate-400">
                      No se encontraron comercializadoras.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
