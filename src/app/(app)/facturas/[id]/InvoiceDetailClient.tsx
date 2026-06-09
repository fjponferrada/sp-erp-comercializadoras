'use client';

import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ChevronLeft, FileText, Zap, Building, Calendar, Euro, FileDown, Download, Activity, BarChart3, Calculator, BatteryCharging } from 'lucide-react';

export default function InvoiceDetailClient({ initialInvoice, userRole }: { initialInvoice: any, userRole: string }) {
  const router = useRouter();
  const isAdmin = userRole === 'SUPERADMIN' || userRole === 'COMPANYADMIN' || userRole === 'BACKOFFICE';

  const formatDate = (iso: Date | string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
            {initialInvoice.xML || (initialInvoice.invoiceData && initialInvoice.invoiceData.XML) ? (
              <a href={initialInvoice.xML || initialInvoice.invoiceData?.XML} target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2">
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
          <DataItem highlight label="CUPS" value={<span className="font-mono tracking-widest">{initialInvoice.supplyPoint?.cups || initialInvoice.cupsCode || '-'}</span>} />
          <DataItem label="Tarifa ATR" value={<span className="font-mono">{initialInvoice.supplyPoint?.tariff || initialInvoice.tarifaATR || '-'}</span>} />
          
          <DataItem label="Contrato ATR / Cód. Contrato" value={<span className="font-mono">{initialInvoice.contract?.contractCode || initialInvoice.contractId || '-'}</span>} />
          <DataItem label="Distribuidora" value={initialInvoice.supplyPoint?.dISTRIBUIDORA || initialInvoice.invoiceData?.DISTRIBUIDORA || '-'} />
          <DataItem label="Tipo Autoconsumo" value={initialInvoice.tipoAutoconsumoDistribuidora || initialInvoice.tipoAutoconsumo || 'Sin Autoconsumo'} />
          <DataItem label="Sistema Eléctrico" value={initialInvoice.sistemaElectrico || 'Península'} />

          <DataItem label="Fecha Inicio (Ciclo)" value={formatDate(initialInvoice.billingStart || initialInvoice.desde)} />
          <DataItem label="Fecha Fin (Ciclo)" value={formatDate(initialInvoice.billingEnd || initialInvoice.hasta)} />
          <DataItem label="Días Facturados" value={initialInvoice.duracion ? `${initialInvoice.duracion} días` : '-'} />
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
                p1={initialInvoice.p1EnergiaActivaConsumida} p2={initialInvoice.p2EnergiaActivaConsumida} p3={initialInvoice.p3EnergiaActivaConsumida}
                p4={initialInvoice.p4EnergiaActivaConsumida} p5={initialInvoice.p5EnergiaActivaConsumida} p6={initialInvoice.p6EnergiaActivaConsumida}
                formatter={(v: number) => formatNumber(v, 2)} />
              
              <PeriodRow label="Pot. Contratada (kW)" 
                p1={initialInvoice.p1PotenciaContratada} p2={initialInvoice.p2PotenciaContratada} p3={initialInvoice.p3PotenciaContratada}
                p4={initialInvoice.p4PotenciaContratada} p5={initialInvoice.p5PotenciaContratada} p6={initialInvoice.p6PotenciaContratada}
                formatter={(v: number) => formatNumber(v, 3)} />

              <PeriodRow label="Maxímetro (kW)" 
                p1={initialInvoice.p1PotenciaMaxDemanda} p2={initialInvoice.p2PotenciaMaxDemanda} p3={initialInvoice.p3PotenciaMaxDemanda}
                p4={initialInvoice.p4PotenciaMaxDemanda} p5={initialInvoice.p5PotenciaMaxDemanda} p6={initialInvoice.p6PotenciaMaxDemanda}
                formatter={(v: number) => formatNumber(v, 2)} />

              <PeriodRow label="Energía Reactiva (kVArh)" 
                p1={initialInvoice.p1EnergiaReactivaConsumida} p2={initialInvoice.p2EnergiaReactivaConsumida} p3={initialInvoice.p3EnergiaReactivaConsumida}
                p4={initialInvoice.p4EnergiaReactivaConsumida} p5={initialInvoice.p5EnergiaReactivaConsumida} p6={initialInvoice.p6EnergiaReactivaConsumida}
                formatter={(v: number) => formatNumber(v, 2)} />

              <PeriodRow label="Excedentes Auto (kWh)" 
                p1={initialInvoice.excedentesP1Autoconsumo} p2={initialInvoice.excedentesP2Autoconsumo} p3={initialInvoice.excedentesP3Autoconsumo}
                p4={initialInvoice.excedentesP4Autoconsumo} p5={initialInvoice.excedentesP5Autoconsumo} p6={initialInvoice.excedentesP6Autoconsumo}
                formatter={(v: number) => formatNumber(v, 2)} />
            </div>
          </div>
          
          <DataItem label="Energía Total Consumida" value={formatNumber(initialInvoice.totalMWh ? initialInvoice.totalMWh * 1000 : null, 2, 'kWh')} />
          <DataItem label="Energía Reactiva Total" value={formatNumber(initialInvoice.energiaReactivaTotalConsumida, 2, 'kVArh')} />
          <DataItem label="Excedentes Totales (Físicos)" value={formatNumber(initialInvoice.excedentesAutoconsumoAFacturar, 2, 'kWh')} />
          <DataItem label="Pérdidas (%)" value={formatNumber(initialInvoice.porcentajePerdidas, 4, '%')} />
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
                p1={initialInvoice.potenciaAFacturarP1} p2={initialInvoice.potenciaAFacturarP2} p3={initialInvoice.potenciaAFacturarP3}
                p4={initialInvoice.potenciaAFacturarP4} p5={initialInvoice.potenciaAFacturarP5} p6={initialInvoice.potenciaAFacturarP6}
                formatter={(v: number) => formatNumber(v, 2)} />
              
              <PeriodRow label="Importe Peajes ATR (€)" 
                p1={initialInvoice.importePmP1} p2={initialInvoice.importePmP2} p3={initialInvoice.importePmP3}
                p4={initialInvoice.importePmP4} p5={initialInvoice.importePmP5} p6={initialInvoice.importePmP6}
                formatter={(v: number) => formatCurrency(v, 2)} />

              <PeriodRow label="Importe Excesos ATR (€)" 
                p1={initialInvoice.importeExcesoPmP1} p2={initialInvoice.importeExcesoPmP2} p3={initialInvoice.importeExcesoPmP3}
                p4={initialInvoice.importeExcesoPmP4} p5={initialInvoice.importeExcesoPmP5} p6={initialInvoice.importeExcesoPmP6}
                formatter={(v: number) => formatCurrency(v, 2)} />
            </div>
          </div>

          <DataItem label="Importe Total Peajes Potencia" value={formatCurrency(initialInvoice.importeTotalPmAtr)} />
          <DataItem label="Importe Total Excesos Potencia" value={formatCurrency(initialInvoice.importeTotalExcesosAtr)} />
          <DataItem label="Importe Cargos Potencia" value={formatCurrency(initialInvoice.importeCargoPotenciaTotal)} />
          <DataItem highlight label="Total Término Potencia" value={<span className="font-bold text-[var(--lime)]">{formatCurrency(initialInvoice.importePotenciaFactura)}</span>} />
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
              <PeriodRow label="Precio Venta (€/kWh)" 
                p1={initialInvoice.p1E || initialInvoice.p1c} p2={initialInvoice.p2E || initialInvoice.p2c} p3={initialInvoice.p3E || initialInvoice.p3c}
                p4={initialInvoice.p4E || initialInvoice.p4c} p5={initialInvoice.p5E || initialInvoice.p5c} p6={initialInvoice.p6E || initialInvoice.p6c}
                formatter={(v: number) => formatNumber(v, 6)} />
              
              <PeriodRow label="Importe Ene. Activa (€)" 
                p1={initialInvoice.importeAeP1} p2={initialInvoice.importeAeP2} p3={initialInvoice.importeAeP3}
                p4={initialInvoice.importeAeP4} p5={initialInvoice.importeAeP5} p6={initialInvoice.importeAeP6}
                formatter={(v: number) => formatCurrency(v, 2)} />

              <PeriodRow label="Precio Reactiva (€/kVArh)" 
                p1={initialInvoice.p1PrecioEnergiaReactiva} p2={initialInvoice.p2PrecioEnergiaReactiva} p3={initialInvoice.p3PrecioEnergiaReactiva}
                p4={initialInvoice.p4PrecioEnergiaReactiva} p5={initialInvoice.p5PrecioEnergiaReactiva} p6={initialInvoice.p6PrecioEnergiaReactiva}
                formatter={(v: number) => formatNumber(v, 6)} />

              <PeriodRow label="Importe Reactiva (€)" 
                p1={initialInvoice.importeR1P1} p2={initialInvoice.importeR1P2} p3={initialInvoice.importeR1P3}
                p4={initialInvoice.importeR1P4} p5={initialInvoice.importeR1P5} p6={initialInvoice.importeR1P6}
                formatter={(v: number) => formatCurrency(v, 2)} />
            </div>
          </div>

          <DataItem label="Importe Total Energía Activa" value={formatCurrency(initialInvoice.importeTotalAeAtr)} />
          <DataItem label="Importe Cargos Energía" value={formatCurrency(initialInvoice.importeCargoEnergiaTotal)} />
          <DataItem label="Importe Total Reactiva" value={formatCurrency(initialInvoice.importeTotalRAtr)} />
          <DataItem label="Ajuste / Tope del Gas" value={formatCurrency(initialInvoice.importeAjusteGas)} />
          
          <DataItem label="Coste Desvíos (DSV)" value={formatCurrency(initialInvoice.dsv)} />
          <DataItem label="FEE Operativo" value={formatCurrency(initialInvoice.fee)} />
          
          <DataItem highlight label="Compensación Excedentes" value={<span className="font-bold text-red-400">{formatCurrency(initialInvoice.importeAplicableCompensacionExcedentes ? -Math.abs(initialInvoice.importeAplicableCompensacionExcedentes) : null)}</span>} />
          <DataItem highlight label="Total Término Energía" value={<span className="font-bold text-[var(--lime)]">{formatCurrency(initialInvoice.importeEnergiaFactura)}</span>} />
        </SectionCard>

        {/* 6. CONCEPTOS ADICIONALES Y SVA */}
        <SectionCard title="6. Conceptos Adicionales y SVA" icon={BarChart3} delay={600}>
          <DataItem label="Costes de Gestión" value={formatCurrency(initialInvoice.costesDeGestion)} />
          <DataItem label="Suplemento Territorial" value={formatCurrency(initialInvoice.suplementoTerritorial)} />
          <DataItem label="Tasa Municipal / Base" value={`${formatCurrency(initialInvoice.tasaMunicipal)} / ${formatCurrency(initialInvoice.baseImponibleTasaMunicipal)}`} />
          <DataItem label="Penalización No ICP" value={formatCurrency(initialInvoice.penalizacionNoIcp)} />
          <DataItem label="Alquiler Equipo Medida" value={`${formatCurrency(initialInvoice.alquilerEquipoDeMedida)} (${initialInvoice.numeroDiasAlquiler1 || 0} días)`} />
          
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
          <DataItem label="Subtotal 1 (Sin Descuentos/SVA)" value={formatCurrency(initialInvoice.subtotal1)} />
          <DataItem label="Subtotal 2 (Base Imponible Previa)" value={formatCurrency(initialInvoice.subtotal2)} />
          <DataItem label="Subtotal Otros Conceptos" value={formatCurrency(initialInvoice.subtotalOtrosConcepto)} />
          
          <DataItem label="Impuesto Eléctrico (Cuota)" value={formatCurrency(initialInvoice.ieOdoo)} />
          
          <div className="col-span-full border-t border-[var(--border-strong)] my-2"></div>
          
          <DataItem label="Base Imponible IVA General" value={formatCurrency(initialInvoice.baseImponibleIva)} />
          
          {initialInvoice.baseImponible5 && <DataItem label="Base Imponible IVA 5%" value={formatCurrency(initialInvoice.baseImponible5)} />}
          {initialInvoice.importeIva5 && <DataItem label="Cuota IVA 5%" value={formatCurrency(initialInvoice.importeIva5)} />}
          
          {initialInvoice.baseImponible10 && <DataItem label="Base Imponible IVA 10%" value={formatCurrency(initialInvoice.baseImponible10)} />}
          {initialInvoice.importeIva10 && <DataItem label="Cuota IVA 10%" value={formatCurrency(initialInvoice.importeIva10)} />}
          
          {initialInvoice.baseImponible21 && <DataItem label="Base Imponible IVA 21%" value={formatCurrency(initialInvoice.baseImponible21)} />}
          {initialInvoice.importeIva21 && <DataItem label="Cuota IVA 21%" value={formatCurrency(initialInvoice.importeIva21)} />}
          
          <DataItem label="Total Impuestos" value={formatCurrency(initialInvoice.taxAmount || initialInvoice.importeIva)} />
          
          <div className="col-span-full mt-2">
            <DataItem highlight label="Total Importe Factura" value={<span className="text-2xl font-bold font-mono text-[var(--lime)]">{formatCurrency(initialInvoice.totalAmount || initialInvoice.total)}</span>} />
          </div>
        </SectionCard>

        {/* 8. ANÁLISIS DE RENTABILIDAD (ADMIN ONLY) */}
        {isAdmin && (
          <SectionCard title="8. Rentabilidad Comercial interna" icon={BarChart3} delay={800}>
            <DataItem label="Importe Energía Sin Margen" value={formatCurrency(initialInvoice.importeEnergiaSinMargen)} />
            <DataItem label="Margen Potencia" value={formatCurrency(initialInvoice.margenPotencia)} />
            <DataItem label="Margen Energía" value={formatCurrency(initialInvoice.margenEnergia)} />
            <DataItem label="Margen Excesos" value={formatCurrency(initialInvoice.margenExcesos)} />
            
            <DataItem label="Comisión Precio Energía" value={formatCurrency(initialInvoice.comisionPrecioEnergia)} />
            <DataItem label="Comisión Volumen Energía" value={formatCurrency(initialInvoice.comisionVolumenEnergia)} />
            <DataItem label="Comisión Potencia Canal" value={formatCurrency(initialInvoice.comisionPotenciaCanal)} />
            <DataItem label="Comisión Costes de Gestión" value={formatCurrency(initialInvoice.comisionCostesDeGestion)} />
            
            <div className="col-span-full border-t border-[var(--border-strong)] my-2"></div>
            
            <DataItem highlight label="Margen Factura Total" value={<span className="font-bold font-mono text-[var(--lime)] text-xl">{formatCurrency(initialInvoice.margenFactura || initialInvoice.margin)}</span>} />
            <DataItem highlight label="Comisión Generada Total" value={<span className="font-bold font-mono text-[var(--text-primary)] text-xl">{formatCurrency(initialInvoice.comisionTotal)}</span>} />
          </SectionCard>
        )}

      </div>
    </div>
  );
}
