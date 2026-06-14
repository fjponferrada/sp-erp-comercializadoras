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

const TRAMITACIONES = [
  'Alta nueva',
  'Cambio comercializadora sin cambios',
  'Cambio comercializadora con cambios administrativos',
  'Cambio comercializadora con cambios técnicos',
  'Cambio comercializadora con cambios técnicos y administrativos',
  'Modificación de datos administrativos',
  'Modificación de datos técnicos',
  'Modificación de datos administrativos y técnicos'
];

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
    sTipoVia: 'Calle',
    sNombreVia: '',
    sTipoNumeracion: 'NÚMERO',
    sNumero: '',
    sAdicional: '',
    sCp: '',
    sPoblacion: '',
    sProvincia: '',
    sPais: 'España',
    
    // Contrato
    tipoTramitacion: 'Alta nueva',
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

  const [productsDb, setProductsDb] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Cargar productos de la base de datos
      fetch('/api/products')
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setProductsDb(data.data);
          }
        })
        .catch(err => console.error('Error fetching products:', err));

      setStep(1);
      setError('');
      setSipsData(null);
      
      if (leadToEdit) {
        const cd = (leadToEdit.contractData as any) || {};
        const ad = (leadToEdit.airtableData as any) || {};
        const getScalar = (val: any) => Array.isArray(val) ? val[0] : val;
        
        // Parse VAT
        const vat = leadToEdit.vatNumber || cd.vatNumber || ad['CIF'] || ad['NIF'] || ad['Copia de CIF link'] || ad['NIF Contacto'] || '';
        const esJuridica = vat ? /^[ABJUV]/i.test(vat.trim()) : false;

        // Parse Names from Dictionary Rules
        let rawBusinessName = cd.nombre || getScalar(ad['NOMBRE/RAZON SOCIAL']) || getScalar(ad['NOMBRERAZON SOCIAL']) || '';
        let pAp = leadToEdit.firstName || cd.primerApellido || ad['Primer Apellido'] || ad['Primer apellido Titular'] || '';
        let sAp = leadToEdit.lastName || cd.segundoApellido || ad['Segundo Apellido'] || ad['Segundo apellido Titular'] || '';
        
        if (!esJuridica && !rawBusinessName) {
          rawBusinessName = leadToEdit.businessName || cd.businessName || ad['NOMBRE Y APELLIDOS'] || ad['Nombre completo Titular'] || '';
          const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (pAp) rawBusinessName = rawBusinessName.replace(new RegExp(`\\b${escapeRegExp(pAp)}\\b`, 'i'), '');
          if (sAp) rawBusinessName = rawBusinessName.replace(new RegExp(`\\b${escapeRegExp(sAp)}\\b`, 'i'), '');
          rawBusinessName = rawBusinessName.replace('(Copia)', '').replace(/^,\s*|\s*,\s*$/g, '').trim();
        } else if (esJuridica && !rawBusinessName) {
          rawBusinessName = leadToEdit.businessName || cd.businessName || ad['NOMBRE Y APELLIDOS'] || ad['Nombre completo Titular'] || '';
        }

        const normNum = (val: any) => {
          const upper = String(val || '').toUpperCase().trim();
          if (upper.includes('NÚM') || upper.includes('NUM')) return 'NÚMERO';
          if (upper.includes('KM')) return 'KM';
          if (upper.includes('S/N') || upper.includes('SN')) return 'S/N';
          return 'NÚMERO';
        };

        const normProdType = (val: any) => {
          const upper = String(val || '').toUpperCase().trim();
          if (upper === 'FIJO' || upper === 'INDEXADO' || upper === 'FIJO_PERS' || upper === 'INDEXADO_PERS') return upper;
          if (upper.includes('INDEX')) return 'INDEXADO';
          return 'FIJO';
        };
        
        let rawTipoProducto = normProdType(leadToEdit.productType || cd.tipoProducto || getScalar(ad['Tipo de producto']));

        setData(prev => ({
          ...prev,
          tipoPersona: cd.tipoPersona || (esJuridica ? 'JURIDICA' : 'FISICA'),
          businessName: rawBusinessName,
          primerApellido: pAp,
          segundoApellido: sAp,
          vatNumber: vat,
          email: leadToEdit.email || cd.email || getScalar(ad['EMAIL']) || getScalar(ad['Email Contacto']) || '',
          phone: leadToEdit.phone || cd.phone || getScalar(ad['TLF']) || getScalar(ad['Teléfono Contacto']) || '',
          cnae: leadToEdit.sipsCnae || cd.cnae || getScalar(ad['CNAE']) || getScalar(ad['SIPS Cnae']) || '',
          
          tipoVia: cd.direccion?.tipoVia || cd.tipoVia || getScalar(ad['Tipo de vía Titular']) || 'Calle',
          nombreVia: cd.direccion?.nombreVia || cd.nombreVia || getScalar(ad['Calle Titular']) || getScalar(ad['DOMICILIO SOC']) || '',
          tipoNumeracion: cd.direccion?.tipoNumeracion || cd.tipoNumeracion || normNum(getScalar(ad['Tipo de numeración Titular'])),
          numKm: cd.direccion?.numKm || cd.numKm || getScalar(ad['Número Titular']) || '',
          adicional: cd.direccion?.adicional || cd.adicional || getScalar(ad['Adicional Titular']) || '',
          cp: cd.direccion?.cp || cd.cp || getScalar(ad['CP SOC']) || '',
          poblacion: cd.direccion?.poblacion || cd.poblacion || getScalar(ad['Población Titular']) || getScalar(ad['POBLACION SOC']) || '',
          provincia: cd.direccion?.provincia || cd.provincia || getScalar(ad['Provincia Titular']) || getScalar(ad['PROVINCIA SOC']) || '',
          pais: cd.direccion?.pais || cd.pais || getScalar(ad['País Titular']) || 'España',

          sTipoVia: cd.direccionSuministro?.tipoVia || cd.sTipoVia || getScalar(ad['Tipo de vía Instalación']) || 'Calle',
          sNombreVia: cd.direccionSuministro?.nombreVia || cd.sNombreVia || getScalar(ad['Calle Instalación']) || getScalar(ad['DOMICILIO PS']) || getScalar(ad['DOMICILIO PS COMPLETO']) || '',
          sTipoNumeracion: cd.direccionSuministro?.tipoNumeracion || cd.sTipoNumeracion || normNum(getScalar(ad['Tipo de numeración Instalación'])),
          sNumero: cd.direccionSuministro?.numKm || cd.sNumero || cd.sNumKm || getScalar(ad['Número Instalación']) || '',
          sAdicional: cd.direccionSuministro?.adicional || cd.sAdicional || getScalar(ad['Adicional Instalación']) || '',
          sCp: cd.direccionSuministro?.cp || cd.sCp || getScalar(ad['Código Postal Instalación']) || getScalar(ad['CP PS']) || '',
          sPoblacion: cd.direccionSuministro?.poblacion || cd.sPoblacion || getScalar(ad['Población Instalación']) || getScalar(ad['POBLACION PS']) || '',
          sProvincia: cd.direccionSuministro?.provincia || cd.sProvincia || getScalar(ad['Provincia Instalación']) || getScalar(ad['PROVINCIA PS']) || '',
          sPais: cd.direccionSuministro?.pais || cd.sPais || getScalar(ad['País Instalación']) || 'España',
          
          contactoNombre: leadToEdit.contactName || cd.contactoNombre || getScalar(ad['Nombre Contacto']) || '',
          contactoApellidos: leadToEdit.contactLastName || cd.contactoApellidos || getScalar(ad['Apellidos Contacto']) || '',
          contactoNif: leadToEdit.contactVat || cd.contactoNif || getScalar(ad['NIF Contacto']) || '',
          
          cups: leadToEdit.cups || cd.cups || getScalar(ad['CUPS']) || getScalar(ad['CUPS2']) || '',
          tarifa: leadToEdit.tariff || cd.tarifa || getScalar(ad['Tarifa']) || '2.0TD',
          nombreInstalacion: cd.nombreInstalacion || '',
          tipoTramitacion: leadToEdit.tramitationType || cd.tipoTramitacion || getScalar(ad['Tramitación a realizar']) || getScalar(ad['Tipo']) || 'Alta nueva',
          autoconsumo: leadToEdit.hasPanels ? 'SI' : (cd.autoconsumo || (getScalar(ad['¿Autoconsumo?']) === true || getScalar(ad['¿Autoconsumo?']) === 'true' || getScalar(ad['¿Autoconsumo?']) === 'Sí' || getScalar(ad['Autoconsumo']) === 'SI' ? 'SI' : 'NO')),
          firmaManuscrita: cd.firmaManuscrita || false,
          
          bolsilloSolar: cd.bolsilloSolar || (getScalar(ad['¿Asociar a Bolsillo Solar?']) === 'SI' || getScalar(ad['CG Bolsillo Solar']) ? 'SI' : 'NO'),
          tipoProducto: rawTipoProducto,
          product: leadToEdit.product || cd.product || getScalar(ad['Producto']) || getScalar(ad['Producto y Servicio']) || '',
          formaPago: leadToEdit.paymentMethod || cd.formaPago || 'Domiciliación',
          iban: leadToEdit.iban || cd.iban || getScalar(ad['IBAN']) || getScalar(ad['Certificado IBAN']) || '',
          envioFactura: leadToEdit.invoiceDelivery || cd.envioFactura || (getScalar(ad['¿Facturas papel?']) === true || getScalar(ad['¿Facturas papel?']) === 'SI' || getScalar(ad['¿Facturas papel?']) === 'Sí' ? 'Postal' : 'Email'),
          serviciosAdicionales: leadToEdit.additionalServices || cd.serviciosAdicionales || '',
          
          p1c: cd.potencias?.p1 || cd.p1c || String(leadToEdit.p1c || getScalar(ad['P1C']) || ''),
          p2c: cd.potencias?.p2 || cd.p2c || String(leadToEdit.p2c || getScalar(ad['P2C']) || ''),
          p3c: cd.potencias?.p3 || cd.p3c || String(leadToEdit.p3c || getScalar(ad['P3C']) || ''),
          p4c: cd.potencias?.p4 || cd.p4c || String(leadToEdit.p4c || getScalar(ad['P4C']) || ''),
          p5c: cd.potencias?.p5 || cd.p5c || String(leadToEdit.p5c || getScalar(ad['P5C']) || ''),
          p6c: cd.potencias?.p6 || cd.p6c || String(leadToEdit.p6c || getScalar(ad['P6C']) || ''),
          
          ip1: cd.indexado?.ip1 || cd.ip1 || String(getScalar(ad['IP1']) || ''),
          ip2: cd.indexado?.ip2 || cd.ip2 || String(getScalar(ad['IP2']) || ''),
          ip3: cd.indexado?.ip3 || cd.ip3 || String(getScalar(ad['IP3']) || ''),
          ip4: cd.indexado?.ip4 || cd.ip4 || String(getScalar(ad['IP4']) || ''),
          ip5: cd.indexado?.ip5 || cd.ip5 || String(getScalar(ad['IP5']) || ''),
          ip6: cd.indexado?.ip6 || cd.ip6 || String(getScalar(ad['IP6']) || ''),
          feeIndex: cd.indexado?.fee || cd.feeIndex || String(getScalar(ad['FEE']) || ''),
          pexc: cd.pexc || String(getScalar(ad['PExc']) || getScalar(ad['PExc Personalizado']) || '')
        }));
      }
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
      const psData = json.data?.data?.ps?.[0];
      if (psData) {
        if (psData.TarifaATR) updateData('tarifa', psData.TarifaATR);
        
        // Auto-rellenar campos de dirección Suministro (SIPS pertenece a la instalación)
        // Sobrescribimos forzosamente los campos si SIPS nos da el dato real (SIPS es la fuente de la verdad para la distribuidora)
        if (psData.CódigoPostalPS) updateData('sCp', psData.CódigoPostalPS);
        if (psData.MunicipioPS) updateData('sPoblacion', psData.MunicipioPS);
        // (La provincia en SIPS viene en código, por ejemplo '14', así que el usuario la seleccionará del desplegable)
        if (psData.CNAE) updateData('cnae', psData.CNAE);
      }
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
        direccionSuministro: {
          tipoVia: data.sTipoVia,
          nombreVia: data.sNombreVia,
          tipoNumeracion: data.sTipoNumeracion,
          numKm: data.sNumero,
          adicional: data.sAdicional,
          cp: data.sCp,
          poblacion: data.sPoblacion,
          provincia: data.sProvincia,
          pais: data.sPais
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
                {mode === 'contract' && <Input label="CNAE" field="cnae" width="half" />}
                <Input label="Nombre Instalación" field="nombreInstalacion" width="half" />
              </div>

              <div className="mt-6 border-t border-[#1E2A3A] pt-6">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 text-[#DEFF9A]">Dirección de Suministro</h4>
                <div className="grid grid-cols-3 gap-4">
                  <Select label="Tipo de vía" field="sTipoVia" options={TIPOS_VIA} width="third" />
                  <Input label="Nombre Vía" field="sNombreVia" width="col-span-2" />
                  <Select label="Tipo numeración" field="sTipoNumeracion" options={['NÚMERO', 'KM', 'S/N']} width="third" />
                  <Input label="Núm/Km" field="sNumero" width="third" />
                  <Input label="Adicional (Piso, Puerta)" field="sAdicional" width="third" />
                  <Input label="Código Postal" field="sCp" width="third" />
                  <Input label="Población" field="sPoblacion" width="third" />
                  <Select label="Provincia" field="sProvincia" options={PROVINCIAS} width="third" />
                </div>
              </div>
            </div>

            {mode === 'contract' && (
              <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">Datos del Contrato</h3>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Select label="Tramitación a realizar" field="tipoTramitacion" options={TRAMITACIONES} width="half" />
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
                
                {/* Selector de Producto Dinámico */}
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Producto</label>
                  <select
                    value={data.product}
                    onChange={(e) => setData({ ...data, product: e.target.value })}
                    className="w-full bg-[#0B0F19] border border-[#1E2A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#DEFF9A] transition-colors appearance-none"
                  >
                    <option value="">Seleccione un producto...</option>
                    {productsDb.filter(p => {
                      if (p.tariff && p.tariff !== data.tarifa) return false;
                      if (data.autoconsumo === 'NO' && p.hasSelfConsumption) return false;
                      if (data.autoconsumo === 'SI' && !p.hasSelfConsumption) return false;
                      
                      const reqType = data.tipoProducto ? data.tipoProducto.replace('_PERS', '') : '';
                      if (reqType === 'FIJO' && p.pricingModel !== 'FIXED' && !p.name.toLowerCase().includes('fijo')) return false;
                      if (reqType === 'INDEXADO' && p.pricingModel !== 'INDEXED' && !p.name.toLowerCase().includes('indexado')) return false;
                      
                      return true;
                    }).map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                    {/* Fallback por si el producto asignado no existe en la base de datos pero estaba guardado */}
                    {data.product && !productsDb.find(p => p.name === data.product) && (
                      <option value={data.product}>{data.product} (Histórico)</option>
                    )}
                  </select>
                </div>
                
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
