'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Loader2,
  Building2,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  FileText,
  ExternalLink,
  CheckCircle2,
  Upload,
  CalendarClock,
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import { useBrandTheme } from '@/context/BrandThemeContext';
import toast from 'react-hot-toast';

type MitecoReportId = 'ESCILA' | 'DAFNE';

const MITECO_REPORTS: Array<{
  id: MitecoReportId;
  name: string;
  freq: string;
  desc: string;
}> = [
  {
    id: 'ESCILA',
    name: 'ESCILA (XML Sectores)',
    freq: 'Anual · XML ISO-8859-1',
    desc: 'Estadística de comercialización eléctrica por provincias INE y sectores CNAE oficiales (ORDEN 1..76)',
  },
  {
    id: 'DAFNE',
    name: 'DAFNE / FNEE (Ventas GWh)',
    freq: 'Anual · GWh + PDF Oficial',
    desc: 'Comunicación anual de ventas energéticas (Ley 18/2014 art. 70.2 · SNOEE / FNEE) en GWh con hasta 6 decimales',
  },
];

export default function MitecoClient() {
  const brand = useBrandTheme();

  const [reportType, setReportType] = useState<MitecoReportId>('ESCILA');
  const [year, setYear] = useState<string>(() => String(new Date().getFullYear() - 1));
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [escilaPreview, setEscilaPreview] = useState<any | null>(null);

  const [dafneData, setDafneData] = useState<any | null>(null);
  const [dafneSource, setDafneSource] = useState<'invoiced' | 'cch'>('invoiced');
  const [repNif, setRepNif] = useState<string>('');
  const [overrideGwh, setOverrideGwh] = useState<string>('');
  const [copiedGwh, setCopiedGwh] = useState(false);

  const [companyInfo, setCompanyInfo] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const loadContextAndHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/regulacion/submissions?category=MITECO');
      if (!res.ok) return;
      const data = await res.json();
      setCompanyInfo(data.company || null);
      setSubmissions(data.submissions || []);
    } catch {
      // Silencioso en carga inicial
    }
  }, []);

  useEffect(() => {
    loadContextAndHistory();
    setEscilaPreview(null);
    setDafneData(null);
  }, [brand.name, loadContextAndHistory]);

  useEffect(() => {
    setEscilaPreview(null);
    setDafneData(null);
    setOverrideGwh('');
  }, [reportType, year]);

  const handleEscilaPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/miteco/escila?year=${encodeURIComponent(year)}&preview=true`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Error validando datos de ESCILA');
      }
      setEscilaPreview(data);
      toast.success('Validación ESCILA completada');
    } catch (err: any) {
      toast.error(err.message || 'Error al previsualizar ESCILA');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleEscilaDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/miteco/escila?year=${encodeURIComponent(year)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al generar el XML ESCILA');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `ESCILA_${year}.xml`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success(`Fichero ${filename} generado en codificación ISO-8859-1`);
      await loadContextAndHistory();
    } catch (err: any) {
      toast.error(err.message || 'Error al generar informe ESCILA');
    } finally {
      setLoading(false);
    }
  };

  const handleConsultDafne = async (preferredSource?: 'invoiced' | 'cch') => {
    const src = preferredSource || dafneSource;
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/miteco/dafne?year=${encodeURIComponent(year)}&source=${encodeURIComponent(src)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Error al consultar ventas DAFNE/FNEE');
      }
      setDafneData(data);
      setDafneSource(data.recommendedSource || src);
      setOverrideGwh(data.formattedGwh || '');
      toast.success('Volumen anual de ventas GWh calculado y auditado');
    } catch (err: any) {
      toast.error(err.message || 'Error al obtener datos DAFNE');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadDafnePdf = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year,
        format: 'pdf',
        source: dafneSource,
      });
      if (overrideGwh.trim()) params.set('overrideGwh', overrideGwh.trim());
      if (repNif.trim()) params.set('repNif', repNif.trim());

      const res = await fetch(`/api/miteco/dafne?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error generando el PDF de Declaración Responsable');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = res.headers.get('Content-Disposition');
      let filename = `DEC_RESP_FNEE_${year}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success(`Modelo oficial ${filename} descargado para firma electrónica`);
      await loadContextAndHistory();
    } catch (err: any) {
      toast.error(err.message || 'Error descargando Declaración Responsable');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyGwh = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedGwh(true);
      toast.success(`Valor ${textToCopy} GWh copiado al portapapeles`);
      setTimeout(() => setCopiedGwh(false), 2000);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  const handleToggleSubmitted = async (sub: any) => {
    const nextStatus = sub.status === 'SUBMITTED' ? 'GENERATED' : 'SUBMITTED';
    try {
      const res = await fetch('/api/regulacion/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sub.id, status: nextStatus }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar el estado');
      toast.success(nextStatus === 'SUBMITTED' ? 'Entrega marcada como presentada' : 'Estado revertido a generado');
      await loadContextAndHistory();
    } catch (err: any) {
      toast.error(err.message || 'Error actualizando entrega');
    }
  };

  const handleReceiptUpload = async (subId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingId(subId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'regulacion');

      const upRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const upData = await upRes.json();
      if (!upRes.ok || !upData.url) {
        throw new Error(upData.error || 'Error subiendo justificante');
      }

      const patchRes = await fetch('/api/regulacion/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: subId,
          status: 'SUBMITTED',
          receiptUrl: upData.url,
          receiptName: file.name,
        }),
      });
      if (!patchRes.ok) throw new Error('Error vinculando justificante');

      toast.success('Acuse oficial adjuntado y entrega marcada como presentada');
      await loadContextAndHistory();
    } catch (err: any) {
      toast.error(err.message || 'Error al subir acuse');
    } finally {
      setUploadingId(null);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => String(currentYear - i));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Reportes MITECO"
        subtitle="Generación auditada de modelos anuales ESCILA y Declaración de Ventas FNEE / DAFNE"
      />

      <div
        style={{
          padding: '24px 32px',
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Banner Comercializadora Activa y Ventana Legal */}
        <div className="card animate-fade-in-up" style={{ padding: '20px 28px' }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[var(--lime)]/10 border border-[var(--lime)]/30 text-[var(--lime)]">
                <Building2 size={20} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Sujeto Obligado SNOEE / ESCILA:
                  </span>
                  <span className="text-sm font-bold text-white">
                    {companyInfo ? companyInfo.name : 'Cargando comercializadora...'}
                  </span>
                  {companyInfo?.cif && (
                    <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                      NIF {companyInfo.cif}
                    </span>
                  )}
                  {companyInfo?.brandsCount > 1 && (
                    <span className="px-2 py-0.5 text-xs rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Consolida {companyInfo.brandsCount} marcas del CIF
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Las declaraciones anuales ante el Ministerio se emiten de manera independiente por cada entidad jurídica (NIF).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700">
                <CalendarClock size={14} className="text-[var(--lime)]" />
                <span>
                  <strong>Plazo DAFNE / FNEE (Ley 18/2014 art. 70.2):</strong> 1 de enero al 30 de junio (ventas año N-1)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Selección de Modelo y Año */}
        <div className="card animate-fade-in-up" style={{ padding: '32px' }}>
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Selecciona el modelo regulatorio MITECO:
              </label>
              <a
                href="https://energia.serviciosmin.gob.es/"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '6px' }}
              >
                <span>SEDE ELECTRÓNICA MITECO</span>
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MITECO_REPORTS.map(item => {
                const isSelected = reportType === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setReportType(item.id)}
                    className={`relative p-5 text-left rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? 'bg-[var(--lime)]/10 border-[var(--lime)]/60 text-[var(--lime)] shadow-lg'
                        : 'bg-slate-900/80 border-slate-700 text-white hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-bold">{item.name}</h3>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isSelected
                            ? 'border-[var(--lime)]/40 bg-[var(--lime)]/15 text-[var(--lime)]'
                            : 'border-slate-700 bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.freq}
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isSelected ? 'text-white/85' : 'text-slate-400'}`}>
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-end gap-4 max-w-2xl">
              <div className="space-y-2 w-56">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Ejercicio de las ventas declaradas:
                </label>
                <select
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className="form-input"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Acciones según tipo de reporte */}
            {reportType === 'ESCILA' ? (
              <div className="pt-4 border-t border-slate-700/50 flex flex-wrap justify-end gap-3">
                <button
                  onClick={handleEscilaPreview}
                  disabled={previewLoading || loading}
                  className="btn-secondary"
                  style={{ padding: '12px 20px', gap: '8px' }}
                >
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  {previewLoading ? 'VALIDANDO...' : 'PREVISUALIZAR Y VALIDAR'}
                </button>
                <button
                  onClick={handleEscilaDownload}
                  disabled={loading || previewLoading}
                  className="btn-primary"
                  style={{ padding: '12px 24px' }}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-black" />
                  ) : (
                    <Download className="mr-2 h-5 w-5" />
                  )}
                  {loading ? 'GENERANDO XML...' : 'DESCARGAR XML ISO-8859-1'}
                </button>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-700/50 flex flex-wrap justify-end gap-3">
                <button
                  onClick={() => handleConsultDafne()}
                  disabled={previewLoading || loading}
                  className="btn-primary"
                  style={{ padding: '12px 24px' }}
                >
                  {previewLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-black" />
                  ) : (
                    <Eye className="mr-2 h-5 w-5" />
                  )}
                  {previewLoading ? 'CALCULANDO VENTAS...' : 'CALCULAR Y AUDITAR VENTAS (GWh)'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Previsualización ESCILA */}
        {reportType === 'ESCILA' && escilaPreview && (
          <div className="card animate-fade-in-up" style={{ padding: '28px' }}>
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="text-[var(--lime)]" size={20} />
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Previsualización ESCILA ({escilaPreview.year})
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">{escilaPreview.filename}</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  XSD Comercializadora + Catálogo ORDEN 1..76
                </span>
              </div>

              {Array.isArray(escilaPreview.warnings) && escilaPreview.warnings.length > 0 && (
                <div className="space-y-2">
                  {escilaPreview.warnings.map((w: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs"
                    >
                      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-xs text-slate-400">Energía Comercializada</div>
                  <div className="text-lg font-bold text-[var(--lime)] font-mono mt-0.5">
                    {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
                      escilaPreview.summary?.totalMwh || 0
                    )}{' '}
                    MWh
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-xs text-slate-400">Equivalente FNEE</div>
                  <div className="text-lg font-bold text-blue-300 font-mono mt-0.5">
                    {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(
                      escilaPreview.summary?.totalGwh || 0
                    )}{' '}
                    GWh
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-xs text-slate-400">Provincias con Actividad</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {escilaPreview.summary?.provincias || 0}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-xs text-slate-400">CUPS Activos a 31/12</div>
                  <div className="text-lg font-bold text-emerald-300 font-mono mt-0.5">
                    {escilaPreview.summary?.activeCupsDec31 || 0}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-xs text-slate-400">Empresas Activas a 31/12</div>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {escilaPreview.summary?.activeEmpresasDec31 || 0}
                  </div>
                </div>
              </div>

              {Array.isArray(escilaPreview.provinces) && escilaPreview.provinces.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[460px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2.5">Provincia INE</th>
                        <th className="px-3.5 py-2.5">ORDEN ESCILA</th>
                        <th className="px-3.5 py-2.5">Descripción Oficial Sector</th>
                        <th className="px-3.5 py-2.5 text-right">NUM_EMPRESAS</th>
                        <th className="px-3.5 py-2.5 text-right">NUM_CUPS (31/12)</th>
                        <th className="px-3.5 py-2.5 text-right">ENERGIA_COMERCIALIZADA (MWh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-200">
                      {escilaPreview.provinces.flatMap((prov: any) =>
                        prov.sectors.map((sec: any) => (
                          <tr key={`${prov.codigo}-${sec.idCnae}`} className="hover:bg-slate-800/30">
                            <td className="px-3.5 py-2 font-mono">
                              {prov.codigo} · {prov.desc}
                            </td>
                            <td className="px-3.5 py-2 font-mono text-blue-300 font-bold">{sec.idCnae}</td>
                            <td className="px-3.5 py-2 max-w-md truncate" title={sec.descCnae}>
                              {sec.descCnae}
                            </td>
                            <td className="px-3.5 py-2 text-right font-mono">{sec.numEmpresas}</td>
                            <td className="px-3.5 py-2 text-right font-mono text-emerald-300">{sec.numCups}</td>
                            <td className="px-3.5 py-2 text-right font-mono text-[var(--lime)]">
                              {sec.energiaFormatted}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Panel de Resultados y Generación PDF Oficial DAFNE / FNEE */}
        {reportType === 'DAFNE' && dafneData && (
          <div className="card animate-fade-in-up" style={{ padding: '28px' }}>
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Comunicación Anual de Ventas Energéticas — Ejercicio {dafneData.year}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Unidades exigidas por MITECO (Ley 18/2014 art. 70.2): <strong>GWh</strong> con coma decimal y máximo de 6 decimales.
                  </p>
                </div>

                {/* Casilla destacada lista para copiar al portal SNOEE */}
                <div className="flex items-center rounded-xl overflow-hidden border border-[var(--lime)]/50 shadow-lg">
                  <div className="bg-[var(--lime)] text-black px-4 py-2.5 font-bold text-xs uppercase tracking-wider">
                    Total Ventas (GWh)
                  </div>
                  <div className="bg-slate-950 px-4 py-2 font-mono text-lg font-bold text-white">
                    {overrideGwh || dafneData.formattedGwh}
                  </div>
                  <button
                    onClick={() => handleCopyGwh(overrideGwh || dafneData.formattedGwh)}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-200 px-3.5 py-2.5 border-l border-slate-800 transition-colors"
                    title="Copiar valor en GWh"
                  >
                    {copiedGwh ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {Array.isArray(dafneData.warnings) && dafneData.warnings.length > 0 && (
                <div className="space-y-2">
                  {dafneData.warnings.map((w: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs"
                    >
                      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tres tarjetas de contraste y verificación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setDafneSource('invoiced');
                    setOverrideGwh(dafneData.metrics?.invoiced?.formattedGwh || '0,000000');
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    dafneSource === 'invoiced'
                      ? 'bg-[var(--lime)]/10 border-[var(--lime)]/60'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      1. Ventas Facturadas (Comerc. Libre)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Recomendado
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mt-2">
                    {dafneData.metrics?.invoiced?.formattedGwh} <span className="text-xs text-slate-400">GWh</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    {dafneData.metrics?.invoiced?.formattedMwh} MWh · {dafneData.metrics?.invoiced?.invoicesCount} fact. ·{' '}
                    {dafneData.metrics?.invoiced?.cupsCount} CUPS
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDafneSource('cch');
                    setOverrideGwh(dafneData.metrics?.cchActiveContracts?.formattedGwh || '0,000000');
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    dafneSource === 'cch'
                      ? 'bg-[var(--lime)]/10 border-[var(--lime)]/60'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      2. Curvas CCH Contratos Vigentes
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                      Contraste Telemedida
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mt-2">
                    {dafneData.metrics?.cchActiveContracts?.formattedGwh}{' '}
                    <span className="text-xs text-slate-400">GWh</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    {dafneData.metrics?.cchActiveContracts?.formattedMwh} MWh ·{' '}
                    {dafneData.metrics?.cchActiveContracts?.cupsCount} CUPS vigentes
                  </div>
                </button>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      3. Liquidación REGANECU (Barras Central)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Incluye pérdidas red
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-300 mt-2">
                    {dafneData.metrics?.reganecuBc?.formattedGwh}{' '}
                    <span className="text-xs text-slate-500">GWh BC</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">
                    {dafneData.metrics?.reganecuBc?.formattedMwh} MWh BC ·{' '}
                    {dafneData.metrics?.reganecuBc?.monthsCovered}/12 meses liquidados
                  </div>
                </div>
              </div>

              {/* Parámetros para generación del PDF Oficial de Declaración Responsable */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Generar Modelo Oficial de Comunicación de Ventas Energéticas (PDF listo para Firma Electrónica)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 block">
                      Volumen Comercialización Libre a declarar (GWh, máx. 6 dec.):
                    </label>
                    <input
                      type="text"
                      value={overrideGwh}
                      onChange={e => setOverrideGwh(e.target.value)}
                      placeholder="Ej. 8,606200"
                      className="form-input font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 block">
                      DNI/NIE Representante Legal (sin guiones ni espacios):
                    </label>
                    <input
                      type="text"
                      value={repNif}
                      onChange={e => setRepNif(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                      placeholder="Ej. 45885555A"
                      className="form-input font-mono"
                    />
                  </div>
                  <div>
                    <button
                      onClick={handleDownloadDafnePdf}
                      disabled={loading}
                      className="btn-primary w-full justify-center"
                      style={{ padding: '11px 18px' }}
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-black" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {loading ? 'GENERANDO PDF...' : 'DESCARGAR BORRADOR PDF OFICIAL'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Histórico de Entregas MITECO */}
        <div className="card animate-fade-in-up" style={{ padding: '28px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <FileText size={18} className="text-slate-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Histórico de Generaciones y Entregas MITECO
              </h3>
            </div>
            <span className="text-xs text-slate-500">{submissions.length} registro(s)</span>
          </div>

          {submissions.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              Aún no se han registrado generaciones MITECO (ESCILA / DAFNE) para esta comercializadora.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase">
                  <tr>
                    <th className="px-3.5 py-2.5">Fecha</th>
                    <th className="px-3.5 py-2.5">Modelo</th>
                    <th className="px-3.5 py-2.5">Ejercicio</th>
                    <th className="px-3.5 py-2.5">Fichero</th>
                    <th className="px-3.5 py-2.5">Usuario</th>
                    <th className="px-3.5 py-2.5">Estado</th>
                    <th className="px-3.5 py-2.5 text-right">Acuse / Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-200">
                  {submissions.map(sub => {
                    const isSubmitted = sub.status === 'SUBMITTED';
                    return (
                      <tr key={sub.id} className="hover:bg-slate-800/30">
                        <td className="px-3.5 py-2.5 font-mono text-slate-400">
                          {new Date(sub.createdAt).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3.5 py-2.5 font-bold">{sub.reportType}</td>
                        <td className="px-3.5 py-2.5 font-mono">{sub.period}</td>
                        <td className="px-3.5 py-2.5 font-mono text-slate-300">{sub.filename}</td>
                        <td className="px-3.5 py-2.5 text-slate-400">{sub.generatedBy}</td>
                        <td className="px-3.5 py-2.5">
                          <button
                            onClick={() => handleToggleSubmitted(sub)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                              isSubmitted
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            <CheckCircle2 size={12} />
                            {isSubmitted ? 'Presentado MITECO' : 'Generado'}
                          </button>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            {sub.receiptUrl && (
                              <a
                                href={sub.receiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25"
                              >
                                <ExternalLink size={12} />
                                Ver acuse
                              </a>
                            )}
                            <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer">
                              {uploadingId === sub.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Upload size={12} />
                              )}
                              <span>{sub.receiptUrl ? 'Cambiar PDF' : 'Subir acuse'}</span>
                              <input
                                type="file"
                                accept=".pdf,.zip,.xsig,.xml"
                                className="hidden"
                                disabled={uploadingId === sub.id}
                                onChange={e => handleReceiptUpload(sub.id, e.target.files?.[0])}
                              />
                            </label>
                          </div>
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
    </div>
  );
}
