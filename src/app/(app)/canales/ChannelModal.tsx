import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

export default function ChannelModal({ channel, onClose, onSaved }: any) {
  const [formData, setFormData] = useState({
    nombre: channel?.nombre || '',
    codigo: channel?.codigo || '',
    comisionFijo: channel?.comisionFijo || 0,
    comisionVariable: channel?.comisionVariable || 0,
    email: channel?.email || '', // Supervisor
    adminEmail: channel?.adminEmail || '',
    managerEmail: channel?.managerEmail || '',
    supportEmail: channel?.supportEmail || '',
    autoGenerateContract: channel?.autoGenerateContract || false,
    maxRenewalDays: channel?.maxRenewalDays || 45,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      const isNew = !channel?.id;
      const url = isNew ? '/api/channels' : `/api/channels/${channel.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar el canal');
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-bottom-4 zoom-in-95">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-800/30">
          <div>
            <h2 className="text-lg font-bold text-white">{channel ? 'Editar Canal' : 'Nuevo Canal'}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {channel ? 'Modifica la información y permisos del canal' : 'Añade un nuevo colaborador al sistema'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sección 1: General */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-lime-400 uppercase tracking-wider mb-2">Datos Generales</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre del Canal</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej. Comercializadora Sur"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Código (ID Único)</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                  value={formData.codigo}
                  onChange={e => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ej. SUR"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Comisión Fija (€/MWh)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                  value={formData.comisionFijo}
                  onChange={e => setFormData({ ...formData, comisionFijo: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Comisión Variable (%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                  value={formData.comisionVariable}
                  onChange={e => setFormData({ ...formData, comisionVariable: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Sección 2: Contactos */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-lime-400 uppercase tracking-wider mb-2">Directorios de Contacto</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Supervisor</label>
                <input
                  type="email"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Administración</label>
                <input
                  type="email"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                  value={formData.adminEmail}
                  onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Gerencia</label>
                <input
                  type="email"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                  value={formData.managerEmail}
                  onChange={e => setFormData({ ...formData, managerEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Atención al Cliente</label>
                <input
                  type="email"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                  value={formData.supportEmail}
                  onChange={e => setFormData({ ...formData, supportEmail: e.target.value })}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Sección 3: Opciones */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-lime-400 uppercase tracking-wider mb-2">Configuración Avanzada</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 bg-slate-800 border border-slate-700 rounded-xl cursor-pointer hover:border-slate-600 transition-colors">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-lime-500 focus:ring-lime-500"
                  checked={formData.autoGenerateContract}
                  onChange={e => setFormData({ ...formData, autoGenerateContract: e.target.checked })}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">Generar Contratos Auto.</span>
                  <span className="text-xs text-slate-400">Generación automática de contratos</span>
                </div>
              </label>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Días Máx. Renovación</label>
                <input
                  type="number"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime-500"
                  value={formData.maxRenewalDays}
                  onChange={e => setFormData({ ...formData, maxRenewalDays: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Sección 4: Productos */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-lime-400 uppercase tracking-wider mb-2">Productos Asignados</h3>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              {channel?.products && channel.products.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {channel.products.map((p: any) => (
                    <span key={p.id} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600">
                      {p.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic text-center py-2">
                  No hay productos asignados a este canal.
                </p>
              )}
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-slate-900 bg-lime-400 hover:bg-lime-500 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Canal'}
          </button>
        </div>
      </div>
    </div>
  );
}
