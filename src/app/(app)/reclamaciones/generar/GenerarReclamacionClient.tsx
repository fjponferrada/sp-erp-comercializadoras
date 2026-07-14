'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Send, Upload, FileUp } from 'lucide-react';
import { searchCupsForClaim, generateClaim, searchInvoicesForMassClaim, searchCupsWithBillingDelay } from '@/app/actions/reclamacionesActions';
import toast from 'react-hot-toast';
import { SUBTIPO_REQUIREMENTS } from '../utils/casuisticas';
import { CNMC_DROPDOWN_OPTIONS } from '../utils/cnmc_codes';

interface GenerarReclamacionClientProps {
  motivos: any[];
  submotivos: any[];
}

export default function GenerarReclamacionClient({ motivos, submotivos }: GenerarReclamacionClientProps) {
  const router = useRouter();
  
  const [mode, setMode] = useState<'' | 'Individual' | 'Masiva'>('');
  const [motivo, setMotivo] = useState('');
  const [submotivo, setSubmotivo] = useState('');
  
  // Individual State
  const [cups, setCups] = useState('');
  const [clientData, setClientData] = useState<any>(null);
  const [f1Invoices, setF1Invoices] = useState<any[]>([]);
  const [selectedF1Id, setSelectedF1Id] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [searching, setSearching] = useState(false);
  
  // Dynamic Fields State
  const [fechaLectura, setFechaLectura] = useState('');
  const [lecturas, setLecturas] = useState<Record<string, string>>({
    P1: '', P2: '', P3: '', P4: '', P5: '', P6: ''
  });
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  
  // File state (Masiva & Específica)
  const [file, setFile] = useState<File | null>(null);
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

  // Efecto para autocompletar comentarios
  React.useEffect(() => {
    if (mode === 'Masiva' && submotivo.includes('009')) {
      setComentarios('El Cliente niega haber imposibilitado el acceso para la toma de lectura, tampoco tiene aviso de ausencia, ni se le ofrece alternativa o tlf para concertar cita. La Distribuidora está incumpliendo su obligación de mantenimiento del equipo de medida (incidencia de comunicaciones persistente). Según el RD 1110/2007 y la Resolución de 18 de diciembre de 2019, ante la falta de lectura real por fallo del equipo, deben proceder a su reparación inmediata. SOLICITAMOS: 1) Anulación de la lectura estimada por ser materialmente errónea. 2) Reparación urgente del sistema de telegestión. 3) Refacturación con lectura REAL. De persistir la estimación sin subsanar la avería del contador, se elevará denuncia ante el órgano competente de Energía de la Junta de Andalucía');
    } else if (mode === 'Masiva' && submotivo.includes('006')) {
      setComentarios('Solicitamos el envío de lecturas para facturar a este cliente y que se realice la recepción de facturas en plazo. Si existe algún problema para la suspensión del proceso de facturación para este cliente, rogamos lo comuniquen a nosotros y al cliente.');
    } else if (motivo.startsWith('02') && submotivo.includes('036')) {
      setComentarios('El cliente no está de acuerdo con las lecturas facturadas en este periodo. Aportamos sus lecturas del contador');
    }
  }, [mode, submotivo, motivo]);

  const handleSearchCups = async () => {
    if (!cups) return toast.error('Introduce un CUPS');
    setSearching(true);
    const res = await searchCupsForClaim(cups);
    if (res.success && res.data) {
      setClientData(res.data);
      setF1Invoices(res.data.f1Invoices || []);
      toast.success('Datos recuperados');
    } else {
      toast.error(res.error || 'No se encontró el CUPS');
      setClientData(null);
      setF1Invoices([]);
    }
    setSearching(false);
  };

  const handleSearchCupsRetrasos = async () => {
    setIsSearchingCups(true);
    const res = await searchCupsWithBillingDelay(45);
    if (res.success && res.data) {
      setSearchedCups(res.data);
      toast.success(`${res.data.length} CUPS con retraso encontrados`);
    } else {
      toast.error(res.error || 'Error al buscar CUPS');
      setSearchedCups([]);
    }
    setIsSearchingCups(false);
  };

  const toggleAllCups = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCupsIds(searchedCups.map(c => c.cups));
    } else {
      setSelectedCupsIds([]);
    }
  };

  const toggleCupsSelection = (cups: string) => {
    if (selectedCupsIds.includes(cups)) {
      setSelectedCupsIds(selectedCupsIds.filter(id => id !== cups));
    } else {
      setSelectedCupsIds([...selectedCupsIds, cups]);
    }
  };

  const handleGenerate = async () => {
    if (!mode) return toast.error('Selecciona el tipo de reclamación');
    if (!motivo) return toast.error('Selecciona un Motivo');
    if (!submotivo) return toast.error('Selecciona un Submotivo');
    
    setSubmitting(true);
    
    let csvContent = '';
    if (mode === 'Masiva' && csvFile) {
      csvContent = await csvFile.text();
    }

    const payload = {
      mode,
      motivo,
      submotivo,
      cups: mode === 'Individual' ? cups : undefined,
      clientData: mode === 'Individual' ? clientData : undefined,
      selectedF1Id: mode === 'Individual' ? selectedF1Id : undefined,
      comentarios,
      csvContent,
      invoiceIds: mode === 'Masiva' && masivaInputMode === 'facturas' ? selectedInvoiceIds : undefined,
      cupsIds: mode === 'Masiva' && masivaInputMode === 'retrasos' ? selectedCupsIds : undefined,
      dynamicFields,
      fechaLectura: submotivo.includes('036') ? fechaLectura : undefined,
      lecturas: submotivo.includes('036') ? lecturas : undefined
    };

    const res = await generateClaim(payload);
    if (res.success && res.fileContent) {
      toast.success('Reclamación generada correctamente');
      
      // Trigger download
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
      a.download = res.fileName || 'reclamacion';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      // Opcional: resetear algunos campos si fuera necesario
      // setCups('');
      // setClientData(null);
    } else {
      toast.error(res.error || 'Error al generar');
    }
    setSubmitting(false);
  };

  const handleSearchInvoices = async () => {
    setIsSearchingInvoices(true);
    const res = await searchInvoicesForMassClaim(filtroDesde, filtroHasta, filtroProcedencia, filtroTipoFactura);
    if (res.success && res.invoices) {
      setSearchedInvoices(res.invoices);
      toast.success(`Se encontraron ${res.invoices.length} facturas`);
    } else {
      toast.error(res.error || 'Error al buscar facturas');
      setSearchedInvoices([]);
    }
    setIsSearchingInvoices(false);
  };

  const toggleInvoiceSelection = (id: string) => {
    if (selectedInvoiceIds.includes(id)) {
      setSelectedInvoiceIds(selectedInvoiceIds.filter(i => i !== id));
    } else {
      setSelectedInvoiceIds([...selectedInvoiceIds, id]);
    }
  };

  const toggleAllInvoices = () => {
    if (selectedInvoiceIds.length === searchedInvoices.length && searchedInvoices.length > 0) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(searchedInvoices.map(i => i.id));
    }
  };

  // Mapeo estricto definido por el usuario
  const strictMapping: Record<string, string[]> = {
    '01': ['001', '002', '038'],
    '02': [
      '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', 
      '036', '037', '040', '046', '047', '049', '055', '056', '057', '067', 
      '068', '069', '073', '075', '101', '102', '103', '104', '105', '109', '110'
    ],
    '03': [
      '013', '014', '015', '034', '035', '045', '048', '058', '059', '060',
      '061', '062', '064', '065', '066', '071', '072', '074', '100', '106',
      '107', '108', '111', '112', '113', '114', '076', '077', '079'
    ],
    '04': ['018', '019'],
    '05': ['020', '021', '022', '023', '039'],
    '06': ['024', '025', '026', '041', '042', '043', '044'],
    '07': ['027', '028', '029', '030', '031', '032', '063', '070']
    // El resto se irán rellenando según indicaciones
  };

  const allowedSubmotivos = motivo ? strictMapping[motivo.split('-')[0].trim()] || [] : [];

  const suggestedSubmotivos = submotivos.filter(sm => {
    if (!motivo) return false;
    return allowedSubmotivos.includes(sm['CÓDIGO']);
  });

  const otherSubmotivos = submotivos.filter(sm => !suggestedSubmotivos.includes(sm));

  const selectedF1 = f1Invoices.find(f => f.id === selectedF1Id);

  return (
    <div className="min-h-screen relative outline-none pb-20" style={{ background: 'var(--bg-base)' }}>
      <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Generación de Reclamaciones
          </h1>
          <p className="text-[var(--text-muted)] mt-2">
            Configure los parámetros para generar reclamaciones a distribuidora.
          </p>
        </div>
        
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
                  setMode(e.target.value as any);
                  if (e.target.value === 'Masiva') {
                    const factMotivo = motivos.find(m => m['CÓDIGO'] === '02' || m['DESCRIPCIÓN']?.includes('FACTURACION'));
                    if (factMotivo) {
                      setMotivo(`${factMotivo['CÓDIGO']} - ${factMotivo['DESCRIPCIÓN']}`);
                    }
                  } else {
                    setMotivo('');
                  }
                }}
              >
                <option value="" className="bg-[#111827] text-gray-400">Seleccione una opción</option>
                <option value="Individual" className="bg-[#111827] text-gray-100">Individual</option>
                <option value="Masiva" className="bg-[#111827] text-gray-100">Masiva</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Motivo
              </label>
              <select 
                className="w-full border border-[var(--border)] bg-[#111827] rounded-xl px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={mode === 'Masiva'}
              >
                {mode === 'Masiva' ? (
                   motivos.filter(m => m['CÓDIGO'] === '02' || m['DESCRIPCIÓN']?.includes('FACTURACION')).map((m, i) => (
                    <option key={i} value={`${m['CÓDIGO']} - ${m['DESCRIPCIÓN']}`} className="bg-[#111827] text-gray-100">
                      {m['CÓDIGO']} - {m['DESCRIPCIÓN']}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="" className="bg-[#111827] text-gray-400">Seleccione un motivo</option>
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
                onChange={(e) => setSubmotivo(e.target.value)}
              >
                <option value="" className="bg-[#111827] text-gray-400">Seleccione un submotivo</option>
                {motivo && suggestedSubmotivos.length > 0 && (
                  <optgroup label="Sugeridos para este motivo" className="bg-[#1E293B] text-[var(--lime)] font-bold">
                    {suggestedSubmotivos.map((sm, i) => (
                      <option key={`sug-${i}`} value={`${sm['CÓDIGO']}-${sm['DESCRIPCIÓN']}`} className="bg-[#111827] text-gray-100 font-normal">
                        {sm['CÓDIGO']} - {sm['DESCRIPCIÓN']}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={motivo ? "Otros submotivos" : "Todos los submotivos"} className="bg-[#1E293B] text-gray-400 font-bold">
                  {otherSubmotivos.map((sm, i) => (
                    <option key={`oth-${i}`} value={`${sm['CÓDIGO']}-${sm['DESCRIPCIÓN']}`} className="bg-[#111827] text-gray-100 font-normal">
                      {sm['CÓDIGO']} - {sm['DESCRIPCIÓN']}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {mode === 'Individual' && (
          <div className="bg-[var(--bg-elevated)] p-6 md:p-8 rounded-2xl border border-[var(--border)] shadow-lg space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Búsqueda por CUPS
                </label>
                <div className="flex w-full group shadow-sm">
                  <input 
                    type="text" 
                    value={cups}
                    onChange={(e) => setCups(e.target.value)}
                    className="flex-1 border border-[var(--border)] border-r-0 bg-[#111827] rounded-l-xl px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all"
                    placeholder="ES0000000000000000..."
                  />
                  <button 
                    onClick={handleSearchCups}
                    disabled={searching}
                    className="bg-[var(--lime)] text-[#0B0F19] font-bold px-6 py-3 rounded-r-xl flex items-center gap-2 hover:brightness-110 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:ring-offset-2 focus:ring-offset-[#111827]"
                  >
                    <Search size={18} /> {searching ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div></div>
            </div>

            {clientData && (
              <div className="space-y-8 mt-8 animate-in fade-in duration-500">
                
                <div className="bg-[#111827] p-5 rounded-xl border border-[var(--border)]">
                  <h3 className="text-xs font-bold text-[var(--lime)] tracking-widest uppercase mb-4">Información del Cliente</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <span className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">NIF Cliente</span>
                      <span className="block text-sm text-gray-200 font-medium truncate">{clientData.clientVat || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Nombre</span>
                      <span className="block text-sm text-gray-200 font-medium truncate">{clientData.clientName || '-'}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">CUPS</span>
                      <span className="block text-sm text-gray-200 font-mono truncate">{clientData.cups || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Comentarios
                  </label>
                  <textarea 
                    className="w-full border border-[var(--border)] bg-[#111827] rounded-xl p-4 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all min-h-[120px] shadow-sm resize-y"
                    placeholder="Escriba aquí sus comentarios..."
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                  />
                </div>

                {(() => {
                  if (!submotivo) return null;
                  const submotivoCode = submotivo.split('-')[0].trim();
                  const requirements = SUBTIPO_REQUIREMENTS[submotivoCode];
                  if (!requirements || requirements.length === 0) return null;
                  
                  return (
                    <div className="bg-[#111827] p-6 rounded-xl border border-[var(--border)] animate-in fade-in zoom-in-95 duration-300">
                      <h3 className="text-sm font-bold text-[var(--lime)] tracking-widest uppercase mb-6 flex items-center gap-2">
                        <FileUp size={16} /> Datos Específicos de la CNMC
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {requirements.map((fieldName) => {
                          if (fieldName === 'LECTURA' || fieldName === 'FECHA LECTURA') return null; // Handled specially below if present

                        const isDate = fieldName.includes('FECHA');
                        const isNumber = fieldName.includes('IMPORTE');
                        const dropdownOptions = CNMC_DROPDOWN_OPTIONS[fieldName];
                        const hasOptions = dropdownOptions && dropdownOptions.length > 0;
                        
                        return (
                          <div key={fieldName} className="space-y-2">
                            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                              {fieldName}
                            </label>
                            {hasOptions ? (
                              <select
                                className="w-full border border-[var(--border)] bg-[#1E293B] rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--lime)] focus:border-transparent transition-all"
                                value={dynamicFields[fieldName] || ''}
                                onChange={(e) => setDynamicFields({ ...dynamicFields, [fieldName]: e.target.value })}
                              >
                                <option value="">Seleccione una opción...</option>
                                {Array.from(new Map(dropdownOptions.map(opt => [opt.codigo, opt])).values()).map((opt: any) => (
                                  <option key={opt.codigo} value={opt.codigo}>{opt.descripcion}</option>
                                ))}
                              </select>
                            ) : (
                              <input 
                                type={isDate ? "date" : (isNumber ? "number" : "text")} 
                                step={isNumber ? "0.01" : undefined}
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
                          FECHA DE LECTURA
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
                          LECTURAS PROPUESTAS
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

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                    Archivos Adjuntos (Específicos)
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center justify-center gap-2 bg-[#1E293B] hover:bg-[#334155] border border-[var(--border)] px-5 py-3 rounded-xl cursor-pointer text-gray-300 font-medium text-sm transition-all shadow-sm">
                      <FileUp size={18} className="text-[var(--lime)]" />
                      <span>Examinar equipo</span>
                      <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </label>
                    <span className="text-[var(--text-muted)] text-sm italic">
                      {file ? file.name : 'Ningún archivo seleccionado'}
                    </span>
                  </div>
                </div>

                <div className="mt-8 overflow-hidden border border-[var(--border)] rounded-2xl shadow-lg animate-in fade-in zoom-in-95 duration-500">
                  <div className="p-3 bg-[var(--bg-elevated)] border-b border-[var(--border)] flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-[var(--text-primary)] px-2 py-1">Facturas de Distribuidora (F1) Disponibles</div>
                    <button 
                      onClick={() => {
                        setSelectedF1Id('');
                        setDynamicFields(prev => ({ ...prev, 'NUM FACTURA ATR': '' }));
                      }}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-3 py-1 rounded border border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!selectedF1Id}
                    >
                      Deseleccionar
                    </button>
                  </div>
                  <div className="overflow-x-auto no-scrollbar">
                    {f1Invoices.length === 0 ? (
                      <div className="p-6 text-center text-[var(--text-muted)] text-sm">No se encontraron facturas F1 para este CUPS.</div>
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
                              className={`hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer ${selectedF1Id === f1.id ? 'bg-[rgba(222,255,154,0.05)] ring-1 ring-[var(--lime)] ring-inset' : ''}`}
                              onClick={() => {
                                setSelectedF1Id(f1.id);
                                if (f1.codigoFiscal) {
                                  setDynamicFields(prev => ({ ...prev, 'NUM FACTURA ATR': f1.codigoFiscal }));
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
                                      setDynamicFields(prev => ({ ...prev, 'NUM FACTURA ATR': f1.codigoFiscal }));
                                    }
                                  }}
                                  className="w-4 h-4 accent-[var(--lime)] cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="px-4 py-3 font-mono text-[var(--lime)] font-bold">{f1.codigoFiscal || '-'}</td>
                              <td className="px-4 py-3">{f1.tipoFactura || '-'}</td>
                              <td className="px-4 py-3">{f1.motivoFactura || '-'}</td>
                              <td className="px-4 py-3">{f1.fechaInicio ? new Date(f1.fechaInicio).toLocaleDateString() : '-'}</td>
                              <td className="px-4 py-3">{f1.fechaFin ? new Date(f1.fechaFin).toLocaleDateString() : '-'}</td>
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
              </div>
            )}
          </div>
        )}

        {mode === 'Masiva' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[var(--bg-elevated)] p-6 md:p-8 rounded-2xl border border-[var(--border)] shadow-lg space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[var(--border)] pb-4 mb-6">
                <h3 className="text-sm font-bold text-[var(--lime)] tracking-widest uppercase">
                  Origen de Datos
                </h3>
                <div className="flex bg-[#111827] rounded-lg p-1 border border-[var(--border)] mt-4 md:mt-0">
                  <button
                    onClick={() => setMasivaInputMode('csv')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${masivaInputMode === 'csv' ? 'bg-[var(--lime)] text-[#0B0F19]' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    Aportar CSV
                  </button>
                  {submotivo.includes('009') && (
                    <button
                      onClick={() => setMasivaInputMode('facturas')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${masivaInputMode === 'facturas' ? 'bg-[var(--lime)] text-[#0B0F19]' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                      Seleccionar Facturas
                    </button>
                  )}
                  {submotivo.includes('006') && (
                    <button
                      onClick={() => setMasivaInputMode('retrasos')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${masivaInputMode === 'retrasos' ? 'bg-[var(--lime)] text-[#0B0F19]' : 'text-gray-400 hover:text-gray-200'}`}
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
                        <input type="file" accept=".csv" className="hidden" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
                      </label>
                      <p className="mt-4 text-sm text-gray-300 font-medium">
                        {csvFile ? csvFile.name : 'Arrastre su CSV o haga clic para buscar'}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Formato: CUPS;CODIGO FISCAL;MARCA
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-[var(--text-muted)] block">
                      2. Documentación de Respaldo (Opcional)
                    </label>
                    <div className="border-2 border-dashed border-[var(--border)] bg-[#111827] rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all hover:border-gray-500 hover:bg-[#1E293B]">
                      <FileUp size={32} className="text-gray-400 mb-3" />
                      <label className="bg-[#1E293B] border border-[var(--border)] text-gray-200 font-semibold px-6 py-2 rounded-lg cursor-pointer hover:bg-[#334155] transition-all shadow-sm">
                        Añadir Adjunto
                        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      </label>
                      <p className="mt-4 text-sm text-gray-400 font-medium">
                        {file ? file.name : 'Ej: PDF genérico para todas las reclamaciones'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {masivaInputMode === 'retrasos' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center bg-[#111827] p-4 rounded-xl border border-[var(--border)]">
                    <div>
                      <h4 className="text-gray-200 font-bold">Buscador de Retrasos Automático</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Detecta todos los CUPS con contratos activos (o recién dados de baja) que lleven 45 días o más sin facturación.
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
                    <div className="max-h-80 overflow-y-auto no-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap bg-[#1E293B]">
                        <thead className="bg-[#0B0F19] text-gray-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={searchedCups.length > 0 && selectedCupsIds.length === searchedCups.length}
                                onChange={toggleAllCups}
                                className="w-4 h-4 accent-[var(--lime)] rounded"
                              />
                            </th>
                            <th className="px-4 py-3">CUPS</th>
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
                              <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                                Pulsa en "Buscar CUPS" para escanear retrasos.
                              </td>
                            </tr>
                          ) : (
                            searchedCups.map((c) => (
                              <tr 
                                key={c.cupsId} 
                                onClick={() => toggleCupsSelection(c.cups)}
                                className={`cursor-pointer transition-colors ${selectedCupsIds.includes(c.cups) ? 'bg-[rgba(222,255,154,0.05)]' : 'hover:bg-[#334155]'}`}
                              >
                                <td className="px-4 py-3 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedCupsIds.includes(c.cups)}
                                    onChange={() => toggleCupsSelection(c.cups)}
                                    onClick={e => e.stopPropagation()}
                                    className="w-4 h-4 accent-[var(--lime)] rounded"
                                  />
                                </td>
                                <td className="px-4 py-3 font-mono text-[var(--lime)] text-xs font-bold">{c.cups}</td>
                                <td className="px-4 py-3 text-gray-300 text-xs">{c.contrato}</td>
                                <td className="px-4 py-3 text-gray-300 truncate max-w-[200px]">{c.titular}</td>
                                <td className="px-4 py-3 text-gray-400">{new Date(c.inicioPeriodoContinuo).toLocaleDateString()}</td>
                                <td className="px-4 py-3 font-medium text-gray-200">{new Date(c.ultimoDiaFacturado).toLocaleDateString()}</td>
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
                  <div className="grid grid-cols-5 gap-4 mb-4">
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Desde</label>
                      <input 
                        type="date" 
                        value={filtroDesde} 
                        onChange={e => setFiltroDesde(e.target.value)} 
                        className="w-full border border-[var(--border)] bg-[#111827] rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-2 focus:ring-[var(--lime)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Hasta</label>
                      <input 
                        type="date" 
                        value={filtroHasta} 
                        onChange={e => setFiltroHasta(e.target.value)} 
                        className="w-full border border-[var(--border)] bg-[#111827] rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-2 focus:ring-[var(--lime)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Procedencia Hasta</label>
                      <select 
                        value={filtroProcedencia} 
                        onChange={e => setFiltroProcedencia(e.target.value)} 
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
                      <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Tipo Factura</label>
                      <select 
                        value={filtroTipoFactura} 
                        onChange={e => setFiltroTipoFactura(e.target.value)} 
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
                    <div className="max-h-80 overflow-y-auto no-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap bg-[#1E293B]">
                        <thead className="bg-[#0B0F19] text-gray-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                checked={searchedInvoices.length > 0 && selectedInvoiceIds.length === searchedInvoices.length}
                                onChange={toggleAllInvoices}
                                className="w-4 h-4 accent-[var(--lime)] rounded"
                              />
                            </th>
                            <th className="px-4 py-3">Núm Factura</th>
                            <th className="px-4 py-3">Titular</th>
                            <th className="px-4 py-3">CUPS</th>
                            <th className="px-4 py-3">Contrato</th>
                            <th className="px-4 py-3">Cód. Fiscal F1</th>
                            <th className="px-4 py-3">Tipo Factura</th>
                            <th className="px-4 py-3">Fecha Fact.</th>
                            <th className="px-4 py-3">Proc. Desde</th>
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
                              <td colSpan={14} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                                Utilice los filtros para buscar facturas.
                              </td>
                            </tr>
                          ) : (
                            searchedInvoices.map((inv) => (
                              <tr 
                                key={inv.id} 
                                onClick={() => toggleInvoiceSelection(inv.id)}
                                className={`cursor-pointer transition-colors ${selectedInvoiceIds.includes(inv.id) ? 'bg-[rgba(222,255,154,0.05)]' : 'hover:bg-[#334155]'}`}
                              >
                                <td className="px-4 py-3 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedInvoiceIds.includes(inv.id)}
                                    onChange={() => toggleInvoiceSelection(inv.id)}
                                    onClick={e => e.stopPropagation()}
                                    className="w-4 h-4 accent-[var(--lime)] rounded"
                                  />
                                </td>
                                <td className="px-4 py-3 font-mono text-gray-300">{inv.invoiceNumber}</td>
                                <td className="px-4 py-3 truncate max-w-[150px]">{inv.clientName}</td>
                                <td className="px-4 py-3 font-mono text-[var(--lime)] text-xs">{inv.cups || '-'}</td>
                                <td className="px-4 py-3 text-gray-300 text-xs">{inv.contractCode || '-'}</td>
                                <td className="px-4 py-3 font-mono text-purple-400 text-xs">{inv.codigoFiscal || '-'}</td>
                                <td className="px-4 py-3 text-gray-400 text-xs">{inv.invoiceType || '-'}</td>
                                <td className="px-4 py-3 text-gray-300">{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '-'}</td>
                                <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{inv.procedenciaDesde || '-'}</td>
                                <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{inv.procedenciaHasta || '-'}</td>
                                <td className="px-4 py-3 text-gray-300">{inv.billingStart ? new Date(inv.billingStart).toLocaleDateString() : '-'}</td>
                                <td className="px-4 py-3 text-gray-300">{inv.billingEnd ? new Date(inv.billingEnd).toLocaleDateString() : '-'}</td>
                                <td className="px-4 py-3 font-bold text-gray-200">{inv.totalAmount ? `${inv.totalAmount.toFixed(2)} €` : '-'}</td>
                                <td className="px-4 py-3 text-center">
                                  {inv.pdfUrl ? (
                                    <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 flex justify-center" onClick={e => e.stopPropagation()} title="Ver PDF">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                                    </a>
                                  ) : '-'}
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
          <div className="flex justify-end pt-4">
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
