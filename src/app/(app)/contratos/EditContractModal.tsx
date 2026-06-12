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
  const [activeTab, setActiveTab] = useState('general');

  // Parse initial dates to YYYY-MM-DD
  const formatDateForInput = (dateString?: string | Date | null) => {
    if (!dateString) return '';
    if (typeof dateString === 'string' && dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            // Assume DD/MM/YYYY
            const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            const d = new Date(iso);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const lead = contract.lead || contract.Lead || {};
  const client = contract.client || {};
  const supplyPoint = contract.supplyPoint || {};
  const product = contract.product || {};

  let parsedContractData = lead.contractData;
  if (typeof parsedContractData === 'string') {
      try { parsedContractData = JSON.parse(parsedContractData); } catch (e) {}
  }
  const cData = typeof parsedContractData === 'object' && parsedContractData !== null ? parsedContractData : {};

  let parsedAirtableData = contract.airtableData;
  if (typeof parsedAirtableData === 'string') {
      try { parsedAirtableData = JSON.parse(parsedAirtableData); } catch (e) {}
  }
  const airtableData = typeof parsedAirtableData === 'object' && parsedAirtableData !== null ? parsedAirtableData : {};

  // For SVA
  let svaName = contract.svaConcept || contract.servicio || '';
  if (!svaName || svaName === '-') {
      const prodYServ = airtableData['Producto y Servicio'];
      if (prodYServ && typeof prodYServ === 'string') {
          const match = prodYServ.match(/"([^"]+)"/);
          if (match) svaName = match[1];
      }
  }

  const [formData, setFormData] = useState({
    status: contract.status || 'TRAMITANDO',
    internalComments: contract.internalComments || '',
    tipo: contract.tipo || '',
    tipoC2: contract.tipoC2 || '',
    tramitationType: contract.tramitationType || (Array.isArray(cData['Tramitación a realizar']) ? cData['Tramitación a realizar'][0] : cData['Tramitación a realizar']) || '',
    distributorMsg: contract.distributorMsg || '',
    
    signatureDate: formatDateForInput(contract.signatureDate || airtableData.fechafirma || airtableData.fechafirmacontrato || cData.fechafirma),
    requestDate: formatDateForInput(contract.requestDate),
    activationDate: formatDateForInput(contract.activationDate || contract.fechaPrevistaActivacion || cData.fechaPrevistaActivacion),
    terminationDate: formatDateForInput(contract.terminationDate || contract.fechaPrevistaBaja || cData.fechaPrevistaBaja),
    permanenceStartDate: formatDateForInput(contract.permanenceStartDate),
    expectedEndDate: formatDateForInput(contract.expectedEndDate),
    discountStartDate: formatDateForInput(contract.discountStartDate),
    discountEndDate: formatDateForInput(contract.discountEndDate),
    svaStartDate: formatDateForInput(contract.svaStartDate),
    
    duration: contract.duration || product.permanenceMonths || '',
    svaDuration: contract.svaDuration || '',
    
    commissionBase: contract.commissionBase || '',
    commissionFinal: contract.commissionFinal || '',
    commissionVariable: contract.commissionVariable || '',
    penalization: contract.penalization || '',
    svaConcept: svaName || '',
    svaPrice: contract.svaPrice || contract.preciofromSERVICIOS || '',
    fee: contract.fee || contract.commissionBase || '',
    pexc: contract.pexc || '',
    cgBolsilloSolar: contract.cgBolsilloSolar || '',
    deviationCost: contract.deviationCost || '',
    discountPrice: contract.discountPrice || '',
    
    p1e: contract.p1e ?? contract.Lead?.p1e ?? contract.p1e ?? lead.p1e ?? '', 
    p2e: contract.p2e ?? lead.p2e ?? '', 
    p3e: contract.p3e ?? lead.p3e ?? '',
    p4e: contract.p4e ?? lead.p4e ?? '', 
    p5e: contract.p5e ?? lead.p5e ?? '', 
    p6e: contract.p6e ?? lead.p6e ?? '',
    p1p: contract.p1p ?? lead.p1p ?? '', 
    p2p: contract.p2p ?? lead.p2p ?? '', 
    p3p: contract.p3p ?? lead.p3p ?? '',
    p4p: contract.p4p ?? lead.p4p ?? '', 
    p5p: contract.p5p ?? lead.p5p ?? '', 
    p6p: contract.p6p ?? lead.p6p ?? '',
    
    p1c: contract.p1c ?? supplyPoint.p1c ?? lead.p1c ?? supplyPoint.p1p ?? '', 
    p2c: contract.p2c ?? supplyPoint.p2c ?? lead.p2c ?? supplyPoint.p2p ?? '', 
    p3c: contract.p3c ?? supplyPoint.p3c ?? lead.p3c ?? supplyPoint.p3p ?? '',
    p4c: contract.p4c ?? supplyPoint.p4c ?? lead.p4c ?? supplyPoint.p4p ?? '', 
    p5c: contract.p5c ?? supplyPoint.p5c ?? lead.p5c ?? supplyPoint.p5p ?? '', 
    p6c: contract.p6c ?? supplyPoint.p6c ?? lead.p6c ?? supplyPoint.p6p ?? '',

    requestType: contract.requestType || '',
    isBajaM1: contract.requestType === 'M1',
    // SupplyPoint data
    distributor: supplyPoint.distributorName?.replace(/^\[.*?\]\s*/, '') || supplyPoint.distributor?.replace(/^\[.*?\]\s*/, '') || '',
    annualConsumption: supplyPoint.annualConsumption || lead.estimatedMWh || '',
    // Client data
    vatNumber: client.vatNumber || lead.vatNumber || '',
    contactEmail: client.contactEmail || lead.email || '',
    invoiceEmail: client.invoiceEmail || lead.invoiceEmail || client.contactEmail || lead.email || '',
    contactPhone: client.contactPhone || lead.phone || '',
    iban: client.iban || lead.iban || '',
    cnae: supplyPoint.cnae || '',
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
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          formPayload.append(key, String(value));
        }
      });
      // Override specific ones
      formPayload.append('requestType', formData.isBajaM1 ? 'M1' : formData.requestType);

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

  const InputField = ({ label, name, type = 'text', step = 'any' }: any) => (
    <div>
      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{label}</label>
      <input 
        type={type} 
        name={name} 
        step={step}
        value={formData[name as keyof typeof formData] as string} 
        onChange={handleChange} 
        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1C1C1C] rounded-xl border border-white/10 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-black/20">
          <h2 className="text-lg font-bold text-[var(--lime)] tracking-tight">Editar Contrato: <span className="text-white ml-2">{contract.contractCode || contract.id}</span></h2>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-md hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-6 pt-4 space-x-6 bg-black/10">
          {[
            { id: 'general', label: 'General' },
            { id: 'fechas', label: 'Fechas' },
            { id: 'cliente', label: 'Cliente y CUPS' },
            { id: 'precios', label: 'Precios y Energía' },
            { id: 'sva', label: 'Otros (SVA / Comisiones)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab.id 
                  ? 'border-lime-500 text-lime-400' 
                  : 'border-transparent text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form id="edit-contract-form" onSubmit={handleSubmit} className="space-y-6">
            
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Estado *</label>
                    <select 
                      name="status" 
                      value={formData.status} 
                      onChange={handleChange} 
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-lime-500/50 transition-all outline-none"
                    >
                      {ESTADOS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <InputField label="Tipo" name="tipo" />
                  <InputField label="Tipo C2" name="tipoC2" />
                  <InputField label="Tipo Tramitación" name="tramitationType" />
                  <InputField label="Duración (meses)" name="duration" type="number" />
                  
                  <div className="flex items-center pt-8">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" name="isBajaM1" checked={formData.isBajaM1} onChange={handleChange} className="peer sr-only" />
                        <div className="w-5 h-5 border-2 border-white/20 rounded bg-black/30 peer-checked:bg-lime-500 peer-checked:border-lime-500 transition-all flex items-center justify-center">
                          <svg className="w-3 h-3 text-black opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Baja por M1, R o E1</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Observaciones</label>
                    <textarea 
                      name="internalComments" 
                      value={formData.internalComments} 
                      onChange={handleChange} 
                      rows={3}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-lime-500/50 transition-all outline-none resize-none"
                      placeholder="Añade observaciones internas aquí..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Mensaje Distribuidora</label>
                    <textarea 
                      name="distributorMsg" 
                      value={formData.distributorMsg} 
                      onChange={handleChange} 
                      rows={3}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-lime-500/50 transition-all outline-none resize-none"
                    />
                  </div>
                </div>

                <div>
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
                        <span className="text-sm font-medium text-white/60">Haz clic o arrastra un PDF aquí para reemplazar el actual</span>
                      )}
                    </div>
                  </div>
                  {contract.signedUrl && !selectedFile && (
                    <p className="mt-2 text-xs text-lime-500/80">Ya existe un documento firmado subido.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'fechas' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <InputField label="Fecha Firma" name="signatureDate" type="date" />
                <InputField label="Fecha Solicitud" name="requestDate" type="date" />
                <InputField label="Fecha Activación" name="activationDate" type="date" />
                <InputField label="Inicio Permanencia" name="permanenceStartDate" type="date" />
                <InputField label="Fin Previsto" name="expectedEndDate" type="date" />
                <InputField label="Fecha Baja" name="terminationDate" type="date" />
                <InputField label="Inicio Descuento" name="discountStartDate" type="date" />
                <InputField label="Fin Descuento" name="discountEndDate" type="date" />
                <InputField label="Inicio SVA" name="svaStartDate" type="date" />
              </div>
            )}

            {activeTab === 'cliente' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <InputField label="CIF Titular" name="vatNumber" />
                <InputField label="E-Mail Contacto" name="contactEmail" type="email" />
                <InputField label="E-Mail Factura" name="invoiceEmail" type="email" />
                <InputField label="Teléfono Contacto" name="contactPhone" />
                <InputField label="IBAN" name="iban" />
                <InputField label="CNAE" name="cnae" />
                <div className="col-span-full border-b border-white/10 my-2"></div>
                <InputField label="Código Distribuidora (REE)" name="distributor" />
                <InputField label="Consumo Anual (kWh)" name="annualConsumption" type="number" />
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Comercial</label>
                  <input 
                    type="text" 
                    disabled
                    value={contract.user?.name || contract.user?.email || 'No asignado'} 
                    className="w-full bg-white/5 border border-transparent rounded-lg px-4 py-2.5 text-white/50 text-sm cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            {activeTab === 'precios' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lime-400 font-bold mb-4">Parámetros Económicos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InputField label="Fee" name="fee" type="number" />
                    <InputField label="Pexc" name="pexc" type="number" />
                    <InputField label="CG Bolsillo Solar" name="cgBolsilloSolar" type="number" />
                    <InputField label="Coste Desvío" name="deviationCost" type="number" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <h3 className="text-white font-bold mb-4 border-b border-white/10 pb-2">Precios Energía (€/kWh)</h3>
                    <div className="space-y-3">
                      <InputField label="P1E" name="p1e" type="number" />
                      <InputField label="P2E" name="p2e" type="number" />
                      <InputField label="P3E" name="p3e" type="number" />
                      <InputField label="P4E" name="p4e" type="number" />
                      <InputField label="P5E" name="p5e" type="number" />
                      <InputField label="P6E" name="p6e" type="number" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-4 border-b border-white/10 pb-2">Precios Potencia (€/kW)</h3>
                    <div className="space-y-3">
                      <InputField label="P1P" name="p1p" type="number" />
                      <InputField label="P2P" name="p2p" type="number" />
                      <InputField label="P3P" name="p3p" type="number" />
                      <InputField label="P4P" name="p4p" type="number" />
                      <InputField label="P5P" name="p5p" type="number" />
                      <InputField label="P6P" name="p6p" type="number" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-4 border-b border-white/10 pb-2">Estimación Consumos (kWh)</h3>
                    <div className="space-y-3">
                      <InputField label="P1C" name="p1c" type="number" />
                      <InputField label="P2C" name="p2c" type="number" />
                      <InputField label="P3C" name="p3c" type="number" />
                      <InputField label="P4C" name="p4c" type="number" />
                      <InputField label="P5C" name="p5c" type="number" />
                      <InputField label="P6C" name="p6c" type="number" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sva' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lime-400 font-bold mb-4">Servicios de Valor Añadido (SVA)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InputField label="SVA Concepto" name="svaConcept" />
                    <InputField label="SVA Precio (€)" name="svaPrice" type="number" />
                    <InputField label="SVA Duración (meses)" name="svaDuration" type="number" />
                  </div>
                </div>

                <div>
                  <h3 className="text-lime-400 font-bold mb-4">Comisiones y Penalizaciones</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <InputField label="Comisión Base" name="commissionBase" type="number" />
                    <InputField label="Comisión Final" name="commissionFinal" type="number" />
                    <InputField label="Comisión Variable" name="commissionVariable" type="number" />
                    <InputField label="Penalización" name="penalization" type="number" />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lime-400 font-bold mb-4">Descuentos Especiales</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InputField label="Precio Descuento (€)" name="discountPrice" type="number" />
                  </div>
                </div>
              </div>
            )}
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
