'use client';

import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ChevronLeft, FileText, CheckCircle, Clock, Ban, CalendarDays, Wallet, Building, Search, Banknote, MapPin, Zap, RefreshCw, Download, FileCheck, Power, Send, User, Settings, AlertTriangle, FileSpreadsheet, Battery, BarChart2 } from 'lucide-react';
import { useState } from 'react';
import { formatDateUTC } from '@/lib/utils/date';
import { updateContractDatesAction, sendContractToDocuSignAction, deleteLatestVersionAction } from '@/app/actions/contractActions';
import { createContractModificationAction } from '@/app/actions/contractModification';
import { generateSwitchingXmls } from '@/app/actions/switchingGenerarActions';
import ConsumosTab from './ConsumosTab';
import ModificationModal from './ModificationModal';
import HistoricalChart from './HistoricalChart';

export default function ContractDetailClient({ 
  initialContract, 
  userRole, 
  maxRenewalDays,
  versions = []
}: { 
  initialContract: any, 
  userRole: string, 
  maxRenewalDays: number,
  versions?: any[]
}) {
  const router = useRouter();
  
  // Tabs State
  const [activeTab, setActiveTab] = useState('Datos');
  const [activeSubTab, setActiveSubTab] = useState('Resumen Histórico');

  // Modal states
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDatesModal, setShowDatesModal] = useState(false);
  const [showModModal, setShowModModal] = useState(false);
  const [isSendingSignature, setIsSendingSignature] = useState(false);
  const [isRequestingMod, setIsRequestingMod] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isGeneratingXml, setIsGeneratingXml] = useState(false);
  const [isDeletingVersion, setIsDeletingVersion] = useState(false);

  // Forms state
  const formatDateForInput = (isoDate: Date | string | null | undefined) => {
    if (!isoDate) return '';
    return new Date(isoDate).toISOString().split('T')[0];
  };

  const [signatureDate, setSignatureDate] = useState(formatDateForInput(initialContract.signatureDate));
  const [requestDate, setRequestDate] = useState(formatDateForInput(initialContract.requestDate));
  const [activationDate, setActivationDate] = useState(formatDateForInput(initialContract.activationDate));
  const [terminationDate, setTerminationDate] = useState(formatDateForInput(initialContract.terminationDate));
  const [requestType, setRequestType] = useState(initialContract.requestType || 'M1S');
  const [version, setVersion] = useState(initialContract.version || '');
  const [modType, setModType] = useState('M1N');

  const isAdmin = userRole === 'SUPERADMIN' || userRole === 'BACKOFFICE';
  const isAdvancedUser = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);
  const showSips = ['COMERCIAL', 'CANAL', 'BACKOFFICE', 'COMPANYADMIN', 'SUPERADMIN'].includes(userRole);
  const isWithinRenewalPeriod = () => {
    if (!initialContract.expectedEndDate) return false;
    const end = new Date(initialContract.expectedEndDate).getTime();
    const now = new Date().getTime();
    const diffDays = (end - now) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= maxRenewalDays;
  };
  const canRequestMod = isAdmin || (userRole === 'CANAL' && isWithinRenewalPeriod());

  const cData = initialContract.contractData || initialContract.airtableData || {};
  const leadData = initialContract.lead?.contractData || {};
  const lead = initialContract.lead || {};
  const client = initialContract.client || {};
  const supplyPoint = initialContract.supplyPoint || {};

  const getNombreSolo = () => {
    const fullName = client.businessName || lead.businessName || '';
    const apellidos = `${client.primerApellido || leadData.primerApellido || ''} ${client.segundoApellido || leadData.segundoApellido || ''}`.trim() || leadData.apellidosContacto || '';
    if (apellidos && fullName.toLowerCase().includes(apellidos.toLowerCase())) {
      const regex = new RegExp(apellidos.trim(), 'i');
      return fullName.replace(regex, '').trim() || fullName;
    }
    return fullName;
  };

  const getPricesFromLead = (ld: any) => {
    return {
      p1E: initialContract.p1e || cData['P1E'] || cData['P1E (from Producto)']?.[0] || '0.000',
      p2E: initialContract.p2e || cData['P2E'] || cData['P2E (from Producto)']?.[0] || '0.000',
      p3E: initialContract.p3e || cData['P3E'] || cData['P3E (from Producto)']?.[0] || '0.000',
      p4E: initialContract.p4e || cData['P4E'] || cData['P4E (from Producto)']?.[0] || '0.000',
      p5E: initialContract.p5e || cData['P5E'] || cData['P5E (from Producto)']?.[0] || '0.000',
      p6E: initialContract.p6e || cData['P6E'] || cData['P6E (from Producto)']?.[0] || '0.000',
      p1P: initialContract.p1p || cData['P1P'] || cData['P1P (from Producto)']?.[0] || '-',
      p2P: initialContract.p2p || cData['P2P'] || cData['P2P (from Producto)']?.[0] || '-',
      p3P: initialContract.p3p || cData['P3P'] || cData['P3P (from Producto)']?.[0] || '-',
      p4P: initialContract.p4p || cData['P4P'] || cData['P4P (from Producto)']?.[0] || '-',
      p5P: initialContract.p5p || cData['P5P'] || cData['P5P (from Producto)']?.[0] || '-',
      p6P: initialContract.p6p || cData['P6P'] || cData['P6P (from Producto)']?.[0] || '-',
      fee: initialContract.fee || initialContract.commissionBase || cData['Fee Index'] || cData['Fee Index (from Producto)']?.[0] || '0.00'
    };
  };

  const getSvaName = () => {
    let svaName = initialContract.svaConcept || initialContract.servicio || '-';
    if (svaName !== '-' && svaName.startsWith('rec')) {
        const serviciosMap: Record<string, string> = {
          "rec3giNSPTAHYZ6Ca": "Batería Virtual (5,99 €/mes)",
          "rec4ALZMphWAuIb40": "Gestión energía a precio de coste (3,90 €/mes)",
          "rec4m16hzWuPSCFC7": "Asesoramiento energético + Factura en papel (9,49 €/mes)",
          "recDNE5NjUQdbAOK5": "Asesoramiento energético (5,99 €/mes)",
          "recH9hgmpZsGugcdJ": "Asociar a Bolsillo solar (3,50 €/mes)",
          "recNbIOQwp6G0nheT": "Asesoramiento energético (4,99 €/factura)",
          "recQ2kTt4tTJLimlb": "Factura en papel (3,50 €/mes)",
          "recyJxb4cSWoRsM8b": "Alta Nueva (25 €/alta)"
        };
        if (serviciosMap[svaName]) {
            svaName = serviciosMap[svaName];
        } else {
            const prodYServ = (initialContract.contractData?.['Producto y Servicio']) || (initialContract.airtableData?.['Producto y Servicio']);
            if (prodYServ && typeof prodYServ === 'string') {
                const match = prodYServ.match(/"([^"]+)"/);
                if (match) svaName = match[1];
            }
        }
    }
    return svaName === '-' ? 'Sin SVA' : svaName;
  };

  const handleSendToSignature = async () => { /* ... */ };
  const downloadContract = async () => { /* ... */ };
  const handleSaveDates = async () => { /* ... */ };
  const handleRequestMod = async () => { /* ... */ };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVO': return <span className="badge badge-active flex items-center gap-1 max-w-max"><CheckCircle size={12}/> Activo</span>;
      case 'ACEPTADO': return <span className="px-2 py-1 rounded text-xs font-bold bg-[rgba(59,130,246,0.15)] text-blue-400 border border-[rgba(59,130,246,0.3)] flex items-center gap-1 max-w-max"><FileCheck size={12}/> Aceptado</span>;
      case 'TRAMITANDO': return <span className="badge badge-process flex items-center gap-1 max-w-max"><Clock size={12}/> Tramitando</span>;
      case 'BAJA': return <span className="badge badge-danger flex items-center gap-1 max-w-max"><Ban size={12}/> Baja</span>;
      case 'RENOVACION': return <span className="badge badge-warning flex items-center gap-1 max-w-max"><CalendarDays size={12}/> Renovación</span>;
      default: return <span className="badge badge-draft">{status}</span>;
    }
  };

  const DataItem = ({ label, value, icon: Icon, highlight, colSpan }: { label: string, value: React.ReactNode, icon?: any, highlight?: boolean, colSpan?: number }) => (
    <div className={`p-4 rounded-xl border transition-all ${highlight ? 'bg-[rgba(222,255,154,0.03)] border-[var(--lime)] border-opacity-30' : 'bg-[var(--bg-elevated)] border-[var(--border)]'} ${colSpan ? `col-span-${colSpan}` : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={14} className={highlight ? 'text-[var(--lime)]' : 'text-gray-400'} />}
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-[0.95rem] font-medium break-words ${highlight ? 'text-[var(--lime)]' : 'text-gray-200'}`}>
        {value || '-'}
      </div>
    </div>
  );

  const SectionCard = ({ title, icon: Icon, children, delay }: { title: string, icon: any, children: React.ReactNode, delay: number }) => (
    <div className={`card animate-fade-in-up delay-${delay}`} style={{ padding: '24px' }}>
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border)]">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--bg-base)] border border-[var(--border-strong)]">
          <Icon size={18} className="text-[var(--text-primary)]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );

  const tabs = [
    { id: 'Datos', icon: FileText },
    ...(showSips ? [{ id: 'Sips', icon: Search }] : []),
    ...(isAdvancedUser ? [{ id: 'Switching', icon: RefreshCw }] : []),
    { id: 'Reclamaciones', icon: AlertTriangle },
    { id: 'Facturación', icon: Banknote },
    ...(isAdvancedUser ? [
      { id: 'Consumos', icon: Zap },
      { id: 'F1s', icon: FileSpreadsheet }
    ] : [])
  ];

  const subTabs = [
    { id: 'Resumen Histórico', icon: BarChart2 },
    { id: 'Datos Administrativos', icon: User },
    { id: 'Datos Contrato', icon: FileText },
    { id: 'Datos Técnicos CUPS', icon: Zap },
    { id: 'Datos Económicos Contrato', icon: Wallet },
    { id: 'Catastro', icon: MapPin },
    { id: 'Datos CAU', icon: Battery },
  ];

  const airtableData = (initialContract.airtableData as any) || {};
  
  let draftUrl = initialContract.pdfUrl || null;
  if (!draftUrl && airtableData['Borrador contrato'] && Array.isArray(airtableData['Borrador contrato']) && airtableData['Borrador contrato'].length > 0) {
    draftUrl = airtableData['Borrador contrato'][0].url;
  }

  let signedUrl = initialContract.filePdfSigned || null;
  if (!signedUrl && airtableData['PDF Contrato firmado'] && Array.isArray(airtableData['PDF Contrato firmado']) && airtableData['PDF Contrato firmado'].length > 0) {
    signedUrl = airtableData['PDF Contrato firmado'][0].url;
  } else if (!signedUrl && airtableData['Contrato .PDF'] && Array.isArray(airtableData['Contrato .PDF']) && airtableData['Contrato .PDF'].length > 0) {
    signedUrl = airtableData['Contrato .PDF'][0].url;
  }

  let annexUrl = initialContract.fileAnexoFirmado || null;
  if (!annexUrl && airtableData['PDF Anexo firmado'] && Array.isArray(airtableData['PDF Anexo firmado']) && airtableData['PDF Anexo firmado'].length > 0) {
    annexUrl = airtableData['PDF Anexo firmado'][0].url;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '100px' }}>
      <Topbar
        title={`Contrato: ${client.businessName || lead.businessName || 'Sin Cliente'}`}
        subtitle={`CUPS: ${supplyPoint.cups || lead.cups || 'Sin CUPS'}`}
        showSearch={false}
        customActions={
          <div className="flex gap-3 items-center">
            <button onClick={() => router.push('/contratos')} className="btn-ghost">
              <ChevronLeft size={16} /> Volver
            </button>
            <div className="h-8 border-l border-[var(--border)] mx-2"></div>
            {isAdmin && !['ACTIVO', 'FINALIZADO', 'BAJA', 'RECHAZADO'].includes(initialContract.status) && !initialContract.activationDate && !['R', 'E1'].includes(initialContract.tipo) && (
              <button
                onClick={async () => {
                  setIsGeneratingXml(true);
                  try {
                    const res = await generateSwitchingXmls([initialContract.id]);
                    if (res.success && res.fileContent) {
                      const link = document.createElement('a');
                      link.href = `data:application/zip;base64,${res.fileContent}`;
                      link.download = res.fileName || 'Switching_Generado.zip';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      if (res.validationErrors && res.validationErrors.length > 0) {
                         alert("Aviso: " + res.validationErrors.map((v: any) => v.motivo).join(', '));
                      }
                    } else {
                      alert(res.error || 'Error generando XML');
                      if (res.validationErrors && res.validationErrors.length > 0) {
                         alert("Aviso: " + res.validationErrors.map((v: any) => v.motivo).join(', '));
                      }
                    }
                  } catch (err: any) {
                    alert(err.message || 'Error desconocido');
                  } finally {
                    setIsGeneratingXml(false);
                  }
                }}
                disabled={isGeneratingXml}
                className="btn-secondary flex items-center gap-2 border-[var(--lime)] text-[var(--lime)] hover:bg-[var(--lime)] hover:text-black"
                title="Generar paquete de Switching (XML + PDFs) para esta versión del contrato"
              >
                {isGeneratingXml ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
                {isGeneratingXml ? 'Generando...' : 'Generar XML'}
              </button>
            )}
            {isAdmin && initialContract.status === 'ACTIVO' && (
              <button 
                onClick={() => setShowModModal(true)}
                className="btn-secondary flex items-center gap-2"
                title="Modificar Contrato (Subrogación o Cambio Técnico)"
              >
                <Settings size={16} /> Modificar Contrato
              </button>
            )}
            {initialContract.status === 'BORRADOR' && (
              <button 
                onClick={async () => {
                  setIsSendingSignature(true);
                  const res = await sendContractToDocuSignAction(initialContract.id);
                  setIsSendingSignature(false);
                  if (res.error) alert(res.error);
                  else router.refresh();
                }} 
                disabled={isSendingSignature}
                className="btn-primary flex items-center gap-2"
              >
                {isSendingSignature ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />} 
                {isSendingSignature ? 'Enviando...' : 'Enviar a DocuSign'}
              </button>
            )}
            {versions && versions.length > 1 && initialContract.id === versions[0].id && (
              <button 
                onClick={async () => {
                  if (confirm('¿Estás seguro de que quieres eliminar esta última versión y volver a la anterior? Esta acción no se puede deshacer.')) {
                    setIsDeletingVersion(true);
                    const res = await deleteLatestVersionAction(initialContract.id);
                    setIsDeletingVersion(false);
                    if (res.error) {
                      alert(res.error);
                    } else if (res.previousVersionId) {
                      router.push(`/contratos/${res.previousVersionId}`);
                    }
                  }
                }} 
                disabled={isDeletingVersion}
                className="btn-secondary flex items-center gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
                title="Elimina esta versión y vuelve a la anterior"
              >
                {isDeletingVersion ? <RefreshCw size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                {isDeletingVersion ? 'Eliminando...' : 'Volver a Versión anterior'}
              </button>
            )}
            {versions && versions.length > 1 && (
              <select
                className="form-input text-xs py-1 px-2 h-auto"
                value={initialContract.id}
                onChange={(e) => {
                  if (e.target.value !== initialContract.id) {
                    router.push(`/contratos/${e.target.value}`);
                  }
                }}
                style={{ appearance: 'none', cursor: 'pointer', background: 'var(--bg-elevated)' }}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Versión {v.version} - {formatDateUTC(v.createdAt)} ({v.status})
                  </option>
                ))}
              </select>
            )}
            <div>{getStatusBadge(initialContract.status)}</div>
          </div>
        }
      />

      <div className="max-w-[1400px] mx-auto px-6 py-8 flex flex-col gap-6">

        {/* HORIZONTAL TABS */}
        <div className="flex border-b border-[var(--border)] overflow-x-auto no-scrollbar gap-2 pb-[-1px]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(222,255,154,0.05)]' 
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <tab.icon size={16} /> {tab.id}
            </button>
          ))}
        </div>

        {/* MODALES */}
      {showModModal && (
        <ModificationModal 
          contractId={initialContract.id}
          initialContract={initialContract}
          onClose={() => setShowModModal(false)}
          onSuccess={(newId) => {
            setShowModModal(false);
            router.push(`/contratos/${newId}`);
          }}
          submitAction={createContractModificationAction}
        />
      )}
        {/* TAB CONTENT */}
        {activeTab === 'Datos' && (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            
            {/* VERTICAL TABS */}
            <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 sticky top-6">
              {subTabs.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                    activeSubTab === sub.id 
                      ? 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--lime)] shadow-sm' 
                      : 'border border-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-elevated)] hover:border-[var(--border)]'
                  }`}
                >
                  <sub.icon size={16} /> {sub.id}
                </button>
              ))}
            </div>

            {/* VERTICAL TAB CONTENT */}
            <div className="flex-1 w-full flex flex-col gap-6">
              
              {activeSubTab === 'Resumen Histórico' && (
                <div className="animate-fade-in-up">
                  <HistoricalChart invoices={initialContract.historicalInvoices || []} />
                </div>
              )}
              {activeSubTab === 'Datos Administrativos' && (
                <SectionCard title="Datos Administrativos" icon={User} delay={0}>
                  <DataItem label="Tipo de Cliente" value={client.clientType || lead.clientType || 'Empresa'} />
                  {((client.clientType || lead.clientType || '').toLowerCase().includes('física') || (client.clientType || lead.clientType || '').toLowerCase().includes('fisica')) ? (
                    <>
                      <DataItem label="Nombre" value={getNombreSolo()} />
                      <DataItem label="Apellidos" value={`${client.primerApellido || leadData.primerApellido || ''} ${client.segundoApellido || leadData.segundoApellido || ''}`.trim() || leadData.apellidosContacto || '-'} />
                    </>
                  ) : (
                    <DataItem label="Razón Social" value={client.businessName || lead.businessName} />
                  )}
                  <DataItem label="NIF / CIF" value={client.vatNumber || lead.vatNumber} />
                  <DataItem label="CNAE" value={supplyPoint?.cnae || '-'} />
                  
                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2"><h3 className="text-sm font-bold text-gray-400 uppercase">Contacto Principal</h3></div>
                  <DataItem label="Nombre Contacto" value={client.contactName || lead.contactName} />
                  <DataItem label="Apellidos Contacto" value={client.contactLastName || lead.contactLastName} />
                  <DataItem label="Teléfono" value={client.contactPhone || lead.phone} />
                  <DataItem label="Email" value={client.contactEmail || lead.email} />
                  
                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2"><h3 className="text-sm font-bold text-gray-400 uppercase">Representante Legal</h3></div>
                  <DataItem label="Nombre Representante" value={client.representativeName || lead.representativeName || lead.contactRole} />
                  <DataItem label="NIF Representante" value={client.representativeVat || lead.representativeVat} />
                  <DataItem label="Email Representante" value={client.representativeEmail || lead.representativeEmail} />
                  <DataItem label="Teléfono Representante" value={client.representativePhone || lead.representativePhone} />
                  
                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2"><h3 className="text-sm font-bold text-gray-400 uppercase">Datos de Facturación</h3></div>
                  <DataItem label="Domicilio Facturación" value={client.billingAddress || lead.titularStreet} />
                  <DataItem label="Código Postal" value={client.billingPostalCode || lead.titularPostalCode} />
                  <DataItem label="Población" value={client.billingCity || lead.titularCity} />
                  <DataItem label="Provincia" value={client.billingProvince || lead.titularProvince} />
                  <DataItem label="IBAN" value={initialContract.supplyPoint?.iban || initialContract.iban || (client as any).iban || (lead as any)?.iban} />
                  <DataItem label="SWIFT" value={client.swift} />
                  <DataItem label="¿Factura Papel?" value={(client.paperInvoice || lead.paperInvoice) ? 'Sí' : 'No'} />
                  <DataItem label="Email Factura" value={client.invoiceEmail || lead.invoiceEmail || client.contactEmail || lead.email} />
                </SectionCard>
              )}

              {activeSubTab === 'Datos Contrato' && (
                <>
                  <SectionCard title="Datos del Contrato" icon={FileText} delay={0}>
                    <DataItem label="ID Contrato" value={<span className="font-mono text-gray-300 tracking-wider">{initialContract.contractCode || initialContract.id}</span>} />
                    <DataItem label="Producto" value={initialContract.product?.name || lead.product} />
                    <DataItem label="Tipo Tramitación" value={initialContract.tramitationType || 'Alta'} />
                    <DataItem label="Duración (Meses)" value={initialContract.duration || initialContract.product?.permanenceMonths || '12'} />
                    
                    <DataItem label="Fecha Firma" value={initialContract.signatureDate || initialContract.fechafirma || initialContract.fechafirmacontrato ? formatDateUTC(initialContract.signatureDate || initialContract.fechafirma || initialContract.fechafirmacontrato) : '-'} />
                    <DataItem label="Fecha Prev. Activación" value={initialContract.fechaPrevistaActivacion ? formatDateUTC(initialContract.fechaPrevistaActivacion) : '-'} />
                    <DataItem label="Fecha Activación" value={initialContract.activationDate ? formatDateUTC(initialContract.activationDate) : '-'} />
                    <DataItem label="Inicio Permanencia" value={initialContract.permanenceStartDate ? formatDateUTC(initialContract.permanenceStartDate) : '-'} />
                    <DataItem label="Fecha de Baja" value={initialContract.terminationDate ? formatDateUTC(initialContract.terminationDate) : '-'} />
                    <DataItem label="Fecha Prev. Baja" value={initialContract.fechaPrevistaBaja ? formatDateUTC(initialContract.fechaPrevistaBaja) : '-'} />
                  </SectionCard>

                  <SectionCard title="Servicios de Valor Añadido (SVA)" icon={Settings} delay={100}>
                    <DataItem label="Concepto SVA" value={getSvaName()} />
                    <DataItem label="Precio SVA" value={initialContract.svaPrice || initialContract.preciofromSERVICIOS ? `€ ${initialContract.svaPrice || initialContract.preciofromSERVICIOS}` : '-'} />
                    <DataItem label="Duración SVA (Meses)" value={initialContract.svaDuration || '-'} />
                    <DataItem label="Inicio SVA" value={initialContract.svaStartDate ? formatDateUTC(initialContract.svaStartDate) : '-'} />
                  </SectionCard>
                </>
              )}

              {activeSubTab === 'Datos Técnicos CUPS' && (
                <SectionCard title="Datos Técnicos del Punto de Suministro" icon={Zap} delay={0}>
                  <DataItem highlight label="CUPS" value={<span className="font-mono tracking-widest">{supplyPoint.cups || lead.cups}</span>} />
                  <DataItem label="Tarifa" value={<span className="font-mono font-bold text-gray-200">{supplyPoint.tariff || lead.tariff}</span>} />
                  <DataItem label="Consumo Anual Estimado (MWh)" value={lead.estimatedMWh} />
                  <DataItem label="Distribuidora" value={supplyPoint.distributorName ? supplyPoint.distributorName.replace(/^\[.*?\]\s*/, '') : (supplyPoint.distributor ? supplyPoint.distributor.replace(/^\[.*?\]\s*/, '') : 'EDISTRIBUCION')} />
                  
                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2"><h3 className="text-sm font-bold text-gray-400 uppercase">Dirección de Suministro</h3></div>
                  <DataItem label="Dirección" value={
                    (leadData.direccionSuministro || leadData.direccion) 
                      ? `${(leadData.direccionSuministro || leadData.direccion).tipoVia || ''} ${(leadData.direccionSuministro || leadData.direccion).nombreVia || ''} ${(leadData.direccionSuministro || leadData.direccion).tipoNumeracion || ''} ${(leadData.direccionSuministro || leadData.direccion).numKm || ''} ${(leadData.direccionSuministro || leadData.direccion).adicional || ''}`.trim() 
                      : (supplyPoint.address || lead.address)
                  } />
                  <DataItem label="Código Postal" value={supplyPoint.postalCode} />
                  <DataItem label="Población" value={supplyPoint.city} />
                  <DataItem label="Provincia" value={supplyPoint.province} />

                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2"><h3 className="text-sm font-bold text-gray-400 uppercase">Potencias Contratadas (kW)</h3></div>
                  <DataItem label="P1P" value={(initialContract.airtableData as any)?.p1c || initialContract.p1c || supplyPoint.p1c || lead.p1c || supplyPoint.p1p || '-'} />
                  <DataItem label="P2P" value={(initialContract.airtableData as any)?.p2c || initialContract.p2c || supplyPoint.p2c || lead.p2c || supplyPoint.p2p || '-'} />
                  <DataItem label="P3P" value={(initialContract.airtableData as any)?.p3c || initialContract.p3c || supplyPoint.p3c || lead.p3c || supplyPoint.p3p || '-'} />
                  <DataItem label="P4P" value={(initialContract.airtableData as any)?.p4c || initialContract.p4c || supplyPoint.p4c || lead.p4c || supplyPoint.p4p || '-'} />
                  <DataItem label="P5P" value={(initialContract.airtableData as any)?.p5c || initialContract.p5c || supplyPoint.p5c || lead.p5c || supplyPoint.p5p || '-'} />
                  <DataItem label="P6P" value={(initialContract.airtableData as any)?.p6c || initialContract.p6c || supplyPoint.p6c || lead.p6c || supplyPoint.p6p || '-'} />
                </SectionCard>
              )}

              {activeSubTab === 'Datos Económicos Contrato' && (
                <>
                  <SectionCard title="Información Comercial del Contrato" icon={FileText} delay={0}>
                    <DataItem highlight label="Producto Contratado" value={initialContract.product?.name || lead.product} />
                    <DataItem label="Tipo de Producto" value={initialContract.product?.type || '-'} />
                    <DataItem highlight label="Servicio de Valor Añadido (SVA)" value={getSvaName()} />
                  </SectionCard>

                  <SectionCard title="Precios de Energía Activa (€/kWh)" icon={Wallet} delay={50}>
                    <DataItem label="P1E" value={getPricesFromLead(lead).p1E} />
                    <DataItem label="P2E" value={getPricesFromLead(lead).p2E} />
                    <DataItem label="P3E" value={getPricesFromLead(lead).p3E} />
                    {(initialContract.product?.tariff !== '2.0TD' && supplyPoint?.tariff !== '2.0TD') && (
                      <>
                        <DataItem label="P4E" value={getPricesFromLead(lead).p4E} />
                        <DataItem label="P5E" value={getPricesFromLead(lead).p5E} />
                        <DataItem label="P6E" value={getPricesFromLead(lead).p6E} />
                      </>
                    )}
                  </SectionCard>

                  <SectionCard title="Precios de Potencia (€/kW/año)" icon={Zap} delay={50}>
                    <DataItem label="P1P" value={getPricesFromLead(lead).p1P} />
                    <DataItem label="P2P" value={getPricesFromLead(lead).p2P} />
                    {(initialContract.product?.tariff !== '2.0TD' && supplyPoint?.tariff !== '2.0TD') && (
                      <>
                        <DataItem label="P3P" value={getPricesFromLead(lead).p3P} />
                        <DataItem label="P4P" value={getPricesFromLead(lead).p4P} />
                        <DataItem label="P5P" value={getPricesFromLead(lead).p5P} />
                        <DataItem label="P6P" value={getPricesFromLead(lead).p6P} />
                      </>
                    )}
                  </SectionCard>

                  <SectionCard title="Costes de Gestión y Comisiones" icon={Banknote} delay={150}>
                    <DataItem highlight label="Fee / Margen Comercial" value={`€ ${getPricesFromLead(lead).fee}`} />
                    <DataItem label="CG Bolsillo Solar" value={initialContract.cgBolsilloSolar || '-'} />
                    <DataItem label="Coste Desvíos" value={initialContract.deviationCost || '-'} />
                    <DataItem label="Precio Excedentes" value={initialContract.pexc || '-'} />
                    <DataItem label="Comisión Estimada" value={`€ ${initialContract.commissionBase || '0.00'}`} />
                    <DataItem highlight label="Comisión Final" value={`€ ${initialContract.commissionFinal || '0.00'}`} />
                  </SectionCard>

                  <SectionCard title="Descuentos Aplicados" icon={CheckCircle} delay={200}>
                    <DataItem label="Descuento (€)" value={initialContract.discountPrice || '-'} />
                    <DataItem label="Fecha Inicio Descuento" value={initialContract.discountStartDate ? formatDateUTC(initialContract.discountStartDate) : '-'} />
                    <DataItem label="Fecha Fin Descuento" value={initialContract.discountEndDate ? formatDateUTC(initialContract.discountEndDate) : '-'} />
                  </SectionCard>
                </>
              )}

              {activeSubTab === 'Catastro' && (
                <SectionCard title="Información Catastral" icon={MapPin} delay={0}>
                  <DataItem highlight label="Referencia Catastral" value={supplyPoint.cadastralReference || '-'} />
                  <DataItem label="Provincia Catastro" value={supplyPoint.cadastreProvince || '-'} />
                  <DataItem label="Municipio Catastro" value={supplyPoint.cadastreCity || '-'} />
                  <DataItem label="Tipo Vía" value={supplyPoint.cadastreStreetType || '-'} />
                  <DataItem label="Nombre Vía" value={supplyPoint.cadastreAddress || '-'} />
                  <DataItem label="Número" value={supplyPoint.cadastreNumber || '-'} />
                  <DataItem label="Bloque" value={supplyPoint.cadastreBlock || '-'} />
                  <DataItem label="Planta" value={supplyPoint.cadastreFloor || '-'} />
                  <DataItem label="Puerta" value={supplyPoint.cadastreDoor || '-'} />
                </SectionCard>
              )}

              {activeSubTab === 'Datos CAU' && (
                <SectionCard title="Código de Autoconsumo (CAU)" icon={Battery} delay={0}>
                  <DataItem highlight label="CAU" value={supplyPoint.cau || '-'} />
                  <DataItem label="Tipo Autoconsumo" value={supplyPoint.cauType || supplyPoint.selfConsumptionType || '-'} />
                  <DataItem label="Subtipo" value={supplyPoint.cauSubtype || '-'} />
                  <DataItem label="Colectivo" value={supplyPoint.cauCollective || '-'} />
                  <DataItem label="CIL" value={supplyPoint.cil || '-'} />
                  <DataItem label="CIE Autoconsumo" value={supplyPoint.cieSelfConsumption || '-'} />
                  <DataItem label="CIE Consumo" value={supplyPoint.cie || '-'} />
                  <DataItem label="Tecnología Generador" value={supplyPoint.generatorTechnology || '-'} />
                  <DataItem label="Potencia Instalada Generación (kW)" value={supplyPoint.installedPowerGen || '-'} />
                  <DataItem label="Tipo de Instalación" value={supplyPoint.installationType || '-'} />
                  <DataItem label="Esquema de Medida" value={supplyPoint.meteringScheme || '-'} />
                </SectionCard>
              )}

            </div>
          </div>
        )}

        {activeTab === 'Facturación' && (
          <div className="card p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Banknote className="text-gray-400" /> Facturas del Contrato
              </h2>
            </div>
            
            {!initialContract.invoices || initialContract.invoices.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
                No hay facturas emitidas para este contrato.
              </div>
            ) : (
              <>
              {/* Mobile View Facturas */}
              <div className="block md:hidden">
                <div className="flex flex-col gap-3">
                  {initialContract.invoices.map((inv: any) => (
                    <div key={inv.id} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-[var(--lime)] font-bold mb-1">{inv.invoiceNumber}</div>
                          <div className="text-sm text-gray-300">Emisión: {formatDateUTC(inv.issueDate)}</div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          inv.status === 'PAGADA' ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]' :
                          inv.status === 'PENDIENTE' ? 'bg-[rgba(234,179,8,0.15)] text-yellow-400 border border-[rgba(234,179,8,0.3)]' :
                          'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="text-gray-400"><span className="text-gray-500">Periodo (Dist):</span> {inv.invoiceData?.Desde || inv.desde ? formatDateUTC(inv.invoiceData?.Desde || inv.desde) : '-'} al {inv.invoiceData?.Hasta || inv.hasta ? formatDateUTC(inv.invoiceData?.Hasta || inv.hasta) : '-'}</div>
                        <div className="text-gray-500"><span className="text-gray-600">Periodo (Energía):</span> {inv.invoiceData?.['Desde(EA)'] || inv.desdeEA ? new Date(inv.invoiceData?.['Desde(EA)'] || inv.desdeEA).toLocaleDateString('es-ES') : '-'} al {inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA ? new Date(inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA).toLocaleDateString('es-ES') : '-'}</div>
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-strong)]">
                        <div className="text-base font-bold text-[var(--lime)]">€ {inv.totalAmount.toFixed(2)}</div>
                        <a href={`/facturas/${inv.id}`} className="bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white">Ver Detalles</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Desktop View Facturas */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400">NÚMERO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">FECHA EMISIÓN</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PERIODO (DISTRIBUIDORA)</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PERIODO (ENERGÍA)</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">TOTAL</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ESTADO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.invoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                        <td className="py-3 px-4 font-mono text-sm text-gray-300">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 text-sm text-gray-300">{formatDateUTC(inv.issueDate)}</td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {inv.invoiceData?.Desde || inv.desde ? formatDateUTC(inv.invoiceData?.Desde || inv.desde) : '-'} al {inv.invoiceData?.Hasta || inv.hasta ? formatDateUTC(inv.invoiceData?.Hasta || inv.hasta) : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {inv.invoiceData?.['Desde(EA)'] || inv.desdeEA ? new Date(inv.invoiceData?.['Desde(EA)'] || inv.desdeEA).toLocaleDateString('es-ES') : '-'} al {inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA ? new Date(inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-[var(--lime)]">€ {inv.totalAmount.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold max-w-max ${
                            inv.status === 'PAGADA' ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]' :
                            inv.status === 'PENDIENTE' ? 'bg-[rgba(234,179,8,0.15)] text-yellow-400 border border-[rgba(234,179,8,0.3)]' :
                            'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <a href={`/facturas/${inv.id}`} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">Ver Detalles</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'Sips' && (
          <div className="card p-6 animate-fade-in-up max-w-3xl">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Search className="text-gray-400" /> SIPS
              </h2>
            </div>
            
            <p className="text-gray-400 mb-6">
              Actualiza los datos SIPS (Sistema de Información de Puntos de Suministro) directamente para este contrato. El CUPS asociado es <span className="font-mono text-gray-200">{supplyPoint.cups}</span>.
            </p>
            
            <div className="bg-[var(--bg-elevated)] p-5 border border-[var(--border)] rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-gray-200">Consultar / Actualizar SIPS</h4>
                <p className="text-xs text-gray-400 mt-1">Se realizará una petición al endpoint de SIPS para refrescar consumos y potencias.</p>
              </div>
              <button className="btn-primary flex items-center gap-2">
                <RefreshCw size={16} /> Actualizar Datos SIPS
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Switching' && (
          <div className="card p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <RefreshCw className="text-gray-400" /> Histórico Switching (XMLs)
              </h2>
            </div>
            
            {!initialContract.switchingEvents || initialContract.switchingEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
                No hay registros de switching procesados para este CUPS.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400">FECHA INTERCAMBIO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">CÓD. SOLICITUD</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PROCESO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PASO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ESTADO A/R</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">FECHA A/R</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">FECHA PREV. ACT.</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">OBSERVACIONES</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ARCHIVO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.switchingEvents.map((ev: any) => (
                      <tr key={ev.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                        <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                          {ev.fechaSolicitud ? formatDateUTC(ev.fechaSolicitud) : (ev.fechaAviso ? formatDateUTC(ev.fechaAviso) : '-')}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-400">{ev.codigoSolicitud || '-'}</td>
                        <td className="py-3 px-4 text-[var(--lime)] font-bold">{ev.proceso || '-'}</td>
                        <td className="py-3 px-4 text-gray-300">{ev.paso || '-'}</td>
                        <td className="py-3 px-4">
                          {ev.estadoAR ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold max-w-max ${
                              ev.estadoAR === 'ACEPTADO' ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]' :
                              ev.estadoAR === 'RECHAZADO' ? 'bg-[rgba(239,68,68,0.15)] text-red-400 border border-[rgba(239,68,68,0.3)]' :
                              'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                            }`}>
                              {ev.estadoAR}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-400">{ev.fechaAR ? formatDateUTC(ev.fechaAR) : '-'}</td>
                        <td className="py-3 px-4 text-gray-300 font-medium">{ev.fechaPrevActivacion ? formatDateUTC(ev.fechaPrevActivacion) : '-'}</td>
                        <td className="py-3 px-4 text-gray-500 max-w-[200px] truncate" title={ev.observaciones || ''}>{ev.observaciones || '-'}</td>
                        <td className="py-3 px-4">
                          {ev.xmlUrl ? (
                            <a href={ev.xmlUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[var(--lime)] hover:text-white transition-colors" title="Descargar XML Original">
                              <Download size={14} /> XML
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Reclamaciones' && (
          <div className="card p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-gray-400" /> Reclamaciones (R1)
              </h2>
            </div>
            
            {!initialContract.claims || initialContract.claims.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
                No hay reclamaciones registradas para este contrato.
              </div>
            ) : (
              <>
              {/* Mobile View Reclamaciones */}
              <div className="block md:hidden">
                <div className="flex flex-col gap-3">
                  {initialContract.claims.map((claim: any) => (
                    <div key={claim.codigoSolicitud} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-[var(--lime)] font-bold mb-1 flex items-center gap-2">
                            {claim.codigoSolicitud}
                            {claim.paso01?.xmlUrl && (
                              <a href={claim.paso01.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 01" className="text-gray-400 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">Cód. Dist: <span className="font-mono text-gray-300">{claim.codigoReclamacion || '-'}</span></div>
                        </div>
                        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Días Abierta</div>
                          <div className="font-bold text-white">{claim.diasAbierta !== null ? claim.diasAbierta : '-'}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--border-strong)] pt-2">
                        <div>
                          <div className="text-gray-500 mb-1">Paso 01</div>
                          <div className="text-gray-300">{claim.paso01?.fecha ? formatDateUTC(claim.paso01.fecha) : '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Paso 02</div>
                          <div className="text-gray-300 flex items-center gap-2">
                            {claim.paso02?.fecha ? formatDateUTC(claim.paso02.fecha) : '-'}
                            {claim.paso02?.xmlUrl && (
                              <a href={claim.paso02.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 02" className="text-gray-500 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 text-xs border-t border-[var(--border-strong)] pt-2">
                        <div>
                          <div className="text-gray-500 mb-1">Paso 03 (Comentarios)</div>
                          <div className="text-gray-300 flex items-start justify-between gap-2">
                            <span className="italic">{claim.paso03?.comentario || '-'}</span>
                            {claim.paso03?.xmlUrl && (
                              <a href={claim.paso03.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 03" className="text-gray-500 hover:text-[var(--lime)] shrink-0 mt-0.5">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Paso 05 (Resolución)</div>
                          <div className="text-gray-300 flex items-start justify-between gap-2">
                            <span className="italic">{claim.paso05?.comentario || '-'}</span>
                            {claim.paso05?.xmlUrl && (
                              <a href={claim.paso05.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 05" className="text-gray-500 hover:text-[var(--lime)] shrink-0 mt-0.5">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Desktop View Reclamaciones */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400">CÓD. SOLICITUD</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">CÓD. DISTRIBUIDORA</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-center">DÍAS ABIERTA</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PASO 01</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PASO 02</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">COMENTARIOS PASO 03</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">RESOLUCIÓN PASO 05</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.claims.map((claim: any) => (
                      <tr key={claim.codigoSolicitud} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                        <td className="py-3 px-4 font-mono text-gray-400">
                          <div className="flex items-center gap-2">
                            {claim.codigoSolicitud}
                            {claim.paso01?.xmlUrl && (
                              <a href={claim.paso01.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 01" className="text-gray-500 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-400">{claim.codigoReclamacion || '-'}</td>
                        <td className="py-3 px-4 font-bold text-center">
                          {claim.diasAbierta !== null ? claim.diasAbierta : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {claim.paso01?.fecha ? formatDateUTC(claim.paso01.fecha) : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          <div className="flex items-center gap-2">
                            {claim.paso02?.fecha ? formatDateUTC(claim.paso02.fecha) : '-'}
                            {claim.paso02?.xmlUrl && (
                              <a href={claim.paso02.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 02" className="text-gray-500 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400 max-w-xs truncate" title={claim.paso03?.comentario || ''}>
                          <div className="flex items-center gap-2">
                            <span className="truncate">{claim.paso03?.comentario || '-'}</span>
                            {claim.paso03?.xmlUrl && (
                              <a href={claim.paso03.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 03" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400 max-w-xs truncate" title={claim.paso05?.comentario || ''}>
                          <div className="flex items-center gap-2">
                            <span className="truncate">{claim.paso05?.comentario || '-'}</span>
                            {claim.paso05?.xmlUrl && (
                              <a href={claim.paso05.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 05" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'F1s' && (
          <div className="card p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="text-gray-400" /> Histórico de Ficheros F1
              </h2>
            </div>
            
            {!initialContract.f1Invoices || initialContract.f1Invoices.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
                No hay ficheros F1 registrados para este contrato.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs">FECHA EMISIÓN</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs">Nº FACTURA</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs">PERIODO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">BASE IMP.</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">PEAJES</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">CARGOS</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">TOTAL</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-center">XML</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.f1Invoices.map((f1: any) => (
                      <tr key={f1.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                        <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                          {f1.fechaEmision ? formatDateUTC(f1.fechaEmision) : '-'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[var(--lime)] font-bold">{f1.numeroFactura || '-'}</td>
                        <td className="py-3 px-4 text-gray-300 text-xs">
                          {f1.fechaInicio && f1.fechaFin 
                            ? `${formatDateUTC(f1.fechaInicio)} - ${formatDateUTC(f1.fechaFin)}`
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-right">{f1.baseImponible != null ? `${f1.baseImponible.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}</td>
                        <td className="py-3 px-4 text-gray-300 text-right">{f1.totalPeajes != null ? `${f1.totalPeajes.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}</td>
                        <td className="py-3 px-4 text-gray-300 text-right">{f1.totalCargos != null ? `${f1.totalCargos.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}</td>
                        <td className="py-3 px-4 text-white font-bold text-right">{f1.saldoFactura != null ? `${f1.saldoFactura.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}</td>
                        <td className="py-3 px-4 text-center">
                          {f1.xmlUrl ? (
                            <a href={f1.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML" className="flex items-center justify-center gap-1 text-[var(--lime)] hover:text-white transition-colors">
                              <Download size={14} /> XML
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {['Consumos'].includes(activeTab) && (
          <ConsumosTab cups={supplyPoint?.cups} />
        )}

      </div>
    </div>
  );
}
