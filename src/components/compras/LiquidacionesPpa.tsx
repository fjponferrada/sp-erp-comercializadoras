'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Calculator,
  Zap,
  Calendar,
  TrendingUp,
  FileSpreadsheet,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import * as xlsx from 'xlsx';
import { getPpaMadridBounds } from '@/lib/ppaEngine';

export default function LiquidacionesPpa({
  initialPpas,
  initialSelectedPpaId,
}: {
  initialPpas?: any[];
  initialSelectedPpaId?: string;
} = {}) {
  const [ppas, setPpas] = useState<any[]>(initialPpas || []);
  const [selectedPpa, setSelectedPpa] = useState(initialSelectedPpaId || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [showDailyTable, setShowDailyTable] = useState(false);

  const [discountRatePct, setDiscountRatePct] = useState('3.5');
  const [projectionData, setProjectionData] = useState<any>(null);
  const [projectionError, setProjectionError] = useState('');
  const [loadingProjection, setLoadingProjection] = useState(false);

  useEffect(() => {
    if (initialPpas) {
      setPpas(initialPpas);
    } else {
      fetch('/api/ppas')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setPpas(data);
        })
        .catch((err) => console.error(err));
    }
  }, [initialPpas]);

  useEffect(() => {
    if (initialSelectedPpaId) {
      setSelectedPpa(initialSelectedPpaId);
    }
  }, [initialSelectedPpaId]);

  // Por defecto: mes anterior completo (el caso habitual de cierre de liquidación mensual M+1)
  useEffect(() => {
    const now = new Date();
    const prevMonthFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthLast = new Date(now.getFullYear(), now.getMonth(), 0);
    setStartDate(format(prevMonthFirst, 'yyyy-MM-dd'));
    setEndDate(format(prevMonthLast, 'yyyy-MM-dd'));
  }, []);

  const fetchProjection = useCallback(
    async (ppaId: string, rateStr: string) => {
      if (!ppaId) {
        setProjectionData(null);
        setProjectionError('');
        return;
      }
      setLoadingProjection(true);
      setProjectionError('');
      try {
        const res = await fetch('/api/ppas/proyeccion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ppaId,
            discountRatePct: Number(rateStr) || 3.5,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setProjectionError(data.error || 'No se pudo calcular la proyección futura.');
          setProjectionData(null);
        } else {
          setProjectionData(data);
        }
      } catch (err: any) {
        setProjectionError(err.message || 'Error cargando proyección.');
      } finally {
        setLoadingProjection(false);
      }
    },
    []
  );

  // Cargar automáticamente la proyección 12M + MtM al seleccionar un PPA (independiente de OMIE pasado)
  useEffect(() => {
    if (selectedPpa) {
      fetchProjection(selectedPpa, discountRatePct);
      setResult(null);
      setError('');
    } else {
      setProjectionData(null);
      setResult(null);
    }
  }, [selectedPpa, fetchProjection]);

  const applyPresetRange = (preset: 'prev_month' | 'curr_month' | 'curr_year' | 'contract') => {
    const now = new Date();
    if (preset === 'prev_month') {
      setStartDate(format(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'yyyy-MM-dd'));
      setEndDate(format(new Date(now.getFullYear(), now.getMonth(), 0), 'yyyy-MM-dd'));
    } else if (preset === 'curr_month') {
      setStartDate(format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'));
      setEndDate(format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd'));
    } else if (preset === 'curr_year') {
      setStartDate(`${now.getFullYear()}-01-01`);
      setEndDate(format(now, 'yyyy-MM-dd'));
    } else if (preset === 'contract') {
      const found = ppas.find((p) => p.id === selectedPpa);
      if (found) {
        const b = getPpaMadridBounds(found);
        setStartDate(b.startYmd);
        const todayYmd = format(now, 'yyyy-MM-dd');
        setEndDate(b.endYmd && b.endYmd < todayYmd ? b.endYmd : todayYmd);
      }
    }
  };

  const handleCalcular = async () => {
    if (!selectedPpa || !startDate || !endDate) {
      setError('Selecciona un contrato PPA y el rango de fechas a liquidar.');
      return;
    }

    if (endDate < startDate) {
      setError('La fecha Hasta no puede ser anterior a la fecha Desde.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/ppas/liquidaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ppaId: selectedPpa, startDate, endDate }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al calcular liquidación');

      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!result?.details) return;

    const isFin = result.summary?.isFinanciero;
    let csv = isFin
      ? 'Fecha_Hora_Madrid;OMIE_Eur_MWh;Volumen_MWh;Strike_Efectivo_Eur_MWh;Diferencial_CfD_Eur_MWh;Liquidacion_CfD_Eur\n'
      : 'Fecha_Hora_Madrid;OMIE_Eur_MWh;Volumen_MWh;Precio_PPA_Eur_MWh;Factura_Fisica_Eur;Ahorro_MtM_vs_OMIE_Eur\n';

    const fmtNum = (n: number, dec = 4) => Number(n ?? 0).toFixed(dec).replace('.', ',');

    for (const row of result.details) {
      if (isFin) {
        csv += `${row.datetime};${fmtNum(row.omie, 2)};${fmtNum(row.mwh, 4)};${fmtNum(row.contractPrice, 2)};${fmtNum(row.appliedPrice, 2)};${fmtNum(row.liquidacionEur, 2)}\n`;
      } else {
        csv += `${row.datetime};${fmtNum(row.omie, 2)};${fmtNum(row.mwh, 4)};${fmtNum(row.contractPrice, 2)};${fmtNum(row.liquidacionEur, 2)};${fmtNum(row.mtmEur, 2)}\n`;
      }
    }

    // BOM real UTF-8 (\uFEFF) para apertura directa en Microsoft Excel en español
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Liquidacion_PPA_${startDate}_al_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadXlsx = () => {
    if (!result?.summary) return;
    const wb = xlsx.utils.book_new();
    const s = result.summary;

    const resumenRows = [
      ['Concepto', 'Valor'],
      ['Contrato PPA', s.ppaName],
      ['Modalidad', `${s.ppaType} - ${s.ppaSubtype}`],
      ['Esquema de Precio', s.priceType],
      ['Periodo Liquidado (Europe/Madrid)', `${s.effectiveStartDate} a ${s.effectiveEndDate}`],
      ['Año Contractual', `Año ${s.contractYearNumber}`],
      ['Días con OMIE Calculados', `${s.calculatedDays} de ${s.expectedDays}`],
      ['Energía Total (MWh)', Number(s.totalMwh.toFixed(4))],
      ['Precio Medio Capturado OMIE (€/MWh)', Number(s.omieMedioPpa.toFixed(4))],
      ['Precio Medio Contractual PPA (€/MWh)', Number(s.effectiveContractPriceAvg.toFixed(4))],
      [
        s.isFinanciero
          ? 'Liquidación Neta CfD (€) [+Cobro / -Pago]'
          : 'Importe Factura Física Productor (€)',
        Number(s.totalEur.toFixed(2)),
      ],
      ['Beneficio / Ahorro MtM vs OMIE (€)', Number(s.totalCfdOrMtmEur.toFixed(2))],
    ];
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(resumenRows), 'Resumen');

    if (Array.isArray(result.daily) && result.daily.length > 0) {
      const dailySheet = result.daily.map((d: any) => ({
        Fecha: d.date,
        Intervalos: d.intervals,
        Energia_MWh: Number(d.mwh.toFixed(4)),
        OMIE_Medio_Eur_MWh: Number(d.omieAvg.toFixed(2)),
        Precio_PPA_Eur_MWh: Number(d.contractPriceAvg.toFixed(2)),
        [s.isFinanciero ? 'Liquidacion_CfD_Eur' : 'Factura_Fisica_Eur']: Number(
          d.liquidacionEur.toFixed(2)
        ),
        MtM_vs_OMIE_Eur: Number(d.mtmEur.toFixed(2)),
      }));
      xlsx.utils.book_append_sheet(
        wb,
        xlsx.utils.json_to_sheet(dailySheet),
        'Desglose_Diario'
      );
    }

    if (Array.isArray(result.details) && result.details.length > 0) {
      const detailSheet = result.details.map((r: any) => ({
        Fecha_Hora_Madrid: r.datetime,
        OMIE_Eur_MWh: Number(r.omie.toFixed(2)),
        Volumen_MWh: Number(r.mwh.toFixed(5)),
        Precio_Contrato_Eur_MWh: Number(r.contractPrice.toFixed(2)),
        [s.isFinanciero ? 'Diferencial_CfD_Eur_MWh' : 'Precio_Aplicado_Eur_MWh']: Number(
          r.appliedPrice.toFixed(2)
        ),
        [s.isFinanciero ? 'Liquidacion_CfD_Eur' : 'Factura_Fisica_Eur']: Number(
          r.liquidacionEur.toFixed(4)
        ),
        MtM_vs_OMIE_Eur: Number(r.mtmEur.toFixed(4)),
      }));
      xlsx.utils.book_append_sheet(
        wb,
        xlsx.utils.json_to_sheet(detailSheet),
        'Detalle_Horario'
      );
    }

    if (Array.isArray(projectionData?.projection) && projectionData.projection.length > 0) {
      const projSheet = projectionData.projection.map((p: any) => ({
        Mes: p.monthStr,
        Energia_Estimada_MWh: Number(p.totalMwh.toFixed(2)),
        OMIE_Capturado_Est_Eur_MWh: Number(p.omieMedio.toFixed(2)),
        Precio_PPA_Est_Eur_MWh: Number(p.contractPriceAvg.toFixed(2)),
        [s.isFinanciero ? 'Liquidacion_CfD_Est_Eur' : 'Factura_Fisica_Est_Eur']: Number(
          p.totalEur.toFixed(2)
        ),
        MtM_vs_OMIE_Est_Eur: Number(p.mtmEur.toFixed(2)),
      }));
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(projSheet), 'Proyeccion_12M');
    }

    const safeName = String(s.ppaName || 'PPA').replace(/[^a-zA-Z0-9_-]/g, '_');
    xlsx.writeFile(wb, `Liquidacion_${safeName}_${s.effectiveStartDate}_${s.effectiveEndDate}.xlsx`);
  };

  const projectionRows: any[] = projectionData?.projection || [];
  const mtmSummary = projectionData?.mtmSummary || null;
  const selectedPpaObj = ppas.find((p) => p.id === selectedPpa);

  const presetBtnStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: '0.75rem',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg-base)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 500,
  };

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h3
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Calculator size={20} color="var(--lime)" />
          Motor de Liquidaciones OMIE y Exposición Mark-to-Market (MtM)
        </h3>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => applyPresetRange('prev_month')} style={presetBtnStyle}>
            Mes Anterior
          </button>
          <button type="button" onClick={() => applyPresetRange('curr_month')} style={presetBtnStyle}>
            Mes Actual
          </button>
          <button type="button" onClick={() => applyPresetRange('curr_year')} style={presetBtnStyle}>
            Año en Curso
          </button>
          {selectedPpa && (
            <button type="button" onClick={() => applyPresetRange('contract')} style={presetBtnStyle}>
              Desde Inicio PPA
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '18px',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            Contrato PPA
          </label>
          <select
            value={selectedPpa}
            onChange={(e) => setSelectedPpa(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">-- Selecciona un contrato PPA --</option>
            {ppas.map((ppa) => (
              <option key={ppa.id} value={ppa.id}>
                {ppa.name} ({ppa.type} · {ppa.subtype.replace('_', ' ')})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            Fecha Desde (Liquidación Real OMIE)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            Fecha Hasta (Inclusive)
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {selectedPpaObj && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span>
            Vigencia contractual:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {getPpaMadridBounds(selectedPpaObj).startYmd}
            </strong>{' '}
            a{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {getPpaMadridBounds(selectedPpaObj).endYmd || 'Indefinido'}
            </strong>
            {selectedPpaObj.counterparty ? ` · Contraparte: ${selectedPpaObj.counterparty}` : ''}
          </span>
          <span>
            {(selectedPpaObj.annualDegradationPct ?? 0) > 0 &&
              `Degradación: ${selectedPpaObj.annualDegradationPct}%/año · `}
            {(selectedPpaObj.annualEscalationPct ?? 0) !== 0 &&
              `Escalado precio: ${selectedPpaObj.annualEscalationPct}%/año`}
          </span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#F87171',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleCalcular}
        disabled={loading || !selectedPpa}
        style={{
          background: 'var(--lime)',
          color: 'var(--bg-base)',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: 700,
          cursor: loading || !selectedPpa ? 'not-allowed' : 'pointer',
          opacity: !selectedPpa ? 0.6 : 1,
          transition: 'all 0.2s',
          width: '100%',
        }}
      >
        {loading ? 'Cruzando intervalos OMIE con el contrato PPA...' : 'Calcular Liquidación Real OMIE'}
      </button>

      {/* BLOQUE 1: LIQUIDACIÓN REAL HISTÓRICA */}
      {result?.summary && (
        <div style={{ marginTop: '28px', paddingTop: '28px', borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Resultado de Liquidación Real ({result.summary.effectiveStartDate} a{' '}
                {result.summary.effectiveEndDate})
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Año contractual {result.summary.contractYearNumber} · {result.summary.calculatedDays}{' '}
                días liquidados ({result.details?.length || 0} intervalos horarios/cuarto-horarios)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowDailyTable((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-base)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Calendar size={15} />
                {showDailyTable ? 'Ocultar tabla diaria' : 'Ver desglose diario'}
              </button>
              <button
                onClick={handleDownloadCsv}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={15} />
                CSV
              </button>
              <button
                onClick={handleDownloadXlsx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#4ADE80',
                  border: '1px solid rgba(34, 197, 94, 0.35)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <FileSpreadsheet size={15} />
                Excel Completo (.xlsx)
              </button>
            </div>
          </div>

          {result.summary.wasClippedToValidity && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#60A5FA',
                borderRadius: '8px',
                marginBottom: '14px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                fontSize: '0.83rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Info size={16} />
              <span>
                El rango solicitado se ha acotado automáticamente a los días dentro de la vigencia del contrato (
                <strong>{result.summary.effectiveStartDate}</strong> al{' '}
                <strong>{result.summary.effectiveEndDate}</strong>).
              </span>
            </div>
          )}

          {result.summary.missingDays > 0 && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239, 160, 15, 0.1)',
                color: '#FBBF24',
                borderRadius: '8px',
                marginBottom: '18px',
                border: '1px solid rgba(239, 160, 15, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.85rem',
              }}
            >
              <ShieldAlert size={18} />
              <div>
                <strong>Atención:</strong> Faltan precios reales de OMIE para{' '}
                <strong>{result.summary.missingDays} día(s)</strong> del rango. La liquidación
                contempla los {result.summary.calculatedDays} días disponibles en base de datos.
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            <div
              style={{
                background: 'var(--bg-base)',
                padding: '18px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  marginBottom: '6px',
                }}
              >
                <Zap size={16} />
                <span>
                  {result.summary.isFinanciero ? 'Energía Liquidada (CEC)' : 'Energía Física Recibida'}
                </span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {result.summary.totalMwh.toLocaleString('es-ES', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  MWh
                </span>
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-base)',
                padding: '18px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  marginBottom: '6px',
                }}
              >
                <TrendingUp size={16} />
                <span>OMIE Capturado vs Precio PPA</span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {result.summary.omieMedioPpa.toLocaleString('es-ES', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  €/MWh
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Precio contractual efectivo:{' '}
                <strong>
                  {result.summary.effectiveContractPriceAvg.toLocaleString('es-ES', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  €/MWh
                </strong>
              </div>
            </div>

            {result.summary.isFinanciero ? (
              <div
                style={{
                  background:
                    result.summary.totalEur >= 0
                      ? 'rgba(34, 197, 94, 0.06)'
                      : 'rgba(239, 68, 68, 0.06)',
                  padding: '18px',
                  borderRadius: '12px',
                  border: `1px solid ${
                    result.summary.totalEur >= 0
                      ? 'rgba(34, 197, 94, 0.35)'
                      : 'rgba(239, 68, 68, 0.35)'
                  }`,
                }}
              >
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: result.summary.totalEur >= 0 ? '#22C55E' : '#EF4444',
                    marginBottom: '6px',
                    fontWeight: 700,
                  }}
                >
                  {result.summary.totalEur >= 0
                    ? 'A favor de Comercializadora (Cobro CfD)'
                    : 'A favor del Productor (Pago CfD)'}
                </div>
                <div
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: result.summary.totalEur >= 0 ? '#22C55E' : '#EF4444',
                  }}
                >
                  {result.summary.totalEur.toLocaleString('es-ES', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  <span style={{ fontSize: '0.95rem' }}>€</span>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.06)',
                    padding: '18px',
                    borderRadius: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: '#60A5FA',
                      marginBottom: '6px',
                      fontWeight: 700,
                    }}
                  >
                    Factura Física al Productor
                  </div>
                  <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#60A5FA' }}>
                    {result.summary.totalPhysicalInvoiceEur.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span style={{ fontSize: '0.95rem' }}>€</span>
                  </div>
                </div>

                <div
                  style={{
                    background:
                      result.summary.totalCfdOrMtmEur >= 0
                        ? 'rgba(34, 197, 94, 0.06)'
                        : 'rgba(239, 68, 68, 0.06)',
                    padding: '18px',
                    borderRadius: '12px',
                    border: `1px solid ${
                      result.summary.totalCfdOrMtmEur >= 0
                        ? 'rgba(34, 197, 94, 0.35)'
                        : 'rgba(239, 68, 68, 0.35)'
                    }`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: result.summary.totalCfdOrMtmEur >= 0 ? '#22C55E' : '#EF4444',
                      marginBottom: '6px',
                      fontWeight: 700,
                    }}
                  >
                    Ahorro / MtM frente a OMIE
                  </div>
                  <div
                    style={{
                      fontSize: '1.65rem',
                      fontWeight: 800,
                      color: result.summary.totalCfdOrMtmEur >= 0 ? '#22C55E' : '#EF4444',
                    }}
                  >
                    {result.summary.totalCfdOrMtmEur >= 0 ? '+' : ''}
                    {result.summary.totalCfdOrMtmEur.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span style={{ fontSize: '0.95rem' }}>€</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {showDailyTable && Array.isArray(result.daily) && result.daily.length > 0 && (
            <div
              style={{
                marginTop: '18px',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                overflow: 'hidden',
                maxHeight: '340px',
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ background: 'var(--bg-base)', position: 'sticky', top: 0 }}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      Fecha
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      Energía (MWh)
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      OMIE Medio (€/MWh)
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      Precio PPA (€/MWh)
                    </th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {result.summary.isFinanciero ? 'Liquidación CfD (€)' : 'Factura Física (€)'}
                    </th>
                    {!result.summary.isFinanciero && (
                      <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        Ahorro vs OMIE (€)
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {result.daily.map((d: any) => (
                    <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {d.date}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {d.mwh.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {d.omieAvg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {d.contractPriceAvg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td
                        style={{
                          padding: '8px 14px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: result.summary.isFinanciero
                            ? d.liquidacionEur >= 0
                              ? '#22C55E'
                              : '#EF4444'
                            : 'var(--text-primary)',
                        }}
                      >
                        {d.liquidacionEur.toLocaleString('es-ES', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        €
                      </td>
                      {!result.summary.isFinanciero && (
                        <td
                          style={{
                            padding: '8px 14px',
                            textAlign: 'right',
                            fontWeight: 600,
                            color: d.mtmEur >= 0 ? '#22C55E' : '#EF4444',
                          }}
                        >
                          {d.mtmEur >= 0 ? '+' : ''}
                          {d.mtmEur.toLocaleString('es-ES', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          €
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BLOQUE 2: PROYECCIÓN 12 MESES + MARK-TO-MARKET (INDEPENDIENTE DE OMIE HISTÓRICO) */}
      {selectedPpa && (
        <div style={{ marginTop: '30px', paddingTop: '28px', borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h4
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Calendar size={18} color="var(--lime)" />
                Proyección Financiera 12 Meses y Valoración Mark-to-Market (MtM)
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Calculada sobre la Curva Base del Portfolio (Futuros OMIE + Curva Solar de Pato en Europe/Madrid).
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Tasa descuento MtM (%):
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="25"
                value={discountRatePct}
                onChange={(e) => setDiscountRatePct(e.target.value)}
                onBlur={() => fetchProjection(selectedPpa, discountRatePct)}
                style={{
                  width: '74px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  textAlign: 'right',
                }}
              />
            </div>
          </div>

          {loadingProjection ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Calculando exposición futura y proyección mensual...
            </div>
          ) : projectionError ? (
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: 'rgba(239, 160, 15, 0.1)',
                border: '1px solid rgba(239, 160, 15, 0.3)',
                color: '#FBBF24',
                fontSize: '0.85rem',
              }}
            >
              {projectionError}
            </div>
          ) : projectionData?.expired ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '8px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
              }}
            >
              {projectionData.message}
            </div>
          ) : (
            <>
              {mtmSummary && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                    marginBottom: '18px',
                  }}
                >
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Exposición Neta MtM Descontada ({mtmSummary.discountRatePct}%)
                    </div>
                    <div
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        marginTop: '4px',
                        color: mtmSummary.discountedMtmEur >= 0 ? '#22C55E' : '#EF4444',
                      }}
                    >
                      {mtmSummary.discountedMtmEur >= 0 ? '+' : ''}
                      {mtmSummary.discountedMtmEur.toLocaleString('es-ES', {
                        maximumFractionDigits: 0,
                      })}{' '}
                      €
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Nominal sin descontar:{' '}
                      {mtmSummary.undiscountedMtmEur.toLocaleString('es-ES', {
                        maximumFractionDigits: 0,
                      })}{' '}
                      € (hasta {mtmSummary.horizonEndYmd})
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      OMIE Capturado Forward vs Contrato
                    </div>
                    <div
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        marginTop: '4px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {mtmSummary.avgCapturedOmieEurMwh.toLocaleString('es-ES', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        vs{' '}
                        {mtmSummary.avgContractPriceEurMwh.toLocaleString('es-ES', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        €/MWh
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Volumen cubierto en curva:{' '}
                      {mtmSummary.totalMwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })}{' '}
                      MWh
                    </div>
                  </div>
                </div>
              )}

              {projectionRows.length > 0 && (
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr
                        style={{
                          background: 'rgba(0,0,0,0.2)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          Mes
                        </th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                          Energía Estimada (MWh)
                        </th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                          OMIE Capturado (€/MWh)
                        </th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                          Precio PPA (€/MWh)
                        </th>
                        <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                          {projectionRows[0]?.isFinanciero
                            ? 'Liquidación CfD Est. (€)'
                            : 'Factura Física Est. (€)'}
                        </th>
                        {!projectionRows[0]?.isFinanciero && (
                          <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                            MtM vs OMIE (€)
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {projectionRows.map((row: any) => (
                        <tr key={row.monthKey} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '11px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {row.monthStr}
                          </td>
                          <td style={{ padding: '11px 16px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            {row.totalMwh.toLocaleString('es-ES', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td style={{ padding: '11px 16px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            {row.omieMedio.toLocaleString('es-ES', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td style={{ padding: '11px 16px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                            {row.contractPriceAvg.toLocaleString('es-ES', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            style={{
                              padding: '11px 16px',
                              fontWeight: 600,
                              textAlign: 'right',
                              color: row.isFinanciero
                                ? row.totalEur >= 0
                                  ? '#22C55E'
                                  : '#EF4444'
                                : 'var(--text-primary)',
                            }}
                          >
                            {row.totalEur.toLocaleString('es-ES', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            €
                          </td>
                          {!row.isFinanciero && (
                            <td
                              style={{
                                padding: '11px 16px',
                                fontWeight: 600,
                                textAlign: 'right',
                                color: row.mtmEur >= 0 ? '#22C55E' : '#EF4444',
                              }}
                            >
                              {row.mtmEur >= 0 ? '+' : ''}
                              {row.mtmEur.toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              €
                            </td>
                          )}
                        </tr>
                      ))}
                      {(() => {
                        const sumMwh = projectionRows.reduce((s, r) => s + r.totalMwh, 0);
                        const sumEur = projectionRows.reduce((s, r) => s + r.totalEur, 0);
                        const sumMtm = projectionRows.reduce((s, r) => s + r.mtmEur, 0);
                        const avgOmie =
                          sumMwh > 0
                            ? projectionRows.reduce((s, r) => s + r.omieMedio * r.totalMwh, 0) /
                              sumMwh
                            : 0;
                        const avgPpa =
                          sumMwh > 0
                            ? projectionRows.reduce(
                                (s, r) => s + r.contractPriceAvg * r.totalMwh,
                                0
                              ) / sumMwh
                            : 0;
                        const isFin = projectionRows[0]?.isFinanciero;
                        return (
                          <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                            <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 800 }}>
                              TOTAL HORIZONTE 12M
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 800, textAlign: 'right' }}>
                              {sumMwh.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 800, textAlign: 'right' }}>
                              {avgOmie.toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 800, textAlign: 'right' }}>
                              {avgPpa.toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                fontWeight: 800,
                                textAlign: 'right',
                                color: isFin
                                  ? sumEur >= 0
                                    ? '#22C55E'
                                    : '#EF4444'
                                  : 'var(--text-primary)',
                              }}
                            >
                              {sumEur.toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              €
                            </td>
                            {!isFin && (
                              <td
                                style={{
                                  padding: '12px 16px',
                                  fontWeight: 800,
                                  textAlign: 'right',
                                  color: sumMtm >= 0 ? '#22C55E' : '#EF4444',
                                }}
                              >
                                {sumMtm >= 0 ? '+' : ''}
                                {sumMtm.toLocaleString('es-ES', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                €
                              </td>
                            )}
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
