'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Topbar from '@/components/Topbar';
import { ChevronLeft, FileText, CheckCircle, Zap, AlertTriangle, Building, Search, FileCheck, MapPin, User, Calendar, CreditCard, Banknote, XCircle, RefreshCw, Database } from 'lucide-react';
import { convertLeadToContractAction, remakeContractAction } from '@/app/actions/contractActions';
import ProductModal from '@/app/(app)/productos/ProductModal';
import SupplyPointModal from '@/components/SupplyPointModal';

export default function LeadDetailClient({ initialLead }: { initialLead: any }) {
  const router = useRouter();
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSupplyPointModalOpen, setIsSupplyPointModalOpen] = useState(false);

  const getPricesFromLead = (lead: any) => {
    const cData = typeof lead.contractData === 'object' && lead.contractData ? lead.contractData : {};
    return {
      p1: cData['P1P'] || cData['P1P (from Producto)']?.[0] || '0.000',
      p2: cData['P2P'] || cData['P2P (from Producto)']?.[0] || '0.000',
      p3: cData['P3P'] || cData['P3P (from Producto)']?.[0] || '0.000',
      p4: cData['P4P'] || cData['P4P (from Producto)']?.[0] || '0.000',
      p5: cData['P5P'] || cData['P5P (from Producto)']?.[0] || '0.000',
      p6: cData['P6P'] || cData['P6P (from Producto)']?.[0] || '0.000',
      fee: cData['Fee Index'] || cData['Fee Index (from Producto)']?.[0] || '0.00',
      feeExcedentes: cData['Fee Excedentes'] || cData['Fee Excedentes (from Producto)']?.[0] || '0.00',
      bolsilloSolar: cData['CG Bolsillo Solar'] || cData['CG Bolsillo Solar (from Producto)']?.[0] || false
    };
  };

  const downloadOffer = async (offerType: 'suministro' | 'autoconsumo') => {
    setIsDownloading(offerType);
    try {
      const prices = getPricesFromLead(initialLead);
      const res = await fetch('/api/pdf/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: initialLead, prices, offerType })
      });
      
      if (!res.ok) throw new Error('Error al generar PDF');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Oferta_${offerType.toUpperCase()}_AED_${initialLead.cups || initialLead.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Hubo un error al generar la oferta.');
    } finally {
      setIsDownloading(null);
    }
  };

  const airtableData = typeof initialLead.airtableData === 'object' && initialLead.airtableData ? initialLead.airtableData : null;
  const isImported = !!airtableData;

  const cData = typeof initialLead.contractData === 'object' && initialLead.contractData ? { ...initialLead.contractData } : {};

  // Si es importado, mapeamos las columnas crudas de Airtable hacia cData o initialLead
  if (isImported) {
    if (airtableData['DOMICILIO PS COMPLETO']) initialLead.address = airtableData['DOMICILIO PS COMPLETO'];
    else if (airtableData['DOMICILIO PS']) initialLead.address = airtableData['DOMICILIO PS'];

    if ((!initialLead.cups || initialLead.cups.startsWith('CUPS_MOCK')) && airtableData['CUPS2']) initialLead.cups = airtableData['CUPS2'];
    
    if (airtableData['CANAL']) initialLead.source = Array.isArray(airtableData['CANAL']) ? airtableData['CANAL'][0] : airtableData['CANAL'];
    if (airtableData['Producto y Servicio']) initialLead.product = Array.isArray(airtableData['Producto y Servicio']) ? airtableData['Producto y Servicio'][0] : airtableData['Producto y Servicio'];
    if (airtableData['Tipo de producto']) initialLead.productType = Array.isArray(airtableData['Tipo de producto']) ? airtableData['Tipo de producto'][0] : airtableData['Tipo de producto'];

    // Contacto
    if (!initialLead.phone && airtableData['Teléfono Contacto']) initialLead.phone = airtableData['Teléfono Contacto'];
    if (!initialLead.email && airtableData['EMAIL FACTURA']) initialLead.email = airtableData['EMAIL FACTURA'];
    if (!initialLead.vatNumber && airtableData['NIF Titular']) initialLead.vatNumber = airtableData['NIF Titular'];
    if (!initialLead.vatNumber && initialLead.contract?.client?.vatNumber) initialLead.vatNumber = initialLead.contract.client.vatNumber;

    // Campos de cData
    cData.autoconsumo = airtableData['Autoconsumo'] === 'SI' || airtableData['Autoconsumo'] === 'Sí' || airtableData['Autoconsumo'] === 'Si';
    cData.tramitacion = airtableData['Tramitación a realizar'] || airtableData['Tramitación Sop'] || 'Desconocida';
    cData.nombreContacto = initialLead.contactName || airtableData['Nombre Contacto'] || '';
    cData.apellidosContacto = initialLead.contactLastName || airtableData['Apellidos Contacto'] || '';

    const parsePower = (val: any) => {
        if (!val) return null;
        return val.toString().replace(',', '.');
    };
    cData.p1 = parsePower(airtableData['P1C SIPS'] || airtableData['P1C'] || airtableData['P1']) || initialLead.contract?.supplyPoint?.p1c || '-';
    cData.p2 = parsePower(airtableData['P2C SIPS'] || airtableData['P2C'] || airtableData['P2']) || initialLead.contract?.supplyPoint?.p2c || '-';
    cData.p3 = parsePower(airtableData['P3C SIPS'] || airtableData['P3C'] || airtableData['P3']) || initialLead.contract?.supplyPoint?.p3c || '-';
    cData.p4 = parsePower(airtableData['P4C SIPS'] || airtableData['P4C'] || airtableData['P4']) || initialLead.contract?.supplyPoint?.p4c || '-';
    cData.p5 = parsePower(airtableData['P5C SIPS'] || airtableData['P5C'] || airtableData['P5']) || initialLead.contract?.supplyPoint?.p5c || '-';
    cData.p6 = parsePower(airtableData['P6C SIPS'] || airtableData['P6C'] || airtableData['P6']) || initialLead.contract?.supplyPoint?.p6c || '-';

    // Comercial
    if (airtableData['Comercial'] && airtableData['Comercial'] !== '') {
      initialLead.comercialName = airtableData['Comercial'];
    } else if (airtableData['Código comercial'] && airtableData['Código comercial'] !== '') {
      initialLead.comercialName = airtableData['Código comercial'];
    }

    // Bolsillo Solar
    const bolsilloVal = airtableData['BOLSILLO SOLAR'];
    cData.bolsilloSolar = bolsilloVal === 'SI' || bolsilloVal === 'Sí' || airtableData['CG Bolsillo Solar'] === true;

    // Facturación (Papel vs Digital)
    const factPapel = airtableData['¿Facturas papel?'] || airtableData['Facturas papel'];
    cData.envioFactura = factPapel === 'SI' || factPapel === 'Sí' ? 'Papel (Física)' : 'Email (Digital)';
    
    // CNAE y Tipo Cliente y IBAN
    if (!initialLead.cnae && airtableData['SIPS Cnae']) initialLead.cnae = airtableData['SIPS Cnae'];
    if (!initialLead.cnae && initialLead.contract?.supplyPoint?.cnae) initialLead.cnae = initialLead.contract.supplyPoint.cnae;
    if (!initialLead.cnae && initialLead.contract?.client?.cnae) initialLead.cnae = initialLead.contract.client.cnae;
    
    if (!initialLead.iban && initialLead.contract?.supplyPoint?.iban) initialLead.iban = initialLead.contract.supplyPoint.iban;
    if (!initialLead.iban && airtableData['IBAN']) initialLead.iban = airtableData['IBAN'];

    const tPersona = Array.isArray(airtableData['Tipo de persona']) ? airtableData['Tipo de persona'][0] : airtableData['Tipo de persona'];
    if (!initialLead.clientType && tPersona) {
        if (tPersona === 'rec8HjER62nWOalEJ' || tPersona === 'F') initialLead.clientType = 'Física';
        else if (tPersona === 'recSABMEormtSH0ev' || tPersona === 'J') initialLead.clientType = 'Jurídica';
        else initialLead.clientType = tPersona;
    }
    if (!initialLead.clientType && initialLead.contract?.client?.clientType) {
        initialLead.clientType = initialLead.contract.client.clientType;
    }

    
    // Consumo Anual (CONSUMO COMISION está en MWh, CONSUMO ANUAL KWH está en kWh)
    if (!initialLead.estimatedMWh) {
      if (airtableData['CONSUMO COMISION']) {
        initialLead.estimatedMWh = parseFloat(airtableData['CONSUMO COMISION'].toString().replace(',', '.'));
      } else if (airtableData['CONSUMO ANUAL KWH']) {
        initialLead.estimatedMWh = parseFloat(airtableData['CONSUMO ANUAL KWH'].toString().replace(',', '.')) / 1000;
      }
    }

    // Distribuidora
    if (initialLead.contract?.supplyPoint?.distributor) {
      initialLead.distributor = initialLead.contract.supplyPoint.distributor;
    } else {
      const distName = Array.isArray(airtableData['DISTRIBUIDORA']) ? airtableData['DISTRIBUIDORA'][0] : (Array.isArray(airtableData['Nombre Distribuidora']) ? airtableData['Nombre Distribuidora'][0] : airtableData['Nombre Distribuidora']);
      const distCode = airtableData['CODIGO REE DISTRIBUIDORA'];
      if (distName || distCode) {
        initialLead.distributor = distName && distCode ? `[${distCode}] ${distName}` : (distName || distCode);
      }
    }

    // Fechas
    if (airtableData['Fecha Registro']) {
      initialLead.createdAt = airtableData['Fecha Registro']; // para que el formateador la coja
    }
  }

  // Normalizar datos nativos si no vienen del import
  if (!initialLead.clientType && cData.tipoPersona) {
    initialLead.clientType = cData.tipoPersona === 'FISICA' ? 'Persona física' : (cData.tipoPersona === 'JURIDICA' ? 'Persona jurídica' : cData.tipoPersona);
  }
  if (!initialLead.distributor) {
    if (initialLead.dbDistributor) {
      initialLead.distributor = initialLead.dbDistributor;
    } else if (initialLead.cups && initialLead.cups.length >= 6) {
      initialLead.distributor = initialLead.cups.substring(2, 6);
    }
  }

  // Formateo de fechas
  const fechaRegistro = initialLead.createdAt 
    ? new Date(initialLead.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';

  // Potencias (fallback a sipsRawData)
  const sData = (initialLead as any).sipsRawData || cData.sipsData || {};
  const p1 = cData.p1 || cData.potencias?.p1 || sData.p1 || '-';
  const p2 = cData.p2 || cData.potencias?.p2 || sData.p2 || '-';
  const p3 = cData.p3 || cData.potencias?.p3 || sData.p3 || '-';
  const p4 = cData.p4 || cData.potencias?.p4 || sData.p4 || '-';
  const p5 = cData.p5 || cData.potencias?.p5 || sData.p5 || '-';
  const p6 = cData.p6 || cData.potencias?.p6 || sData.p6 || '-';

  const DataItem = ({ label, value, icon: Icon, highlight }: { label: string, value: React.ReactNode, icon?: any, highlight?: boolean }) => (
    <div className={`p-4 rounded-xl border transition-all ${highlight ? 'bg-[rgba(222,255,154,0.03)] border-[var(--lime)] border-opacity-30' : 'bg-[var(--bg-elevated)] border-[var(--border)]'}`}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={14} className={highlight ? 'text-[var(--lime)]' : 'text-gray-400'} />}
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-[0.95rem] font-medium ${highlight ? 'text-[var(--lime)]' : 'text-gray-200'}`}>
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '100px' }}>
      <Topbar
        title={`Lead: ${initialLead.businessName || 'Sin Nombre'}`}
        subtitle={`ID: ${initialLead.id.toUpperCase()}`}
        customActions={
          <div className="flex gap-3 items-center">
            {(initialLead.isMultipoint || initialLead.businessName?.toUpperCase().includes('ERANOVUM')) && (
              <span className="px-3 py-1.5 rounded-md bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.3)] text-green-400 text-sm font-semibold flex items-center gap-2">
                <CheckCircle size={14} /> Cliente Multipunto
              </span>
            )}
            <button onClick={() => router.push('/leads')} className="btn-ghost">
              <ChevronLeft size={16} /> Volver a Leads
            </button>
            <button 
              className="btn-ghost text-gray-300 hover:text-white"
              disabled={!!isDownloading}
              onClick={() => downloadOffer('suministro')}
            >
              {isDownloading === 'suministro' ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />} 
              Oferta Suministro
            </button>
            <button 
              className="btn-ghost text-gray-300 hover:text-white"
              disabled={!!isDownloading}
              onClick={() => downloadOffer('autoconsumo')}
            >
              {isDownloading === 'autoconsumo' ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />} 
              Oferta Autoconsumo
            </button>
            {initialLead.status !== 'CONTRATADO' && !initialLead.contractId && (
              <button 
                className="btn-primary" 
                disabled={isConverting}
                onClick={async () => {
                  setIsConverting(true);
                  setValidationErrors(null);
                  const res = await convertLeadToContractAction(initialLead.id);
                  if (res.error === 'VALIDATION_FAILED' && res.validationErrors) {
                    setValidationErrors(res.validationErrors);
                    setIsConverting(false);
                  } else if (res.error) {
                    alert(res.error);
                    setIsConverting(false);
                  } else {
                    router.push(`/contratos/${res.contractId}`);
                  }
                }}
              >
                {isConverting ? <CheckCircle size={16} className="animate-spin" /> : <FileCheck size={16} />} 
                {isConverting ? 'Generando...' : 'Generar Contrato'}
              </button>
            )}
            
            {initialLead.contractId && (
              <>
                <button 
                  className="btn-ghost text-gray-300 hover:text-white hover:bg-[var(--bg-elevated)]"
                  disabled={isConverting}
                  onClick={async () => {
                    if(!confirm('¿Estás seguro de que quieres rehacer este contrato? Se actualizarán los datos del contrato con la información actual del Lead.')) return;
                    setIsConverting(true);
                    setValidationErrors(null);
                    const res = await remakeContractAction(initialLead.id);
                    if (res.error === 'VALIDATION_FAILED' && res.validationErrors) {
                      setValidationErrors(res.validationErrors);
                      setIsConverting(false);
                    } else if (res.error) {
                      alert(res.error);
                      setIsConverting(false);
                    } else {
                      router.push(`/contratos/${res.contractId}`);
                    }
                  }}
                >
                  {isConverting ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
                  {isConverting ? 'Rehaciendo...' : 'Rehacer Contrato'}
                </button>
                <button 
                  onClick={() => router.push(`/contratos/${initialLead.contractId}`)} 
                  className="btn-primary"
                >
                  <FileText size={16} /> Ver Contrato
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* RESUMEN RÁPIDO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in-up">
          <div className="card-stat" style={{ padding: '16px 20px' }}>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">Estado</span>
            <span className={`badge ${initialLead.status === 'CONTRATADO' ? 'badge-active' : 'badge-draft'} mt-1`}>
              {initialLead.status}
            </span>
          </div>
          <div className="card-stat" style={{ padding: '16px 20px' }}>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">Consumo Anual</span>
            <span className="text-xl font-bold font-mono text-[var(--lime)]">{initialLead.estimatedMWh ? initialLead.estimatedMWh.toFixed(2) : '0'} MWh</span>
          </div>
          <div className="card-stat" style={{ padding: '16px 20px' }}>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">Comisión Estimada</span>
            <span className="text-xl font-bold font-mono text-white">€ {initialLead.estimatedMWh ? (initialLead.estimatedMWh * 15).toFixed(2) : '0'}</span>
          </div>
          <div className="card-stat" style={{ padding: '16px 20px' }}>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1">Tarifa</span>
            <span className="inline-block mt-1 px-3 py-1 bg-[var(--bg-base)] border border-[var(--border-strong)] rounded text-sm font-bold text-gray-200 font-mono">
              {initialLead.tariff || '2.0TD'}
            </span>
          </div>
        </div>

        {/* BLOQUE: DATOS DEL CLIENTE */}
        <SectionCard title="Datos del Cliente (Titular)" icon={User} delay={100}>
          <DataItem icon={Building} label="Razón Social / Nombre" value={
            initialLead.dbClient ? (
              <span 
                className="cursor-pointer text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/50"
                onClick={() => router.push(`/clientes/${initialLead.dbClient.id}`)}
              >
                {initialLead.businessName}
              </span>
            ) : (
              initialLead.businessName
            )
          } />
          <DataItem icon={CreditCard} label="CIF / NIF" value={
            initialLead.dbClient ? (
              <span 
                className="cursor-pointer text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/50"
                onClick={() => router.push(`/clientes/${initialLead.dbClient.id}`)}
              >
                {initialLead.vatNumber || cData.nif || '-'}
              </span>
            ) : (
              initialLead.vatNumber || cData.nif || '-'
            )
          } />
          <DataItem icon={Search} label="Tipo de Cliente" value={cData.tipoCliente || initialLead.clientType || '-'} />
          <DataItem label="Teléfono" value={initialLead.phone || cData.tlf || '-'} />
          <DataItem label="Email" value={initialLead.email || cData.email || '-'} />
          <DataItem label="Contacto Adicional" value={`${cData.nombreContacto || ''} ${cData.apellidosContacto || ''}`} />
        </SectionCard>

        {/* BLOQUE: DATOS DE SUMINISTRO (SIPS) */}
        <SectionCard title="Análisis de Suministro y Potencias" icon={Zap} delay={200}>
          <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <DataItem highlight icon={Zap} label="CUPS" value={
              initialLead.dbSupplyPoint ? (
                <span 
                  className="font-mono tracking-widest cursor-pointer text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/50"
                  onClick={() => setIsSupplyPointModalOpen(true)}
                >
                  {initialLead.cups || cData.cups || '-'}
                </span>
              ) : (
                <span className="font-mono tracking-widest">{initialLead.cups || cData.cups || '-'}</span>
              )
            } />
            <div className="col-span-full mt-2 border-t border-slate-800/50 pt-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><MapPin size={14}/> Ubicación del Suministro</h4>
              {(() => {
                const d = cData.direccionSuministro || cData.direccion || cData;
                const ad = (initialLead.airtableData as any) || {};
                const getScalar = (val: any) => Array.isArray(val) ? val[0] : val;

                const tipoVia = d.tipoVia || d.sTipoVia || getScalar(ad['Tipo de vía Instalación']) || '';
                const nombreVia = d.nombreVia || d.sNombreVia || getScalar(ad['Calle Instalación']) || getScalar(ad['DOMICILIO PS']) || getScalar(ad['DOMICILIO PS COMPLETO']) || '';
                const tipoNumeracion = d.tipoNumeracion || d.sTipoNumeracion || getScalar(ad['Tipo de numeración Instalación']) || '';
                const numero = d.numero || d.numKm || d.sNumero || d.sNumKm || getScalar(ad['Número Instalación']) || '';
                const adicional = d.adicional || d.sAdicional || getScalar(ad['Adicional Instalación']) || '';
                
                const cp = d.cp || d.sCp || getScalar(ad['Código Postal Instalación']) || getScalar(ad['CP PS']) || '';
                const poblacion = d.poblacion || d.sPoblacion || getScalar(ad['Población Instalación']) || getScalar(ad['POBLACION PS']) || '';
                const provincia = d.provincia || d.sProvincia || getScalar(ad['Provincia Instalación']) || getScalar(ad['PROVINCIA PS']) || '';

                const direccionCompleta = `${tipoVia} ${nombreVia} ${tipoNumeracion} ${numero} ${adicional}`.replace(/\s+/g, ' ').trim();

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="sm:col-span-2 md:col-span-4">
                      <DataItem label="Dirección Completa" value={direccionCompleta || '-'} />
                    </div>
                    <DataItem label="Código Postal" value={cp || '-'} />
                    <DataItem label="Población" value={poblacion || '-'} />
                    <DataItem label="Provincia" value={provincia || '-'} />
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="col-span-full mb-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <DataItem label="Distribuidora" value={initialLead.distributor || cData.distribuidora || '-'} />
            <DataItem label="CNAE" value={initialLead.cnae || cData.cnae || '-'} />
            <DataItem icon={Banknote} label="IBAN" value={cData.iban || initialLead.iban || '-'} />
          </div>
          <DataItem label="Potencia P1 (kW)" value={p1} />
          <DataItem label="Potencia P2 (kW)" value={p2} />
          <DataItem label="Potencia P3 (kW)" value={p3} />
          <DataItem label="Potencia P4 (kW)" value={p4} />
          <DataItem label="Potencia P5 (kW)" value={p5} />
          <DataItem label="Potencia P6 (kW)" value={p6} />
        </SectionCard>

        {/* BLOQUE: DATOS COMERCIALES */}
        <SectionCard title="Datos de Captación" icon={FileText} delay={300}>
          <DataItem icon={Calendar} label="Fecha de Registro" value={fechaRegistro} />
          <DataItem label="Comercial Asignado" value={initialLead.user?.name || initialLead.comercialName || '-'} />
          <DataItem 
            label="Producto Ofrecido" 
            value={
              initialLead.dbProduct ? (
                <span 
                  className="cursor-pointer text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/50"
                  onClick={() => setIsProductModalOpen(true)}
                >
                  {initialLead.dbProduct.name}
                </span>
              ) : (
                initialLead.productName || initialLead.product || '-'
              )
            } 
          />
          <DataItem label="Tipo de Producto" value={initialLead.productType || '-'} />
          <DataItem label="¿Tiene Autoconsumo?" value={
            <span className={`px-2 py-1 rounded text-xs font-bold ${cData.autoconsumo === true || cData.autoconsumo === 'SI' || cData.autoconsumo === 'Sí' || cData.autoconsumo === 'Si' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
              {cData.autoconsumo === true || cData.autoconsumo === 'SI' || cData.autoconsumo === 'Sí' || cData.autoconsumo === 'Si' ? 'SÍ' : 'NO'}
            </span>
          } />
          <DataItem label="Bolsillo Solar" value={
            <span className={`px-2 py-1 rounded text-xs font-bold ${cData.bolsilloSolar === true || cData.bolsilloSolar === 'SI' || cData.bolsilloSolar === 'Sí' || cData.bolsilloSolar === 'Si' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-400'}`}>
              {cData.bolsilloSolar === true || cData.bolsilloSolar === 'SI' || cData.bolsilloSolar === 'Sí' || cData.bolsilloSolar === 'Si' ? 'SÍ (ACTIVO)' : 'NO'}
            </span>
          } />
          <DataItem label="Envío de Factura" value={cData.envioFactura || 'Email (Digital)'} />
          <DataItem label="Tramitación" value={cData.tramitacion || cData.tipoTramitacion || initialLead.tramitationType || 'Cambio comercializadora sin cambios'} />
        </SectionCard>

        {/* AVISOS SIPS */}
        {(initialLead.sipsMessages) && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 animate-fade-in-up delay-400 ${initialLead.sipsOk ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            {initialLead.sipsOk ? (
              <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={20} />
            ) : (
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
            )}
            <div>
              <h3 className={`font-bold mb-1 ${initialLead.sipsOk ? 'text-green-400' : 'text-red-400'}`}>
                {initialLead.sipsOk ? 'Estado de SIPS' : 'Avisos del SIPS'}
              </h3>
              <p className={`text-sm ${initialLead.sipsOk ? 'text-green-200/80' : 'text-red-200/80'}`}>
                {initialLead.sipsMessages}
              </p>
            </div>
          </div>
        )}

        {/* DATOS EN BRUTO DE SIPS */}
        {((initialLead as any).sipsRawData || cData.sipsData) && typeof ((initialLead as any).sipsRawData || cData.sipsData) === 'object' && (
          <div className="mt-8 bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
            <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-300">Datos descargados de SIPS</h3>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="text-xs text-emerald-400/80 font-mono">
                {JSON.stringify((initialLead as any).sipsRawData || cData.sipsData, null, 2)}
              </pre>
            </div>
          </div>
        )}

      </div>

      {/* MODAL DE VALIDACIÓN */}
      {validationErrors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-2xl p-6 w-full max-w-lg shadow-2xl relative">
            <button 
              onClick={() => setValidationErrors(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <XCircle size={24} />
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">No se puede generar el contrato</h3>
                <p className="text-sm text-gray-400">Corrige los siguientes datos en la ficha del Lead antes de continuar:</p>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              {validationErrors.map((err, i) => (
                <li key={i} className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 p-3 rounded-lg text-sm text-red-200">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>{err}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3">
              <button className="btn-primary" onClick={() => setValidationErrors(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN DE PRODUCTO */}
      {isProductModalOpen && initialLead.dbProduct && (
        <ProductModal 
          product={initialLead.dbProduct}
          onClose={() => setIsProductModalOpen(false)}
          onSaved={() => {
            setIsProductModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* MODAL DE PUNTO DE SUMINISTRO */}
      {isSupplyPointModalOpen && initialLead.dbSupplyPoint && (
        <SupplyPointModal
          supplyPoint={initialLead.dbSupplyPoint}
          onClose={() => setIsSupplyPointModalOpen(false)}
        />
      )}
    </div>
  );
}
