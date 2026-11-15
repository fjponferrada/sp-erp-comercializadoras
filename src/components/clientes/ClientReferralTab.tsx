'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Gift,
  Wallet,
  Copy,
  Check,
  Mail,
  PlusCircle,
  Loader2,
  ShieldAlert,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  createManualWalletAdjustmentAction,
  generateAndSendClientCodeAction,
  getClientReferralDetailAction,
  toggleClientReferralCodeAction,
} from '@/app/actions/referralActions';

function fmtEur(n: number) {
  return (Number(n) || 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

const TX_TYPE_LABELS: Record<string, string> = {
  CREDIT_REFERRER: 'Premio Padrino',
  CREDIT_REFERRED: 'Bienvenida Invitado',
  INVOICE_REDEMPTION: 'Descuento en Factura',
  INVOICE_REVERSAL: 'Reversión por Abono',
  EXPIRATION: 'Caducidad de Saldo',
  MANUAL_ADJUSTMENT: 'Ajuste Manual Auditado',
};

export default function ClientReferralTab({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [busyCode, setBusyCode] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNotes, setAdjNotes] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);

  const refreshData = async () => {
    setLoading(true);
    const res = await getClientReferralDetailAction(clientId);
    if (res.success) {
      setData(res);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleGenerateOrEmail = async (sendEmail: boolean) => {
    try {
      setBusyCode(true);
      setStatusMsg(null);
      const res = await generateAndSendClientCodeAction(clientId, sendEmail);
      if (!res.success) {
        alert(res.error || 'Error generando código');
        return;
      }
      setStatusMsg(
        sendEmail
          ? res.emailSent
            ? `Código ${res.code} enviado por email al titular.`
            : `Código ${res.code} listo (el cliente no tenía email válido o el envío está deshabilitado).`
          : `Código ${res.code} asignado correctamente.`
      );
      await refreshData();
    } finally {
      setBusyCode(false);
    }
  };

  const handleToggleActive = async (nextActive: boolean) => {
    const res = await toggleClientReferralCodeAction(clientId, nextActive);
    if (res.success) {
      await refreshData();
    } else {
      alert(res.error || 'Error cambiando estado del código');
    }
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(adjAmount.replace(',', '.'));
    if (!Number.isFinite(num) || Math.abs(num) < 0.01) {
      alert('Introduce un importe válido (+ para abonar, - para detraer).');
      return;
    }
    try {
      setSavingAdj(true);
      const res = await createManualWalletAdjustmentAction({
        clientId,
        amountEur: num,
        notes: adjNotes,
      });
      if (!res.success) {
        alert(res.error || 'No se pudo aplicar el ajuste');
        return;
      }
      setShowAdjustModal(false);
      setAdjAmount('');
      setAdjNotes('');
      await refreshData();
    } finally {
      setSavingAdj(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-10 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
        Cargando Plan Amigo y Monedero...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-8 text-center text-slate-400">
        No se pudo cargar la información del Plan Amigo.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Cabecera: Código Personal + Saldo Disponible */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloque Código Personal */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Gift className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Código Personal Plan Amigo</h3>
            </div>
            {data.referralCode && data.isBackoffice && (
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(data.referralCodeActive)}
                  onChange={(e) => handleToggleActive(e.target.checked)}
                />
                <span className={data.referralCodeActive ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {data.referralCodeActive ? 'Código habilitado' : 'Código bloqueado'}
                </span>
              </label>
            )}
          </div>

          {data.referralCode ? (
            <div className="space-y-3">
              <div className="bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-xl font-extrabold tracking-wider text-lime-300">
                    {data.referralCode}
                  </div>
                  {data.inviteLink && (
                    <div className="text-xs text-slate-400 truncate max-w-md">{data.inviteLink}</div>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(data.inviteLink || data.referralCode)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white inline-flex items-center gap-1.5 border border-slate-600"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? 'Copiado' : 'Copiar enlace'}
                </button>
              </div>

              {data.isBackoffice && (
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busyCode}
                    onClick={() => handleGenerateOrEmail(true)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Mail size={13} /> Enviar código por email al cliente
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Este cliente aún no tiene código Plan Amigo asignado.</p>
              {data.isBackoffice && (
                <button
                  disabled={busyCode}
                  onClick={() => handleGenerateOrEmail(false)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2"
                >
                  <Sparkles size={14} /> Generar código personal ahora
                </button>
              )}
            </div>
          )}

          {statusMsg && <p className="text-xs text-emerald-400 font-medium">{statusMsg}</p>}

          {data.invitedBy && (
            <div className="pt-3 border-t border-slate-700/60 text-xs text-slate-300">
              <span className="text-slate-400">Vino invitado por: </span>
              {data.isBackoffice ? (
                <Link
                  href={`/clientes/${data.invitedBy.referrerId}`}
                  className="font-semibold text-indigo-400 hover:underline"
                >
                  {data.invitedBy.referrerName}
                </Link>
              ) : (
                <span className="font-semibold text-white">{data.invitedBy.referrerName}</span>
              )}{' '}
              <span className="font-mono text-slate-400">({data.invitedBy.codeUsed})</span> · Estado:{' '}
              <span className="font-semibold">{data.invitedBy.status}</span>
            </div>
          )}
        </div>

        {/* Bloque Monedero Promocional */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Saldo Disponible en Monedero Plan Amigo
              </span>
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-400">
              {fmtEur(data.availableBalanceEur)}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Se descuenta automáticamente después de impuestos en la próxima factura eléctrica emitida, sin alterar bases de IVA ni Impuesto Eléctrico.
            </p>
          </div>

          {data.canManage && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAdjustModal(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <PlusCircle size={14} /> Ajuste manual auditado
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Amigos Invitados por este Cliente */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/60 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">
            Amigos invitados por este titular ({data.referralsMade?.length || 0})
          </h4>
        </div>
        {data.referralsMade && data.referralsMade.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Invitado</th>
                  <th className="px-6 py-3">CUPS</th>
                  <th className="px-6 py-3">Contrato</th>
                  <th className="px-6 py-3 text-right">Premio Padrino</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.referralsMade.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-6 py-3 text-xs text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-3 font-medium text-white">
                      {data.isBackoffice && r.referredClientId ? (
                        <Link href={`/clientes/${r.referredClientId}`} className="hover:text-indigo-400">
                          {r.referredName}
                        </Link>
                      ) : (
                        r.referredName
                      )}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">{r.cups}</td>
                    <td className="px-6 py-3 text-xs">
                      {data.isBackoffice && r.contractId ? (
                        <Link href={`/contratos/${r.contractId}`} className="text-indigo-400 hover:underline">
                          {r.contractCode || r.contractId.slice(-8)} ({r.contractStatus})
                        </Link>
                      ) : (
                        r.contractStatus
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-emerald-400">
                      {fmtEur(r.rewardEur)}
                    </td>
                    <td className="px-6 py-3 text-xs">
                      <span className="font-semibold">{r.status}</span>
                      {r.cancelReason && <span className="text-rose-400 ml-1">({r.cancelReason})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-slate-500">
            Este cliente todavía no ha traído ningún referido.
          </div>
        )}
      </div>

      {/* Libro Mayor (Ledger) del Monedero */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/60">
          <h4 className="text-sm font-bold text-white">Libro Mayor de Movimientos (Ledger Inmutable)</h4>
        </div>
        {data.ledger && data.ledger.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-900/50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Concepto</th>
                  <th className="px-6 py-3">Detalle / Factura</th>
                  <th className="px-6 py-3 text-right">Importe</th>
                  <th className="px-6 py-3 text-right">Saldo Resultante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.ledger.map((tx: any) => {
                  const isPos = Number(tx.amountEur) >= 0;
                  return (
                    <tr key={tx.id}>
                      <td className="px-6 py-3 text-xs text-slate-400">
                        {new Date(tx.createdAt).toLocaleString('es-ES')}
                      </td>
                      <td className="px-6 py-3 font-semibold text-xs">
                        <span className="inline-flex items-center gap-1">
                          {isPos ? (
                            <ArrowUpRight size={13} className="text-emerald-400" />
                          ) : (
                            <ArrowDownRight size={13} className="text-amber-400" />
                          )}
                          {TX_TYPE_LABELS[tx.type] || tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-300">
                        {tx.notes || '-'}
                        {tx.invoiceNumber && (
                          <span className="ml-2 font-mono text-indigo-400">[{tx.invoiceNumber}]</span>
                        )}
                      </td>
                      <td
                        className={`px-6 py-3 text-right font-mono font-bold ${
                          isPos ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {fmtEur(tx.amountEur)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-white">
                        {fmtEur(tx.balanceAfterEur)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-slate-500">
            No existen movimientos en el monedero promocional de este cliente.
          </div>
        )}
      </div>

      {/* Modal Ajuste Manual Auditado */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-300">
              <ShieldAlert size={18} />
              <h3 className="text-base font-bold text-white">Ajuste Manual Auditado</h3>
            </div>
            <p className="text-xs text-slate-400">
              Introduce un valor positivo (ej. <code>25</code>) para abonar saldo promocional o negativo (ej. <code>-25</code>) para detraerlo. Quedará registrado tu usuario y motivo en el Ledger.
            </p>
            <form onSubmit={handleSubmitAdjustment} className="space-y-4">
              <div>
                <label className="form-label">Importe del ajuste (€)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="form-input w-full"
                  placeholder="Ej. 25.00 o -10.00"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Motivo obligatorio para auditoría</label>
                <textarea
                  required
                  rows={3}
                  className="form-input w-full"
                  placeholder="Ej. Abono comercial excepcional autorizado por dirección..."
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={savingAdj} className="btn-primary text-xs px-4 py-2">
                  {savingAdj ? 'Registrando...' : 'Confirmar Asiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
