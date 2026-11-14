'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  createLeadAction,
  estimateLeadCommissionAction,
  updateLeadAction,
} from '@/app/actions/leadActions';
import {
  formatIbanPretty,
  validateIban,
  validateSpanishCups,
  validateSpanishTaxId,
} from '@/lib/spanishValidators';
import {
  X,
  Loader2,
  Search,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  UploadCloud,
  FileText,
  Zap,
  Copy,
  Sparkles,
  UserCheck,
  TrendingUp,
  Calculator,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'opportunity' | 'contract';
  leadToEdit?: any;
  initialCups?: string | null;
  onSaved?: (res: { leadId: string; contractId?: string }) => void;
}

const PROVINCIAS = [
  'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Barcelona',
  'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ceuta', 'Ciudad Real', 'Córdoba',
  'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Islas Baleares',
  'Jaén', 'La Coruña', 'La Rioja', 'Las Palmas', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga',
  'Melilla', 'Murcia', 'Navarra', 'Ourense', 'Palencia', 'Pontevedra', 'Salamanca',
  'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo',
  'Valencia', 'Valladolid', 'Vizcaya', 'Zamora', 'Zaragoza',
];

const CP_PREFIX_TO_PROVINCIA: Record<string, string> = {
  '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila',
  '06': 'Badajoz', '07': 'Islas Baleares', '08': 'Barcelona', '09': 'Burgos', '10': 'Cáceres',
  '11': 'Cádiz', '12': 'Castellón', '13': 'Ciudad Real', '14': 'Córdoba', '15': 'La Coruña',
  '16': 'Cuenca', '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Guipúzcoa',
  '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León', '25': 'Lleida',
  '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid', '29': 'Málaga', '30': 'Murcia',
  '31': 'Navarra', '32': 'Ourense', '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas',
  '36': 'Pontevedra', '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria',
  '40': 'Segovia', '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona', '44': 'Teruel',
  '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid', '48': 'Vizcaya', '49': 'Zamora',
  '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla',
};

const TIPOS_VIA = [
  'Calle', 'Avenida', 'Plaza', 'Paseo', 'Camino', 'Carretera',
  'Ronda', 'Pasaje', 'Polígono', 'Urbanización', 'Lugar', 'Diseminado',
];

const TARIFAS = ['2.0TD', '3.0TD', '3.0TDVE', '6.1TD', '6.1TDVE', '6.2TD', '6.3TD', '6.4TD'];

const TRAMITACIONES = [
  'Cambio comercializadora sin cambios',
  'Cambio comercializadora con cambios administrativos',
  'Cambio comercializadora con cambios técnicos',
  'Cambio comercializadora con cambios técnicos y administrativos',
  'Alta nueva',
  'Modificación de datos administrativos',
  'Modificación de datos técnicos',
  'Modificación de datos administrativos y técnicos',
];

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function resolveProvincia(rawProv?: string | null, cp?: string | null): string {
  const cpStr = String(cp || '').trim().padStart(5, '0');
  if (/^\d{5}$/.test(cpStr) && CP_PREFIX_TO_PROVINCIA[cpStr.slice(0, 2)]) {
    return CP_PREFIX_TO_PROVINCIA[cpStr.slice(0, 2)];
  }
  const clean = stripAccents(String(rawProv || ''));
  if (!clean) return '';
  if (/^\d{1,2}$/.test(clean)) {
    const padded = clean.padStart(2, '0');
    if (CP_PREFIX_TO_PROVINCIA[padded]) return CP_PREFIX_TO_PROVINCIA[padded];
  }
  const aliases: Record<string, string> = {
    araba: 'Álava',
    bizkaia: 'Vizcaya',
    gipuzkoa: 'Guipúzcoa',
    'a coruna': 'La Coruña',
    coruna: 'La Coruña',
    ourense: 'Ourense',
    orense: 'Ourense',
    gerona: 'Girona',
    lerida: 'Lleida',
    'illes balears': 'Islas Baleares',
    baleares: 'Islas Baleares',
  };
  if (aliases[clean]) return aliases[clean];
  const exact = PROVINCIAS.find((p) => stripAccents(p) === clean);
  if (exact) return exact;
  const partial = PROVINCIAS.find((p) => clean.includes(stripAccents(p)) || stripAccents(p).includes(clean));
  return partial || '';
}

function normalizePostalCode5(val: any): string {
  const raw = String(val ?? '').trim();
  if (!raw) return '';
  if (/^\d{1,5}$/.test(raw)) return raw.padStart(5, '0');
  return raw;
}

function formatEur(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function createInitialFormState(mode: 'opportunity' | 'contract', canAutoContract: boolean) {
  return {
    tipoPersona: 'FISICA',
    businessName: '',
    primerApellido: '',
    segundoApellido: '',
    vatNumber: '',
    email: '',
    phone: '',
    cnae: '',
    tipoVia: 'Calle',
    nombreVia: '',
    tipoNumeracion: 'NÚMERO',
    numKm: '',
    adicional: '',
    cp: '',
    poblacion: '',
    provincia: '',
    pais: 'España',

    // Apoderado (B2B)
    contactoNombre: '',
    contactoApellidos: '',
    contactoNif: '',

    // Suministro
    cups: '',
    tarifa: '2.0TD',
    estimatedMWh: '',
    nombreInstalacion: '',
    sTipoVia: 'Calle',
    sNombreVia: '',
    sTipoNumeracion: 'NÚMERO',
    sNumero: '',
    sAdicional: '',
    sCp: '',
    sPoblacion: '',
    sProvincia: '',
    sPais: 'España',

    // Contrato
    tipoTramitacion: 'Cambio comercializadora sin cambios',
    autoconsumo: 'NO',
    firmaManuscrita: false,

    // Producto
    bolsilloSolar: 'NO',
    tipoProducto: 'Precio fijo único',
    product: '',
    formaPago: 'Domiciliación',
    iban: '',
    envioFactura: 'Email',
    serviciosAdicionales: '',
    additionalServiceIds: [] as string[],

    // Potencias
    p1c: '', p2c: '', p3c: '', p4c: '', p5c: '', p6c: '',

    // Indexado personalizado
    ip1: '', ip2: '', ip3: '', ip4: '', ip5: '', ip6: '',
    feeIndex: '',

    // Autoconsumo personalizado
    pexc: '',

    // Oferta / Comparativa
    generateOffer: mode === 'opportunity',
    monthlyExpense: '',
    p1eActual: '', p2eActual: '', p3eActual: '', p4eActual: '', p5eActual: '', p6eActual: '',
    p1pDaily: '', p2pDaily: '', p3pDaily: '', p4pDaily: '', p5pDaily: '', p6pDaily: '',
    priceServiceActual: '',
    comparative: '',
    savings: '',
    comments: '',

    // Documentos (urls)
    docs: {
      dniTitular: null as string | null,
      ultimaFactura: null as string | null,
      certificadoIban: null as string | null,
      cieConsumo: null as string | null,
      cieAutoconsumo: null as string | null,
      escrituras: null as string | null,
      dniApoderado: null as string | null,
    },

    verificacionAed: false,
    autoGenerateContract: mode === 'contract' && canAutoContract,
  };
}

type FormState = ReturnType<typeof createInitialFormState>;

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  width = 'full',
  placeholder,
  step,
  hint,
  hintTone = 'neutral',
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  required?: boolean;
  width?: string;
  placeholder?: string;
  step?: string;
  hint?: string;
  hintTone?: 'neutral' | 'ok' | 'warn' | 'error';
}) {
  const spanClass =
    width === 'half'
      ? 'col-span-1'
      : width === 'third'
        ? 'col-span-1 md:col-span-1'
        : width === 'col-span-1'
          ? 'col-span-1'
          : 'col-span-2';
  const hintColor =
    hintTone === 'ok'
      ? 'text-emerald-400'
      : hintTone === 'warn'
        ? 'text-amber-400'
        : hintTone === 'error'
          ? 'text-red-400'
          : 'text-gray-500';
  const borderTone =
    hintTone === 'error'
      ? 'border-red-500/60 focus:border-red-400 focus:ring-red-400'
      : hintTone === 'ok'
        ? 'border-emerald-500/40 focus:border-[#DEFF9A] focus:ring-[#DEFF9A]'
        : 'border-[#1E2A3A] focus:border-[#DEFF9A] focus:ring-[#DEFF9A]';
  return (
    <div className={`space-y-1.5 ${spanClass}`}>
      <label className="text-xs font-medium text-gray-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-[#0B0F19] border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 outline-none transition-all ${borderTone}`}
      />
      {hint && <p className={`text-[11px] font-medium ${hintColor}`}>{hint}</p>}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  width = 'full',
  required = false,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  width?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const spanClass =
    width === 'half'
      ? 'col-span-1'
      : width === 'third'
        ? 'col-span-1 md:col-span-1'
        : 'col-span-2';
  return (
    <div className={`space-y-1.5 ${spanClass}`}>
      <label className="text-xs font-medium text-gray-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0B0F19] border border-[#1E2A3A] rounded-lg px-3 py-2 text-sm text-white focus:border-[#DEFF9A] focus:ring-1 focus:ring-[#DEFF9A] outline-none transition-all disabled:opacity-50"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function FileUpload({
  label,
  onUpload,
  value,
  isReused = false,
}: {
  label: string;
  onUpload: (url: string) => void;
  value: string | null;
  isReused?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'leads');

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success) {
        onUpload(json.url);
      } else {
        alert(json.error || 'Error subiendo archivo');
      }
    } catch {
      alert('Error en la conexión al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`border border-dashed bg-[#0B0F19] rounded-lg p-4 flex flex-col items-center justify-center relative hover:border-[#DEFF9A] transition-colors group cursor-pointer overflow-hidden ${
        value ? (isReused ? 'border-emerald-500/40' : 'border-[#DEFF9A]/40') : 'border-[#1E2A3A]'
      }`}
    >
      <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
      {uploading ? (
        <Loader2 className="w-6 h-6 text-[#DEFF9A] animate-spin" />
      ) : value ? (
        <div className={`flex flex-col items-center ${isReused ? 'text-emerald-400' : 'text-[#DEFF9A]'}`}>
          <FileText className="w-6 h-6 mb-1.5" />
          <span className="text-xs font-semibold text-center truncate w-full px-2">
            {label} {isReused ? '' : 'subido'}
          </span>
          {isReused && (
            <span className="text-[10px] mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              ✓ Reutilizado de cartera
            </span>
          )}
          <span className="text-[10px] mt-1 text-gray-400">Click para sustituir</span>
        </div>
      ) : (
        <div className="flex flex-col items-center text-gray-500 group-hover:text-gray-300">
          <UploadCloud className="w-6 h-6 mb-2" />
          <span className="text-xs text-center font-medium">{label}</span>
          <span className="text-[10px] mt-1 text-gray-600">Click o arrastrar</span>
        </div>
      )}
    </div>
  );
}

export default function NewLeadModal({
  isOpen,
  onClose,
  mode,
  leadToEdit,
  initialCups,
  onSaved,
}: NewLeadModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = ((session?.user as any)?.role as string) || 'USER';
  const canAutoContract = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [sipsLoading, setSipsLoading] = useState(false);
  const [sipsData, setSipsData] = useState<any>(null);
  const lastAutoSipsCupsRef = useRef<string>('');

  const [data, setData] = useState<FormState>(() => createInitialFormState(mode, canAutoContract));
  const [productsDb, setProductsDb] = useState<any[]>([]);
  const [additionalServicesDb, setAdditionalServicesDb] = useState<any[]>([]);

  // #2: Cliente existente en cartera (sin IBAN ni Factura)
  const [clientMatch, setClientMatch] = useState<{
    name: string;
    nif: string;
    profile: any;
    reusableDocs: { dniTitular: string | null; escrituras: string | null; dniApoderado: string | null };
  } | null>(null);
  const [clientMatchApplied, setClientMatchApplied] = useState(false);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [reusedDocFields, setReusedDocFields] = useState<Record<string, boolean>>({});

  // #4: Vista previa de comisión en vivo (calculada en servidor)
  const [commissionPreview, setCommissionPreview] = useState<{
    loading: boolean;
    available: boolean;
    commissionTotal: number;
    commissionEnergy: number;
    commissionServices: number;
    channelName?: string;
  }>({
    loading: false,
    available: false,
    commissionTotal: 0,
    commissionEnergy: 0,
    commissionServices: 0,
  });

  // #6: Borrador localStorage
  const draftKey = `sp_erp_lead_draft_${mode}`;
  const [pendingDraft, setPendingDraft] = useState<{
    data: FormState;
    sipsData: any;
    step: number;
    savedAt: number;
    label: string;
  } | null>(null);
  const userTouchedFormRef = useRef(false);

  // #7: Multi-CUPS mismo titular
  const [multiCupsCount, setMultiCupsCount] = useState(0);
  const [multiCupsBanner, setMultiCupsBanner] = useState('');

  const applySipsPayloadToState = useCallback((sData: any, fallbackCups: string) => {
    const psData = sData?.data?.ps?.[0] || {};
    const resolvedCups = String(psData.CUPS || fallbackCups).trim().toUpperCase();
    lastAutoSipsCupsRef.current = resolvedCups;
    if (resolvedCups.length >= 20) {
      lastAutoSipsCupsRef.current = resolvedCups;
    }
    setSipsData(sData);

    const detectedTariff = String(sData.tarifa || psData.TarifaATR || '2.0TD').trim();
    const detectedCp = normalizePostalCode5(sData.cp || psData.CódigoPostalPS || '');
    const detectedCity = String(sData.poblacion || sData.municipio || psData.MunicipioPS || '').trim();
    const detectedProv = resolveProvincia(sData.provincia || psData.ProvinciaPS, detectedCp);
    const detectedCnae = String(sData.cnae || psData.CNAE || '').trim();
    const consumoKwh = Number(sData.consumo || psData.ConsumoAnualkWh || 0);
    const rawAuto = String(sData.autoconsumo ?? psData.Autoconsumo ?? psData.codigoAutoconsumo ?? '').trim().toUpperCase();
    const hasAutoSips = Boolean(rawAuto && !['0', '00', 'NO', 'N', 'FALSE', 'SIN AUTOCONSUMO'].includes(rawAuto));

    const pVal = (idx: number) => {
      const v = sData[`p${idx}`] ?? psData[`PotenciaContratadaP${idx}kW`];
      if (v === undefined || v === null || v === '') return '';
      const n = Number(String(v).replace(',', '.'));
      return Number.isNaN(n) ? '' : String(n);
    };

    const is20 = detectedTariff === '2.0TD';

    setData((prev) => ({
      ...prev,
      cups: resolvedCups || prev.cups,
      tarifa: TARIFAS.includes(detectedTariff) ? detectedTariff : prev.tarifa,
      ...(detectedCp ? { sCp: detectedCp } : {}),
      ...(detectedCity ? { sPoblacion: detectedCity } : {}),
      ...(detectedProv ? { sProvincia: detectedProv } : {}),
      ...(detectedCnae ? { cnae: detectedCnae } : {}),
      ...(consumoKwh > 0 ? { estimatedMWh: String(Number((consumoKwh / 1000).toFixed(4))) } : {}),
      autoconsumo: hasAutoSips ? 'SI' : prev.autoconsumo,
      p1c: pVal(1) || prev.p1c,
      p2c: pVal(2) || prev.p2c,
      p3c: is20 ? '' : pVal(3) || prev.p3c,
      p4c: is20 ? '' : pVal(4) || prev.p4c,
      p5c: is20 ? '' : pVal(5) || prev.p5c,
      p6c: is20 ? '' : pVal(6) || prev.p6c,
    }));
  }, []);

  const runSipsLookup = useCallback(
    async (targetCups: string, options?: { silent?: boolean }) => {
      const cleanCups = targetCups.trim().toUpperCase().replace(/\s+/g, '');
      if (cleanCups.length < 20) {
        if (!options?.silent) {
          setError('El CUPS debe tener al menos 20 caracteres (ej. ES0031...)');
        }
        return;
      }
      lastAutoSipsCupsRef.current = cleanCups;
      setSipsLoading(true);
      if (!options?.silent) setError('');
      try {
        const res = await fetch(`/api/sips?cups=${encodeURIComponent(cleanCups)}`);
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || 'No se encontraron datos en SIPS para este CUPS');
        }
        applySipsPayloadToState(json.data || {}, cleanCups);
      } catch (err: any) {
        if (!options?.silent) {
          setError(err.message || 'Error consultando nuestro servidor SIPS');
        }
      } finally {
        setSipsLoading(false);
      }
    },
    [applySipsPayloadToState]
  );

  // Inicialización del modal al abrir
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/products')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setProductsDb(res.data || []);
      })
      .catch((err) => console.error('Error fetching products:', err));

    fetch(`/api/additional-services?t=${Date.now()}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setAdditionalServicesDb(res.data || []);
      })
      .catch((err) => console.error('Error fetching additional services:', err));

    setStep(1);
    setError('');
    setClientMatch(null);
    setClientMatchApplied(false);
    setReusedDocFields({});
    setMultiCupsCount(0);
    setMultiCupsBanner('');
    setPendingDraft(null);
    userTouchedFormRef.current = false;
    lastAutoSipsCupsRef.current = '';

    const freshState = createInitialFormState(mode, canAutoContract && !leadToEdit?.contractId);

    if (!leadToEdit) {
      setSipsData(null);

      // Si viene desde Consulta CUPS con un CUPS preseleccionado (#3)
      const cleanInitCups = String(initialCups || '').trim().toUpperCase().replace(/\s+/g, '');
      if (cleanInitCups && cleanInitCups.length >= 20) {
        userTouchedFormRef.current = true;
        setData({ ...freshState, cups: cleanInitCups });

        let loadedFromSession = false;
        try {
          const cached =
            sessionStorage.getItem(`sp_erp_sips_prefill_${cleanInitCups}`) ||
            sessionStorage.getItem(`sp_erp_sips_prefill_${cleanInitCups.slice(0, 20)}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.result !== 'ERROR') {
              applySipsPayloadToState(parsed, cleanInitCups);
              loadedFromSession = true;
            }
          }
        } catch {}

        if (!loadedFromSession) {
          runSipsLookup(cleanInitCups, { silent: true });
        }
        return;
      }

      setData(freshState);

      // Comprobar borrador guardado en localStorage (#6)
      try {
        const rawDraft = localStorage.getItem(draftKey);
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft);
          const ageMs = Date.now() - Number(parsed?.savedAt || 0);
          const d = parsed?.data;
          if (d && ageMs < 7 * 24 * 60 * 60 * 1000 && (d.businessName || d.vatNumber || d.cups)) {
            const labelParts = [
              [d.businessName, d.primerApellido].filter(Boolean).join(' ').trim(),
              d.vatNumber,
              d.cups,
            ].filter(Boolean);
            setPendingDraft({
              data: { ...freshState, ...d, docs: { ...freshState.docs, ...(d.docs || {}) } },
              sipsData: parsed.sipsData || null,
              step: Number(parsed.step) >= 1 ? Number(parsed.step) : 1,
              savedAt: Number(parsed.savedAt),
              label: labelParts.slice(0, 2).join(' · ') || 'Solicitud en curso',
            });
          }
        }
      } catch {}

      return;
    }

    const cd = (leadToEdit.contractData as any) || {};
    const ad = (leadToEdit.airtableData as any) || {};
    const getScalar = (val: any) => (Array.isArray(val) ? val[0] : val);

    const hydratedCups = String(leadToEdit.cups || cd.cups || getScalar(ad['CUPS']) || getScalar(ad['CUPS2']) || '')
      .trim()
      .toUpperCase();
    if (hydratedCups) {
      lastAutoSipsCupsRef.current = hydratedCups;
    }

    if (leadToEdit.sipsRawData && typeof leadToEdit.sipsRawData === 'object' && leadToEdit.sipsRawData.result !== 'ERROR') {
      setSipsData(leadToEdit.sipsRawData);
    } else {
      setSipsData(null);
    }

    const vat = String(
      leadToEdit.vatNumber || cd.vatNumber || ad['CIF'] || ad['NIF'] || ad['Copia de CIF link'] || ad['NIF Contacto'] || ''
    ).trim().toUpperCase();
    const esJuridica = vat ? (!/^([0-9XYZ])/i.test(vat) && /^[A-W]/i.test(vat)) : cd.tipoPersona === 'JURIDICA';

    let rawBusinessName =
      cd.nombre || getScalar(ad['NOMBRE/RAZON SOCIAL']) || getScalar(ad['NOMBRERAZON SOCIAL']) || '';
    const pAp = leadToEdit.firstName || cd.primerApellido || ad['Primer Apellido'] || ad['Primer apellido Titular'] || '';
    const sAp = leadToEdit.lastName || cd.segundoApellido || ad['Segundo Apellido'] || ad['Segundo apellido Titular'] || '';

    if (!esJuridica && !rawBusinessName) {
      rawBusinessName =
        leadToEdit.businessName || cd.businessName || ad['NOMBRE Y APELLIDOS'] || ad['Nombre completo Titular'] || '';
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (pAp) rawBusinessName = rawBusinessName.replace(new RegExp(`\\b${escapeRegExp(pAp)}\\b`, 'i'), '');
      if (sAp) rawBusinessName = rawBusinessName.replace(new RegExp(`\\b${escapeRegExp(sAp)}\\b`, 'i'), '');
      rawBusinessName = rawBusinessName.replace('(Copia)', '').replace(/^,\s*|\s*,\s*$/g, '').trim();
    } else if (esJuridica && !rawBusinessName) {
      rawBusinessName =
        leadToEdit.businessName || cd.businessName || ad['NOMBRE Y APELLIDOS'] || ad['Nombre completo Titular'] || '';
    }

    const normNum = (val: any) => {
      const upper = String(val || '').toUpperCase().trim();
      if (upper.includes('KM')) return 'KM';
      if (upper.includes('S/N') || upper.includes('SN')) return 'S/N';
      return 'NÚMERO';
    };

    const rawDocs = Array.isArray(leadToEdit.documents) ? leadToEdit.documents : [];
    const hydratedDocs = { ...freshState.docs };
    for (const d of rawDocs) {
      if (!d?.url) continue;
      if (d.type === 'DNI') hydratedDocs.dniTitular = d.url;
      else if (d.type === 'FACTURA') hydratedDocs.ultimaFactura = d.url;
      else if (d.type === 'IBAN') hydratedDocs.certificadoIban = d.url;
      else if (d.type === 'ESCRITURAS') hydratedDocs.escrituras = d.url;
      else if (d.type === 'DNI_APODERADO') hydratedDocs.dniApoderado = d.url;
      else if (d.type === 'CIE') {
        if (String(d.name || '').toLowerCase().includes('auto')) hydratedDocs.cieAutoconsumo = d.url;
        else hydratedDocs.cieConsumo = d.url;
      }
    }

    const hasAuto =
      leadToEdit.hasPanels ||
      cd.autoconsumo === 'SI' ||
      cd.autoconsumo === 'Sí' ||
      cd.autoconsumo === true ||
      getScalar(ad['¿Autoconsumo?']) === true ||
      getScalar(ad['¿Autoconsumo?']) === 'true' ||
      getScalar(ad['¿Autoconsumo?']) === 'Sí' ||
      getScalar(ad['Autoconsumo']) === 'SI';

    const hasBolsillo =
      hasAuto &&
      (cd.bolsilloSolar === 'SI' ||
        cd.bolsilloSolar === 'Sí' ||
        cd.bolsilloSolar === true ||
        getScalar(ad['¿Asociar a Bolsillo Solar?']) === 'SI' ||
        Boolean(getScalar(ad['CG Bolsillo Solar'])));

    const rawCp = normalizePostalCode5(cd.direccion?.cp || cd.cp || getScalar(ad['CP SOC']) || '');
    const rawSCp = normalizePostalCode5(
      cd.direccionSuministro?.cp || cd.sCp || getScalar(ad['Código Postal Instalación']) || getScalar(ad['CP PS']) || ''
    );

    const rawProv = cd.direccion?.provincia || cd.provincia || getScalar(ad['Provincia Titular']) || getScalar(ad['PROVINCIA SOC']) || '';
    const rawSProv =
      cd.direccionSuministro?.provincia || cd.sProvincia || getScalar(ad['Provincia Instalación']) || getScalar(ad['PROVINCIA PS']) || '';

    const sipsConsumoKwh = Number(leadToEdit.sipsRawData?.consumo || leadToEdit.sipsRawData?.data?.ps?.[0]?.ConsumoAnualkWh || 0);
    const initialMWh =
      leadToEdit.estimatedMWh && Number(leadToEdit.estimatedMWh) > 0
        ? String(leadToEdit.estimatedMWh)
        : cd.estimatedMWh
          ? String(cd.estimatedMWh)
          : sipsConsumoKwh > 0
            ? String(Number((sipsConsumoKwh / 1000).toFixed(4)))
            : '';

    const rawIban = String(leadToEdit.iban || cd.iban || getScalar(ad['IBAN']) || '');

    setData({
      ...freshState,
      tipoPersona: cd.tipoPersona || (esJuridica ? 'JURIDICA' : 'FISICA'),
      businessName: rawBusinessName,
      primerApellido: pAp,
      segundoApellido: sAp,
      vatNumber: vat,
      email: leadToEdit.email || cd.email || getScalar(ad['EMAIL']) || getScalar(ad['Email Contacto']) || '',
      phone: leadToEdit.phone || cd.phone || getScalar(ad['TLF']) || getScalar(ad['Teléfono Contacto']) || '',
      cnae: leadToEdit.sipsCnae || cd.cnae || leadToEdit.sipsRawData?.cnae || getScalar(ad['CNAE']) || getScalar(ad['SIPS Cnae']) || '',

      tipoVia: cd.direccion?.tipoVia || cd.tipoVia || getScalar(ad['Tipo de vía Titular']) || 'Calle',
      nombreVia: cd.direccion?.nombreVia || cd.nombreVia || getScalar(ad['Calle Titular']) || getScalar(ad['DOMICILIO SOC']) || '',
      tipoNumeracion: cd.direccion?.tipoNumeracion || cd.tipoNumeracion || normNum(getScalar(ad['Tipo de numeración Titular'])),
      numKm: cd.direccion?.numKm || cd.numKm || getScalar(ad['Número Titular']) || '',
      adicional: cd.direccion?.adicional || cd.adicional || getScalar(ad['Adicional Titular']) || '',
      cp: rawCp,
      poblacion: cd.direccion?.poblacion || cd.poblacion || getScalar(ad['Población Titular']) || getScalar(ad['POBLACION SOC']) || '',
      provincia: resolveProvincia(rawProv, rawCp) || rawProv,
      pais: cd.direccion?.pais || cd.pais || getScalar(ad['País Titular']) || 'España',

      sTipoVia: cd.direccionSuministro?.tipoVia || cd.sTipoVia || getScalar(ad['Tipo de vía Instalación']) || 'Calle',
      sNombreVia:
        cd.direccionSuministro?.nombreVia ||
        cd.sNombreVia ||
        getScalar(ad['Calle Instalación']) ||
        getScalar(ad['DOMICILIO PS']) ||
        getScalar(ad['DOMICILIO PS COMPLETO']) ||
        '',
      sTipoNumeracion: cd.direccionSuministro?.tipoNumeracion || cd.sTipoNumeracion || normNum(getScalar(ad['Tipo de numeración Instalación'])),
      sNumero: cd.direccionSuministro?.numKm || cd.sNumero || cd.sNumKm || getScalar(ad['Número Instalación']) || '',
      sAdicional: cd.direccionSuministro?.adicional || cd.sAdicional || getScalar(ad['Adicional Instalación']) || '',
      sCp: rawSCp,
      sPoblacion:
        cd.direccionSuministro?.poblacion ||
        cd.sPoblacion ||
        leadToEdit.sipsRawData?.poblacion ||
        getScalar(ad['Población Instalación']) ||
        getScalar(ad['POBLACION PS']) ||
        '',
      sProvincia: resolveProvincia(rawSProv || leadToEdit.sipsRawData?.provincia, rawSCp) || rawSProv,
      sPais: cd.direccionSuministro?.pais || cd.sPais || getScalar(ad['País Instalación']) || 'España',

      contactoNombre: leadToEdit.contactName || cd.contactoNombre || cd.representativeName || getScalar(ad['Nombre Contacto']) || '',
      contactoApellidos:
        leadToEdit.contactLastName || cd.contactoApellidos || cd.representativeLastName || getScalar(ad['Apellidos Contacto']) || '',
      contactoNif: leadToEdit.contactVat || cd.contactoNif || cd.representativeVat || getScalar(ad['NIF Contacto']) || '',

      cups: hydratedCups,
      tarifa: leadToEdit.tariff || cd.tarifa || leadToEdit.sipsRawData?.tarifa || getScalar(ad['Tarifa']) || '2.0TD',
      estimatedMWh: initialMWh,
      nombreInstalacion: cd.nombreInstalacion || '',
      tipoTramitacion:
        leadToEdit.tramitationType ||
        cd.tipoTramitacion ||
        cd.tramitationType ||
        getScalar(ad['Tramitación a realizar']) ||
        getScalar(ad['Tipo']) ||
        'Cambio comercializadora sin cambios',
      autoconsumo: hasAuto ? 'SI' : 'NO',
      firmaManuscrita: Boolean(cd.firmaManuscrita),

      bolsilloSolar: hasBolsillo ? 'SI' : 'NO',
      tipoProducto: leadToEdit.productType || cd.tipoProducto || getScalar(ad['Tipo de producto']) || 'Precio fijo único',
      product: leadToEdit.product || cd.product || getScalar(ad['Producto']) || getScalar(ad['Producto y Servicio']) || '',
      formaPago: leadToEdit.paymentMethod || cd.formaPago || 'Domiciliación',
      iban: rawIban ? formatIbanPretty(rawIban) : '',
      envioFactura:
        leadToEdit.invoiceDelivery ||
        cd.envioFactura ||
        (getScalar(ad['¿Facturas papel?']) === true || getScalar(ad['¿Facturas papel?']) === 'SI' || getScalar(ad['¿Facturas papel?']) === 'Sí'
          ? 'Postal'
          : 'Email'),
      serviciosAdicionales: leadToEdit.additionalServices || cd.serviciosAdicionales || '',
      additionalServiceIds: Array.isArray(cd.additionalServiceIds) ? cd.additionalServiceIds : [],

      p1c: String(cd.potencias?.p1 ?? cd.p1c ?? leadToEdit.p1c ?? leadToEdit.sipsRawData?.p1 ?? getScalar(ad['P1C']) ?? ''),
      p2c: String(cd.potencias?.p2 ?? cd.p2c ?? leadToEdit.p2c ?? leadToEdit.sipsRawData?.p2 ?? getScalar(ad['P2C']) ?? ''),
      p3c: String(cd.potencias?.p3 ?? cd.p3c ?? leadToEdit.p3c ?? leadToEdit.sipsRawData?.p3 ?? getScalar(ad['P3C']) ?? ''),
      p4c: String(cd.potencias?.p4 ?? cd.p4c ?? leadToEdit.p4c ?? leadToEdit.sipsRawData?.p4 ?? getScalar(ad['P4C']) ?? ''),
      p5c: String(cd.potencias?.p5 ?? cd.p5c ?? leadToEdit.p5c ?? leadToEdit.sipsRawData?.p5 ?? getScalar(ad['P5C']) ?? ''),
      p6c: String(cd.potencias?.p6 ?? cd.p6c ?? leadToEdit.p6c ?? leadToEdit.sipsRawData?.p6 ?? getScalar(ad['P6C']) ?? ''),

      ip1: String(cd.indexado?.ip1 ?? cd.ip1 ?? getScalar(ad['IP1']) ?? ''),
      ip2: String(cd.indexado?.ip2 ?? cd.ip2 ?? getScalar(ad['IP2']) ?? ''),
      ip3: String(cd.indexado?.ip3 ?? cd.ip3 ?? getScalar(ad['IP3']) ?? ''),
      ip4: String(cd.indexado?.ip4 ?? cd.ip4 ?? getScalar(ad['IP4']) ?? ''),
      ip5: String(cd.indexado?.ip5 ?? cd.ip5 ?? getScalar(ad['IP5']) ?? ''),
      ip6: String(cd.indexado?.ip6 ?? cd.ip6 ?? getScalar(ad['IP6']) ?? ''),
      feeIndex: String(cd.indexado?.fee ?? cd.feeIndex ?? getScalar(ad['FEE']) ?? ''),
      pexc: String(cd.pexc ?? getScalar(ad['PExc']) ?? getScalar(ad['PExc Personalizado']) ?? ''),

      generateOffer: mode === 'opportunity' ? true : Boolean(leadToEdit.generateOffer || cd.generateOffer),
      monthlyExpense: String(leadToEdit.monthlyExpense ?? cd.monthlyExpense ?? ''),
      savings: String(leadToEdit.savings ?? cd.savings ?? ''),
      comparative: String(leadToEdit.comparative ?? cd.comparative ?? ''),
      comments: String(cd.comments ?? ''),
      p1eActual: String(cd.p1eActual ?? ''),
      p2eActual: String(cd.p2eActual ?? ''),
      p3eActual: String(cd.p3eActual ?? ''),
      p4eActual: String(cd.p4eActual ?? ''),
      p5eActual: String(cd.p5eActual ?? ''),
      p6eActual: String(cd.p6eActual ?? ''),
      p1pDaily: String(cd.p1pDaily ?? ''),
      p2pDaily: String(cd.p2pDaily ?? ''),
      p3pDaily: String(cd.p3pDaily ?? ''),
      p4pDaily: String(cd.p4pDaily ?? ''),
      p5pDaily: String(cd.p5pDaily ?? ''),
      p6pDaily: String(cd.p6pDaily ?? ''),
      priceServiceActual: String(cd.priceServiceActual ?? ''),

      docs: hydratedDocs,
      verificacionAed: false,
      autoGenerateContract: mode === 'contract' && canAutoContract && !leadToEdit.contractId,
    });
  }, [isOpen, leadToEdit, mode, canAutoContract, initialCups, draftKey, applySipsPayloadToState, runSipsLookup]);

  // Validaciones matemáticas en vivo (#5)
  const vatCheck = useMemo(() => validateSpanishTaxId(data.vatNumber), [data.vatNumber]);
  const repVatCheck = useMemo(() => validateSpanishTaxId(data.contactoNif), [data.contactoNif]);
  const cupsCheck = useMemo(() => validateSpanishCups(data.cups), [data.cups]);
  const ibanCheck = useMemo(() => validateIban(data.iban), [data.iban]);

  // #2: Búsqueda reactiva de cliente existente por NIF/CIF (solo en nuevas solicitudes)
  useEffect(() => {
    if (!isOpen || leadToEdit) return;
    const cleanVat = data.vatNumber.trim().toUpperCase().replace(/[-\s.]/g, '');
    if (cleanVat.length < 8) {
      setClientMatch(null);
      setClientMatchApplied(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setClientSearchLoading(true);
      try {
        const res = await fetch(`/api/clients/search?nif=${encodeURIComponent(cleanVat)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json?.found && json.profile) {
          setClientMatch({
            name: json.client?.name || json.profile.businessName || cleanVat,
            nif: json.client?.nif || cleanVat,
            profile: json.profile,
            reusableDocs: json.reusableDocs || { dniTitular: null, escrituras: null, dniApoderado: null },
          });
        } else {
          setClientMatch(null);
        }
      } catch {
        if (!cancelled) setClientMatch(null);
      } finally {
        if (!cancelled) setClientSearchLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, leadToEdit, data.vatNumber]);

  // #5: Autodisparo de consulta SIPS en cuanto se pega o completa un CUPS matemáticamente válido
  useEffect(() => {
    if (!isOpen || sipsLoading) return;
    if (!cupsCheck.checksumOk) return;
    if (lastAutoSipsCupsRef.current === cupsCheck.clean) return;
    if (lastAutoSipsCupsRef.current.length >= 20 && cupsCheck.clean.slice(0, 20) === lastAutoSipsCupsRef.current.slice(0, 20)) {
      return;
    }

    const timer = setTimeout(() => {
      runSipsLookup(cupsCheck.clean, { silent: true });
    }, 400);

    return () => clearTimeout(timer);
  }, [isOpen, cupsCheck.checksumOk, cupsCheck.clean, sipsLoading, runSipsLookup]);

  // #6: Autoguardado ligero en localStorage mientras el agente trabaja
  useEffect(() => {
    if (!isOpen || leadToEdit || !userTouchedFormRef.current) return;
    const hasMeaningful = Boolean(data.businessName.trim() || data.vatNumber.trim() || data.cups.trim());
    if (!hasMeaningful) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            data,
            sipsData,
            step,
            savedAt: Date.now(),
          })
        );
      } catch {}
    }, 650);

    return () => clearTimeout(timer);
  }, [isOpen, leadToEdit, data, sipsData, step, draftKey]);

  // Asegurar coherencia automática de tipoProducto cuando cambia tarifa o autoconsumo
  const matchingTariffAutoProducts = useMemo(() => {
    return productsDb.filter((p) => {
      if (p.tariff && p.tariff !== data.tarifa) return false;
      if (data.autoconsumo === 'NO' && p.hasSelfConsumption) return false;
      if (data.autoconsumo === 'SI' && !p.hasSelfConsumption) return false;
      return true;
    });
  }, [productsDb, data.tarifa, data.autoconsumo]);

  const availableProductTypes = useMemo(() => {
    const types = Array.from(new Set(matchingTariffAutoProducts.map((p) => p.type).filter(Boolean)));
    if (types.length > 0) return types as string[];
    const allTypes = Array.from(new Set(productsDb.map((p) => p.type).filter(Boolean)));
    if (allTypes.length > 0) return allTypes as string[];
    return [
      'Precio fijo único',
      'Precio indexado Pass-Through',
      'Precio fijo por periodo',
      'Precio indexado Pass-Through Personalizado',
      'Precio indexado Pass-Through Personalizado Exc Fijo',
    ];
  }, [matchingTariffAutoProducts, productsDb]);

  useEffect(() => {
    if (!isOpen || productsDb.length === 0) return;
    if (availableProductTypes.length > 0 && !availableProductTypes.includes(data.tipoProducto)) {
      setData((prev) => ({
        ...prev,
        tipoProducto: availableProductTypes[0],
        product: '',
      }));
    }
  }, [isOpen, productsDb.length, availableProductTypes, data.tipoProducto]);

  // #4: Cálculo confidencial en servidor de Comisión Estimada
  useEffect(() => {
    if (!isOpen || !data.product.trim()) {
      setCommissionPreview({
        loading: false,
        available: false,
        commissionTotal: 0,
        commissionEnergy: 0,
        commissionServices: 0,
      });
      return;
    }

    let cancelled = false;
    setCommissionPreview((prev) => ({ ...prev, loading: true }));

    const parseNum = (v: string) => {
      const n = parseFloat(String(v || '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const parseOptNum = (v: string) => {
      if (!String(v || '').trim()) return null;
      const n = parseFloat(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };

    const timer = setTimeout(async () => {
      try {
        const res = await estimateLeadCommissionAction({
          productNameOrId: data.product,
          productType: data.tipoProducto,
          tarifa: data.tarifa,
          estimatedMWh: parseNum(data.estimatedMWh),
          potencias: [
            parseNum(data.p1c),
            parseNum(data.p2c),
            parseNum(data.p3c),
            parseNum(data.p4c),
            parseNum(data.p5c),
            parseNum(data.p6c),
          ],
          feeIndex: parseOptNum(data.feeIndex),
          ips: [
            parseOptNum(data.ip1),
            parseOptNum(data.ip2),
            parseOptNum(data.ip3),
            parseOptNum(data.ip4),
            parseOptNum(data.ip5),
            parseOptNum(data.ip6),
          ],
          additionalServiceIds: data.additionalServiceIds,
          leadOwnerUserId: leadToEdit?.userId || null,
        });
        if (!cancelled) {
          setCommissionPreview({ loading: false, ...res });
        }
      } catch {
        if (!cancelled) {
          setCommissionPreview({
            loading: false,
            available: false,
            commissionTotal: 0,
            commissionEnergy: 0,
            commissionServices: 0,
          });
        }
      }
    }, 380);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    data.product,
    data.tipoProducto,
    data.tarifa,
    data.estimatedMWh,
    data.p1c,
    data.p2c,
    data.p3c,
    data.p4c,
    data.p5c,
    data.p6c,
    data.feeIndex,
    data.ip1,
    data.ip2,
    data.ip3,
    data.ip4,
    data.ip5,
    data.ip6,
    data.additionalServiceIds,
    leadToEdit?.userId,
  ]);

  const selectedProductObj = useMemo(
    () => productsDb.find((p) => p.name === data.product) || null,
    [productsDb, data.product]
  );

  // #4: Estimador de Factura Mensual/Anual y Calculadora Automática de Ahorro (para productos de Precio Fijo)
  const billAndSavingsEstimate = useMemo(() => {
    if (!selectedProductObj) return null;
    const isIndexed =
      selectedProductObj.pricingModel === 'INDEXED' ||
      String(selectedProductObj.type || '').toLowerCase().includes('index');
    if (isIndexed) return null;

    const p1e = Number(selectedProductObj.p1e ?? 0);
    if (!Number.isFinite(p1e) || p1e <= 0) return null;

    const parseN = (v: any) => {
      const n = parseFloat(String(v ?? '').replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const annualKwh = parseN(data.estimatedMWh) * 1000;
    const ps = sipsData?.data?.ps?.[0] || {};
    const sipsPeriods = [
      Number(ps.ConsumoAnualP1kWh || 0),
      Number(ps.ConsumoAnualP2kWh || 0),
      Number(ps.ConsumoAnualP3kWh || 0),
      Number(ps.ConsumoAnualP4kWh || 0),
      Number(ps.ConsumoAnualP5kWh || 0),
      Number(ps.ConsumoAnualP6kWh || 0),
    ];
    const sipsSum = sipsPeriods.reduce((acc, v) => acc + (v > 0 ? v : 0), 0);

    const is20 = data.tarifa === '2.0TD';
    const defaultShares = is20 ? [0.28, 0.26, 0.46, 0, 0, 0] : [0.14, 0.18, 0.16, 0.16, 0.12, 0.24];
    const shares = sipsSum > 0 ? sipsPeriods.map((v) => Math.max(0, v) / sipsSum) : defaultShares;
    const kwhByPeriod = shares.map((sh) => annualKwh * sh);

    const pricesE = [
      Number(selectedProductObj.p1e ?? p1e),
      Number(selectedProductObj.p2e ?? p1e),
      Number(selectedProductObj.p3e ?? p1e),
      Number(selectedProductObj.p4e ?? p1e),
      Number(selectedProductObj.p5e ?? p1e),
      Number(selectedProductObj.p6e ?? p1e),
    ];
    const pricesP = [
      Number(selectedProductObj.p1p ?? 0),
      Number(selectedProductObj.p2p ?? 0),
      Number(selectedProductObj.p3p ?? 0),
      Number(selectedProductObj.p4p ?? 0),
      Number(selectedProductObj.p5p ?? 0),
      Number(selectedProductObj.p6p ?? 0),
    ];
    const kws = [
      parseN(data.p1c),
      parseN(data.p2c),
      is20 ? 0 : parseN(data.p3c),
      is20 ? 0 : parseN(data.p4c),
      is20 ? 0 : parseN(data.p5c),
      is20 ? 0 : parseN(data.p6c),
    ];

    if (annualKwh <= 0 && kws[0] <= 0 && kws[1] <= 0) return null;

    let annualEnergyEur = 0;
    let annualPowerEur = 0;
    for (let i = 0; i < 6; i++) {
      annualEnergyEur += kwhByPeriod[i] * (Number.isFinite(pricesE[i]) ? pricesE[i] : 0);
      annualPowerEur += 365 * kws[i] * (Number.isFinite(pricesP[i]) ? pricesP[i] : 0);
    }

    const is6x = data.tarifa.startsWith('6.');
    const ieMinRate = is6x ? 0.5 : 1.0;
    const ieEur = Math.max((annualEnergyEur + annualPowerEur) * 0.0511269632, (annualKwh / 1000) * ieMinRate);

    let annualSvaEur = 0;
    for (const svc of additionalServicesDb) {
      if (data.additionalServiceIds.includes(svc.id)) {
        if (svc.monthlyPrice !== null && svc.monthlyPrice !== undefined) {
          annualSvaEur += Number(svc.monthlyPrice) * 12;
        } else if (svc.dailyPrice !== null && svc.dailyPrice !== undefined) {
          annualSvaEur += Number(svc.dailyPrice) * 365;
        }
      }
    }
    if (data.autoconsumo === 'SI' && data.bolsilloSolar === 'SI' && selectedProductObj.cgBolsilloSolar) {
      annualSvaEur += Number(selectedProductObj.cgBolsilloSolar) * 365;
    }

    const bonoSocialEur = 0.012742 * 365;
    const alquilerContadorEur = is20 ? 0.81 * 12 : 2.0 * 12;
    const baseImponible = annualEnergyEur + annualPowerEur + ieEur + annualSvaEur + bonoSocialEur + alquilerContadorEur;

    const prov = data.sProvincia || data.provincia;
    const taxRate =
      prov === 'Las Palmas' || prov === 'Santa Cruz de Tenerife'
        ? 0.07
        : prov === 'Ceuta' || prov === 'Melilla'
          ? 0.04
          : 0.21;
    const taxLabel =
      taxRate === 0.07 ? 'IGIC 7%' : taxRate === 0.04 ? 'IPSI 4%' : 'IVA 21%';

    const annualTotalEur = baseImponible * (1 + taxRate);
    const monthlyTotalEur = annualTotalEur / 12;

    // Comparación frente a situación actual del cliente (si introdujo Gasto Mensual o precios actuales)
    const monthlyCurrentInput = parseN(data.monthlyExpense);
    let currentAnnualEur = monthlyCurrentInput > 0 ? monthlyCurrentInput * 12 : 0;

    if (currentAnnualEur <= 0) {
      const actE = [
        parseN(data.p1eActual),
        parseN(data.p2eActual),
        parseN(data.p3eActual),
        parseN(data.p4eActual),
        parseN(data.p5eActual),
        parseN(data.p6eActual),
      ];
      const actP = [
        parseN(data.p1pDaily),
        parseN(data.p2pDaily),
        parseN(data.p3pDaily),
        parseN(data.p4pDaily),
        parseN(data.p5pDaily),
        parseN(data.p6pDaily),
      ];
      if (actE[0] > 0 || actP[0] > 0) {
        let curE = 0;
        let curP = 0;
        for (let i = 0; i < 6; i++) {
          curE += kwhByPeriod[i] * (actE[i] || actE[0] || 0);
          curP += 365 * kws[i] * (actP[i] || 0);
        }
        const curIe = Math.max((curE + curP) * 0.0511269632, (annualKwh / 1000) * ieMinRate);
        const curSvc = parseN(data.priceServiceActual) * 12;
        currentAnnualEur = (curE + curP + curIe + curSvc + bonoSocialEur + alquilerContadorEur) * (1 + taxRate);
      }
    }

    const annualSavingsEur = currentAnnualEur > 0 ? currentAnnualEur - annualTotalEur : null;
    const savingsPct =
      currentAnnualEur > 0 && annualSavingsEur !== null ? (annualSavingsEur / currentAnnualEur) * 100 : null;

    return {
      annualTotalEur,
      monthlyTotalEur,
      taxLabel,
      usedSipsCurve: sipsSum > 0,
      currentAnnualEur: currentAnnualEur > 0 ? currentAnnualEur : null,
      currentMonthlyEur: currentAnnualEur > 0 ? currentAnnualEur / 12 : null,
      annualSavingsEur,
      savingsPct,
    };
  }, [
    selectedProductObj,
    data.estimatedMWh,
    data.tarifa,
    data.p1c,
    data.p2c,
    data.p3c,
    data.p4c,
    data.p5c,
    data.p6c,
    data.additionalServiceIds,
    data.autoconsumo,
    data.bolsilloSolar,
    data.sProvincia,
    data.provincia,
    data.monthlyExpense,
    data.p1eActual,
    data.p2eActual,
    data.p3eActual,
    data.p4eActual,
    data.p5eActual,
    data.p6eActual,
    data.p1pDaily,
    data.p2pDaily,
    data.p3pDaily,
    data.p4pDaily,
    data.p5pDaily,
    data.p6pDaily,
    data.priceServiceActual,
    sipsData,
    additionalServicesDb,
  ]);

  if (!isOpen) return null;

  const updateData = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    userTouchedFormRef.current = true;
    setData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'vatNumber') {
        const clean = String(value || '').trim().toUpperCase().replace(/[-\s]/g, '');
        setClientMatchApplied(false);
        if (clean.length >= 1) {
          if (/^[A-W]/.test(clean) && !/^[XYZKLM]/.test(clean)) {
            next.tipoPersona = 'JURIDICA';
          } else if (/^[0-9XYZKLM]/.test(clean)) {
            next.tipoPersona = 'FISICA';
          }
        }
      }
      if (field === 'cp') {
        const resolved = resolveProvincia('', String(value || ''));
        if (resolved && !prev.provincia) next.provincia = resolved;
      }
      if (field === 'sCp') {
        const resolved = resolveProvincia('', String(value || ''));
        if (resolved && !prev.sProvincia) next.sProvincia = resolved;
      }
      if (field === 'autoconsumo' && value === 'NO') {
        next.bolsilloSolar = 'NO';
      }
      return next;
    });
  };

  const updateDoc = (field: keyof FormState['docs'], url: string) => {
    userTouchedFormRef.current = true;
    setReusedDocFields((prev) => ({ ...prev, [field]: false }));
    setData((prev) => ({ ...prev, docs: { ...prev.docs, [field]: url } }));
  };

  // #2: Aplicar datos del cliente existente (NUNCA IBAN ni Última Factura)
  const applyMatchedClient = () => {
    if (!clientMatch?.profile) return;
    userTouchedFormRef.current = true;
    const p = clientMatch.profile;
    const rDocs = clientMatch.reusableDocs;
    const normCp = normalizePostalCode5(p.cp);
    const resolvedProv = resolveProvincia(p.provincia, normCp) || p.provincia || '';

    const nextReused: Record<string, boolean> = { ...reusedDocFields };
    if (rDocs.dniTitular) nextReused.dniTitular = true;
    if (rDocs.escrituras) nextReused.escrituras = true;
    if (rDocs.dniApoderado) nextReused.dniApoderado = true;
    setReusedDocFields(nextReused);

    setData((prev) => ({
      ...prev,
      tipoPersona: p.tipoPersona || prev.tipoPersona,
      businessName: p.businessName || prev.businessName,
      primerApellido: p.primerApellido || prev.primerApellido,
      segundoApellido: p.segundoApellido || prev.segundoApellido,
      email: p.email || prev.email,
      phone: p.phone || prev.phone,
      tipoVia: TIPOS_VIA.includes(p.tipoVia) ? p.tipoVia : prev.tipoVia,
      nombreVia: p.nombreVia || prev.nombreVia,
      tipoNumeracion: ['NÚMERO', 'KM', 'S/N'].includes(p.tipoNumeracion) ? p.tipoNumeracion : prev.tipoNumeracion,
      numKm: p.numKm || prev.numKm,
      adicional: p.adicional || prev.adicional,
      cp: normCp || prev.cp,
      poblacion: p.poblacion || prev.poblacion,
      provincia: resolvedProv || prev.provincia,
      contactoNombre: p.contactoNombre || prev.contactoNombre,
      contactoApellidos: p.contactoApellidos || prev.contactoApellidos,
      contactoNif: p.contactoNif || prev.contactoNif,
      // Documentos reutilizables de identidad / empresa únicamente (NUNCA factura ni IBAN)
      docs: {
        ...prev.docs,
        dniTitular: rDocs.dniTitular || prev.docs.dniTitular,
        escrituras: rDocs.escrituras || prev.docs.escrituras,
        dniApoderado: rDocs.dniApoderado || prev.docs.dniApoderado,
      },
    }));
    setClientMatchApplied(true);
  };

  // #6: Recuperar o descartar borrador localStorage
  const restorePendingDraft = () => {
    if (!pendingDraft) return;
    userTouchedFormRef.current = true;
    setData(pendingDraft.data);
    setSipsData(pendingDraft.sipsData);
    if (pendingDraft.data.cups) {
      lastAutoSipsCupsRef.current = pendingDraft.data.cups.trim().toUpperCase();
    }
    setStep(pendingDraft.step);
    setPendingDraft(null);
  };

  const discardPendingDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    setPendingDraft(null);
  };

  const copyTitularAddressToSupply = () => {
    userTouchedFormRef.current = true;
    setData((prev) => ({
      ...prev,
      sTipoVia: prev.tipoVia || 'Calle',
      sNombreVia: prev.nombreVia || prev.sNombreVia,
      sTipoNumeracion: prev.tipoNumeracion || 'NÚMERO',
      sNumero: prev.numKm || prev.sNumero,
      sAdicional: prev.adicional || prev.sAdicional,
      sCp: prev.sCp || prev.cp,
      sPoblacion: prev.sPoblacion || prev.poblacion,
      sProvincia: prev.sProvincia || prev.provincia,
      sPais: prev.pais || 'España',
    }));
  };

  async function handleSipsLookup() {
    await runSipsLookup(data.cups, { silent: false });
  }

  function validateStep(currentStep: number): string | null {
    if (currentStep === 1) {
      if (!data.businessName.trim()) {
        return data.tipoPersona === 'FISICA'
          ? 'Introduce el nombre del titular / contacto.'
          : 'Introduce la Razón Social de la empresa o comunidad.';
      }
      if (mode === 'contract') {
        if (vatCheck.empty || !vatCheck.valid) {
          return `NIF/CIF del titular inválido: ${vatCheck.message || 'debe tener 9 caracteres válidos'}.`;
        }
        if (data.tipoPersona === 'FISICA' && !data.primerApellido.trim()) {
          return 'Para Persona Física en Alta Luz, indica al menos el Primer Apellido.';
        }
        if (!data.email.trim() || !data.email.includes('@')) {
          return 'Introduce un Email válido del titular.';
        }
        if (!data.phone.trim()) {
          return 'Introduce el Teléfono de contacto del titular.';
        }
        if (data.cp.trim() && !/^\d{5}$/.test(normalizePostalCode5(data.cp))) {
          return 'El Código Postal del titular debe tener 5 dígitos.';
        }
        if (data.tipoPersona === 'JURIDICA') {
          if (!data.contactoNombre.trim() || !data.contactoApellidos.trim() || !data.contactoNif.trim()) {
            return 'Para Personas Jurídicas es obligatorio completar Nombre, Apellidos y NIF del Apoderado (Regla 75).';
          }
          if (!repVatCheck.valid) {
            return `NIF del Apoderado inválido: ${repVatCheck.message} (Regla 75).`;
          }
        }
      } else if (!vatCheck.empty && vatCheck.clean.length >= 9 && !vatCheck.valid) {
        return `Revisa el NIF/CIF introducido: ${vatCheck.message}.`;
      }
      return null;
    }

    if (currentStep === 2) {
      const cleanCups = data.cups.trim().toUpperCase().replace(/\s+/g, '');
      if (mode === 'contract') {
        const isAltaNueva = data.tipoTramitacion.toLowerCase() === 'alta nueva';
        if (!cleanCups || cleanCups.length < 20) {
          return 'El código CUPS es obligatorio y debe tener entre 20 y 22 caracteres.';
        }
        const mwh = parseFloat(String(data.estimatedMWh || '0').replace(',', '.'));
        if (Number.isNaN(mwh) || mwh <= 0) {
          return 'El Consumo Anual Estimado (MWh) debe ser mayor que 0 (pulsa SIPS para autocompletarlo o introdúcelo manualmente).';
        }
        if (!data.cnae.trim()) {
          return 'El código CNAE es obligatorio para generar el contrato.';
        }
        if (!data.sNombreVia.trim()) {
          return 'Introduce el nombre de la vía de la Dirección de Suministro.';
        }
        const sCpNorm = normalizePostalCode5(data.sCp);
        if (!/^\d{5}$/.test(sCpNorm)) {
          return 'El Código Postal de Suministro es obligatorio y debe tener 5 dígitos.';
        }
        if (!data.sPoblacion.trim() || !data.sProvincia.trim()) {
          return 'Indica la Población y Provincia del Punto de Suministro.';
        }

        if (sipsData && !isAltaNueva) {
          const ps = sipsData?.data?.ps?.[0] || {};
          const sipsCp = normalizePostalCode5(sipsData.cp || ps.CódigoPostalPS || '');
          const sipsCnae = String(sipsData.cnae || ps.CNAE || '').trim();
          const sipsTariff = String(sipsData.tarifa || ps.TarifaATR || '').trim();

          if (sipsCp && sipsCp !== sCpNorm) {
            return `El Código Postal de suministro (${sCpNorm}) no coincide con el registrado en SIPS (${sipsCp}).`;
          }
          if (sipsCnae && data.cnae.trim() !== sipsCnae) {
            return `El CNAE introducido (${data.cnae.trim()}) no coincide con el registrado en SIPS (${sipsCnae}).`;
          }
          const sinCambiosTecnicos = [
            'Cambio comercializadora sin cambios',
            'Cambio comercializadora con cambios administrativos',
            'Modificación de datos administrativos',
          ].includes(data.tipoTramitacion);
          if (sinCambiosTecnicos && sipsTariff && data.tarifa !== sipsTariff) {
            return `Para "${data.tipoTramitacion}", la tarifa (${data.tarifa}) debe coincidir con SIPS (${sipsTariff}).`;
          }
        }
      } else {
        if (cleanCups && cleanCups.length < 20) {
          return 'Si introduces un CUPS, debe tener al menos 20 caracteres.';
        }
      }
      return null;
    }

    if (currentStep === 3) {
      if (!data.product.trim()) {
        return 'Selecciona un Producto comercial antes de continuar.';
      }
      if (mode === 'contract') {
        const p1 = parseFloat(String(data.p1c || '').replace(',', '.'));
        const p2 = parseFloat(String(data.p2c || '').replace(',', '.'));
        if (Number.isNaN(p1) || p1 <= 0 || Number.isNaN(p2) || p2 <= 0) {
          return 'Debes indicar al menos las potencias contratadas P1 y P2 (mayores que 0 kW).';
        }
        if (data.formaPago === 'Domiciliación') {
          if (ibanCheck.empty || !ibanCheck.valid) {
            return `IBAN de domiciliación inválido: ${ibanCheck.message || 'introduce un IBAN válido (ej. ES00...)'}.`;
          }
        }
        const sinCambiosTecnicos = [
          'Cambio comercializadora sin cambios',
          'Cambio comercializadora con cambios administrativos',
          'Modificación de datos administrativos',
        ].includes(data.tipoTramitacion);
        if (sinCambiosTecnicos && sipsData) {
          const ps = sipsData?.data?.ps?.[0] || {};
          const periods = data.tarifa === '2.0TD' ? [1, 2] : [1, 2, 3, 4, 5, 6];
          for (const i of periods) {
            const sRaw = sipsData[`p${i}`] ?? ps[`PotenciaContratadaP${i}kW`];
            const uRaw = (data as any)[`p${i}c`];
            if (sRaw !== undefined && sRaw !== null && sRaw !== '' && uRaw !== '') {
              const sP = Number(String(sRaw).replace(',', '.'));
              const uP = Number(String(uRaw).replace(',', '.'));
              if (!Number.isNaN(sP) && !Number.isNaN(uP) && Math.abs(sP - uP) > 0.01) {
                return `La potencia P${i} (${uP} kW) no coincide con SIPS (${sP} kW). Elige una tramitación "con cambios técnicos" en el Paso 2 si deseas cambiar potencias.`;
              }
            }
          }
        }
      }
      return null;
    }

    return null;
  }

  function handleNextStep() {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setMultiCupsBanner('');
    setStep((s) => s + 1);
  }

  async function handleSubmit(stayForNextCups: boolean = false) {
    for (const s of [1, 2, 3]) {
      const stepErr = validateStep(s);
      if (stepErr) {
        setStep(s);
        setError(stepErr);
        return;
      }
    }

    if (mode === 'contract' && !data.verificacionAed) {
      setError('Debes marcar la casilla de Verificación de Solicitud para finalizar el Alta Luz.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('vatNumber', data.vatNumber.trim().toUpperCase().replace(/[-\s.]/g, ''));

      let finalName = data.businessName.trim();
      if (data.tipoPersona === 'FISICA') {
        finalName = [data.businessName.trim(), data.primerApellido.trim(), data.segundoApellido.trim()]
          .filter(Boolean)
          .join(' ');
      }
      formData.append('businessName', finalName);

      const savedCupsLabel = data.cups.trim().toUpperCase().replace(/\s+/g, '');
      formData.append('cups', savedCupsLabel);
      formData.append('email', data.email.trim());
      formData.append('phone', data.phone.trim());
      formData.append('productType', data.tipoProducto);
      formData.append('product', data.product);
      if (data.estimatedMWh) {
        formData.append('estimatedMWh', String(data.estimatedMWh).replace(',', '.'));
      }

      const selectedServices = additionalServicesDb.filter((s) => data.additionalServiceIds.includes(s.id));
      const textServices = selectedServices.map((s) => s.name).join(', ');
      formData.append('additionalServices', textServices || data.serviciosAdicionales);

      formData.append('tariff', data.tarifa);
      formData.append('selfConsumption', data.autoconsumo);
      if (mode === 'opportunity') {
        formData.append('wantsComparison', 'true');
      }
      if (mode === 'contract' && data.autoGenerateContract && canAutoContract) {
        formData.append('autoGenerateContract', 'true');
      }

      const fullSupplyAddress = [data.sTipoVia, data.sNombreVia, data.sTipoNumeracion, data.sNumero, data.sAdicional]
        .filter(Boolean)
        .join(' ')
        .trim();
      const fullTitularAddress = [data.tipoVia, data.nombreVia, data.tipoNumeracion, data.numKm, data.adicional]
        .filter(Boolean)
        .join(' ')
        .trim();
      formData.append('direccion', fullSupplyAddress || fullTitularAddress);

      if (sipsData) {
        formData.append('sipsData', JSON.stringify(sipsData));
      }

      const normCp = normalizePostalCode5(data.cp);
      const normSCp = normalizePostalCode5(data.sCp);
      const effectiveBolsillo = data.autoconsumo === 'SI' ? data.bolsilloSolar : 'NO';
      const isOfferFlag = mode === 'opportunity' ? true : Boolean(data.generateOffer);

      const contractData = {
        tipoPersona: data.tipoPersona,
        nombre: data.businessName.trim(),
        primerApellido: data.primerApellido.trim(),
        segundoApellido: data.segundoApellido.trim(),
        cnae: data.cnae.trim(),
        cp: normCp,
        poblacion: data.poblacion.trim(),
        provincia: data.provincia,
        sCp: normSCp,
        sPoblacion: data.sPoblacion.trim(),
        sProvincia: data.sProvincia,
        direccion: {
          tipoVia: data.tipoVia,
          nombreVia: data.nombreVia.trim(),
          tipoNumeracion: data.tipoNumeracion,
          numKm: data.numKm.trim(),
          adicional: data.adicional.trim(),
          cp: normCp,
          poblacion: data.poblacion.trim(),
          provincia: data.provincia,
          pais: data.pais,
        },
        direccionSuministro: {
          tipoVia: data.sTipoVia,
          nombreVia: data.sNombreVia.trim(),
          tipoNumeracion: data.sTipoNumeracion,
          numKm: data.sNumero.trim(),
          adicional: data.sAdicional.trim(),
          cp: normSCp,
          postalCode: normSCp,
          poblacion: data.sPoblacion.trim(),
          city: data.sPoblacion.trim(),
          provincia: data.sProvincia,
          province: data.sProvincia,
          pais: data.sPais,
        },
        contactoNombre: data.tipoPersona === 'JURIDICA' ? data.contactoNombre.trim() : '',
        contactoApellidos: data.tipoPersona === 'JURIDICA' ? data.contactoApellidos.trim() : '',
        contactoNif: data.tipoPersona === 'JURIDICA' ? data.contactoNif.trim().toUpperCase().replace(/[-\s.]/g, '') : '',
        representativeName: data.tipoPersona === 'JURIDICA' ? data.contactoNombre.trim() : '',
        representativeLastName: data.tipoPersona === 'JURIDICA' ? data.contactoApellidos.trim() : '',
        representativeVat: data.tipoPersona === 'JURIDICA' ? data.contactoNif.trim().toUpperCase().replace(/[-\s.]/g, '') : '',

        nombreInstalacion: data.nombreInstalacion.trim(),
        tipoTramitacion: data.tipoTramitacion,
        tramitationType: data.tipoTramitacion,
        autoconsumo: data.autoconsumo,
        firmaManuscrita: data.firmaManuscrita,
        bolsilloSolar: effectiveBolsillo,

        iban: data.iban.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
        formaPago: data.formaPago,
        envioFactura: data.envioFactura,
        facturasPapel: data.envioFactura === 'Postal' || data.envioFactura === 'Ambos' ? 'SI' : 'NO',

        p1c: data.p1c,
        p2c: data.p2c,
        p3c: data.p3c,
        p4c: data.p4c,
        p5c: data.p5c,
        p6c: data.p6c,
        potencias: {
          p1: data.p1c,
          p2: data.p2c,
          p3: data.p3c,
          p4: data.p4c,
          p5: data.p5c,
          p6: data.p6c,
        },
        indexado: {
          ip1: data.ip1,
          ip2: data.ip2,
          ip3: data.ip3,
          ip4: data.ip4,
          ip5: data.ip5,
          ip6: data.ip6,
          fee: data.feeIndex,
        },
        pexc: data.pexc,
        estimatedMWh: data.estimatedMWh,

        // Oferta / Comparativa
        generateOffer: isOfferFlag,
        monthlyExpense: data.monthlyExpense,
        p1eActual: data.p1eActual,
        p2eActual: data.p2eActual,
        p3eActual: data.p3eActual,
        p4eActual: data.p4eActual,
        p5eActual: data.p5eActual,
        p6eActual: data.p6eActual,
        p1pDaily: data.p1pDaily,
        p2pDaily: data.p2pDaily,
        p3pDaily: data.p3pDaily,
        p4pDaily: data.p4pDaily,
        p5pDaily: data.p5pDaily,
        p6pDaily: data.p6pDaily,
        priceServiceActual: data.priceServiceActual,
        comparative: data.comparative,
        savings: data.savings,
        comments: data.comments,
        additionalServiceIds: data.additionalServiceIds,
      };
      formData.append('contractData', JSON.stringify(contractData));

      const docsArray = [];
      if (data.docs.dniTitular) docsArray.push({ type: 'DNI', url: data.docs.dniTitular, name: 'DNI Titular' });
      if (data.docs.ultimaFactura) docsArray.push({ type: 'FACTURA', url: data.docs.ultimaFactura, name: 'Última Factura' });
      if (data.docs.certificadoIban) docsArray.push({ type: 'IBAN', url: data.docs.certificadoIban, name: 'Certificado IBAN' });
      if (data.docs.cieConsumo) docsArray.push({ type: 'CIE', url: data.docs.cieConsumo, name: 'CIE Consumo' });
      if (data.docs.cieAutoconsumo) docsArray.push({ type: 'CIE', url: data.docs.cieAutoconsumo, name: 'CIE Autoconsumo' });
      if (data.docs.escrituras) docsArray.push({ type: 'ESCRITURAS', url: data.docs.escrituras, name: 'Escrituras' });
      if (data.docs.dniApoderado) docsArray.push({ type: 'DNI_APODERADO', url: data.docs.dniApoderado, name: 'DNI Apoderado' });

      formData.append('documents', JSON.stringify(docsArray));

      const res = leadToEdit
        ? await updateLeadAction(leadToEdit.id, formData)
        : await createLeadAction(formData);

      if (res.success) {
        try {
          localStorage.removeItem(draftKey);
        } catch {}

        const savedLeadId = res.leadId || leadToEdit?.id || '';
        onSaved?.({ leadId: savedLeadId, contractId: res.contractId });

        // #7: Flujo rápido Multi-CUPS del mismo titular (mantiene titular y docs de identidad, limpia suministro, IBAN y factura)
        if (stayForNextCups && !leadToEdit) {
          const nextNum = multiCupsCount + 1;
          setMultiCupsCount(nextNum);
          setSipsData(null);
          lastAutoSipsCupsRef.current = '';

          const reusedNext: Record<string, boolean> = {};
          if (data.docs.dniTitular) reusedNext.dniTitular = true;
          if (data.docs.escrituras) reusedNext.escrituras = true;
          if (data.docs.dniApoderado) reusedNext.dniApoderado = true;
          setReusedDocFields(reusedNext);

          setData((prev) => ({
            ...prev,
            cups: '',
            tarifa: '2.0TD',
            estimatedMWh: '',
            nombreInstalacion: '',
            cnae: '',
            sTipoVia: 'Calle',
            sNombreVia: '',
            sTipoNumeracion: 'NÚMERO',
            sNumero: '',
            sAdicional: '',
            sCp: '',
            sPoblacion: '',
            sProvincia: '',
            sPais: 'España',
            autoconsumo: 'NO',
            bolsilloSolar: 'NO',
            iban: '', // Regla de negocio: cada CUPS lleva su propia domiciliación bancaria
            p1c: '',
            p2c: '',
            p3c: '',
            p4c: '',
            p5c: '',
            p6c: '',
            monthlyExpense: '',
            savings: '',
            comparative: '',
            p1eActual: '',
            p2eActual: '',
            p3eActual: '',
            p4eActual: '',
            p5eActual: '',
            p6eActual: '',
            p1pDaily: '',
            p2pDaily: '',
            p3pDaily: '',
            p4pDaily: '',
            p5pDaily: '',
            p6pDaily: '',
            priceServiceActual: '',
            docs: {
              dniTitular: prev.docs.dniTitular,
              escrituras: prev.docs.escrituras,
              dniApoderado: prev.docs.dniApoderado,
              ultimaFactura: null, // Siempre reciente por punto de suministro
              certificadoIban: null, // Específico de la cuenta de cada CUPS
              cieConsumo: null,
              cieAutoconsumo: null,
            },
            verificacionAed: false,
          }));

          const warnSuffix =
            res.contractValidationErrors && res.contractValidationErrors.length > 0
              ? ` (aviso en borrador: ${res.contractValidationErrors[0]})`
              : '';
          setMultiCupsBanner(
            `Suministro #${nextNum} (${savedCupsLabel || 'Oferta'}) guardado para ${finalName}${warnSuffix}. Introduce el siguiente CUPS.`
          );
          setStep(2);
          return;
        }

        onClose();
        if (res.contractId) {
          router.push(`/contratos/${res.contractId}`);
        } else if (res.contractValidationErrors && res.contractValidationErrors.length > 0) {
          alert(
            `El Alta se ha guardado en el CRM, pero el borrador de contrato requiere revisar:\n• ${res.contractValidationErrors.join('\n• ')}`
          );
          if (savedLeadId) router.push(`/leads/${savedLeadId}`);
        } else if (mode === 'opportunity' && !leadToEdit && savedLeadId) {
          router.push(`/leads/${savedLeadId}`);
        } else {
          router.refresh();
        }
      } else {
        setError(res.message || res.error || 'Error al guardar la solicitud');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado al guardar');
    } finally {
      setLoading(false);
    }
  }

  const renderDocumentation = () => {
    const isAltaNueva = data.tipoTramitacion.toLowerCase() === 'alta nueva';
    const hasAutoConsumo = data.autoconsumo === 'SI';
    const isCompany = data.tipoPersona === 'JURIDICA';

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-1 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">
            Documentación {mode === 'opportunity' ? '(Opcional para Estudio)' : 'del Expediente'}
          </h3>
          <p className="text-xs text-gray-400 mb-4 mt-2">
            {mode === 'opportunity'
              ? 'Puedes adjuntar la última factura reciente del suministro para conservar respaldo documental de la oferta.'
              : 'Adjunta la documentación acreditativa. Los documentos de identidad reutilizados de cartera no duplican espacio; la última factura y el certificado IBAN son específicos de este CUPS.'}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FileUpload
              label="DNI/NIF Titular"
              value={data.docs.dniTitular}
              isReused={Boolean(reusedDocFields.dniTitular && data.docs.dniTitular)}
              onUpload={(url) => updateDoc('dniTitular', url)}
            />
            <FileUpload
              label="Última Factura (Reciente)"
              value={data.docs.ultimaFactura}
              onUpload={(url) => updateDoc('ultimaFactura', url)}
            />

            {mode === 'contract' && (
              <>
                <FileUpload
                  label="Certificado IBAN (CUPS)"
                  value={data.docs.certificadoIban}
                  onUpload={(url) => updateDoc('certificadoIban', url)}
                />
                {isAltaNueva && (
                  <FileUpload label="CIE Consumo" value={data.docs.cieConsumo} onUpload={(url) => updateDoc('cieConsumo', url)} />
                )}
                {hasAutoConsumo && (
                  <FileUpload
                    label="CIE Autoconsumo"
                    value={data.docs.cieAutoconsumo}
                    onUpload={(url) => updateDoc('cieAutoconsumo', url)}
                  />
                )}
                {isCompany && (
                  <>
                    <FileUpload
                      label="Escrituras / CIF"
                      value={data.docs.escrituras}
                      isReused={Boolean(reusedDocFields.escrituras && data.docs.escrituras)}
                      onUpload={(url) => updateDoc('escrituras', url)}
                    />
                    <FileUpload
                      label="DNI Apoderado"
                      value={data.docs.dniApoderado}
                      isReused={Boolean(reusedDocFields.dniApoderado && data.docs.dniApoderado)}
                      onUpload={(url) => updateDoc('dniApoderado', url)}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {mode === 'contract' && canAutoContract && !leadToEdit?.contractId && (
          <div className="bg-[#111827] border border-[#DEFF9A]/30 rounded-xl p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.autoGenerateContract}
                onChange={(e) => updateData('autoGenerateContract', e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-gray-600 bg-gray-800 text-[#DEFF9A] focus:ring-[#DEFF9A]"
              />
              <div>
                <span className="text-sm font-bold text-[#DEFF9A] block">
                  Generar Borrador de Contrato PDF automáticamente al finalizar
                </span>
                <span className="text-xs text-gray-400">
                  Creará directamente el Contrato en estado BORRADOR con su PDF oficial listo para enviar a firma DocuSign.
                </span>
              </div>
            </label>
          </div>
        )}

        {mode === 'contract' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 border-b border-red-500/20 pb-2">
              Verificación Final
            </h3>
            <label className="flex items-center gap-3 p-3 bg-red-500/5 rounded-lg cursor-pointer hover:bg-red-500/10 transition-colors border border-red-500/20">
              <input
                type="checkbox"
                checked={data.verificacionAed}
                onChange={(e) => updateData('verificacionAed', e.target.checked)}
                className="w-5 h-5 rounded border-gray-600 text-red-500 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-red-200">
                Confirmo que los datos del titular, CUPS, potencias y condiciones han sido verificados para tramitación (Obligatorio)
              </span>
            </label>
          </div>
        )}
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1: {
        const vatHint = vatCheck.empty
          ? undefined
          : vatCheck.valid
            ? `✓ ${vatCheck.message}${clientSearchLoading ? ' · Buscando en cartera...' : ''}`
            : vatCheck.clean.length >= 9
              ? `⚠ ${vatCheck.message}`
              : vatCheck.message;
        const vatTone = vatCheck.empty
          ? 'neutral'
          : vatCheck.valid
            ? 'ok'
            : vatCheck.clean.length >= 9
              ? 'error'
              : 'neutral';

        const repHint = repVatCheck.empty
          ? undefined
          : repVatCheck.valid
            ? `✓ ${repVatCheck.message}`
            : repVatCheck.clean.length >= 9
              ? `⚠ ${repVatCheck.message}`
              : repVatCheck.message;
        const repTone = repVatCheck.empty
          ? 'neutral'
          : repVatCheck.valid
            ? 'ok'
            : repVatCheck.clean.length >= 9
              ? 'error'
              : 'neutral';

        const reusableDocsCount = clientMatch
          ? [
              clientMatch.reusableDocs.dniTitular,
              clientMatch.reusableDocs.escrituras,
              clientMatch.reusableDocs.dniApoderado,
            ].filter(Boolean).length
          : 0;

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">
                Datos del Contacto / Titular
              </h3>

              <div className="flex gap-4 mb-5">
                <label
                  className={`flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    data.tipoPersona === 'FISICA'
                      ? 'bg-[#DEFF9A]/10 border-[#DEFF9A] text-[#DEFF9A]'
                      : 'bg-[#0B0F19] border-[#1E2A3A] text-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    checked={data.tipoPersona === 'FISICA'}
                    onChange={() => updateData('tipoPersona', 'FISICA')}
                    className="hidden"
                  />
                  <span className="font-medium text-sm">Persona Física</span>
                </label>
                <label
                  className={`flex-1 flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    data.tipoPersona === 'JURIDICA'
                      ? 'bg-[#DEFF9A]/10 border-[#DEFF9A] text-[#DEFF9A]'
                      : 'bg-[#0B0F19] border-[#1E2A3A] text-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    checked={data.tipoPersona === 'JURIDICA'}
                    onChange={() => updateData('tipoPersona', 'JURIDICA')}
                    className="hidden"
                  />
                  <span className="font-medium text-sm">Persona Jurídica (Empresa / Comunidad)</span>
                </label>
              </div>

              {clientMatch && !leadToEdit && (
                <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                      <UserCheck size={15} className="shrink-0" />
                      <span>
                        Cliente detectado en tu cartera: <strong className="text-white">{clientMatch.name}</strong>
                        {clientMatch.profile.suppliesCount > 0
                          ? ` (${clientMatch.profile.suppliesCount} ${
                              clientMatch.profile.suppliesCount === 1 ? 'suministro' : 'suministros'
                            })`
                          : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300">
                      Rellena datos del titular, dirección fiscal, apoderado
                      {reusableDocsCount > 0
                        ? ` y reutiliza ${reusableDocsCount} doc(s) de identidad vigentes`
                        : ''}{' '}
                      <span className="text-gray-400">(sin arrastrar IBAN ni facturas antiguas)</span>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={applyMatchedClient}
                    disabled={clientMatchApplied}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                      clientMatchApplied
                        ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 cursor-default'
                        : 'bg-[#DEFF9A] text-black hover:bg-[#c9eb85] shadow-sm cursor-pointer'
                    }`}
                  >
                    {clientMatchApplied ? (
                      <>
                        <CheckCircle size={13} /> Datos aplicados
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} /> Autocompletar titular
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FieldInput
                  label="NIF / CIF / NIE"
                  value={data.vatNumber}
                  onChange={(v) => updateData('vatNumber', v.toUpperCase())}
                  width="half"
                  required={mode === 'contract'}
                  placeholder="12345678Z / B12345678"
                  hint={vatHint}
                  hintTone={vatTone}
                />
                <FieldInput
                  label={data.tipoPersona === 'FISICA' ? 'Nombre' : 'Razón Social'}
                  value={data.businessName}
                  onChange={(v) => updateData('businessName', v)}
                  width="half"
                  required
                />

                {data.tipoPersona === 'FISICA' && (
                  <>
                    <FieldInput
                      label="Primer Apellido"
                      value={data.primerApellido}
                      onChange={(v) => updateData('primerApellido', v)}
                      width="half"
                      required={mode === 'contract'}
                    />
                    <FieldInput
                      label="Segundo Apellido"
                      value={data.segundoApellido}
                      onChange={(v) => updateData('segundoApellido', v)}
                      width="half"
                    />
                  </>
                )}

                <FieldInput
                  label="Email"
                  value={data.email}
                  onChange={(v) => updateData('email', v)}
                  type="email"
                  width="half"
                  required={mode === 'contract'}
                />
                <FieldInput
                  label="Teléfono"
                  value={data.phone}
                  onChange={(v) => updateData('phone', v)}
                  width="half"
                  required={mode === 'contract'}
                />
              </div>
            </div>

            {mode === 'contract' && (
              <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">
                  Dirección Fiscal / Titular
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <FieldSelect
                    label="Tipo de vía"
                    value={data.tipoVia}
                    onChange={(v) => updateData('tipoVia', v)}
                    options={TIPOS_VIA}
                    width="third"
                  />
                  <FieldInput
                    label="Nombre Vía"
                    value={data.nombreVia}
                    onChange={(v) => updateData('nombreVia', v)}
                    width="full"
                  />
                  <FieldSelect
                    label="Tipo numeración"
                    value={data.tipoNumeracion}
                    onChange={(v) => updateData('tipoNumeracion', v)}
                    options={['NÚMERO', 'KM', 'S/N']}
                    width="third"
                  />
                  <FieldInput label="Núm/Km" value={data.numKm} onChange={(v) => updateData('numKm', v)} width="third" />
                  <FieldInput
                    label="Adicional (Piso, Puerta)"
                    value={data.adicional}
                    onChange={(v) => updateData('adicional', v)}
                    width="third"
                  />
                  <FieldInput
                    label="Código Postal"
                    value={data.cp}
                    onChange={(v) => updateData('cp', v)}
                    width="third"
                    placeholder="28001"
                  />
                  <FieldInput label="Población" value={data.poblacion} onChange={(v) => updateData('poblacion', v)} width="third" />
                  <FieldSelect
                    label="Provincia"
                    value={data.provincia}
                    onChange={(v) => updateData('provincia', v)}
                    options={PROVINCIAS}
                    placeholder="Seleccionar..."
                    width="third"
                  />
                </div>
              </div>
            )}

            {mode === 'contract' && data.tipoPersona === 'JURIDICA' && (
              <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">
                  Datos del Apoderado / Representante Legal (Obligatorio B2B)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FieldInput
                    label="Nombre Apoderado"
                    value={data.contactoNombre}
                    onChange={(v) => updateData('contactoNombre', v)}
                    width="half"
                    required
                  />
                  <FieldInput
                    label="Apellidos Apoderado"
                    value={data.contactoApellidos}
                    onChange={(v) => updateData('contactoApellidos', v)}
                    width="half"
                    required
                  />
                  <FieldInput
                    label="NIF Apoderado"
                    value={data.contactoNif}
                    onChange={(v) => updateData('contactoNif', v.toUpperCase())}
                    width="half"
                    required
                    hint={repHint}
                    hintTone={repTone}
                  />
                </div>
              </div>
            )}
          </div>
        );
      }

      case 2: {
        const sipsPs = sipsData?.data?.ps?.[0] || {};
        const notContractable =
          sipsPs?.codigoPSContratable !== undefined &&
          sipsPs?.codigoPSContratable !== null &&
          String(sipsPs.codigoPSContratable) === '0';
        const mwhPreview = parseFloat(String(data.estimatedMWh || '0').replace(',', '.'));

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Zap size={100} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">
                Datos del Suministro (Conexión SIPS Propio)
              </h3>

              <div className="mb-4 relative z-10">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                      CUPS {mode === 'contract' && <span className="text-red-400">*</span>}
                    </label>
                    <input
                      value={data.cups}
                      onChange={(e) => updateData('cups', e.target.value.toUpperCase())}
                      placeholder="ES0000000000000000AA"
                      className={`w-full bg-[#0B0F19] border rounded-lg px-3 py-2.5 text-sm text-white focus:ring-1 outline-none font-mono uppercase ${
                        !cupsCheck.empty && cupsCheck.clean.length >= 20 && !cupsCheck.checksumOk
                          ? 'border-amber-500/50 focus:border-amber-400 focus:ring-amber-400'
                          : cupsCheck.checksumOk
                            ? 'border-emerald-500/40 focus:border-[#DEFF9A] focus:ring-[#DEFF9A]'
                            : 'border-[#1E2A3A] focus:border-[#DEFF9A] focus:ring-[#DEFF9A]'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSipsLookup}
                    disabled={sipsLoading}
                    className="px-4 py-2.5 bg-[#DEFF9A]/10 text-[#DEFF9A] hover:bg-[#DEFF9A]/20 border border-[#DEFF9A]/30 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    {sipsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Consultar SIPS
                  </button>
                </div>
                {!cupsCheck.empty && (
                  <p
                    className={`mt-1.5 text-[11px] font-medium ${
                      cupsCheck.checksumOk
                        ? 'text-emerald-400'
                        : cupsCheck.clean.length >= 20
                          ? 'text-amber-400'
                          : 'text-gray-500'
                    }`}
                  >
                    {cupsCheck.checksumOk
                      ? `✓ ${cupsCheck.message}${sipsLoading ? ' · Consultando SIPS automáticamente...' : ''}`
                      : cupsCheck.clean.length >= 20
                        ? `⚠ ${cupsCheck.message}`
                        : cupsCheck.message}
                  </p>
                )}
              </div>

              {sipsData && (
                <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-xs space-y-2 relative z-10">
                  <div className="flex items-center justify-between text-emerald-400 font-semibold">
                    <span className="flex items-center gap-2">
                      <CheckCircle size={14} /> SIPS verificado — Tarifa, potencias, consumo, CNAE y ubicación autocompletados
                    </span>
                    <span className="font-mono text-[11px] text-emerald-300">
                      {sipsData.distribuidora || sipsPs.NombreDistribuidora || ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-gray-300">
                    <div>
                      <span className="text-gray-500">Tarifa ATR:</span>{' '}
                      <strong className="text-white">{sipsData.tarifa || sipsPs.TarifaATR || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Consumo:</span>{' '}
                      <strong className="text-white">
                        {Number(sipsData.consumo || sipsPs.ConsumoAnualkWh || 0).toLocaleString('es-ES')} kWh
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Potencias:</span>{' '}
                      <strong className="text-white">
                        P1 {sipsData.p1 ?? sipsPs.PotenciaContratadaP1kW ?? '-'} / P2{' '}
                        {sipsData.p2 ?? sipsPs.PotenciaContratadaP2kW ?? '-'} kW
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500">CP / CNAE:</span>{' '}
                      <strong className="text-white">
                        {normalizePostalCode5(sipsData.cp || sipsPs.CódigoPostalPS) || '-'} / {sipsData.cnae || sipsPs.CNAE || '-'}
                      </strong>
                    </div>
                  </div>
                  {notContractable && (
                    <div className="mt-2 p-2.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>
                        Aviso Distribuidora (PS no contratable en SIPS):{' '}
                        <strong>{sipsPs.motivoEstadoNoContratable || 'Revisar estado del suministro'}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 relative z-10">
                <FieldSelect
                  label="Tarifa de Acceso"
                  value={data.tarifa}
                  onChange={(v) => updateData('tarifa', v)}
                  options={TARIFAS}
                  width="half"
                  required
                />
                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-medium text-gray-400">
                    Consumo Anual Estimado (MWh) {mode === 'contract' && <span className="text-red-400">*</span>}
                    {!Number.isNaN(mwhPreview) && mwhPreview > 0 && (
                      <span className="ml-2 text-[11px] text-[#DEFF9A] font-mono">
                        ({Math.round(mwhPreview * 1000).toLocaleString('es-ES')} kWh/año)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Ej. 4.500"
                    value={data.estimatedMWh}
                    onChange={(e) => updateData('estimatedMWh', e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1E2A3A] rounded-lg px-3 py-2 text-sm text-white focus:border-[#DEFF9A] focus:ring-1 focus:ring-[#DEFF9A] outline-none transition-all"
                  />
                </div>

                <FieldSelect
                  label="¿Tiene Autoconsumo (Placas Solares)?"
                  value={data.autoconsumo}
                  onChange={(v) => updateData('autoconsumo', v)}
                  options={['NO', 'SI']}
                  width="half"
                />
                {mode === 'contract' ? (
                  <FieldInput
                    label="CNAE"
                    value={data.cnae}
                    onChange={(v) => updateData('cnae', v)}
                    width="half"
                    required
                    placeholder="Ej. 9820 (Hogar)"
                  />
                ) : (
                  <FieldInput
                    label="Nombre / Alias Instalación"
                    value={data.nombreInstalacion}
                    onChange={(v) => updateData('nombreInstalacion', v)}
                    width="half"
                  />
                )}
              </div>

              <div className="mt-6 border-t border-[#1E2A3A] pt-5 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#DEFF9A]">Dirección de Suministro</h4>
                  {mode === 'contract' && data.nombreVia && (
                    <button
                      type="button"
                      onClick={copyTitularAddressToSupply}
                      className="text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-[#1E2A3A] text-gray-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Copy size={12} /> Copiar dirección del titular
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FieldSelect
                    label="Tipo de vía"
                    value={data.sTipoVia}
                    onChange={(v) => updateData('sTipoVia', v)}
                    options={TIPOS_VIA}
                    width="third"
                  />
                  <FieldInput
                    label="Nombre Vía"
                    value={data.sNombreVia}
                    onChange={(v) => updateData('sNombreVia', v)}
                    width="full"
                    required={mode === 'contract'}
                  />
                  <FieldSelect
                    label="Tipo numeración"
                    value={data.sTipoNumeracion}
                    onChange={(v) => updateData('sTipoNumeracion', v)}
                    options={['NÚMERO', 'KM', 'S/N']}
                    width="third"
                  />
                  <FieldInput label="Núm/Km" value={data.sNumero} onChange={(v) => updateData('sNumero', v)} width="third" />
                  <FieldInput
                    label="Adicional (Piso, Puerta)"
                    value={data.sAdicional}
                    onChange={(v) => updateData('sAdicional', v)}
                    width="third"
                  />
                  <FieldInput
                    label="Código Postal"
                    value={data.sCp}
                    onChange={(v) => updateData('sCp', v)}
                    width="third"
                    required={mode === 'contract'}
                    placeholder="14008"
                  />
                  <FieldInput
                    label="Población"
                    value={data.sPoblacion}
                    onChange={(v) => updateData('sPoblacion', v)}
                    width="third"
                    required={mode === 'contract'}
                  />
                  <FieldSelect
                    label="Provincia"
                    value={data.sProvincia}
                    onChange={(v) => updateData('sProvincia', v)}
                    options={PROVINCIAS}
                    placeholder="Seleccionar..."
                    width="third"
                    required={mode === 'contract'}
                  />
                </div>
              </div>
            </div>

            {mode === 'contract' && (
              <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">
                  Tipo de Tramitación ATR
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <FieldSelect
                    label="Tramitación a realizar"
                    value={data.tipoTramitacion}
                    onChange={(v) => updateData('tipoTramitacion', v)}
                    options={TRAMITACIONES}
                    width="full"
                  />
                </div>
                <label className="flex items-center gap-3 p-3 border border-[#1E2A3A] rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                  <input
                    type="checkbox"
                    checked={data.firmaManuscrita}
                    onChange={(e) => updateData('firmaManuscrita', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#DEFF9A] focus:ring-[#DEFF9A]"
                  />
                  <span className="text-sm text-gray-300">Firma Manuscrita (excepcional, sin sobre DocuSign)</span>
                </label>
              </div>
            )}
          </div>
        );
      }

      case 3: {
        const isNot20 = data.tarifa !== '2.0TD';
        const prodTypeLower = (data.tipoProducto || '').toLowerCase();
        const isIndexadoPers = prodTypeLower.includes('indexado') && prodTypeLower.includes('personalizado');
        const isPersAutoconsumo = prodTypeLower.includes('personalizado') && data.autoconsumo === 'SI';

        const filteredProducts = matchingTariffAutoProducts.filter((p) => {
          if (data.tipoProducto && p.type !== data.tipoProducto) return false;
          return true;
        });

        const ibanHint = ibanCheck.empty
          ? undefined
          : ibanCheck.valid
            ? `✓ ${ibanCheck.message}`
            : ibanCheck.clean.length >= 24 || (!ibanCheck.clean.startsWith('ES') && ibanCheck.clean.length >= 15)
              ? `⚠ ${ibanCheck.message}`
              : ibanCheck.message;
        const ibanTone = ibanCheck.empty
          ? 'neutral'
          : ibanCheck.valid
            ? 'ok'
            : ibanCheck.clean.length >= 24
              ? 'error'
              : 'neutral';

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">
                Producto y Facturación
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <FieldSelect
                  label="Tipo de Producto"
                  value={data.tipoProducto}
                  onChange={(v) => {
                    updateData('tipoProducto', v);
                    updateData('product', '');
                  }}
                  options={availableProductTypes}
                  width="half"
                />

                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-medium text-gray-400">
                    Producto Comercial <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={data.product}
                    onChange={(e) => updateData('product', e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1E2A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#DEFF9A] transition-colors"
                  >
                    <option value="">Seleccione un producto...</option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                    {data.product && !productsDb.find((p) => p.name === data.product) && (
                      <option value={data.product}>{data.product} (Histórico)</option>
                    )}
                  </select>
                </div>

                {data.autoconsumo === 'SI' && (
                  <FieldSelect
                    label="¿Asociar a Bolsillo Solar (Batería Virtual)?"
                    value={data.bolsilloSolar}
                    onChange={(v) => updateData('bolsilloSolar', v)}
                    options={['NO', 'SI']}
                    width="half"
                  />
                )}

                {selectedProductObj && (
                  <div className="col-span-2 p-3 rounded-lg bg-[#0B0F19] border border-[#1E2A3A] text-xs text-gray-300 flex flex-wrap gap-x-5 gap-y-1.5">
                    <span>
                      <strong className="text-[#DEFF9A]">Tarifa:</strong> {selectedProductObj.tariff || data.tarifa}
                    </span>
                    {selectedProductObj.pricingModel === 'INDEXED' ||
                    String(selectedProductObj.type || '').toLowerCase().includes('index') ? (
                      <span>
                        <strong className="text-[#DEFF9A]">Modalidad:</strong> Indexado (Fee:{' '}
                        {selectedProductObj.fee ?? 0} €)
                      </span>
                    ) : (
                      <span>
                        <strong className="text-[#DEFF9A]">Energía (€/kWh):</strong> P1 {selectedProductObj.p1e ?? '-'} · P2{' '}
                        {selectedProductObj.p2e ?? '-'} · P3 {selectedProductObj.p3e ?? '-'}
                        {isNot20
                          ? ` · P4 ${selectedProductObj.p4e ?? '-'} · P5 ${selectedProductObj.p5e ?? '-'} · P6 ${selectedProductObj.p6e ?? '-'}`
                          : ''}
                      </span>
                    )}
                    <span>
                      <strong className="text-[#DEFF9A]">Potencia (€/kW/día):</strong> P1 {selectedProductObj.p1p ?? '-'} · P2{' '}
                      {selectedProductObj.p2p ?? '-'}
                    </span>
                    {data.autoconsumo === 'SI' && (
                      <span>
                        <strong className="text-amber-400">Excedentes:</strong> {selectedProductObj.pexc ?? 0} €/kWh
                      </span>
                    )}
                  </div>
                )}

                {/* #4: Tarjetas en vivo de Cuota Estimada Cliente + Comisión Estimada Agente */}
                {(billAndSavingsEstimate || commissionPreview.available || commissionPreview.loading) && (
                  <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {billAndSavingsEstimate && (
                      <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-sky-300 text-xs font-bold">
                            <Calculator size={14} /> Cuota Estimada Cliente ({billAndSavingsEstimate.taxLabel} e IE incl.)
                          </div>
                          <div className="text-lg font-extrabold text-white">
                            ~{formatEur(billAndSavingsEstimate.monthlyTotalEur)} €/mes{' '}
                            <span className="text-xs font-normal text-gray-400">
                              (~{formatEur(billAndSavingsEstimate.annualTotalEur)} €/año)
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400">
                            {billAndSavingsEstimate.usedSipsCurve
                              ? 'Calculado con el reparto horario real SIPS del suministro'
                              : 'Calculado con perfil estándar CNMC según consumo y potencias'}
                          </p>
                        </div>
                      </div>
                    )}

                    {(commissionPreview.available || commissionPreview.loading) && (
                      <div className="p-3.5 rounded-xl bg-[#DEFF9A]/10 border border-[#DEFF9A]/30 flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[#DEFF9A] text-xs font-bold">
                            <TrendingUp size={14} /> Tu Comisión Estimada (12 meses)
                            {commissionPreview.loading && <Loader2 size={12} className="animate-spin ml-1" />}
                          </div>
                          <div className="text-lg font-extrabold text-white">
                            {formatEur(commissionPreview.commissionTotal)} €
                          </div>
                          <p className="text-[10px] text-gray-300">
                            {commissionPreview.commissionServices > 0
                              ? `Energía/Potencia: ${formatEur(commissionPreview.commissionEnergy)} € · SVA: ${formatEur(
                                  commissionPreview.commissionServices
                                )} €`
                              : `Canal: ${commissionPreview.channelName || 'Asignado'} · Sujeta a activación y permanencia`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="col-span-2 mt-2">
                  <label className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wide">
                    Servicios Adicionales (SVA)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {additionalServicesDb.map((svc) => (
                      <label
                        key={svc.id}
                        className="flex items-center gap-3 p-3 bg-[#0B0F19] border border-[#1E2A3A] rounded-lg cursor-pointer hover:border-[#DEFF9A]/50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#DEFF9A] focus:ring-[#DEFF9A]"
                          checked={data.additionalServiceIds.includes(svc.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateData('additionalServiceIds', [...data.additionalServiceIds, svc.id]);
                            } else {
                              updateData(
                                'additionalServiceIds',
                                data.additionalServiceIds.filter((id) => id !== svc.id)
                              );
                            }
                          }}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{svc.name}</span>
                          <span className="text-xs text-gray-500">
                            {svc.monthlyPrice
                              ? `${Number(svc.monthlyPrice).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/mes`
                              : `${Number(svc.dailyPrice || 0).toLocaleString('es-ES', { minimumFractionDigits: 3 })} €/día`}
                          </span>
                        </div>
                      </label>
                    ))}
                    {additionalServicesDb.length === 0 && (
                      <div className="text-xs text-gray-500 p-3">No hay servicios adicionales activos en esta marca.</div>
                    )}
                  </div>
                </div>
              </div>

              {mode === 'contract' && (
                <div className="grid grid-cols-3 gap-4 border-t border-[#1E2A3A] pt-4">
                  <FieldSelect
                    label="Forma de pago"
                    value={data.formaPago}
                    onChange={(v) => updateData('formaPago', v)}
                    options={['Domiciliación', 'Transferencia']}
                    width="third"
                  />
                  <FieldInput
                    label="IBAN Cuenta Bancaria (este CUPS)"
                    value={data.iban}
                    onChange={(v) => updateData('iban', formatIbanPretty(v))}
                    width="third"
                    required={data.formaPago === 'Domiciliación'}
                    placeholder="ES00 0000 0000 0000 0000 0000"
                    hint={ibanHint}
                    hintTone={ibanTone}
                  />
                  <FieldSelect
                    label="Envío de factura"
                    value={data.envioFactura}
                    onChange={(v) => updateData('envioFactura', v)}
                    options={['Email', 'Postal', 'Ambos']}
                    width="third"
                  />
                </div>
              )}
            </div>

            <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">
                Potencia Contratada (kW)
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <FieldInput
                  label="P1C"
                  value={data.p1c}
                  onChange={(v) => updateData('p1c', v)}
                  type="number"
                  step="0.01"
                  width="col-span-1"
                  required={mode === 'contract'}
                />
                <FieldInput
                  label="P2C"
                  value={data.p2c}
                  onChange={(v) => updateData('p2c', v)}
                  type="number"
                  step="0.01"
                  width="col-span-1"
                  required={mode === 'contract'}
                />
                {isNot20 && (
                  <>
                    <FieldInput label="P3C" value={data.p3c} onChange={(v) => updateData('p3c', v)} type="number" step="0.01" width="col-span-1" />
                    <FieldInput label="P4C" value={data.p4c} onChange={(v) => updateData('p4c', v)} type="number" step="0.01" width="col-span-1" />
                    <FieldInput label="P5C" value={data.p5c} onChange={(v) => updateData('p5c', v)} type="number" step="0.01" width="col-span-1" />
                    <FieldInput label="P6C" value={data.p6c} onChange={(v) => updateData('p6c', v)} type="number" step="0.01" width="col-span-1" />
                  </>
                )}
              </div>
            </div>

            {(isIndexadoPers || isPersAutoconsumo) && (
              <div className="bg-[#111827] border border-[#DEFF9A]/30 rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold text-[#DEFF9A] uppercase tracking-wider mb-4 border-b border-[#DEFF9A]/20 pb-2">
                  Condiciones Personalizadas
                </h3>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {isIndexadoPers && (
                    <>
                      <FieldInput label="FEE Index" value={data.feeIndex} onChange={(v) => updateData('feeIndex', v)} type="number" step="0.0001" width="col-span-1" />
                      <FieldInput label="IP P1" value={data.ip1} onChange={(v) => updateData('ip1', v)} type="number" step="0.0001" width="col-span-1" />
                      <FieldInput label="IP P2" value={data.ip2} onChange={(v) => updateData('ip2', v)} type="number" step="0.0001" width="col-span-1" />
                    </>
                  )}
                  {isIndexadoPers && isNot20 && (
                    <>
                      <FieldInput label="IP P3" value={data.ip3} onChange={(v) => updateData('ip3', v)} type="number" step="0.0001" width="col-span-1" />
                      <FieldInput label="IP P4" value={data.ip4} onChange={(v) => updateData('ip4', v)} type="number" step="0.0001" width="col-span-1" />
                      <FieldInput label="IP P5" value={data.ip5} onChange={(v) => updateData('ip5', v)} type="number" step="0.0001" width="col-span-1" />
                      <FieldInput label="IP P6" value={data.ip6} onChange={(v) => updateData('ip6', v)} type="number" step="0.0001" width="col-span-1" />
                    </>
                  )}
                  {isPersAutoconsumo && (
                    <FieldInput label="PExc Personalizado (€/kWh)" value={data.pexc} onChange={(v) => updateData('pexc', v)} type="number" step="0.0001" width="col-span-1" />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }

      case 4:
        if (mode === 'opportunity') {
          const canApplyAutoSavings =
            billAndSavingsEstimate &&
            billAndSavingsEstimate.annualSavingsEur !== null &&
            billAndSavingsEstimate.currentMonthlyEur !== null;

          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-5 shadow-lg">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-1 border-b border-[#1E2A3A] pb-2 text-[#DEFF9A]">
                  Datos Comparativos y Ahorro (Opcional)
                </h3>
                <p className="text-xs text-gray-400 mt-2 mb-5">
                  Indica el gasto mensual actual (o los precios de su factura actual) y calcularemos automáticamente el ahorro anual para el PDF de la Oferta Comercial.
                </p>

                {billAndSavingsEstimate && (
                  <div className="mb-5 p-4 rounded-xl bg-[#0B0F19] border border-[#DEFF9A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 text-xs">
                      <div className="text-gray-300">
                        Cuota estimada con <strong className="text-[#DEFF9A]">{data.product}</strong>:{' '}
                        <strong className="text-white">~{formatEur(billAndSavingsEstimate.monthlyTotalEur)} €/mes</strong>{' '}
                        <span className="text-gray-500">({formatEur(billAndSavingsEstimate.annualTotalEur)} €/año)</span>
                      </div>
                      {canApplyAutoSavings ? (
                        <div
                          className={`font-bold text-sm ${
                            (billAndSavingsEstimate.annualSavingsEur || 0) > 0 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {(billAndSavingsEstimate.annualSavingsEur || 0) > 0
                            ? `✓ Ahorro estimado: ${formatEur(billAndSavingsEstimate.annualSavingsEur!)} €/año (${(
                                billAndSavingsEstimate.savingsPct || 0
                              ).toFixed(1)}%)`
                            : `La cuota actual declarada es inferior en ${formatEur(
                                Math.abs(billAndSavingsEstimate.annualSavingsEur!)
                              )} €/año`}
                        </div>
                      ) : (
                        <div className="text-gray-500">
                          Introduce el «Gasto Mensual Actual (€)» o los precios actuales abajo para autocalcular el ahorro.
                        </div>
                      )}
                    </div>
                    {canApplyAutoSavings && (billAndSavingsEstimate.annualSavingsEur || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const sav = Math.max(0, billAndSavingsEstimate.annualSavingsEur || 0);
                          const pct = Math.max(0, billAndSavingsEstimate.savingsPct || 0);
                          updateData('savings', sav.toFixed(2));
                          if (!data.comparative.trim()) {
                            updateData(
                              'comparative',
                              `Cuota estimada ~${formatEur(billAndSavingsEstimate.monthlyTotalEur)} €/mes frente a ${formatEur(
                                billAndSavingsEstimate.currentMonthlyEur!
                              )} €/mes actuales (-${pct.toFixed(1)}%)`
                            );
                          }
                        }}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-[#DEFF9A] text-black hover:bg-[#c9eb85] transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles size={13} /> Aplicar ahorro a la oferta
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <FieldInput
                      label="Gasto Mensual Actual (€)"
                      value={data.monthlyExpense}
                      onChange={(v) => updateData('monthlyExpense', v)}
                      type="number"
                      step="0.01"
                      width="half"
                    />
                    <FieldInput
                      label="Ahorro Anual Estimado (€)"
                      value={data.savings}
                      onChange={(v) => updateData('savings', v)}
                      type="number"
                      step="0.01"
                      width="half"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-[#DEFF9A] mt-4 mb-2">Precios Energía Actual (€/kWh)</h4>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      <FieldInput label="P1" value={data.p1eActual} onChange={(v) => updateData('p1eActual', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P2" value={data.p2eActual} onChange={(v) => updateData('p2eActual', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P3" value={data.p3eActual} onChange={(v) => updateData('p3eActual', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P4" value={data.p4eActual} onChange={(v) => updateData('p4eActual', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P5" value={data.p5eActual} onChange={(v) => updateData('p5eActual', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P6" value={data.p6eActual} onChange={(v) => updateData('p6eActual', v)} type="number" step="0.000001" width="col-span-1" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-[#DEFF9A] mt-4 mb-2">Precios Potencia Actual (€/kW/día)</h4>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      <FieldInput label="P1" value={data.p1pDaily} onChange={(v) => updateData('p1pDaily', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P2" value={data.p2pDaily} onChange={(v) => updateData('p2pDaily', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P3" value={data.p3pDaily} onChange={(v) => updateData('p3pDaily', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P4" value={data.p4pDaily} onChange={(v) => updateData('p4pDaily', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P5" value={data.p5pDaily} onChange={(v) => updateData('p5pDaily', v)} type="number" step="0.000001" width="col-span-1" />
                      <FieldInput label="P6" value={data.p6pDaily} onChange={(v) => updateData('p6pDaily', v)} type="number" step="0.000001" width="col-span-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FieldInput
                      label="Precio Servicios Actual (€)"
                      value={data.priceServiceActual}
                      onChange={(v) => updateData('priceServiceActual', v)}
                      type="number"
                      step="0.01"
                      width="half"
                    />
                    <FieldInput
                      label="Resumen Comparativa (visible en oferta)"
                      value={data.comparative}
                      onChange={(v) => updateData('comparative', v)}
                      width="half"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Comentarios Comerciales Internos</label>
                    <textarea
                      value={data.comments}
                      onChange={(e) => updateData('comments', e.target.value)}
                      className="w-full bg-[#0B0F19] border border-[#1E2A3A] rounded-lg px-3 py-2 text-sm text-white focus:border-[#DEFF9A] focus:ring-1 focus:ring-[#DEFF9A] outline-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return renderDocumentation();

      case 5:
        if (mode === 'opportunity') {
          return renderDocumentation();
        }
        return null;

      default:
        return null;
    }
  };

  const totalSteps = mode === 'opportunity' ? 5 : 4;
  const stepLabels =
    mode === 'opportunity'
      ? ['Titular', 'Suministro', 'Producto', 'Comparativa', 'Documentos']
      : ['Titular', 'Suministro', 'Producto', 'Documentación'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070B]/90 backdrop-blur-md overflow-y-auto pt-6 pb-6 px-4">
      <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 border-b border-[#1E2A3A] shrink-0">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {mode === 'opportunity'
                  ? leadToEdit
                    ? 'Editar Oferta / Estudio Comercial'
                    : 'Crear Oferta / Estudio Comercial'
                  : leadToEdit
                    ? 'Completar / Editar Alta de Suministro'
                    : 'Alta de Suministro Eléctrico'}
              </h2>
              {multiCupsCount > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/35 text-emerald-300">
                  Multisuministro · CUPS #{multiCupsCount + 1}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                <div key={s} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        step === s
                          ? 'bg-[#DEFF9A] text-black shadow-[0_0_15px_rgba(222,255,154,0.3)]'
                          : step > s
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {s}
                    </div>
                    <span className={`text-xs hidden sm:inline ${step === s ? 'text-white font-semibold' : 'text-gray-500'}`}>
                      {stepLabels[s - 1]}
                    </span>
                  </div>
                  {s < totalSteps && <div className={`w-6 h-0.5 mx-2 ${step > s ? 'bg-emerald-600/60' : 'bg-gray-800'}`} />}
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors bg-gray-800 p-2 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* #6: Banner recuperación de borrador */}
          {pendingDraft && !leadToEdit && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-200">
                <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Tienes un borrador guardado sin finalizar:{' '}
                  <strong className="text-white">{pendingDraft.label}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={restorePendingDraft}
                  className="px-3 py-1.5 rounded-lg font-bold bg-amber-400 text-black hover:bg-amber-300 transition-colors cursor-pointer"
                >
                  Recuperar borrador
                </button>
                <button
                  type="button"
                  onClick={discardPendingDraft}
                  className="px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Descartar
                </button>
              </div>
            </div>
          )}

          {/* #7: Confirmación de suministro guardado en flujo multisuministro */}
          {multiCupsBanner && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{multiCupsBanner}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {renderStep()}
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-[#1E2A3A] bg-[#080B13] flex flex-wrap gap-3 justify-between items-center shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={() => {
              setError('');
              if (step > 1) setStep(step - 1);
              else onClose();
            }}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            {step > 1 ? (
              <>
                <ChevronLeft className="w-4 h-4" /> Atrás
              </>
            ) : (
              'Cancelar'
            )}
          </button>

          {step < totalSteps ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-black hover:bg-gray-200 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {!leadToEdit && (
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  title="Guarda este suministro y pasa directamente al Paso 2 conservando los datos del titular y sus documentos de identidad (sin reutilizar IBAN ni factura)"
                  className="px-4 py-2.5 rounded-lg text-sm font-bold bg-[#DEFF9A]/10 text-[#DEFF9A] border border-[#DEFF9A]/40 hover:bg-[#DEFF9A]/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  Guardar y + Otro CUPS
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={loading}
                className="px-7 py-2.5 rounded-lg text-sm font-bold bg-[#DEFF9A] text-black hover:bg-[#c9eb85] transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(222,255,154,0.2)] disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading
                  ? mode === 'opportunity'
                    ? 'Guardando Oferta...'
                    : data.autoGenerateContract && canAutoContract
                      ? 'Generando Alta y Contrato...'
                      : 'Procesando Alta...'
                  : mode === 'opportunity'
                    ? leadToEdit
                      ? 'Guardar Oferta'
                      : 'Guardar y Ver Oferta'
                    : leadToEdit
                      ? 'Guardar Cambios de Alta'
                      : data.autoGenerateContract && canAutoContract
                        ? 'Finalizar Alta y Generar Contrato'
                        : 'Finalizar Alta'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
