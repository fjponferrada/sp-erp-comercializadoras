'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Calculator,
  CheckCircle,
  FileText,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Download,
  Table,
  CheckSquare,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

function formatMadridStartEs(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
}

function formatMadridInclusiveEndEs(
  startInput?: string | Date | null,
  endInput?: string | Date | null
): string {
  if (!endInput) return '';
  const end = new Date(endInput);
  if (isNaN(end.getTime())) return '';
  if (startInput) {
    const start = new Date(startInput);
    if (!isNaN(start.getTime()) && end.getTime() - start.getTime() >= 20 * 3600 * 1000) {
      return new Date(end.getTime() - 12 * 3600 * 1000).toLocaleDateString('es-ES', {
        timeZone: 'Europe/Madrid',
      });
    }
  }
  return end.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
}

function extractDatosGeneralesF1(f1JsonData: any): any {
  if (!f1JsonData) return null;
  const f1Node =
    f1JsonData?.FacturaATR ||
    f1JsonData?.OtrasFacturas ||
    f1JsonData?.Facturas?.FacturaATR ||
    f1JsonData?.Facturas?.OtrasFacturas ||
    f1JsonData;
  return (
    f1Node?.DatosGeneralesFacturaATR?.DatosGeneralesFactura ||
    f1Node?.DatosGeneralesOtrasFacturas?.DatosGeneralesFactura ||
    f1Node?.DatosGeneralesFactura ||
    null
  );
}

export default function FacturacionClient({
  pendingF1s,
  drafts,
  historicalInvoices = [],
}: {
  pendingF1s: any[];
  drafts: any[];
  historicalInvoices?: any[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'DRAFTS'>('PENDING');
  const [filterVisibility, setFilterVisibility] = useState<'VISIBLE' | 'HIDDEN'>('VISIBLE');
  const [selectedF1s, setSelectedF1s] = useState<string[]>([]);
  const searchParamsUrl = useSearchParams();
  const initialSearch = searchParamsUrl.get('q') || '';
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const currentQ = searchParamsUrl.get('q') || '';
      if (currentQ === searchTerm) return;

      const params = new URLSearchParams(searchParamsUrl.toString());
      if (searchTerm) {
        params.set('q', searchTerm);
      } else {
        params.delete('q');
      }
      startTransition(() => {
        router.push(`?${params.toString()}`);
      });
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const [isCalculating, setIsCalculating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validDrafts = drafts.filter((d) => (filterVisibility === 'HIDDEN' ? d.hidden : !d.hidden));
  const filteredPendingF1s = pendingF1s;

  const toggleSelect = (id: string, setter: any, state: string[]) => {
    setter(state.includes(id) ? state.filter((x) => x !== id) : [...state, id]);
  };

  const handleCalculate = async () => {
    if (selectedF1s.length === 0) return;
    setIsCalculating(true);
    setError(null);
    try {
      const res = await fetch('/api/facturacion/interna/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ f1Ids: selectedF1s }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al calcular facturas');

      toast.success(`Generados ${data.count ?? selectedF1s.length} borradores correctamente`);
      setSelectedF1s([]);
      setActiveTab('DRAFTS');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al calcular facturas');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleRecalculateBatch = async (draftIdsToRecalc: string[]) => {
    if (draftIdsToRecalc.length === 0) return;
    setIsRecalculating(true);
    try {
      const res = await fetch('/api/facturacion/interna/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: draftIdsToRecalc }),
      });
      if (res.ok) {
        toast.success(`Cálculo actualizado correctamente (${draftIdsToRecalc.length})`);
        router.refresh();
      } else {
        const body = await res.json();
        toast.error(body.message || 'Error al recalcular');
      }
    } catch {
      toast.error('Error de red');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleRecalculateSingle = async (draftId: string) => {
    await handleRecalculateBatch([draftId]);
  };

  const handleToggleHidden = async (draftId: string, currentHidden: boolean) => {
    try {
      const res = await fetch('/api/facturacion/interna/toggle-hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, hidden: !currentHidden }),
      });
      if (res.ok) {
        toast.success(currentHidden ? 'Borrador visible' : 'Borrador oculto');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Error al cambiar visibilidad');
      }
    } catch {
      toast.error('Error de red');
    }
  };

  const handleConfirm = async () => {
    if (selectedDrafts.length === 0) return;
    const confirmableIds = selectedDrafts.filter((id) => {
      const d = drafts.find((x) => x.id === id);
      return d && d.status === 'BORRADOR' && !(d as any)._isOrphanDuplicateN;
    });

    if (confirmableIds.length === 0) {
      toast.error(
        'Los borradores seleccionados tienen errores críticos o están bloqueados a la espera de anulación.'
      );
      return;
    }

    setIsConfirming(true);
    setError(null);
    try {
      const res = await fetch('/api/facturacion/interna/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds: confirmableIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al confirmar facturas');

      toast.success(`Emitidas ${data.count ?? confirmableIds.length} facturas internas`);
      setSelectedDrafts([]);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Error al confirmar facturas');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeleteDrafts = async (draftIds: string[]) => {
    if (draftIds.length === 0) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/facturacion/interna/drafts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Error al borrar borradores');

      toast.success(`Eliminados ${draftIds.length} borradores`);
      setSelectedDrafts([]);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 border-b border-[var(--border)] pb-2">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`px-4 py-2 font-semibold text-sm rounded-t-md transition-colors ${
            activeTab === 'PENDING'
              ? 'text-[var(--lime)] border-b-2 border-[var(--lime)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Pendientes de Cálculo ({pendingF1s.length})
        </button>
        <button
          onClick={() => setActiveTab('DRAFTS')}
          className={`px-4 py-2 font-semibold text-sm rounded-t-md transition-colors ${
            activeTab === 'DRAFTS'
              ? 'text-[var(--lime)] border-b-2 border-[var(--lime)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Borradores ({validDrafts.length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* PENDING TAB */}
      {activeTab === 'PENDING' && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FileText size={20} className="text-[var(--lime)]" /> F1s Pendientes
            </h2>
            <div className="flex gap-4 items-center">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Buscar por CUPS, Nº Factura o Cliente..."
                  className="input text-sm w-80 pr-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {isPending && (
                  <RefreshCw
                    className="animate-spin absolute right-3 text-[var(--text-secondary)]"
                    size={16}
                  />
                )}
              </div>
              <button
                className="btn btn-primary whitespace-nowrap"
                disabled={selectedF1s.length === 0 || isCalculating}
                onClick={handleCalculate}
              >
                {isCalculating ? (
                  <RefreshCw className="animate-spin" size={18} />
                ) : (
                  <Calculator size={18} />
                )}
                Generar Cálculos ({selectedF1s.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[var(--text-secondary)] uppercase bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded"
                      onChange={(e) =>
                        setSelectedF1s(
                          e.target.checked ? filteredPendingF1s.map((f) => f.id) : []
                        )
                      }
                      checked={
                        selectedF1s.length === filteredPendingF1s.length &&
                        filteredPendingF1s.length > 0
                      }
                    />
                  </th>
                  <th className="px-4 py-3">Nº Factura F1</th>
                  <th className="px-4 py-3">CUPS</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-center">F1 Facturado Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {filteredPendingF1s.map((f1) => (
                  <tr
                    key={f1.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedF1s.includes(f1.id)}
                        onChange={() => toggleSelect(f1.id, setSelectedF1s, selectedF1s)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono">{f1.numeroFactura || 'S/N'}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {f1.contract?.supplyPoint?.cups}
                    </td>
                    <td className="px-4 py-3">
                      {f1.contract?.client?.businessName ||
                        [f1.contract?.client?.firstName, f1.contract?.client?.lastName]
                          .filter(Boolean)
                          .join(' ')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center items-center gap-2">
                        {f1.invoices && f1.invoices.length > 0 ? (
                          <div
                            className="flex items-center gap-1"
                            title="F1 ya ha sido facturado por el proveedor"
                          >
                            <CheckCircle size={16} className="text-[var(--lime)]" />
                            {f1.invoices[0].pdfUrl && (
                              <a
                                href={f1.invoices[0].pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--text-secondary)] hover:text-white"
                                title="Ver factura del proveedor"
                              >
                                <FileText size={16} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                        {f1.xmlUrl && (
                          <a
                            href={f1.xmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--text-secondary)] hover:text-white inline-flex items-center"
                            title="Descargar XML F1 original"
                          >
                            <Download size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPendingF1s.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-[var(--text-muted)]">
                      No se encontraron facturas F1 pendientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DRAFTS TAB */}
      {activeTab === 'DRAFTS' && (
        <div className="flex flex-col gap-6">
          {drafts.length > 0 && (
            <div className="card flex flex-wrap justify-between items-center gap-4 py-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CheckCircle size={20} className="text-[var(--lime)]" /> Borradores Generados
              </h2>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  className="btn border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white"
                  onClick={() => {
                    if (selectedDrafts.length === validDrafts.length && validDrafts.length > 0) {
                      setSelectedDrafts([]);
                    } else {
                      setSelectedDrafts(validDrafts.map((d) => d.id));
                    }
                  }}
                >
                  <CheckSquare size={18} />
                  {selectedDrafts.length === validDrafts.length && validDrafts.length > 0
                    ? 'Deseleccionar Todos'
                    : 'Seleccionar Todos'}
                </button>
                <button
                  className="btn border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white"
                  disabled={selectedDrafts.length === 0 || isRecalculating || isConfirming}
                  onClick={() => handleRecalculateBatch(selectedDrafts)}
                  title="Recalcular borradores seleccionados con las reglas vigentes"
                >
                  <RefreshCw className={isRecalculating ? 'animate-spin' : ''} size={18} />
                  Recalcular ({selectedDrafts.length})
                </button>
                <button
                  className="btn border border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-red-500"
                  disabled={selectedDrafts.length === 0 || isDeleting || isConfirming}
                  onClick={() => handleDeleteDrafts(selectedDrafts)}
                >
                  {isDeleting ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <Trash2 size={18} />
                  )}
                  Borrar ({selectedDrafts.length})
                </button>
                <div className="flex bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md overflow-hidden">
                  <button
                    className={`px-3 py-1 text-sm font-medium transition-colors ${
                      filterVisibility === 'VISIBLE'
                        ? 'bg-[var(--lime)] text-black'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    onClick={() => setFilterVisibility('VISIBLE')}
                  >
                    Visibles
                  </button>
                  <button
                    className={`px-3 py-1 text-sm font-medium transition-colors ${
                      filterVisibility === 'HIDDEN'
                        ? 'bg-[var(--lime)] text-black'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    onClick={() => setFilterVisibility('HIDDEN')}
                  >
                    Ocultos
                  </button>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={selectedDrafts.length === 0 || isConfirming || isDeleting}
                  onClick={handleConfirm}
                >
                  {isConfirming ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <CheckCircle size={18} />
                  )}
                  Confirmar Facturas ({selectedDrafts.length})
                </button>
              </div>
            </div>
          )}

          {/* Primera pasada para anotar _tipo, _isDuplicateCycle y _hasParentA */}
          {(() => {
            for (const d of validDrafts) {
              let tipo = 'N';
              const datosGen = extractDatosGeneralesF1(d.f1Invoice?.jsonData);
              if (datosGen?.TipoFactura) {
                tipo =
                  typeof datosGen.TipoFactura === 'string'
                    ? datosGen.TipoFactura.trim().toUpperCase()
                    : Array.isArray(datosGen.TipoFactura)
                      ? String(datosGen.TipoFactura[0]).trim().toUpperCase()
                      : 'N';
              }
              (d as any)._tipo = tipo;
            }
            for (const d of validDrafts) {
              if ((d as any)._tipo === 'N') {
                const spId = d.supplyPointId || d.contract?.supplyPointId;
                const isDuplicate = historicalInvoices.some((hi) => {
                  const hiSpId = hi.supplyPointId || hi.contract?.supplyPointId;
                  return (
                    hiSpId &&
                    spId &&
                    hiSpId === spId &&
                    hi.billingStart &&
                    hi.billingEnd &&
                    d.billingStart &&
                    d.billingEnd &&
                    new Date(hi.billingStart).getTime() === new Date(d.billingStart).getTime() &&
                    new Date(hi.billingEnd).getTime() === new Date(d.billingEnd).getTime()
                  );
                });
                (d as any)._isDuplicateCycle = isDuplicate;

                const hasA = validDrafts.some((vd) => {
                  const vdSpId = vd.supplyPointId || vd.contract?.supplyPointId;
                  return (
                    (vd as any)._tipo === 'A' &&
                    vdSpId &&
                    spId &&
                    vdSpId === spId &&
                    vd.billingStart &&
                    vd.billingEnd &&
                    d.billingStart &&
                    d.billingEnd &&
                    new Date(vd.billingStart).getTime() === new Date(d.billingStart).getTime() &&
                    new Date(vd.billingEnd).getTime() === new Date(d.billingEnd).getTime()
                  );
                });
                (d as any)._hasParentA = hasA;
                (d as any)._isOrphanDuplicateN = isDuplicate && !hasA;
              } else {
                (d as any)._isDuplicateCycle = false;
                (d as any)._hasParentA = false;
                (d as any)._isOrphanDuplicateN = false;
              }
            }
            return null;
          })()}

          {[
            { type: 'N', title: 'Normales (N)' },
            { type: 'R', title: 'Rectificadoras (R)' },
            { type: 'A', title: 'Anuladoras (A)' },
            { type: 'C', title: 'Complementarias (C)' },
            { type: 'G', title: 'Regularizadoras (G)' },
          ].map(({ type, title }) => {
            const sectionDrafts = validDrafts.filter((d) => {
              const tipo = (d as any)._tipo || 'N';

              if (type === 'R') {
                if (tipo === 'R') return true;
                if (tipo === 'S' || tipo === 'AR') {
                  const hasParentR = validDrafts.some((vd) => {
                    if ((vd as any)._tipo !== 'R') return false;
                    const dGen = extractDatosGeneralesF1(vd.f1Invoice?.jsonData);
                    const cOrig = dGen?.CodigoFacturaRectificadaAnulada;
                    const cAbo = dGen?.CodigoFacturaAbono || (cOrig ? `AR-${cOrig}` : undefined);
                    return cAbo === d.f1Invoice?.numeroFactura;
                  });
                  return !hasParentR;
                }
                return false;
              }

              if (type === 'A') {
                if (tipo === 'A') return true;
                if (tipo === 'N' && ((d as any)._isDuplicateCycle || (d as any)._hasParentA)) {
                  return !(d as any)._hasParentA;
                }
                return false;
              }

              if (type === 'N') {
                return tipo === 'N' && !(d as any)._isDuplicateCycle && !(d as any)._hasParentA;
              }

              return tipo === type;
            });

            if (sectionDrafts.length === 0) return null;

            return (
              <div key={type} className="card">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-md font-bold text-[var(--text-primary)] flex items-center gap-2">
                    {title} ({sectionDrafts.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[var(--text-secondary)] uppercase bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="rounded"
                            onChange={(e) => {
                              const sectionIds = sectionDrafts.flatMap((d) => {
                                const ids = [d.id];
                                if (type === 'R') {
                                  const isOrphanAR =
                                    (d as any)._tipo === 'AR' || (d as any)._tipo === 'S';
                                  if (isOrphanAR) return ids;
                                  const datosGen = extractDatosGeneralesF1(d.f1Invoice?.jsonData);
                                  const codOriginal = datosGen?.CodigoFacturaRectificadaAnulada;
                                  const codAbono =
                                    datosGen?.CodigoFacturaAbono ||
                                    (codOriginal ? `AR-${codOriginal}` : undefined);
                                  if (codAbono) {
                                    const arDraft = validDrafts.find(
                                      (vd) =>
                                        ((vd as any)._tipo === 'AR' ||
                                          (vd as any)._tipo === 'S') &&
                                        vd.f1Invoice?.numeroFactura === String(codAbono)
                                    );
                                    if (arDraft) ids.push(arDraft.id);
                                  }
                                }
                                return ids;
                              });
                              if (e.target.checked) {
                                setSelectedDrafts((prev) =>
                                  Array.from(new Set([...prev, ...sectionIds]))
                                );
                              } else {
                                setSelectedDrafts((prev) =>
                                  prev.filter((id) => !sectionIds.includes(id))
                                );
                              }
                            }}
                            checked={
                              sectionDrafts.length > 0 &&
                              sectionDrafts
                                .flatMap((d) => {
                                  const ids = [d.id];
                                  if (type === 'R') {
                                    const isOrphanAR =
                                      (d as any)._tipo === 'AR' || (d as any)._tipo === 'S';
                                    if (isOrphanAR) return ids;
                                    const datosGen = extractDatosGeneralesF1(d.f1Invoice?.jsonData);
                                    const codOriginal = datosGen?.CodigoFacturaRectificadaAnulada;
                                    const codAbono =
                                      datosGen?.CodigoFacturaAbono ||
                                      (codOriginal ? `AR-${codOriginal}` : undefined);
                                    if (codAbono) {
                                      const arDraft = validDrafts.find(
                                        (vd) =>
                                          ((vd as any)._tipo === 'AR' ||
                                            (vd as any)._tipo === 'S') &&
                                          vd.f1Invoice?.numeroFactura === String(codAbono)
                                      );
                                      if (arDraft) ids.push(arDraft.id);
                                    }
                                  }
                                  return ids;
                                })
                                .every((id) => selectedDrafts.includes(id))
                            }
                          />
                        </th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">CUPS</th>
                        <th className="px-4 py-3">Período</th>
                        <th className="px-4 py-3">Problema Detectado</th>
                        <th className="px-4 py-3 text-right">F1 (kWh)</th>
                        <th className="px-4 py-3 text-right">CCH (kWh)</th>
                        <th className="px-4 py-3 text-right">M. Potencia (€)</th>
                        <th className="px-4 py-3 text-right">M. Energía (€)</th>
                        <th className="px-4 py-3 text-right">Total (€)</th>
                        <th className="px-4 py-3 text-right">Total Proveedor (€)</th>
                        <th className="px-4 py-3 text-center">F1 Facturado Proveedor</th>
                        <th className="px-4 py-3 text-right uppercase text-xs font-semibold tracking-wider text-[var(--text-secondary)]">
                          Factura Interna
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionDrafts.flatMap((draft) => {
                        const rows = [];
                        const isR = type === 'R';
                        const isA = type === 'A';
                        const isOrphanAR =
                          (draft as any)._tipo === 'AR' || (draft as any)._tipo === 'S';
                        const isOrphanDuplicateN = type === 'A' && (draft as any)._tipo === 'N';

                        let missingAR = false;
                        let arDraft: any = null;
                        let nDraft: any = null;

                        if (isR && !isOrphanAR) {
                          const datosGen = extractDatosGeneralesF1(draft.f1Invoice?.jsonData);
                          const codOriginal = datosGen?.CodigoFacturaRectificadaAnulada;
                          const codAbono =
                            datosGen?.CodigoFacturaAbono ||
                            (codOriginal ? `AR-${codOriginal}` : undefined);
                          if (codAbono) {
                            arDraft = validDrafts.find(
                              (d) =>
                                ((d as any)._tipo === 'AR' || (d as any)._tipo === 'S') &&
                                d.f1Invoice?.numeroFactura === String(codAbono)
                            );
                            if (!arDraft) missingAR = true;
                          }
                        }

                        if (isA && !isOrphanDuplicateN) {
                          const draftSpId = draft.supplyPointId || draft.contract?.supplyPointId;
                          nDraft = validDrafts.find((d) => {
                            const dSpId = d.supplyPointId || d.contract?.supplyPointId;
                            return (
                              (d as any)._tipo === 'N' &&
                              dSpId &&
                              draftSpId &&
                              dSpId === draftSpId &&
                              d.billingStart &&
                              d.billingEnd &&
                              draft.billingStart &&
                              draft.billingEnd &&
                              new Date(d.billingStart).getTime() ===
                                new Date(draft.billingStart).getTime() &&
                              new Date(d.billingEnd).getTime() ===
                                new Date(draft.billingEnd).getTime()
                            );
                          });
                        }

                        const renderRow = (
                          rowDraft: any,
                          isAR: boolean,
                          isGroupedN: boolean,
                          hasGroup: boolean
                        ) => {
                          let trClass = `border-b border-[var(--border)] ${
                            isAR
                              ? 'bg-red-500/5 hover:bg-red-500/10'
                              : 'hover:bg-[var(--bg-elevated)]'
                          }`;

                          if (hasGroup) {
                            if (!isAR && !isGroupedN) {
                              trClass =
                                'border-t-2 border-l-2 border-r-2 border-b-0 border-orange-500/60 hover:bg-[var(--bg-elevated)]';
                            } else {
                              trClass = `border-b-2 border-l-2 border-r-2 border-orange-500/60 ${
                                isAR
                                  ? 'bg-red-500/5 hover:bg-red-500/10'
                                  : 'bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)]'
                              }`;
                            }
                          }

                          const startRaw = rowDraft.f1Invoice?.fechaInicio || rowDraft.billingStart;
                          const endRaw = rowDraft.f1Invoice?.fechaFin || rowDraft.billingEnd;
                          const pMargin = (rowDraft.invoiceData as any)?.powerMargin;
                          const eMargin = (rowDraft.invoiceData as any)?.energyMargin;
                          const clientObj = rowDraft.client || rowDraft.contract?.client;
                          const spObj = rowDraft.supplyPoint || rowDraft.contract?.supplyPoint;

                          return (
                            <tr key={rowDraft.id} className={trClass}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  className="rounded"
                                  checked={selectedDrafts.includes(rowDraft.id)}
                                  onChange={() =>
                                    toggleSelect(rowDraft.id, setSelectedDrafts, selectedDrafts)
                                  }
                                />
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {isAR && (
                                  <span
                                    className="text-red-400 mr-2 font-bold"
                                    title="Abono Automático"
                                  >
                                    ↳ AR
                                  </span>
                                )}
                                {isGroupedN && (
                                  <span
                                    className="text-[var(--primary)] mr-2 font-bold"
                                    title="Nueva Factura Normal"
                                  >
                                    ↳ N
                                  </span>
                                )}
                                {isOrphanDuplicateN && (
                                  <span
                                    className="text-[var(--primary)] mr-2 font-bold"
                                    title="Nueva Factura Normal"
                                  >
                                    N
                                  </span>
                                )}
                                {clientObj?.businessName ||
                                  [clientObj?.firstName, clientObj?.lastName]
                                    .filter(Boolean)
                                    .join(' ')}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                                {spObj?.cups}
                              </td>
                              <td className="px-4 py-3 font-medium text-xs text-[var(--text-secondary)] whitespace-nowrap">
                                {formatMadridStartEs(startRaw)} -{' '}
                                {formatMadridInclusiveEndEs(startRaw, endRaw)}
                              </td>
                              <td className="px-4 py-3">
                                {!isAR && missingAR && (
                                  <div className="flex flex-col gap-1 mb-1">
                                    <span
                                      className="text-red-500 font-bold text-xs flex items-center gap-1"
                                      title="No se encontró el F1 original en la base de datos."
                                    >
                                      <AlertCircle size={12} /> F1 ABONO NO ENCONTRADO
                                    </span>
                                  </div>
                                )}
                                {isOrphanDuplicateN && (
                                  <div className="flex flex-col gap-1 mb-1">
                                    <span
                                      className="text-orange-500 font-bold text-xs flex items-center gap-1"
                                      title="Este periodo ya fue facturado. Se requiere un F1 tipo A para poder procesar este F1."
                                    >
                                      <AlertCircle size={12} /> BLOQUEADA: CICLO YA FACTURADO
                                      (ESPERANDO A)
                                    </span>
                                  </div>
                                )}
                                {rowDraft.status === 'REQUIERE_REPARACION' ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-red-400 font-bold text-xs flex items-center gap-1">
                                      <AlertCircle size={12} /> ERROR CRÍTICO
                                    </span>
                                    <span className="text-[var(--text-primary)] text-xs font-medium leading-tight">
                                      {(rowDraft.repairData as any)?.issue || 'Error de cálculo'}
                                    </span>
                                  </div>
                                ) : (rowDraft.invoiceData as any)?.repaired ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-orange-400 font-bold text-xs flex items-center gap-1">
                                      <AlertCircle size={12} /> AUTO-AJUSTADO
                                    </span>
                                    <span className="text-[var(--text-primary)] text-xs font-medium leading-tight">
                                      {(rowDraft.repairData as any)?.issue}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[var(--lime)] font-medium text-xs flex items-center gap-1">
                                    <CheckCircle size={12} /> Sin descuadre
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {(rowDraft.invoiceData as any)?.repaired &&
                                (rowDraft.repairData as any)?.f1Volume !== undefined
                                  ? ((rowDraft.repairData as any).f1Volume * 1000).toFixed(2)
                                  : ((rowDraft.totalMWh || 0) * 1000).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                                {(rowDraft.invoiceData as any)?.repaired &&
                                (rowDraft.repairData as any)?.cchVolume !== undefined
                                  ? ((rowDraft.repairData as any).cchVolume * 1000).toFixed(2)
                                  : ((rowDraft.totalMWh || 0) * 1000).toFixed(2)}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-mono ${
                                  typeof pMargin === 'number' && pMargin < 0
                                    ? 'text-red-400'
                                    : 'text-[var(--lime)]'
                                }`}
                              >
                                {typeof pMargin === 'number' ? `${pMargin.toFixed(2)} €` : '-'}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-mono ${
                                  typeof eMargin === 'number' && eMargin < 0
                                    ? 'text-red-400'
                                    : 'text-[var(--lime)]'
                                }`}
                              >
                                {typeof eMargin === 'number' ? `${eMargin.toFixed(2)} €` : '-'}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-[var(--lime)] whitespace-nowrap">
                                {(rowDraft.totalAmount ?? 0).toFixed(2)} €
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-[#FFD700] whitespace-nowrap">
                                {rowDraft.f1Invoice?.invoices &&
                                rowDraft.f1Invoice.invoices.length > 0 &&
                                rowDraft.f1Invoice.invoices[0].totalAmount !== undefined &&
                                rowDraft.f1Invoice.invoices[0].totalAmount !== null
                                  ? `${(rowDraft.f1Invoice.invoices[0].invoiceType === 'Abono'
                                      ? -Math.abs(rowDraft.f1Invoice.invoices[0].totalAmount)
                                      : rowDraft.f1Invoice.invoices[0].totalAmount
                                    ).toFixed(2)} €`
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex justify-center items-center gap-2">
                                  {rowDraft.f1Invoice?.invoices &&
                                  rowDraft.f1Invoice.invoices.length > 0 ? (
                                    <div
                                      className="flex items-center gap-1"
                                      title="F1 ya ha sido facturado por el proveedor"
                                    >
                                      <CheckCircle size={16} className="text-[var(--lime)]" />
                                      {rowDraft.f1Invoice.invoices[0].pdfUrl && (
                                        <a
                                          href={rowDraft.f1Invoice.invoices[0].pdfUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[var(--text-secondary)] hover:text-white"
                                          title="Ver factura del proveedor"
                                        >
                                          <FileText size={16} />
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[var(--text-muted)]">-</span>
                                  )}
                                  {rowDraft.f1Invoice?.xmlUrl && (
                                    <a
                                      href={rowDraft.f1Invoice.xmlUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[var(--text-secondary)] hover:text-white inline-flex items-center"
                                      title="Descargar XML F1 original"
                                    >
                                      <Download size={16} />
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() =>
                                      handleToggleHidden(rowDraft.id, rowDraft.hidden)
                                    }
                                    className="text-[var(--text-secondary)] hover:text-white inline-flex items-center"
                                    title={rowDraft.hidden ? 'Mostrar' : 'Ocultar'}
                                  >
                                    {rowDraft.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                  </button>
                                  <button
                                    onClick={() => handleRecalculateSingle(rowDraft.id)}
                                    className="text-[var(--text-secondary)] hover:text-white inline-flex items-center"
                                    title="Forzar Recálculo"
                                  >
                                    <RefreshCw size={16} />
                                  </button>
                                  <a
                                    href={`/api/facturacion/interna/export-excel/${rowDraft.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[var(--text-secondary)] hover:text-[#217346] inline-flex items-center"
                                    title="Descargar Desglose Excel"
                                  >
                                    <Table size={16} />
                                  </a>
                                  <a
                                    href={`/api/facturacion/interna/proforma/${rowDraft.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[var(--text-secondary)] hover:text-white inline-flex items-center"
                                    title="Descargar PDF Proforma"
                                  >
                                    <FileText size={16} />
                                  </a>
                                </div>
                              </td>
                            </tr>
                          );
                        };

                        if (isOrphanAR || isOrphanDuplicateN) {
                          rows.push(renderRow(draft, isOrphanAR, false, false));
                        } else {
                          rows.push(renderRow(draft, false, false, !!arDraft || !!nDraft));
                          if (arDraft) rows.push(renderRow(arDraft, true, false, true));
                          if (nDraft) rows.push(renderRow(nDraft, false, true, true));
                        }

                        return rows;
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {validDrafts.length === 0 && (
            <div className="card text-center py-6 text-[var(--text-muted)]">
              No hay borradores listos.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
