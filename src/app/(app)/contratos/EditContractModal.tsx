'use client';

import { useState } from 'react';
import { X, Upload, Loader2, Save } from 'lucide-react';
import { updateContractFull } from '@/app/actions/contractActions';

interface EditContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: any; // Full contract object with relations
  onSuccess: () => void;
}

const ESTADOS = [
  'BORRADOR',
  'TRAMITANDO',
  'ACEPTADO',
  'ACTIVO',
  'FINALIZADO',
  'RECHAZADO',
  'RECHAZO_DISTRIBUIDORA',
  'VERIFICANDO_FIRMA',
  'BAJA',
  'RENOVACION'
];

export default function EditContractModal({ isOpen, onClose, contract, onSuccess }: EditContractModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse initial dates to YYYY-MM-DD
  const formatDateForInput = (dateString?: string | Date | null) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    status: contract.status || 'TRAMITANDO',
    internalComments: contract.internalComments || '',
    signatureDate: formatDateForInput(contract.signatureDate),
    activationDate: formatDateForInput(contract.activationDate),
    terminationDate: formatDateForInput(contract.terminationDate),
    permanenceStartDate: formatDateForInput(contract.permanenceStartDate),
    requestType: contract.requestType || '',
    isBajaM1: contract.requestType === 'M1',
    // SupplyPoint data
    distributor: contract.supplyPoint?.distributor || '',
    annualConsumption: contract.supplyPoint?.annualConsumption || '',
    // Client data
    vatNumber: contract.client?.vatNumber || '',
    contactEmail: contract.client?.contactEmail || '',
    invoiceEmail: contract.client?.invoiceEmail || '',
    contactPhone: contract.client?.contactPhone || '',
    iban: contract.client?.iban || '',
    cnae: contract.client?.cnae || '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formPayload = new FormData();
      formPayload.append('contractId', contract.id);
      formPayload.append('status', formData.status);
      formPayload.append('internalComments', formData.internalComments);
      formPayload.append('signatureDate', formData.signatureDate);
      formPayload.append('activationDate', formData.activationDate);
      formPayload.append('terminationDate', formData.terminationDate);
      formPayload.append('permanenceStartDate', formData.permanenceStartDate);
      formPayload.append('requestType', formData.isBajaM1 ? 'M1' : formData.requestType);
      
      // Relations data
      formPayload.append('distributor', formData.distributor);
      formPayload.append('annualConsumption', String(formData.annualConsumption));
      formPayload.append('vatNumber', formData.vatNumber);
      formPayload.append('contactEmail', formData.contactEmail);
      formPayload.append('invoiceEmail', formData.invoiceEmail);
      formPayload.append('contactPhone', formData.contactPhone);
      formPayload.append('iban', formData.iban);
      formPayload.append('cnae', formData.cnae);

      if (selectedFile) {
        formPayload.append('signedContractPdf', selectedFile);
      }

      const res = await updateContractFull(formPayload);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Error al guardar el contrato');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1C1C1C] rounded-xl border border-white/10 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
          <h2 className="text-lg font-bold text-white tracking-tight">Editar Contrato: {contract.id}</h2>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-md hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form id="edit-contract-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* ESTADO & OBSERVACIONES */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Estado *</label>
                <select 
                  name="status" 
                  value={formData.status} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 focus:ring-1 focus:ring-lime-500/50 transition-all outline-none"
                >
                  {ESTADOS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Observaciones</label>
                <textarea 
                  name="internalComments" 
                  value={formData.internalComments} 
                  onChange={handleChange} 
                  rows={3}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-lime-500/50 focus:ring-1 focus:ring-lime-500/50 transition-all outline-none resize-none"
                  placeholder="Añade observaciones internas aquí..."
                />
              </div>
            </div>

            {/* FECHAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Fecha firma contrato</label>
                <input 
                  type="date" 
                  name="signatureDate" 
                  value={formData.signatureDate} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Inicio Permanencia</label>
                <input 
                  type="date" 
                  name="permanenceStartDate" 
                  value={formData.permanenceStartDate} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Fecha Inicio Suministro</label>
                <input 
                  type="date" 
                  name="activationDate" 
                  value={formData.activationDate} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Fecha Fin Suministro</label>
                <input 
                  type="date" 
                  name="terminationDate" 
                  value={formData.terminationDate} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>
            </div>

            {/* CHECKBOXES & FILES */}
            <div className="space-y-4 pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    name="isBajaM1" 
                    checked={formData.isBajaM1} 
                    onChange={handleChange}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 border-2 border-white/20 rounded bg-black/30 peer-checked:bg-lime-500 peer-checked:border-lime-500 transition-all flex items-center justify-center">
                    <svg className="w-3 h-3 text-black opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Baja por M1, R o E1</span>
              </label>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">PDF Contrato Firmado</label>
                <div className="border border-dashed border-white/20 rounded-xl p-6 text-center hover:bg-white/[0.02] transition-colors group relative cursor-pointer">
                  <input 
                    type="file" 
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-lime-500/20 group-hover:text-lime-400 transition-colors">
                      <Upload size={18} />
                    </div>
                    {selectedFile ? (
                      <span className="text-sm font-medium text-lime-400">{selectedFile.name}</span>
                    ) : (
                      <span className="text-sm font-medium text-white/60">Haz clic o arrastra un PDF aquí</span>
                    )}
                  </div>
                </div>
                {contract.signedUrl && !selectedFile && (
                  <p className="mt-2 text-xs text-lime-500/80">Ya existe un documento firmado subido.</p>
                )}
              </div>
            </div>

            {/* OTROS CAMPOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Código Distribuidora (REE)</label>
                <input 
                  type="text" 
                  name="distributor" 
                  value={formData.distributor} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Consumo anual (kWh)</label>
                <input 
                  type="number" 
                  name="annualConsumption" 
                  value={formData.annualConsumption} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Comercial</label>
                <input 
                  type="text" 
                  disabled
                  value={contract.user?.name || contract.user?.email || 'No asignado'} 
                  className="w-full bg-white/5 border border-transparent rounded-lg px-4 py-2.5 text-white/50 text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">CIF Titular</label>
                <input 
                  type="text" 
                  name="vatNumber" 
                  value={formData.vatNumber} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">E-Mail Contacto</label>
                <input 
                  type="email" 
                  name="contactEmail" 
                  value={formData.contactEmail} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">E-Mail Factura</label>
                <input 
                  type="email" 
                  name="invoiceEmail" 
                  value={formData.invoiceEmail} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Teléfono Contacto</label>
                <input 
                  type="text" 
                  name="contactPhone" 
                  value={formData.contactPhone} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">IBAN</label>
                <input 
                  type="text" 
                  name="iban" 
                  value={formData.iban} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">CNAE</label>
                <input 
                  type="text" 
                  name="cnae" 
                  value={formData.cnae} 
                  onChange={handleChange} 
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                />
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="edit-contract-form"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-lime-500 hover:bg-lime-400 text-black text-sm font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(132,204,22,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar
          </button>
        </div>

      </div>
    </div>
  );
}
