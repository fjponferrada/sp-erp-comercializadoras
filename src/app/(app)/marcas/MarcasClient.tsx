'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Tag, Search, Edit2, Save, X, Check, Building2, Palette, Mail, Settings, Link as LinkIcon, DollarSign } from 'lucide-react';

export default function MarcasClient({ initialBrands }: { initialBrands: any[] }) {
  const [brands, setBrands] = useState(initialBrands);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const startEdit = (brand: any) => {
    setEditingId(brand.id);
    setFormData({ ...brand });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(null);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brands/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const updated = await res.json();
        setBrands(brands.map(b => b.id === updated.id ? updated : b));
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
      <Topbar title="Marcas" subtitle="Gestión de marcas comerciales y configuración" />
      
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar marca..." 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
            />
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Código Marca</th>
                  <th className="px-6 py-4">Nombre Marca</th>
                  <th className="px-6 py-4">Empresa Matriz</th>
                  <th className="px-6 py-4">Dirección</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">Teléfono</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {brands.map(b => (
                  <React.Fragment key={b.id}>
                    <tr className="hover:bg-slate-700/30 transition-colors" style={{ background: editingId === b.id ? 'rgba(51, 65, 85, 0.5)' : 'transparent' }}>
                      <td className="px-6 py-4 font-mono text-slate-300">{b.codigoMarca || b.slug}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white flex items-center gap-2">
                          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: b.accentColor || 'var(--lime)' }} />
                          {b.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{b.company?.name}</div>
                        <div className="text-xs text-slate-400 mt-1">{b.company?.cif}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 max-w-[200px] truncate" title={b.address || ''}>{b.address || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{b.email || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{b.contactPerson || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{b.phone || '-'}</td>
                      <td className="px-6 py-4">
                        {b.marcaVisible ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">
                            <Check size={12}/> Visible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded">
                            Oculta
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingId === b.id ? (
                          <div className="flex justify-end gap-2">
                            <button className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors" onClick={cancelEdit}><X size={18} /></button>
                            <button className="bg-amber-500 hover:bg-amber-600 text-slate-900 p-1.5 rounded transition-colors" onClick={handleSave} disabled={loading}>
                              <Save size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition-colors" onClick={() => startEdit(b)}>
                              <Edit2 size={18} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    
                    {/* Editor en línea expandido */}
                    {editingId === b.id && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <div style={{ padding: '24px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                              
                              {/* Columna Izquierda */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Tag size={18} /> Datos de la Marca
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Código Marca</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.codigoMarca || ''} onChange={e => handleChange('codigoMarca', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Nombre Marca</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.name || ''} onChange={e => handleChange('name', e.target.value)} />
                                  </div>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <label className="text-xs text-slate-400 mb-1 block">Dirección</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Teléfono</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.phone || ''} onChange={e => handleChange('phone', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Persona de contacto</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.contactPerson || ''} onChange={e => handleChange('contactPerson', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Email Contacto</label>
                                    <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.email || ''} onChange={e => handleChange('email', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Factura Eléctrica (Remitente)</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.facturaElectrica || ''} onChange={e => handleChange('facturaElectrica', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Clave (Envío)</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.clave || ''} onChange={e => handleChange('clave', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Envíos por hora</label>
                                    <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.enviosPorHora || ''} onChange={e => handleChange('enviosPorHora', parseInt(e.target.value) || null)} />
                                  </div>
                                </div>

                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                                  <Settings size={18} /> Flags & Operativa
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input type="checkbox" checked={formData.marcaVisible} onChange={e => handleChange('marcaVisible', e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" /> Marca visible
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input type="checkbox" checked={formData.gestionTickets} onChange={e => handleChange('gestionTickets', e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" /> Gestión de tickets
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input type="checkbox" checked={formData.envioPromocion} onChange={e => handleChange('envioPromocion', e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" /> Envío Promoción
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input type="checkbox" checked={formData.envioCliente} onChange={e => handleChange('envioCliente', e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" /> Envío Cliente
                                  </label>
                                  <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input type="checkbox" checked={formData.envioCorreo} onChange={e => handleChange('envioCorreo', e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" /> Envío Correo
                                  </label>
                                </div>
                              </div>

                              {/* Columna Derecha */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Mail size={18} /> Textos & Comunicaciones
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Mensaje Email por defecto</label>
                                    <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" rows={3} value={formData.mensaje || ''} onChange={e => handleChange('mensaje', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Texto promocional</label>
                                    <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" rows={2} value={formData.textoPromocional || ''} onChange={e => handleChange('textoPromocional', e.target.value)} />
                                  </div>
                                </div>

                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                                  <LinkIcon size={18} /> Enlaces & Penalizaciones
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <label className="text-xs text-slate-400 mb-1 block">URL Manual (Condiciones)</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.manual || ''} onChange={e => handleChange('manual', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Penalización (%)</label>
                                    <div className="relative">
                                      <input type="number" step="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white pr-8" value={formData.penalizacion || ''} onChange={e => handleChange('penalizacion', parseFloat(e.target.value) || null)} />
                                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">%</div>
                                    </div>
                                  </div>
                                </div>

                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                                  <Palette size={18} /> Identidad Visual
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <label className="text-xs text-slate-400 mb-1 block">URL Logo / Imagen</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.logoUrl || ''} onChange={e => handleChange('logoUrl', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Color Acento (HEX)</label>
                                    <div className="flex gap-2">
                                      <input type="color" value={formData.accentColor || '#DEFF9A'} onChange={e => handleChange('accentColor', e.target.value)} className="h-9 w-9 rounded cursor-pointer bg-transparent border-0 p-0" />
                                      <input type="text" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white uppercase" value={formData.accentColor || ''} onChange={e => handleChange('accentColor', e.target.value)} />
                                    </div>
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
                {brands.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-400">
                      No se encontraron marcas.
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
