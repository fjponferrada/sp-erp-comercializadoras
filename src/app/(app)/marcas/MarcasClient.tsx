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
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Marcas" subtitle="Gestión de marcas comerciales y configuración" />
      
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card animate-fade-in-up delay-200" style={{ padding: '16px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar marca..." 
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
                  <th>Código Marca</th>
                  <th>Nombre Marca</th>
                  <th>Empresa Matriz</th>
                  <th>Dirección</th>
                  <th>Email</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {brands.map(b => (
                  <React.Fragment key={b.id}>
                    <tr style={{ background: editingId === b.id ? 'var(--bg-elevated)' : 'transparent' }}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{b.codigoMarca || b.slug}</td>
                      <td>
                        <div style={{ fontWeight: 500, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: b.accentColor || 'var(--lime)' }} />
                          {b.name}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.company?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{b.company?.cif}</div>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.address || ''}>{b.address || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{b.email || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{b.contactPerson || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{b.phone || '-'}</td>
                      <td>
                        {b.marcaVisible ? (
                          <span className="badge badge-active inline-flex"><Check size={10}/> Visible</span>
                        ) : (
                          <span className="badge badge-draft inline-flex">Oculta</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
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
                                    <label className="text-xs text-slate-400 mb-1 block">Email (General)</label>
                                    <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.email || ''} onChange={e => handleChange('email', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Email (At. Cliente / Facturación)</label>
                                    <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.supportEmail || ''} onChange={e => handleChange('supportEmail', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Teléfono Fijo</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.phone || ''} onChange={e => handleChange('phone', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Teléfono WhatsApp</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.whatsappPhone || ''} onChange={e => handleChange('whatsappPhone', e.target.value)} />
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
                                    <label className="text-xs text-slate-400 mb-1 block">Logotipo Pequeño (Panel)</label>
                                    <div className="flex gap-2">
                                      <input type="text" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.logoUrl || ''} onChange={e => handleChange('logoUrl', e.target.value)} placeholder="https://..." />
                                      <input 
                                        type="file" 
                                        accept="image/*"
                                        id="logo-upload"
                                        style={{ display: 'none' }}
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const form = new FormData();
                                          form.append('file', file);
                                          try {
                                            const res = await fetch('/api/upload', { method: 'POST', body: form });
                                            if (res.ok) {
                                              const data = await res.json();
                                              handleChange('logoUrl', data.url);
                                            } else {
                                              alert("Error subiendo el logo");
                                            }
                                          } catch (err) {
                                            alert("Error de red al subir");
                                          }
                                        }}
                                      />
                                      <label htmlFor="logo-upload" className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg cursor-pointer text-sm flex items-center justify-center">Subir</label>
                                    </div>
                                  </div>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <label className="text-xs text-slate-400 mb-1 block">Logotipo Completo (Facturas e Emails)</label>
                                    <div className="flex gap-2">
                                      <input type="text" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.invoiceLogoUrl || ''} onChange={e => handleChange('invoiceLogoUrl', e.target.value)} placeholder="https://..." />
                                      <input 
                                        type="file" 
                                        accept="image/*"
                                        id="invoice-logo-upload"
                                        style={{ display: 'none' }}
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const form = new FormData();
                                          form.append('file', file);
                                          try {
                                            const res = await fetch('/api/upload', { method: 'POST', body: form });
                                            if (res.ok) {
                                              const data = await res.json();
                                              handleChange('invoiceLogoUrl', data.url);
                                            } else {
                                              alert("Error subiendo el logo");
                                            }
                                          } catch (err) {
                                            alert("Error de red al subir");
                                          }
                                        }}
                                      />
                                      <label htmlFor="invoice-logo-upload" className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg cursor-pointer text-sm flex items-center justify-center">Subir</label>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Color Acento (HEX)</label>
                                    <div className="flex gap-2">
                                      <input type="color" value={formData.accentColor || '#DEFF9A'} onChange={e => handleChange('accentColor', e.target.value)} className="h-9 w-9 rounded cursor-pointer bg-transparent border-0 p-0" />
                                      <input type="text" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white uppercase" value={formData.accentColor || ''} onChange={e => handleChange('accentColor', e.target.value)} />
                                    </div>
                                  </div>
                                </div>

                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                                  Cuentas Bancarias para Transferencias
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Entidad 1</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.bankName1 || ''} onChange={e => handleChange('bankName1', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">IBAN 1</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.bankIban1 || ''} onChange={e => handleChange('bankIban1', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Entidad 2</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.bankName2 || ''} onChange={e => handleChange('bankName2', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">IBAN 2</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.bankIban2 || ''} onChange={e => handleChange('bankIban2', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Entidad 3</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.bankName3 || ''} onChange={e => handleChange('bankName3', e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">IBAN 3</label>
                                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white" value={formData.bankIban3 || ''} onChange={e => handleChange('bankIban3', e.target.value)} />
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
    </div>
  );
}
