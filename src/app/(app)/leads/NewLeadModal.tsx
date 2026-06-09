'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLeadAction, updateLeadAction } from '@/app/actions/leadActions';
import { X, Loader2, Search, CheckCircle, ChevronRight, ChevronLeft, UploadCloud, FileText, Zap } from 'lucide-react';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'opportunity' | 'contract';
  leadToEdit?: any;
}

const PROVINCIAS = ["Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz", "Barcelona", "Burgos", "Cáceres", "Cádiz", "Cantabria", "Castellón", "Ciudad Real", "Córdoba", "Cuenca", "Girona", "Granada", "Guadalajara", "Guipúzcoa", "Huelva", "Huesca", "Islas Baleares", "Jaén", "La Coruña", "La Rioja", "Las Palmas", "León", "Lleida", "Lugo", "Madrid", "Málaga", "Murcia", "Navarra", "Ourense", "Palencia", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia", "Valladolid", "Vizcaya", "Zamora", "Zaragoza"];
const TIPOS_VIA = ["Calle", "Avenida", "Plaza", "Paseo", "Camino", "Carretera", "Ronda", "Pasaje", "Polígono"];

function FileUpload({ label, onUpload, value }: { label: string, onUpload: (url: string) => void, value: string | null }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('folder', 'leads');

      const res = await fetch('/api/upload', { method: 'POST', body: data });
      const json = await res.json();
      if (json.success) {
        onUpload(json.url);
      } else {
        alert(json.error || 'Error subiendo archivo');
      }
    } catch (err) {
      alert('Error en la conexión');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border border-dashed border-[#1E2A3A] bg-[#0B0F19] rounded-lg p-4 flex flex-col items-center justify-center relative hover:border-[#DEFF9A] transition-colors group cursor-pointer overflow-hidden">
      <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
      {uploading ? (
        <Loader2 className="w-6 h-6 text-[#DEFF9A] animate-spin" />
      ) : value ? (
        <div className="flex flex-col items-center text-[#DEFF9A]">
          <FileText className="w-6 h-6 mb-2" />
          <span className="text-xs font-medium text-center truncate w-full px-2">Subido correctamente</span>
        </div>
      ) : (
        <div className="flex flex-col items-center text-gray-500 group-hover:text-gray-300">
          <UploadCloud className="w-6 h-6 mb-2" />
          <span className="text-xs text-center font-medium">{label}</span>
          <span className="text-[10px] mt-1 text-gray-600">Click o arrastrar</span>
        </div>
      )}
    </div>
  );
}

export default function NewLeadModal({ isOpen, onClose, mode, leadToEdit }: NewLeadModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [sipsLoading, setSipsLoading] = useState(false);
  const [sipsData, setSipsData] = useState<any>(null);

  // Form State
  const [data, setData] = useState({
    tipoPersona: 'FISICA',
    businessName: '',
    primerApellido: '',
    segundoApellido: '',
    vatNumber: '',
    email: '',
    phone: '',
    cnae: '',
    tipoVia: 'Calle',
    nombreVia: '',
    tipoNumeracion: 'NÚMERO',
    numKm: '',
    adicional: '',
    cp: '',
    poblacion: '',
    provincia: '',
    pais: 'España',
    
    // Apoderado
    contactoNombre: '',
    contactoApellidos: '',
    contactoNif: '',

    // Suministro
    cups: '',
    tarifa: '2.0TD',
    nombreInstalacion: '',
    tipoTramitacion: 'Alta Nueva',
    autoconsumo: 'NO',
    firmaManuscrita: false,

    // Producto
    bolsilloSolar: 'NO',
    tipoProducto: 'FIJO',
    product: '',
    formaPago: 'Domiciliación',
    iban: '',
    envioFactura: 'Email',
    serviciosAdicionales: '',

    // Potencias
    p1c: '', p2c: '', p3c: '', p4c: '', p5c: '', p6c: '',
    
    // Indexado
    ip1: '', ip2: '', ip3: '', ip4: '', ip5: '', ip6: '',
    feeIndex: '',
    
    // Personalizado
    pexc: '',

    // Oferta / Comparativa
    generateOffer: false,
    monthlyExpense: '',
    p1eActual: '', p2eActual: '', p3eActual: '', p4eActual: '', p5eActual: '', p6eActual: '',
    p1pDaily: '', p2pDaily: '', p3pDaily: '', p4pDaily: '', p5pDaily: '', p6pDaily: '',
    priceServiceActual: '',
    comparative: '',
    savings: '',
    comments: '',

    // Documentos (urls)
    docs: {
      dniTitular: null as string | null,
      ultimaFactura: null as string | null,
      certificadoIban: null as string | null,
      cieConsumo: null as string | null,
      cieAutoconsumo: null as string | null,
      escrituras: null as string | null,
      dniApoderado: null as string | null,
    },

    verificacionAed: false
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError('');
      setSipsData(null);
      // Omitimos cargar datos de leadToEdit por ahora para simplificar el alta,
      // pero si existe se podrían mapear aquí.
    }
  }, [isOpen, leadToEdit]);

  if (!isOpen) return null;

  const updateData = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const updateDoc = (field: string, url: string) => {
    setData(prev => ({ ...prev, docs: { ...prev.docs, [field]: url } }));
  };

  async function handleSipsLookup() {
    if (data.cups.length < 20) {
      setError('El CUPS debe tener al menos 20 caracteres');
      return;
    }
    setSipsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sips?cups=${data.cups}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      
      setSipsData(json.data);
      if (json.data.tarifa) updateData('tarifa', json.data.tarifa);
      
      // Auto-rellenar campos de dirección si están vacíos
      if (!data.cp) updateData('cp', json.data.cp || '');
      if (!data.poblacion) updateData('poblacion', json.data.poblacion || json.data.municipio || '');
      if (!data.provincia) updateData('provincia', json.data.provincia || '');
      if (!data.cnae) updateData('cnae', json.data.cnae || '');
      
    } catch (err: any) {
      setError(err.message || 'Error consultando SIPS');
    } finally {
      setSipsLoading(false);
    }
  }

  async function handleSubmit() {
    if (mode === 'contract' && !data.verificacionAed) {
      setError('Debes marcar la Verificación AED para continuar el alta');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('vatNumber', data.vatNumber);
      
      // Construir businessName completo si es FISICA
      let finalName = data.businessName;
      if (data.tipoPersona === 'FISICA') {
        finalName = `${data.businessName} ${data.primerApellido} ${data.segundoApellido}`.trim();
      }
      formData.append('businessName', finalName);
      
      formData.append('cups', data.cups);
      formData.append('email', data.email);
      formData.append('phone', data.phone);
      formData.append('productType', data.tipoProducto);
      formData.append('product', data.product);
      formData.append('additionalServices', data.serviciosAdicionales);
      formData.append('tariff', data.tarifa);
      formData.append('selfConsumption', data.autoconsumo);
      
      const fullAddress = `${data.tipoVia} ${data.nombreVia} ${data.tipoNumeracion} ${data.numKm} ${data.adicional}`.trim();
      formData.append('direccion', fullAddress);

      if (sipsData) {
        formData.append('sipsData', JSON.stringify(sipsData));
      }

      // Preparar contractData con toooodos los campos extras
      const contractData = {
        tipoPersona: data.tipoPersona,
        primerApellido: data.primerApellido,
        segundoApellido: data.segundoApellido,
        cnae: data.cnae,
        direccion: {
          tipoVia: data.tipoVia,
          nombreVia: data.nombreVia,
          tipoNumeracion: data.tipoNumeracion,
          numKm: data.numKm,
          adicional: data.adicional,
          cp: data.cp,
          poblacion: data.poblacion,
          provincia: data.provincia,
          pais: data.pais
        },
        contactoNombre: data.tipoPersona === 'JURIDICA' ? data.contactoNombre : '',
        contactoApellidos: data.tipoPersona === 'JURIDICA' ? data.contactoApellidos : '',
        contactoNif: data.tipoPersona === 'JURIDICA' ? data.contactoNif : '',
        
        nombreInstalacion: data.nombreInstalacion,
        tipoTramitacion: data.tipoTramitacion,
        firmaManuscrita: data.firmaManuscrita,
        bolsilloSolar: data.bolsilloSolar,
        
        iban: data.iban,
        formaPago: data.formaPago,
        envioFactura: data.envioFactura,
        
        potencias: {
          p1: data.p1c, p2: data.p2c, p3: data.p3c, p4: data.p4c, p5: data.p5c, p6: data.p6c
        },
        indexado: {
          ip1: data.ip1, ip2: data.ip2, ip3: data.ip3, ip4: data.ip4, ip5: data.ip5, ip6: data.ip6,
          fee: data.feeIndex
        },
        pexc: data.pexc,
        
        // Oferta
        generateOffer: data.generateOffer,
        monthlyExpense: data.monthlyExpense,
        p1eActual: data.p1eActual, p2eActual: data.p2eActual, p3eActual: data.p3eActual, p4eActual: data.p4eActual, p5eActual: data.p5eActual, p6eActual: data.p6eActual,
        p1pDaily: data.p1pDaily, p2pDaily: data.p2pDaily, p3pDaily: data.p3pDaily, p4pDaily: data.p4pDaily, p5pDaily: data.p5pDaily, p6pDaily: data.p6pDaily,
        priceServiceActual: data.priceServiceActual,
        comparative: data.comparative,
        savings: data.savings,
        comments: data.comments
      };
      formData.append('contractData', JSON.stringify(contractData));

      // Preparar Documentos
      const docsArray = [];
      if (data.docs.dniTitular) docsArray.push({ type: 'DNI', url: data.docs.dniTitular, name: 'DNI Titular' });
      if (data.docs.ultimaFactura) docsArray.push({ type: 'FACTURA', url: data.docs.ultimaFactura, name: 'Última Factura' });
      if (data.docs.certificadoIban) docsArray.push({ type: 'IBAN', url: data.docs.certificadoIban, name: 'Certificado IBAN' });
      if (data.docs.cieConsumo) docsArray.push({ type: 'CIE', url: data.docs.cieConsumo, name: 'CIE Consumo' });
      if (data.docs.cieAutoconsumo) docsArray.push({ type: 'CIE', url: data.docs.cieAutoconsumo, name: 'CIE Autoconsumo' });
      if (data.docs.escrituras) docsArray.push({ type: 'ESCRITURAS', url: data.docs.escrituras, name: 'Escrituras' });
      if (data.docs.dniApoderado) docsArray.push({ type: 'DNI_APODERADO', url: data.docs.dniApoderado, name: 'DNI Apoderado' });
      
      formData.append('documents', JSON.stringify(docsArray));

      let res;
      if (leadToEdit) {
        res = await updateLeadAction(leadToEdit.id, formData);
      } else {
        res = await createLeadAction(formData);
      }
      
      if (res.success) {
        onClose();
        router.refresh(); 
      } else {
        setError((res as any).message || 'Error al guardar el Lead');
      }
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  const Input = ({ label, field, type = "text", required = false, width = "full" }: { label: string, field: keyof typeof data, type?: string, required?: boolean, width?: string }) => (
    <div className={`space-y-1.5 ${width === 'half' ? 'col-span-1' : width === 'third' ? 'col-span-1 md:col-span-1' : 'col-span-2'}`}>
      <label className="text-xs font-medium text-gray-400">{label} {required && <span className="text-red-400">*</span>}</label>
      <input 
        type={type}
        value={data[field] as string}
        onChange={(e) => updateData(field, e.target.value)}
        className="w-full bg-[#0B0F19] border border-[#1E2A3A] rounded-lg px-3 py-2 text-sm text-white focus:border-[#DEFF9A] focus:ring-1 focus:ring-[#DEFF9A] outline-none transition-all"
      />
    </div>
  );

  const Select = ({ label, field, options, width = "full" }: { label: string, field: keyof typeof data, options: string[], width?: string }) => (
    <div className={`space-y-1.5 ${width === 'half' ? 'col-span-1' : width === 'third' ? 'col-span-1 md:col-span-1' : 'col-span-2'}`}>
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <select 
        value={data[field] as string}
        onChange={(e) => updateData(field, e.target.value)}
        className="w-full bg-[#0B0F19] border border-[#1E2A3A] rounded-lg px-3 py-2 text-sm text-white focus:border-[#DEFF9A] focus:ring-1 focus:ring-[#DEFF9A] outline-none transition-all"
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );

  const renderDocumentation = () => {
    const isAltaNueva = data.tipoTramitacion === 'Alta Nueva';
    const hasAutoConsumo = data.autoconsumo === 'SI';
    const isCompany = data.tipoPersona === 'JURIDICA';

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Documentación</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FileUpload label="DNI/NIF Titular" value={data.docs.dniTitular} onUpload={(url) => updateDoc('dniTitular', url)} />
            <FileUpload label="Última Factura" value={data.docs.ultimaFactura} onUpload={(url) => updateDoc('ultimaFactura', url)} />
            
            {mode === 'contract' && (
              <>
                <FileUpload label="Certificado IBAN" value={data.docs.certificadoIban} onUpload={(url) => updateDoc('certificadoIban', url)} />
                {isAltaNueva && <FileUpload label="CIE Consumo" value={data.docs.cieConsumo} onUpload={(url) => updateDoc('cieConsumo', url)} />}
                {hasAutoConsumo && <FileUpload label="CIE Autoconsumo" value={data.docs.cieAutoconsumo} onUpload={(url) => updateDoc('cieAutoconsumo', url)} />}
                {isCompany && (
                  <>
                    <FileUpload label="Escrituras" value={data.docs.escrituras} onUpload={(url) => updateDoc('escrituras', url)} />
                    <FileUpload label="DNI Apoderado" value={data.docs.dniApoderado} onUpload={(url) => updateDoc('dniApoderado', url)} />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {mode === 'contract' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 border-b border-red-500/20 pb-2">Verificación Final</h3>
            <label className="flex items-center gap-3 p-3 bg-red-500/5 rounded-lg cursor-pointer hover:bg-red-500/10 transition-colors border border-red-500/20">
              <input 
                type="checkbox" 
                checked={data.verificacionAed} 
                onChange={(e) => updateData('verificacionAed', e.target.checked)} 
                className="w-5 h-5 rounded border-gray-600 text-red-500 focus:ring-red-500" 
              />
              <span className="text-sm font-medium text-red-200">VERIFICACION_SOLICITUD (Obligatorio)</span>
            </label>
          </div>
        )}
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Datos del Contacto / Titular</h3>
              
              <div className="flex gap-4 mb-5">
                <label className={`flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${data.tipoPersona === 'FISICA' ? 'bg-[#DEFF9A]/10 border-[#DEFF9A] text-[#DEFF9A]' : 'bg-[#0B0F19] border-[#1E2A3A] text-gray-400'}`}>
                  <input type="radio" checked={data.tipoPersona === 'FISICA'} onChange={() => updateData('tipoPersona', 'FISICA')} className="hidden" />
                  <span className="font-medium text-sm">Persona Física</span>
                </label>
                <label className={`flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${data.tipoPersona === 'JURIDICA' ? 'bg-[#DEFF9A]/10 border-[#DEFF9A] text-[#DEFF9A]' : 'bg-[#0B0F19] border-[#1E2A3A] text-gray-400'}`}>
                  <input type="radio" checked={data.tipoPersona === 'JURIDICA'} onChange={() => updateData('tipoPersona', 'JURIDICA')} className="hidden" />
                  <span className="font-medium text-sm">Persona Jurídica</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input label={data.tipoPersona === 'FISICA' ? "Nombre" : "Razón Social"} field="businessName" width="half" required />
                <Input label="NIF / CIF" field="vatNumber" width="half" required />
                
                {mode === 'contract' && data.tipoPersona === 'FISICA' && (
                  <>
                    <Input label="Primer Apellido" field="primerApellido" width="half" />
                    <Input label="Segundo Apellido" field="segundoApellido" width="half" />
                  </>
                )}

                <Input label="Email" field="email" type="email" width="half" required={mode === 'contract'} />
                <Input label="Teléfono" field="phone" width="half" required={mode === 'contract'} />
                
                {mode === 'contract' && <Input label="CNAE" field="cnae" width="half" />}
              </div>
            </div>

            {mode === 'contract' && (
              <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Dirección Titular</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Select label="Tipo de vía" field="tipoVia" options={TIPOS_VIA} width="third" />
                  <Input label="Nombre Vía" field="nombreVia" width="col-span-2" />
                  <Select label="Tipo numeración" field="tipoNumeracion" options={['NÚMERO', 'KM', 'S/N']} width="third" />
                  <Input label="Núm/Km" field="numKm" width="third" />
                  <Input label="Adicional (Piso, Puerta)" field="adicional" width="third" />
                  <Input label="Código Postal" field="cp" width="third" />
                  <Input label="Población" field="poblacion" width="third" />
                  <Select label="Provincia" field="provincia" options={PROVINCIAS} width="third" />
                  <Input label="País Titular" field="pais" width="third" />
                </div>
              </div>
            )}

            {mode === 'contract' && data.tipoPersona === 'JURIDICA' && (
              <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Datos del Apoderado</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nombre Apoderado" field="contactoNombre" width="half" />
                  <Input label="Apellidos Apoderado" field="contactoApellidos" width="half" />
                  <Input label="NIF Apoderado" field="contactoNif" width="half" />
                </div>
              </div>
            )}
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Zap size={100} /></div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Datos del Suministro</h3>
              
              <div className="flex gap-3 items-end mb-6 relative z-10">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">CUPS *</label>
                  <input 
                    value={data.cups} onChange={(e) => updateData('cups', e.target.value.toUpperCase())}
                    placeholder="ES0000000000000000AA"
                    className="w-full bg-[#0B0F19] border border-[#1E2A3A] rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#DEFF9A] focus:ring-1 focus:ring-[#DEFF9A] outline-none font-mono uppercase"
                  />
                </div>
                <button onClick={handleSipsLookup} disabled={sipsLoading} className="px-4 py-2.5 bg-[#DEFF9A]/10 text-[#DEFF9A] hover:bg-[#DEFF9A]/20 border border-[#DEFF9A]/30 rounded-lg font-medium transition-colors flex items-center gap-2">
                  {sipsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} SIPS
                </button>
              </div>

              {sipsData && (
                <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded flex gap-2 items-center">
                  <CheckCircle size={14} /> SIPS validado correctamente. Se han autocompletado datos.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 relative z-10">
                <Select label="Tarifa" field="tarifa" options={['2.0TD', '3.0TD', '3.0TDVE', '6.1TD']} width="half" />
                <Input label="Nombre Instalación" field="nombreInstalacion" width="half" />
              </div>
            </div>

            {mode === 'contract' && (
              <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Datos del Contrato</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Select label="Tramitación a realizar" field="tipoTramitacion" options={['Alta Nueva', 'Cambio Comercializador', 'Cambio Titular', 'Baja']} width="half" />
                  <Select label="¿Autoconsumo?" field="autoconsumo" options={['NO', 'SI']} width="half" />
                </div>
                <label className="flex items-center gap-3 p-3 border border-[#1E2A3A] rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                  <input type="checkbox" checked={data.firmaManuscrita} onChange={(e) => updateData('firmaManuscrita', e.target.checked)} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#DEFF9A] focus:ring-[#DEFF9A]" />
                  <span className="text-sm text-gray-300">Firma Manuscrita</span>
                </label>
              </div>
            )}
          </div>
        );

      case 3:
        const isNot20 = data.tarifa !== '2.0TD';
        const isIndexadoPers = data.tipoProducto === 'INDEXADO_PERS';
        const isPersAutoconsumo = (data.tipoProducto === 'INDEXADO_PERS' || data.tipoProducto === 'FIJO_PERS') && data.autoconsumo === 'SI';

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Producto y Facturación</h3>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <Select label="¿Asociar a Bolsillo Solar?" field="bolsilloSolar" options={['NO', 'SI']} width="half" />
                <Select label="Tipo de Producto" field="tipoProducto" options={['FIJO', 'INDEXADO', 'FIJO_PERS', 'INDEXADO_PERS']} width="half" />
                <Input label="Producto" field="product" width="half" />
                <Input label="Servicios Adicionales" field="serviciosAdicionales" width="half" />
              </div>
              {mode === 'contract' && (
                <div className="grid grid-cols-3 gap-4">
                  <Select label="Forma de pago" field="formaPago" options={['Domiciliación', 'Transferencia']} width="third" />
                  <Input label="IBAN" field="iban" width="third" />
                  <Select label="Envío de factura" field="envioFactura" options={['Email', 'Postal', 'Ambos']} width="third" />
                </div>
              )}
            </div>

            <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Potencia Contratada (kW)</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <Input label="P1C" field="p1c" type="number" width="col-span-1" />
                <Input label="P2C" field="p2c" type="number" width="col-span-1" />
                {isNot20 && (
                  <>
                    <Input label="P3C" field="p3c" type="number" width="col-span-1" />
                    <Input label="P4C" field="p4c" type="number" width="col-span-1" />
                    <Input label="P5C" field="p5c" type="number" width="col-span-1" />
                    <Input label="P6C" field="p6c" type="number" width="col-span-1" />
                  </>
                )}
              </div>
            </div>

            {(isIndexadoPers || isPersAutoconsumo) && (
              <div className="bg-[#111827] border border-[#DEFF9A]/30 rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-[#DEFF9A] uppercase tracking-wider mb-4 border-b border-[#DEFF9A]/20 pb-2">Condiciones Personalizadas</h3>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {isIndexadoPers && (
                    <>
                      <Input label="FEE Index" field="feeIndex" type="number" width="col-span-1" />
                      <Input label="IP P1" field="ip1" type="number" width="col-span-1" />
                      <Input label="IP P2" field="ip2" type="number" width="col-span-1" />
                      <Input label="IP P3" field="ip3" type="number" width="col-span-1" />
                    </>
                  )}
                  {isIndexadoPers && isNot20 && (
                    <>
                      <Input label="IP P4" field="ip4" type="number" width="col-span-1" />
                      <Input label="IP P5" field="ip5" type="number" width="col-span-1" />
                      <Input label="IP P6" field="ip6" type="number" width="col-span-1" />
                    </>
                  )}
                  {isPersAutoconsumo && (
                    <Input label="PExc Personalizado" field="pexc" type="number" width="col-span-1" />
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        if (mode === 'opportunity') {
          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Estudio y Comparativa</h3>
                
                <label className="flex items-center gap-3 p-3 bg-[#0B0F19] border border-[#1E2A3A] rounded-xl cursor-pointer mb-5 hover:border-[#DEFF9A]/50 transition-colors">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-[#DEFF9A] focus:ring-[#DEFF9A]"
                    checked={data.generateOffer}
                    onChange={e => updateData('generateOffer', e.target.checked)}
                  />
                  <span className="text-sm font-medium text-white">¿Generar Estudio / Oferta Comercial?</span>
                </label>

                {data.generateOffer && (
                  <div className="space-y-5 animate-in slide-in-top-2">
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Gasto Mensual Actual (€)" field="monthlyExpense" type="number" width="half" />
                      <Input label="Ahorro Estimado (€)" field="savings" type="number" width="half" />
                    </div>

                    <div>
                      <h4 className="text-xs font-medium text-[#DEFF9A] mt-4 mb-2">Precios Energía Actual (€/kWh)</h4>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        <Input label="P1" field="p1eActual" type="number" width="col-span-1" />
                        <Input label="P2" field="p2eActual" type="number" width="col-span-1" />
                        <Input label="P3" field="p3eActual" type="number" width="col-span-1" />
                        <Input label="P4" field="p4eActual" type="number" width="col-span-1" />
                        <Input label="P5" field="p5eActual" type="number" width="col-span-1" />
                        <Input label="P6" field="p6eActual" type="number" width="col-span-1" />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-medium text-[#DEFF9A] mt-4 mb-2">Precios Potencia Actual (€/kW/día)</h4>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        <Input label="P1" field="p1pDaily" type="number" width="col-span-1" />
                        <Input label="P2" field="p2pDaily" type="number" width="col-span-1" />
                        <Input label="P3" field="p3pDaily" type="number" width="col-span-1" />
                        <Input label="P4" field="p4pDaily" type="number" width="col-span-1" />
                        <Input label="P5" field="p5pDaily" type="number" width="col-span-1" />
                        <Input label="P6" field="p6pDaily" type="number" width="col-span-1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <Input label="Precio Servicios Actual (€)" field="priceServiceActual" type="number" width="half" />
                      <Input label="Observaciones (Comparativa)" field="comparative" width="half" />
                    </div>
                    
                    <div className="mt-4">
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Comentarios Comerciales Internos</label>
                      <textarea 
                        value={data.comments}
                        onChange={e => updateData('comments', e.target.value)}
                        className="w-full bg-[#0B0F19] border border-[#1E2A3A] rounded-lg px-3 py-2 text-sm text-white focus:border-[#DEFF9A] focus:ring-1 focus:ring-[#DEFF9A] outline-none"
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }
        return renderDocumentation();

      case 5:
        if (mode === 'opportunity') {
          return renderDocumentation();
        }
        return null;
      
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070B]/90 backdrop-blur-md overflow-y-auto pt-10 pb-10 px-4">
      <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-[#1E2A3A] shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {mode === 'opportunity' ? 'Crear Oferta / Estudio' : 'Alta Avanzada de Suministro'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {Array.from({length: mode === 'opportunity' ? 5 : 4}, (_, i) => i + 1).map(s => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s ? 'bg-[#DEFF9A] text-black shadow-[0_0_15px_rgba(222,255,154,0.3)]' : step > s ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500'}`}>
                    {s}
                  </div>
                  {s < (mode === 'opportunity' ? 5 : 4) && <div className={`w-10 h-0.5 mx-1 ${step > s ? 'bg-gray-700' : 'bg-gray-800'}`} />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-gray-800 p-2 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" /> {error}
            </div>
          )}
          {renderStep()}
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-[#1E2A3A] bg-[#080B13] flex justify-between shrink-0 rounded-b-2xl">
          <button 
            type="button" 
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            {step > 1 ? <><ChevronLeft className="w-4 h-4"/> Atrás</> : 'Cancelar'}
          </button>
          
          {step < (mode === 'opportunity' ? 5 : 4) ? (
            <button 
              type="button" 
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-black hover:bg-gray-200 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Siguiente <ChevronRight className="w-4 h-4"/>
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-2.5 rounded-lg text-sm font-bold bg-[#DEFF9A] text-black hover:bg-[#c9eb85] transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(222,255,154,0.2)] disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Procesando Alta...' : 'Finalizar Alta'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
