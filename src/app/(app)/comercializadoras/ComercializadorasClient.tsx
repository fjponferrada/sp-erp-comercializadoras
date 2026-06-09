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
    <>
      <Topbar title="Comercializadoras" subtitle="Gestión de empresas y datos regulatorios" />
      
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar comercializadora..." 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Nombre Empresa</th>
                  <th className="px-6 py-4">Dirección</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">Teléfono</th>
                  <th className="px-6 py-4">CIF</th>
                  <th className="px-6 py-4">Orden CNMC</th>
                  <th className="px-6 py-4">Alta CNMC</th>
                  <th className="px-6 py-4">Baja CNMC</th>
                  <th className="px-6 py-4">Alta SP</th>
                  <th className="px-6 py-4">Baja SP</th>
                  <th className="px-6 py-4">Representado</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {companies.map(c => (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-slate-700/30 transition-colors" style={{ background: editingId === c.id ? 'rgba(51, 65, 85, 0.5)' : 'transparent' }}>
                      <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                      <td className="px-6 py-4 text-xs text-slate-400 max-w-[200px] truncate" title={c.address || ''}>{c.address || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{c.email || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{c.contactPerson || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{c.phone || '-'}</td>
                      <td className="px-6 py-4 font-mono text-slate-300">{c.cif}</td>
                      <td className="px-6 py-4 text-slate-300">{c.ordenCnmc || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{c.fechaActivacionCnmc ? new Date(c.fechaActivacionCnmc).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{c.fechaBajaCnmc ? new Date(c.fechaBajaCnmc).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{c.fechaActivacionIsm ? new Date(c.fechaActivacionIsm).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{c.fechaBajaIsm ? new Date(c.fechaBajaIsm).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{c.representadoPor || '-'}</td>
                      <td className="px-6 py-4">
                        {c.empresaVisible ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">
                            <Check size={12}/> Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded">
                            Inactiva
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
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
                        <td colSpan={14} style={{ padding: 0 }}>
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
                    <td colSpan={14} className="text-center py-8 text-slate-400">
                      No se encontraron comercializadoras.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
