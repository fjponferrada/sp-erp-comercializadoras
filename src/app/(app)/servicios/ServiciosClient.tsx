'use client';

import React, { useState } from 'react';
import { toggleServicioStatusAction } from '@/app/actions/serviciosActions';
import ServicioModal from './ServicioModal';
import { Plus, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Servicio {
  id: string;
  name: string;
  monthlyPrice: number | null;
  dailyPrice: number | null;
  durationMonths: number;
  isActive: boolean;
  isCommissionable?: boolean;
}

interface Props {
  initialServicios: Servicio[];
}

export default function ServiciosClient({ initialServicios }: Props) {
  const [servicios, setServicios] = useState<Servicio[]>(initialServicios);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [servicioToEdit, setServicioToEdit] = useState<Servicio | null>(null);

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      const res = await toggleServicioStatusAction(id, newStatus);
      if (res.success) {
        setServicios(servicios.map(s => s.id === id ? { ...s, isActive: newStatus } : s));
        toast.success(newStatus ? 'Servicio activado' : 'Servicio desactivado');
      } else {
        toast.error(res.error || 'Error al cambiar estado');
      }
    } catch (e) {
      toast.error('Error de red');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Listado de Servicios</h2>
        <button
          onClick={() => { setServicioToEdit(null); setIsModalOpen(true); }}
          className="bg-[var(--lime)] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#c2ff66] transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          <span>Nuevo Servicio</span>
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-[#111827] text-xs uppercase text-gray-500 font-semibold border-b border-gray-800">
              <tr>
                <th className="px-6 py-4">Nombre del Servicio</th>
                <th className="px-6 py-4">Precio Mensual (€)</th>
                <th className="px-6 py-4">Precio Diario (€)</th>
                <th className="px-6 py-4 text-center">Duración (Meses)</th>
                <th className="px-6 py-4 text-center">Comisión</th>
                <th className="px-6 py-4 text-center">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-[#0B0F19]">
              {servicios.map((svc) => (
                <tr key={svc.id} className="hover:bg-[#111827] transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{svc.name}</td>
                  <td className="px-6 py-4">{svc.monthlyPrice !== null ? svc.monthlyPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '-'}</td>
                  <td className="px-6 py-4">{svc.dailyPrice !== null ? svc.dailyPrice.toLocaleString('es-ES', { minimumFractionDigits: 3 }) + ' €' : '-'}</td>
                  <td className="px-6 py-4 text-center">{svc.durationMonths}</td>
                  <td className="px-6 py-4 text-center">
                    {svc.isCommissionable ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        SÍ
                      </span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleToggleStatus(svc.id, svc.isActive)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        svc.isActive 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                      } transition-colors`}
                    >
                      {svc.isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {svc.isActive ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => { setServicioToEdit(svc); setIsModalOpen(true); }}
                      className="text-gray-400 hover:text-[var(--lime)] transition-colors p-2"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {servicios.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No hay servicios configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ServicioModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        servicioToEdit={servicioToEdit}
        onSaved={(savedSvc) => {
          if (servicioToEdit) {
            setServicios(servicios.map(s => s.id === savedSvc.id ? savedSvc : s));
          } else {
            setServicios([...servicios, savedSvc]);
          }
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
