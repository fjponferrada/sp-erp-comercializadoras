'use client';

import { useState } from 'react';
import { createLeadAction } from '@/app/actions/leadActions';
import { X, Sun, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSuccess: (leadId: string) => void;
}

export default function NewSolarLeadModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    formData.append('type', 'FV'); // Forzar tipo FV

    try {
      const res = await createLeadAction(formData);
      if (res.success) {
        onSuccess(res.leadId);
      }
    } catch (err: any) {
      setError(err.message || 'Error al crear la oportunidad FV');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg shadow-2xl relative" style={{ borderTop: '4px solid #FCD34D' }}>
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: '#FCD34D' }}>
          <Sun size={24} />
          Nuevo Estudio Autoconsumo (FV)
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Nombre del Cliente / Empresa *</label>
            <input 
              type="text" 
              name="businessName" 
              required 
              className="form-input"
              placeholder="Ej: Juan Pérez o Empresa S.L."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">NIF / CIF</label>
              <input type="text" name="vatNumber" className="form-input" />
            </div>
            <div>
              <label className="form-label">CUPS (Opcional para FV)</label>
              <input type="text" name="cups" className="form-input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Teléfono</label>
              <input type="tel" name="phone" className="form-input" />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input type="email" name="email" className="form-input" />
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-3 mt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="btn-ghost"
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              style={{ background: '#FCD34D', color: '#111827', borderColor: '#FCD34D' }}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sun size={16} />}
              Crear Oportunidad FV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
