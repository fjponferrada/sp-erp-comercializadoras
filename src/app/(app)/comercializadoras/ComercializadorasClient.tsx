'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import {
  Building2,
  Search,
  Edit2,
  Save,
  X,
  Check,
  Info,
  Settings,
  Leaf,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  CNMC_SCALE_COLORS,
  CNMC_SCALE_LETTERS,
  CompanyCnmcLabelConfig,
  CnmcScaleLetter,
  normalizeCnmcLabelConfig,
} from '@/lib/cnmcLabelConfig';

export default function ComercializadorasClient({
  initialCompanies,
}: {
  initialCompanies: any[];
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const startEdit = (company: any) => {
    setEditingId(company.id);
    setFormData({
      ...company,
      registroMercantil: company.registroMercantil || '',
      etiquetaCnmc: normalizeCnmcLabelConfig(company.etiquetaCnmc),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(null);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const updateLabelField = <K extends keyof CompanyCnmcLabelConfig>(
    key: K,
    value: CompanyCnmcLabelConfig[K]
  ) => {
    setFormData((prev: any) => ({
      ...prev,
      etiquetaCnmc: {
        ...prev.etiquetaCnmc,
        [key]: value,
      },
    }));
  };

  const updateMixRow = (
    rowKey: string,
    field: 'companyPct' | 'nationalPct',
    rawValue: string
  ) => {
    const parsed = rawValue === '' ? 0 : parseFloat(rawValue.replace(',', '.'));
    const safeVal = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

    setFormData((prev: any) => {
      const nextMix = (prev.etiquetaCnmc?.mix || []).map((r: any) =>
        r.key === rowKey ? { ...r, [field]: safeVal } : r
      );
      const renRow = nextMix.find((r: any) => r.key === 'renovable');
      const autoIs100 =
        field === 'companyPct' && rowKey === 'renovable'
          ? safeVal >= 99.95
          : prev.etiquetaCnmc.is100RenewableGdo;

      return {
        ...prev,
        etiquetaCnmc: {
          ...prev.etiquetaCnmc,
          is100RenewableGdo: renRow && renRow.companyPct < 99.95 ? false : autoIs100,
          mix: nextMix,
        },
      };
    });
  };

  const apply100RenewablePreset = () => {
    setFormData((prev: any) => {
      const currentCfg: CompanyCnmcLabelConfig = normalizeCnmcLabelConfig(prev.etiquetaCnmc);
      return {
        ...prev,
        etiquetaCnmc: {
          ...currentCfg,
          is100RenewableGdo: true,
          co2Letter: 'A',
          co2CompanyGPerKwh: 0,
          radLetter: 'A',
          radCompanyUgPerKwh: 0,
          mix: currentCfg.mix.map((r) => ({
            ...r,
            companyPct: r.key === 'renovable' ? 100.0 : 0.0,
          })),
        },
      };
    });
  };

  const handleSave = async () => {
    if (!formData) return;

    const cfg: CompanyCnmcLabelConfig = normalizeCnmcLabelConfig(formData.etiquetaCnmc);
    const sumComp = cfg.mix.reduce((acc, r) => acc + Number(r.companyPct || 0), 0);
    const sumNat = cfg.mix.reduce((acc, r) => acc + Number(r.nationalPct || 0), 0);

    if (Math.abs(sumComp - 100) > 0.5) {
      alert(
        `La suma del mix de la comercializadora debe ser 100% (actualmente suma ${sumComp.toFixed(1)}%).`
      );
      return;
    }
    if (Math.abs(sumNat - 100) > 0.5) {
      alert(
        `La suma del mix nacional CNMC debe ser 100% (actualmente suma ${sumNat.toFixed(1)}%).`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, etiquetaCnmc: cfg }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCompanies(companies.map((c) => (c.id === updated.id ? updated : c)));
        setEditingId(null);
        setFormData(null);
      } else {
        alert('Error al guardar datos de la comercializadora');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
    setLoading(false);
  };

  const filteredCompanies = companies.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      String(c.name || '')
        .toLowerCase()
        .includes(q) ||
      String(c.cif || '')
        .toLowerCase()
        .includes(q) ||
      String(c.ordenCnmc || '')
        .toLowerCase()
        .includes(q) ||
      String(c.codigo || '')
        .toLowerCase()
        .includes(q)
    );
  });

  const activeLabelCfg: CompanyCnmcLabelConfig | null = formData
    ? normalizeCnmcLabelConfig(formData.etiquetaCnmc)
    : null;
  const companyMixSum = activeLabelCfg
    ? activeLabelCfg.mix.reduce((acc, r) => acc + Number(r.companyPct || 0), 0)
    : 100;
  const nationalMixSum = activeLabelCfg
    ? activeLabelCfg.mix.reduce((acc, r) => acc + Number(r.nationalPct || 0), 0)
    : 100;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar
        title="Comercializadoras"
        subtitle="Gestión de empresas, datos registrales y etiquetado energético CNMC"
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
        <div
          className="card animate-fade-in-up delay-200"
          style={{
            padding: '16px 20px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar comercializadora por nombre, CIF o código CNMC..."
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
            />
          </div>
        </div>

        <div className="card animate-fade-in-up delay-300" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre Empresa</th>
                  <th>Código CRM</th>
                  <th>Dirección</th>
                  <th>Email</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>CIF</th>
                  <th>CIE Presentador</th>
                  <th>Orden CNMC</th>
                  <th>Etiqueta CNMC</th>
                  <th>Alta CNMC</th>
                  <th>Baja CNMC</th>
                  <th>Alta SP</th>
                  <th>Baja SP</th>
                  <th>Representado</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c) => {
                  const rowCfg = normalizeCnmcLabelConfig(c.etiquetaCnmc);
                  return (
                    <React.Fragment key={c.id}>
                      <tr
                        style={{
                          background: editingId === c.id ? 'var(--bg-elevated)' : 'transparent',
                        }}
                      >
                        <td style={{ fontWeight: 500, color: '#fff' }}>{c.name}</td>
                        <td
                          style={{
                            fontFamily: 'monospace',
                            color: 'var(--amber)',
                            fontWeight: 500,
                          }}
                        >
                          {c.codigo || '-'}
                        </td>
                        <td
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            maxWidth: '200px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={c.address || ''}
                        >
                          {c.address || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.email || '-'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.contactPerson || '-'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.phone || '-'}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {c.cif}
                        </td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {c.cie || '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.ordenCnmc || '-'}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                            }}
                          >
                            <span
                              style={{
                                background: CNMC_SCALE_COLORS[rowCfg.co2Letter],
                                color: rowCfg.co2Letter === 'D' ? '#0f172a' : '#fff',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}
                              title={`CO2: ${rowCfg.co2CompanyGPerKwh} g/kWh | Residuos: ${rowCfg.radCompanyUgPerKwh} µg/kWh (${rowCfg.labelYear})`}
                            >
                              {rowCfg.co2Letter}/{rowCfg.radLetter}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>({rowCfg.labelYear})</span>
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {c.fechaActivacionCnmc
                            ? new Date(c.fechaActivacionCnmc).toLocaleDateString()
                            : '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {c.fechaBajaCnmc ? new Date(c.fechaBajaCnmc).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {c.fechaActivacionIsm
                            ? new Date(c.fechaActivacionIsm).toLocaleDateString()
                            : '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {c.fechaBajaIsm ? new Date(c.fechaBajaIsm).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {c.representadoPor || '-'}
                        </td>
                        <td>
                          {c.empresaVisible ? (
                            <span className="badge badge-active inline-flex">
                              <Check size={10} /> Activa
                            </span>
                          ) : (
                            <span className="badge badge-draft inline-flex">Inactiva</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {editingId === c.id ? (
                            <div className="flex justify-end gap-2">
                              <button
                                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
                                onClick={cancelEdit}
                                title="Cancelar"
                              >
                                <X size={18} />
                              </button>
                              <button
                                className="bg-amber-500 hover:bg-amber-600 text-slate-900 p-1.5 rounded transition-colors"
                                onClick={handleSave}
                                disabled={loading}
                                title="Guardar cambios"
                              >
                                <Save size={18} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition-colors"
                                onClick={() => startEdit(c)}
                                title="Editar comercializadora"
                              >
                                <Edit2 size={18} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Editor en línea expandido */}
                      {editingId === c.id && formData && activeLabelCfg && (
                        <tr>
                          <td colSpan={17} style={{ padding: 0 }}>
                            <div
                              style={{
                                padding: '24px',
                                borderTop: '1px solid var(--border)',
                                background: 'var(--bg-elevated)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '28px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: '32px',
                                }}
                              >
                                {/* Columna Izquierda */}
                                <div
                                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                                >
                                  <h3
                                    style={{
                                      fontSize: '1rem',
                                      fontWeight: 600,
                                      color: 'var(--amber)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                    }}
                                  >
                                    <Building2 size={18} /> Datos de Empresa y Registro Mercantil
                                  </h3>
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr',
                                      gap: '12px',
                                    }}
                                  >
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Comercializadora (Nombre)
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.name || ''}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        CIF
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.cif || ''}
                                        onChange={(e) => handleChange('cif', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        CIE Presentador
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.cie || ''}
                                        onChange={(e) => handleChange('cie', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Código Interno CRM
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.codigo || ''}
                                        onChange={(e) => handleChange('codigo', e.target.value)}
                                      />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Dirección Fiscal / Postal
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.address || ''}
                                        onChange={(e) => handleChange('address', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Email
                                      </label>
                                      <input
                                        type="email"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.email || ''}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Teléfono Atención Gratuita (900)
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.phone || ''}
                                        onChange={(e) => handleChange('phone', e.target.value)}
                                      />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Persona de Contacto
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.contactPerson || ''}
                                        onChange={(e) =>
                                          handleChange('contactPerson', e.target.value)
                                        }
                                      />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                      <label className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                                        <FileText size={13} className="text-amber-400" />
                                        Inscripción en el Registro Mercantil (Margen vertical de facturas PDF)
                                      </label>
                                      <textarea
                                        rows={2}
                                        placeholder="Ej: Sociedad inscrita en el Registro Mercantil de Córdoba, al folio 61 del tomo 2858 general de sociedades, hoja nº CO-43825."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.registroMercantil || ''}
                                        onChange={(e) =>
                                          handleChange('registroMercantil', e.target.value)
                                        }
                                      />
                                    </div>
                                  </div>

                                  <h3
                                    style={{
                                      fontSize: '1rem',
                                      fontWeight: 600,
                                      color: 'var(--amber)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      marginTop: '8px',
                                    }}
                                  >
                                    <Settings size={18} /> Configuración General
                                  </h3>
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr',
                                      gap: '10px',
                                    }}
                                  >
                                    <label className="flex items-center gap-2 text-sm text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(formData.residenciaCanarias)}
                                        onChange={(e) =>
                                          handleChange('residenciaCanarias', e.target.checked)
                                        }
                                        className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                      />{' '}
                                      Residencia en Canarias
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(formData.exportableOdoo)}
                                        onChange={(e) =>
                                          handleChange('exportableOdoo', e.target.checked)
                                        }
                                        className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                      />{' '}
                                      Exportable a ODOO
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(formData.empresaVisible)}
                                        onChange={(e) =>
                                          handleChange('empresaVisible', e.target.checked)
                                        }
                                        className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                      />{' '}
                                      Empresa visible
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(formData.emisionFacturasCliente)}
                                        onChange={(e) =>
                                          handleChange('emisionFacturasCliente', e.target.checked)
                                        }
                                        className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                                      />{' '}
                                      Emisión facturas cliente
                                    </label>
                                  </div>
                                </div>

                                {/* Columna Derecha */}
                                <div
                                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                                >
                                  <h3
                                    style={{
                                      fontSize: '1rem',
                                      fontWeight: 600,
                                      color: 'var(--amber)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                    }}
                                  >
                                    <Info size={18} /> Códigos de Mercado (OMIE/REE/CNMC)
                                  </h3>
                                  <div
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr',
                                      gap: '12px',
                                    }}
                                  >
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Código REE
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.codigoRee || ''}
                                        onChange={(e) => handleChange('codigoRee', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Código ACER
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.codigoAcer || ''}
                                        onChange={(e) => handleChange('codigoAcer', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Unidad Oferta OMIE
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.unidadOfertaOmie || ''}
                                        onChange={(e) =>
                                          handleChange('unidadOfertaOmie', e.target.value)
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        REMIT
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.remit || ''}
                                        onChange={(e) => handleChange('remit', e.target.value)}
                                      />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Código Sujeto Mercado
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.codigoSujetoMercado || ''}
                                        onChange={(e) =>
                                          handleChange('codigoSujetoMercado', e.target.value)
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Orden CNMC (ej. R2-950)
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.ordenCnmc || ''}
                                        onChange={(e) => handleChange('ordenCnmc', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Representado por
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={formData.representadoPor || ''}
                                        onChange={(e) =>
                                          handleChange('representadoPor', e.target.value)
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Fecha Activación CNMC
                                      </label>
                                      <input
                                        type="date"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={
                                          formData.fechaActivacionCnmc
                                            ? new Date(formData.fechaActivacionCnmc)
                                                .toISOString()
                                                .split('T')[0]
                                            : ''
                                        }
                                        onChange={(e) =>
                                          handleChange(
                                            'fechaActivacionCnmc',
                                            e.target.value
                                              ? new Date(e.target.value).toISOString()
                                              : null
                                          )
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Fecha Baja CNMC
                                      </label>
                                      <input
                                        type="date"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={
                                          formData.fechaBajaCnmc
                                            ? new Date(formData.fechaBajaCnmc)
                                                .toISOString()
                                                .split('T')[0]
                                            : ''
                                        }
                                        onChange={(e) =>
                                          handleChange(
                                            'fechaBajaCnmc',
                                            e.target.value
                                              ? new Date(e.target.value).toISOString()
                                              : null
                                          )
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Fecha Activación SP
                                      </label>
                                      <input
                                        type="date"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={
                                          formData.fechaActivacionIsm
                                            ? new Date(formData.fechaActivacionIsm)
                                                .toISOString()
                                                .split('T')[0]
                                            : ''
                                        }
                                        onChange={(e) =>
                                          handleChange(
                                            'fechaActivacionIsm',
                                            e.target.value
                                              ? new Date(e.target.value).toISOString()
                                              : null
                                          )
                                        }
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-400 mb-1 block">
                                        Fecha Baja SP
                                      </label>
                                      <input
                                        type="date"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                        value={
                                          formData.fechaBajaIsm
                                            ? new Date(formData.fechaBajaIsm)
                                                .toISOString()
                                                .split('T')[0]
                                            : ''
                                        }
                                        onChange={(e) =>
                                          handleChange(
                                            'fechaBajaIsm',
                                            e.target.value
                                              ? new Date(e.target.value).toISOString()
                                              : null
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* SECCIÓN COMPLETA: ETIQUETADO ENERGÉTICO CNMC (CIRCULAR 2/2021) */}
                              <div
                                style={{
                                  borderTop: '1px solid var(--border)',
                                  paddingTop: '22px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '16px',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                  }}
                                >
                                  <div>
                                    <h3
                                      style={{
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        color: '#34d399',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                      }}
                                    >
                                      <Leaf size={18} /> Etiquetado de la Electricidad CNMC
                                      (Circular 2/2021 · Factura PDF y QR Comparador)
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      Se actualiza cada mes de abril con los datos publicados por la
                                      CNMC en{' '}
                                      <a
                                        href="https://gdo.cnmc.es/"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sky-400 underline"
                                      >
                                        gdo.cnmc.es
                                      </a>
                                      . Gobierna las escalas vectoriales A–G, la tabla de origen y
                                      el parámetro oficial <code>verde=1/0</code> del QR CNMC.
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={apply100RenewablePreset}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                  >
                                    <Sparkles size={14} /> Aplicar Preset 100% Renovable GdO (A / 0)
                                  </button>
                                </div>

                                {/* Fila superior de metadatos de etiqueta */}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: '14px',
                                    background: 'rgba(15, 23, 42, 0.55)',
                                    padding: '14px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(51, 65, 85, 0.7)',
                                  }}
                                >
                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">
                                      Año de Etiquetado CNMC
                                    </label>
                                    <input
                                      type="number"
                                      min={2020}
                                      max={2100}
                                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                      value={activeLabelCfg.labelYear}
                                      onChange={(e) =>
                                        updateLabelField(
                                          'labelYear',
                                          parseInt(e.target.value || '2024', 10)
                                        )
                                      }
                                    />
                                  </div>

                                  <div>
                                    <label className="text-xs text-slate-400 mb-1 block">
                                      Letra Media Nacional CNMC (A–G)
                                    </label>
                                    <select
                                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                      value={activeLabelCfg.nationalAvgLetter}
                                      onChange={(e) =>
                                        updateLabelField(
                                          'nationalAvgLetter',
                                          e.target.value as CnmcScaleLetter
                                        )
                                      }
                                    >
                                      {CNMC_SCALE_LETTERS.map((l) => (
                                        <option key={l} value={l}>
                                          Letra {l}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex items-end pb-1.5">
                                    <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={activeLabelCfg.is100RenewableGdo}
                                        onChange={(e) =>
                                          updateLabelField('is100RenewableGdo', e.target.checked)
                                        }
                                        className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                                      />
                                      <span>
                                        Acreditación GdO 100% Renovable (<code>verde=1</code> en QR
                                        CNMC)
                                      </span>
                                    </label>
                                  </div>
                                </div>

                                {/* Dos columnas: Impacto Ambiental (Escalas A-G) + Tabla Origen 7 Tecnologías */}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1.15fr',
                                    gap: '20px',
                                  }}
                                >
                                  {/* Escalas CO2 y Residuos Radiactivos */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '14px',
                                    }}
                                  >
                                    {/* Tarjeta CO2 */}
                                    <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-semibold text-white">
                                          Emisiones de CO₂ eq. (g/kWh)
                                        </span>
                                        <span
                                          style={{
                                            background: CNMC_SCALE_COLORS[activeLabelCfg.co2Letter],
                                            color:
                                              activeLabelCfg.co2Letter === 'D' ? '#0f172a' : '#fff',
                                            padding: '2px 10px',
                                            borderRadius: '6px',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                          }}
                                        >
                                          Escala {activeLabelCfg.co2Letter}
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns: '1fr 1fr 1fr',
                                          gap: '10px',
                                        }}
                                      >
                                        <div>
                                          <label className="text-xs text-slate-400 mb-1 block">
                                            Letra Comercializadora
                                          </label>
                                          <select
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                            value={activeLabelCfg.co2Letter}
                                            onChange={(e) =>
                                              updateLabelField(
                                                'co2Letter',
                                                e.target.value as CnmcScaleLetter
                                              )
                                            }
                                          >
                                            {CNMC_SCALE_LETTERS.map((l) => (
                                              <option key={l} value={l}>
                                                {l}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-xs text-slate-400 mb-1 block">
                                            Comercializadora (g/kWh)
                                          </label>
                                          <input
                                            type="number"
                                            step="0.1"
                                            min={0}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                            value={activeLabelCfg.co2CompanyGPerKwh}
                                            onChange={(e) =>
                                              updateLabelField(
                                                'co2CompanyGPerKwh',
                                                parseFloat(e.target.value || '0')
                                              )
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-slate-400 mb-1 block">
                                            Media Nacional (g/kWh)
                                          </label>
                                          <input
                                            type="number"
                                            step="0.1"
                                            min={0}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                            value={activeLabelCfg.co2NationalGPerKwh}
                                            onChange={(e) =>
                                              updateLabelField(
                                                'co2NationalGPerKwh',
                                                parseFloat(e.target.value || '0')
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Tarjeta Residuos Radiactivos */}
                                    <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-semibold text-white">
                                          Residuos Radiactivos de Alta Actividad (µg/kWh)
                                        </span>
                                        <span
                                          style={{
                                            background: CNMC_SCALE_COLORS[activeLabelCfg.radLetter],
                                            color:
                                              activeLabelCfg.radLetter === 'D' ? '#0f172a' : '#fff',
                                            padding: '2px 10px',
                                            borderRadius: '6px',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                          }}
                                        >
                                          Escala {activeLabelCfg.radLetter}
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          display: 'grid',
                                          gridTemplateColumns: '1fr 1fr 1fr',
                                          gap: '10px',
                                        }}
                                      >
                                        <div>
                                          <label className="text-xs text-slate-400 mb-1 block">
                                            Letra Comercializadora
                                          </label>
                                          <select
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                            value={activeLabelCfg.radLetter}
                                            onChange={(e) =>
                                              updateLabelField(
                                                'radLetter',
                                                e.target.value as CnmcScaleLetter
                                              )
                                            }
                                          >
                                            {CNMC_SCALE_LETTERS.map((l) => (
                                              <option key={l} value={l}>
                                                {l}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="text-xs text-slate-400 mb-1 block">
                                            Comercializadora (µg/kWh)
                                          </label>
                                          <input
                                            type="number"
                                            step="0.1"
                                            min={0}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                            value={activeLabelCfg.radCompanyUgPerKwh}
                                            onChange={(e) =>
                                              updateLabelField(
                                                'radCompanyUgPerKwh',
                                                parseFloat(e.target.value || '0')
                                              )
                                            }
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-slate-400 mb-1 block">
                                            Media Nacional (µg/kWh)
                                          </label>
                                          <input
                                            type="number"
                                            step="0.1"
                                            min={0}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                            value={activeLabelCfg.radNationalUgPerKwh}
                                            onChange={(e) =>
                                              updateLabelField(
                                                'radNationalUgPerKwh',
                                                parseFloat(e.target.value || '0')
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Tabla editable de Origen de la Electricidad (7 tecnologías CNMC) */}
                                  <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-sm font-semibold text-white">
                                        Origen de la Electricidad (% por tecnología)
                                      </span>
                                      <div className="flex gap-3 text-xs">
                                        <span
                                          className={
                                            Math.abs(companyMixSum - 100) <= 0.5
                                              ? 'text-emerald-400 font-semibold'
                                              : 'text-rose-400 font-semibold'
                                          }
                                        >
                                          Comercializadora: {companyMixSum.toFixed(1)}%
                                        </span>
                                        <span
                                          className={
                                            Math.abs(nationalMixSum - 100) <= 0.5
                                              ? 'text-slate-300'
                                              : 'text-rose-400 font-semibold'
                                          }
                                        >
                                          Mix Nacional: {nationalMixSum.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>

                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-slate-400 border-b border-slate-700/80">
                                          <th className="text-left py-1.5 font-medium">
                                            Tecnología CNMC
                                          </th>
                                          <th className="text-right py-1.5 font-medium w-32">
                                            % Comercializadora
                                          </th>
                                          <th className="text-right py-1.5 font-medium w-32">
                                            % Mix Nacional
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {activeLabelCfg.mix.map((row) => (
                                          <tr
                                            key={row.key}
                                            className="border-b border-slate-800/70 last:border-0"
                                          >
                                            <td className="py-1.5 text-slate-200 flex items-center gap-2">
                                              <span
                                                style={{
                                                  width: 10,
                                                  height: 10,
                                                  borderRadius: 2,
                                                  backgroundColor: row.color,
                                                  display: 'inline-block',
                                                }}
                                              />
                                              {row.source}
                                            </td>
                                            <td className="py-1 text-right">
                                              <input
                                                type="number"
                                                step="0.1"
                                                min={0}
                                                max={100}
                                                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-white"
                                                value={row.companyPct}
                                                onChange={(e) =>
                                                  updateMixRow(
                                                    row.key,
                                                    'companyPct',
                                                    e.target.value
                                                  )
                                                }
                                              />
                                            </td>
                                            <td className="py-1 text-right">
                                              <input
                                                type="number"
                                                step="0.1"
                                                min={0}
                                                max={100}
                                                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-slate-200"
                                                value={row.nationalPct}
                                                onChange={(e) =>
                                                  updateMixRow(
                                                    row.key,
                                                    'nationalPct',
                                                    e.target.value
                                                  )
                                                }
                                              />
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>

                              {/* Barra inferior de acciones del panel */}
                              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSave}
                                  disabled={loading}
                                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm flex items-center gap-2 transition-colors"
                                >
                                  <Save size={16} />
                                  {loading ? 'Guardando...' : 'Guardar Configuración'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredCompanies.length === 0 && (
                  <tr>
                    <td colSpan={17} className="text-center py-8 text-slate-400">
                      No se encontraron comercializadoras.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
