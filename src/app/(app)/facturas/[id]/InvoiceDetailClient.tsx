'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDateUTC } from '@/lib/utils/date';
import Topbar from '@/components/Topbar';
import {
  ChevronLeft,
  FileText,
  Zap,
  Building,
  Calendar,
  Euro,
  FileDown,
  Download,
  Activity,
  BarChart3,
  Calculator,
  BatteryCharging,
  ExternalLink,
} from 'lucide-react';

// Diccionarios oficiales CNMC V3.0 (TiposSencillos.xsd)
const CNMC_PROCEDENCIA: Record<string, string> = {
  '10': 'Telemedida',
  '20': 'TPL',
  '30': 'Visual',
  '40': 'Estimada',
  '50': 'Autolectura',
  '60': 'Telegestión',
  '70': 'Calculada',
  '99': 'Sin lectura',
};

const CNMC_MOTIVO_FACTURACION: Record<string, string> = {
  '01': '01 - De ciclo',
  '02': '02 - Modificación de Contrato',
  '03': '03 - Baja de Contrato',
  '04': '04 - Derechos de Contratación',
  '05': '05 - Depósito de garantía',
  '06': '06 - Inspección - Anomalía',
  '07': '07 - Atenciones (verificaciones)',
  '08': '08 - Indemnización',
  '09': '09 - Intereses de demora',
  '10': '10 - Servicios',
  '11': '11 - Inspección - Fraude',
  '12': '12 - Derechos de contratación por reposición',
};

const CNMC_AUTOCONSUMO: Record<string, string> = {
  '00': 'Sin autoconsumo',
  '01': 'Sin excedentes',
  '02': 'Con excedentes (sin compensación)',
  '03': 'Con excedentes acogida a compensación simplificada',
  '11': 'Sin excedentes (CNMC V3.0)',
  '12': 'Con excedentes (CNMC V3.0)',
  '0C': 'Baja como miembro de autoconsumo colectivo',
  '31': '31 - Sin excedentes (Individual)',
  '32': '32 - Sin excedentes (Colectivo)',
  '41': '41 - Con excedentes acogida a compensación (Individual)',
  '42': '42 - Con excedentes acogida a compensación (Colectivo)',
  '43': '43 - Con excedentes acogida a compensación (Colectivo por red)',
  '51': '51 - Con excedentes sin compensación (Individual)',
  I: 'Autoconsumo Individual',
  C: 'Autoconsumo Colectivo',
};

function isValidCloudAsset(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    (url.startsWith('http://') || url.startsWith('https://')) &&
    !url.includes('airtable')
  );
}

function cleanTextMojibake(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/â¬/g, '€').trim();
}

function getColSpanClass(colSpan: number) {
  if (colSpan === 2) return 'md:col-span-2';
  if (colSpan === 3) return 'lg:col-span-3';
  if (colSpan === 4) return 'col-span-full';
  return '';
}

function DataItem({
  label,
  value,
  icon: Icon,
  highlight,
  colSpan = 1,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  highlight?: boolean;
  colSpan?: number;
}) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        highlight
          ? 'bg-[rgba(222,255,154,0.03)] border-[var(--lime)]/30'
          : 'bg-[var(--bg-elevated)] border-[var(--border)]'
      } ${getColSpanClass(colSpan)}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={14} className={highlight ? 'text-[var(--lime)]' : 'text-[var(--text-muted)]'} />}
        <span className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div
        className={`text-[0.95rem] font-medium ${
          highlight ? 'text-[var(--lime)]' : 'text-[var(--text-primary)]'
        } break-words`}
      >
        {value || '-'}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="card animate-fade-in-up" style={{ padding: '24px' }}>
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border)]">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--bg-base)] border border-[var(--border-strong)]">
          <Icon size={18} className="text-[var(--text-primary)]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{children}</div>
    </div>
  );
}

function PeriodRow({
  label,
  p1,
  p2,
  p3,
  p4,
  p5,
  p6,
  formatter,
}: {
  label: string;
  p1?: any;
  p2?: any;
  p3?: any;
  p4?: any;
  p5?: any;
  p6?: any;
  formatter: (v: any) => React.ReactNode;
}) {
  if ([p1, p2, p3, p4, p5, p6].every((p) => p === null || p === undefined)) return null;
  return (
    <div className="grid grid-cols-7 gap-2 items-center py-2 border-b border-[var(--border)] text-sm">
      <div className="font-semibold text-[var(--text-secondary)]">{label}</div>
      <div className="text-right text-[var(--text-primary)]">{p1 !== null && p1 !== undefined ? formatter(p1) : '-'}</div>
      <div className="text-right text-[var(--text-primary)]">{p2 !== null && p2 !== undefined ? formatter(p2) : '-'}</div>
      <div className="text-right text-[var(--text-primary)]">{p3 !== null && p3 !== undefined ? formatter(p3) : '-'}</div>
      <div className="text-right text-[var(--text-primary)]">{p4 !== null && p4 !== undefined ? formatter(p4) : '-'}</div>
      <div className="text-right text-[var(--text-primary)]">{p5 !== null && p5 !== undefined ? formatter(p5) : '-'}</div>
      <div className="text-right text-[var(--text-primary)]">{p6 !== null && p6 !== undefined ? formatter(p6) : '-'}</div>
    </div>
  );
}

export default function InvoiceDetailClient({ initialInvoice, userRole }: { initialInvoice: any; userRole: string }) {
  const router = useRouter();
  const isAdmin = userRole === 'SUPERADMIN' || userRole === 'COMPANYADMIN' || userRole === 'BACKOFFICE';
  const isClientRole = userRole === 'CLIENT' || userRole === 'CLIENTE';

  const rawData = (initialInvoice.invoiceData as any) || {};
  const isAbono = Boolean(initialInvoice.invoiceType && initialInvoice.invoiceType.toLowerCase().includes('abono'));

  const getRawNum = (...keys: string[]): number | null => {
    for (const k of keys) {
      if (rawData[k] !== undefined && rawData[k] !== null && rawData[k] !== '') {
        let s = rawData[k].toString().trim();
        if (!s || s.toUpperCase() === 'N' || s.toUpperCase() === 'NO') continue;
        if (s.startsWith('0x')) continue; // Evitar códigos contables como IE Odoo = "0x10"
        if (s.includes(',') && s.includes('.')) {
          if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
          } else {
            s = s.replace(/,/g, '');
          }
        } else if (s.includes(',')) {
          s = s.replace(',', '.');
        }
        const val = parseFloat(s);
        if (!isNaN(val)) return val;
      }
    }
    return null;
  };

  // Regla 85: Los abonos se representan con signo negativo en importes y consumos
  const signed = (val: number | null | undefined): number | null | undefined => {
    if (val === null || val === undefined || val === 0) return val;
    return isAbono ? -Math.abs(val) : val;
  };

  const formatString = (v: any) => v || '-';
  const formatDate = (iso: Date | string | null | undefined) => formatDateUTC(iso);

  const formatCurrency = (val: number | null | undefined, decimals = 2) => {
    if (val === null || val === undefined) return '-';
    return `${val.toLocaleString('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })} €`;
  };

  const formatNumber = (val: number | null | undefined, decimals = 2, suffix = '') => {
    if (val === null || val === undefined) return '-';
    return `${val.toLocaleString('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix ? ' ' + suffix : ''}`;
  };

  const resolveProcedencia = (val: unknown): string => {
    const s = String(val || '').trim();
    if (!s) return 'N/A';
    return CNMC_PROCEDENCIA[s] || s;
  };

  const resolveMotivoFacturacion = (): string => {
    const rawMotivo = cleanTextMojibake(rawData['Motivo Factura'] || rawData['MotivoFacturacion'] || '');
    if (!rawMotivo) return 'Ordinaria / Ciclo';
    return CNMC_MOTIVO_FACTURACION[rawMotivo] || rawMotivo;
  };

  const resolveAutoconsumo = (): string => {
    const distCode = cleanTextMojibake(rawData['Tipo Autoconsumo Distribuidora']);
    const autoCode = cleanTextMojibake(rawData['Tipo Autoconsumo'] || initialInvoice.supplyPoint?.selfConsumptionType);
    if (distCode && CNMC_AUTOCONSUMO[distCode]) return CNMC_AUTOCONSUMO[distCode];
    if (distCode && distCode !== '00' && distCode !== '0') return distCode;
    if (autoCode && CNMC_AUTOCONSUMO[autoCode]) return CNMC_AUTOCONSUMO[autoCode];
    if (autoCode && autoCode !== '00' && autoCode !== '0') return autoCode;
    return 'Sin Autoconsumo';
  };

  // Resolver enlaces en la nube
  const pdfCandidate = initialInvoice.pdfUrl || rawData.output_pdf || rawData.PDF || null;
  const validPdfUrl = isValidCloudAsset(pdfCandidate) ? pdfCandidate : null;
  const isLegacyPdf = Boolean(pdfCandidate && String(pdfCandidate).includes('airtable'));

  const xmlCandidate = initialInvoice.xmlUrl || rawData.xmlUrl || rawData.XML || rawData.xML || null;
  const validXmlUrl = isValidCloudAsset(xmlCandidate) ? xmlCandidate : null;

  // Días facturados (NUNCA usar 'Duracion' que en Ingebau son los 12 meses de duración contractual)
  const billedDays = (() => {
    const rawDays = getRawNum('Dias', 'Dias CORR', 'Numero Dias Alquiler 1');
    if (rawDays && rawDays > 0) return `${Math.round(rawDays)} días`;
    const start = initialInvoice.billingStart || rawData['Desde(EA)'] || rawData['Desde'];
    const end = initialInvoice.billingEnd || rawData['Hasta(EA)'] || rawData['Hasta'];
    if (start && end) {
      const d1 = new Date(start);
      const d2 = new Date(end);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        const diffDays = Math.round(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 0) return `${diffDays} días`;
      }
    }
    return '-';
  })();

  // Excedentes y Bolsillo Solar reales
  const excedentesFisicos = getRawNum('Excedentes Autoconsumo a facturar', 'Energia Neta Total Generada');
  const compensacionAplicada = getRawNum('Importe Excedentes Autoconsumo Aplicado', 'Importe Excedentes Autoconsumo');
  const topeRd244 = excedentesFisicos && excedentesFisicos > 0 ? getRawNum('Importe Aplicable Compensacion Excedentes') : null;

  const bsSaldoInicial = getRawNum('Inicio Bolsillo Solar');
  const bsCarga = getRawNum('Carga Bolsillo Solar');
  const bsDescuento = getRawNum('Descuento Bolsillo Solar');
  const bsSaldoFinal = getRawNum('Importe almacenado Bolsillo Solar');
  const bsCosteGestion = getRawNum('Costes de Gestion Bolsillo Solar');
  const hasBolsilloSolar =
    String(rawData['BOLSILLO SOLAR'] || '').trim().toUpperCase() === 'SI' ||
    Boolean(bsSaldoInicial) ||
    Boolean(bsCarga) ||
    Boolean(bsDescuento) ||
    Boolean(bsSaldoFinal);

  // Impuestos y totales
  const cuotaImpuestoElectrico = signed(initialInvoice.taxAmount ?? getRawNum('Importe Impuesto CORR', 'Importe Impuesto'));
  const pctImpuestoElectrico = initialInvoice.taxPercentage ?? getRawNum('Impuesto (%)');
  const baseImpuestoElectrico = signed(getRawNum('Base 560'));

  const baseIvaGeneral = signed(getRawNum('Base Imponible IVA CORR', 'Base Imponible IVA'));
  const baseIva0 = signed(getRawNum('Base Imponible 0'));
  const baseIva5 = signed(getRawNum('Base Imponible 5'));
  const cuotaIva5 = signed(getRawNum('Importe IVA 5'));
  const baseIva10 = signed(getRawNum('Base Imponible 10'));
  const cuotaIva10 = signed(getRawNum('Importe IVA 10'));
  const baseIva21 = signed(getRawNum('Base Imponible 21'));
  const cuotaIva21 = signed(getRawNum('Importe IVA 21'));

  const rawTotalIva =
    getRawNum('Importe IVA') ??
    ((getRawNum('Importe IVA 21') || 0) + (getRawNum('Importe IVA 10') || 0) + (getRawNum('Importe IVA 5') || 0) || null);
  const totalIva = signed(rawTotalIva);
  const totalFactura = signed(initialInvoice.totalAmount ?? getRawNum('Total'));

  // Bono Social y SVA
  const bonoSocial = signed(getRawNum('Importe Bono Social CORR', 'Importe Bono Social'));
  const conceptoSva = cleanTextMojibake(rawData['Concepto SVA']);
  const totalSva = signed(getRawNum('Total SVA'));
  const diasSva = getRawNum('Días SVA', 'Dias SVA');

  const clientDisplayName =
    initialInvoice.client?.businessName ||
    [initialInvoice.client?.firstName, initialInvoice.client?.lastName, initialInvoice.client?.lastName2]
      .filter(Boolean)
      .join(' ') ||
    'Desconocido';

  const rectifiedRefNum =
    initialInvoice.rectifiedInvoice?.invoiceNumber || cleanTextMojibake(rawData['Numero factura rectificada']);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '100px' }}>
      <Topbar
        title={`Factura: ${initialInvoice.invoiceNumber}`}
        subtitle={`Cliente: ${clientDisplayName}`}
        showSearch={false}
        customActions={
          <div className="flex gap-2 md:gap-3 items-center overflow-x-auto md:overflow-visible no-scrollbar pb-1 md:pb-0">
            <button onClick={() => router.push('/facturas')} className="btn-ghost whitespace-nowrap">
              <ChevronLeft size={16} /> Volver a Facturas
            </button>
            {validPdfUrl ? (
              <a
                href={validPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <FileDown size={16} /> Ver PDF
              </a>
            ) : (
              <button
                disabled
                title={
                  isLegacyPdf
                    ? 'El enlace antiguo de Airtable ha caducado. Vuelve a subir el PDF desde Importar Facturas.'
                    : 'Aún no se ha subido el PDF a la nube.'
                }
                className="btn-primary opacity-50 cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                <FileDown size={16} /> {isLegacyPdf ? 'PDF legado caducado' : 'PDF no disponible'}
              </button>
            )}
            {validXmlUrl ? (
              <a
                href={validXmlUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary flex items-center gap-2 whitespace-nowrap"
              >
                <Download size={16} /> Ver XML
              </a>
            ) : (
              <button
                disabled
                className="btn-secondary opacity-50 cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                <Download size={16} /> XML no disponible
              </button>
            )}
          </div>
        }
      />

      <div className="max-w-7xl w-full min-w-0 mx-auto px-4 md:px-6 py-8 flex flex-col gap-6">
        {/* 1. DATOS PRINCIPALES */}
        <SectionCard title="1. Resumen Principal y Estado" icon={FileText}>
          <DataItem
            highlight
            label="Número de Factura"
            value={<span className="font-mono text-lg tracking-wider">{initialInvoice.invoiceNumber}</span>}
          />
          <DataItem label="Tipo de Factura" value={initialInvoice.invoiceType || 'Normal'} />
          <DataItem icon={Calendar} label="Fecha de Emisión" value={formatDate(initialInvoice.issueDate)} />
          <DataItem
            icon={Calendar}
            label="Fecha de Cobro / Vto"
            value={formatDate(initialInvoice.paymentDate || rawData['Fecha Cobro'])}
          />
          <DataItem label="Motivo de Facturación" value={resolveMotivoFacturacion()} />
          <DataItem
            label="Comunicación al Cliente"
            value={
              initialInvoice.communicatedAt ? `Enviada el ${formatDate(initialInvoice.communicatedAt)}` : 'No notificada'
            }
          />
          {rectifiedRefNum && (
            <DataItem
              label="Factura Rectificada Origen"
              value={
                initialInvoice.rectifiedInvoice?.id ? (
                  <Link
                    href={`/facturas/${initialInvoice.rectifiedInvoice.id}`}
                    className="inline-flex items-center gap-1.5 font-mono text-[var(--lime)] hover:underline"
                  >
                    {rectifiedRefNum} <ExternalLink size={13} />
                  </Link>
                ) : (
                  <span className="font-mono">{rectifiedRefNum}</span>
                )
              }
            />
          )}
          <DataItem
            highlight
            icon={Euro}
            label={isAbono ? 'Total Factura (Abono)' : 'Total Factura'}
            value={
              <span
                className="text-xl font-bold font-mono"
                style={{ color: isAbono ? '#fb7185' : 'var(--lime)' }}
              >
                {formatCurrency(totalFactura)}
              </span>
            }
          />

          {initialInvoice.rectifications && initialInvoice.rectifications.length > 0 && (
            <DataItem
              colSpan={4}
              label="Rectificaciones / Abonos posteriores asociados a esta factura"
              value={
                <div className="flex flex-wrap gap-2 mt-1">
                  {initialInvoice.rectifications.map((rect: any) => {
                    const rectAbono = rect.invoiceType?.toLowerCase().includes('abono');
                    const amt = rectAbono ? -Math.abs(rect.totalAmount || 0) : rect.totalAmount || 0;
                    return (
                      <Link
                        key={rect.id}
                        href={`/facturas/${rect.id}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors hover:border-[var(--lime)]"
                        style={{ background: 'var(--bg-base)', borderColor: 'var(--border-strong)' }}
                      >
                        <span className="font-bold text-[var(--lime)]">{rect.invoiceNumber}</span>
                        <span style={{ color: 'var(--text-muted)' }}>({rect.invoiceType || 'Rectificativa'})</span>
                        <span style={{ color: rectAbono ? '#fb7185' : '#34d399' }}>{formatCurrency(amt)}</span>
                        <ExternalLink size={12} />
                      </Link>
                    );
                  })}
                </div>
              }
            />
          )}
        </SectionCard>

        {/* 2. DATOS DEL SUMINISTRO */}
        <SectionCard title="2. Datos del Suministro y Periodo" icon={Building}>
          <DataItem
            label="Cliente"
            value={
              !isClientRole && initialInvoice.clientId ? (
                <Link href={`/clientes/${initialInvoice.clientId}`} className="text-[var(--lime)] hover:underline">
                  {clientDisplayName}
                </Link>
              ) : (
                clientDisplayName
              )
            }
          />
          <DataItem label="NIF / CIF Cliente" value={initialInvoice.client?.vatNumber || rawData['CIF'] || '-'} />
          <DataItem label="Código Fiscal F1 (Distr.)" value={rawData['Codigo Fiscal'] || '-'} />
          <DataItem
            highlight
            label="CUPS"
            value={
              <span className="font-mono tracking-widest">
                {initialInvoice.supplyPoint?.cups || rawData['CUPS'] || '-'}
              </span>
            }
          />
          <DataItem
            label="Tarifa ATR"
            value={<span className="font-mono">{rawData['Tarifa ATR'] || initialInvoice.supplyPoint?.tariff || '-'}</span>}
          />
          <DataItem
            label="Contrato Comercializadora"
            value={
              <span className="font-mono">
                {initialInvoice.contract?.contractCode || rawData['CONTRATO'] || rawData['Contrato'] || '-'}
              </span>
            }
          />
          <DataItem
            label="Cód. Contrato ATR (Distr.)"
            value={<span className="font-mono">{rawData['Codigo Contrato'] || '-'}</span>}
          />
          <DataItem
            label="Distribuidora"
            value={
              initialInvoice.supplyPoint?.distributorName ||
              initialInvoice.supplyPoint?.distributor ||
              rawData['DISTRIBUIDORA'] ||
              '-'
            }
          />
          <DataItem label="Tipo Autoconsumo" value={resolveAutoconsumo()} />
          <DataItem
            label="Sistema Eléctrico"
            value={
              rawData['SISTEMA ELECTRICO']
                ? String(rawData['SISTEMA ELECTRICO']).charAt(0).toUpperCase() +
                  String(rawData['SISTEMA ELECTRICO']).slice(1)
                : 'Península'
            }
          />
          <DataItem
            label="Fecha Inicio (Ciclo)"
            value={formatDate(initialInvoice.billingStart || rawData['Desde(EA)'] || rawData['Desde'])}
          />
          <DataItem
            label="Fecha Fin (Ciclo)"
            value={formatDate(initialInvoice.billingEnd || rawData['Hasta(EA)'] || rawData['Hasta'])}
          />
          <DataItem label="Días Facturados" value={billedDays} />
          <DataItem
            label="Procedencia Lectura (Desde → Hasta)"
            value={`${resolveProcedencia(rawData['Procedencia Desde'])} → ${resolveProcedencia(
              rawData['Procedencia Hasta'] || initialInvoice.origin
            )}`}
          />
        </SectionCard>

        {/* 3. CONSUMOS Y POTENCIAS (FÍSICO) */}
        <SectionCard title="3. Consumos y Lecturas Registradas (Físico)" icon={Activity}>
          <div className="col-span-full overflow-x-auto">
            <div className="md:min-w-[600px] bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
              <div className="hidden md:grid grid-cols-7 gap-2 pb-2 mb-2 border-b-2 border-[var(--border-strong)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <div>Concepto Físico</div>
                <div className="text-right">P1</div>
                <div className="text-right">P2</div>
                <div className="text-right">P3</div>
                <div className="text-right">P4</div>
                <div className="text-right">P5</div>
                <div className="text-right">P6</div>
              </div>
              <PeriodRow
                label="Energía Activa (kWh)"
                p1={signed(getRawNum('P1 Energia Activa Consumida'))}
                p2={signed(getRawNum('P2 Energia Activa Consumida'))}
                p3={signed(getRawNum('P3 Energia Activa Consumida'))}
                p4={signed(getRawNum('P4 Energia Activa Consumida'))}
                p5={signed(getRawNum('P5 Energia Activa Consumida'))}
                p6={signed(getRawNum('P6 Energia Activa Consumida'))}
                formatter={(v: number) => formatNumber(v, 2)}
              />

              <PeriodRow
                label="Pot. Contratada (kW)"
                p1={getRawNum('P1 Potencia Contratada', 'P1C') ?? initialInvoice.supplyPoint?.p1c}
                p2={getRawNum('P2 Potencia Contratada', 'P2C') ?? initialInvoice.supplyPoint?.p2c}
                p3={getRawNum('P3 Potencia Contratada', 'P3C') ?? initialInvoice.supplyPoint?.p3c}
                p4={getRawNum('P4 Potencia Contratada', 'P4C') ?? initialInvoice.supplyPoint?.p4c}
                p5={getRawNum('P5 Potencia Contratada', 'P5C') ?? initialInvoice.supplyPoint?.p5c}
                p6={getRawNum('P6 Potencia Contratada', 'P6C') ?? initialInvoice.supplyPoint?.p6c}
                formatter={(v: number) => formatNumber(v, 3)}
              />

              <PeriodRow
                label="Maxímetro (kW)"
                p1={getRawNum('P1 Potencia Max Demanda')}
                p2={getRawNum('P2 Potencia Max Demanda')}
                p3={getRawNum('P3 Potencia Max Demanda')}
                p4={getRawNum('P4 Potencia Max Demanda')}
                p5={getRawNum('P5 Potencia Max Demanda')}
                p6={getRawNum('P6 Potencia Max Demanda')}
                formatter={(v: number) => formatNumber(v, 2)}
              />

              <PeriodRow
                label="Energía Reactiva (kVArh)"
                p1={signed(getRawNum('P1 Energia Reactiva Consumida'))}
                p2={signed(getRawNum('P2 Energia Reactiva Consumida'))}
                p3={signed(getRawNum('P3 Energia Reactiva Consumida'))}
                p4={signed(getRawNum('P4 Energia Reactiva Consumida'))}
                p5={signed(getRawNum('P5 Energia Reactiva Consumida'))}
                p6={signed(getRawNum('P6 Energia Reactiva Consumida'))}
                formatter={(v: number) => formatNumber(v, 2)}
              />

              <PeriodRow
                label="Excedentes Auto (kWh)"
                p1={getRawNum('Excedentes P1 Autoconsumo')}
                p2={getRawNum('Excedentes P2 Autoconsumo')}
                p3={getRawNum('Excedentes P3 Autoconsumo')}
                p4={getRawNum('Excedentes P4 Autoconsumo')}
                p5={getRawNum('Excedentes P5 Autoconsumo')}
                p6={getRawNum('Excedentes P6 Autoconsumo')}
                formatter={(v: number) => formatNumber(v, 2)}
              />

              <PeriodRow
                label="Lecturas Contador (AE)"
                p1={
                  rawData['Lectura Desde AE P1']
                    ? `${rawData['Lectura Desde AE P1']} → ${rawData['Lectura Hasta AE P1']}`
                    : null
                }
                p2={
                  rawData['Lectura Desde AE P2']
                    ? `${rawData['Lectura Desde AE P2']} → ${rawData['Lectura Hasta AE P2']}`
                    : null
                }
                p3={
                  rawData['Lectura Desde AE P3']
                    ? `${rawData['Lectura Desde AE P3']} → ${rawData['Lectura Hasta AE P3']}`
                    : null
                }
                p4={
                  rawData['Lectura Desde AE P4']
                    ? `${rawData['Lectura Desde AE P4']} → ${rawData['Lectura Hasta AE P4']}`
                    : null
                }
                p5={
                  rawData['Lectura Desde AE P5']
                    ? `${rawData['Lectura Desde AE P5']} → ${rawData['Lectura Hasta AE P5']}`
                    : null
                }
                p6={
                  rawData['Lectura Desde AE P6']
                    ? `${rawData['Lectura Desde AE P6']} → ${rawData['Lectura Hasta AE P6']}`
                    : null
                }
                formatter={formatString}
              />
            </div>
          </div>

          <DataItem
            label="Energía Total Consumida"
            value={formatNumber(
              signed(initialInvoice.totalMWh ?? getRawNum('Energía Total Consumida', 'Consumo')),
              2,
              'kWh'
            )}
          />
          <DataItem
            label="Energía Reactiva Total"
            value={formatNumber(
              signed(
                getRawNum('Reactiva Total Consumida') ??
                  ((getRawNum('P1 Energia Reactiva Consumida') || 0) +
                    (getRawNum('P2 Energia Reactiva Consumida') || 0) +
                    (getRawNum('P3 Energia Reactiva Consumida') || 0) +
                    (getRawNum('P4 Energia Reactiva Consumida') || 0) +
                    (getRawNum('P5 Energia Reactiva Consumida') || 0) +
                    (getRawNum('P6 Energia Reactiva Consumida') || 0) ||
                    null)
              ),
              2,
              'kVArh'
            )}
          />
          <DataItem
            label="Excedentes Totales (Físicos)"
            value={formatNumber(excedentesFisicos, 2, 'kWh')}
          />
          <DataItem label="Pérdidas (%)" value={formatNumber(getRawNum('Porcentaje Perdidas'), 4, '%')} />
        </SectionCard>

        {/* 4. TÉRMINO DE POTENCIA (ECONÓMICO) */}
        <SectionCard title="4. Término de Potencia (Económico)" icon={Zap}>
          <div className="col-span-full overflow-x-auto">
            <div className="md:min-w-[600px] bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
              <div className="hidden md:grid grid-cols-7 gap-2 pb-2 mb-2 border-b-2 border-[var(--border-strong)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <div>Concepto Económico</div>
                <div className="text-right">P1</div>
                <div className="text-right">P2</div>
                <div className="text-right">P3</div>
                <div className="text-right">P4</div>
                <div className="text-right">P5</div>
                <div className="text-right">P6</div>
              </div>
              <PeriodRow
                label="Pot. a Facturar (kW)"
                p1={getRawNum('Potencia a Facturar P1', 'P1 Potencia Contratada', 'P1C')}
                p2={getRawNum('Potencia a Facturar P2', 'P2 Potencia Contratada', 'P2C')}
                p3={getRawNum('Potencia a Facturar P3', 'P3 Potencia Contratada', 'P3C')}
                p4={getRawNum('Potencia a Facturar P4', 'P4 Potencia Contratada', 'P4C')}
                p5={getRawNum('Potencia a Facturar P5', 'P5 Potencia Contratada', 'P5C')}
                p6={getRawNum('Potencia a Facturar P6', 'P6 Potencia Contratada', 'P6C')}
                formatter={(v: number) => formatNumber(v, 2)}
              />

              <PeriodRow
                label="Precio Pot. (€/kW·día)"
                p1={getRawNum('P1P')}
                p2={getRawNum('P2P')}
                p3={getRawNum('P3P')}
                p4={getRawNum('P4P')}
                p5={getRawNum('P5P')}
                p6={getRawNum('P6P')}
                formatter={(v: number) => formatNumber(v, 6)}
              />

              <PeriodRow
                label="Importe Pot. Cliente (€)"
                p1={signed(getRawNum('Importe PM P1'))}
                p2={signed(getRawNum('Importe PM P2'))}
                p3={signed(getRawNum('Importe PM P3'))}
                p4={signed(getRawNum('Importe PM P4'))}
                p5={signed(getRawNum('Importe PM P5'))}
                p6={signed(getRawNum('Importe PM P6'))}
                formatter={(v: number) => formatCurrency(v, 2)}
              />

              <PeriodRow
                label="Importe ATR Potencia (€)"
                p1={signed(getRawNum('Importe Ponderado ATR Potencia P1', 'Importe Ponderado Peajes Potencia P1'))}
                p2={signed(getRawNum('Importe Ponderado ATR Potencia P2', 'Importe Ponderado Peajes Potencia P2'))}
                p3={signed(getRawNum('Importe Ponderado ATR Potencia P3', 'Importe Ponderado Peajes Potencia P3'))}
                p4={signed(getRawNum('Importe Ponderado ATR Potencia P4', 'Importe Ponderado Peajes Potencia P4'))}
                p5={signed(getRawNum('Importe Ponderado ATR Potencia P5', 'Importe Ponderado Peajes Potencia P5'))}
                p6={signed(getRawNum('Importe Ponderado ATR Potencia P6', 'Importe Ponderado Peajes Potencia P6'))}
                formatter={(v: number) => formatCurrency(v, 2)}
              />

              <PeriodRow
                label="Importe Excesos ATR (€)"
                p1={signed(getRawNum('Importe Exceso PM P1'))}
                p2={signed(getRawNum('Importe Exceso PM P2'))}
                p3={signed(getRawNum('Importe Exceso PM P3'))}
                p4={signed(getRawNum('Importe Exceso PM P4'))}
                p5={signed(getRawNum('Importe Exceso PM P5'))}
                p6={signed(getRawNum('Importe Exceso PM P6'))}
                formatter={(v: number) => formatCurrency(v, 2)}
              />
            </div>
          </div>

          <DataItem
            label="Importe Peajes Potencia (ATR)"
            value={formatCurrency(signed(getRawNum('Importe Ponderado Peajes Potencia', 'Importe Peajes PM')))}
          />
          <DataItem
            label="Importe Cargos Potencia (ATR)"
            value={formatCurrency(signed(getRawNum('Importe Ponderado Cargos Potencia', 'Importe Cargo Potencia Total')))}
          />
          <DataItem
            label="Importe Total Excesos Potencia"
            value={formatCurrency(signed(getRawNum('Importe Total Excesos ATR F1', 'Importe Total Excesos ATR')))}
          />
          <DataItem
            highlight
            label="Total Término Potencia"
            value={
              <span className="font-bold text-[var(--lime)]">
                {formatCurrency(signed(getRawNum('Importe Potencia Factura', 'Importe Potencia ATR')))}
              </span>
            }
          />
        </SectionCard>

        {/* 5. TÉRMINO DE ENERGÍA (ECONÓMICO) */}
        <SectionCard title="5. Término de Energía (Económico)" icon={BatteryCharging}>
          <div className="col-span-full overflow-x-auto">
            <div className="md:min-w-[600px] bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
              <div className="hidden md:grid grid-cols-7 gap-2 pb-2 mb-2 border-b-2 border-[var(--border-strong)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <div>Concepto Económico</div>
                <div className="text-right">P1</div>
                <div className="text-right">P2</div>
                <div className="text-right">P3</div>
                <div className="text-right">P4</div>
                <div className="text-right">P5</div>
                <div className="text-right">P6</div>
              </div>
              <PeriodRow
                label="Precio Ene. (€/kWh)"
                p1={getRawNum('P1E')}
                p2={getRawNum('P2E')}
                p3={getRawNum('P3E')}
                p4={getRawNum('P4E')}
                p5={getRawNum('P5E')}
                p6={getRawNum('P6E')}
                formatter={(v: number) => formatNumber(v, 6)}
              />

              <PeriodRow
                label="Importe Ene. Activa (€)"
                p1={signed(getRawNum('Importe AE P1'))}
                p2={signed(getRawNum('Importe AE P2'))}
                p3={signed(getRawNum('Importe AE P3'))}
                p4={signed(getRawNum('Importe AE P4'))}
                p5={signed(getRawNum('Importe AE P5'))}
                p6={signed(getRawNum('Importe AE P6'))}
                formatter={(v: number) => formatCurrency(v, 2)}
              />

              <PeriodRow
                label="Importe ATR Energía (€)"
                p1={signed(getRawNum('Importe Ponderado ATR Energia P1'))}
                p2={signed(getRawNum('Importe Ponderado ATR Energia P2'))}
                p3={signed(getRawNum('Importe Ponderado ATR Energia P3'))}
                p4={signed(getRawNum('Importe Ponderado ATR Energia P4'))}
                p5={signed(getRawNum('Importe Ponderado ATR Energia P5'))}
                p6={signed(getRawNum('Importe Ponderado ATR Energia P6'))}
                formatter={(v: number) => formatCurrency(v, 2)}
              />

              <PeriodRow
                label="Precio Reactiva (€/kVArh)"
                p1={getRawNum('P1 Precio Energia Reactiva')}
                p2={getRawNum('P2 Precio Energia Reactiva')}
                p3={getRawNum('P3 Precio Energia Reactiva')}
                p4={getRawNum('P4 Precio Energia Reactiva')}
                p5={getRawNum('P5 Precio Energia Reactiva')}
                p6={getRawNum('P6 Precio Energia Reactiva')}
                formatter={(v: number) => formatNumber(v, 6)}
              />

              <PeriodRow
                label="Importe Reactiva (€)"
                p1={signed(getRawNum('Importe R1 P1'))}
                p2={signed(getRawNum('Importe R1 P2'))}
                p3={signed(getRawNum('Importe R1 P3'))}
                p4={signed(getRawNum('Importe R1 P4'))}
                p5={signed(getRawNum('Importe R1 P5'))}
                p6={signed(getRawNum('Importe R1 P6'))}
                formatter={(v: number) => formatCurrency(v, 2)}
              />
            </div>
          </div>

          <DataItem
            label="Importe Peajes Energía (ATR)"
            value={formatCurrency(signed(getRawNum('Importe Ponderado Peajes Energia', 'Importe Peajes AE')))}
          />
          <DataItem
            label="Importe Cargos Energía (ATR)"
            value={formatCurrency(signed(getRawNum('Importe Ponderado Cargos Energia', 'Importe Cargo Energia Total')))}
          />
          <DataItem
            label="Importe Total Reactiva"
            value={formatCurrency(signed(getRawNum('Importe Total R ATR')))}
          />
          <DataItem
            label="Ajuste / Tope del Gas"
            value={formatCurrency(signed(getRawNum('Importe Ajuste Gas')))}
          />
          <DataItem label="Coste Desvíos (DSV)" value={formatCurrency(getRawNum('DSVM', 'DSV'))} />
          <DataItem label="FEE Operativo" value={formatCurrency(getRawNum('FEEM', 'FEE'))} />

          <DataItem
            highlight={Boolean(compensacionAplicada && compensacionAplicada !== 0)}
            label="Compensación Excedentes Aplicada"
            value={
              compensacionAplicada && compensacionAplicada !== 0 ? (
                <div>
                  <span className="font-bold" style={{ color: '#fb7185' }}>
                    {formatCurrency(isAbono ? Math.abs(compensacionAplicada) : -Math.abs(compensacionAplicada))}
                  </span>
                  {topeRd244 !== null && (
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Tope máx. RD 244/2019: {formatCurrency(topeRd244)}
                    </div>
                  )}
                </div>
              ) : (
                '-'
              )
            }
          />
          <DataItem
            highlight
            label="Total Término Energía"
            value={
              <span className="font-bold text-[var(--lime)]">
                {formatCurrency(signed(getRawNum('Importe Energia Factura', 'Importe AE P1')))}
              </span>
            }
          />
        </SectionCard>

        {/* 6. CONCEPTOS ADICIONALES Y SVA */}
        <SectionCard title="6. Conceptos Regulados, Adicionales y Bolsillo Solar" icon={BarChart3}>
          <DataItem
            label="Financiación Bono Social"
            value={formatCurrency(bonoSocial)}
          />
          <DataItem
            label="Alquiler Equipo Medida"
            value={
              getRawNum('Alquiler Equipo de Medida') !== null
                ? `${formatCurrency(signed(getRawNum('Alquiler Equipo de Medida')))} (${
                    Math.round(getRawNum('Numero Dias Alquiler 1', 'Dias') || 0)
                  } días)`
                : '-'
            }
          />
          <DataItem
            label="Tasa Municipal / Base"
            value={`${formatCurrency(signed(getRawNum('Tasa Municipal')))} / ${formatCurrency(
              signed(getRawNum('Base Imponible Tasa Municipal'))
            )}`}
          />
          <DataItem
            label="Costes de Gestión"
            value={formatCurrency(signed(getRawNum('Costes de Gestión', 'Costes de Gestion')))}
          />
          <DataItem
            label="Suplemento Territorial"
            value={formatCurrency(signed(getRawNum('Suplemento Territorial')))}
          />
          <DataItem
            label="Penalización No ICP"
            value={
              getRawNum('Penalizacion No ICP') !== null
                ? formatCurrency(signed(getRawNum('Penalizacion No ICP')))
                : 'No aplica'
            }
          />

          {(conceptoSva || (totalSva !== null && totalSva !== undefined && totalSva !== 0)) && (
            <DataItem
              colSpan={2}
              label="Servicio Valor Añadido (SVA)"
              value={`${conceptoSva || 'SVA'} : ${formatCurrency(totalSva)}${
                diasSva ? ` (${Math.round(diasSva)} días)` : ''
              }`}
            />
          )}

          {hasBolsilloSolar && (
            <div className="col-span-full mt-2 p-5 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <h4 className="text-amber-400 font-bold mb-4 flex items-center gap-2">
                <Zap size={16} /> Tu Bolsillo Solar en esta Factura
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <DataItem label="Saldo Inicial" value={formatCurrency(bsSaldoInicial ?? 0)} />
                <DataItem label="Llenado (Carga)" value={formatCurrency(bsCarga ?? 0)} />
                <DataItem
                  label="Uso (Descuento Aplicado)"
                  value={
                    <span style={{ color: bsDescuento ? '#34d399' : undefined }}>
                      {formatCurrency(bsDescuento ? -Math.abs(bsDescuento) : 0)}
                    </span>
                  }
                />
                <DataItem highlight label="Saldo Final Almacenado" value={formatCurrency(bsSaldoFinal ?? 0)} />
                <DataItem label="Costes Gestión Bolsillo" value={formatCurrency(bsCosteGestion ?? 0)} />
              </div>
            </div>
          )}
        </SectionCard>

        {/* 7. DESGLOSE DE BASE IMPONIBLE E IMPUESTOS */}
        <SectionCard title="7. Desglose Impuestos y Totales" icon={Calculator}>
          <DataItem
            label="Subtotal 1 (Energía + Potencia)"
            value={formatCurrency(signed(initialInvoice.subtotal1 ?? getRawNum('Subtotal 1', 'Total sin Descuento')))}
          />
          <DataItem label="Subtotal 2" value={formatCurrency(signed(getRawNum('Subtotal 2')))} />
          <DataItem
            label="Subtotal Otros Conceptos"
            value={formatCurrency(signed(getRawNum('Subtotal Otros Concepto')))}
          />
          <DataItem
            label={`Impuesto Eléctrico (${pctImpuestoElectrico ? formatNumber(pctImpuestoElectrico, 4, '%') : '5,1127 %'})`}
            value={
              <div>
                <div>{formatCurrency(cuotaImpuestoElectrico)}</div>
                {baseImpuestoElectrico !== null && baseImpuestoElectrico !== undefined && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Base IE: {formatCurrency(baseImpuestoElectrico)}
                  </div>
                )}
              </div>
            }
          />

          <div className="col-span-full border-t border-[var(--border)] my-1" />

          <DataItem label="Base Imponible IVA General" value={formatCurrency(baseIvaGeneral)} />
          {baseIva0 !== null && baseIva0 !== undefined && baseIva0 !== 0 && (
            <DataItem label="Base Imponible Exenta (0%)" value={formatCurrency(baseIva0)} />
          )}
          {((baseIva5 !== null && baseIva5 !== undefined && baseIva5 !== 0) ||
            (cuotaIva5 !== null && cuotaIva5 !== undefined && cuotaIva5 !== 0)) && (
            <>
              <DataItem label="Base Imponible IVA 5%" value={formatCurrency(baseIva5)} />
              <DataItem label="Cuota IVA 5%" value={formatCurrency(cuotaIva5)} />
            </>
          )}
          {((baseIva10 !== null && baseIva10 !== undefined && baseIva10 !== 0) ||
            (cuotaIva10 !== null && cuotaIva10 !== undefined && cuotaIva10 !== 0)) && (
            <>
              <DataItem label="Base Imponible IVA 10%" value={formatCurrency(baseIva10)} />
              <DataItem label="Cuota IVA 10%" value={formatCurrency(cuotaIva10)} />
            </>
          )}
          {((baseIva21 !== null && baseIva21 !== undefined && baseIva21 !== 0) ||
            (cuotaIva21 !== null && cuotaIva21 !== undefined && cuotaIva21 !== 0)) && (
            <>
              <DataItem label="Base Imponible IVA 21%" value={formatCurrency(baseIva21)} />
              <DataItem label="Cuota IVA 21%" value={formatCurrency(cuotaIva21)} />
            </>
          )}

          <DataItem label="Total Cuota IVA" value={formatCurrency(totalIva)} />

          <div className="col-span-full mt-2">
            <DataItem
              highlight
              label="Total Importe Factura"
              value={
                <span
                  className="text-2xl font-bold font-mono"
                  style={{ color: isAbono ? '#fb7185' : 'var(--lime)' }}
                >
                  {formatCurrency(totalFactura)}
                </span>
              }
            />
          </div>
        </SectionCard>

        {/* 8. ANÁLISIS DE RENTABILIDAD (ADMIN ONLY) */}
        {isAdmin && (
          <SectionCard title="8. Rentabilidad Comercial Interna" icon={BarChart3}>
            <DataItem
              label="Importe Energía Sin Margen"
              value={formatCurrency(signed(getRawNum('Importe Energia sin Margen')))}
            />
            <DataItem label="Margen Potencia" value={formatCurrency(signed(getRawNum('Margen Potencia')))} />
            <DataItem label="Margen Energía" value={formatCurrency(signed(getRawNum('Margen Energia')))} />
            <DataItem label="Margen Excesos" value={formatCurrency(signed(getRawNum('Margen Excesos')))} />

            <div className="col-span-full border-t border-[var(--border)] my-1" />

            <DataItem
              highlight
              label="Margen Factura Total"
              value={
                <span
                  className="font-bold font-mono text-xl"
                  style={{ color: isAbono ? '#fb7185' : 'var(--lime)' }}
                >
                  {formatCurrency(initialInvoice.margin ?? signed(getRawNum('Margen Factura Total', 'Margen Factura')))}
                </span>
              }
            />
            <DataItem
              highlight
              label="Comisión Generada Total"
              value={
                <span className="font-bold font-mono text-[var(--text-primary)] text-xl">
                  {formatCurrency(signed(getRawNum('Comision Total', 'Comision Generada Total')))}
                </span>
              }
            />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
