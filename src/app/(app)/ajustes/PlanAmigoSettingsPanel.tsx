'use client';

import React, { useEffect, useState } from 'react';
import { Gift, Save, Sparkles, CheckCircle2, ShieldCheck, Loader2, ExternalLink } from 'lucide-react';
import {
  backfillBrandReferralCodesAction,
  getBrandReferralSettingsAction,
  updateBrandReferralSettingsAction,
} from '@/app/actions/referralActions';

const AVAILABLE_TARIFFS = ['2.0TD', '3.0TD', '6.1TD', '6.2TD'];

export default function PlanAmigoSettingsPanel({
  brandId,
  brandName,
}: {
  brandId?: string | null;
  brandName?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [missingCodesCount, setMissingCodesCount] = useState(0);
  const [hasPublicInviteDomain, setHasPublicInviteDomain] = useState(true);

  const [isEnabled, setIsEnabled] = useState(false);
  const [codePrefix, setCodePrefix] = useState('AMIGO-');
  const [referrerRewardEur, setReferrerRewardEur] = useState('25');
  const [referredRewardEur, setReferredRewardEur] = useState('25');
  const [referrerReward30tdEur, setReferrerReward30tdEur] = useState('50');
  const [referredReward30tdEur, setReferredReward30tdEur] = useState('50');
  const [allowedTariffs, setAllowedTariffs] = useState<string[]>(['2.0TD', '3.0TD']);
  const [triggerMilestone, setTriggerMilestone] = useState<
    'ON_ATR_ACTIVATION' | 'ON_DAYS_ACTIVE' | 'ON_FIRST_ISSUED_INVOICE'
  >('ON_DAYS_ACTIVE');
  const [minActiveDays, setMinActiveDays] = useState('15');
  const [cooldownMonthsSameCups, setCooldownMonthsSameCups] = useState('12');
  const [allowSelfReferral, setAllowSelfReferral] = useState(false);
  const [blockSameIban, setBlockSameIban] = useState(true);
  const [maxReferralsPerYear, setMaxReferralsPerYear] = useState('12');
  const [maxAnnualRewardEur, setMaxAnnualRewardEur] = useState('300');
  const [creditExpirationMonths, setCreditExpirationMonths] = useState('24');
  const [zeroChannelCommission, setZeroChannelCommission] = useState(true);
  const [legalTermsUrl, setLegalTermsUrl] = useState('');

  const loadConfig = async () => {
    setLoading(true);
    setBackfillMsg(null);
    const res = await getBrandReferralSettingsAction(brandId || undefined);
    if (res.success && res.config) {
      const c = res.config;
      setCanEdit(Boolean(res.canEdit));
      setMissingCodesCount(res.activeClientsWithoutCodeCount ?? 0);
      setHasPublicInviteDomain(res.hasPublicInviteDomain !== false);
      setIsEnabled(c.isEnabled);
      setCodePrefix(c.codePrefix || 'AMIGO-');
      setReferrerRewardEur(String(c.referrerRewardEur ?? 25));
      setReferredRewardEur(String(c.referredRewardEur ?? 25));
      setReferrerReward30tdEur(
        c.referrerReward30tdEur !== null && c.referrerReward30tdEur !== undefined
          ? String(c.referrerReward30tdEur)
          : ''
      );
      setReferredReward30tdEur(
        c.referredReward30tdEur !== null && c.referredReward30tdEur !== undefined
          ? String(c.referredReward30tdEur)
          : ''
      );
      setAllowedTariffs(Array.isArray(c.allowedTariffs) && c.allowedTariffs.length > 0 ? c.allowedTariffs : ['2.0TD']);
      setTriggerMilestone(c.triggerMilestone || 'ON_DAYS_ACTIVE');
      setMinActiveDays(String(c.minActiveDays ?? 15));
      setCooldownMonthsSameCups(String(c.cooldownMonthsSameCups ?? 12));
      setAllowSelfReferral(Boolean(c.allowSelfReferral));
      setBlockSameIban(Boolean(c.blockSameIban));
      setMaxReferralsPerYear(
        c.maxReferralsPerYear !== null && c.maxReferralsPerYear !== undefined ? String(c.maxReferralsPerYear) : ''
      );
      setMaxAnnualRewardEur(
        String(Math.min(300, Number((c as any).maxAnnualRewardEur ?? 300) || 300))
      );
      setCreditExpirationMonths(
        c.creditExpirationMonths !== null && c.creditExpirationMonths !== undefined
          ? String(c.creditExpirationMonths)
          : ''
      );
      setZeroChannelCommission(Boolean(c.zeroChannelCommission));
      setLegalTermsUrl(c.legalTermsUrl || '');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const toggleTariff = (t: string) => {
    if (!canEdit) return;
    setAllowedTariffs((prev) =>
      prev.includes(t) ? (prev.length > 1 ? prev.filter((x) => x !== t) : prev) : [...prev, t]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSavedOk(false);
      const res = await updateBrandReferralSettingsAction({
        brandId: brandId || undefined,
        isEnabled,
        codePrefix,
        referrerRewardEur: parseFloat(referrerRewardEur.replace(',', '.')) || 0,
        referredRewardEur: parseFloat(referredRewardEur.replace(',', '.')) || 0,
        referrerReward30tdEur: referrerReward30tdEur.trim()
          ? parseFloat(referrerReward30tdEur.replace(',', '.'))
          : null,
        referredReward30tdEur: referredReward30tdEur.trim()
          ? parseFloat(referredReward30tdEur.replace(',', '.'))
          : null,
        allowedTariffs,
        triggerMilestone,
        minActiveDays: parseInt(minActiveDays, 10) || 0,
        cooldownMonthsSameCups: parseInt(cooldownMonthsSameCups, 10) || 0,
        allowSelfReferral,
        blockSameIban,
        maxReferralsPerYear: maxReferralsPerYear.trim() ? parseInt(maxReferralsPerYear, 10) : null,
        maxAnnualRewardEur: Math.min(300, Math.max(1, parseFloat(maxAnnualRewardEur.replace(',', '.')) || 300)),
        creditExpirationMonths: creditExpirationMonths.trim() ? parseInt(creditExpirationMonths, 10) : null,
        zeroChannelCommission,
        legalTermsUrl: legalTermsUrl.trim() || null,
      });

      if (!res.success) {
        alert(res.error || 'No se pudo guardar la configuración');
        return;
      }
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3500);
      await loadConfig();
    } finally {
      setSaving(false);
    }
  };

  const handleBackfill = async () => {
    try {
      setBackfilling(true);
      setBackfillMsg(null);
      const res = await backfillBrandReferralCodesAction(brandId || undefined);
      if (!res.success) {
        alert(res.error || 'Error generando códigos');
        return;
      }
      setBackfillMsg(`Se han generado ${res.generatedCount ?? 0} nuevos códigos únicos para la cartera activa.`);
      await loadConfig();
    } finally {
      setBackfilling(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <Loader2 size={24} color="var(--lime)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cargando configuración Plan Amigo...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Cabecera e interruptor principal */}
      <div className="card animate-fade-in-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--lime-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gift size={20} color="var(--lime)" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>
                Programa «Plan Amigo» — {brandName || 'Marca Activa'}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Configuración aislada por marca. Los cambios aplican a nuevas invitaciones sin alterar contratos previos (Snapshot).
              </p>
            </div>
          </div>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              borderRadius: '999px',
              border: `1px solid ${isEnabled ? 'var(--success)' : 'var(--border-strong)'}`,
              background: isEnabled ? 'rgba(34, 197, 94, 0.12)' : 'var(--bg-elevated)',
              cursor: canEdit ? 'pointer' : 'not-allowed',
            }}
          >
            <input
              type="checkbox"
              checked={isEnabled}
              disabled={!canEdit}
              onChange={(e) => setIsEnabled(e.target.checked)}
              style={{ accentColor: '#22C55E', width: '16px', height: '16px' }}
            />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isEnabled ? 'var(--success)' : 'var(--text-secondary)' }}>
              {isEnabled ? 'Plan Amigo ACTIVO' : 'Plan Amigo DESACTIVADO'}
            </span>
          </label>
        </div>

        {isEnabled && !hasPublicInviteDomain && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#FCD34D',
              fontSize: '0.78rem',
            }}
          >
            Esta marca aún no tiene un <strong>Dominio Público Web</strong> configurado en su ficha de Marca. Los clientes verán y podrán compartir su código alfanumérico, pero para generar enlaces directos <code>/contratar?ref=...</code> configura el dominio web de la comercializadora.
          </div>
        )}
      </div>

      {/* Importes y Tarifas */}
      <div className="card animate-fade-in-up">
        <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 700 }}>
          1. Incentivos Económicos y Tarifas Admitidas
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          <div>
            <label className="form-label">Prefijo de Códigos</label>
            <input
              className="form-input"
              disabled={!canEdit}
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
              placeholder="ej. AED-"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ej.: <code>AED-JUAN7K9P</code>
            </p>
          </div>

          <div>
            <label className="form-label">Premio Padrino 2.0TD (€)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="form-input"
              disabled={!canEdit}
              value={referrerRewardEur}
              onChange={(e) => setReferrerRewardEur(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Premio Invitado 2.0TD (€)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="form-input"
              disabled={!canEdit}
              value={referredRewardEur}
              onChange={(e) => setReferredRewardEur(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Premio Padrino 3.0TD+ (€ opc.)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="form-input"
              disabled={!canEdit}
              value={referrerReward30tdEur}
              onChange={(e) => setReferrerReward30tdEur(e.target.value)}
              placeholder="Igual que 2.0TD si vacío"
            />
          </div>

          <div>
            <label className="form-label">Premio Invitado 3.0TD+ (€ opc.)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="form-input"
              disabled={!canEdit}
              value={referredReward30tdEur}
              onChange={(e) => setReferredReward30tdEur(e.target.value)}
              placeholder="Igual que 2.0TD si vacío"
            />
          </div>
        </div>

        <div style={{ marginTop: '18px' }}>
          <label className="form-label">Tarifas ATR elegibles</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
            {AVAILABLE_TARIFFS.map((t) => {
              const active = allowedTariffs.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleTariff(t)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: canEdit ? 'pointer' : 'not-allowed',
                    border: active ? '1px solid var(--lime)' : '1px solid var(--border-strong)',
                    background: active ? 'var(--lime-glow)' : 'var(--bg-elevated)',
                    color: active ? 'var(--lime)' : 'var(--text-secondary)',
                  }}
                >
                  {active ? '✓ ' : ''}{t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Consolidación ATR y Antifraude */}
      <div className="card animate-fade-in-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ShieldCheck size={17} color="var(--lime)" />
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>
            2. Hito de Consolidación ATR y Reglas Antifraude
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div>
            <label className="form-label">Hito de Liberación de Saldo</label>
            <select
              className="form-input"
              disabled={!canEdit}
              value={triggerMilestone}
              onChange={(e) => setTriggerMilestone(e.target.value as any)}
            >
              <option value="ON_DAYS_ACTIVE">Tras X días ACTIVO en distribuidora (Recomendado)</option>
              <option value="ON_ATR_ACTIVATION">Inmediato al activar ATR (Paso 05)</option>
              <option value="ON_FIRST_ISSUED_INVOICE">Al emitir la 1.ª factura real del contrato</option>
            </select>
          </div>

          <div>
            <label className="form-label">Días mínimos ACTIVO (cubre E1 14d)</label>
            <input
              type="number"
              min="0"
              className="form-input"
              disabled={!canEdit || triggerMilestone !== 'ON_DAYS_ACTIVE'}
              value={minActiveDays}
              onChange={(e) => setMinActiveDays(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Enfriamiento mismo CUPS (meses)</label>
            <input
              type="number"
              min="0"
              className="form-input"
              disabled={!canEdit}
              value={cooldownMonthsSameCups}
              onChange={(e) => setCooldownMonthsSameCups(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Tope invitaciones / año por Padrino</label>
            <input
              type="number"
              min="1"
              className="form-input"
              disabled={!canEdit}
              value={maxReferralsPerYear}
              onChange={(e) => setMaxReferralsPerYear(e.target.value)}
              placeholder="Ej. 12 (sin límite de uds. si vacío)"
            />
          </div>

          <div>
            <label className="form-label">Tope anual € / Padrino (máx. legal 300 €)</label>
            <input
              type="number"
              step="1"
              min="1"
              max="300"
              className="form-input"
              disabled={!canEdit}
              value={maxAnnualRewardEur}
              onChange={(e) => {
                const raw = e.target.value;
                const num = parseFloat(raw.replace(',', '.'));
                if (!Number.isNaN(num) && num > 300) {
                  setMaxAnnualRewardEur('300');
                } else {
                  setMaxAnnualRewardEur(raw);
                }
              }}
            />
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Blindaje fiscal Art. 75.3.f RIRPF (&le; 300,00 €/año natural sin retención IRPF).
            </p>
          </div>

          <div>
            <label className="form-label">Caducidad del saldo (meses)</label>
            <input
              type="number"
              min="1"
              className="form-input"
              disabled={!canEdit}
              value={creditExpirationMonths}
              onChange={(e) => setCreditExpirationMonths(e.target.value)}
              placeholder="No caduca si vacío"
            />
          </div>

          <div>
            <label className="form-label">URL Bases Legales Públicas</label>
            <input
              className="form-input"
              disabled={!canEdit}
              value={legalTermsUrl}
              onChange={(e) => setLegalTermsUrl(e.target.value)}
              placeholder="https://www.aed-energia.com/condiciones-generales#plan-amigo"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '18px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', cursor: canEdit ? 'pointer' : 'default' }}>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={!allowSelfReferral}
              onChange={(e) => setAllowSelfReferral(!e.target.checked)}
            />
            <span>Bloquear auto-recomendación (mismo NIF/CIF)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', cursor: canEdit ? 'pointer' : 'default' }}>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={blockSameIban}
              onChange={(e) => setBlockSameIban(e.target.checked)}
            />
            <span>Bloquear mismo IBAN bancario entre Padrino e Invitado</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', cursor: canEdit ? 'pointer' : 'default' }}>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={zeroChannelCommission}
              onChange={(e) => setZeroChannelCommission(e.target.checked)}
            />
            <span>Comisión 0 € al canal web en contratos con Plan Amigo (evita doble CAC)</span>
          </label>
        </div>
      </div>

      {/* Backfill de cartera activa */}
      <div className="card animate-fade-in-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.9rem', fontWeight: 700 }}>
            3. Cartera Activa y Generación Masiva de Códigos
          </h3>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Clientes con contrato vigente sin código asignado en esta marca:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{missingCodesCount}</strong>
          </p>
          {backfillMsg && (
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>
              {backfillMsg}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <a href="/plan-amigo" className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <ExternalLink size={14} /> Ver Centro Plan Amigo
          </a>
          {canEdit && (
            <button
              type="button"
              className="btn-ghost"
              disabled={backfilling}
              onClick={handleBackfill}
              style={{ border: '1px solid var(--border-strong)', fontSize: '0.8rem' }}
            >
              <Sparkles size={14} />
              {backfilling ? 'Generando códigos...' : 'Generar códigos para clientes activos sin código'}
            </button>
          )}
        </div>
      </div>

      {/* Botón Guardar */}
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          {savedOk && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Configuración guardada
            </span>
          )}
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar Configuración Plan Amigo'}
          </button>
        </div>
      )}
    </div>
  );
}
