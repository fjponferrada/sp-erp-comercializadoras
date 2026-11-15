'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  X,
  Download,
  FileCode2,
  Zap,
  Gauge,
  Receipt,
  Building2,
  FileText,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { getF1RawXmlJsonAction } from '@/app/actions/f1Actions';
import type { ExtractedF1Data } from '@/lib/f1Utils';

interface F1DetailModalProps {
  file: any | null;
  onClose: () => void;
}

function fmtEur(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '-';
  return `${val.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} €`;
}

function fmtNum(val: number | null | undefined, maxDecimals = 3): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '-';
  return val.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

function fmtIsoDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function F1DetailModal({ file, onClose }: F1DetailModalProps) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'periodos' | 'json'>('resumen');
  const [rawJson, setRawJson] = useState<any | null>(null);
  const [loadingRaw, setLoadingRaw] = useState(false);

  if (!file) return null;

  const ex: ExtractedF1Data = file.extracted || {};

  const handleLoadRawJson = async () => {
    setActiveTab('json');
    if (rawJson || loadingRaw) return;
    setLoadingRaw(true);
    try {
      const res = await getF1RawXmlJsonAction(file.id);
      if (res.success && res.f1) {
        setRawJson(res.f1.jsonData);
      }
    } finally {
      setLoadingRaw(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4 bg-[rgba(255,255,255,0.02)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-base font-bold text-[var(--lime)]">
                {file.numeroFactura || 'SIN CÓDIGO'}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white/10 text-gray-200 border border-white/10">
                {ex.tipoDocumento === 'OtrasFacturas'
                  ? `OtrasFacturas (${ex.tipoFactura})`
                  : `${ex.tipoFactura} · ${ex.tipoFacturaLabel}`}
              </span>
              {ex.tarifaAtrLabel && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Tarifa {ex.tarifaAtrLabel}
                </span>
              )}
              {ex.codigoRectificada && (
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  Rectifica a: {ex.codigoRectificada}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1 truncate">
              CUPS: <span className="font-mono text-gray-200">{file.cups || '-'}</span>
              {' · '}
              Distribuidora: <span className="text-gray-300">{file.distributor?.name || '-'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {file.xmlUrl && (
              <a
                href={file.xmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/30 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar XML
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-2 border-b border-[var(--border)] flex gap-4 text-xs font-medium bg-[var(--bg-base)]/40">
          <button
            onClick={() => setActiveTab('resumen')}
            className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'resumen'
                ? 'border-[var(--lime)] text-[var(--lime)]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Resumen Económico y Vínculos
          </button>
          <button
            onClick={() => setActiveTab('periodos')}
            className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'periodos'
                ? 'border-[var(--lime)] text-[var(--lime)]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Periodos Potencia / Energía / Cargos
          </button>
          <button
            onClick={handleLoadRawJson}
            className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'json'
                ? 'border-[var(--lime)] text-[var(--lime)]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Estructura XML (JSON)
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm">
          {activeTab === 'resumen' && (
            <>
              {/* Metadata Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                  <div className="text-[11px] uppercase text-gray-500 font-semibold mb-1">
                    Fechas y Ciclo CNMC
                  </div>
                  <div className="text-xs text-gray-300 space-y-1">
                    <div>
                      <span className="text-gray-500">Emisión:</span>{' '}
                      <span className="font-medium text-white">{fmtIsoDate(file.fechaEmisionIso)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Periodo ATR:</span>{' '}
                      <span className="font-medium text-white">
                        {file.fechaDesdeIso && file.fechaHastaIso
                          ? `${fmtIsoDate(file.fechaDesdeIso)} - ${fmtIsoDate(file.fechaHastaIso)}`
                          : 'No aplica'}
                      </span>
                      {file.numeroDias ? (
                        <span className="ml-1.5 text-gray-400">({file.numeroDias} días)</span>
                      ) : null}
                    </div>
                    {ex.motivoFacturacionLabel && (
                      <div>
                        <span className="text-gray-500">Motivo:</span>{' '}
                        <span className="text-gray-200">{ex.motivoFacturacionLabel}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                  <div className="text-[11px] uppercase text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> Cliente y Contrato
                  </div>
                  <div className="text-xs text-gray-300 space-y-1">
                    <div className="truncate">
                      <span className="text-gray-500">Titular:</span>{' '}
                      {file.client?.id ? (
                        <Link
                          href={`/clientes/${file.client.id}`}
                          className="text-[var(--lime)] hover:underline font-medium"
                        >
                          {file.client.displayName || file.client.vatNumber}
                        </Link>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">NIF/CIF:</span>{' '}
                      <span className="font-mono text-gray-200">{file.client?.vatNumber || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Contrato:</span>{' '}
                      {file.contract?.id ? (
                        <Link
                          href={`/contratos/${file.contract.id}`}
                          className="font-mono text-[var(--lime)] hover:underline"
                        >
                          {file.contract.contractCode}
                        </Link>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                    {file.supplyPointId && (
                      <div>
                        <Link
                          href={`/puntos-suministro/${file.supplyPointId}`}
                          className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
                        >
                          Ver Punto de Suministro <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border)]">
                  <div className="text-[11px] uppercase text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Estado Facturación Cliente
                  </div>
                  <div className="text-xs text-gray-300 space-y-1.5">
                    {file.invoices && file.invoices.length > 0 ? (
                      file.invoices.map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between gap-2">
                          <Link
                            href={`/facturas/${inv.id}`}
                            className="text-green-400 hover:underline font-mono font-medium"
                          >
                            {inv.invoiceNumber || 'Factura Emitida'}
                          </Link>
                          <span className="text-gray-200 font-medium">{fmtEur(inv.totalAmount)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-yellow-400 font-medium">Pendiente de facturar al cliente</div>
                    )}

                    {file.internalInvoices && file.internalInvoices.length > 0 && (
                      <div className="pt-1 border-t border-white/5 space-y-1">
                        {file.internalInvoices.map((iInv: any) => (
                          <div key={iInv.id} className="flex items-center justify-between text-[11px]">
                            <Link
                              href={
                                iInv.status === 'EMITIDA' || iInv.status === 'ABONO'
                                  ? `/facturas-internas/${iInv.id}`
                                  : `/facturacion/interna?q=${encodeURIComponent(file.numeroFactura || '')}`
                              }
                              className="text-cyan-300 hover:underline"
                            >
                              Motor Interno ({iInv.status})
                            </Link>
                            <span className="text-gray-300">{fmtEur(iInv.totalAmount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-base)]">
                <div className="px-4 py-2.5 bg-white/[0.03] border-b border-[var(--border)] text-xs font-semibold uppercase text-gray-400 flex justify-between">
                  <span>Desglose Económico CNMC (Distribuidora)</span>
                  <span>Energía Total: {fmtNum(file.totalEnergiaKwh, 2)} kWh</span>
                </div>
                <div className="divide-y divide-[var(--border)] text-xs">
                  {ex.tipoDocumento === 'FacturaATR' && (
                    <>
                      <div className="px-4 py-2.5 flex justify-between">
                        <span className="text-gray-400">Peajes de Potencia (Término Potencia ATR)</span>
                        <span className="font-mono text-gray-200">{fmtEur(ex.potenciaEur)}</span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between">
                        <span className="text-gray-400">Peajes de Energía Activa</span>
                        <span className="font-mono text-gray-200">{fmtEur(ex.energiaActivaEur)}</span>
                      </div>
                      {Math.abs(ex.excesosEur || 0) > 0 && (
                        <div className="px-4 py-2.5 flex justify-between">
                          <span className="text-gray-400">Excesos de Potencia</span>
                          <span className="font-mono text-gray-200">{fmtEur(ex.excesosEur)}</span>
                        </div>
                      )}
                      {Math.abs(ex.reactivaEur || 0) > 0 && (
                        <div className="px-4 py-2.5 flex justify-between">
                          <span className="text-gray-400">Energía Reactiva</span>
                          <span className="font-mono text-gray-200">{fmtEur(ex.reactivaEur)}</span>
                        </div>
                      )}
                      {Math.abs(ex.capacitivaEur || 0) > 0 && (
                        <div className="px-4 py-2.5 flex justify-between">
                          <span className="text-gray-400">Energía Capacitiva</span>
                          <span className="font-mono text-gray-200">{fmtEur(ex.capacitivaEur)}</span>
                        </div>
                      )}
                      <div className="px-4 py-2.5 flex justify-between bg-white/[0.02] font-medium">
                        <span className="text-gray-200">Subtotal Peajes ATR</span>
                        <span className="font-mono text-white">{fmtEur(file.totalPeajes)}</span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between bg-white/[0.02] font-medium">
                        <span className="text-gray-200">Subtotal Cargos Normativos</span>
                        <span className="font-mono text-white">{fmtEur(file.totalCargos)}</span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between">
                        <span className="text-gray-400">Alquiler de Equipo de Medida</span>
                        <span className="font-mono text-gray-200">{fmtEur(ex.alquileresEur)}</span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between">
                        <span className="text-gray-400">
                          Impuesto Eléctrico
                          {ex.impuestoElectricoPct ? ` (${fmtNum(ex.impuestoElectricoPct, 4)}%)` : ''}
                        </span>
                        <span className="font-mono text-gray-200">{fmtEur(ex.impuestoElectricoEur)}</span>
                      </div>
                    </>
                  )}

                  {ex.conceptosRepercutiblesDetalle && ex.conceptosRepercutiblesDetalle.length > 0 && (
                    <div className="px-4 py-2.5 space-y-1.5">
                      <div className="text-gray-300 font-medium">Conceptos Repercutibles / Fianzas</div>
                      {ex.conceptosRepercutiblesDetalle.map((c, idx) => (
                        <div key={idx} className="flex justify-between text-gray-400 pl-3">
                          <span>
                            [{c.codigo}] {c.descripcion}
                            {c.fechaOperacion ? ` (${fmtIsoDate(c.fechaOperacion)})` : ''}
                          </span>
                          <span className="font-mono text-gray-200">{fmtEur(c.importeTotal)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="px-4 py-2.5 flex justify-between bg-white/[0.03] font-semibold">
                    <span className="text-gray-100">Base Imponible F1</span>
                    <span className="font-mono text-white">{fmtEur(file.baseImponible)}</span>
                  </div>

                  {ex.impuestosDetalle && ex.impuestosDetalle.length > 0 ? (
                    ex.impuestosDetalle.map((tb, idx) => (
                      <div key={idx} className="px-4 py-2 flex justify-between">
                        <span className="text-gray-400">
                          {tb.tipo} ({fmtNum(tb.porcentaje, 2)}% s/ {fmtEur(tb.baseImponible)})
                        </span>
                        <span className="font-mono text-gray-200">{fmtEur(tb.importe)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-2 flex justify-between">
                      <span className="text-gray-400">Impuestos (IVA / IGIC)</span>
                      <span className="font-mono text-gray-200">{fmtEur(ex.ivaEur)}</span>
                    </div>
                  )}

                  <div className="px-4 py-3 flex justify-between items-center bg-[rgba(222,255,154,0.06)]">
                    <span className="text-sm font-bold text-white">TOTAL FACTURA F1</span>
                    <div className="text-right">
                      <div
                        className={`font-mono text-base font-bold ${
                          (file.saldoFactura || 0) < 0 ? 'text-green-400' : 'text-[var(--lime)]'
                        }`}
                      >
                        {fmtEur(file.saldoFactura)}
                      </div>
                      {file.hasDistinctSaldo && file.saldoFacturaXml !== null && (
                        <div className="text-[11px] text-amber-300 font-mono">
                          Saldo liquidación distribuidora: {fmtEur(file.saldoFacturaXml)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {ex.comentarios && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                  <span className="font-semibold uppercase text-[10px] text-blue-300 block mb-1">
                    Observaciones / Comentarios Distribuidora
                  </span>
                  {ex.comentarios}
                </div>
              )}
            </>
          )}

          {activeTab === 'periodos' && (
            <div className="space-y-5">
              {/* Energía por periodos */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-base)]">
                <div className="px-4 py-2.5 bg-white/[0.03] border-b border-[var(--border)] text-xs font-semibold uppercase text-gray-300 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[var(--lime)]" />
                  Término de Energía Activa por Periodo
                </div>
                {ex.energiaPeriodos && ex.energiaPeriodos.length > 0 ? (
                  <table className="w-full text-xs text-left">
                    <thead className="text-gray-400 border-b border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-2">Periodo</th>
                        <th className="px-4 py-2">Subperiodo</th>
                        <th className="px-4 py-2 text-right">Consumo (kWh)</th>
                        <th className="px-4 py-2 text-right">Precio Peaje (€/kWh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {ex.energiaPeriodos.map((ep, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-mono font-semibold text-[var(--lime)]">
                            {ep.periodo}
                          </td>
                          <td className="px-4 py-2 text-gray-400">
                            {ep.fechaDesde && ep.fechaHasta
                              ? `${fmtIsoDate(ep.fechaDesde)} - ${fmtIsoDate(ep.fechaHasta)}`
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-white">
                            {fmtNum(ep.energiaKwh, 3)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-gray-300">
                            {fmtNum(ep.precioKwh, 6)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-xs text-gray-500">Sin periodos de energía activa.</div>
                )}
              </div>

              {/* Potencia por periodos */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-base)]">
                <div className="px-4 py-2.5 bg-white/[0.03] border-b border-[var(--border)] text-xs font-semibold uppercase text-gray-300 flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  Término de Potencia por Periodo
                </div>
                {ex.potenciaPeriodos && ex.potenciaPeriodos.length > 0 ? (
                  <table className="w-full text-xs text-left">
                    <thead className="text-gray-400 border-b border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-2">Periodo</th>
                        <th className="px-4 py-2">Subperiodo</th>
                        <th className="px-4 py-2 text-right">Contratada (kW)</th>
                        <th className="px-4 py-2 text-right">Facturada (kW)</th>
                        <th className="px-4 py-2 text-right">Maxímetro (kW)</th>
                        <th className="px-4 py-2 text-right">Peaje (€/kW·día)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {ex.potenciaPeriodos.map((pp, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-mono font-semibold text-cyan-300">
                            {pp.periodo}
                          </td>
                          <td className="px-4 py-2 text-gray-400">
                            {pp.fechaDesde && pp.fechaHasta
                              ? `${fmtIsoDate(pp.fechaDesde)} - ${fmtIsoDate(pp.fechaHasta)}`
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-gray-200">
                            {fmtNum(pp.potenciaContratadaKw, 2)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-white">
                            {fmtNum(pp.potenciaAFacturarKw, 2)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-gray-400">
                            {fmtNum(pp.potenciaMaxDemandadaKw, 2)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-gray-300">
                            {fmtNum(pp.precioKwDia, 6)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-xs text-gray-500">Sin periodos de potencia.</div>
                )}
              </div>

              {/* Cargos detalle */}
              {ex.cargosDetalle && ex.cargosDetalle.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-base)]">
                  <div className="px-4 py-2.5 bg-white/[0.03] border-b border-[var(--border)] text-xs font-semibold uppercase text-gray-300">
                    Desglose de Cargos Normativos
                  </div>
                  <div className="divide-y divide-[var(--border)] text-xs">
                    {ex.cargosDetalle.map((cd, i) => (
                      <div key={i} className="px-4 py-2.5 flex justify-between">
                        <span className="text-gray-300">
                          {cd.etiqueta}
                          {cd.fechaDesde && cd.fechaHasta
                            ? ` (${fmtIsoDate(cd.fechaDesde)} - ${fmtIsoDate(cd.fechaHasta)})`
                            : ''}
                        </span>
                        <span className="font-mono text-white">{fmtEur(cd.importeTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'json' && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4">
              {loadingRaw ? (
                <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--lime)]" />
                  Cargando estructura XML completa...
                </div>
              ) : (
                <pre className="text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-[55vh]">
                  {JSON.stringify(rawJson || file.extracted, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
