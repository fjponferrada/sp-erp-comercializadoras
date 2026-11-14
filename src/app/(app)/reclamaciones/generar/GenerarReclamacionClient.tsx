'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { Search, Send, Upload, FileUp, ArrowLeft, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import {
  searchCupsForClaim,
  generateClaim,
  searchInvoicesForMassClaim,
  searchCupsWithBillingDelay,
} from '@/app/actions/reclamacionesActions';
import toast from 'react-hot-toast';
import {
  getRequiredFieldsForSubtipo,
  getOptionalFieldsForSubtipo,
  isCupsOptionalForSubtipo,
} from '../utils/casuisticas';
import { CNMC_DROPDOWN_OPTIONS, TIPOS_DOCUMENTACION_CNMC } from '../utils/cnmc_codes';

interface GenerarReclamacionClientProps {
  motivos: any[];
  submotivos: any[];
  initialCups?: string;
}

const DISTRIBUIDORAS_COMUNES = [
  { codigo: '0031', nombre: '0031 - e-distribución (Endesa)' },
  { codigo: '0021', nombre: '0021 - i-DE (Iberdrola)' },
  { codigo: '0022', nombre: '0022 - UFD (Naturgy / Unión Fenosa)' },
  { codigo: '0026', nombre: '0026 - E-REDES / Viesgo' },
  { codigo: '0027', nombre: '0027 - Begasa' },
];

export default function GenerarReclamacionClient({
  motivos,
  submotivos,
  initialCups = '',
}: GenerarReclamacionClientProps) {
  const [mode, setMode] = useState<'' | 'Individual' | 'Masiva'>(initialCups ? 'Individual' : '');
  const [motivo, setMotivo] = useState('');
  const [submotivo, setSubmotivo] = useState('');

  // Individual State
  const [cups, setCups] = useState(initialCups);
  const [clientData, setClientData] = useState<any>(null);
  const [externalCupsConfirmed, setExternalCupsConfirmed] = useState(false);
  const [destinoOverride, setDestinoOverride] = useState('0031');
  const [f1Invoices, setF1Invoices] = useState<any[]>([]);
  const [selectedF1Id, setSelectedF1Id] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [searching, setSearching] = useState(false);

  // Dynamic Fields State
  const [fechaLectura, setFechaLectura] = useState('');
  const [lecturas, setLecturas] = useState<Record<string, string>>({
    P1: '', P2: '', P3: '', P4: '', P5: '', P6: '',
  });
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});

  // Attachment & ERP Registration State
  const [file, setFile] = useState<File | null>(null);
  const [tipoDocAportado, setTipoDocAportado] = useState('04');
  const [registerInErp, setRegisterInErp] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Masiva Facturas State
  const [masivaInputMode, setMasivaInputMode] = useState<'csv' | 'facturas' | 'retrasos'>('csv');
  const [filtroDesde, setFiltroDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    return d.toISOString().split('T')[0];
  });
  const [filtroHasta, setFiltroHasta] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtroProcedencia, setFiltroProcedencia] = useState('Estimada');
  const [filtroTipoFactura, setFiltroTipoFactura] = useState('Normal');
  const [searchedInvoices, setSearchedInvoices] = useState<any[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false);

  // Masiva Retrasos State (006)
  const [searchedCups, setSearchedCups] = useState<any[]>([]);
  const [selectedCupsIds, setSelectedCupsIds] = useState<string[]>([]);
  const [isSearchingCups, setIsSearchingCups] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const submotivoCode = submotivo ? submotivo.split('-')[0].trim() : '';
  const cupsOptional = isCupsOptionalForSubtipo(submotivoCode, dynamicFields);

  // Precarga automática si se navega con ?cups=ES...
  useEffect(() => {
    if (initialCups && initialCups.trim().length >= 18) {
      handleSearchCups(initialCups.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCups]);

  // Efecto para autocompletar comentarios y ajustar pestañas masivas según submotivo
  useEffect(() => {
    if (mode === 'Masiva' && submotivo.includes('009')) {
      setComentarios(
        'El Cliente niega haber imposibilitado el acceso para la toma de lectura, tampoco tiene aviso de ausencia, ni se le ofrece alternativa o tlf para concertar cita. La Distribuidora está incumpliendo su obligación de mantenimiento del equipo de medida (incidencia de comunicaciones persistente). Según el RD 1110/2007 y la Resolución de 18 de diciembre de 2019, ante la falta de lectura real por fallo del equipo, deben proceder a su reparación inmediata. SOLICITAMOS: 1) Anulación de la lectura estimada por ser materialmente errónea. 2) Reparación urgente del sistema de telegestión. 3) Refacturación con lectura REAL. De persistir la estimación sin subsanar la avería del contador, se elevará denuncia ante el órgano competente de Energía de la Junta de Andalucía'
      );
    } else if (mode === 'Masiva' && submotivo.includes('006')) {
      setComentarios(
        'Solicitamos el envío de lecturas para facturar a este cliente y que se realice la recepción de facturas en plazo. Si existe algún problema para la suspensión del proceso de facturación para este cliente, rogamos lo comuniquen a nosotros y al cliente.'
      );
    } else if (motivo.startsWith('02') && submotivo.includes('036')) {
      setComentarios('El cliente no está de acuerdo con las lecturas facturadas en este periodo. Aportamos sus lecturas del contador');
    } else if (motivo.startsWith('05') && submotivo.includes('039')) {
      setComentarios(
        'Solicitud informe / certificado sobre incidencias por averías técnicas en las redes de distribución eléctrica en el periodo indicado en la solicitud'
      );
    }

    if (mode === 'Masiva') {
      if (masivaInputMode === 'facturas' && !submotivo.includes('009')) {
        setMasivaInputMode('csv');
      } else if (masivaInputMode === 'retrasos' && !submotivo.includes('006')) {
        setMasivaInputMode('csv');
      }
    }
  }, [mode, submotivo, motivo, masivaInputMode]);

  const handleSearchCups = async (overrideCups?: string) => {
    const targetCups = (overrideCups ?? cups).trim();
    if (!targetCups) return toast.error('Introduce un CUPS');
    setSearching(true);
    setSelectedF1Id('');
    setExternalCupsConfirmed(false);
    setDynamicFields((prev) => {
      const next = { ...prev };
      delete next['NUM FACTURA ATR'];
      return next;
    });
    const res = await searchCupsForClaim(targetCups);
    if (res.success && res.data) {
      setClientData(res.data);
      setCups(res.data.cups || targetCups);
      setF1Invoices(res.data.f1Invoices || []);
      toast.success('Datos recuperados');
    } else {
      setClientData(null);
      setF1Invoices([]);
      if (submotivoCode === '007' && targetCups.length >= 20) {
        setExternalCupsConfirmed(true);
        toast('CUPS externo no registrado en cartera: habilitado modo Subtipo 007', { icon: 'ℹ️' });
      } else {
        toast.error(res.error || 'No se encontró el CUPS');
      }
    }
    setSearching(false);
  };

  const handleSearchCupsRetrasos = async () => {
    setIsSearchingCups(true);
    const res = await searchCupsWithBillingDelay(45);
    if (res.success && res.data) {
      setSearchedCups(res.data);
      setSelectedCupsIds([]);
      toast.success(`${res.data.length} CUPS con retraso encontrados`);
    } else {
      toast.error(res.error || 'Error al buscar CUPS');
      setSearchedCups([]);
    }
    setIsSearchingCups(false);
  };

  const toggleAllCups = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Por defecto excluir los que ya tienen reclamación R1 abierta para evitar rechazos 84 (Duplicada)
      const withoutOpen = searchedCups.filter((c) => !c.openClaim).map((c) => c.cups);
      setSelectedCupsIds(withoutOpen.length > 0 ? withoutOpen : searchedCups.map((c) => c.cups));
    } else {
      setSelectedCupsIds([]);
    }
  };

  const toggleCupsSelection = (targetCups: string) => {
    if (selectedCupsIds.includes(targetCups)) {
      setSelectedCupsIds(selectedCupsIds.filter((id) => id !== targetCups));
    } else {
      setSelectedCupsIds([...selectedCupsIds, targetCups]);
    }
  };

  const uploadAttachmentIfNeeded = async (): Promise<{ r2Path: string; tipoDocAportado: string } | undefined> => {
    if (!file) return undefined;
    const extIdx = file.name.lastIndexOf('.');
    const ext = extIdx >= 0 ? file.name.slice(extIdx) : '';
    const baseName = (extIdx >= 0 ? file.name.slice(0, extIdx) : file.name)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 35);
    const shortFile = new File([file], `${baseName || 'adjunto'}${ext.slice(0, 8)}`, {
      type: file.type || 'application/octet-stream',
    });

    const fd = new FormData();
    fd.append('file', shortFile);
    fd.append('folder', 'cnmc');

    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok || !json.success || !json.url) {
      throw new Error(json.error || 'No se pudo subir el documento adjunto a Cloudflare R2');
    }

    const parsedUrl = new URL(json.url as string);
    const r2Path = parsedUrl.pathname.replace(/^\/+/, '');
    return { r2Path, tipoDocAportado };
  };

  const handleGenerate = async () => {
    if (!mode) return toast.error('Selecciona el modo de generación');
    if (!motivo) return toast.error('Selecciona un Motivo');
    if (!submotivo) return toast.error('Selecciona un Submotivo');

    const reqFields = getRequiredFieldsForSubtipo(submotivoCode, dynamicFields);
    const optFields = getOptionalFieldsForSubtipo(submotivoCode);
    const allAllowedFields = [...reqFields, ...optFields];

    if (mode === 'Individual') {
      if (!cups.trim() && !cupsOptional) {
        return toast.error('Este subtipo exige informar un código CUPS');
      }
      if (!cups.trim() && cupsOptional && !/^\d{4}$/.test(destinoOverride.trim())) {
        return toast.error('Indica un código REE de distribuidora válido (4 dígitos, ej. 0031)');
      }
      for (const req of reqFields) {
        if (req === 'LECTURA') {
          const hasAnyReading = Object.values(lecturas).some((v) => v !== '' && v !== null && v !== undefined);
          if (!hasAnyReading) {
            return toast.error('Debes introducir al menos una lectura propuesta (P1..P6)');
          }
        } else if (req === 'FECHA LECTURA') {
          if (!fechaLectura) {
            return toast.error('Debes indicar la Fecha de Lectura');
          }
        } else if (req === 'NUM FACTURA ATR') {
          if (!selectedF1Id && !dynamicFields['NUM FACTURA ATR']?.trim()) {
            return toast.error('Selecciona una factura F1 o indica el Número de Factura ATR');
          }
        } else if (!dynamicFields[req] || !dynamicFields[req].trim()) {
          return toast.error(`El campo obligatorio "${req}" está sin cumplimentar`);
        }
      }
    } else if (mode === 'Masiva') {
      if (masivaInputMode === 'csv' && !csvFile) {
        return toast.error('Selecciona un archivo CSV para la carga masiva');
      }
      if (masivaInputMode === 'facturas' && selectedInvoiceIds.length === 0) {
        return toast.error('Selecciona al menos una factura para reclamar');
      }
      if (masivaInputMode === 'retrasos' && selectedCupsIds.length === 0) {
        return toast.error('Selecciona al menos un CUPS con retraso');
      }
    }

    setSubmitting(true);
    try {
      let csvContent = '';
      if (mode === 'Masiva' && masivaInputMode === 'csv' && csvFile) {
        csvContent = await csvFile.text();
      }

      let attachment: { r2Path: string; tipoDocAportado: string } | undefined = undefined;
      if (file) {
        attachment = await uploadAttachmentIfNeeded();
      }

      const filteredDynamicFields: Record<string, string> = {};
      for (const fieldKey of allAllowedFields) {
        if (dynamicFields[fieldKey]) {
          filteredDynamicFields[fieldKey] = dynamicFields[fieldKey];
        }
      }

      const payload = {
        mode,
        motivo,
        submotivo,
        cups: mode === 'Individual' ? cups.trim() : undefined,
        destinoOverride: mode === 'Individual' && !cups.trim() ? destinoOverride.trim() : undefined,
        selectedF1Id: mode === 'Individual' && allAllowedFields.includes('NUM FACTURA ATR') ? selectedF1Id : undefined,
        comentarios,
        csvContent: mode === 'Masiva' && masivaInputMode === 'csv' ? csvContent : undefined,
        invoiceIds: mode === 'Masiva' && masivaInputMode === 'facturas' ? selectedInvoiceIds : undefined,
        cupsIds: mode === 'Masiva' && masivaInputMode === 'retrasos' ? selectedCupsIds : undefined,
        dynamicFields: filteredDynamicFields,
        fechaLectura: allAllowedFields.includes('FECHA LECTURA') ? fechaLectura : undefined,
        lecturas: allAllowedFields.includes('LECTURA') ? lecturas : undefined,
        attachment,
        registerInErp,
      };

      const res = await generateClaim(payload);
      if (res.success && res.fileContent) {
        if (registerInErp && res.registeredCount) {
          toast.success(
            res.isZip
              ? `${res.generatedCount || res.registeredCount} reclamaciones generadas y registradas en el ERP`
              : `Reclamación generada y registrada en el ERP (${res.codigoSolicitud})`
          );
        } else {
          toast.success('Reclamación generada correctamente');
        }

        const byteCharacters = atob(res.fileContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: res.isZip ? 'application/zip' : 'application/xml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.fileName || 'reclamacion.xml';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        toast.error(res.error || 'Error al generar');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error inesperado al generar la reclamación');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchInvoices = async () => {
    setIsSearchingInvoices(true);
    const res = await searchInvoicesForMassClaim(filtroDesde, filtroHasta, filtroProcedencia, filtroTipoFactura);
    if (res.success && res.invoices) {
      setSearchedInvoices(res.invoices);
      setSelectedInvoiceIds([]);
      toast.success(`Se encontraron ${res.invoices.length} facturas`);
    } else {
      toast.error(res.error || 'Error al buscar facturas');
      setSearchedInvoices([]);
    }
    setIsSearchingInvoices(false);
  };

  const toggleInvoiceSelection = (id: string) => {
    if (selectedInvoiceIds.includes(id)) {
      setSelectedInvoiceIds(selectedInvoiceIds.filter((i) => i !== id));
    } else {
      setSelectedInvoiceIds([...selectedInvoiceIds, id]);
    }
  };

  const toggleAllInvoices = () => {
    const selectableWithoutOpen = searchedInvoices.filter((i) => !i.openClaim).map((i) => i.id);
    const targetIds = selectableWithoutOpen.length > 0 ? selectableWithoutOpen : searchedInvoices.map((i) => i.id);
    if (selectedInvoiceIds.length > 0 && selectedInvoiceIds.length >= targetIds.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(targetIds);
    }
  };

  // Mapeo oficial CNMC V3.0 Electricidad (Tabla 81 -> Tabla 82 vigente)
  const strictMapping: Record<string, string[]> = {
    '01': ['001', '002', '038', '070'],
    '02': [
      '003', '004', '005', '006', '007', '008', '009', '010', '011', '012',
      '036', '037', '040', '046', '047', '049', '057', '067', '069', '073', '075',
    ],
    '03': [
      '013', '014', '015', '034', '035', '045', '048', '058', '059', '060',
      '061', '062', '064', '065', '066', '071', '072', '074', '076', '077',
      '078', '079', '080', '081',
    ],
    '04': ['018', '019'],
    '05': ['020', '021', '022', '023', '039'],
    '06': ['024', '025', '026', '041', '042', '043', '044'],
    '07': ['027', '028', '029', '030', '031', '032', '063'],
  };

  const allowedSubmotivos = motivo ? strictMapping[motivo.split('-')[0].trim()] || [] : [];

  const suggestedSubmotivos = submotivos.filter((sm) => {
    if (!motivo) return false;
    return allowedSubmotivos.includes(sm['CÓDIGO']);
  });

  const otherSubmotivos = submotivos.filter((sm) => !suggestedSubmotivos.includes(sm));

  const canRenderIndividualDetails =
    Boolean(clientData) || cupsOptional || (submotivoCode === '007' && externalCupsConfirmed);

  return (
    <div className="min-h-screen relative outline-none pb-20 flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Topbar
        title="Generación de Reclamaciones"
        subtitle="Configure los parámetros para generar reclamaciones a distribuidora (Proceso R1 - CNMC V3.0)."
        customActions={
          <a
            href="/reclamaciones"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-gray-300 font-semibold rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Reclamaciones
          </a>
        }
      />
      <div className="p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-[var(--bg-elevated)] p-6 md:p-8 rounded-2xl border border-[var(--border)] shadow-lg space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Modo de Generación
              </label>
              <select
                className="w-full border border-[var(--border)] bg-[#111827] rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all shadow-sm"
                value={mode}
                onChange={(e) => {
                  const val = e.target.value as '' | 'Individual' | 'Masiva';
                  setMode(val);
                  if (val === 'Masiva') {
                    const factMotivo = motivos.find(
                      (m) => m['CÓDIGO'] === '02' || m['DESCRIPCIÓN']?.includes('FACTURACION')
                    );
                    if (factMotivo) {
                      setMotivo(`${factMotivo['CÓDIGO']} - ${factMotivo['DESCRIPCIÓN']}`);
                    }
                  } else {
                    setMotivo('');
                  }
                }}
              >
                <option value="" className="bg-[#111827] text-gray-400">
                  Seleccione una opción
                </option>
                <option value="Individual" className="bg-[#111827] text-gray-100">
                  Individual
                </option>
                <option value="Masiva" className="bg-[#111827] text-gray-100">
                  Masiva
                </option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Motivo</label>
              <select
                className="w-full border border-[var(--border)] bg-[#111827] rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setSubmotivo('');
                  setDynamicFields(
                    selectedF1Id && dynamicFields['NUM FACTURA ATR']
                      ? { 'NUM FACTURA ATR': dynamicFields['NUM FACTURA ATR'] }
                      : {}
                  );
                }}
                disabled={mode === 'Masiva'}
              >
                {mode === 'Masiva' ? (
                  motivos
                    .filter((m) => m['CÓDIGO'] === '02' || m['DESCRIPCIÓN']?.includes('FACTURACION'))
                    .map((m, i) => (
                      <option key={i} value={`${m['CÓDIGO']} - ${m['DESCRIPCIÓN']}`} className="bg-[#111827] text-gray-100">
                        {m['CÓDIGO']} - {m['DESCRIPCIÓN']}
                      </option>
                    ))
                ) : (
                  <>
                    <option value="" className="bg-[#111827] text-gray-400">
                      Seleccione un motivo
                    </option>
                    {motivos.map((m, i) => (
                      <option key={i} value={`${m['CÓDIGO']} - ${m['DESCRIPCIÓN']}`} className="bg-[#111827] text-gray-100">
                        {m['CÓDIGO']} - {m['DESCRIPCIÓN']}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Submotivo
              </label>
              <select
                className="w-full border border-[var(--border)] bg-[#111827] rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all shadow-sm"
                value={submotivo}
                onChange={(e) => {
                  const newSub = e.target.value;
                  setSubmotivo(newSub);
                  const selectedF1 = f1Invoices.find((f) => f.id === selectedF1Id);
                  setDynamicFields(selectedF1?.codigoFiscal ? { 'NUM FACTURA ATR': selectedF1.codigoFiscal } : {});
                  setFechaLectura('');
                  setLecturas({ P1: '', P2: '', P3: '', P4: '', P5: '', P6: '' });
                }}
              >
                <option value="" className="bg-[#111827] text-gray-400">
                  Seleccione un submotivo
                </option>
                {motivo && suggestedSubmotivos.length > 0 && (
                  <optgroup label="Sugeridos para este motivo" className="bg-[#1E293B] text-[var(--lime)] font-bold">
                    {suggestedSubmotivos.map((sm, i) => (
                      <option
                        key={`sug-${i}`}
                        value={`${sm['CÓDIGO']}-${sm['DESCRIPCIÓN']}`}
                        className="bg-[#111827] text-gray-100 font-normal"
                      >
                        {sm['CÓDIGO']} - {sm['DESCRIPCIÓN']}
                      </option>
                    ))}
                  </optgroup>
                )}
                {mode !== 'Masiva' && (
                  <optgroup
                    label={motivo ? 'Otros submotivos' : 'Todos los submotivos'}
                    className="bg-[#1E293B] text-gray-400 font-bold"
                  >
                    {otherSubmotivos.map((sm, i) => (
                      <option
                        key={`oth-${i}`}
                        value={`${sm['CÓDIGO']}-${sm['DESCRIPCIÓN']}`}
                        className="bg-[#111827] text-gray-100 font-normal"
                      >
                        {sm['CÓDIGO']} - {sm['DESCRIPCIÓN']}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
        </div>

        {mode === 'Individual' && (
          <div className="bg-[var(--bg-elevated)] p-6 md:p-8 rounded-2xl border border-[var(--border)] shadow-lg space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
                  <span>Búsqueda por CUPS {cupsOptional ? '(Opcional en este subtipo)' : ''}</span>
                </label>
                <div className="flex w-full group shadow-sm">
                  <input
                    type="text"
                    value={cups}
                    onChange={(e) => {
                      setCups(e.target.value);
                      if (!e.target.value.trim()) {
                        setClientData(null);
                        setExternalCupsConfirmed(false);
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchCups()}
                    className="flex-1 border border-[var(--border)] border-r-0 bg-[#111827] rounded-l-xl px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all font-mono"
                    placeholder={cupsOptional ? 'Opcional: ES0000... (dejar vacío si no existe CUPS)' : 'ES0000000000000000...'}
                  />
                  <button
                    onClick={() => handleSearchCups()}
                    disabled={searching}
                    className="bg-[var(--lime)] text-[#0B0F19] font-bold px-6 py-3 rounded-r-xl flex items-center gap-2 hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:ring-offset-2 focus:ring-offset-[#111827]"
                  >
                    <Search size={18} /> {searching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {cupsOptional && !cups.trim() && (
                  <p className="text-xs text-gray-400">
                    Para este submotivo no es necesario informar CUPS; se omitirá la etiqueta &lt;CUPS&gt; en la cabecera CNMC.
                  </p>
                )}
              </div>

              {/* Selector de distribuidora destino cuando no hay CUPS */}
              {cupsOptional && !cups.trim() ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Distribuidora Destino (Código REE)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={DISTRIBUIDORAS_COMUNES.some((d) => d.codigo === destinoOverride) ? destinoOverride : 'CUSTOM'}
                      onChange={(e) => {
                        if (e.target.value !== 'CUSTOM') setDestinoOverride(e.target.value);
                      }}
                      className="flex-1 border border-[var(--border)] bg-[#111827] rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--lime)]"
                    >
                      {DISTRIBUIDORAS_COMUNES.map((d) => (
                        <option key={d.codigo} value={d.codigo}>
                          {d.nombre}
                        </option>
                      ))}
                      <option value="CUSTOM">Otro código REE (4 dígitos)</option>
                    </select>
                    <input
                      type="text"
                      maxLength={4}
                      value={destinoOverride}
                      onChange={(e) => setDestinoOverride(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-24 border border-[var(--border)] bg-[#111827] rounded-xl px-3 py-3 text-center font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--lime)]"
                      placeholder="0031"
                    />
                  </div>
                </div>
              ) : (
                <div />
              )}
            </div>

            {canRenderIndividualDetails && (
              <div className="space-y-8 mt-4 animate-in fade-in duration-500">
                {/* Alerta de reclamaciones abiertas sobre este CUPS */}
                {clientData?.openClaims?.length > 0 && (
                  <div className="p-4 rounded-xl border border-amber-700/70 bg-amber-950/25 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200 space-y-1">
                      <div className="font-bold text-amber-300">
                        Atención: Este CUPS tiene {clientData.openClaims.length} reclamación(es) R1 actualmente abierta(s)
                      </div>
                      <ul className="list-disc list-inside text-amber-200/90">
                        {clientData.openClaims.map((oc: any) => (
                          <li key={oc.codigoSolicitud}>
                            Solicitud <span className="font-mono font-semibold">{oc.codigoSolicitud}</span> · Subtipo{' '}
                            <span className="font-mono">{oc.subtipo || '-'}</span> ({oc.estado})
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {clientData && (
                  <div className="bg-[#111827] p-5 rounded-xl border border-[var(--border)]">
                    <h3 className="text-xs font-bold text-[var(--lime)] tracking-widest uppercase mb-4">
                      Información del Cliente
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div>
                        <span className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          NIF Cliente
                        </span>
                        <span className="block text-sm text-gray-200 font-medium truncate">
                          {clientData.clientVat || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Nombre
                        </span>
                        <span className="block text-sm text-gray-200 font-medium truncate">
                          {clientData.clientName || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                          Tarifa ATR
                        </span>
                        <span className="block text-sm text-gray-200 font-medium truncate">
                          {clientData.tariff || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">CUPS</span>
                        <span className="block text-sm text-gray-200 font-mono truncate">{clientData.cups || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {!clientData && externalCupsConfirmed && (
                  <div className="bg-[#111827] p-4 rounded-xl border border-blue-800/60 text-xs text-blue-300">
                    Reclamación sobre CUPS ajeno/no vigente en cartera (<strong className="font-mono">{cups.trim().toUpperCase()}</strong>). Se omitirá el nodo opcional &lt;Cliente&gt; conforme a CNMC V3.0.
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Comentarios
                  </label>
                  <textarea
                    className="w-full border border-[var(--border)] bg-[#111827] rounded-xl p-4 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all min-h-[120px] shadow-sm resize-y"
                    placeholder="Escriba aquí sus comentarios (máx. 4000 caracteres)..."
                    maxLength={4000}
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                  />
                </div>

                {(() => {
                  if (!submotivoCode) return null;
                  const requirements = getRequiredFieldsForSubtipo(submotivoCode, dynamicFields);
                  const optionalFields = getOptionalFieldsForSubtipo(submotivoCode);
                  const allFields = [...requirements, ...optionalFields];
                  if (allFields.length === 0) return null;

                  return (
                    <div className="bg-[#111827] p-6 rounded-xl border border-[var(--border)] animate-in fade-in zoom-in-95 duration-300">
                      <h3 className="text-sm font-bold text-[var(--lime)] tracking-widest uppercase mb-6 flex items-center gap-2">
                        <FileUp size={16} /> Datos Específicos de la CNMC
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {allFields.map((fieldName) => {
                          if (fieldName === 'LECTURA' || fieldName === 'FECHA LECTURA') return null;

                          const isRequired = requirements.includes(fieldName);
                          const isDate = fieldName.includes('FECHA');
                          const isNumber = fieldName.includes('IMPORTE');
                          const dropdownOptions = CNMC_DROPDOWN_OPTIONS[fieldName];
                          const hasOptions = dropdownOptions && dropdownOptions.length > 0;

                          return (
                            <div key={fieldName} className="space-y-2">
                              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                                {fieldName}{' '}
                                {isRequired ? (
                                  <span className="text-red-400">*</span>
                                ) : (
                                  <span className="text-gray-500 normal-case">(Opcional)</span>
                                )}
                              </label>
                              {hasOptions ? (
                                <select
                                  className="w-full border border-[var(--border)] bg-[#1E293B] rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all"
                                  value={dynamicFields[fieldName] || ''}
                                  onChange={(e) => setDynamicFields({ ...dynamicFields, [fieldName]: e.target.value })}
                                >
                                  <option value="">Seleccione una opción...</option>
                                  {Array.from(new Map(dropdownOptions.map((opt) => [opt.codigo, opt])).values()).map(
                                    (opt: any) => (
                                      <option key={opt.codigo} value={opt.codigo}>
                                        {opt.descripcion}
                                      </option>
                                    )
                                  )}
                                </select>
                              ) : (
                                <input
                                  type={isDate ? 'date' : isNumber ? 'number' : 'text'}
                                  step={isNumber ? '0.01' : undefined}
                                  className="w-full border border-[var(--border)] bg-[#1E293B] rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  value={dynamicFields[fieldName] || ''}
                                  onChange={(e) => setDynamicFields({ ...dynamicFields, [fieldName]: e.target.value })}
                                  disabled={fieldName === 'NUM FACTURA ATR' && !!selectedF1Id}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {requirements.includes('FECHA LECTURA') && (
                        <div className="mt-6 space-y-2 max-w-xs">
                          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                            FECHA DE LECTURA <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="date"
                            className="w-full border border-[var(--border)] bg-[#1E293B] rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all"
                            value={fechaLectura}
                            onChange={(e) => setFechaLectura(e.target.value)}
                          />
                        </div>
                      )}

                      {requirements.includes('LECTURA') && (
                        <div className="mt-6 space-y-3">
                          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                            LECTURAS PROPUESTAS <span className="text-red-400">*</span>
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((p) => {
                              const is20 = clientData?.tariff?.includes('2.0');
                              if (is20 && ['P4', 'P5', 'P6'].includes(p)) return null;

                              return (
                                <div key={p} className="flex flex-col gap-1">
                                  <span className="text-[10px] text-gray-400 font-mono ml-1">{p}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full border border-[var(--border)] bg-[#1E293B] rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all"
                                    value={lecturas[p] || ''}
                                    onChange={(e) => setLecturas({ ...lecturas, [p]: e.target.value })}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Archivos Adjuntos Funcionales (<RegistrosDocumento>) */}
                <div className="bg-[#111827] p-5 rounded-xl border border-[var(--border)] space-y-4">
                  <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                    Archivos Adjuntos (CNMC &lt;RegistrosDocumento&gt;)
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center justify-center gap-2 bg-[#1E293B] hover:bg-[#334155] border border-[var(--border)] px-5 py-2.5 rounded-xl cursor-pointer text-gray-200 font-medium text-sm transition-all shadow-sm">
                      <FileUp size={18} className="text-[var(--lime)]" />
                      <span>Examinar equipo</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.zip,.doc,.docx,.xls,.xlsx"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    {file ? (
                      <div className="flex items-center gap-2 bg-[#1E293B] px-3 py-1.5 rounded-lg border border-[var(--lime)]/40 text-sm text-gray-200">
                        <CheckCircle2 size={15} className="text-[var(--lime)]" />
                        <span className="truncate max-w-xs">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          className="text-gray-400 hover:text-red-400 ml-1"
                          title="Quitar adjunto"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)] text-sm italic">Ningún archivo seleccionado</span>
                    )}
                  </div>
                  {file && (
                    <div className="max-w-md space-y-1.5 pt-1">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                        Tipo de Documentación Aportada (Tabla 61 CNMC)
                      </label>
                      <select
                        value={tipoDocAportado}
                        onChange={(e) => setTipoDocAportado(e.target.value)}
                        className="w-full border border-[var(--border)] bg-[#1E293B] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--lime)]"
                      >
                        {TIPOS_DOCUMENTACION_CNMC.map((td) => (
                          <option key={td.codigo} value={td.codigo}>
                            {td.descripcion}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {clientData && (
                  <div className="mt-8 overflow-hidden border border-[var(--border)] rounded-2xl shadow-lg animate-in fade-in zoom-in-95 duration-500">
                    <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border)] flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-[var(--text-primary)] px-2 py-1">
                        Facturas de Distribuidora (F1) Disponibles
                      </div>
                      <button
                        onClick={() => {
                          setSelectedF1Id('');
                          setDynamicFields((prev) => ({ ...prev, 'NUM FACTURA ATR': '' }));
                        }}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-3 py-1 rounded border border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!selectedF1Id}
                      >
                        Deseleccionar
                      </button>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                      {f1Invoices.length === 0 ? (
                        <div className="p-6 text-center text-[var(--text-muted)] text-sm">
                          No se encontraron facturas F1 para este CUPS.
                        </div>
                      ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap bg-[#111827]">
                          <thead className="bg-[#1E293B] text-gray-300 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-center">Marcar</th>
                              <th className="px-4 py-3 font-semibold">Codigo Fiscal</th>
                              <th className="px-4 py-3 font-semibold">Tipo Factura</th>
                              <th className="px-4 py-3 font-semibold">Motivo Factura</th>
                              <th className="px-4 py-3 font-semibold">Desde</th>
                              <th className="px-4 py-3 font-semibold">Hasta</th>
                              <th className="px-4 py-3 font-semibold">Excedentes</th>
                              <th className="px-4 py-3 font-semibold text-[var(--lime)]">Energia P1</th>
                              <th className="px-4 py-3 font-semibold text-[var(--lime)]">Energia P2</th>
                              <th className="px-4 py-3 font-semibold text-[var(--lime)]">Energia P3</th>
                              <th className="px-4 py-3 font-semibold text-[var(--lime)]">Energia P4</th>
                              <th className="px-4 py-3 font-semibold text-[var(--lime)]">Energia P5</th>
                              <th className="px-4 py-3 font-semibold text-[var(--lime)]">Energia P6</th>
                              <th className="px-4 py-3 font-semibold text-blue-400">Potencia P1</th>
                              <th className="px-4 py-3 font-semibold text-blue-400">Potencia P2</th>
                              <th className="px-4 py-3 font-semibold text-blue-400">Potencia P3</th>
                              <th className="px-4 py-3 font-semibold text-blue-400">Potencia P4</th>
                              <th className="px-4 py-3 font-semibold text-blue-400">Potencia P5</th>
                              <th className="px-4 py-3 font-semibold text-blue-400">Potencia P6</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-300 divide-y divide-[var(--border)]">
                            {f1Invoices.map((f1) => (
                              <tr
                                key={f1.id}
                                className={`hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer ${
                                  selectedF1Id === f1.id ? 'bg-[rgba(222,255,154,0.05)] ring-1 ring-[var(--lime)] ring-inset' : ''
                                }`}
                                onClick={() => {
                                  setSelectedF1Id(f1.id);
                                  if (f1.codigoFiscal) {
                                    setDynamicFields((prev) => ({ ...prev, 'NUM FACTURA ATR': f1.codigoFiscal }));
                                  }
                                }}
                              >
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="radio"
                                    name="f1Selector"
                                    checked={selectedF1Id === f1.id}
                                    onChange={() => {
                                      setSelectedF1Id(f1.id);
                                      if (f1.codigoFiscal) {
                                        setDynamicFields((prev) => ({ ...prev, 'NUM FACTURA ATR': f1.codigoFiscal }));
                                      }
                                    }}
                                    className="w-4 h-4 accent-[var(--lime)] cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </td>
                                <td className="px-4 py-3 font-mono text-[var(--lime)] font-bold">{f1.codigoFiscal || '-'}</td>
                                <td className="px-4 py-3">{f1.tipoFactura || '-'}</td>
                                <td className="px-4 py-3">{f1.motivoFactura || '-'}</td>
                                <td className="px-4 py-3">
                                  {f1.fechaInicio ? new Date(f1.fechaInicio).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-3">
                                  {f1.fechaFin ? new Date(f1.fechaFin).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-3">{f1.excedentes || '0'}</td>
                                <td className="px-4 py-3 font-medium">{f1.energiaP1 || '0'}</td>
                                <td className="px-4 py-3 font-medium">{f1.energiaP2 || '0'}</td>
                                <td className="px-4 py-3 font-medium">{f1.energiaP3 || '0'}</td>
                                <td className="px-4 py-3 font-medium">{f1.energiaP4 || '0'}</td>
                                <td className="px-4 py-3 font-medium">{f1.energiaP5 || '0'}</td>
                                <td className="px-4 py-3 font-medium">{f1.energiaP6 || '0'}</td>
                                <td className="px-4 py-3 font-medium text-blue-300">{f1.potenciaP1 || '0'}</td>
                                <td className="px-4 py-3 font-medium text-blue-300">{f1.potenciaP2 || '0'}</td>
                                <td className="px-4 py-3 font-medium text-blue-300">{f1.potenciaP3 || '0'}</td>
                                <td className="px-4 py-3 font-medium text-blue-300">{f1.potenciaP4 || '0'}</td>
                                <td className="px-4 py-3 font-medium text-blue-300">{f1.potenciaP5 || '0'}</td>
                                <td className="px-4 py-3 font-medium text-blue-300">{f1.potenciaP6 || '0'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'Masiva' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[var(--bg-elevated)] p-6 md:p-8 rounded-2xl border border-[var(--border)] shadow-lg space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[var(--border)] pb-4 mb-6">
                <h3 className="text-sm font-bold text-[var(--lime)] tracking-widest uppercase">Origen de Datos</h3>
                <div className="flex bg-[#111827] rounded-lg p-1 border border-[var(--border)] mt-4 md:mt-0">
                  <button
                    onClick={() => setMasivaInputMode('csv')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      masivaInputMode === 'csv' ? 'bg-[var(--lime)] text-[#0B0F19]' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Aportar CSV
                  </button>
                  {submotivo.includes('009') && (
                    <button
                      onClick={() => setMasivaInputMode('facturas')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        masivaInputMode === 'facturas'
                          ? 'bg-[var(--lime)] text-[#0B0F19]'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Seleccionar Facturas
                    </button>
                  )}
                  {submotivo.includes('006') && (
                    <button
                      onClick={() => setMasivaInputMode('retrasos')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        masivaInputMode === 'retrasos'
                          ? 'bg-[var(--lime)] text-[#0B0F19]'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Buscar Retrasos
                    </button>
                  )}
                </div>
              </div>

              {masivaInputMode === 'csv' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-[var(--text-muted)] block">
                      1. Archivo Base (Requerido)
                    </label>
                    <div className="border-2 border-dashed border-[var(--lime)] bg-[rgba(222,255,154,0.02)] rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all hover:bg-[rgba(222,255,154,0.05)]">
                      <Upload size={32} className="text-[var(--lime)] mb-3" />
                      <label className="bg-[var(--lime)] text-[#0B0F19] font-bold px-6 py-2 rounded-lg cursor-pointer hover:brightness-110 transition-all shadow-md">
                        Seleccionar CSV
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <p className="mt-4 text-sm text-gray-300 font-medium">
                        {csvFile ? csvFile.name : 'Arrastre su CSV o haga clic para buscar'}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">Formato: CUPS;CODIGO FISCAL;MARCA</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-[var(--text-muted)] block">
                      2. Documentación de Respaldo (Opcional)
                    </label>
                    <div className="border-2 border-dashed border-[var(--border)] bg-[#111827] rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all hover:border-gray-500">
                      <FileUp size={32} className="text-gray-400 mb-3" />
                      <label className="bg-[#1E293B] border border-[var(--border)] text-gray-200 font-semibold px-6 py-2 rounded-lg cursor-pointer hover:bg-[#334155] transition-all shadow-sm">
                        Añadir Adjunto
                        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      </label>
                      <p className="mt-3 text-sm text-gray-400 font-medium">
                        {file ? file.name : 'Ej: PDF genérico para todas las reclamaciones'}
                      </p>
                      {file && (
                        <div className="mt-3 w-full max-w-xs text-left">
                          <select
                            value={tipoDocAportado}
                            onChange={(e) => setTipoDocAportado(e.target.value)}
                            className="w-full border border-[var(--border)] bg-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-gray-200"
                          >
                            {TIPOS_DOCUMENTACION_CNMC.map((td) => (
                              <option key={td.codigo} value={td.codigo}>
                                {td.descripcion}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {masivaInputMode === 'retrasos' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-wrap justify-between items-center gap-4 bg-[#111827] p-4 rounded-xl border border-[var(--border)]">
                    <div>
                      <h4 className="text-gray-200 font-bold">Buscador de Retrasos Automático (Cruce ERP + F1)</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Detecta suministros con 45 días o más sin facturación comprobando tanto facturas emitidas como F1 recibidos de distribuidora, e identifica los que ya tienen reclamación R1 abierta.
                      </p>
                    </div>
                    <button
                      onClick={handleSearchCupsRetrasos}
                      disabled={isSearchingCups}
                      className="bg-[var(--lime)] text-[#0B0F19] font-bold px-6 py-2 rounded-lg hover:brightness-110 flex items-center gap-2 shadow-sm whitespace-nowrap"
                    >
                      <Search size={16} /> {isSearchingCups ? 'Calculando...' : 'Buscar CUPS (≥ 45 días)'}
                    </button>
                  </div>

                  <div className="overflow-hidden border border-[var(--border)] rounded-xl">
                    <div className="p-3 bg-[#111827] border-b border-[var(--border)] flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-300">
                        {searchedCups.length} CUPS con retraso encontrados
                      </span>
                      <span className="text-xs text-[var(--lime)] font-bold px-2 py-1 bg-[rgba(222,255,154,0.1)] rounded">
                        {selectedCupsIds.length} seleccionados
                      </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto no-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap bg-[#1E293B]">
                        <thead className="bg-[#0B0F19] text-gray-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={searchedCups.length > 0 && selectedCupsIds.length > 0}
                                onChange={toggleAllCups}
                                className="w-4 h-4 accent-[var(--lime)] rounded"
                                title="Seleccionar todos sin reclamación abierta"
                              />
                            </th>
                            <th className="px-4 py-3">CUPS</th>
                            <th className="px-4 py-3">R1 Abierta</th>
                            <th className="px-4 py-3">Contrato</th>
                            <th className="px-4 py-3">Titular</th>
                            <th className="px-4 py-3">Alta Periodo</th>
                            <th className="px-4 py-3">Último Día Facturado</th>
                            <th className="px-4 py-3 text-[var(--lime)] font-bold">Retraso</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {searchedCups.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                                Pulsa en &quot;Buscar CUPS&quot; para escanear retrasos.
                              </td>
                            </tr>
                          ) : (
                            searchedCups.map((c) => (
                              <tr
                                key={c.cupsId}
                                onClick={() => toggleCupsSelection(c.cups)}
                                className={`cursor-pointer transition-colors ${
                                  selectedCupsIds.includes(c.cups) ? 'bg-[rgba(222,255,154,0.05)]' : 'hover:bg-[#334155]'
                                }`}
                              >
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedCupsIds.includes(c.cups)}
                                    onChange={() => toggleCupsSelection(c.cups)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 accent-[var(--lime)] rounded"
                                  />
                                </td>
                                <td className="px-4 py-3 font-mono text-[var(--lime)] text-xs font-bold">{c.cups}</td>
                                <td className="px-4 py-3">
                                  {c.openClaim ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700 text-amber-300 text-[11px] font-mono"
                                      title={`Reclamación abierta (${c.openClaim.estado})`}
                                    >
                                      <AlertTriangle size={11} /> #{c.openClaim.codigoSolicitud}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-gray-300 text-xs">{c.contrato}</td>
                                <td className="px-4 py-3 text-gray-300 truncate max-w-[200px]">{c.titular}</td>
                                <td className="px-4 py-3 text-gray-400">
                                  {new Date(c.inicioPeriodoContinuo).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-200">
                                  {new Date(c.ultimoDiaFacturado).toLocaleDateString()}{' '}
                                  <span className="text-[10px] text-gray-400">({c.fuenteUltimaFactura})</span>
                                </td>
                                <td className="px-4 py-3 font-bold text-red-400">{c.diasRetraso} días</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {masivaInputMode === 'facturas' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                        Desde
                      </label>
                      <input
                        type="date"
                        value={filtroDesde}
                        onChange={(e) => setFiltroDesde(e.target.value)}
                        className="w-full border border-[var(--border)] bg-[#111827] rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-2 focus:ring-[var(--lime)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                        Hasta
                      </label>
                      <input
                        type="date"
                        value={filtroHasta}
                        onChange={(e) => setFiltroHasta(e.target.value)}
                        className="w-full border border-[var(--border)] bg-[#111827] rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-2 focus:ring-[var(--lime)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                        Procedencia Hasta
                      </label>
                      <select
                        value={filtroProcedencia}
                        onChange={(e) => setFiltroProcedencia(e.target.value)}
                        className="w-full border border-[var(--border)] bg-[#111827] rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-2 focus:ring-[var(--lime)] appearance-none"
                      >
                        <option value="Telegestion">Telegestion</option>
                        <option value="TPL">TPL</option>
                        <option value="Telemedida">Telemedida</option>
                        <option value="Visual">Visual</option>
                        <option value="Estimada">Estimada</option>
                        <option value="Sin Lectura">Sin Lectura</option>
                        <option value="Autolectura">Autolectura</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                        Tipo Factura
                      </label>
                      <select
                        value={filtroTipoFactura}
                        onChange={(e) => setFiltroTipoFactura(e.target.value)}
                        className="w-full border border-[var(--border)] bg-[#111827] rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-2 focus:ring-[var(--lime)] appearance-none"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Rectificativa">Rectificativa</option>
                        <option value="Abono">Abono</option>
                        <option value="Regularizadora">Regularizadora</option>
                        <option value="Complementaria">Complementaria</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleSearchInvoices}
                        disabled={isSearchingInvoices}
                        className="w-full bg-[var(--lime)] text-[#0B0F19] font-bold px-4 py-2 rounded-lg hover:brightness-110 flex justify-center items-center gap-2"
                      >
                        <Search size={16} /> {isSearchingInvoices ? 'Buscando...' : 'Buscar'}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden border border-[var(--border)] rounded-xl">
                    <div className="p-3 bg-[#111827] border-b border-[var(--border)] flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-300">
                        {searchedInvoices.length} facturas encontradas
                      </span>
                      <span className="text-xs text-[var(--lime)] font-bold px-2 py-1 bg-[rgba(222,255,154,0.1)] rounded">
                        {selectedInvoiceIds.length} seleccionadas
                      </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto no-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap bg-[#1E293B]">
                        <thead className="bg-[#0B0F19] text-gray-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={searchedInvoices.length > 0 && selectedInvoiceIds.length > 0}
                                onChange={toggleAllInvoices}
                                className="w-4 h-4 accent-[var(--lime)] rounded"
                                title="Seleccionar facturas sin R1 abierta"
                              />
                            </th>
                            <th className="px-4 py-3">Núm Factura</th>
                            <th className="px-4 py-3">R1 Abierta</th>
                            <th className="px-4 py-3">Titular</th>
                            <th className="px-4 py-3">CUPS</th>
                            <th className="px-4 py-3">Contrato</th>
                            <th className="px-4 py-3">Cód. Fiscal F1</th>
                            <th className="px-4 py-3">Fecha Fact.</th>
                            <th className="px-4 py-3">Proc. Hasta</th>
                            <th className="px-4 py-3">Desde</th>
                            <th className="px-4 py-3">Hasta</th>
                            <th className="px-4 py-3">Total</th>
                            <th className="px-4 py-3 text-center">PDF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {searchedInvoices.length === 0 ? (
                            <tr>
                              <td colSpan={13} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                                Utilice los filtros para buscar facturas.
                              </td>
                            </tr>
                          ) : (
                            searchedInvoices.map((inv) => (
                              <tr
                                key={inv.id}
                                onClick={() => toggleInvoiceSelection(inv.id)}
                                className={`cursor-pointer transition-colors ${
                                  selectedInvoiceIds.includes(inv.id)
                                    ? 'bg-[rgba(222,255,154,0.05)]'
                                    : 'hover:bg-[#334155]'
                                }`}
                              >
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedInvoiceIds.includes(inv.id)}
                                    onChange={() => toggleInvoiceSelection(inv.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 accent-[var(--lime)] rounded"
                                  />
                                </td>
                                <td className="px-4 py-3 font-mono text-gray-300">{inv.invoiceNumber}</td>
                                <td className="px-4 py-3">
                                  {inv.openClaim ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700 text-amber-300 text-[11px] font-mono"
                                      title={`Reclamación abierta (${inv.openClaim.estado})`}
                                    >
                                      <AlertTriangle size={11} /> #{inv.openClaim.codigoSolicitud}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 truncate max-w-[150px]">{inv.clientName}</td>
                                <td className="px-4 py-3 font-mono text-[var(--lime)] text-xs">{inv.cups || '-'}</td>
                                <td className="px-4 py-3 text-gray-300 text-xs">{inv.contractCode || '-'}</td>
                                <td className="px-4 py-3 font-mono text-purple-400 text-xs">{inv.codigoFiscal || '-'}</td>
                                <td className="px-4 py-3 text-gray-300">
                                  {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                                  {inv.procedenciaHasta || '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-300">
                                  {inv.billingStart ? new Date(inv.billingStart).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-300">
                                  {inv.billingEnd ? new Date(inv.billingEnd).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-3 font-bold text-gray-200">
                                  {inv.totalAmount ? `${inv.totalAmount.toFixed(2)} €` : '-'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {inv.pdfUrl ? (
                                    <a
                                      href={inv.pdfUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 flex justify-center"
                                      onClick={(e) => e.stopPropagation()}
                                      title="Ver PDF"
                                    >
                                      PDF
                                    </a>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[var(--bg-elevated)] p-6 md:p-8 rounded-2xl border border-[var(--border)] shadow-lg">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                  Comentarios
                </label>
                <textarea
                  rows={4}
                  maxLength={4000}
                  className="w-full border border-[var(--border)] bg-[#111827] rounded-xl px-4 py-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all shadow-sm resize-y"
                  placeholder="Escriba aquí sus comentarios..."
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {mode && (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4">
            <label className="flex items-center gap-3 cursor-pointer select-none bg-[var(--bg-elevated)] border border-[var(--border)] px-4 py-3 rounded-xl">
              <input
                type="checkbox"
                checked={registerInErp}
                onChange={(e) => setRegisterInErp(e.target.checked)}
                className="w-4 h-4 accent-[var(--lime)] rounded"
              />
              <span className="text-sm text-gray-200">
                Registrar automáticamente Paso 01 en el ERP al generar{' '}
                <span className="text-xs text-gray-400">(sube el XML a R2 y aparece al instante en Reclamaciones)</span>
              </span>
            </label>

            <button
              onClick={handleGenerate}
              disabled={submitting}
              className="bg-[var(--lime)] text-[#0B0F19] font-extrabold text-lg py-4 px-10 rounded-xl shadow-[0_0_20px_rgba(222,255,154,0.3)] hover:shadow-[0_0_30px_rgba(222,255,154,0.5)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <Send size={22} /> {submitting ? 'Generando...' : 'Generar Reclamación'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
