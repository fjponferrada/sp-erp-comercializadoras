'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Eye,
  Save,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Sparkles,
  History,
  RotateCcw,
  Sliders,
  BookOpen,
  Scale,
  X,
  Download,
} from 'lucide-react';
import {
  AVAILABLE_TEMPLATE_VARIABLES,
  BrandTemplatePayload,
  CLAUSE_VISIBILITY_LABELS,
  ClauseVisibilityScope,
  ContractClauseItem,
  resolveCompanyJurisdictionCity,
} from '@/lib/contracts/defaultClauses';
import {
  getFactoryDefaultTemplatePayloadAction,
  loadSpecificTemplateVersionAction,
  publishContractTemplateVersionAction,
  saveContractTemplateDraftAction,
  updateBrandLegalAndSignatureConfigAction,
} from '@/app/actions/contractTemplateActions';

type PreviewMode = 'CORE' | 'B2B' | 'RESUMEN_CORE' | 'RESUMEN_B2B' | 'MODTEC' | 'SUBROGACION';

export default function ClauseEditorClient({
  brand,
  company,
  initialPayload,
  publishedVersion,
  draftVersion,
  initialHistory,
}: {
  brand: any;
  company: any;
  initialPayload: BrandTemplatePayload;
  publishedVersion: any;
  draftVersion: any;
  initialHistory: any[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'clauses' | 'particular' | 'summary' | 'signature'>('clauses');
  const [payload, setPayload] = useState<BrandTemplatePayload>(initialPayload);
  const [selectedClauseIdx, setSelectedClauseIdx] = useState<number>(0);
  const [versionNotes, setVersionNotes] = useState<string>(draftVersion?.notes || '');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Legal & Signature Config State
  const [legalConfig, setLegalConfig] = useState({
    freePhone900: brand.freePhone900 || brand.phone || '',
    supportEmail: brand.supportEmail || brand.email || '',
    withdrawalEmail: brand.withdrawalEmail || brand.supportEmail || brand.email || '',
    smsSenderId: brand.smsSenderId || '',
    signatureFlowMode: brand.signatureFlowMode || 'SEQUENTIAL_SINGLE_LINK',
    allowQualifiedCertUploadB2B: brand.allowQualifiedCertUploadB2B ?? true,
    envelopeExpirationDays: brand.envelopeExpirationDays ?? 14,
    sepaCreditorId: company?.sepaCreditorId || '',
    dpoEmail: company?.dpoEmail || '',
    jurisdictionCity: resolveCompanyJurisdictionCity(company, brand),
    companyAddress: company?.address || '',
    registroMercantil: company?.registroMercantil || '',
  });

  // Live PDF Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('CORE');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const clauses = payload.clauses || [];
  const activeClause: ContractClauseItem | undefined = clauses[selectedClauseIdx];

  const updateClause = (idx: number, patch: Partial<ContractClauseItem>) => {
    setPayload((prev) => {
      const next = [...prev.clauses];
      if (!next[idx]) return prev;
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, clauses: next };
    });
  };

  const moveClause = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= clauses.length) return;
    setPayload((prev) => {
      const next = [...prev.clauses];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return {
        ...prev,
        clauses: next.map((c, i) => ({ ...c, order: i + 1 })),
      };
    });
    setSelectedClauseIdx(target);
  };

  const addClause = () => {
    const newClause: ContractClauseItem = {
      id: `cl-custom-${Date.now()}`,
      order: clauses.length + 1,
      title: 'NUEVA CLÁUSULA CONTRACTUAL',
      body: 'Redacte aquí el contenido íntegro de la cláusula. Puede insertar variables dinámicas como {{company.name}} o {{brand.supportEmail}}.',
      visibilityScope: 'ALL',
      enabled: true,
    };
    setPayload((prev) => ({
      ...prev,
      clauses: [...prev.clauses, newClause],
    }));
    setSelectedClauseIdx(clauses.length);
  };

  const removeClause = (idx: number) => {
    if (!confirm(`¿Eliminar la cláusula "${clauses[idx]?.title}"?`)) return;
    setPayload((prev) => {
      const next = prev.clauses.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order: i + 1 }));
      return { ...prev, clauses: next };
    });
    setSelectedClauseIdx(Math.max(0, idx - 1));
  };

  const insertVariableInActiveClause = (token: string) => {
    if (!activeClause) return;
    updateClause(selectedClauseIdx, {
      body: `${activeClause.body}${activeClause.body.endsWith(' ') ? '' : ' '}${token}`,
    });
    toast.success(`Variable ${token} añadida al final de la cláusula`);
  };

  const openPdfPreview = async (modeToLoad: PreviewMode) => {
    setPreviewOpen(true);
    setPreviewMode(modeToLoad);
    setIsLoadingPreview(true);
    try {
      const res = await fetch('/api/contracts/template-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brand.id,
          mode: modeToLoad,
          payload,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error generando vista previa PDF');
      }
      const blob = await res.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err: any) {
      toast.error(err.message || 'Error cargando PDF');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    const tId = toast.loading('Guardando borrador de plantilla...');
    const res = await saveContractTemplateDraftAction(brand.id, payload, {
      notes: versionNotes || undefined,
    });
    setIsSavingDraft(false);
    if (res.success) {
      toast.success(`Borrador v${res.versionNumber} guardado correctamente`, { id: tId });
      router.refresh();
    } else {
      toast.error(res.error || 'Error al guardar borrador', { id: tId });
    }
  };

  const handlePublish = async () => {
    if (
      !confirm(
        '¿Publicar esta versión como la nueva plantilla oficial en vigor? Todos los nuevos contratos de esta comercializadora usarán estas cláusulas inmediatamente.'
      )
    ) {
      return;
    }
    setIsPublishing(true);
    const tId = toast.loading('Publicando nueva versión oficial...');
    const res = await publishContractTemplateVersionAction(brand.id, payload, {
      notes: versionNotes || 'Actualización publicada desde el Editor Modular de Cláusulas',
    });
    setIsPublishing(false);
    if (res.success) {
      toast.success(`Versión v${res.versionNumber} publicada y activa en producción`, { id: tId });
      router.refresh();
    } else {
      toast.error(res.error || 'Error al publicar versión', { id: tId });
    }
  };

  const handleSaveLegalConfig = async () => {
    setIsSavingConfig(true);
    const tId = toast.loading('Guardando configuración legal y motor de firma...');
    const res = await updateBrandLegalAndSignatureConfigAction(brand.id, legalConfig);
    setIsSavingConfig(false);
    if (res.success) {
      toast.success('Configuración de firma digital y datos societarios actualizada', { id: tId });
      router.refresh();
    } else {
      toast.error(res.error || 'Error al guardar configuración', { id: tId });
    }
  };

  const handleLoadVersion = async (versionId: string) => {
    if (!versionId) return;
    const tId = toast.loading('Cargando versión en el editor...');
    const res = await loadSpecificTemplateVersionAction(brand.id, versionId);
    if (res.success && res.payload) {
      setPayload(res.payload);
      setSelectedClauseIdx(0);
      toast.success(`Cargada versión v${res.versionNumber} en el editor`, { id: tId });
    } else {
      toast.error(res.error || 'No se pudo cargar la versión', { id: tId });
    }
  };

  const handleResetFactory = async () => {
    if (
      !confirm(
        '¿Cargar en el editor la plantilla base estándar (CORE + B2B)? No se publicará hasta que pulses Guardar o Publicar.'
      )
    ) {
      return;
    }
    const res = await getFactoryDefaultTemplatePayloadAction(brand.id);
    if (res.success && res.payload) {
      setPayload(res.payload);
      setSelectedClauseIdx(0);
      toast.success('Cláusulas base cargadas en el editor');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '64px' }}>
      <Topbar
        title={`Cláusulas y Motor de Firma · ${brand.name}`}
        subtitle={`${company?.name || ''} (${company?.cif || ''})`}
        showSearch={false}
        customActions={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => router.push('/marcas')} className="btn-ghost flex items-center gap-1.5 text-xs">
              <ArrowLeft size={15} /> Volver a Marcas
            </button>

            <button
              type="button"
              onClick={() => openPdfPreview('CORE')}
              className="btn-secondary flex items-center gap-1.5 text-xs border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
            >
              <Eye size={15} /> Vista Previa PDF
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isPublishing}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <Save size={15} /> {isSavingDraft ? 'Guardando...' : 'Guardar Borrador'}
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || isSavingDraft}
              className="btn-primary flex items-center gap-1.5 text-xs"
            >
              <CheckCircle2 size={15} /> {isPublishing ? 'Publicando...' : 'Publicar Versión Oficial'}
            </button>
          </div>
        }
      />

      <div className="max-w-[1550px] mx-auto px-6 py-6 space-y-6">
        {/* STATUS & VERSION BAR */}
        <div className="card p-4 flex flex-wrap items-center justify-between gap-4 border border-[var(--border)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: brand.accentColor || 'var(--lime)' }}
              />
              <span className="font-bold text-white text-sm">{brand.name}</span>
            </div>

            {publishedVersion && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                En producción: v{publishedVersion.versionNumber}
              </span>
            )}

            {draftVersion && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Editando Borrador: v{draftVersion.versionNumber}
              </span>
            )}

            <span className="text-xs text-slate-400">
              {clauses.filter((c) => c.enabled !== false).length} cláusulas activas ({clauses.filter((c) => c.visibilityScope === 'B2B_ONLY').length} exclusivas B2B)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {initialHistory.length > 0 && (
              <div className="flex items-center gap-1.5">
                <History size={14} className="text-slate-400" />
                <select
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleLoadVersion(e.target.value);
                  }}
                >
                  <option value="" disabled>
                    Cargar versión anterior ({initialHistory.length})...
                  </option>
                  {initialHistory.map((h) => (
                    <option key={h.id} value={h.id}>
                      v{h.versionNumber} ({h.status}) — {h.name || 'Plantilla'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleResetFactory}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1.5 border border-slate-700"
              title="Restaurar en el editor el clausulado base estándar (CORE + B2B)"
            >
              <RotateCcw size={13} /> Restaurar Base
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3">
          {[
            { id: 'clauses', label: '1. Cláusulas Generales (CORE / B2B)', icon: BookOpen },
            { id: 'particular', label: '2. Condiciones Particulares, Autoconsumo y SEPA', icon: FileText },
            { id: 'summary', label: '3. Documento Resumen (RD 88/2026)', icon: Scale },
            { id: 'signature', label: '4. Motor de Firma Digital y Datos Legales', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  active
                    ? 'bg-[var(--lime)] text-black shadow'
                    : 'bg-[var(--bg-elevated)] text-slate-300 hover:text-white border border-[var(--border)]'
                }`}
              >
                <Icon size={15} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: MODULAR CLAUSE EDITOR */}
        {activeTab === 'clauses' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar: Ordered Clause List */}
            <div className="lg:col-span-4 card p-4 flex flex-col gap-3 max-h-[78vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <div>
                  <h3 className="text-sm font-bold text-white">Índice de Cláusulas</h3>
                  <p className="text-[11px] text-slate-400">Orden y ámbito condicional de aplicación</p>
                </div>
                <button
                  type="button"
                  onClick={addClause}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--lime)] text-black font-bold text-xs flex items-center gap-1 hover:opacity-90"
                >
                  <Plus size={14} /> Añadir
                </button>
              </div>

              <div className="space-y-2">
                {clauses.map((c, idx) => {
                  const isSelected = idx === selectedClauseIdx;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClauseIdx(idx)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-800/90 border-[var(--lime)]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border)] hover:border-slate-600'
                      } ${c.enabled === false ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {idx + 1}. {c.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                c.visibilityScope === 'ALL'
                                  ? 'bg-slate-700 text-slate-200'
                                  : c.visibilityScope === 'B2B_ONLY'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : c.visibilityScope === 'CONSUMER_ONLY'
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {CLAUSE_VISIBILITY_LABELS[c.visibilityScope] || c.visibilityScope}
                            </span>
                            {c.enabled === false && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                                Desactivada
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => moveClause(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-25"
                            title="Subir cláusula"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveClause(idx, 1)}
                            disabled={idx === clauses.length - 1}
                            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-25"
                            title="Bajar cláusula"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Main Panel: Clause Content Editor */}
            <div className="lg:col-span-8 card p-6 flex flex-col gap-4">
              {activeClause ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--lime)] text-black font-bold text-xs">
                        Cláusula #{selectedClauseIdx + 1}
                      </span>
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeClause.enabled !== false}
                          onChange={(e) => updateClause(selectedClauseIdx, { enabled: e.target.checked })}
                          className="rounded border-slate-600 bg-slate-900"
                        />
                        Cláusula activa
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeClause(selectedClauseIdx)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs flex items-center gap-1.5"
                    >
                      <Trash2 size={13} /> Eliminar cláusula
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Título de la Cláusula
                      </label>
                      <input
                        type="text"
                        value={activeClause.title}
                        onChange={(e) => updateClause(selectedClauseIdx, { title: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Ámbito de Aplicación
                      </label>
                      <select
                        value={activeClause.visibilityScope}
                        onChange={(e) =>
                          updateClause(selectedClauseIdx, {
                            visibilityScope: e.target.value as ClauseVisibilityScope,
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                      >
                        {(Object.keys(CLAUSE_VISIBILITY_LABELS) as ClauseVisibilityScope[]).map((scope) => (
                          <option key={scope} value={scope}>
                            {CLAUSE_VISIBILITY_LABELS[scope]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-400">
                        Variables Dinámicas Multi-Comercializadora (clic para insertar)
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Separa párrafos con doble salto de línea
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3 p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                      {AVAILABLE_TEMPLATE_VARIABLES.map((v) => (
                        <button
                          key={v.token}
                          type="button"
                          onClick={() => insertVariableInActiveClause(v.token)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono text-amber-300 transition-colors"
                          title={`${v.label} (Ej: ${v.example})`}
                        >
                          {v.token}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={16}
                      value={activeClause.body}
                      onChange={(e) => updateClause(selectedClauseIdx, { body: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs leading-relaxed text-slate-100 font-mono"
                    />
                  </div>

                  <div className="pt-2 border-t border-[var(--border)]">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Nota de control de cambios de esta versión (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Actualización cláusula 12 DPD o ajuste fuero B2B..."
                      value={versionNotes}
                      onChange={(e) => setVersionNotes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-slate-400 text-sm">
                  Selecciona una cláusula a la izquierda o pulsa &quot;Añadir&quot;.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PARTICULAR CONDITIONS, AUTOCONSUMO & SEPA */}
        {activeTab === 'particular' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <Sliders size={17} className="text-[var(--lime)]" /> Condiciones Particulares y Fórmulas
              </h3>

              {[
                { key: 'paperInvoiceFeeLabel', label: 'Coste Factura en Papel', rows: 1 },
                { key: 'invoiceDeliveryNote', label: 'Nota Envío de Facturas', rows: 2 },
                { key: 'sepaCoreAuthNote', label: 'Texto Domiciliación Particular (SEPA CORE)', rows: 3 },
                { key: 'sepaB2BAuthNote', label: 'Texto Domiciliación Empresa/Autónomo (SEPA B2B)', rows: 2 },
                { key: 'fixedPriceGuaranteeText', label: 'Garantía de Precio Fijo Real', rows: 3 },
                { key: 'indexedFormulaExpression', label: 'Fórmula Precio Indexado (Expresión Matemática)', rows: 1 },
                { key: 'indexedFormulaLegend', label: 'Leyenda Componentes Fórmula Indexada', rows: 4 },
                { key: 'penaltyLowVoltageText', label: 'Penalización Baja Tensión', rows: 2 },
                { key: 'penaltyHighVoltageText', label: 'Penalización Alta Tensión (6.X TD)', rows: 2 },
                { key: 'adminFeeConsumerText', label: 'Gestión Administrativa y Desistimiento 14 días (Consumidor)', rows: 3 },
                { key: 'adminFeeB2BText', label: 'Gestión Administrativa (B2B)', rows: 2 },
                { key: 'takeOrPayText', label: 'Cláusula Take or Pay (Consumo Mínimo Garantizado)', rows: 3 },
                { key: 'greenCommitmentText', label: 'Compromiso Suministro 100% Renovable (GdOs)', rows: 4 },
                { key: 'bonoSocialConsumerNote', label: 'Información sobre Bono Social (Consumidores)', rows: 4 },
              ].map((field) => (
                <div key={field.key} className="space-y-2">
                  {field.key === 'takeOrPayText' && (
                    <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-700/80">
                      <label className="block text-xs font-semibold text-amber-300 mb-1">
                        Ámbito de Aplicación — Cláusula Take or Pay
                      </label>
                      <select
                        value={payload.particularConfig.takeOrPayScope || 'B2B_ONLY'}
                        onChange={(e) =>
                          setPayload((prev) => ({
                            ...prev,
                            particularConfig: {
                              ...prev.particularConfig,
                              takeOrPayScope: e.target.value as 'B2B_ONLY' | 'ALL' | 'DISABLED',
                            },
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="B2B_ONLY">
                          Solo en B2B (Empresas y Autónomos) — Excluido en Consumidor CORE
                        </option>
                        <option value="DISABLED">
                          No aplicar nunca (Desactivado en CORE y B2B)
                        </option>
                        <option value="ALL">
                          Aplicar en todos los contratos (CORE y B2B)
                        </option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{field.label}</label>
                    <textarea
                      rows={field.rows}
                      disabled={field.key === 'takeOrPayText' && payload.particularConfig.takeOrPayScope === 'DISABLED'}
                      value={(payload.particularConfig as any)[field.key] || ''}
                      onChange={(e) =>
                        setPayload((prev) => ({
                          ...prev,
                          particularConfig: {
                            ...prev.particularConfig,
                            [field.key]: e.target.value,
                          },
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white disabled:opacity-40"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div className="card p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <Sparkles size={17} className="text-amber-400" /> Anexo de Autoconsumo y Bolsillo Solar
                </h3>

                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payload.annexAutoconsumo.alwaysIncludeAnnex}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        annexAutoconsumo: {
                          ...prev.annexAutoconsumo,
                          alwaysIncludeAnnex: e.target.checked,
                        },
                      }))
                    }
                  />
                  Incluir siempre el Anexo de Autoconsumo y Bolsillo Solar en todos los contratos (igual que CORE/B2B actual)
                </label>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Fórmula Valoración Excedentes
                  </label>
                  <input
                    type="text"
                    value={payload.annexAutoconsumo.surplusFormulaExpression}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        annexAutoconsumo: {
                          ...prev.annexAutoconsumo,
                          surplusFormulaExpression: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Condiciones de la Compensación de Excedentes
                  </label>
                  <textarea
                    rows={5}
                    value={payload.annexAutoconsumo.compensationConditionsText}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        annexAutoconsumo: {
                          ...prev.annexAutoconsumo,
                          compensationConditionsText: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Normas de Funcionamiento del Bolsillo Solar (Batería Virtual)
                  </label>
                  <textarea
                    rows={7}
                    value={payload.annexAutoconsumo.solarWalletConditionsText}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        annexAutoconsumo: {
                          ...prev.annexAutoconsumo,
                          solarWalletConditionsText: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="card p-6 space-y-4">
                <h3 className="text-base font-bold text-white border-b border-[var(--border)] pb-3">
                  Órdenes de Domiciliación SEPA (CORE y B2B)
                </h3>

                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payload.sepaMandateConfig.includeBothInB2B}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        sepaMandateConfig: {
                          ...prev.sepaMandateConfig,
                          includeBothInB2B: e.target.checked,
                        },
                      }))
                    }
                  />
                  En contratos B2B, incluir tanto mandato SEPA B2B como mandato SEPA CORE (doble cobertura bancaria)
                </label>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Texto Autorización Mandato SEPA CORE (8 semanas reembolso)
                  </label>
                  <textarea
                    rows={4}
                    value={payload.sepaMandateConfig.coreAuthorizationText}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        sepaMandateConfig: {
                          ...prev.sepaMandateConfig,
                          coreAuthorizationText: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Texto Autorización Mandato SEPA B2B (Empresas y Autónomos)
                  </label>
                  <textarea
                    rows={4}
                    value={payload.sepaMandateConfig.b2bAuthorizationText}
                    onChange={(e) =>
                      setPayload((prev) => ({
                        ...prev,
                        sepaMandateConfig: {
                          ...prev.sepaMandateConfig,
                          b2bAuthorizationText: e.target.value,
                        },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SUMMARY DOCUMENT RD 88/2026 */}
        {activeTab === 'summary' && (
          <div className="card p-6 max-w-4xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Configuración del Documento Resumen Precontractual Independiente (RD 88/2026)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Este PDF independiente se presenta obligatoriamente antes de permitir la firma del contrato.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openPdfPreview('RESUMEN_CORE')}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Eye size={14} /> Previsualizar Resumen PDF
              </button>
            </div>

            {[
              { key: 'headerLegalSubtitle', label: 'Subtítulo Normativo de Cabecera', rows: 2 },
              { key: 'withdrawalRightConsumerText', label: 'Derecho de Desistimiento 14 días (Consumidores)', rows: 3 },
              { key: 'withdrawalRightB2BText', label: 'Nota Régimen Empresarial / No Consumidor (B2B)', rows: 3 },
              { key: 'bonoSocialWarningText', label: 'Advertencia Legal sobre Pérdida del Bono Social (PVPC)', rows: 3 },
              { key: 'claimsAndSupportText', label: 'Canales Gratuitos de Atención al Cliente y Reclamaciones', rows: 3 },
              { key: 'priceTransparencyNote', label: 'Nota de Transparencia Fiscal y Cargos Regulados', rows: 2 },
            ].map((item) => (
              <div key={item.key}>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{item.label}</label>
                <textarea
                  rows={item.rows}
                  value={(payload.summaryConfig as any)[item.key] || ''}
                  onChange={(e) =>
                    setPayload((prev) => ({
                      ...prev,
                      summaryConfig: {
                        ...prev.summaryConfig,
                        [item.key]: e.target.value,
                      },
                    }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                />
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: DIGITAL SIGNATURE ENGINE & LEGAL PARAMETERS */}
        {activeTab === 'signature' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <ShieldCheck size={18} className="text-[var(--lime)]" /> Estrategia de Firma Electrónica de la Marca
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Flujo Precontractual Documento Resumen + Contrato (RD 88/2026)
                </label>
                <select
                  value={legalConfig.signatureFlowMode}
                  onChange={(e) => setLegalConfig({ ...legalConfig, signatureFlowMode: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                >
                  <option value="SEQUENTIAL_SINGLE_LINK">
                    Enlace Único en 2 Pasos Bloqueantes (Recomendado: Paso 1 Aceptar Resumen → Paso 2 Firmar Contrato)
                  </option>
                  <option value="TWO_STEP_SEPARATE_DELIVERY">
                    Doble Envío Separado (Estilo Unieléctrica: 1º Email Resumen → tras aceptar, 2º Email Contrato)
                  </option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  En ambos modos queda acreditado criptográficamente que la lectura y aceptación del Documento Resumen (`T1`) ocurrió antes de la firma del Contrato (`T2 &gt; T1`).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-700 space-y-2">
                <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={legalConfig.allowQualifiedCertUploadB2B}
                    onChange={(e) =>
                      setLegalConfig({ ...legalConfig, allowQualifiedCertUploadB2B: e.target.checked })
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="text-white block">
                      Habilitar subida opcional con Certificado Digital Cualificado (FNMT / Camerfirma / AutoFirma) en 3.0TD, 6.1TD y Personas Jurídicas
                    </strong>
                    <span className="text-slate-400 text-[11px]">
                      La Firma Digital Nativa (OTP + Rúbrica + Sello PAdES) se ofrece SIEMPRE como opción principal prioritaria para todas las tarifas (`2.0TD`, `3.0TD` y `6.1TD`). Esta opción añade una pestaña secundaria voluntaria para empresas que prefieran firmar el PDF con su certificado electrónico.
                    </span>
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Teléfono Gratuito 900 (Obligatorio RD 88/2026)
                  </label>
                  <input
                    type="text"
                    value={legalConfig.freePhone900}
                    onChange={(e) => setLegalConfig({ ...legalConfig, freePhone900: e.target.value })}
                    placeholder="900 525 826"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Remitente SMS OTP (máx. 11 caracteres)
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={legalConfig.smsSenderId}
                    onChange={(e) => setLegalConfig({ ...legalConfig, smsSenderId: e.target.value })}
                    placeholder="AEDEnergia"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Email Atención al Cliente
                  </label>
                  <input
                    type="email"
                    value={legalConfig.supportEmail}
                    onChange={(e) => setLegalConfig({ ...legalConfig, supportEmail: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Email Recepción Desistimientos (14 días)
                  </label>
                  <input
                    type="email"
                    value={legalConfig.withdrawalEmail}
                    onChange={(e) => setLegalConfig({ ...legalConfig, withdrawalEmail: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Caducidad del Enlace de Firma (días)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={legalConfig.envelopeExpirationDays}
                    onChange={(e) =>
                      setLegalConfig({
                        ...legalConfig,
                        envelopeExpirationDays: parseInt(e.target.value, 10) || 14,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <h3 className="text-base font-bold text-white border-b border-[var(--border)] pb-3">
                Datos Societarios y Variables Jurídicas de la Comercializadora
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Identificador Acreedor SEPA (Opcional)
                  </label>
                  <input
                    type="text"
                    value={legalConfig.sepaCreditorId}
                    onChange={(e) => setLegalConfig({ ...legalConfig, sepaCreditorId: e.target.value })}
                    placeholder="ES00000B10915544"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Email Delegado Protección de Datos (DPD)
                  </label>
                  <input
                    type="email"
                    value={legalConfig.dpoEmail}
                    onChange={(e) => setLegalConfig({ ...legalConfig, dpoEmail: e.target.value })}
                    placeholder="dpd@aed-energia.es"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Ciudad de Fuero / Juzgados del Domicilio Social (Contratos B2B)
                  </label>
                  <input
                    type="text"
                    value={legalConfig.jurisdictionCity}
                    onChange={(e) => setLegalConfig({ ...legalConfig, jurisdictionCity: e.target.value })}
                    placeholder="Córdoba (se deduce automáticamente del domicilio social si se deja vacío)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Domicilio Social (Impreso en Contratos y SEPA)
                  </label>
                  <input
                    type="text"
                    value={legalConfig.companyAddress}
                    onChange={(e) => setLegalConfig({ ...legalConfig, companyAddress: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Inscripción Registro Mercantil (Texto vertical lateral en todas las páginas)
                  </label>
                  <textarea
                    rows={2}
                    value={legalConfig.registroMercantil}
                    onChange={(e) => setLegalConfig({ ...legalConfig, registroMercantil: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveLegalConfig}
                  disabled={isSavingConfig}
                  className="btn-primary text-xs flex items-center gap-2"
                >
                  <Save size={15} /> {isSavingConfig ? 'Guardando...' : 'Guardar Configuración de Firma y Sociedad'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LIVE PDF PREVIEW MODAL */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'CORE', label: 'Contrato CORE (Particular)' },
                    { id: 'B2B', label: 'Contrato B2B (Empresa)' },
                    { id: 'RESUMEN_CORE', label: 'Resumen RD 88/2026 (CORE)' },
                    { id: 'RESUMEN_B2B', label: 'Resumen RD 88/2026 (B2B)' },
                    { id: 'MODTEC', label: 'Anexo Mod. Técnica' },
                    { id: 'SUBROGACION', label: 'Anexo Subrogación' },
                  ] as Array<{ id: PreviewMode; label: string }>
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openPdfPreview(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      previewMode === m.id
                        ? 'bg-[var(--lime)] text-black'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {previewUrl && (
                  <a
                    href={previewUrl}
                    download={`VistaPrevia_${brand.slug}_${previewMode}.pdf`}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white flex items-center gap-1.5"
                  >
                    <Download size={14} /> Descargar PDF
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 relative">
              {isLoadingPreview ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">
                  Renderizando PDF en tiempo real con el motor nativo...
                </div>
              ) : previewUrl ? (
                <iframe src={previewUrl} className="w-full h-full border-0" title="Vista previa PDF" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                  No se pudo cargar la previsualización.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
