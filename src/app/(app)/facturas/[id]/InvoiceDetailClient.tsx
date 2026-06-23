'use client';

import { useRouter } from 'next/navigation';
import { formatDateUTC } from '@/lib/utils/date';
import Topbar from '@/components/Topbar';
import { ChevronLeft, FileText, Zap, Building, Calendar, Euro, FileDown, Download, Activity, BarChart3, Calculator, BatteryCharging } from 'lucide-react';

export default function InvoiceDetailClient({ initialInvoice, userRole }: { initialInvoice: any, userRole: string }) {
  const router = useRouter();
  const isAdmin = userRole === 'SUPERADMIN' || userRole === 'COMPANYADMIN' || userRole === 'BACKOFFICE';

  // Helpers for extracting missing values from raw JSON
  const rawData = (initialInvoice.invoiceData as any) || {};
  const getRawNum = (...keys: string[]): number | null => {
    for (const k of keys) {
      if (rawData[k] !== undefined && rawData[k] !== null && rawData[k] !== '') {
        let s = rawData[k].toString().trim();
        if (s.includes(',') && s.includes('.')) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else if (s.includes(',')) {
          s = s.replace(',', '.');
        }
        const val = parseFloat(s);
        if (!isNaN(val)) return val;
      }
    }
    return null;
  };

  const formatString = (v: any) => v || '-';

  const formatDate = (iso: Date | string | null) => {
    return formatDateUTC(iso);
  };

  const formatCurrency = (val: number | null | undefined, decimals = 2) => {
    if (val === null || val === undefined) return '-';
    return `${val.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} €`;
  };

  const formatNumber = (val: number | null | undefined, decimals = 2, suffix = '') => {
    if (val === null || val === undefined) return '-';
    return `${val.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix ? ' ' + suffix : ''}`;
  };

  const DataItem = ({ label, value, icon: Icon, highlight, colSpan = 1 }: { label: string, value: React.ReactNode, icon?: any, highlight?: boolean, colSpan?: number }) => (
    <div className={`p-4 rounded-xl border transition-all ${highlight ? 'bg-[rgba(222,255,154,0.03)] border-[var(--lime)] border-opacity-30' : 'bg-[var(--bg-elevated)] border-[var(--border)]'} col-span-${colSpan}`}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={14} className={highlight ? 'text-[var(--lime)]' : 'text-gray-400'} />}
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-[0.95rem] font-medium ${highlight ? 'text-[var(--lime)]' : 'text-gray-200'} break-words`}>
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

  // Helper to render period values dynamically, hiding empty periods
  const PeriodRow = ({ label, p1, p2, p3, p4, p5, p6, formatter }: any) => {
    if ([p1, p2, p3, p4, p5, p6].every(p => p === null || p === undefined)) return null;
    return (
      <div className="grid grid-cols-7 gap-2 items-center py-2 border-b border-[var(--border-strong)] text-sm">
        <div className="font-semibold text-gray-400">{label}</div>
        <div className="text-right">{formatter(p1)}</div>
        <div className="text-right">{formatter(p2)}</div>
        <div className="text-right">{formatter(p3)}</div>
        <div className="text-right">{p4 !== null && p4 !== undefined ? formatter(p4) : '-'}</div>
        <div className="text-right">{p5 !== null && p5 !== undefined ? formatter(p5) : '-'}</div>
        <div className="text-right">{p6 !== null && p6 !== undefined ? formatter(p6) : '-'}</div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '100px' }}>
      <Topbar
        title={`Factura: ${initialInvoice.invoiceNumber}`}
        subtitle={`Cliente: ${initialInvoice.client?.businessName || initialInvoice.client?.firstName || 'Desconocido'}`}
        showSearch={false}
        customActions={
          <div className="flex gap-3 items-center">
            <button onClick={() => router.push('/facturas')} className="btn-ghost">
              <ChevronLeft size={16} /> Volver a Facturas
            </button>
            {initialInvoice.pdfUrl || (initialInvoice.invoiceData && initialInvoice.invoiceData.output_pdf) ? (
              <a href={initialInvoice.pdfUrl || initialInvoice.invoiceData?.output_pdf} target="_blank" rel="noreferrer" className="btn-primary flex items-center gap-2">
                <FileDown size={16} /> Ver PDF
              </a>
            ) : (
              <button disabled className="btn-primary opacity-50 cursor-not-allowed flex items-center gap-2">
                <FileDown size={16} /> PDF no disponible
              </button>
            )}
            {initialInvoice.xML || (initialInvoice.invoiceData && (initialInvoice.invoiceData.XML || initialInvoice.invoiceData.xmlUrl)) ? (
              <a href={initialInvoice.xML || initialInvoice.invoiceData?.XML || initialInvoice.invoiceData?.xmlUrl} target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2">
                <Download size={16} /> Ver XML
              </a>
            ) : (
              <button disabled className="btn-secondary opacity-50 cursor-not-allowed flex items-center gap-2">
                <Download size={16} /> XML no disponible
              </button>
            )}
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* 1. DATOS PRINCIPALES */}
        <SectionCard title="1. Resumen Principal y Estado" icon={FileText} delay={100}>
          <DataItem highlight label="Número de Factura" value={<span className="font-mono text-lg tracking-wider">{initialInvoice.invoiceNumber}</span>} />
          <DataItem label="Tipo de Factura" value={initialInvoice.invoiceType || initialInvoice.claseFactura || 'Normal'} />
          <DataItem icon={Calendar} label="Fecha de Emisión" value={formatDate(initialInvoice.issueDate)} />
          <DataItem icon={Calendar} label="Fecha de Pago/Vto" value={formatDate(initialInvoice.paymentDate)} />
          <DataItem label="Estado" value={initialInvoice.paymentDate || initialInvoice.facturado ? 'Facturada / Pagada' : 'Pendiente'} />
          <DataItem label="Comunicación" value={initialInvoice.communicatedAt ? `Enviada el ${formatDate(initialInvoice.communicatedAt)}` : 'No notificada'} />
          {initialInvoice.rectifiedInvoiceId && <DataItem label="Factura Rectificada" value={initialInvoice.numeroFacturaRectificadaRef || initialInvoice.rectifiedInvoiceId} />}
          <DataItem highlight icon={Euro} label="Total Factura" value={<span className="text-xl font-bold font-mono">{formatCurrency(initialInvoice.totalAmount || initialInvoice.total)}</span>} />
        </SectionCard>

        {/* 2. DATOS DEL SUMINISTRO */}
        <SectionCard title="2. Datos del Suministro y Periodo" icon={Building} delay={200}>
          <DataItem label="Cliente" value={initialInvoice.client?.businessName || initialInvoice.client?.firstName || '-'} />
          <DataItem label="NIF Cliente" value={initialInvoice.client?.vatNumber || initialInvoice.codigoFiscal || '-'} />
          <DataItem label="Código Fiscal F1" value={rawData['Codigo Fiscal'] || initialInvoice.codigoFiscal || '-'} />
          <DataItem highlight label="CUPS" value={<span className="font-mono tracking-widest">{initialInvoice.supplyPoint?.cups || initialInvoice.cupsCode || '-'}</span>} />
          <DataItem label="Tarifa ATR" value={<span className="font-mono">{initialInvoice.supplyPoint?.tariff || initialInvoice.tarifaATR || '-'}</span>} />
          
          <DataItem label="Contrato ATR / Cód. Contrato" value={<span className="font-mono">{initialInvoice.contract?.contractCode || rawData['Codigo Contrato'] || initialInvoice.codigoContrato || initialInvoice.contractId || '-'}</span>} />
          <DataItem label="Distribuidora" value={initialInvoice.supplyPoint?.dISTRIBUIDORA || initialInvoice.invoiceData?.DISTRIBUIDORA || '-'} />
          <DataItem label="Tipo Autoconsumo" value={initialInvoice.tipoAutoconsumoDistribuidora || initialInvoice.tipoAutoconsumo || 'Sin Autoconsumo'} />
          <DataItem label="Sistema Eléctrico" value={initialInvoice.sistemaElectrico || 'Península'} />

          <DataItem label="Fecha Inicio (Ciclo)" value={formatDate(initialInvoice.billingStart || initialInvoice.desde)} />
          <DataItem label="Fecha Fin (Ciclo)" value={formatDate(initialInvoice.billingEnd || initialInvoice.hasta)} />
          <DataItem 
            label="Días Facturados" 
            value={(() => {
              if (initialInvoice.duracion) return `${initialInvoice.duracion} días`;
              if (initialInvoice.desde && initialInvoice.hasta) {
                const d1 = new Date(initialInvoice.desde);
                const d2 = new Date(initialInvoice.hasta);
                if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                  const diffTime = Math.abs(d2.getTime() - d1.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                  return `${diffDays} días`;
                }
              }
              return '-';
            })()} 
          />
          <DataItem label="Procedencia (Desde - Hasta)" value={`${initialInvoice.procedenciaDesde || 'N/A'} - ${initialInvoice.procedenciaHasta || initialInvoice.origin || 'N/A'}`} />
        </SectionCard>

        {/* 3. CONSUMOS Y POTENCIAS (FÍSICO) */}
        <SectionCard title="3. Consumos Registrados (Físico)" icon={Activity} delay={300}>
          <div className="col-span-full overflow-x-auto">
            <div className="min-w-[600px] bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
              <div className="grid grid-cols-7 gap-2 pb-2 mb-2 border-b-2 border-[var(--border-strong)] text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div>Concepto Físico</div>
                <div className="text-right">P1</div>
                <div className="text-right">P2</div>
                <div className="text-right">P3</div>
                <div className="text-right">P4</div>
                <div className="text-right">P5</div>
                <div className="text-right">P6</div>
              </div>
              <PeriodRow label="Energía Activa (kWh)" 
                p1={initialInvoice.p1EnergiaActivaConsumida ?? getRawNum('P1 Energia Activa Consumida')} p2={initialInvoice.p2EnergiaActivaConsumida ?? getRawNum('P2 Energia Activa Consumida')} p3={initialInvoice.p3EnergiaActivaConsumida ?? getRawNum('P3 Energia Activa Consumida')}
                p4={initialInvoice.p4EnergiaActivaConsumida ?? getRawNum('P4 Energia Activa Consumida')} p5={initialInvoice.p5EnergiaActivaConsumida ?? getRawNum('P5 Energia Activa Consumida')} p6={initialInvoice.p6EnergiaActivaConsumida ?? getRawNum('P6 Energia Activa Consumida')}
                formatter={(v: number) => formatNumber(v, 2)} />
              
              <PeriodRow label="Pot. Contratada (kW)" 
                p1={initialInvoice.p1PotenciaContratada ?? getRawNum('P1 Potencia Contratada')} p2={initialInvoice.p2PotenciaContratada ?? getRawNum('P2 Potencia Contratada')} p3={initialInvoice.p3PotenciaContratada ?? getRawNum('P3 Potencia Contratada')}
                p4={initialInvoice.p4PotenciaContratada ?? getRawNum('P4 Potencia Contratada')} p5={initialInvoice.p5PotenciaContratada ?? getRawNum('P5 Potencia Contratada')} p6={initialInvoice.p6PotenciaContratada ?? getRawNum('P6 Potencia Contratada')}
                formatter={(v: number) => formatNumber(v, 3)} />

              <PeriodRow label="Maxímetro (kW)" 
                p1={initialInvoice.p1PotenciaMaxDemanda ?? getRawNum('P1 Potencia Max Demanda')} p2={initialInvoice.p2PotenciaMaxDemanda ?? getRawNum('P2 Potencia Max Demanda')} p3={initialInvoice.p3PotenciaMaxDemanda ?? getRawNum('P3 Potencia Max Demanda')}
                p4={initialInvoice.p4PotenciaMaxDemanda ?? getRawNum('P4 Potencia Max Demanda')} p5={initialInvoice.p5PotenciaMaxDemanda ?? getRawNum('P5 Potencia Max Demanda')} p6={initialInvoice.p6PotenciaMaxDemanda ?? getRawNum('P6 Potencia Max Demanda')}
                formatter={(v: number) => formatNumber(v, 2)} />

              <PeriodRow label="Energía Reactiva (kVArh)" 
                p1={initialInvoice.p1EnergiaReactivaConsumida ?? getRawNum('P1 Energia Reactiva Consumida')} p2={initialInvoice.p2EnergiaReactivaConsumida ?? getRawNum('P2 Energia Reactiva Consumida')} p3={initialInvoice.p3EnergiaReactivaConsumida ?? getRawNum('P3 Energia Reactiva Consumida')}
                p4={initialInvoice.p4EnergiaReactivaConsumida ?? getRawNum('P4 Energia Reactiva Consumida')} p5={initialInvoice.p5EnergiaReactivaConsumida ?? getRawNum('P5 Energia Reactiva Consumida')} p6={initialInvoice.p6EnergiaReactivaConsumida ?? getRawNum('P6 Energia Reactiva Consumida')}
                formatter={(v: number) => formatNumber(v, 2)} />

              <PeriodRow label="Excedentes Auto (kWh)" 
                p1={initialInvoice.excedentesP1Autoconsumo ?? getRawNum('Excedentes P1 Autoconsumo')} p2={initialInvoice.excedentesP2Autoconsumo ?? getRawNum('Excedentes P2 Autoconsumo')} p3={initialInvoice.excedentesP3Autoconsumo ?? getRawNum('Excedentes P3 Autoconsumo')}
                p4={initialInvoice.excedentesP4Autoconsumo ?? getRawNum('Excedentes P4 Autoconsumo')} p5={initialInvoice.excedentesP5Autoconsumo ?? getRawNum('Excedentes P5 Autoconsumo')} p6={initialInvoice.excedentesP6Autoconsumo ?? getRawNum('Excedentes P6 Autoconsumo')}
                formatter={(v: number) => formatNumber(v, 2)} />

              <PeriodRow label="Lecturas AE" 
                p1={rawData['Lectura Desde AE P1'] ? `${rawData['Lectura Desde AE P1']} - ${rawData['Lectura Hasta AE P1']}` : null}
                p2={rawData['Lectura Desde AE P2'] ? `${rawData['Lectura Desde AE P2']} - ${rawData['Lectura Hasta AE P2']}` : null}
                p3={rawData['Lectura Desde AE P3'] ? `${rawData['Lectura Desde AE P3']} - ${rawData['Lectura Hasta AE P3']}` : null}
                p4={rawData['Lectura Desde AE P4'] ? `${rawData['Lectura Desde AE P4']} - ${rawData['Lectura Hasta AE P4']}` : null}
                p5={rawData['Lectura Desde AE P5'] ? `${rawData['Lectura Desde AE P5']} - ${rawData['Lectura Hasta AE P5']}` : null}
                p6={rawData['Lectura Desde AE P6'] ? `${rawData['Lectura Desde AE P6']} - ${rawData['Lectura Hasta AE P6']}` : null}
                formatter={formatString} />
            </div>
          </div>
          
          <DataItem label="Energía Total Consumida" value={formatNumber(initialInvoice.totalMWh ?? getRawNum('Energía Total Consumida', 'Consumo'), 2, 'kWh')} />
          <DataItem label="Energía Reactiva Total" value={formatNumber(initialInvoice.energiaReactivaTotalConsumida ?? ((getRawNum('P1 Energia Reactiva Consumida') || 0) + (getRawNum('P2 Energia Reactiva Consumida') || 0) + (getRawNum('P3 Energia Reactiva Consumida') || 0) + (getRawNum('P4 Energia Reactiva Consumida') || 0) + (getRawNum('P5 Energia Reactiva Consumida') || 0) + (getRawNum('P6 Energia Reactiva Consumida') || 0) || null), 2, 'kVArh')} />
          <DataItem label="Excedentes Totales (Físicos)" value={formatNumber(initialInvoice.excedentesAutoconsumoAFacturar ?? getRawNum('Excedentes Autoconsumo a facturar', 'Energia Neta Total Generada'), 2, 'kWh')} />
          <DataItem label="Pérdidas (%)" value={formatNumber(initialInvoice.porcentajePerdidas ?? getRawNum('Porcentaje Perdidas'), 4, '%')} />
        </SectionCard>

        {/* 4. TÉRMINO DE POTENCIA (ECONÓMICO) */}
        <SectionCard title="4. Término de Potencia (Económico)" icon={Zap} delay={400}>
          <div className="col-span-full overflow-x-auto">
            <div className="min-w-[600px] bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
              <div className="grid grid-cols-7 gap-2 pb-2 mb-2 border-b-2 border-[var(--border-strong)] text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div>Concepto Económico</div>
                <div className="text-right">P1</div>
                <div className="text-right">P2</div>
                <div className="text-right">P3</div>
                <div className="text-right">P4</div>
                <div className="text-right">P5</div>
                <div className="text-right">P6</div>
              </div>
              <PeriodRow label="Pot. a Facturar (kW)" 
                p1={initialInvoice.potenciaAFacturarP1 ?? getRawNum('Potencia a Facturar P1')} p2={initialInvoice.potenciaAFacturarP2 ?? getRawNum('Potencia a Facturar P2')} p3={initialInvoice.potenciaAFacturarP3 ?? getRawNum('Potencia a Facturar P3')}
                p4={initialInvoice.potenciaAFacturarP4 ?? getRawNum('Potencia a Facturar P4')} p5={initialInvoice.potenciaAFacturarP5 ?? getRawNum('Potencia a Facturar P5')} p6={initialInvoice.potenciaAFacturarP6 ?? getRawNum('Potencia a Facturar P6')}
                formatter={(v: number) => formatNumber(v, 2)} />

              <PeriodRow label="Precio Pot. (€/kW)" 
                p1={getRawNum('P1P')} p2={getRawNum('P2P')} p3={getRawNum('P3P')}
                p4={getRawNum('P4P')} p5={getRawNum('P5P')} p6={getRawNum('P6P')}
                formatter={(v: number) => formatNumber(v, 6)} />
              
              <PeriodRow label="Importe Peajes ATR (€)" 
                p1={initialInvoice.importePmP1 ?? getRawNum('Importe PM P1', 'Importe Ponderado Peajes Potencia P1')} p2={initialInvoice.importePmP2 ?? getRawNum('Importe PM P2', 'Importe Ponderado Peajes Potencia P2')} p3={initialInvoice.importePmP3 ?? getRawNum('Importe PM P3', 'Importe Ponderado Peajes Potencia P3')}
                p4={initialInvoice.importePmP4 ?? getRawNum('Importe PM P4', 'Importe Ponderado Peajes Potencia P4')} p5={initialInvoice.importePmP5 ?? getRawNum('Importe PM P5', 'Importe Ponderado Peajes Potencia P5')} p6={initialInvoice.importePmP6 ?? getRawNum('Importe PM P6', 'Importe Ponderado Peajes Potencia P6')}
                formatter={(v: number) => formatCurrency(v, 2)} />

              <PeriodRow label="Importe Excesos ATR (€)" 
                p1={initialInvoice.importeExcesoPmP1 ?? getRawNum('Importe Exceso PM P1')} p2={initialInvoice.importeExcesoPmP2 ?? getRawNum('Importe Exceso PM P2')} p3={initialInvoice.importeExcesoPmP3 ?? getRawNum('Importe Exceso PM P3')}
                p4={initialInvoice.importeExcesoPmP4 ?? getRawNum('Importe Exceso PM P4')} p5={initialInvoice.importeExcesoPmP5 ?? getRawNum('Importe Exceso PM P5')} p6={initialInvoice.importeExcesoPmP6 ?? getRawNum('Importe Exceso PM P6')}
                formatter={(v: number) => formatCurrency(v, 2)} />
            </div>
          </div>

          <DataItem label="Importe Total Peajes Potencia" value={formatCurrency(initialInvoice.importeTotalPmAtr ?? getRawNum('Importe Ponderado Peajes Potencia', 'Importe Peajes PM'))} />
          <DataItem label="Importe Total Excesos Potencia" value={formatCurrency(initialInvoice.importeTotalExcesosAtr ?? getRawNum('Importe Total Excesos ATR F1', 'Importe Total Excesos ATR'))} />
          <DataItem label="Importe Cargos Potencia" value={formatCurrency(initialInvoice.importeCargoPotenciaTotal ?? getRawNum('Importe Ponderado Cargos Potencia', 'Importe Cargo Potencia Total'))} />
          <DataItem highlight label="Total Término Potencia" value={<span className="font-bold text-[var(--lime)]">{formatCurrency(initialInvoice.importePotenciaFactura ?? getRawNum('Importe Potencia Factura', 'Importe Potencia ATR'))}</span>} />
        </SectionCard>

        {/* 5. TÉRMINO DE ENERGÍA (ECONÓMICO) */}
        <SectionCard title="5. Término de Energía (Económico)" icon={BatteryCharging} delay={500}>
          <div className="col-span-full overflow-x-auto">
            <div className="min-w-[600px] bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
              <div className="grid grid-cols-7 gap-2 pb-2 mb-2 border-b-2 border-[var(--border-strong)] text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div>Concepto Económico</div>
                <div className="text-right">P1</div>
                <div className="text-right">P2</div>
                <div className="text-right">P3</div>
                <div className="text-right">P4</div>
                <div className="text-right">P5</div>
                <div className="text-right">P6</div>
              </div>
              <PeriodRow label="Precio Ene. (€/kWh)" 
                p1={(initialInvoice.p1E || initialInvoice.p1c) ?? getRawNum('P1E')} p2={(initialInvoice.p2E || initialInvoice.p2c) ?? getRawNum('P2E')} p3={(initialInvoice.p3E || initialInvoice.p3c) ?? getRawNum('P3E')}
                p4={(initialInvoice.p4E || initialInvoice.p4c) ?? getRawNum('P4E')} p5={(initialInvoice.p5E || initialInvoice.p5c) ?? getRawNum('P5E')} p6={(initialInvoice.p6E || initialInvoice.p6c) ?? getRawNum('P6E')}
                formatter={(v: number) => formatNumber(v, 6)} />
              
              <PeriodRow label="Importe Ene. Activa (€)" 
                p1={initialInvoice.importeAeP1 ?? getRawNum('Importe AE P1')} p2={initialInvoice.importeAeP2 ?? getRawNum('Importe AE P2')} p3={initialInvoice.importeAeP3 ?? getRawNum('Importe AE P3')}
                p4={initialInvoice.importeAeP4 ?? getRawNum('Importe AE P4')} p5={initialInvoice.importeAeP5 ?? getRawNum('Importe AE P5')} p6={initialInvoice.importeAeP6 ?? getRawNum('Importe AE P6')}
                formatter={(v: number) => formatCurrency(v, 2)} />

              <PeriodRow label="Precio Reactiva (€/kVArh)" 
                p1={initialInvoice.p1PrecioEnergiaReactiva ?? getRawNum('P1 Precio Energia Reactiva')} p2={initialInvoice.p2PrecioEnergiaReactiva ?? getRawNum('P2 Precio Energia Reactiva')} p3={initialInvoice.p3PrecioEnergiaReactiva ?? getRawNum('P3 Precio Energia Reactiva')}
                p4={initialInvoice.p4PrecioEnergiaReactiva ?? getRawNum('P4 Precio Energia Reactiva')} p5={initialInvoice.p5PrecioEnergiaReactiva ?? getRawNum('P5 Precio Energia Reactiva')} p6={initialInvoice.p6PrecioEnergiaReactiva ?? getRawNum('P6 Precio Energia Reactiva')}
                formatter={(v: number) => formatNumber(v, 6)} />

              <PeriodRow label="Importe Reactiva (€)" 
                p1={initialInvoice.importeR1P1 ?? getRawNum('Importe R1 P1')} p2={initialInvoice.importeR1P2 ?? getRawNum('Importe R1 P2')} p3={initialInvoice.importeR1P3 ?? getRawNum('Importe R1 P3')}
                p4={initialInvoice.importeR1P4 ?? getRawNum('Importe R1 P4')} p5={initialInvoice.importeR1P5 ?? getRawNum('Importe R1 P5')} p6={initialInvoice.importeR1P6 ?? getRawNum('Importe R1 P6')}
                formatter={(v: number) => formatCurrency(v, 2)} />
            </div>
          </div>

          <DataItem label="Importe Total Energía Activa" value={formatCurrency(initialInvoice.importeTotalAeAtr ?? getRawNum('Importe Cargo Energia Total', 'Importe Energia Factura'))} />
          <DataItem label="Importe Cargos Energía" value={formatCurrency(initialInvoice.importeCargoEnergiaTotal ?? getRawNum('Importe Ponderado Cargos Energia'))} />
          <DataItem label="Importe Total Reactiva" value={formatCurrency(initialInvoice.importeTotalRAtr ?? getRawNum('Importe Total R ATR'))} />
          <DataItem label="Ajuste / Tope del Gas" value={formatCurrency(initialInvoice.importeAjusteGas ?? getRawNum('Importe Ajuste Gas'))} />
          
          <DataItem label="Coste Desvíos (DSV)" value={formatCurrency(initialInvoice.dsv ?? getRawNum('DSVM', 'DSV'))} />
          <DataItem label="FEE Operativo" value={formatCurrency(initialInvoice.fee ?? getRawNum('FEEM', 'FEE'))} />
          
          <DataItem highlight label="Compensación Excedentes" value={<span className="font-bold text-red-400">{formatCurrency((initialInvoice.importeAplicableCompensacionExcedentes ?? getRawNum('Importe Excedentes Autoconsumo Aplicado', 'Importe Aplicable Compensacion Excedentes')) ? -Math.abs((initialInvoice.importeAplicableCompensacionExcedentes ?? getRawNum('Importe Excedentes Autoconsumo Aplicado', 'Importe Aplicable Compensacion Excedentes'))!) : null)}</span>} />
          <DataItem highlight label="Total Término Energía" value={<span className="font-bold text-[var(--lime)]">{formatCurrency(initialInvoice.importeEnergiaFactura ?? getRawNum('Importe Energia Factura'))}</span>} />
        </SectionCard>

        {/* 6. CONCEPTOS ADICIONALES Y SVA */}
        <SectionCard title="6. Conceptos Adicionales y SVA" icon={BarChart3} delay={600}>
          <DataItem label="Costes de Gestión" value={formatCurrency(initialInvoice.costesDeGestion ?? getRawNum('Costes de Gestión'))} />
          <DataItem label="Suplemento Territorial" value={formatCurrency(initialInvoice.suplementoTerritorial ?? getRawNum('Suplemento Territorial'))} />
          <DataItem label="Tasa Municipal / Base" value={`${formatCurrency(initialInvoice.tasaMunicipal ?? getRawNum('Tasa Municipal'))} / ${formatCurrency(initialInvoice.baseImponibleTasaMunicipal ?? getRawNum('Base Imponible Tasa Municipal'))}`} />
          <DataItem label="Penalización No ICP" value={formatCurrency(initialInvoice.penalizacionNoIcp ?? getRawNum('Penalizacion No ICP'))} />
          <DataItem label="Alquiler Equipo Medida" value={`${formatCurrency(initialInvoice.alquilerEquipoDeMedida ?? getRawNum('Alquiler Equipo de Medida'))} (${initialInvoice.numeroDiasAlquiler1 ?? getRawNum('Numero Dias Alquiler 1') ?? 0} días)`} />
          
          {initialInvoice.importeBonoSocial && <DataItem label="Bono Social Eléctrico" value={formatCurrency(initialInvoice.importeBonoSocial)} />}
          {initialInvoice.conceptoSva && <DataItem label="Servicio Valor Añadido (SVA)" value={`${initialInvoice.conceptoSva} : ${formatCurrency(initialInvoice.totalSVA)}`} />}
          
          {initialInvoice.conceptoRepercutible1 && <DataItem label={initialInvoice.conceptoRepercutible1} value={formatCurrency(initialInvoice.importeConceptoRepercutible1)} />}
          {initialInvoice.conceptoRepercutible2 && <DataItem label={initialInvoice.conceptoRepercutible2} value={formatCurrency(initialInvoice.importeConceptoRepercutible2)} />}
          {initialInvoice.conceptoRepercutible3 && <DataItem label={initialInvoice.conceptoRepercutible3} value={formatCurrency(initialInvoice.importeConceptoRepercutible3)} />}
          
          {initialInvoice.bolsilloSolar && (
            <div className="col-span-full mt-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
              <h4 className="text-yellow-400 font-bold mb-3 flex items-center gap-2"><Zap size={16}/> Batería Virtual (Bolsillo Solar)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DataItem label="Descuento Aplicado" value={formatCurrency(initialInvoice.descuentoBolsilloSolar)} />
                <DataItem label="Importe Almacenado Extra" value={formatCurrency(initialInvoice.importeAlmacenadoBolsilloSolar)} />
                <DataItem label="Carga en este mes" value={formatCurrency(initialInvoice.cargaBolsilloSolar)} />
                <DataItem label="Costes Gestión Batería" value={formatCurrency(initialInvoice.costesDeGestionBolsilloSolar)} />
              </div>
            </div>
          )}
        </SectionCard>

        {/* 7. DESGLOSE DE BASE IMPONIBLE E IMPUESTOS */}
        <SectionCard title="7. Desglose Impuestos y Totales" icon={Calculator} delay={700}>
          <DataItem label="Subtotal 1 (Sin Descuentos/SVA)" value={formatCurrency(initialInvoice.subtotal1 ?? getRawNum('Subtotal 1', 'Total sin Descuento'))} />
          <DataItem label="Subtotal 2 (Base Imponible Previa)" value={formatCurrency(initialInvoice.subtotal2 ?? getRawNum('Subtotal 2'))} />
          <DataItem label="Subtotal Otros Conceptos" value={formatCurrency(initialInvoice.subtotalOtrosConcepto ?? getRawNum('Subtotal Otros Concepto'))} />
          
          <DataItem label="Impuesto Eléctrico (Cuota)" value={formatCurrency(initialInvoice.ieOdoo ?? getRawNum('Importe Impuesto'))} />
          
          <div className="col-span-full border-t border-[var(--border-strong)] my-2"></div>
          
          <DataItem label="Base Imponible IVA General" value={formatCurrency(initialInvoice.baseImponibleIva ?? getRawNum('Base Imponible IVA'))} />
          
          {initialInvoice.baseImponible5 && <DataItem label="Base Imponible IVA 5%" value={formatCurrency(initialInvoice.baseImponible5)} />}
          {initialInvoice.importeIva5 && <DataItem label="Cuota IVA 5%" value={formatCurrency(initialInvoice.importeIva5)} />}
          
          {initialInvoice.baseImponible10 && <DataItem label="Base Imponible IVA 10%" value={formatCurrency(initialInvoice.baseImponible10)} />}
          {initialInvoice.importeIva10 && <DataItem label="Cuota IVA 10%" value={formatCurrency(initialInvoice.importeIva10)} />}
          
          {initialInvoice.baseImponible21 && <DataItem label="Base Imponible IVA 21%" value={formatCurrency(initialInvoice.baseImponible21)} />}
          {initialInvoice.importeIva21 && <DataItem label="Cuota IVA 21%" value={formatCurrency(initialInvoice.importeIva21)} />}
          
          <DataItem label="Total IVA" value={formatCurrency((initialInvoice.taxAmount || initialInvoice.importeIva) ?? getRawNum('Importe IVA'))} />
          
          <div className="col-span-full mt-2">
            <DataItem highlight label="Total Importe Factura" value={<span className="text-2xl font-bold font-mono text-[var(--lime)]">{formatCurrency((initialInvoice.totalAmount || initialInvoice.total) ?? getRawNum('Total'))}</span>} />
          </div>
        </SectionCard>

        {/* 8. ANÁLISIS DE RENTABILIDAD (ADMIN ONLY) */}
        {isAdmin && (
          <SectionCard title="8. Rentabilidad Comercial interna" icon={BarChart3} delay={800}>
            <DataItem label="Importe Energía Sin Margen" value={formatCurrency(initialInvoice.importeEnergiaSinMargen ?? getRawNum('Importe Energia sin Margen'))} />
            <DataItem label="Margen Potencia" value={formatCurrency(initialInvoice.margenPotencia ?? getRawNum('Margen Potencia'))} />
            <DataItem label="Margen Energía" value={formatCurrency(initialInvoice.margenEnergia ?? getRawNum('Margen Energia'))} />
            <DataItem label="Margen Excesos" value={formatCurrency(initialInvoice.margenExcesos ?? getRawNum('Margen Excesos'))} />
            
            <div className="col-span-full border-t border-[var(--border-strong)] my-2"></div>
            
            <DataItem highlight label="Margen Factura Total" value={<span className="font-bold font-mono text-[var(--lime)] text-xl">{formatCurrency((initialInvoice.margenFactura || initialInvoice.margin) ?? getRawNum('Margen Factura Total', 'Margen Factura'))}</span>} />
            <DataItem highlight label="Comisión Generada Total" value={<span className="font-bold font-mono text-[var(--text-primary)] text-xl">{formatCurrency(initialInvoice.comisionTotal ?? getRawNum('Comision Total', 'Comision Generada Total'))}</span>} />
          </SectionCard>
        )}

      </div>
    </div>
  );
}
