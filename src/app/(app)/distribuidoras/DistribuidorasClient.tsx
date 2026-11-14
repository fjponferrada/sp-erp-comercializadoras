'use client';

import { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { Building2, Edit2, Server, Globe, Save, X, AlertCircle, AlertTriangle } from 'lucide-react';
import { useBrandTheme } from '@/context/BrandThemeContext';
import toast from 'react-hot-toast';

function getSyncAgeStatus(lastSyncAt?: string | Date | null): { label: string; colorClass: string; isStale: boolean } {
  if (!lastSyncAt) {
    return { label: 'Nunca sincronizada', colorClass: 'text-amber-400', isStale: true };
  }
  const date = new Date(lastSyncAt);
  const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  const formatted = date.toLocaleString('es-ES');
  if (diffHours > 36) {
    const days = Math.floor(diffHours / 24);
    return { label: `${formatted} (hace ${days}d — revisar)`, colorClass: 'text-red-400 font-semibold', isStale: true };
  }
  if (diffHours > 12) {
    return { label: `${formatted} (hace ${Math.round(diffHours)}h)`, colorClass: 'text-amber-400', isStale: true };
  }
  return { label: formatted, colorClass: 'text-primary-400', isStale: false };
}

export default function DistribuidorasClient() {
  const theme = useBrandTheme();
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    setEditingId(null);
    setIsCreating(false);
    fetchDistributors();
  }, [theme.name]);

  const fetchDistributors = async () => {
    try {
      const res = await fetch('/api/distributors');
      const data = await res.json();
      setDistributors(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar las distribuidoras');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (distributor: any) => {
    setEditingId(distributor.id);
    setIsCreating(false);
    setEditForm({
      ...distributor,
      ftpPassword: '',
      webPassword: '',
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    setEditForm({
      name: '',
      reeCode: '',
      ftpPort: 21,
      ftpActive: false,
      ftpPassword: '',
      webScrapingActive: false,
      webPassword: '',
      webScriptPath: '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!editingId && !isCreating) return;
    setSaving(true);
    try {
      const url = isCreating ? '/api/distributors' : `/api/distributors/${editingId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast.success(isCreating ? 'Distribuidora creada correctamente' : 'Configuración guardada correctamente');
        await fetchDistributors();
        setEditingId(null);
        setIsCreating(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || 'Error al guardar la configuración');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de red al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Datos Distribuidora" subtitle="Gestión de distribuidoras, conexiones FTP/SFTP (CCH) y Scraping Web (SCTD / F1)" />

      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
        <div className="bg-[#121E23] border border-slate-700/50 rounded-lg p-4 mb-6 flex items-start space-x-4 animate-fade-in">
          <AlertCircle className="text-yellow-500 w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <p className="font-semibold text-white mb-1">Concentradoras de Distribuidoras Independientes</p>
            <p>Para las pequeñas distribuidoras agrupadas bajo una concentradora (ej: CIDE o ASEME), solo necesitas configurar las credenciales en la entrada de la concentradora. El motor ETL leerá los CUPS de los ficheros y los asignará automáticamente a las facturas y clientes correspondientes.</p>
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in">
          <input
            type="text"
            placeholder="Buscar por nombre o código REE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input w-full max-w-md"
          />
          <button onClick={startCreate} className="btn-primary px-4 py-2 flex-shrink-0">
            + Añadir Concentradora / Distribuidora
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {isCreating && (
              <div className="card p-6 animate-fade-in-up border border-primary-500/50">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-4">
                    <div className="flex items-center space-x-3">
                      <Building2 className="text-primary-400 w-5 h-5" />
                      <h3 className="font-semibold text-white">Nueva Concentradora / Distribuidora</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Nombre (ej: CIDE)</label>
                      <input type="text" className="form-input w-full" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="CIDE Concentradora" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Código REE (o identificador)</label>
                      <input type="text" className="form-input w-full" value={editForm.reeCode || ''} onChange={e => setEditForm({ ...editForm, reeCode: e.target.value })} placeholder="CIDE-001" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Host FTP / SFTP</label>
                      <input type="text" className="form-input w-full" value={editForm.ftpHost || ''} onChange={e => setEditForm({ ...editForm, ftpHost: e.target.value })} placeholder="ftp.ejemplo.com" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Puerto</label>
                      <input type="number" className="form-input w-full" value={editForm.ftpPort || 21} onChange={e => setEditForm({ ...editForm, ftpPort: e.target.value })} placeholder="21" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Usuario FTP</label>
                      <input type="text" className="form-input w-full" value={editForm.ftpUser || ''} onChange={e => setEditForm({ ...editForm, ftpUser: e.target.value })} placeholder="user123" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Contraseña FTP</label>
                      <input type="password" className="form-input w-full" value={editForm.ftpPassword || ''} onChange={e => setEditForm({ ...editForm, ftpPassword: e.target.value })} placeholder="Introduce contraseña" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Ruta Remota (Carpeta)</label>
                      <input type="text" className="form-input w-full" value={editForm.ftpTargetPath || ''} onChange={e => setEditForm({ ...editForm, ftpTargetPath: e.target.value })} placeholder="/public/cch/" />
                    </div>
                    <div className="col-span-2 flex items-center mt-2">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" className="form-checkbox bg-[#16272E] border-slate-600 text-primary-500 rounded focus:ring-primary-500 focus:ring-offset-[#16272E]" checked={editForm.ftpActive || false} onChange={e => setEditForm({ ...editForm, ftpActive: e.target.checked })} />
                        <span className="text-sm font-medium text-slate-300">Activar sincronización automática FTP/SFTP (Curvas CCH)</span>
                      </label>
                    </div>

                    <div className="col-span-2 pt-4 border-t border-slate-700/50 mt-2">
                      <h4 className="text-sm font-semibold text-white mb-2">Configuración Web Scraping (SCTD y F1)</h4>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Usuario Portal Web</label>
                      <input type="text" className="form-input w-full" value={editForm.webUser || ''} onChange={e => setEditForm({ ...editForm, webUser: e.target.value })} placeholder="DNI / Usuario" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Contraseña Portal Web</label>
                      <input type="password" className="form-input w-full" value={editForm.webPassword || ''} onChange={e => setEditForm({ ...editForm, webPassword: e.target.value })} placeholder="Introduce contraseña" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Script Python en Worker (C:\Scrapping)</label>
                      <input type="text" className="form-input w-full font-mono text-xs" value={editForm.webScriptPath || ''} onChange={e => setEditForm({ ...editForm, webScriptPath: e.target.value })} placeholder="ej: scrapping-ENDESA-CRM.py (opcional si autodetecta por nombre)" />
                    </div>
                    <div className="col-span-2 flex items-center mt-2">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" className="form-checkbox bg-[#16272E] border-slate-600 text-primary-500 rounded focus:ring-primary-500 focus:ring-offset-[#16272E]" checked={editForm.webScrapingActive || false} onChange={e => setEditForm({ ...editForm, webScrapingActive: e.target.checked })} />
                        <span className="text-sm font-medium text-slate-300">Activar Scraping Automático de ficheros SCTD y F1 (XML)</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button onClick={cancelEdit} className="btn-secondary px-4 py-2 flex items-center"><X className="w-4 h-4 mr-2" /> Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 flex items-center">
                      {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Save className="w-4 h-4 mr-2" />}
                      Crear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {distributors.filter(dist =>
              dist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (dist.reeCode && dist.reeCode.toLowerCase().includes(searchTerm.toLowerCase()))
            ).map(dist => {
              const ftpSyncInfo = getSyncAgeStatus(dist.ftpLastSyncAt);
              const webSyncInfo = getSyncAgeStatus(dist.webLastSyncAt);

              return (
                <div key={dist.id} className="card p-6 animate-fade-in-up">
                  {editingId === dist.id ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-4">
                        <div className="flex items-center space-x-3">
                          <Building2 className="text-primary-400 w-5 h-5" />
                          <h3 className="font-semibold text-white">{dist.name}</h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Host FTP / SFTP</label>
                          <input type="text" className="form-input w-full" value={editForm.ftpHost || ''} onChange={e => setEditForm({ ...editForm, ftpHost: e.target.value })} placeholder="ftp.ejemplo.com" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Puerto</label>
                          <input type="number" className="form-input w-full" value={editForm.ftpPort || 21} onChange={e => setEditForm({ ...editForm, ftpPort: e.target.value })} placeholder="21" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Usuario FTP</label>
                          <input type="text" className="form-input w-full" value={editForm.ftpUser || ''} onChange={e => setEditForm({ ...editForm, ftpUser: e.target.value })} placeholder="user123" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Contraseña FTP {editForm.hasFtpPassword && <span className="text-emerald-400">(guardada)</span>}
                          </label>
                          <input
                            type="password"
                            className="form-input w-full"
                            value={editForm.ftpPassword || ''}
                            onChange={e => setEditForm({ ...editForm, ftpPassword: e.target.value })}
                            placeholder={editForm.hasFtpPassword ? '•••••••• (dejar vacío para mantener)' : 'Introduce contraseña'}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-400 mb-1">Ruta Remota (Carpeta)</label>
                          <input type="text" className="form-input w-full" value={editForm.ftpTargetPath || ''} onChange={e => setEditForm({ ...editForm, ftpTargetPath: e.target.value })} placeholder="/public/cch/" />
                        </div>
                        <div className="col-span-2 flex items-center mt-2">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" className="form-checkbox bg-[#16272E] border-slate-600 text-primary-500 rounded focus:ring-primary-500 focus:ring-offset-[#16272E]" checked={editForm.ftpActive || false} onChange={e => setEditForm({ ...editForm, ftpActive: e.target.checked })} />
                            <span className="text-sm font-medium text-slate-300">Activar sincronización automática FTP/SFTP (Curvas CCH)</span>
                          </label>
                        </div>

                        <div className="col-span-2 pt-4 border-t border-slate-700/50 mt-2">
                          <h4 className="text-sm font-semibold text-white mb-2">Configuración Web Scraping (SCTD y F1)</h4>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Usuario Portal Web</label>
                          <input type="text" className="form-input w-full" value={editForm.webUser || ''} onChange={e => setEditForm({ ...editForm, webUser: e.target.value })} placeholder="DNI / Usuario" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Contraseña Portal Web {editForm.hasWebPassword && <span className="text-emerald-400">(guardada)</span>}
                          </label>
                          <input
                            type="password"
                            className="form-input w-full"
                            value={editForm.webPassword || ''}
                            onChange={e => setEditForm({ ...editForm, webPassword: e.target.value })}
                            placeholder={editForm.hasWebPassword ? '•••••••• (dejar vacío para mantener)' : 'Introduce contraseña'}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-400 mb-1">Script Python en Worker (C:\Scrapping)</label>
                          <input type="text" className="form-input w-full font-mono text-xs" value={editForm.webScriptPath || ''} onChange={e => setEditForm({ ...editForm, webScriptPath: e.target.value })} placeholder="ej: scrapping-ENDESA-CRM.py" />
                        </div>
                        <div className="col-span-2 flex items-center mt-2">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" className="form-checkbox bg-[#16272E] border-slate-600 text-primary-500 rounded focus:ring-primary-500 focus:ring-offset-[#16272E]" checked={editForm.webScrapingActive || false} onChange={e => setEditForm({ ...editForm, webScrapingActive: e.target.checked })} />
                            <span className="text-sm font-medium text-slate-300">Activar Scraping Automático de ficheros SCTD y F1 (XML)</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3 pt-4">
                        <button onClick={cancelEdit} className="btn-secondary px-4 py-2 flex items-center"><X className="w-4 h-4 mr-2" /> Cancelar</button>
                        <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 flex items-center">
                          {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Save className="w-4 h-4 mr-2" />}
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-4">
                        <div className="flex items-center space-x-3">
                          <Building2 className="text-primary-400 w-5 h-5" />
                          <div>
                            <h3 className="font-semibold text-white">{dist.name}</h3>
                            <p className="text-xs text-slate-400">Código REE: {dist.reeCode}</p>
                          </div>
                        </div>
                        <button onClick={() => startEdit(dist)} className="p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded transition-colors" title="Editar configuración">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        {/* BLOQUE FTP CCH */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-sm text-slate-300">
                            <Server className="w-4 h-4 text-slate-500" />
                            <span>Sincronización FTP / SFTP (Curvas CCH):</span>
                          </div>
                          {dist.ftpActive ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                              Activo
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              Inactivo
                            </span>
                          )}
                        </div>

                        {dist.ftpActive && dist.ftpHost && (
                          <div className="bg-[#121E23] rounded p-3 text-xs font-mono text-slate-400 space-y-1">
                            <p><span className="text-slate-500">Host:</span> {dist.ftpHost}:{dist.ftpPort}</p>
                            <p><span className="text-slate-500">User:</span> {dist.ftpUser || '—'}</p>
                            <p><span className="text-slate-500">Ruta:</span> {dist.ftpTargetPath || '/'}</p>
                            <p className={`pt-2 mt-2 border-t border-slate-700/50 flex items-center gap-1.5 ${ftpSyncInfo.colorClass}`}>
                              {ftpSyncInfo.isStale && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                              <span>Última sinc FTP: {ftpSyncInfo.label}</span>
                            </p>
                          </div>
                        )}

                        {/* BLOQUE WEB SCRAPING SCTD / F1 */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                          <div className="flex items-center space-x-2 text-sm text-slate-300">
                            <Globe className="w-4 h-4 text-slate-500" />
                            <span>Scraping Portal Web (SCTD / F1):</span>
                          </div>
                          {dist.webScrapingActive ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                              Activo
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              Inactivo
                            </span>
                          )}
                        </div>

                        {dist.webScrapingActive && (
                          <div className="bg-[#121E23] rounded p-3 text-xs font-mono text-slate-400 space-y-1">
                            <p><span className="text-slate-500">Usuario Web:</span> {dist.webUser || '—'}</p>
                            {dist.webScriptPath && (
                              <p><span className="text-slate-500">Script:</span> {dist.webScriptPath}</p>
                            )}
                            <p className={`pt-2 mt-2 border-t border-slate-700/50 flex items-center gap-1.5 ${webSyncInfo.colorClass}`}>
                              {webSyncInfo.isStale && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                              <span>Última sinc Web: {webSyncInfo.label}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
