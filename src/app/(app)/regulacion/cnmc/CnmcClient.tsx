'use client';

import { useState, useEffect, useCallback } from 'react';
import Topbar from '@/components/Topbar';
import {
  Info,
  ExternalLink,
  Download,
  Loader2,
  Building2,
  ShieldCheck,
  AlertTriangle,
  Eye,
  CheckCircle2,
  Upload,
  FileText,
  Mail,
  Clock,
} from 'lucide-react';
import { useBrandTheme } from '@/context/BrandThemeContext';
import toast from 'react-hot-toast';

type CnmcReportId = 'SI_CODAGE' | 'TM_CODAGE' | 'COBERTURAS' | 'IVC_CODAGE';

const REPORT_TYPES: Array<{
  id: CnmcReportId;
  name: string;
  freq: string;
  desc: string;
}> = [
  {
    id: 'SI_CODAGE',
    name: 'SI Codage',
    freq: 'Mensual · XML',
    desc: 'Solicitudes de cambio/alta, pendientes y tiempos medios (SolicitudesRealizadas v1.0)',
  },
  {
    id: 'TM_CODAGE',
    name: 'TM Codage',
    freq: 'Trimestral · CSV / XLS',
    desc: 'Tiempos medios de activación desde fecha de consentimiento/firma del cliente',
  },
  {
    id: 'COBERTURAS',
    name: 'Coberturas CIR/DE/007/25',
    freq: 'Anual · CSV',
    desc: 'Energía cubierta a plazo y suministrada en Barras de Central (kWh BC)',
  },
  {
    id: 'IVC_CODAGE',
    name: 'IVC Codage',
    freq: 'Informativo',
    desc: 'Índices de Validación y Calidad (estado normativo en Manual SCC v6.0)',
  },
];

const COBERTURAS_FIELD_META: Array<{
  param: string;
  key: string;
  label: string;
}> = [
  { param: 'c2', key: 'energiaCubiertaIntragrupoNuclear', label: '2. Cubierta intragrupo Nuclear (kWh BC)' },
  { param: 'c3', key: 'energiaCubiertaIntragrupoHidraulica', label: '3. Cubierta intragrupo Hidráulica (kWh BC)' },
  { param: 'c4', key: 'energiaCubiertaIntragrupoResto', label: '4. Cubierta intragrupo Resto (kWh BC)' },
  { param: 'c5', key: 'energiaCubiertaAPlazoCCC', label: '5. Cubierta a plazo con Cámara CCC (kWh BC)' },
  { param: 'c6', key: 'energiaCubiertaAPlazoNoCCC', label: '6. Cubierta a plazo bilateral No CCC (kWh BC)' },
  { param: 'c7', key: 'energiaCubiertaOtrosCCC', label: '7. Otros instrumentos con CCC (kWh BC)' },
  { param: 'c8', key: 'energiaCubiertaOtrosNoCCC', label: '8. Otros instrumentos No CCC (kWh BC)' },
  { param: 'c9', key: 'energiaSuministrada', label: '9. Energía total suministrada (kWh BC)' },
  { param: 'c10', key: 'energiaSuministradaPrecioNoIndexadoMD', label: '10. Suministrada a precio NO indexado MD (kWh BC)' },
];

function getDefaultPrevMonth(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function getDefaultClosedQuarter(): { year: string; quarter: string } {
  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  if (currentQ === 1) {
    return { year: String(now.getFullYear() - 1), quarter: '4' };
  }
  return { year: String(now.getFullYear()), quarter: String(currentQ - 1) };
}

export default function CnmcClient() {
  const brand = useBrandTheme();

  const [opcion, setOpcion] = useState<CnmcReportId>('SI_CODAGE');
  const [mes, setMes] = useState<string>('');
  const [version, setVersion] = useState<string>('01');

  const [tmYear, setTmYear] = useState<string>('');
  const [tmQuarter, setTmQuarter] = useState<string>('1');
  const [tmFormat, setTmFormat] = useState<'csv' | 'xls'>('csv');

  const [cobYear, setCobYear] = useState<string>('');
  const [cobOverrides, setCobOverrides] = useState<Record<string, string>>({});

  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);

  const [companyInfo, setCompanyInfo] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [suggestedVersions, setSuggestedVersions] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Inicializar periodos por defecto al periodo cerrado inmediatamente anterior
  useEffect(() => {
    setMes(getDefaultPrevMonth());
    const closedQ = getDefaultClosedQuarter();
    setTmYear(closedQ.year);
    setTmQuarter(closedQ.quarter);
    setCobYear(String(new Date().getFullYear() - 1));
  }, []);

  const loadContextAndHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/regulacion/submissions?category=CNMC');
      if (!res.ok) return;
      const data = await res.json();
      setCompanyInfo(data.company || null);
      setSubmissions(data.submissions || []);
      setSuggestedVersions(data.suggestedVersions || {});
    } catch {
      // Silencioso en carga inicial
    }
  }, []);

  useEffect(() => {
    loadContextAndHistory();
    setPreviewData(null);
  }, [brand.name, loadContextAndHistory]);

  // Sugerir versión correlativa automáticamente cuando cambia el mes en SI_CODAGE
  useEffect(() => {
    if (mes && suggestedVersions[mes]) {
      setVersion(suggestedVersions[mes]);
    } else if (mes) {
      setVersion('01');
    }
  }, [mes, suggestedVersions]);

  // Limpiar previsualización al cambiar parámetros clave
  useEffect(() => {
    setPreviewData(null);
  }, [opcion, mes, tmYear, tmQuarter, tmFormat, cobYear]);

  const buildReportUrl = (preview: boolean, extraParams?: Record<string, string>): string | null => {
    if (opcion === 'SI_CODAGE') {
      if (!mes) {
        toast.error('Debes seleccionar un mes para SI Codage');
        return null;
      }
      const normVer = /^\d{1,2}$/.test(version.trim()) && Number(version) > 0
        ? version.trim().padStart(2, '0')
        : '01';
      const params = new URLSearchParams({ mes, version: normVer });
      if (preview) params.set('preview', 'true');
      if (extraParams) {
        Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
      }
      return `/api/cnmc/si-codage?${params.toString()}`;
    }

    if (opcion === 'TM_CODAGE') {
      if (!tmYear || !tmQuarter) {
        toast.error('Selecciona el año y trimestre para TM Codage');
        return null;
      }
      const params = new URLSearchParams({
        year: tmYear,
        quarter: tmQuarter,
        format: tmFormat,
      });
      if (preview) params.set('preview', 'true');
      return `/api/cnmc/tm-codage?${params.toString()}`;
    }

    if (opcion === 'COBERTURAS') {
      if (!cobYear) {
        toast.error('Selecciona el ejercicio anual para Coberturas CNMC');
        return null;
      }
      const params = new URLSearchParams({ year: cobYear });
      if (preview) params.set('preview', 'true');
      Object.entries(cobOverrides).forEach(([paramKey, val]) => {
        if (val !== undefined && val.trim() !== '') {
          params.set(paramKey, val.trim());
        }
      });
      return `/api/cnmc/coberturas?${params.toString()}`;
    }

    return null;
  };

  const handlePreview = async () => {
    if (opcion === 'IVC_CODAGE') return;
    const url = buildReportUrl(true);
    if (!url) return;

    setIsPreviewLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Error al validar los datos del reporte');
      }
      setPreviewData(data);

      if (opcion === 'COBERTURAS' && data.fields) {
        const nextOverrides: Record<string, string> = {};
        COBERTURAS_FIELD_META.forEach(m => {
          if (data.fields[m.key] !== undefined) {
            nextOverrides[m.param] = String(data.fields[m.key]);
          }
        });
        setCobOverrides(nextOverrides);
      }

      toast.success('Validación previa completada');
    } catch (err: any) {
      toast.error(err.message || 'Error al previsualizar el reporte');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownload = async (extraParams?: Record<string, string>) => {
    if (opcion === 'IVC_CODAGE') {
      toast('IVC Codage no requiere presentación de fichero XML/CSV en el esquema actual', { icon: 'ℹ️' });
      return;
    }

    const url = buildReportUrl(false, extraParams);
    if (!url) return;

    setIsLoading(true);
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (errData.emptyMonth) {
          await handlePreview();
        }
        throw new Error(errData.error || 'Error al generar el fichero oficial');
      }

      const blob = await response.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename =
        opcion === 'SI_CODAGE'
          ? 'SI_CODAGE.xml'
          : opcion === 'TM_CODAGE'
          ? `TM_CODAGE.${tmFormat}`
          : 'Coberturas.csv';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(dlUrl);
      document.body.removeChild(a);

      toast.success(`Fichero ${filename} generado correctamente`);
      await loadContextAndHistory();
      setShowModal(true);
    } catch (error: any) {
      toast.error(error.message || 'Error al generar el reporte');
    } finally {
      setIsLoading(false);
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

      toast.success('Justificante oficial adjuntado y entrega marcada como presentada');
      await loadContextAndHistory();
    } catch (err: any) {
      toast.error(err.message || 'Error al subir justificante');
    } finally {
      setUploadingId(null);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, idx) => String(currentYear - idx));

  const modalPortalHref =
    opcion === 'COBERTURAS'
      ? 'https://sede.cnmc.gob.es/tramites/energia-electricidad/comercializadores-peticion-facturacion-contratacion-coberturas'
      : 'https://tramites.cnmc.gob.es/formulario/4';

  const modalLinkLabel =
    opcion === 'COBERTURAS'
      ? 'Sede CNMC · Coberturas CIR/DE/007/25'
      : opcion === 'TM_CODAGE'
      ? 'Enlace TM CODAGE (SCC)'
      : 'Enlace SI CODAGE';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Reportes CNMC"
        subtitle="Generación validada de modelos oficiales SCC (Manual v6.0) y Circular CIR/DE/007/25"
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
        {/* Banner de Comercializadora Activa y Plazos Legales */}
        <div className="card animate-fade-in-up" style={{ padding: '20px 28px' }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[var(--lime)]/10 border border-[var(--lime)]/30 text-[var(--lime)]">
                <Building2 size={20} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    Sujeto Obligado Activo:
                  </span>
                  <span className="text-sm font-bold text-white">
                    {companyInfo ? companyInfo.name : 'Cargando comercializadora...'}
                  </span>
                  {companyInfo?.cif && (
                    <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                      CIF {companyInfo.cif}
                    </span>
                  )}
                  {companyInfo?.ordenCnmc && (
                    <span className="px-2 py-0.5 text-xs font-mono rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      CNMC {companyInfo.ordenCnmc}
                    </span>
                  )}
                  {companyInfo?.codigoRee && (
                    <span className="px-2 py-0.5 text-xs font-mono rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      REE {companyInfo.codigoRee}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Los ficheros se emiten consolidando exclusivamente los suministros y eventos ATR de esta comercializadora.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700">
                <Clock size={13} className="text-[var(--lime)]" />
                <span>
                  <strong>SI_CODAGE:</strong> días 5–20 mes siguiente
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700">
                <Clock size={13} className="text-blue-400" />
                <span>
                  <strong>TM_CODAGE:</strong> hasta día 20 tras trimestre
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Tarjeta Principal de Selección y Configuración */}
        <div className="card animate-fade-in-up" style={{ padding: '32px' }}>
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Selecciona el modelo regulatorio CNMC:
              </label>
              <button
                onClick={() => setShowModal(true)}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '6px' }}
              >
                <span>ENTREGAR MODELO EN SEDE CNMC</span>
                <ExternalLink size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {REPORT_TYPES.map(type => {
                const isSelected = opcion === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setOpcion(type.id)}
                    className={`relative p-4 text-left rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? 'bg-[var(--lime)]/10 border-[var(--lime)]/60 text-[var(--lime)] shadow-lg'
                        : 'bg-slate-900/80 border-slate-700 text-white hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h3 className="text-sm font-bold">{type.name}</h3>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isSelected
                            ? 'border-[var(--lime)]/40 bg-[var(--lime)]/15 text-[var(--lime)]'
                            : 'border-slate-700 bg-slate-800 text-slate-400'
                        }`}
                      >
                        {type.freq}
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isSelected ? 'text-white/85' : 'text-slate-400'}`}>
                      {type.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Parámetros SI_CODAGE */}
            {opcion === 'SI_CODAGE' && (
              <div className="space-y-3 animate-fade-in-up">
                <div className="flex flex-wrap items-end max-w-2xl gap-4">
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Mes de reporte (Periodo AAAAMM):
                    </label>
                    <input
                      type="month"
                      value={mes}
                      onChange={e => setMes(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="space-y-2 w-40">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Versión entrega:
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={version}
                      onChange={e => setVersion(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      onBlur={() =>
                        setVersion(v => (/^\d{1,2}$/.test(v) && Number(v) > 0 ? v.padStart(2, '0') : '01'))
                      }
                      placeholder="01"
                      className="form-input font-mono text-center"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Incluye reconstrucción inter-mensual (solicitudes iniciadas en meses previos que se aceptan, rechazan, activan o permanecen pendientes en el mes seleccionado) y cálculo de <code className="text-slate-300">TMActivacion</code> respecto a fecha prevista (Apdo. 11.5 Manual SCC v6.0).
                </p>
              </div>
            )}

            {/* Parámetros TM_CODAGE */}
            {opcion === 'TM_CODAGE' && (
              <div className="space-y-3 animate-fade-in-up">
                <div className="flex flex-wrap items-end max-w-3xl gap-4">
                  <div className="space-y-2 w-44">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Año:
                    </label>
                    <select
                      value={tmYear}
                      onChange={e => setTmYear(e.target.value)}
                      className="form-input"
                    >
                      {yearOptions.map(y => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 w-56">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Trimestre cerrado:
                    </label>
                    <select
                      value={tmQuarter}
                      onChange={e => setTmQuarter(e.target.value)}
                      className="form-input"
                    >
                      <option value="1">T1 (Enero – Marzo)</option>
                      <option value="2">T2 (Abril – Junio)</option>
                      <option value="3">T3 (Julio – Septiembre)</option>
                      <option value="4">T4 (Octubre – Diciembre)</option>
                    </select>
                  </div>
                  <div className="space-y-2 w-64">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Formato oficial CNMC:
                    </label>
                    <select
                      value={tmFormat}
                      onChange={e => setTmFormat(e.target.value as 'csv' | 'xls')}
                      className="form-input"
                    >
                      <option value="csv">CSV separado por ; (Apdo. 6.2)</option>
                      <option value="xls">Excel .xls (pestaña &apos;Datos&apos;)</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Cabecera estricta <code className="text-slate-300">CANAL;ACTUACION_CAMPO;IND_ACTIVACION;NUM_ACTIVADAS;TIEMPO_MEDIO</code> medida desde fecha de firma contractual (<code className="text-slate-300">signatureDate</code>) sobre cambios C1/C2 efectivamente activados en el trimestre.
                </p>
              </div>
            )}

            {/* Parámetros COBERTURAS */}
            {opcion === 'COBERTURAS' && (
              <div className="space-y-4 animate-fade-in-up">
                <div className="flex flex-wrap items-end max-w-xl gap-4">
                  <div className="space-y-2 w-52">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Ejercicio anual vencido:
                    </label>
                    <select
                      value={cobYear}
                      onChange={e => {
                        setCobYear(e.target.value);
                        setCobOverrides({});
                      }}
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
                <p className="text-xs text-slate-400">
                  Genera <code className="text-slate-300">Coberturas_{companyInfo?.ordenCnmc || 'R2-950'}_{cobYear}.csv</code> según Circular <code className="text-slate-300">CIR/DE/007/25</code> (1 única fila RFC 4180 separada por comas sin cabecera, 10 campos enteros en <code className="text-slate-300">kWh BC</code>). Pulsa <strong>Previsualizar y Validar</strong> para auditar o ajustar las partidas antes de exportar.
                </p>
              </div>
            )}

            {/* Panel honesto IVC_CODAGE */}
            {opcion === 'IVC_CODAGE' && (
              <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-sm text-slate-200 space-y-2 animate-fade-in-up">
                <div className="flex items-center gap-2 font-bold text-blue-300">
                  <Info size={18} />
                  <span>Estado normativo de IVC_CODAGE en Manual de Archivos SCC v6.0</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  En el documento oficial <strong>CNMC - Manual de Archivos SCC v6.0</strong> (control de cambios pág. 5), la referencia a <code className="text-blue-200">IVC_CODAGE</code> figura únicamente como entrada preliminar sin desarrollo técnico ni esquema XSD/CSV exigible a comercializadoras libres de electricidad.
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Para evitar presentaciones erróneas en sede electrónica, la descarga ficticia ha sido deshabilitada. Las obligaciones periódicas activas de cambio de comercializador y supervisión son <strong>SI_CODAGE</strong> (mensual), <strong>TM_CODAGE</strong> (trimestral) y <strong>Coberturas CIR/DE/007/25</strong> (anual).
                </p>
              </div>
            )}

            {/* Barra de Acciones */}
            {opcion !== 'IVC_CODAGE' && (
              <div className="pt-4 border-t border-slate-700/50 flex flex-wrap justify-end gap-3">
                <button
                  onClick={handlePreview}
                  disabled={isPreviewLoading || isLoading}
                  className="btn-secondary"
                  style={{ padding: '12px 20px', gap: '8px' }}
                >
                  {isPreviewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {isPreviewLoading ? 'VALIDANDO...' : 'PREVISUALIZAR Y VALIDAR'}
                </button>

                <button
                  onClick={() => handleDownload()}
                  disabled={isLoading || isPreviewLoading}
                  className="btn-primary"
                  style={{ padding: '12px 24px' }}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-black" />
                  ) : (
                    <Download className="mr-2 h-5 w-5" />
                  )}
                  {isLoading ? 'GENERANDO...' : 'DESCARGAR FICHERO OFICIAL'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Panel de Previsualización y Validador Pre-Descarga */}
        {previewData && (
          <div className="card animate-fade-in-up" style={{ padding: '28px' }}>
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="text-[var(--lime)]" size={20} />
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Resultado del Validador Pre-Entrega
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">{previewData.filename}</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Esquema Oficial Verificado
                </span>
              </div>

              {/* Avisos y Alertas Normativas */}
              {Array.isArray(previewData.warnings) && previewData.warnings.length > 0 && (
                <div className="space-y-2">
                  {previewData.warnings.map((w: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed"
                    >
                      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                      <div className="flex-1 space-y-2">
                        <p>{w}</p>
                        {opcion === 'SI_CODAGE' && previewData.emptyMonth && (
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <a
                              href={`mailto:cambiodecomercializador@cnmc.es?subject=${encodeURIComponent(
                                `Comunicación sin actividad SI_CODAGE - ${previewData.company?.codigoAgente || ''} - Periodo ${previewData.summary?.periodo || ''}`
                              )}&body=${encodeURIComponent(
                                `Estimados Sres.,\n\nDe conformidad con el apartado 3.3 del Manual de Archivos del Sistema de Cambio de Comercializador, les comunicamos que la comercializadora ${previewData.company?.name || ''} (CIF ${previewData.company?.cif || ''}, código ${previewData.company?.codigoAgente || ''}) no ha registrado actividad ni solicitudes pendientes en el mercado eléctrico durante el periodo ${previewData.summary?.periodo || ''}.\n\nAtentamente,`
                              )}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-black font-bold hover:bg-amber-300 transition-colors"
                            >
                              <Mail size={14} />
                              Preparar email a cambiodecomercializador@cnmc.es
                            </a>
                            <button
                              onClick={() => handleDownload({ allowEmpty: 'true' })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700 transition-colors"
                            >
                              <Download size={13} />
                              Descargar sólo Cabecera XML (XSD válido sin nodo SolicitudesRealizadas)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Vista previa SI_CODAGE */}
              {opcion === 'SI_CODAGE' && previewData.summary && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[
                      { label: 'Enviadas mes', val: previewData.summary.enviadas },
                      { label: 'Aceptadas (02)', val: previewData.summary.aceptadas },
                      { label: 'Rechazadas (02/04)', val: previewData.summary.rechazadas },
                      { label: 'Activadas (05)', val: previewData.summary.activadas },
                      { label: 'Anuladas', val: previewData.summary.anuladas },
                      { label: 'Reposiciones E2', val: previewData.summary.reposiciones },
                      { label: 'Pdtes. fin mes', val: previewData.summary.pendientes },
                    ].map(kpi => (
                      <div
                        key={kpi.label}
                        className="p-3 rounded-xl bg-slate-900/90 border border-slate-800"
                      >
                        <div className="text-[11px] text-slate-400">{kpi.label}</div>
                        <div className="text-lg font-bold text-white font-mono mt-0.5">{kpi.val}</div>
                      </div>
                    ))}
                  </div>

                  {Array.isArray(previewData.rows) && previewData.rows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 uppercase">
                          <tr>
                            <th className="px-3 py-2.5">Provincia</th>
                            <th className="px-3 py-2.5">Distribuidor</th>
                            <th className="px-3 py-2.5">Cambio</th>
                            <th className="px-3 py-2.5">Punto</th>
                            <th className="px-3 py-2.5">Tarifa</th>
                            <th className="px-3 py-2.5 text-right">Enviadas</th>
                            <th className="px-3 py-2.5 text-right">Aceptadas</th>
                            <th className="px-3 py-2.5 text-right">Rechazadas</th>
                            <th className="px-3 py-2.5 text-right">Activadas</th>
                            <th className="px-3 py-2.5 text-right">Pdtes.</th>
                            <th className="px-3 py-2.5">Motivos Rechazo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70 text-slate-200">
                          {previewData.rows.map((r: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="px-3 py-2 font-mono">{r.provincia}</td>
                              <td className="px-3 py-2 font-mono text-blue-300">{r.distribuidor}</td>
                              <td className="px-3 py-2 font-mono">{r.tipoCambio}</td>
                              <td className="px-3 py-2 font-mono">{r.tipoPunto}</td>
                              <td className="px-3 py-2 font-mono">{r.tarifaAtr}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.enviadas}</td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-300">{r.aceptadas}</td>
                              <td className="px-3 py-2 text-right font-mono text-rose-300">{r.rechazadas}</td>
                              <td className="px-3 py-2 text-right font-mono text-[var(--lime)]">{r.activadas}</td>
                              <td className="px-3 py-2 text-right font-mono text-amber-300">
                                {(r.pendientesRespuesta || 0) + (r.pendientesActivacion || 0)}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-400">{r.motivosRechazo || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Vista previa TM_CODAGE */}
              {opcion === 'TM_CODAGE' && previewData.summary && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-xs text-slate-400">Periodo Trimestral</div>
                      <div className="text-lg font-bold text-white font-mono mt-0.5">
                        {previewData.summary.periodo}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-xs text-slate-400">Total Cambios C1/C2 Activados</div>
                      <div className="text-lg font-bold text-[var(--lime)] font-mono mt-0.5">
                        {previewData.summary.totalActivadas}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-xs text-slate-400">Tiempo Medio Global (desde firma)</div>
                      <div className="text-lg font-bold text-blue-300 font-mono mt-0.5">
                        {previewData.summary.tiempoMedioGlobal} días
                      </div>
                    </div>
                  </div>

                  {Array.isArray(previewData.rows) && previewData.rows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 font-mono">
                          <tr>
                            <th className="px-4 py-2.5">CANAL</th>
                            <th className="px-4 py-2.5">ACTUACION_CAMPO</th>
                            <th className="px-4 py-2.5">IND_ACTIVACION</th>
                            <th className="px-4 py-2.5 text-right">NUM_ACTIVADAS</th>
                            <th className="px-4 py-2.5 text-right">TIEMPO_MEDIO</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70 text-slate-200 font-mono">
                          {previewData.rows.map((r: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="px-4 py-2">{r.canal}</td>
                              <td className="px-4 py-2">{r.actuacionCampo}</td>
                              <td className="px-4 py-2">{r.indActivacion}</td>
                              <td className="px-4 py-2 text-right text-[var(--lime)]">{r.numActivadas}</td>
                              <td className="px-4 py-2 text-right">{r.tiempoMedioStr}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Vista previa y Editor Interactivo COBERTURAS */}
              {opcion === 'COBERTURAS' && previewData.fields && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-xs text-slate-400">1. Código Comercializador</div>
                      <div className="text-lg font-bold text-blue-300 font-mono mt-0.5">
                        {previewData.fields.codigoComercializador}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-xs text-slate-400">Total Energía Cubierta (PPAs)</div>
                      <div className="text-lg font-bold text-white font-mono mt-0.5">
                        {new Intl.NumberFormat('es-ES').format(previewData.summary?.totalCubiertaKwh || 0)} kWh
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-xs text-slate-400">Meses Liquidación REGANECU</div>
                      <div className="text-lg font-bold text-emerald-300 font-mono mt-0.5">
                        {previewData.summary?.mesesReganecu ?? 0} / 12
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="text-xs text-slate-400">% Cartera Precio Fijo</div>
                      <div className="text-lg font-bold text-[var(--lime)] font-mono mt-0.5">
                        {previewData.summary?.porcentajeFijo ?? 0}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {COBERTURAS_FIELD_META.map(field => (
                      <div
                        key={field.param}
                        className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5"
                      >
                        <label className="text-[11px] text-slate-400 block font-medium">
                          {field.label}
                        </label>
                        <input
                          type="number"
                          step={1}
                          min={0}
                          value={cobOverrides[field.param] ?? '0'}
                          onChange={e =>
                            setCobOverrides(prev => ({
                              ...prev,
                              [field.param]: e.target.value.replace(/[^\d]/g, ''),
                            }))
                          }
                          className="form-input font-mono text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Histórico de Entregas CNMC */}
        <div className="card animate-fade-in-up" style={{ padding: '28px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <FileText size={18} className="text-slate-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Histórico de Generaciones y Entregas CNMC
              </h3>
            </div>
            <span className="text-xs text-slate-500">{submissions.length} registro(s)</span>
          </div>

          {submissions.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              Aún no se han registrado generaciones CNMC para esta comercializadora. Al descargar cualquier modelo quedará auditado aquí automáticamente.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase">
                  <tr>
                    <th className="px-3.5 py-2.5">Fecha</th>
                    <th className="px-3.5 py-2.5">Modelo</th>
                    <th className="px-3.5 py-2.5">Periodo</th>
                    <th className="px-3.5 py-2.5">Fichero</th>
                    <th className="px-3.5 py-2.5">Usuario</th>
                    <th className="px-3.5 py-2.5">Estado</th>
                    <th className="px-3.5 py-2.5 text-right">Justificante / Acciones</th>
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
                        <td className="px-3.5 py-2.5 font-mono">
                          {sub.period}
                          {sub.version ? ` (v${sub.version})` : ''}
                        </td>
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
                            title="Haz clic para alternar entre Generado y Presentado"
                          >
                            <CheckCircle2 size={12} />
                            {isSubmitted ? 'Presentado CNMC' : 'Generado'}
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
                                accept=".pdf,.zip,.xml"
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

      {/* Modal del Portal de Trámites CNMC */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 duration-200 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />

            <div className="flex justify-center mb-6">
              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Info size={32} className="text-blue-400" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-white text-center mb-4">
              Portal de Trámites CNMC
            </h3>

            <p className="text-center text-white/60 text-sm mb-8">
              El reporte generado deberá ser entregado directamente en la sede electrónica de la CNMC a través del siguiente enlace oficial:
            </p>

            <div className="bg-black/50 rounded-xl p-4 mb-6 border border-white/5 text-center">
              <a
                href={modalPortalHref}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-2 group transition-colors text-lg"
              >
                {modalLinkLabel}
                <ExternalLink
                  size={18}
                  className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
                />
              </a>
            </div>

            {opcion === 'TM_CODAGE' ? (
              <div className="mb-8 p-4 bg-amber-500/10 rounded-xl border border-amber-500/25 text-xs text-amber-200/90 text-left leading-relaxed">
                *Importante para <strong>TM_CODAGE</strong>: conserve exactamente el nombre <code className="font-mono">TM_CODAGE_AAAATN.csv</code> (o <code className="font-mono">.xls</code>) sin añadir sufijos de versión (<code className="font-mono">_01</code>), ya que el validador trimestral de la CNMC rechaza nombres con sufijo adicional.
              </div>
            ) : opcion === 'COBERTURAS' ? (
              <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10 text-xs text-white/60 text-left leading-relaxed">
                *Conserve el nombre exacto <code className="font-mono">Coberturas_CODAGE_AAAA.csv</code> exigido por la Circular <code className="font-mono">CIR/DE/007/25</code> (fichero CSV sin fila de encabezados y 10 campos enteros expresados en kWh en Barras de Central).
              </div>
            ) : (
              <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10 text-xs text-white/50 text-left leading-relaxed">
                *El número que aparece al final del nombre del archivo identifica la versión de la entrega. Utilice &quot;01&quot; para la presentación inicial y actualice la numeración de forma correlativa (&quot;02&quot;, &quot;03&quot;, etc.) en caso de realizar correcciones o nuevas entregas del modelo.
              </div>
            )}

            <div className="flex justify-center">
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors border border-white/10"
              >
                Entendido, cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
