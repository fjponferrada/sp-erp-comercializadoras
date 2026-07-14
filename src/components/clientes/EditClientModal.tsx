'use client';

import React, { useState } from 'react';
import { updateClient } from '@/app/actions/clientActions';
import { X, Save } from 'lucide-react';

export default function EditClientModal({ client, onClose }: { client: any, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  
  const cAir: any = client.airtableData || (client.supplyPoints && client.supplyPoints.length > 0 ? client.supplyPoints[0].airtableData : {}) || {};

  const [formData, setFormData] = useState({
    businessName: client.businessName || '',
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    lastName2: client.lastName2 || '',
    vatNumber: client.vatNumber || '',
    contactEmail: client.contactEmail || '',
    contactPhone: client.contactPhone || '',
    billingStreetType: client.billingStreetType || cAir?.['TIPO VIA TITULAR'] || cAir?.['TIPO VÍA TITULAR'] || cAir?.['TIPO VIA'] || cAir?.['Tipo de vía Titular'] || '',
    billingStreet: client.billingStreet || cAir?.['NOMBRE VIA TITULAR'] || cAir?.['NOMBRE VÍA TITULAR'] || cAir?.['NOMBRE VIA'] || cAir?.['Calle Titular'] || '',
    billingNumber: client.billingNumber || cAir?.['Número Titular'] || cAir?.['NÚMERO TITULAR'] || cAir?.['NÚMERO VIA'] || '',
    billingFloor: client.billingFloor || cAir?.['Piso Titular'] || cAir?.['PISO TITULAR'] || '',
    billingDoor: client.billingDoor || cAir?.['Puerta Titular'] || cAir?.['PUERTA TITULAR'] || '',
    billingPostalCode: client.billingPostalCode || cAir?.['CP'] || cAir?.['C.P.'] || '',
    billingCity: client.billingCity || cAir?.['POBLACIÓN'] || cAir?.['POBLACION'] || '',
    billingProvince: client.billingProvince || cAir?.['PROVINCIA'] || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await updateClient(client.id, formData);
    
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      alert(`Error: ${result.error}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/30">
          <h2 className="text-xl font-bold text-white">Editar Datos del Cliente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {client.clientType === 'Persona física' ? (
              <>
                <div className="col-span-2">
                  <label className="block text-sm text-slate-400 mb-1">Nombre</label>
                  <input 
                    type="text" name="firstName" value={formData.firstName} onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Primer Apellido</label>
                  <input 
                    type="text" name="lastName" value={formData.lastName} onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Segundo Apellido</label>
                  <input 
                    type="text" name="lastName2" value={formData.lastName2} onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Razón Social</label>
                <input 
                  type="text" name="businessName" value={formData.businessName} onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                />
              </div>
            )}
            <div className={client.clientType === 'Persona física' ? "col-span-2" : ""}>
              <label className="block text-sm text-slate-400 mb-1">CIF / NIF</label>
              <input 
                type="text" name="vatNumber" value={formData.vatNumber} onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input 
                type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Teléfono</label>
              <input 
                type="text" name="contactPhone" value={formData.contactPhone} onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700">
            <label className="block text-sm font-semibold text-white mb-3">Dirección de Facturación</label>
            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-4 sm:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Tipo Vía</label>
                <select name="billingStreetType" value={formData.billingStreetType} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm">
                  <option value="">Sel...</option>
                  <option value="CL">Calle (CL)</option>
                  <option value="AV">Avda (AV)</option>
                  <option value="PZ">Plaza (PZ)</option>
                  <option value="CR">Ctra (CR)</option>
                  <option value="PS">Paseo (PS)</option>
                </select>
              </div>
              <div className="col-span-8 sm:col-span-9">
                <label className="block text-xs text-slate-400 mb-1">Nombre Vía</label>
                <input type="text" name="billingStreet" value={formData.billingStreet} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Número</label>
                <input type="text" name="billingNumber" value={formData.billingNumber} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
              </div>
              <div className="col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Piso</label>
                <input type="text" name="billingFloor" value={formData.billingFloor} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
              </div>
              <div className="col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Puerta</label>
                <input type="text" name="billingDoor" value={formData.billingDoor} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <label className="block text-xs text-slate-400 mb-1">C.P.</label>
                <input type="text" name="billingPostalCode" value={formData.billingPostalCode} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
              </div>
              <div className="col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Población</label>
                <input type="text" name="billingCity" value={formData.billingCity} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
              </div>
              <div className="col-span-4">
                <label className="block text-xs text-slate-400 mb-1">Provincia</label>
                <input type="text" name="billingProvince" value={formData.billingProvince} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-700 flex justify-end gap-3">
            <button 
              type="button" onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
