'use client';

import React, { useState } from 'react';
import { updateSupplyPointAction } from '@/app/actions/supplyPointActions';
import { X, Save, Zap } from 'lucide-react';

export default function EditSupplyPointModal({
  isOpen,
  onClose,
  supplyPoint,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  supplyPoint: any;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    streetType: supplyPoint.streetType || '',
    street: supplyPoint.street || '',
    streetNumber: supplyPoint.streetNumber || '',
    floor: supplyPoint.floor || '',
    door: supplyPoint.door || '',
    addressAddition: supplyPoint.addressAddition || '',
    postalCode: supplyPoint.postalCode || '',
    city: supplyPoint.city || '',
    province: supplyPoint.province || '',
    tariff: supplyPoint.tariff || '',
    annualConsumption: supplyPoint.annualConsumption || '',
    distributor: supplyPoint.distributor || '',
    cnae: supplyPoint.cnae || '',
    iban: supplyPoint.iban || '',
    swift: supplyPoint.swift || '',
    p1c: supplyPoint.p1c || '',
    p2c: supplyPoint.p2c || '',
    p3c: supplyPoint.p3c || '',
    p4c: supplyPoint.p4c || '',
    p5c: supplyPoint.p5c || '',
    p6c: supplyPoint.p6c || '',
    hasSelfConsumption: supplyPoint.hasSelfConsumption || false,
    selfConsumptionType: supplyPoint.selfConsumptionType || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await updateSupplyPointAction(supplyPoint.id, formData);
    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const InputField = ({ label, name, type = "text" }: { label: string, name: string, type?: string }) => (
    <div>
      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{label}</label>
      <input
        type={type}
        name={name}
        value={(formData as any)[name]}
        onChange={handleChange}
        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="bg-lime-500/10 p-2 rounded-lg border border-lime-500/20">
              <Zap className="text-lime-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Editar Punto de Suministro</h2>
              <p className="text-sm font-mono text-white/50">{supplyPoint.cups}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form id="edit-sp-form" onSubmit={handleSubmit} className="space-y-6">
            
              <div className="space-y-8">
                <div>
                  <h3 className="text-lime-400 font-bold mb-4">Dirección de Suministro</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <InputField label="Tipo de Vía" name="streetType" />
                    <div className="md:col-span-2">
                      <InputField label="Nombre de la Vía" name="street" />
                    </div>
                    <InputField label="Número" name="streetNumber" />
                    <InputField label="Piso" name="floor" />
                    <InputField label="Puerta" name="door" />
                    <div className="md:col-span-2">
                      <InputField label="Adicional" name="addressAddition" />
                    </div>
                    <InputField label="Código Postal" name="postalCode" />
                    <div className="md:col-span-2">
                      <InputField label="Población" name="city" />
                    </div>
                    <InputField label="Provincia" name="province" />
                  </div>
                </div>

                <div>
                  <h3 className="text-lime-400 font-bold mb-4">Datos Bancarios</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="IBAN" name="iban" />
                    <InputField label="SWIFT/BIC" name="swift" />
                  </div>
                </div>
              </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
          <button
            form="edit-sp-form"
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-lime-500 text-black hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(132,204,22,0.2)]"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Guardar Cambios
          </button>
        </div>

      </div>
    </div>
  );
}
