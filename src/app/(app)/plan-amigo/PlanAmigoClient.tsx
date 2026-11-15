'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import {
  Gift,
  Copy,
  Check,
  Share2,
  Mail,
  Wallet,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  Search,
  ExternalLink,
  Award,
  Ban,
} from 'lucide-react';
import {
  adminUpdateReferralStatusAction,
  runReferralConsolidationAction,
} from '@/app/actions/referralActions';

function fmtEur(n: number) {
  return (Number(n) || 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'REWARDED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 size={12} /> Abonado
        </span>
      );
    case 'PENDING_ACTIVATION':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Clock size={12} /> En Activación ATR
        </span>
      );
    case 'PENDING_SIGNATURE':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
          <Clock size={12} /> Pendiente Firma
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <XCircle size={12} /> Cancelado
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{status}</span>;
  }
}

export default function PlanAmigoClient({
  initialData,
  initialFilters,
}: {
  initialData: any;
  initialFilters: { page: number; status: string; search: string };
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [searchInput, setSearchInput] = useState(initialFilters.search || '');
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || 'ALL');
  const [runningSync, setRunningSync] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA 1: PORTAL DEL CLIENTE ('CLIENT' — Invita y Gana)
  // ═══════════════════════════════════════════════════════════════════════════
  if (initialData?.mode === 'CLIENT') {
    if (!initialData.isEnabled && !initialData.hasPriorActivity) {
      return (
        <>
          <Topbar title="Invita y Gana" subtitle="Programa de recomendación" showSearch={false} />
          <div className="max-w-4xl mx-auto p-6">
            <div className="card text-center py-12">
              <Gift size={36} className="mx-auto mb-3 text-slate-500" />
              <h2 className="text-lg font-bold text-white mb-1">Programa no disponible actualmente</h2>
              <p className="text-sm text-slate-400">
                En este momento no hay ninguna promoción Plan Amigo activa para tu marca.
              </p>
            </div>
          </div>
        </>
      );
    }

    const portal = initialData.clientPortal;
    const brandInfo = initialData.brandInfo || {};
    const accent = brandInfo.accentColor || '#e8622a';
    const maxAnnualEur = Number(brandInfo.maxAnnualRewardEur || 300);

    if (!portal) {
      return (
        <>
          <Topbar title="Invita y Gana" subtitle={brandInfo.name} showSearch={false} />
          <div className="max-w-4xl mx-auto p-6">
            <div className="card text-center py-12">
              <p className="text-sm text-slate-300">
                Tu código personal se activará automáticamente en cuanto tu suministro esté dado de alta.
              </p>
            </div>
          </div>
        </>
      );
    }

    const handleCopy = (txt: string) => {
      if (!txt) return;
      navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    };

    const hasInviteLink = Boolean(portal.inviteLink);
    const whatsappText = encodeURIComponent(
      hasInviteLink
        ? `¡Pásate a ${brandInfo.name} con mi enlace de invitación y nos regalan ${brandInfo.referredRewardEur} € de descuento directo en la factura de luz a cada uno! Código: ${portal.referralCode} 👉 ${portal.inviteLink}`
        : `¡Pásate a ${brandInfo.name} con mi código Plan Amigo ${portal.referralCode} y nos regalan ${brandInfo.referredRewardEur} € de descuento directo en la factura de luz a cada uno!`
    );
    const mailSubject = encodeURIComponent(
      `Te regalo ${brandInfo.referredRewardEur} € en tu factura de luz con ${brandInfo.name}`
    );
    const mailBody = encodeURIComponent(
      hasInviteLink
        ? `¡Hola!\n\nEstoy en ${brandInfo.name} y si contratas con mi código Plan Amigo (${portal.referralCode}) nos descuentan ${brandInfo.referredRewardEur} € en nuestra factura eléctrica a cada uno:\n\n${portal.inviteLink}\n\n¡Un abrazo!`
        : `¡Hola!\n\nEstoy en ${brandInfo.name} y si contratas indicando mi código Plan Amigo (${portal.referralCode}) nos descuentan ${brandInfo.referredRewardEur} € en nuestra factura eléctrica a cada uno.\n\n¡Un abrazo!`
    );

    return (
      <>
        <Topbar
          title="Invita y Gana"
          subtitle={
            initialData.isEnabled
              ? `Comparte ${brandInfo.name} con tus amigos y ahorrad juntos en vuestra factura`
              : `Consulta el saldo acumulado de tu monedero Plan Amigo en ${brandInfo.name}`
          }
          showSearch={false}
        />

        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
          {/* Hero corporativo o aviso de campaña cerrada con monedero activo */}
          {initialData.isEnabled ? (
            <div
              className="rounded-3xl p-6 md:p-8 border relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${brandInfo.surfaceColor || '#111827'} 0%, ${brandInfo.bgColor || '#0B0F19'} 100%)`,
                borderColor: `${accent}55`,
              }}
            >
              <div className="max-w-2xl space-y-4">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                  style={{ background: `${accent}22`, color: accent }}
                >
                  <Gift size={14} /> Plan Amigo {brandInfo.name}
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                  Regala {fmtEur(brandInfo.referredRewardEur)} y llévate {fmtEur(brandInfo.referrerRewardEur)} por cada amigo que se sume
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Sin sorteos ni trámites: cuando el suministro de tu amigo se active y cumpla el periodo de consolidación,
                  abonamos el saldo en vuestros monederos y se descuenta automáticamente en vuestra próxima factura eléctrica
                  (hasta un máximo de {fmtEur(maxAnnualEur)} por año natural como padrino).
                  {brandInfo.referrerReward30tdEur ? (
                    <> En pymes y comunidades (<strong>3.0TD</strong>), ¡el premio sube a <strong>{fmtEur(brandInfo.referrerReward30tdEur)}</strong> para cada uno!</>
                  ) : null}
                </p>

                {/* Código y enlace */}
                <div className="pt-2 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-black/30 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-slate-400">Tu código personal</div>
                        <div className="font-mono text-lg font-extrabold tracking-widest text-white">
                          {portal.referralCode || 'PENDIENTE'}
                        </div>
                      </div>
                      {portal.referralCode && (
                        <button
                          onClick={() => handleCopy(portal.inviteLink || portal.referralCode)}
                          style={{ background: accent, color: '#0B0F19' }}
                          className="px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shrink-0 hover:opacity-90 transition"
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                          {copied
                            ? hasInviteLink
                              ? '¡Enlace copiado!'
                              : '¡Código copiado!'
                            : hasInviteLink
                              ? 'Copiar enlace'
                              : 'Copiar código'}
                        </button>
                      )}
                    </div>
                  </div>

                  {portal.referralCode && (
                    <div className="flex flex-wrap gap-2.5">
                      <a
                        href={`https://wa.me/?text=${whatsappText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-2 transition"
                      >
                        <Share2 size={14} /> Compartir por WhatsApp
                      </a>
                      <a
                        href={`mailto:?subject=${mailSubject}&body=${mailBody}`}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-bold inline-flex items-center gap-2 transition"
                      >
                        <Mail size={14} /> Enviar por Email
                      </a>
                      {brandInfo.legalTermsUrl && (
                        <a
                          href={brandInfo.legalTermsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"
                        >
                          Consultar bases legales <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
              <strong>Campaña de nuevas invitaciones cerrada temporalmente:</strong> Tu saldo disponible en el monedero Plan Amigo permanece intacto y seguirá descontándose de forma 100 % automática en tus próximas facturas eléctricas.
            </div>
          )}

          {/* KPIs personales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold mb-1">
                <span>Disponible próxima factura</span>
                <Wallet size={16} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-400">
                {fmtEur(portal.availableBalanceEur)}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold mb-1">
                <span>Total ahorrado hasta hoy</span>
                <CheckCircle2 size={16} className="text-sky-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">
                {fmtEur(portal.netSavedEur)}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold mb-1">
                <span>Amigos invitados</span>
                <Users size={16} className="text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">
                {portal.invites?.length || 0}
              </div>
            </div>
          </div>

          {/* Listado anonimizado de invitaciones */}
          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700/70">
              <h2 className="text-sm font-bold text-white">Estado de tus invitaciones</h2>
            </div>
            {portal.invites && portal.invites.length > 0 ? (
              <div className="divide-y divide-slate-700/50">
                {portal.invites.map((inv: any) => (
                  <div key={inv.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white text-sm">{inv.maskedName}</div>
                      <div className="text-xs text-slate-400">
                        Solicitud del {new Date(inv.createdAt).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-300">{inv.statusLabel}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-slate-400">
                Aún no tienes invitaciones registradas. ¡Comparte tu enlace arriba para empezar a acumular saldo!
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA 2: CENTRO OPERATIVO BACKOFFICE ERP
  // ═══════════════════════════════════════════════════════════════════════════
  const kpis = initialData?.kpis || {
    inProgressCount: 0,
    rewardedContractsCount: 0,
    totalIssuedEur: 0,
    outstandingLiabilityEur: 0,
  };
  const rows: any[] = initialData?.rows || [];
  const pagination = initialData?.pagination || { page: 1, totalPages: 1, totalCount: 0 };
  const cfg = initialData?.config || {};

  const applyFilters = (nextPage = 1, nextStatus = statusFilter, nextSearch = searchInput) => {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextStatus && nextStatus !== 'ALL') params.set('status', nextStatus);
    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    router.push(`/plan-amigo${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleConsolidateNow = async () => {
    try {
      setRunningSync(true);
      setSyncMessage(null);
      const res = await runReferralConsolidationAction();
      if (res.success && res.summary) {
        const s = res.summary;
        setSyncMessage(
          `Reconciliación completada: ${s.rewardedCount} premiadas, ${s.movedToPendingActivation} pasadas a activación, ${s.cancelledCount} canceladas, ${s.codesGenerated} nuevos códigos.`
        );
        router.refresh();
      }
    } finally {
      setRunningSync(false);
    }
  };

  const handleAdminRowAction = async (referralId: string, action: 'CANCEL' | 'FORCE_REWARD') => {
    const promptText =
      action === 'CANCEL'
        ? 'Indica el motivo de anulación de esta invitación (ej. Fraude detectado / Desistimiento):'
        : 'Motivo de liberación anticipada de los premios en monedero (quedará auditado):';
    const reason = window.prompt(promptText, action === 'CANCEL' ? 'ANULACION_BACKOFFICE' : 'LIBERACION_ANTICIPADA');
    if (reason === null) return;

    try {
      setBusyId(referralId);
      const res = await adminUpdateReferralStatusAction({ referralId, action, reason });
      if (!res.success) {
        alert(res.error || 'No se pudo completar la operación');
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Topbar
        title={`Plan Amigo · ${initialData?.brandName || 'Backoffice'}`}
        subtitle={
          cfg.isEnabled
            ? `Programa ACTIVO (${cfg.codePrefix} · ${fmtEur(cfg.referrerRewardEur)} + ${fmtEur(cfg.referredRewardEur)} · Tope ${fmtEur(cfg.maxAnnualRewardEur ?? 300)}/año · Consolidación ${cfg.minActiveDays}d)`
            : 'Programa DESACTIVADO en esta marca'
        }
        showSearch={false}
        customActions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleConsolidateNow}
              disabled={runningSync}
              className="btn-ghost flex items-center gap-2 text-xs"
            >
              <RefreshCw size={14} className={runningSync ? 'animate-spin' : ''} />
              {runningSync ? 'Consolidando...' : 'Consolidar hitos ATR'}
            </button>
            <Link href="/ajustes?tab=Plan+Amigo" className="btn-primary flex items-center gap-2 text-xs">
              <Settings size={14} /> Configurar Marca
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {syncMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-3 rounded-xl">
            {syncMessage}
          </div>
        )}

        {/* 4 KPIs Superiores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-xs text-slate-400 font-semibold uppercase mb-1">Invitaciones en trámite</div>
            <div className="text-2xl font-extrabold text-amber-300">{kpis.inProgressCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Pendientes de firma o consolidación ATR</div>
          </div>

          <div className="card">
            <div className="text-xs text-slate-400 font-semibold uppercase mb-1">Contratos consolidados</div>
            <div className="text-2xl font-extrabold text-emerald-400">{kpis.rewardedContractsCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Altas reales premiadas en esta marca</div>
          </div>

          <div className="card">
            <div className="text-xs text-slate-400 font-semibold uppercase mb-1">Saldo total emitido</div>
            <div className="text-2xl font-extrabold text-white">{fmtEur(kpis.totalIssuedEur)}</div>
            <div className="text-[11px] text-slate-500 mt-1">Suma histórica Padrinos + Invitados</div>
          </div>

          <div className="card">
            <div className="text-xs text-slate-400 font-semibold uppercase mb-1">Pasivo vivo por canjear</div>
            <div className="text-2xl font-extrabold text-sky-400">{fmtEur(kpis.outstandingLiabilityEur)}</div>
            <div className="text-[11px] text-slate-500 mt-1">Saldo disponible pendiente de descontar en factura</div>
          </div>
        </div>

        {/* Barra de búsqueda y filtro por estado */}
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters(1, statusFilter, searchInput);
            }}
            className="flex items-center gap-2 flex-1 min-w-[260px]"
          >
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="form-input pl-9 w-full"
                placeholder="Buscar por código AED-..., CUPS, NIF o nombre de Padrino / Invitado"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-ghost text-xs px-4 py-2 border border-slate-700">
              Filtrar
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'PENDING_SIGNATURE', label: 'Pte. Firma' },
              { id: 'PENDING_ACTIVATION', label: 'En Activación' },
              { id: 'REWARDED', label: 'Abonados' },
              { id: 'CANCELLED', label: 'Cancelados' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setStatusFilter(st.id);
                  applyFilters(1, st.id, searchInput);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === st.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/60'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla Paginada SSR */}
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Fecha</th>
                <th className="px-4 py-3.5">Código</th>
                <th className="px-4 py-3.5">Padrino</th>
                <th className="px-4 py-3.5">Invitado / CUPS</th>
                <th className="px-4 py-3.5">Contrato ATR</th>
                <th className="px-4 py-3.5 text-right">Snapshot Premios</th>
                <th className="px-4 py-3.5">Estado</th>
                {initialData?.canAdminActions && <th className="px-4 py-3.5 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3.5 text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-800 text-lime-300 border border-slate-700">
                      {r.code}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/clientes/${r.referrer.id}`} className="font-semibold text-white hover:text-indigo-400">
                      {r.referrer.name}
                    </Link>
                    <div className="text-xs text-slate-500 font-mono">{r.referrer.vatNumber}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    {r.referred.clientId ? (
                      <Link href={`/clientes/${r.referred.clientId}`} className="font-semibold text-white hover:text-indigo-400">
                        {r.referred.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-white">{r.referred.name}</span>
                    )}
                    <div className="text-xs text-slate-500 font-mono">{r.referredCups}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    {r.referred.contractId ? (
                      <Link
                        href={`/contratos/${r.referred.contractId}`}
                        className="text-xs font-mono text-indigo-400 hover:underline"
                      >
                        {r.referred.contractCode || r.referred.contractId.slice(-8)} · {r.referred.contractStatus}
                      </Link>
                    ) : r.referred.leadId ? (
                      <Link href={`/leads/${r.referred.leadId}`} className="text-xs text-slate-400 hover:underline">
                        Lead ({r.referred.contractStatus})
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-500">{r.referred.contractStatus}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">
                    <span className="text-emerald-400 font-bold">{fmtEur(r.referrerRewardEur)}</span>
                    {' + '}
                    <span className="text-sky-400 font-bold">{fmtEur(r.referredRewardEur)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={r.status} />
                    {r.cancelReason && (
                      <div className="text-[11px] text-rose-400/80 mt-0.5">{r.cancelReason}</div>
                    )}
                  </td>
                  {initialData?.canAdminActions && (
                    <td className="px-4 py-3.5 text-right">
                      {(r.status === 'PENDING_SIGNATURE' || r.status === 'PENDING_ACTIVATION') && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            disabled={busyId === r.id}
                            onClick={() => handleAdminRowAction(r.id, 'FORCE_REWARD')}
                            title="Liberar abonos anticipadamente"
                            className="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs inline-flex items-center gap-1"
                          >
                            <Award size={12} /> Abonar
                          </button>
                          <button
                            disabled={busyId === r.id}
                            onClick={() => handleAdminRowAction(r.id, 'CANCEL')}
                            title="Anular invitación"
                            className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs inline-flex items-center gap-1"
                          >
                            <Ban size={12} /> Anular
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 text-sm">
                    No se encontraron recomendaciones Plan Amigo con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Mostrando página {pagination.page} de {pagination.totalPages} ({pagination.totalCount} registros)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => applyFilters(pagination.page - 1)}
                className="btn-ghost px-3 py-1.5 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => applyFilters(pagination.page + 1)}
                className="btn-ghost px-3 py-1.5 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
