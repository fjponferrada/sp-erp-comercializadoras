'use client';

import { useMemo, useState } from 'react';
import {
  X,
  UploadCloud,
  CheckCircle2,
  Download,
  Table,
  FileText,
  ExternalLink,
  Trash2,
  Loader2,
} from 'lucide-react';
import * as xlsx from 'xlsx';
import {
  estimateNominalAnnualMwh,
  toMadridYmd,
  validateProfileMatrix,
} from '@/lib/ppaEngine';

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTHS_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function normalizeHeaderToken(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseLocalizedNumber(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (raw === null || raw === undefined) return 0;
  let str = String(raw).trim().replace(/\s+/g, '');
  if (!str) return 0;
  if (str.includes(',') && str.includes('.')) {
    // Si la coma está después del punto -> formato español 1.234,56
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const n = Number(str);
  return Number.isFinite(n) ? n : NaN;
}

export default function PpaForm({
  onClose,
  onSuccess,
  initialData = null,
}: {
  onClose: () => void;
  onSuccess: (ppaChangedPricingImpact?: boolean) => void;
  initialData?: any;
}) {
  const [loading, setLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    counterparty: initialData?.counterparty || '',
    type: initialData?.type || 'FISICO',
    subtype: initialData?.subtype || 'CARGA_BASE',
    startDate: toMadridYmd(initialData?.startDate) || '',
    endDate: toMadridYmd(initialData?.endDate) || '',
    priceType: initialData?.priceType || 'FIJO',
    priceValue:
      initialData?.priceValue !== null && initialData?.priceValue !== undefined
        ? String(initialData.priceValue)
        : '',
    basePowerMw:
      initialData?.basePowerMw !== null && initialData?.basePowerMw !== undefined
        ? String(initialData.basePowerMw)
        : '',
    annualDegradationPct:
      initialData?.annualDegradationPct !== null &&
      initialData?.annualDegradationPct !== undefined
        ? String(initialData.annualDegradationPct)
        : '0',
    annualEscalationPct:
      initialData?.annualEscalationPct !== null &&
      initialData?.annualEscalationPct !== undefined
        ? String(initialData.annualEscalationPct)
        : '0',
    contractPdfUrl: initialData?.contractPdfUrl || '',
    notes: initialData?.notes || '',
    includeInPricing:
      initialData?.includeInPricing !== undefined ? Boolean(initialData.includeInPricing) : true,
  });

  // Se mantiene el perfil en estado aunque se alterne temporalmente el selector de Subtipo
  const [profileData, setProfileData] = useState<number[][] | null>(
    Array.isArray(initialData?.profileData) ? (initialData.profileData as number[][]) : null
  );

  const profileStats = useMemo(() => {
    if (!profileData || !Array.isArray(profileData) || profileData.length !== 12) return null;
    const monthlyTotals = profileData.map((mArr) =>
      Array.isArray(mArr) ? mArr.reduce((acc, v) => acc + (Number(v) || 0), 0) : 0
    );
    const annualTotal = monthlyTotals.reduce((a, b) => a + b, 0);
    return {
      eneH12: Number(profileData[0]?.[12] ?? 0),
      julTotal: monthlyTotals[6] ?? 0,
      agoTotal: monthlyTotals[7] ?? 0,
      monthlyTotals,
      annualTotal,
    };
  }, [profileData]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = xlsx.read(buffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: unknown[][] = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!rows || rows.length < 24) {
          setFormError('El archivo Excel no contiene suficientes filas (se requieren 24 horas).');
          return;
        }

        const expectedMonthsNorm = MONTHS_ES.map((m) => normalizeHeaderToken(m));
        let headerRowIdx = -1;
        const monthColMap: number[] = new Array(12).fill(-1);

        // Detectar automáticamente la fila de cabeceras (soporta filas título previas como "Perfil de producción (MWh)")
        const maxScanRow = Math.min(rows.length, 20);
        for (let r = 0; r < maxScanRow; r++) {
          const rowTokens = (rows[r] || []).map(normalizeHeaderToken);
          let matched = 0;
          const tempMap = new Array(12).fill(-1);
          for (let m = 0; m < 12; m++) {
            const colIdx = rowTokens.findIndex(
              (tok) => tok === expectedMonthsNorm[m] || tok.startsWith(expectedMonthsNorm[m])
            );
            if (colIdx !== -1) {
              tempMap[m] = colIdx;
              matched++;
            }
          }
          if (matched === 12) {
            headerRowIdx = r;
            for (let m = 0; m < 12; m++) monthColMap[m] = tempMap[m];
            break;
          }
        }

        if (headerRowIdx === -1) {
          setFormError(
            'No se encontraron las 12 columnas de meses (Enero a Diciembre). Descarga la plantilla para ver el formato exacto.'
          );
          return;
        }

        // Extraer las 24 filas horarias posteriores a la cabecera ignorando filas vacías o de "Total"
        const dataRows: unknown[][] = [];
        for (let r = headerRowIdx + 1; r < rows.length && dataRows.length < 24; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;
          const firstCellNorm = normalizeHeaderToken(row[0]);
          if (firstCellNorm.includes('total') || firstCellNorm.includes('suma')) break;

          // Verificar que haya valores numéricos en las columnas de meses
          const hasAnyValue = monthColMap.some((cIdx) => String(row[cIdx] ?? '').trim() !== '');
          if (!hasAnyValue) continue;

          dataRows.push(row);
        }

        if (dataRows.length < 24) {
          setFormError(
            `Solo se encontraron ${dataRows.length} filas horarias válidas tras la cabecera (se necesitan exactamente 24 horas: 0 a 23).`
          );
          return;
        }

        const matrix: number[][] = [];
        for (let m = 0; m < 12; m++) {
          const colIdx = monthColMap[m];
          const monthHours: number[] = [];
          for (let h = 0; h < 24; h++) {
            const val = parseLocalizedNumber(dataRows[h][colIdx]);
            if (!Number.isFinite(val) || val < 0) {
              setFormError(
                `Valor numérico inválido en ${MONTHS_ES[m]}, hora ${h}: "${dataRows[h][colIdx]}".`
              );
              return;
            }
            monthHours.push(val);
          }
          matrix.push(monthHours);
        }

        const validation = validateProfileMatrix(matrix);
        if (!validation.valid || !validation.normalized) {
          setFormError(validation.error || 'Matriz de perfil inválida.');
          return;
        }

        setProfileData(validation.normalized);
      } catch (err) {
        console.error(err);
        setFormError('Error al procesar el archivo Excel. Verifica que sea un .xlsx o .xls válido.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadMatrixExcel = (asTemplate: boolean) => {
    const header = ['Hora/mes', ...MONTHS_ES];
    const aoa: (string | number)[][] = [
      ['Perfil de producción (MWh)'],
      header,
    ];

    for (let h = 0; h < 24; h++) {
      const row: (string | number)[] = [h];
      for (let m = 0; m < 12; m++) {
        row.push(!asTemplate && profileData ? Number(profileData[m]?.[h] ?? 0) : 0);
      }
      aoa.push(row);
    }

    if (!asTemplate && profileStats) {
      aoa.push([
        'Total',
        ...profileStats.monthlyTotals.map((t) => Number(t.toFixed(2))),
        Number(profileStats.annualTotal.toFixed(2)),
      ]);
    }

    const ws = xlsx.utils.aoa_to_sheet(aoa);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Perfil_12x24');
    const safeName = formData.name
      ? formData.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'PPA';
    xlsx.writeFile(
      wb,
      asTemplate ? 'Plantilla_Perfil_Fijo_PPA_12x24.xlsx' : `Perfil_12x24_${safeName}.xlsx`
    );
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    setFormError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'ppas');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'No se pudo subir el contrato PDF');
      }
      setFormData((prev) => ({ ...prev, contractPdfUrl: data.url }));
    } catch (err: any) {
      setFormError(err.message || 'Error al subir el PDF');
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (formData.endDate && formData.endDate < formData.startDate) {
      setFormError('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    if (formData.subtype === 'CARGA_BASE') {
      const mw = Number(formData.basePowerMw);
      if (!Number.isFinite(mw) || mw <= 0) {
        setFormError('La potencia de Carga Base debe ser mayor que 0 MW.');
        return;
      }
    }

    if (formData.subtype === 'PERFIL_FIJO' && !profileData) {
      setFormError('Debes cargar una matriz Excel 12x24 para un PPA de Perfil Fijo.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        profileData: formData.subtype === 'PERFIL_FIJO' ? profileData : null,
      };

      const isEditing = Boolean(initialData?.id);
      const url = isEditing ? `/api/ppas/${initialData.id}` : '/api/ppas';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Error al guardar el PPA');
        return;
      }

      const impactsPricing =
        Boolean(formData.includeInPricing) || Boolean(initialData?.includeInPricing);
      onSuccess(impactsPricing);
    } catch (err) {
      console.error(err);
      setFormError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const estimatedYear1Mwh = estimateNominalAnnualMwh({
    subtype: formData.subtype,
    basePowerMw: Number(formData.basePowerMw || 0),
    profileData,
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'var(--bg-base)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          width: '580px',
          maxWidth: '100vw',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {initialData ? 'Editar Contrato PPA' : 'Nuevo Contrato PPA'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Vigencia y liquidación calculadas en huso oficial peninsular (Europe/Madrid).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {formError && (
            <div
              style={{
                padding: '12px 14px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                color: '#F87171',
                fontSize: '0.85rem',
                marginBottom: '18px',
              }}
            >
              {formError}
            </div>
          )}

          <form
            id="ppa-form"
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Nombre del Acuerdo *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ej. RENEE RJE FIN SOLAR PERFIL FIJO 35"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Contraparte / Productor
                </label>
                <input
                  type="text"
                  placeholder="Ej. RJE Solar SPV S.L."
                  value={formData.counterparty}
                  onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: '12px 14px',
                borderRadius: '8px',
                background: formData.includeInPricing
                  ? 'rgba(163, 230, 53, 0.08)'
                  : 'var(--bg-base)',
                border: `1px solid ${
                  formData.includeInPricing ? 'rgba(163, 230, 53, 0.35)' : 'var(--border)'
                }`,
              }}
            >
              <input
                type="checkbox"
                checked={formData.includeInPricing}
                onChange={(e) => setFormData({ ...formData, includeInPricing: e.target.checked })}
                style={{ width: '17px', height: '17px', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Incluir este PPA en la Curva Base del Cotizador (Pricing)
                </div>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                  Si se activa, traslada el coste/ahorro del PPA al precio ofertado a nuevos clientes tras sincronizar el portfolio.
                </div>
              </div>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Modalidad de Liquidación *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  style={inputStyle}
                >
                  <option value="FISICO">Físico (Entrega bilateral — resta compra OMIE)</option>
                  <option value="FINANCIERO">Financiero (CfD / Swap por diferencias)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Estructura de Volumen *
                </label>
                <select
                  value={formData.subtype}
                  onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                  style={inputStyle}
                >
                  <option value="CARGA_BASE">Carga Base (MW constantes 24h)</option>
                  <option value="PERFIL_FIJO">Perfil Fijo (Anexo Matriz 12x24 MWh)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Fecha Inicio Vigencia *
                </label>
                <input
                  required
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Fecha Fin Vigencia (Inclusive)
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  min={formData.startDate || undefined}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Esquema de Precio *
                </label>
                <select
                  value={formData.priceType}
                  onChange={(e) => setFormData({ ...formData, priceType: e.target.value })}
                  style={inputStyle}
                >
                  <option value="FIJO">Fijo / Strike (€/MWh)</option>
                  <option value="INDEXADO">Indexado a OMIE (+/- Fee €/MWh)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {formData.priceType === 'INDEXADO'
                    ? 'Fee sobre OMIE (€/MWh) *'
                    : 'Precio Fijo / Strike (€/MWh) *'}
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min={formData.priceType === 'FIJO' ? '0' : undefined}
                  placeholder={formData.priceType === 'INDEXADO' ? 'Ej. 1.35, 0 o -1.50' : 'Ej. 35.00'}
                  value={formData.priceValue}
                  onChange={(e) => setFormData({ ...formData, priceValue: e.target.value })}
                  style={inputStyle}
                />
                {formData.priceType === 'INDEXADO' && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Admite positivo (+fee), 0 (OMIE puro) o negativo (-descuento).
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Degradación Lineal Anual (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="25"
                  placeholder="Ej. 0.55"
                  value={formData.annualDegradationPct}
                  onChange={(e) =>
                    setFormData({ ...formData, annualDegradationPct: e.target.value })
                  }
                  style={inputStyle}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Reduce el volumen desde el Año 2 de contrato (0% = sin degradación).
                </span>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Escalado / IPC Anual Precio (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-25"
                  max="50"
                  placeholder="Ej. 0 o 2.00"
                  value={formData.annualEscalationPct}
                  onChange={(e) =>
                    setFormData({ ...formData, annualEscalationPct: e.target.value })
                  }
                  style={inputStyle}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Actualiza anualmente el Strike o Fee en cada aniversario contractual.
                </span>
              </div>
            </div>

            {formData.subtype === 'CARGA_BASE' && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.06)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    Potencia de Carga Base (MW) *
                  </label>
                  {estimatedYear1Mwh > 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#60A5FA', fontWeight: 600 }}>
                      ≈ {estimatedYear1Mwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} MWh/año
                    </span>
                  )}
                </div>
                <input
                  required
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="Ej. 1.2"
                  value={formData.basePowerMw}
                  onChange={(e) => setFormData({ ...formData, basePowerMw: e.target.value })}
                  style={inputStyle}
                />
                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Volumen constante todas las horas del día durante la vigencia contractual.
                </p>
              </div>
            )}

            {formData.subtype === 'PERFIL_FIJO' && (
              <div
                style={{
                  background: 'rgba(168, 85, 247, 0.06)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    Matriz de Producción 12 Meses × 24 Horas (MWh) *
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleDownloadMatrixExcel(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.75rem',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={13} />
                      Plantilla .xlsx
                    </button>
                    {profileData && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowMatrixModal(true)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.75rem',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            background: 'rgba(168, 85, 247, 0.15)',
                            border: '1px solid rgba(168, 85, 247, 0.4)',
                            color: '#C084FC',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Table size={13} />
                          Ver Matriz 12×24
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadMatrixExcel(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.75rem',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          <Download size={13} />
                          Exportar .xlsx
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!profileData ? (
                  <div
                    style={{
                      border: '2px dashed var(--border)',
                      borderRadius: '8px',
                      padding: '26px 20px',
                      textAlign: 'center',
                      background: 'var(--bg-base)',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleExcelUpload}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                    <UploadCloud size={30} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      Arrastra o haz clic para subir el Anexo Excel (.xlsx)
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Detecta automáticamente filas título, meses Enero-Diciembre y decimales con coma.
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      background: 'var(--bg-base)',
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ background: 'rgba(34, 197, 94, 0.12)', padding: '10px', borderRadius: '8px' }}>
                      <CheckCircle2 size={22} color="#22c55e" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                        Matriz 12×24 validada —{' '}
                        <span style={{ color: 'var(--lime)' }}>
                          {profileStats?.annualTotal.toLocaleString('es-ES', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          MWh/año
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Julio:{' '}
                        {profileStats?.julTotal.toLocaleString('es-ES', { maximumFractionDigits: 2 })} MWh ·
                        Agosto:{' '}
                        {profileStats?.agoTotal.toLocaleString('es-ES', { maximumFractionDigits: 2 })} MWh ·
                        Ene H12:{' '}
                        {profileStats?.eneH12.toLocaleString('es-ES', { maximumFractionDigits: 2 })} MWh
                      </div>
                      <div style={{ display: 'flex', gap: '14px', marginTop: '8px', alignItems: 'center' }}>
                        <label
                          style={{
                            color: '#C084FC',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Reemplazar archivo Excel
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleExcelUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Contrato firmado en PDF (Cloudflare R2) */}
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Contrato PPA Firmado (PDF en la nube R2)
              </label>
              {formData.contractPdfUrl ? (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <a
                    href={formData.contractPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--lime)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <FileText size={16} />
                    Abrir Contrato PDF adjunto
                    <ExternalLink size={13} />
                  </a>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contractPdfUrl: '' })}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                    title="Quitar PDF adjunto"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-base)',
                    border: '1px dashed var(--border)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    cursor: uploadingPdf ? 'wait' : 'pointer',
                  }}
                >
                  {uploadingPdf ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Subiendo PDF a Cloudflare R2...
                    </>
                  ) : (
                    <>
                      <FileText size={16} />
                      Adjuntar PDF firmado (.pdf)
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={uploadingPdf}
                    onChange={handlePdfUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Notas / Condiciones Contractuales
              </label>
              <textarea
                rows={2}
                placeholder="Ej. Sin transferencia de GdOs, liquidación mensual M+5 días hábiles, garantías..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </form>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            form="ppa-form"
            type="submit"
            disabled={loading || uploadingPdf || (formData.subtype === 'PERFIL_FIJO' && !profileData)}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'var(--lime)',
              border: 'none',
              color: 'var(--bg-base)',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Guardando...' : 'Guardar PPA'}
          </button>
        </div>
      </div>

      {/* Modal Visor de Matriz 12x24 */}
      {showMatrixModal && profileData && profileStats && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setShowMatrixModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              maxWidth: '1150px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Anexo de Perfil Fijo (12 Meses × 24 Horas — MWh Mensuales por Hora)
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Total Anual Año 1:{' '}
                  <strong style={{ color: 'var(--lime)' }}>
                    {profileStats.annualTotal.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    MWh
                  </strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleDownloadMatrixExcel(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <Download size={14} />
                  Descargar .xlsx
                </button>
                <button
                  type="button"
                  onClick={() => setShowMatrixModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div style={{ overflow: 'auto', padding: '16px' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.76rem',
                  textAlign: 'right',
                }}
              >
                <thead>
                  <tr style={{ background: 'var(--bg-base)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Hora
                    </th>
                    {MONTHS_SHORT.map((m) => (
                      <th key={m} style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 24 }, (_, h) => (
                    <tr key={h} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td
                        style={{
                          padding: '6px 10px',
                          textAlign: 'center',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        {String(h).padStart(2, '0')}:00
                      </td>
                      {MONTHS_SHORT.map((_, mIdx) => {
                        const val = Number(profileData[mIdx]?.[h] ?? 0);
                        return (
                          <td
                            key={mIdx}
                            style={{
                              padding: '6px 10px',
                              color: val > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                              fontWeight: val > 0 ? 500 : 400,
                            }}
                          >
                            {val.toLocaleString('es-ES', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-base)', borderTop: '2px solid var(--border)' }}>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'center',
                        fontWeight: 800,
                        color: 'var(--lime)',
                      }}
                    >
                      TOTAL
                    </td>
                    {profileStats.monthlyTotals.map((tot, idx) => (
                      <td
                        key={idx}
                        style={{
                          padding: '8px 10px',
                          fontWeight: 800,
                          color: 'var(--lime)',
                        }}
                      >
                        {tot.toLocaleString('es-ES', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
