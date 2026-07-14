'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, RefreshCw } from 'lucide-react';
import { getProvincesAction, getMunicipalitiesAction, getAdditionalServicesAction } from '@/app/actions/dictionaryActions';

interface ModificationModalProps {
  contractId: string;
  initialContract?: any;
  onClose: () => void;
  onSuccess: (newContractId: string) => void;
  submitAction: (contractId: string, modificationType: string, formData: any) => Promise<any>;
}

export default function ModificationModal({ contractId, initialContract, onClose, onSuccess, submitAction }: ModificationModalProps) {
  const [modType, setModType] = useState('SUBROGACION');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states for Subrogation
  const [tipoPersona, setTipoPersona] = useState('FISICA');
  const [cif, setCif] = useState('');
  const [nombreTitular, setNombreTitular] = useState('');
  const [apellido1, setApellido1] = useState('');
  const [apellido2, setApellido2] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreApoderado, setNombreApoderado] = useState('');
  const [apellidosApoderado, setApellidosApoderado] = useState('');
  const [nifApoderado, setNifApoderado] = useState('');

  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [iban, setIban] = useState('');
  const [tipoVia, setTipoVia] = useState('Calle');
  const [calle, setCalle] = useState('');
  const [tipoNum, setTipoNum] = useState('Número');
  const [numero, setNumero] = useState('');
  const [adicional, setAdicional] = useState('');
  const [cp, setCp] = useState('');
  const [poblacion, setPoblacion] = useState('');
  const [provincia, setProvincia] = useState('');
  const [facturaPapel, setFacturaPapel] = useState('NO');
  const [servicio, setServicio] = useState('-');

  const [dbProvinces, setDbProvinces] = useState<any[]>([]);
  const [dbMunicipalities, setDbMunicipalities] = useState<any[]>([]);
  const [dbServices, setDbServices] = useState<any[]>([]);

  useEffect(() => {
    getProvincesAction().then(res => { if (res.success) setDbProvinces(res.data); });
    getAdditionalServicesAction().then(res => { if (res.success) setDbServices(res.data); });
  }, []);

  useEffect(() => {
    if (provincia) {
      const selectedProv = dbProvinces.find(p => p.name === provincia);
      if (selectedProv) {
        getMunicipalitiesAction(selectedProv.id).then(res => { if (res.success) setDbMunicipalities(res.data); });
      } else {
        setDbMunicipalities([]);
      }
    } else {
      setDbMunicipalities([]);
    }
  }, [provincia, dbProvinces]);

  // Form states for Technical Mod
  const initialTarifa = initialContract?.contractData?.tarifa || initialContract?.airtableData?.tarifa || initialContract?.supplyPoint?.tariff || '2.0TD';
  const [tarifa, setTarifa] = useState(initialTarifa);
  const [p1c, setP1c] = useState(initialContract?.p1c ? String(initialContract.p1c) : '');
  const [p2c, setP2c] = useState(initialContract?.p2c ? String(initialContract.p2c) : '');
  const [p3c, setP3c] = useState(initialContract?.p3c ? String(initialContract.p3c) : '');
  const [p4c, setP4c] = useState(initialContract?.p4c ? String(initialContract.p4c) : '');
  const [p5c, setP5c] = useState(initialContract?.p5c ? String(initialContract.p5c) : '');
  const [p6c, setP6c] = useState(initialContract?.p6c ? String(initialContract.p6c) : '');

  // Form states for Autoconsumo
  const [cau, setCau] = useState(initialContract?.supplyPoint?.cau || '');
  const [selfConsumptionType, setSelfConsumptionType] = useState(initialContract?.supplyPoint?.selfConsumptionType || '');
  const [cauSubtype, setCauSubtype] = useState(initialContract?.supplyPoint?.cauSubtype || '');
  const [cauCollective, setCauCollective] = useState(initialContract?.supplyPoint?.cauCollective || '');
  const [cil, setCil] = useState(initialContract?.supplyPoint?.cil || '');
  const [generatorTechnology, setGeneratorTechnology] = useState(initialContract?.supplyPoint?.generatorTechnology || '');
  const [installedPowerGen, setInstalledPowerGen] = useState(initialContract?.supplyPoint?.installedPowerGen ? String(initialContract.supplyPoint.installedPowerGen) : '');
  const [installationType, setInstallationType] = useState(initialContract?.supplyPoint?.installationType || '');
  const [tipoCups, setTipoCups] = useState(initialContract?.supplyPoint?.tipoCups || '01');
  const [meteringScheme, setMeteringScheme] = useState(initialContract?.supplyPoint?.meteringScheme || 'A');

  const [surplusMode, setSurplusMode] = useState(initialContract?.pexc > 0 ? 'FIJO' : 'INDEXADO');
  const [pexc, setPexc] = useState(initialContract?.pexc ? String(initialContract.pexc) : '');
  const [feeExcedentes, setFeeExcedentes] = useState(initialContract?.feeExcedentes ? String(initialContract.feeExcedentes) : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = {
        tipoPersona, cif, 
        nombreTitular, apellido1, apellido2, 
        razonSocial, nombreApoderado, apellidosApoderado, nifApoderado,
        telefono, email, iban,
        tipoVia, calle, tipoNum, numero, adicional, cp, poblacion, provincia,
        facturaPapel, servicio,
        tarifa, p1c, p2c, p3c, p4c, p5c, p6c,
        cau, selfConsumptionType, cauSubtype, cauCollective, cil, generatorTechnology, installedPowerGen, installationType, meteringScheme,
        surplusMode, pexc, feeExcedentes
      };
      
      const res = await submitAction(contractId, modType, formData);
      if (res.error) {
        setError(res.error);
        if (res.validationErrors) {
          setError(res.error + " - " + res.validationErrors.join(', '));
        }
      } else if (res.newContractId) {
        onSuccess(res.newContractId);
      } else {
        setError("Error desconocido, no se recibió el ID del nuevo contrato.");
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar la modificación");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-[var(--border)]">
          <h2 className="text-xl font-bold">Solicitar Modificación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 no-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg whitespace-pre-wrap">
              {error}
            </div>
          )}

          {/* TYPE SELECTOR */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setModType('SUBROGACION')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium border transition-colors ${
                modType === 'SUBROGACION' 
                  ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' 
                  : 'border-[var(--border)] text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              Cambio Titularidad (Subrogación)
            </button>
            <button
              onClick={() => setModType('MODIFICACION_TECNICA')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium border transition-colors ${
                modType === 'MODIFICACION_TECNICA' 
                  ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' 
                  : 'border-[var(--border)] text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              Modificación Técnica
            </button>
            <button
              onClick={() => setModType('ACTIVAR_AUTOCONSUMO')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium border transition-colors ${
                modType === 'ACTIVAR_AUTOCONSUMO' 
                  ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' 
                  : 'border-[var(--border)] text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              Activar Autoconsumo
            </button>
          </div>

          <form id="modForm" onSubmit={handleSubmit} className="space-y-6">
            
            {modType === 'SUBROGACION' && (
              <div className="space-y-6">
                
                {/* DATOS DEL CONTACTO / TITULAR */}
                <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-5 space-y-4">
                  <h3 className="text-sm font-bold text-gray-200 tracking-wider">DATOS DEL CONTACTO / TITULAR</h3>
                  
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setTipoPersona('FISICA')} className={`flex-1 py-3 px-4 rounded-lg font-medium border transition-colors ${tipoPersona === 'FISICA' ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' : 'border-[var(--border)] text-gray-400 hover:border-gray-500'}`}>Persona Física</button>
                    <button type="button" onClick={() => setTipoPersona('JURIDICA')} className={`flex-1 py-3 px-4 rounded-lg font-medium border transition-colors ${tipoPersona === 'JURIDICA' ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' : 'border-[var(--border)] text-gray-400 hover:border-gray-500'}`}>Persona Jurídica</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {tipoPersona === 'FISICA' ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Nombre *</label>
                          <input required type="text" value={nombreTitular} onChange={(e) => setNombreTitular(e.target.value)} className="form-input w-full" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">NIF / CIF *</label>
                          <input required type="text" value={cif} onChange={(e) => setCif(e.target.value)} className="form-input w-full" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Primer Apellido</label>
                          <input type="text" value={apellido1} onChange={(e) => setApellido1(e.target.value)} className="form-input w-full" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Segundo Apellido</label>
                          <input type="text" value={apellido2} onChange={(e) => setApellido2(e.target.value)} className="form-input w-full" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Razón Social *</label>
                          <input required type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className="form-input w-full" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">NIF / CIF *</label>
                          <input required type="text" value={cif} onChange={(e) => setCif(e.target.value)} className="form-input w-full" />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Email *</label>
                      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Teléfono *</label>
                      <input required type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="form-input w-full" />
                    </div>
                  </div>
                </div>

                {/* DIRECCIÓN TITULAR */}
                <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-5 space-y-4">
                  <h3 className="text-sm font-bold text-gray-200 tracking-wider">DIRECCIÓN TITULAR</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Tipo de vía Titular *</label>
                    <select required value={tipoVia} onChange={(e) => setTipoVia(e.target.value)} className="form-input w-full">
                      <option value="Calle">Calle</option>
                      <option value="Avenida">Avenida</option>
                      <option value="Plaza">Plaza</option>
                      <option value="Paseo">Paseo</option>
                      <option value="Camino">Camino</option>
                      <option value="Carretera">Carretera</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Calle Titular *</label>
                    <input required type="text" value={calle} onChange={(e) => setCalle(e.target.value)} className="form-input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Tipo de numeración *</label>
                    <select required value={tipoNum} onChange={(e) => setTipoNum(e.target.value)} className="form-input w-full">
                      <option value="Número">Número</option>
                      <option value="S/N">S/N</option>
                      <option value="Km">Km</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Número Titular</label>
                    <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} className="form-input w-full" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Adicional Titular (Piso, Puerta...)</label>
                    <input type="text" value={adicional} onChange={(e) => setAdicional(e.target.value)} className="form-input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Código Postal Titular *</label>
                    <input required type="text" value={cp} onChange={(e) => setCp(e.target.value)} className="form-input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Población Titular *</label>
                    <select required value={poblacion} onChange={(e) => setPoblacion(e.target.value)} className="form-input w-full">
                      <option value="">Seleccione población</option>
                      {dbMunicipalities.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Provincia Titular *</label>
                    <select required value={provincia} onChange={(e) => { setProvincia(e.target.value); setPoblacion(''); }} className="form-input w-full">
                      <option value="">Seleccione provincia</option>
                      {dbProvinces.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">País Titular</label>
                    <input type="text" value="España" disabled className="form-input w-full opacity-75" />
                  </div>
                </div>
              </div>

              {/* DATOS DEL APODERADO */}
              {tipoPersona === 'JURIDICA' && (
                <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-5 space-y-4">
                  <h3 className="text-sm font-bold text-gray-200 tracking-wider">DATOS DEL APODERADO</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Nombre Apoderado</label>
                      <input type="text" value={nombreApoderado} onChange={(e) => setNombreApoderado(e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Apellidos Apoderado</label>
                      <input type="text" value={apellidosApoderado} onChange={(e) => setApellidosApoderado(e.target.value)} className="form-input w-full" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-400 mb-1">NIF Apoderado</label>
                      <input type="text" value={nifApoderado} onChange={(e) => setNifApoderado(e.target.value)} className="form-input w-full" />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-200 tracking-wider">DATOS DE FACTURACIÓN E IBAN</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">¿Facturas papel? *</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFacturaPapel('NO')} className={`flex-1 py-2 border rounded-lg transition-colors ${facturaPapel === 'NO' ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' : 'border-[var(--border)] text-gray-400 hover:border-gray-500'}`}>NO</button>
                      <button type="button" onClick={() => setFacturaPapel('SI')} className={`flex-1 py-2 border rounded-lg transition-colors ${facturaPapel === 'SI' ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' : 'border-[var(--border)] text-gray-400 hover:border-gray-500'}`}>SI</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Servicio *</label>
                    <select required value={servicio} onChange={(e) => setServicio(e.target.value)} className="form-input w-full">
                      <option value="-">-</option>
                      {dbServices.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">IBAN *</label>
                    <input required type="text" value={iban} onChange={(e) => setIban(e.target.value.replace(/\s+/g, '').toUpperCase())} pattern="^ES\d{22}$" title="El IBAN debe empezar por ES seguido de 22 números" className="form-input w-full" placeholder="ESXX..." />
                  </div>
                </div>
              </div>
              </div>
            )}

            {modType === 'MODIFICACION_TECNICA' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-200">Nuevos Datos Técnicos</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Tarifa *</label>
                  <div className="flex flex-wrap gap-2">
                    {['2.0TD', '3.0TD', '3.0TDVE', '6.1TD'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTarifa(t)}
                        className={`py-2 px-4 rounded-lg font-medium border transition-colors ${
                          tarifa === t ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' : 'border-[var(--border)] text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">P1C *</label>
                    <input required type="number" step="any" value={p1c} onChange={(e) => setP1c(e.target.value)} className="form-input w-full" placeholder="kW" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">P2C *</label>
                    <input required type="number" step="any" value={p2c} onChange={(e) => setP2c(e.target.value)} className="form-input w-full" placeholder="kW" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${tarifa === '2.0TD' ? 'text-gray-600' : 'text-gray-400'}`}>P3C {tarifa !== '2.0TD' && '*'}</label>
                    <input required={tarifa !== '2.0TD'} disabled={tarifa === '2.0TD'} type="number" step="any" value={p3c} onChange={(e) => setP3c(e.target.value)} className={`form-input w-full ${tarifa === '2.0TD' ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="kW" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${tarifa === '2.0TD' ? 'text-gray-600' : 'text-gray-400'}`}>P4C {tarifa !== '2.0TD' && '*'}</label>
                    <input required={tarifa !== '2.0TD'} disabled={tarifa === '2.0TD'} type="number" step="any" value={p4c} onChange={(e) => setP4c(e.target.value)} className={`form-input w-full ${tarifa === '2.0TD' ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="kW" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${tarifa === '2.0TD' ? 'text-gray-600' : 'text-gray-400'}`}>P5C {tarifa !== '2.0TD' && '*'}</label>
                    <input required={tarifa !== '2.0TD'} disabled={tarifa === '2.0TD'} type="number" step="any" value={p5c} onChange={(e) => setP5c(e.target.value)} className={`form-input w-full ${tarifa === '2.0TD' ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="kW" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${tarifa === '2.0TD' ? 'text-gray-600' : 'text-gray-400'}`}>P6C {tarifa !== '2.0TD' && '*'}</label>
                    <input required={tarifa !== '2.0TD'} disabled={tarifa === '2.0TD'} type="number" step="any" value={p6c} onChange={(e) => setP6c(e.target.value)} className={`form-input w-full ${tarifa === '2.0TD' ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="kW" />
                  </div>
                </div>
              </div>
            )}
            
            {modType === 'ACTIVAR_AUTOCONSUMO' && (
              <div className="space-y-6">
                <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-5 space-y-4">
                  <h3 className="text-sm font-bold text-gray-200 tracking-wider">DATOS TÉCNICOS (AUTOCONSUMO)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">CAU *</label>
                      <input required type="text" value={cau} onChange={(e) => setCau(e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">CIL</label>
                      <input type="text" value={cil} onChange={(e) => setCil(e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Tipo Autoconsumo *</label>
                      <input required type="text" value={selfConsumptionType} onChange={(e) => setSelfConsumptionType(e.target.value)} className="form-input w-full" placeholder="Ej. Con excedentes acogido a compensación..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Subsección *</label>
                      <input required type="text" value={cauSubtype} onChange={(e) => setCauSubtype(e.target.value)} className="form-input w-full" placeholder="Ej. Individual, Colectivo..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Colectivo</label>
                      <input type="text" value={cauCollective} onChange={(e) => setCauCollective(e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Tipo Instalación</label>
                      <input type="text" value={installationType} onChange={(e) => setInstallationType(e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Esquema Medida</label>
                      <input type="text" value={meteringScheme} onChange={(e) => setMeteringScheme(e.target.value)} className="form-input w-full" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Tecnología Generación *</label>
                      <input required type="text" value={generatorTechnology} onChange={(e) => setGeneratorTechnology(e.target.value)} className="form-input w-full" placeholder="Ej. Fotovoltaica" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Potencia Instalada (kW) *</label>
                      <input required type="number" step="any" value={installedPowerGen} onChange={(e) => setInstalledPowerGen(e.target.value)} className="form-input w-full" />
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-5 space-y-4">
                  <h3 className="text-sm font-bold text-gray-200 tracking-wider">COMPENSACIÓN ECONÓMICA (EXCEDENTES)</h3>
                  
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setSurplusMode('FIJO')} className={`flex-1 py-3 px-4 rounded-lg font-medium border transition-colors ${surplusMode === 'FIJO' ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' : 'border-[var(--border)] text-gray-400 hover:border-gray-500'}`}>Precio Fijo</button>
                    <button type="button" onClick={() => setSurplusMode('INDEXADO')} className={`flex-1 py-3 px-4 rounded-lg font-medium border transition-colors ${surplusMode === 'INDEXADO' ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(205,255,100,0.05)]' : 'border-[var(--border)] text-gray-400 hover:border-gray-500'}`}>Indexado</button>
                  </div>

                  {surplusMode === 'FIJO' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Precio Excedentes (€/MWh) *</label>
                      <input required type="number" step="any" value={pexc} onChange={(e) => setPexc(e.target.value)} className="form-input w-full max-w-xs" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Fee de Gestión Excedentes (€/MWh) *</label>
                      <input required type="number" step="any" value={feeExcedentes} onChange={(e) => setFeeExcedentes(e.target.value)} className="form-input w-full max-w-xs" />
                    </div>
                  )}
                </div>
              </div>
            )}
            
          </form>
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-[var(--border)] bg-[rgba(255,255,255,0.02)] flex justify-end gap-3 rounded-b-xl shrink-0">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg font-medium border border-[var(--border)] text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="modForm"
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg font-medium bg-[var(--lime)] text-black hover:bg-[var(--lime-hover)] transition-colors flex items-center gap-2"
          >
            {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            {isSubmitting ? 'Guardando...' : 'Guardar y Generar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
