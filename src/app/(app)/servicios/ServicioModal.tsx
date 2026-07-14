'use client';

import React, { useState, useEffect } from 'react';
import { createServicioAction, updateServicioAction } from '@/app/actions/serviciosActions';
import { X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface Servicio {
  id: string;
  name: string;
  monthlyPrice: number | null;
  dailyPrice: number | null;
  isActive: boolean;
  isCommissionable?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  servicioToEdit: Servicio | null;
  onSaved: (svc: Servicio) => void;
}

export default function ServicioModal({ isOpen, onClose, servicioToEdit, onSaved }: Props) {
  const [name, setName] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [dailyPrice, setDailyPrice] = useState('');
  const [isCommissionable, setIsCommissionable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (servicioToEdit) {
        setName(servicioToEdit.name);
        setMonthlyPrice(servicioToEdit.monthlyPrice !== null ? String(servicioToEdit.monthlyPrice) : '');
        setDailyPrice(servicioToEdit.dailyPrice !== null ? String(servicioToEdit.dailyPrice) : '');
        setIsCommissionable(!!servicioToEdit.isCommissionable);
      } else {
        setName('');
        setMonthlyPrice('');
        setDailyPrice('');
        setIsCommissionable(false);
      }
    }
  }, [isOpen, servicioToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error('El nombre es obligatorio');
      return;
    }

    const mPrice = monthlyPrice ? parseFloat(monthlyPrice.replace(',', '.')) : 0;
    const dPrice = dailyPrice ? parseFloat(dailyPrice.replace(',', '.')) : 0;

    setLoading(true);
    try {
      let res;
      if (servicioToEdit) {
        res = await updateServicioAction(servicioToEdit.id, { name, monthlyPrice: mPrice, dailyPrice: dPrice, isCommissionable });
      } else {
        res = await createServicioAction({ name, monthlyPrice: mPrice, dailyPrice: dPrice, isCommissionable });
      }

      if (res.success && res.data) {
        toast.success(servicioToEdit ? 'Servicio actualizado' : 'Servicio creado');
        onSaved(res.data as Servicio);
      } else {
        toast.error(res.error || 'Ocurrió un error');
      }
    } catch (err) {
      toast.error('Error de red al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-[#1E2A3A] bg-[#111827]">
          <h2 className="text-xl font-bold text-white">
            {servicioToEdit ? 'Editar Servicio' : 'Nuevo Servicio Adicional'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="servicio-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Nombre del Servicio</label>
              <input
                type="text"
                required
                placeholder="Ej. Asesoramiento energético (5,99 €/mes)"
                className="w-full bg-[#111827] border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[var(--lime)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Precio Mensual (€)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 5.99"
                  className="w-full bg-[#111827] border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[var(--lime)]"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Precio Diario (€)</label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="Ej. 0.197"
                  className="w-full bg-[#111827] border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[var(--lime)]"
                  value={dailyPrice}
                  onChange={(e) => setDailyPrice(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={isCommissionable}
                  onChange={(e) => setIsCommissionable(e.target.checked)}
                  className="w-4 h-4 text-[var(--lime)] bg-gray-800 border-gray-700 rounded focus:ring-[var(--lime)] focus:ring-offset-gray-900"
                />
                <span className="text-sm font-medium text-gray-300">Genera comisión para el canal</span>
              </label>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-2">
              <p className="text-sm text-blue-400">
                El precio diario se utilizará en los cálculos exactos de facturación y liquidación si aplica, mientras que el mensual es puramente comercial.
              </p>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#1E2A3A] bg-[#111827]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="servicio-form"
            disabled={loading}
            className="bg-[var(--lime)] text-black px-6 py-2.5 rounded-lg font-semibold hover:bg-[#c2ff66] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            <span>{loading ? 'Guardando...' : 'Guardar Servicio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
