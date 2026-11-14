'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  Search,
  Download,
  Calculator,
  Copy,
  RefreshCw,
  ShieldAlert,
  Zap,
  MapPin,
  Building2,
  Activity,
  Gauge,
  FileSpreadsheet,
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import { useBrandTheme } from '@/context/BrandThemeContext';
import {
  buildIngebauConsumosCsv,
  buildIngebauPsCsv,
  triggerBrowserCsvDownload,
} from '@/lib/sipsCsvExporter';

type SipsTab = 'general' | 'activa' | 'reactiva' | 'maximetro';

const RECENT_CUPS_STORAGE_KEY = 'sp_erp_recent_sips_cups';

function formatEsDate(isoOrRaw: unknown): string {
  if (!isoOrRaw) return '—';
  const str = String(isoOrRaw).trim();
  if (!str) return '—';
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return str;
}

function parseIsoMs(isoOrRaw: unknown): number {
  if (!isoOrRaw) return 0;
  const str = String(isoOrRaw).trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatIntEs(val: unknown): string {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('es-ES');
}

function formatDecEs(val: unknown, decimals: number = 2): string {
  if (val === null || val === undefined || val === '') return '—';
  const n = Number(String(val).replace(',', '.'));
  if (!Number.isFinite(n)) return String(val);
  return n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function describeAutoconsumo(code: unknown): string {
  const c = String(code ?? '').trim().toUpperCase();
  if (!c || c === '0' || c === '00') return '00 · Sin autoconsumo';
  const map: Record<string, string> = {
    '31': '31 · Sin excedentes (individual)',
    '32': '32 · Sin excedentes (colectivo)',
    '41': '41 · Con excedentes acogido a compensación (individual)',
    '42': '42 · Con excedentes acogido a compensación (colectivo)',
    '43': '43 · Con excedentes acogido a compensación a través de red',
    '51': '51 · Con excedentes no acogido a compensación (individual)',
    '52': '52 · Con excedentes no acogido a compensación (colectivo)',
    '2A': '2A · Tipo 2A (con excedentes)',
    '2B': '2B · Tipo 2B (con excedentes)',
  };
  return map[c] || c;
}

function getReadingBadgeInfo(row: any): { kind: 'REAL' | 'ESTIMADO'; detail: string } {
  const code = String(row?.codigoTipoLectura ?? '').trim();
  const label = String(row?.TipoLectura ?? '').trim();
  if (code === '20' || code === '40' || code === '70' || code === '99' || label.toLowerCase().includes('estim')) {
    return { kind: 'ESTIMADO', detail: label || 'Estimada' };
  }
  if (code === '60' || label.toLowerCase().includes('telegest')) {
    return { kind: 'REAL', detail: 'Telegestión' };
  }
  return { kind: 'REAL', detail: label || 'Real' };
}

function ConsultaCupsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const brand = useBrandTheme();

  const userRole = (session?.user as any)?.role || 'CANAL';
  const canAccessPricing = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);

  const [cupsInput, setCupsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sipsPayload, setSipsPayload] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<SipsTab>('general');
  const [recentCups, setRecentCups] = useState<string[]>([]);
  const [showFullLegal, setShowFullLegal] = useState(true);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(RECENT_CUPS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecentCups(parsed.slice(0, 6));
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }, []);

  const pushRecentCups = useCallback((cups: string) => {
    setRecentCups((prev) => {
      const next = [cups, ...prev.filter((c) => c !== cups)].slice(0, 6);
      try {
        sessionStorage.setItem(RECENT_CUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore sessionStorage errors
      }
      return next;
    });
  }, []);

  const executeLookup = useCallback(
    async (targetCups: string, forceRefresh: boolean = false) => {
      const clean = targetCups.trim().toUpperCase().replace(/\s+/g, '');
      if (!clean || clean.length < 20) {
        toast.error('Introduce un código CUPS válido (mínimo 20 caracteres, ej. ES0031...)');
        return;
      }

      setCupsInput(clean);
      setLoading(true);
      setErrorMsg('');

      try {
        const qs = new URLSearchParams({ cups: clean });
        if (forceRefresh) qs.set('refresh', '1');

        const res = await fetch(`/api/sips?${qs.toString()}`, {
          method: 'GET',
          cache: 'no-store',
        });
        const json = await res.json();

        if (!res.ok || !json?.success || !json?.data) {
          const msg = json?.message || `No se encontraron datos SIPS para ${clean}`;
          setErrorMsg(msg);
          setSipsPayload(null);
          toast.error(msg);
          return;
        }

        setSipsPayload(json.data);
        setShowFullLegal(false);
        const resolvedCups = json.data?.data?.ps?.[0]?.CUPS || clean;
        pushRecentCups(resolvedCups);
        toast.success(`SIPS cargado: ${resolvedCups}`);
      } catch (err: any) {
        const msg = err?.message || 'Error de conexión al consultar SIPS';
        setErrorMsg(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [pushRecentCups]
  );

  // Auto-consulta si venimos con ?cups=ES...
  const urlCups = searchParams.get('cups');
  useEffect(() => {
    if (urlCups && urlCups.trim().length >= 20) {
      const clean = urlCups.trim().toUpperCase().replace(/\s+/g, '');
      setCupsInput(clean);
      executeLookup(clean, false);
    }
  }, [urlCups, executeLookup]);

  const ps: Record<string, any> | null = useMemo(() => {
    const arr = sipsPayload?.data?.ps;
    if (Array.isArray(arr) && arr.length > 0) return arr[0];
    return null;
  }, [sipsPayload]);

  const consumos: Record<string, any>[] = useMemo(() => {
    const arr = sipsPayload?.data?.consumos;
    return Array.isArray(arr) ? arr : [];
  }, [sipsPayload]);

  // Resumen anual de reactiva (últimos 365 días desde la última lectura)
  const reactiveAnnualSummary = useMemo(() => {
    let maxEndMs = 0;
    for (const r of consumos) {
      const endMs = parseIsoMs(r?.LecturaHasta);
      if (endMs > maxEndMs) maxEndMs = endMs;
    }
    const cutoffMs = maxEndMs > 0 ? maxEndMs - 365 * 86_400_000 : 0;
    const sums = [0, 0, 0, 0, 0, 0];

    for (const r of consumos) {
      const startMs = parseIsoMs(r?.LecturaDesde);
      const endMs = parseIsoMs(r?.LecturaHasta);
      if (maxEndMs > 0 && startMs >= cutoffMs && endMs <= maxEndMs) {
        for (let i = 0; i < 6; i++) {
          sums[i] += Number(r?.[`EnergíaReactivaP${i + 1}(Varh)`] ?? 0);
        }
      }
    }
    const total = sums.reduce((acc, v) => acc + v, 0);
    return { periods: sums, total };
  }, [consumos]);

  // Picos máximos demandados en lecturas de maxímetro
  const maximeterPeaks = useMemo(() => {
    const peaks = [0, 0, 0, 0, 0, 0];
    for (const r of consumos) {
      for (let i = 0; i < 6; i++) {
        const v = Number(r?.[`MaxímetroP${i + 1}(kW)`] ?? 0);
        if (Number.isFinite(v) && v > peaks[i]) peaks[i] = v;
      }
    }
    return peaks;
  }, [consumos]);

  const contractedPowers = useMemo(() => {
    if (!ps) return [0, 0, 0, 0, 0, 0];
    return [1, 2, 3, 4, 5, 6].map((idx) => {
      const n = Number(String(ps[`PotenciaContratadaP${idx}kW`] ?? 0).replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    });
  }, [ps]);

  const handleDownloadConsumosCsv = () => {
    if (!sipsPayload || !ps) return;
    const csv = buildIngebauConsumosCsv(sipsPayload);
    const filename = `${ps.CUPS || cupsInput}_consumos.csv`;
    triggerBrowserCsvDownload(csv, filename);
    toast.success(`Descargado ${filename} (formato SIPS Cotizador)`);
  };

  const handleDownloadPsCsv = () => {
    if (!sipsPayload || !ps) return;
    const csv = buildIngebauPsCsv(sipsPayload);
    const filename = `${ps.CUPS || cupsInput}_ps.csv`;
    triggerBrowserCsvDownload(csv, filename);
    toast.success(`Descargado ${filename}`);
  };

  const handleCopyCups = async () => {
    const target = ps?.CUPS || cupsInput;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      toast.success(`CUPS ${target} copiado al portapapeles`);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  if (userRole === 'CLIENT') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Topbar title="Consulta de CUPS" />
        <div style={{ padding: '48px 24px', maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <ShieldAlert size={48} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Acceso Restringido</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            La consulta a la base de datos SIPS está reservada exclusivamente a agentes autorizados y personal interno de la comercializadora.
          </p>
        </div>
      </div>
    );
  }

  const isContratable = String(ps?.codigoPSContratable ?? '1') !== '0';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '48px' }}>
      <Topbar
        title="Consulta de CUPS (SIPS)"
        subtitle="Sistema de Información de Puntos de Suministro (CNMC) · Datos técnicos, consumos y maxímetros"
      />

      <div
        style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}
        className="space-y-5 animate-in fade-in duration-300"
      >
        {/* BUSCADOR DE CUPS */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '20px 24px',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeLookup(cupsInput, false);
            }}
            className="flex flex-col md:flex-row gap-3 items-stretch md:items-center"
          >
            <label
              htmlFor="sips-cups-input"
              style={{
                fontWeight: 700,
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                letterSpacing: '0.03em',
                minWidth: '58px',
              }}
            >
              CUPS
            </label>

            <div className="relative flex-1">
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="sips-cups-input"
                type="text"
                value={cupsInput}
                onChange={(e) => setCupsInput(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                placeholder="Ej: ES0031101457409001HM o ES0031104143948003DH0F"
                maxLength={25}
                className="form-input font-mono-nums"
                style={{
                  width: '100%',
                  padding: '11px 16px 11px 42px',
                  fontSize: '0.95rem',
                  letterSpacing: '0.04em',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  padding: '11px 22px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  minWidth: '140px',
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? 'Consultando...' : 'Buscar'}
              </button>

              {sipsPayload && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => executeLookup(cupsInput, true)}
                  title="Forzar consulta directa sin caché"
                  style={{
                    padding: '11px 14px',
                    borderRadius: '10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: loading ? 'wait' : 'pointer',
                  }}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
          </form>

          {/* Consultas recientes en la sesión */}
          {recentCups.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Recientes:
              </span>
              {recentCups.map((rc) => (
                <button
                  key={rc}
                  type="button"
                  disabled={loading}
                  onClick={() => executeLookup(rc, false)}
                  className="font-mono-nums transition-colors"
                  style={{
                    fontSize: '0.74rem',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: ps?.CUPS === rc ? 'var(--lime-glow)' : 'var(--bg-surface)',
                    border: `1px solid ${ps?.CUPS === rc ? 'var(--lime)' : 'var(--border)'}`,
                    color: ps?.CUPS === rc ? 'var(--lime)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {rc}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div
              className="mt-4 flex items-center gap-3"
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
              }}
            >
              <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--lime)', flexShrink: 0 }} />
              <span>
                Consultando base de datos nacional SIPS (CNMC) en la nube corporativa. La primera lectura de un CUPS puede tardar unos segundos...
              </span>
            </div>
          )}

          {errorMsg && !loading && (
            <div
              className="mt-4 flex items-center gap-3"
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontSize: '0.87rem',
              }}
            >
              <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* AVISO LEGAL REGLAMENTARIO CNMC / LEY 24/2013 */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px 18px',
          }}
        >
          <div
            onClick={() => setShowFullLegal((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Aviso Legal y Confidencialidad SIPS · Ley 24/2013 del Sector Eléctrico y RD 1435/2002
              </span>
            </div>
            <button
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
            >
              {showFullLegal ? (
                <>
                  Contraer <ChevronUp size={14} />
                </>
              ) : (
                <>
                  Ver texto legal <ChevronDown size={14} />
                </>
              )}
            </button>
          </div>

          {showFullLegal && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border)',
                fontSize: '0.75rem',
                lineHeight: 1.55,
                color: 'var(--text-muted)',
              }}
              className="space-y-2"
            >
              <p style={{ margin: 0 }}>
                De conformidad con lo dispuesto en la Ley 24/2013, de 26 de diciembre, del Sector Eléctrico, Real Decreto 1011/2009, de 19 de junio, por el que se regula la Oficina de Cambios de Suministrador, así como en el Real Decreto 1435/2002, de 27 de diciembre, {brand.name || 'la comercializadora'}, inscrita en el Registro Administrativo de Comercializadores de Energía Eléctrica, informa que los datos facilitados en el presente formulario sobre los puntos de suministro tienen carácter estrictamente técnico, no conteniendo información personal del titular y siendo su única finalidad proporcionar la información necesaria para la gestión de contratación y cambio de comercializador.
              </p>
              <p style={{ margin: 0 }}>
                Dicha información se encuentra protegida mediante identificación, autenticación y registro de accesos que permite auditar en todo momento las consultas realizadas. La información expuesta tiene carácter estrictamente confidencial, estando restringido su uso al personal y red de agentes autorizados, no pudiendo ser comunicada a terceros bajo ningún concepto ni utilizada para una finalidad distinta a la descrita anteriormente.{' '}
                <strong style={{ color: 'var(--text-secondary)' }}>
                  La consulta solo podrá realizarse de forma individualizada por punto de suministro y la utilización de esta herramienta implica la aceptación íntegra de las presentes condiciones de uso.
                </strong>
              </p>
            </div>
          )}
        </div>

        {/* RESULTADOS DE LA CONSULTA */}
        {ps && (
          <>
            {/* BARRA SUPERIOR DE KPIs + ACCIONES RÁPIDAS */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '20px 24px',
              }}
              className="space-y-4"
            >
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="font-mono-nums"
                      style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em' }}
                    >
                      {ps.CUPS}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCups}
                      title="Copiar CUPS"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.73rem',
                      }}
                    >
                      <Copy size={12} /> Copiar
                    </button>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: 'var(--lime-glow)',
                        border: '1px solid var(--lime)',
                        color: 'var(--lime)',
                      }}
                    >
                      Tarifa {ps.TarifaATR || '—'}
                    </span>

                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: isContratable ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        border: `1px solid ${isContratable ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                        color: isContratable ? '#4ade80' : '#f87171',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isContratable ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {isContratable ? 'Contratable' : 'No contratable'}
                    </span>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2"
                    style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} style={{ color: 'var(--lime)' }} />
                      {[ps.CódigoPostalPS, ps.MunicipioPS].filter(Boolean).join(' · ')}
                      {ps.ProvinciaPS ? ` (${ps.ProvinciaPS})` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 size={14} style={{ color: 'var(--info)' }} />
                      {ps.CódigoDistribuidora ? `${ps.CódigoDistribuidora} - ` : ''}
                      {ps.NombreDistribuidora || 'Distribuidora no especificada'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Activity size={14} style={{ color: 'var(--success)' }} />
                      Consumo anual: <strong style={{ color: 'var(--text-primary)' }}>{formatDecEs(ps.ConsumoAnualkWh, 2)} kWh</strong> ({consumos.length} lecturas)
                    </span>
                  </div>
                </div>

                {/* BOTONES DE EXPORTACIÓN CSV Y ACCIONES ERP */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadConsumosCsv}
                    title="Descarga el CSV de lecturas idéntico a Ingebau para subirlo al Cotizador SIPS CSV"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--lime)',
                      color: 'var(--lime)',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={15} />
                    CSV Consumos (Cotizador)
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPsCsv}
                    title="Descarga el CSV de 36 columnas con las características técnicas del Punto de Suministro"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-primary)',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <FileSpreadsheet size={15} />
                    CSV Datos PS
                  </button>

                  {canAccessPricing && (
                    <button
                      type="button"
                      onClick={() => router.push(`/pricing?cups=${encodeURIComponent(ps.CUPS)}`)}
                      className="btn-primary"
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Calculator size={15} />
                      Cotizar CUPS
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      handleCopyCups();
                      router.push('/leads');
                    }}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--text-secondary)',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <UserPlus size={15} />
                    Ir a Leads
                  </button>
                </div>
              </div>

              {/* PESTAÑAS ESTILO SIPS (Datos generales | Lecturas de activa | Lecturas de reactiva | Lecturas de maxímetro) */}
              <div
                className="flex flex-wrap gap-1.5 pt-3"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                {(
                  [
                    { id: 'general', label: 'Datos generales', icon: Zap },
                    { id: 'activa', label: 'Lecturas de activa', icon: Activity },
                    { id: 'reactiva', label: 'Lecturas de reactiva', icon: RefreshCw },
                    { id: 'maximetro', label: 'Lecturas de maxímetro', icon: Gauge },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '10px',
                        fontSize: '0.84rem',
                        fontWeight: active ? 700 : 500,
                        background: active ? 'var(--lime-glow)' : 'var(--bg-surface)',
                        border: `1px solid ${active ? 'var(--lime)' : 'var(--border)'}`,
                        color: active ? 'var(--lime)' : 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon size={15} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CONTENIDO PESTAÑA 1: DATOS GENERALES */}
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Columna Izquierda: Identificación, Ubicación y Potencias */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '22px 24px',
                  }}
                  className="space-y-4"
                >
                  <h3
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                      paddingBottom: '10px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    Identificación y Potencias del Suministro
                  </h3>

                  <div className="space-y-2.5">
                    <FieldRow label="CUPS" value={ps.CUPS} mono />
                    <FieldRow
                      label="Empresa distribuidora"
                      value={[ps.CódigoDistribuidora, ps.NombreDistribuidora].filter(Boolean).join(' · ') || '—'}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        Población de suministro
                      </span>
                      <div className="sm:col-span-2 flex gap-2">
                        <span
                          className="font-mono-nums"
                          style={{
                            padding: '7px 11px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            fontSize: '0.83rem',
                            color: 'var(--text-primary)',
                            minWidth: '74px',
                            textAlign: 'center',
                          }}
                        >
                          {ps.CódigoPostalPS || '—'}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            padding: '7px 12px',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            fontSize: '0.83rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {ps.MunicipioPS || '—'}
                        </span>
                      </div>
                    </div>
                    <FieldRow label="Provincia de suministro" value={ps.ProvinciaPS || '—'} />
                    <FieldRow label="Tarifa" value={ps.TarifaATR || '—'} highlight />

                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border)',
                      }}
                      className="space-y-2"
                    >
                      {[1, 2, 3, 4, 5, 6].map((pIdx) => (
                        <FieldRow
                          key={pIdx}
                          label={`Potencia contratada P${pIdx}`}
                          value={`${formatDecEs(ps[`PotenciaContratadaP${pIdx}kW`] ?? 0, 3)} kW`}
                          mono
                        />
                      ))}
                    </div>

                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border)',
                      }}
                      className="space-y-2"
                    >
                      <FieldRow
                        label="Potencia máxima instalación (BIE)"
                        value={ps['PotenciaMaxBIE(kW)'] ? `${formatDecEs(ps['PotenciaMaxBIE(kW)'], 3)} kW` : '—'}
                        mono
                      />
                      <FieldRow
                        label="Potencia máxima acta (APM)"
                        value={ps['potenciaMaximaAPM(KW)'] ? `${formatDecEs(ps['potenciaMaximaAPM(KW)'], 3)} kW` : '—'}
                        mono
                      />
                      <FieldRow
                        label="Derechos de extensión / acceso"
                        value={`${ps.valorDerechosExtensionkW ? `${formatDecEs(ps.valorDerechosExtensionkW, 3)} kW` : '—'}  /  ${
                          ps.valorDerechosAccesokW ? `${formatDecEs(ps.valorDerechosAccesokW, 3)} kW` : '—'
                        }`}
                        mono
                      />
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Características Técnicas, Fechas y Equipo de Medida */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '22px 24px',
                  }}
                  className="space-y-4"
                >
                  <h3
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                      paddingBottom: '10px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    Características Técnicas, Fechas y Medida
                  </h3>

                  <div className="space-y-2.5">
                    <FieldRow label="Tensión de suministro" value={ps.Tension || '—'} />
                    <FieldRow
                      label="Tipo de punto de medida"
                      value={
                        ps.codigoClasificacionPS
                          ? `${ps.codigoClasificacionPS} (${ps.TipoPM || ''})`
                          : ps.TipoPM || '—'
                      }
                    />
                    <FieldRow
                      label="Última modificación de contrato"
                      value={formatEsDate(ps.fechaUltimoMovimientoContrato)}
                      mono
                    />
                    <FieldRow
                      label="Último cambio de comercializadora"
                      value={formatEsDate(ps.fechaUltimoCambioComercializador)}
                      mono
                    />
                    <FieldRow label="Última lectura" value={formatEsDate(ps.fechaUltimaLectura)} mono />
                    <FieldRow label="Alta de suministro" value={formatEsDate(ps.FechaAltaPS)} mono />
                    <FieldRow
                      label="Límite derechos reconocidos"
                      value={formatEsDate(ps.fechaLimiteDerechosReconocidos)}
                      mono
                    />

                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border)',
                      }}
                      className="space-y-2.5"
                    >
                      <FieldRow label="Propiedad ICP" value={ps.codigoPropiedadICP || '—'} />
                      <FieldRow label="Propiedad Contador (EM)" value={ps['Propietario EM'] || '—'} />
                      <FieldRow label="Telegestión" value={ps.codigoTelegestion || '—'} />
                      <FieldRow
                        label="Trans./Rel. de Intensidad"
                        value={ps.relacionTransformacionIntensidad || '—'}
                      />
                      <FieldRow label="Autoconsumo" value={describeAutoconsumo(ps.codigoAutoconsumo)} />
                      <FieldRow label="CNAE" value={ps.CNAE || '—'} mono />
                      <FieldRow
                        label="Vivienda habitual / Bono Social"
                        value={`Vivienda habitual: ${
                          String(ps.esViviendaHabitual).toUpperCase() === 'S' || ps.esViviendaHabitual === '1'
                            ? 'Sí'
                            : 'No'
                        }  ·  Bono Social: ${
                          ps.aplicacionBonoSocial && ps.aplicacionBonoSocial !== '0' ? 'Sí' : 'No'
                        }`}
                      />
                      {!isContratable && ps.motivoEstadoNoContratable && (
                        <FieldRow
                          label="Motivo no contratable"
                          value={ps.motivoEstadoNoContratable}
                          highlight
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO PESTAÑA 2: LECTURAS DE ACTIVA */}
            {activeTab === 'activa' && (
              <div className="space-y-5">
                {/* Consumo anual estimado */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Consumo anual estimado (últimos 365 días cerrados)
                    </h3>
                    {Number(ps.ConsumoAnualAnterior) > 0 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Año móvil anterior:{' '}
                        <strong className="font-mono-nums" style={{ color: 'var(--text-primary)' }}>
                          {formatDecEs(ps.ConsumoAnualAnterior, 2)} kWh
                        </strong>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((pIdx) => {
                      const val = Number(ps[`ConsumoAnualP${pIdx}kWh`] ?? 0);
                      return (
                        <div
                          key={pIdx}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '12px 14px',
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Periodo P{pIdx}
                          </div>
                          <div
                            className="font-mono-nums"
                            style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}
                          >
                            {formatDecEs(val, 2)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>kWh</div>
                        </div>
                      );
                    })}

                    <div
                      style={{
                        background: 'var(--lime-glow)',
                        border: '1px solid var(--lime)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--lime)', fontWeight: 700 }}>
                        TOTAL ANUAL
                      </div>
                      <div
                        className="font-mono-nums"
                        style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}
                      >
                        {formatDecEs(ps.ConsumoAnualkWh ?? 0, 2)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--lime)' }}>kWh</div>
                    </div>
                  </div>
                </div>

                {/* Tabla Últimas lecturas de activa */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Últimas lecturas de energía activa ({consumos.length} registros)
                    </h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Unidades en kWh</span>
                  </div>

                  {consumos.length === 0 ? (
                    <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No constan lecturas históricas de consumo para este punto de suministro en SIPS.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                            <th style={thLeftStyle}>Fecha</th>
                            <th style={thLeftStyle}>Periodo</th>
                            <th style={thLeftStyle}>Tipo</th>
                            <th style={thLeftStyle}>Tarifa</th>
                            <th style={thRightStyle}>Consumo P1</th>
                            <th style={thRightStyle}>Consumo P2</th>
                            <th style={thRightStyle}>Consumo P3</th>
                            <th style={thRightStyle}>Consumo P4</th>
                            <th style={thRightStyle}>Consumo P5</th>
                            <th style={thRightStyle}>Consumo P6</th>
                            <th style={thRightStyle}>Total kWh</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consumos.map((row, idx) => {
                            const badge = getReadingBadgeInfo(row);
                            const p1 = Number(row['EnergiaActivaP1(kWh)'] ?? 0);
                            const p2 = Number(row['EnergiaActivaP2(kWh)'] ?? 0);
                            const p3 = Number(row['EnergiaActivaP3(kWh)'] ?? 0);
                            const p4 = Number(row['EnergiaActivaP4(kWh)'] ?? 0);
                            const p5 = Number(row['EnergiaActivaP5(kWh)'] ?? 0);
                            const p6 = Number(row['EnergiaActivaP6(kWh)'] ?? 0);
                            const rowTotal = p1 + p2 + p3 + p4 + p5 + p6;
                            return (
                              <tr
                                key={`${row.LecturaDesde}-${row.LecturaHasta}-${idx}`}
                                style={{
                                  borderBottom: '1px solid var(--border)',
                                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                }}
                              >
                                <td style={tdLeftMonoStyle}>{formatEsDate(row.LecturaHasta)}</td>
                                <td style={{ ...tdLeftMonoStyle, color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                                  {formatEsDate(row.LecturaDesde)} → {formatEsDate(row.LecturaHasta)}
                                </td>
                                <td style={tdLeftStyle}>
                                  <ReadingTypeBadge kind={badge.kind} detail={badge.detail} />
                                </td>
                                <td style={{ ...tdLeftMonoStyle, color: 'var(--text-secondary)' }}>{row.TarifaATR || '—'}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(p1)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(p2)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(p3)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(p4)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(p5)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(p6)}</td>
                                <td style={{ ...tdRightMonoStyle, fontWeight: 700, color: 'var(--lime)' }}>
                                  {formatIntEs(rowTotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CONTENIDO PESTAÑA 3: LECTURAS DE REACTIVA */}
            {activeTab === 'reactiva' && (
              <div className="space-y-5">
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                  }}
                >
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                    Consumo anual estimado de reactiva (últimos 365 días cerrados)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {reactiveAnnualSummary.periods.map((val, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Periodo P{idx + 1}
                        </div>
                        <div
                          className="font-mono-nums"
                          style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}
                        >
                          {formatIntEs(val)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Varh</div>
                      </div>
                    ))}

                    <div
                      style={{
                        background: 'var(--lime-glow)',
                        border: '1px solid var(--lime)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--lime)', fontWeight: 700 }}>
                        TOTAL REACTIVA
                      </div>
                      <div
                        className="font-mono-nums"
                        style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}
                      >
                        {formatIntEs(reactiveAnnualSummary.total)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--lime)' }}>Varh</div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Últimas lecturas de energía reactiva ({consumos.length} registros)
                    </h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Unidades en Varh</span>
                  </div>

                  {consumos.length === 0 ? (
                    <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No constan lecturas históricas para este punto de suministro en SIPS.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                            <th style={thLeftStyle}>Fecha</th>
                            <th style={thLeftStyle}>Tipo</th>
                            <th style={thRightStyle}>Consumo P1</th>
                            <th style={thRightStyle}>Consumo P2</th>
                            <th style={thRightStyle}>Consumo P3</th>
                            <th style={thRightStyle}>Consumo P4</th>
                            <th style={thRightStyle}>Consumo P5</th>
                            <th style={thRightStyle}>Consumo P6</th>
                            <th style={thRightStyle}>Total Varh</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consumos.map((row, idx) => {
                            const badge = getReadingBadgeInfo(row);
                            const r1 = Number(row['EnergíaReactivaP1(Varh)'] ?? 0);
                            const r2 = Number(row['EnergíaReactivaP2(Varh)'] ?? 0);
                            const r3 = Number(row['EnergíaReactivaP3(Varh)'] ?? 0);
                            const r4 = Number(row['EnergíaReactivaP4(Varh)'] ?? 0);
                            const r5 = Number(row['EnergíaReactivaP5(Varh)'] ?? 0);
                            const r6 = Number(row['EnergíaReactivaP6(Varh)'] ?? 0);
                            const rTot = r1 + r2 + r3 + r4 + r5 + r6;
                            return (
                              <tr
                                key={`reac-${row.LecturaDesde}-${row.LecturaHasta}-${idx}`}
                                style={{
                                  borderBottom: '1px solid var(--border)',
                                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                }}
                              >
                                <td style={tdLeftMonoStyle}>{formatEsDate(row.LecturaHasta)}</td>
                                <td style={tdLeftStyle}>
                                  <ReadingTypeBadge kind={badge.kind} detail={badge.detail} />
                                </td>
                                <td style={tdRightMonoStyle}>{formatIntEs(r1)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(r2)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(r3)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(r4)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(r5)}</td>
                                <td style={tdRightMonoStyle}>{formatIntEs(r6)}</td>
                                <td style={{ ...tdRightMonoStyle, fontWeight: 700 }}>{formatIntEs(rTot)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CONTENIDO PESTAÑA 4: LECTURAS DE MAXÍMETRO */}
            {activeTab === 'maximetro' && (
              <div className="space-y-5">
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Potencia Contratada vs. Pico Máximo Registrado (kW)
                    </h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Se resaltan en ámbar los excesos sobre potencia contratada
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const contracted = contractedPowers[idx];
                      const peak = maximeterPeaks[idx];
                      const exceeded = contracted > 0 && peak > contracted;
                      return (
                        <div
                          key={idx}
                          style={{
                            background: exceeded ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-surface)',
                            border: `1px solid ${exceeded ? 'rgba(245, 158, 11, 0.45)' : 'var(--border)'}`,
                            borderRadius: '12px',
                            padding: '12px 14px',
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            Periodo P{idx + 1}
                          </div>
                          <div
                            className="font-mono-nums"
                            style={{
                              fontSize: '1rem',
                              fontWeight: 700,
                              color: exceeded ? '#fbbf24' : 'var(--text-primary)',
                              marginTop: '4px',
                            }}
                          >
                            {formatDecEs(peak, 3)} kW
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Contratada: {formatDecEs(contracted, 3)} kW
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Últimas lecturas de maxímetro ({consumos.length} registros)
                    </h3>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Unidades en kW</span>
                  </div>

                  {consumos.length === 0 ? (
                    <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No constan lecturas históricas de maxímetro para este punto de suministro en SIPS.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                            <th style={thLeftStyle}>Fecha</th>
                            <th style={thLeftStyle}>Tipo</th>
                            <th style={thRightStyle}>Maxímetro P1</th>
                            <th style={thRightStyle}>Maxímetro P2</th>
                            <th style={thRightStyle}>Maxímetro P3</th>
                            <th style={thRightStyle}>Maxímetro P4</th>
                            <th style={thRightStyle}>Maxímetro P5</th>
                            <th style={thRightStyle}>Maxímetro P6</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consumos.map((row, idx) => {
                            const badge = getReadingBadgeInfo(row);
                            const vals = [1, 2, 3, 4, 5, 6].map((p) => Number(row[`MaxímetroP${p}(kW)`] ?? 0));
                            return (
                              <tr
                                key={`max-${row.LecturaDesde}-${row.LecturaHasta}-${idx}`}
                                style={{
                                  borderBottom: '1px solid var(--border)',
                                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                }}
                              >
                                <td style={tdLeftMonoStyle}>{formatEsDate(row.LecturaHasta)}</td>
                                <td style={tdLeftStyle}>
                                  <ReadingTypeBadge kind={badge.kind} detail={badge.detail} />
                                </td>
                                {vals.map((v, pIdx) => {
                                  const cp = contractedPowers[pIdx];
                                  const over = cp > 0 && v > cp;
                                  return (
                                    <td
                                      key={pIdx}
                                      style={{
                                        ...tdRightMonoStyle,
                                        color: over ? '#fbbf24' : 'var(--text-primary)',
                                        fontWeight: over ? 700 : 400,
                                      }}
                                    >
                                      {formatDecEs(v, 3)}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PIE INFORMATIVO CNMC / DISTRIBUIDORA */}
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                paddingTop: '6px',
              }}
            >
              Los datos mostrados son suministrados directamente por las empresas distribuidoras a través de la CNMC (SIPS2).{' '}
              {brand.name || 'La comercializadora'} declina cualquier responsabilidad sobre eventuales discrepancias de origen en las lecturas publicadas por la distribuidora.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      <span
        className={`sm:col-span-2 ${mono ? 'font-mono-nums' : ''}`}
        style={{
          padding: '7px 12px',
          borderRadius: '8px',
          background: highlight ? 'var(--lime-glow)' : 'var(--bg-surface)',
          border: `1px solid ${highlight ? 'var(--lime)' : 'var(--border)'}`,
          fontSize: '0.83rem',
          fontWeight: highlight ? 700 : 500,
          color: highlight ? 'var(--lime)' : 'var(--text-primary)',
          wordBreak: 'break-word',
        }}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function ReadingTypeBadge({ kind, detail }: { kind: 'REAL' | 'ESTIMADO'; detail: string }) {
  const isReal = kind === 'REAL';
  return (
    <span
      title={detail}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '0.7rem',
        fontWeight: 700,
        background: isReal ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
        border: `1px solid ${isReal ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.35)'}`,
        color: isReal ? '#4ade80' : '#fbbf24',
      }}
    >
      {kind}
    </span>
  );
}

const thLeftStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '11px 14px',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  fontSize: '0.76rem',
  whiteSpace: 'nowrap',
};

const thRightStyle: React.CSSProperties = {
  textAlign: 'right',
  padding: '11px 14px',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  fontSize: '0.76rem',
  whiteSpace: 'nowrap',
};

const tdLeftStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

const tdLeftMonoStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const tdRightMonoStyle: React.CSSProperties = {
  textAlign: 'right',
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

export default function ConsultaCupsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
          <Topbar title="Consulta de CUPS (SIPS)" />
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Cargando módulo SIPS...
          </div>
        </div>
      }
    >
      <ConsultaCupsContent />
    </Suspense>
  );
}
