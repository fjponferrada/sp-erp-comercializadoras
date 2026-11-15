'use client';

import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import {
  ChevronLeft,
  FileText,
  CheckCircle,
  Clock,
  Ban,
  CalendarDays,
  Wallet,
  Search,
  Banknote,
  MapPin,
  Zap,
  RefreshCw,
  Download,
  FileCheck,
  Send,
  User,
  Settings,
  AlertTriangle,
  FileSpreadsheet,
  Battery,
  BarChart2,
  Pencil,
  Copy,
  FolderOpen,
  ExternalLink,
  Upload,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { formatDateUTC } from '@/lib/utils/date';
import { deleteLatestVersionAction } from '@/app/actions/contractActions';
import {
  sendContractToSignatureAction,
  resendSignatureEnvelopeAction,
  getSignatureLinkForCopyAction,
  cancelSignatureEnvelopeAction,
} from '@/app/actions/signatureActions';
import { createContractModificationAction } from '@/app/actions/contractModification';
import { generateSwitchingXmls } from '@/app/actions/switchingGenerarActions';
import { comunicarRenovacionTacitaAction } from '@/app/actions/renovacionesActions';
import { formatIbanPretty } from '@/lib/spanishValidators';
import toast from 'react-hot-toast';
import ConsumosTab from './ConsumosTab';
import ModificationModal from './ModificationModal';
import HistoricalChart from './HistoricalChart';
import EditContractModal from '../EditContractModal';
import ProductModal from '@/app/(app)/productos/ProductModal';
import { getTipoR1Label, getSubtipoR1Label } from '@/app/(app)/reclamaciones/utils/cnmc_codes';

export default function ContractDetailClient({
  initialContract,
  userRole,
  maxRenewalDays,
  versions = [],
}: {
  initialContract: any;
  userRole: string;
  maxRenewalDays: number;
  versions?: any[];
}) {
  const router = useRouter();

  // Tabs State
  const [activeTab, setActiveTab] = useState('Datos');
  const [activeSubTab, setActiveSubTab] = useState('Resumen Histórico');

  // Modal & action states
  const [showModModal, setShowModModal] = useState(false);
  const [isSendingSignature, setIsSendingSignature] = useState(false);
  const [isGeneratingXml, setIsGeneratingXml] = useState(false);
  const [isDeletingVersion, setIsDeletingVersion] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [showTacitRenewalModal, setShowTacitRenewalModal] = useState(false);
  const [isCommunicatingTacitRenewal, setIsCommunicatingTacitRenewal] = useState(false);

  const isAdmin = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);
  const isAdvancedUser = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);
  const isClientRole = userRole === 'CLIENT';
  const showSips = ['COMERCIAL', 'CANAL', 'BACKOFFICE', 'COMPANYADMIN', 'SUPERADMIN'].includes(userRole);

  const [sipsRawData, setSipsRawData] = useState<any>(initialContract.supplyPoint?.sipsRawData || null);
  const [isUpdatingSips, setIsUpdatingSips] = useState(false);

  const isWithinRenewalPeriod = () => {
    if (!initialContract.expectedEndDate) return false;
    const end = new Date(initialContract.expectedEndDate).getTime();
    if (isNaN(end)) return false;
    const now = Date.now();
    const diffDays = (end - now) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= maxRenewalDays;
  };
  const canRequestMod = isAdmin || (userRole === 'CANAL' && isWithinRenewalPeriod());

  const cData = initialContract.contractData || initialContract.airtableData || {};
  const leadData = initialContract.lead?.contractData || {};
  const lead = initialContract.lead || {};
  const client = initialContract.client || {};
  const supplyPoint = initialContract.supplyPoint || {};
  const airtableData = (initialContract.airtableData as any) || {};

  const copyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const getNombreSolo = () => {
    if (client.firstName) return client.firstName;
    const fullName = client.businessName || lead.businessName || '';
    const apellidos =
      [client.lastName, client.lastName2].filter(Boolean).join(' ').trim() ||
      `${client.primerApellido || leadData.primerApellido || ''} ${client.segundoApellido || leadData.segundoApellido || ''}`.trim() ||
      leadData.apellidosContacto ||
      '';
    if (apellidos && fullName.toLowerCase().includes(apellidos.toLowerCase())) {
      const escaped = apellidos.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      return fullName.replace(regex, '').trim() || fullName;
    }
    return fullName;
  };

  const getApellidosFull = () => {
    const fromSchema = [client.lastName, client.lastName2].filter(Boolean).join(' ').trim();
    if (fromSchema) return fromSchema;
    const fromLegacy = `${client.primerApellido || leadData.primerApellido || ''} ${client.segundoApellido || leadData.segundoApellido || ''}`.trim();
    return fromLegacy || leadData.apellidosContacto || '-';
  };

  const isIndexedContract = useMemo(() => {
    const pm = String(initialContract.pricingModel || initialContract.product?.pricingModel || '').toUpperCase();
    const pt = String(initialContract.productTypeSnapshot || initialContract.product?.type || lead.productType || '').toUpperCase();
    return pm === 'INDEXED' || pt.includes('INDEX');
  }, [initialContract, lead]);

  const pricesDisplay = useMemo(() => {
    const formatPrice = (val: any, fallbackIfIndexed: string, emptyLabel = '-') => {
      if (val !== null && val !== undefined && val !== '') return String(val);
      return isIndexedContract ? fallbackIfIndexed : emptyLabel;
    };

    const rawFee =
      initialContract.fee ??
      cData['Fee Index'] ??
      (Array.isArray(cData['Fee Index (from Producto)']) ? cData['Fee Index (from Producto)'][0] : undefined) ??
      initialContract.product?.fee ??
      null;

    return {
      p1E: formatPrice(initialContract.p1e ?? cData['P1E'] ?? cData['P1E (from Producto)']?.[0], 'Pass-Through (OMIE)'),
      p2E: formatPrice(initialContract.p2e ?? cData['P2E'] ?? cData['P2E (from Producto)']?.[0], 'Pass-Through (OMIE)'),
      p3E: formatPrice(initialContract.p3e ?? cData['P3E'] ?? cData['P3E (from Producto)']?.[0], 'Pass-Through (OMIE)'),
      p4E: formatPrice(initialContract.p4e ?? cData['P4E'] ?? cData['P4E (from Producto)']?.[0], 'Pass-Through (OMIE)'),
      p5E: formatPrice(initialContract.p5e ?? cData['P5E'] ?? cData['P5E (from Producto)']?.[0], 'Pass-Through (OMIE)'),
      p6E: formatPrice(initialContract.p6e ?? cData['P6E'] ?? cData['P6E (from Producto)']?.[0], 'Pass-Through (OMIE)'),
      p1P: initialContract.p1p ?? cData['P1P'] ?? cData['P1P (from Producto)']?.[0] ?? '-',
      p2P: initialContract.p2p ?? cData['P2P'] ?? cData['P2P (from Producto)']?.[0] ?? '-',
      p3P: initialContract.p3p ?? cData['P3P'] ?? cData['P3P (from Producto)']?.[0] ?? '-',
      p4P: initialContract.p4p ?? cData['P4P'] ?? cData['P4P (from Producto)']?.[0] ?? '-',
      p5P: initialContract.p5p ?? cData['P5P'] ?? cData['P5P (from Producto)']?.[0] ?? '-',
      p6P: initialContract.p6p ?? cData['P6P'] ?? cData['P6P (from Producto)']?.[0] ?? '-',
      fee: rawFee,
    };
  }, [initialContract, cData, isIndexedContract]);

  const getSvaName = () => {
    let svaName = initialContract.svaConcept || initialContract.servicio || '-';
    if (svaName !== '-' && svaName.startsWith('rec')) {
      const serviciosMap: Record<string, string> = {
        rec3giNSPTAHYZ6Ca: 'Batería Virtual (5,99 €/mes)',
        rec4ALZMphWAuIb40: 'Gestión energía a precio de coste (3,90 €/mes)',
        rec4m16hzWuPSCFC7: 'Asesoramiento energético + Factura en papel (9,49 €/mes)',
        recDNE5NjUQdbAOK5: 'Asesoramiento energético (5,99 €/mes)',
        recH9hgmpZsGugcdJ: 'Asociar a Bolsillo solar (3,50 €/mes)',
        recNbIOQwp6G0nheT: 'Asesoramiento energético (4,99 €/factura)',
        recQ2kTt4tTJLimlb: 'Factura en papel (3,50 €/mes)',
        recyJxb4cSWoRsM8b: 'Alta Nueva (25 €/alta)',
      };
      if (serviciosMap[svaName]) {
        svaName = serviciosMap[svaName];
      } else {
        const prodYServ = initialContract.contractData?.['Producto y Servicio'] || initialContract.airtableData?.['Producto y Servicio'];
        if (prodYServ && typeof prodYServ === 'string') {
          const match = prodYServ.match(/"([^"]+)"/);
          if (match) svaName = match[1];
        }
      }
    }
    return svaName === '-' ? 'Sin SVA' : svaName;
  };

  // Combinar servicios adicionales de relación M2M + snapshot JSON
  const resolvedAdditionalServices = useMemo(() => {
    const items: Array<{ name: string; priceLabel: string; duration?: number | null }> = [];
    const seen = new Set<string>();

    const snapshot = Array.isArray(initialContract.additionalServicesSnapshot)
      ? initialContract.additionalServicesSnapshot
      : [];
    for (const s of snapshot) {
      if (!s || !s.name) continue;
      seen.add(String(s.name).toLowerCase());
      const priceParts: string[] = [];
      if (s.monthlyPrice != null) priceParts.push(`${Number(s.monthlyPrice).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/mes`);
      else if (s.dailyPrice != null) priceParts.push(`${Number(s.dailyPrice).toLocaleString('es-ES', { minimumFractionDigits: 4 })} €/día`);
      items.push({
        name: s.name,
        priceLabel: priceParts.join(' · ') || 'Incluido',
        duration: s.durationMonths ?? null,
      });
    }

    const relList = Array.isArray(initialContract.additionalServicesList) ? initialContract.additionalServicesList : [];
    for (const s of relList) {
      if (!s || !s.name || seen.has(String(s.name).toLowerCase())) continue;
      seen.add(String(s.name).toLowerCase());
      const priceParts: string[] = [];
      if (s.monthlyPrice != null) priceParts.push(`${Number(s.monthlyPrice).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/mes`);
      else if (s.dailyPrice != null) priceParts.push(`${Number(s.dailyPrice).toLocaleString('es-ES', { minimumFractionDigits: 4 })} €/día`);
      items.push({
        name: s.name,
        priceLabel: priceParts.join(' · ') || 'Incluido',
        duration: s.durationMonths ?? null,
      });
    }

    return items;
  }, [initialContract]);

  const displayTariff =
    typeof (initialContract.airtableData as any)?.tarifa === 'string'
      ? (initialContract.airtableData as any)?.tarifa
      : (Array.isArray((initialContract.airtableData as any)?.Tarifa)
          ? (initialContract.airtableData as any)?.Tarifa[0]
          : (initialContract.airtableData as any)?.Tarifa) ||
        supplyPoint?.tariff ||
        initialContract.product?.tariff ||
        lead?.tariff ||
        '-';

  const getStatusBadge = (status: string) => {
    const st = String(status || '').toUpperCase();
    switch (st) {
      case 'ACTIVO':
        return (
          <span className="badge badge-active flex items-center gap-1 max-w-max">
            <CheckCircle size={12} /> Activo
          </span>
        );
      case 'ACEPTADO':
        return (
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-[rgba(59,130,246,0.15)] text-blue-400 border border-[rgba(59,130,246,0.3)] flex items-center gap-1 max-w-max">
            <FileCheck size={12} /> Aceptado
          </span>
        );
      case 'TRAMITANDO':
        return (
          <span className="badge badge-process flex items-center gap-1 max-w-max">
            <Clock size={12} /> Tramitando
          </span>
        );
      case 'VERIFICANDO_FIRMA':
        return (
          <span className="badge badge-warning flex items-center gap-1 max-w-max">
            <Clock size={12} /> Verificando Firma
          </span>
        );
      case 'BORRADOR':
        return (
          <span className="badge badge-draft flex items-center gap-1 max-w-max">
            <FileText size={12} /> Borrador
          </span>
        );
      case 'FINALIZADO':
      case 'BAJA':
        return (
          <span className="badge badge-finalizado flex items-center gap-1 max-w-max">
            <Ban size={12} /> Finalizado
          </span>
        );
      case 'RENOVACION':
        return (
          <span className="badge badge-warning flex items-center gap-1 max-w-max">
            <CalendarDays size={12} /> Renovación
          </span>
        );
      case 'RECHAZADO':
      case 'RECHAZO_DISTRIBUIDORA':
      case 'RECHAZO DISTRIBUIDORA':
      case 'RECHAZO_COMERCIALIZADORA':
      case 'RECHAZO_RIESGOS':
      case 'RECHAZADO_POR_CLIENTE':
        return (
          <span className="badge badge-danger flex items-center gap-1 max-w-max">
            <AlertTriangle size={12} /> {status.replace(/_/g, ' ')}
          </span>
        );
      default:
        return <span className="badge badge-draft">{status || 'Desconocido'}</span>;
    }
  };

  const DataItem = ({
    label,
    value,
    icon: Icon,
    highlight,
    colSpan,
  }: {
    label: string;
    value: React.ReactNode;
    icon?: any;
    highlight?: boolean;
    colSpan?: number;
  }) => (
    <div
      className={`p-4 rounded-xl border transition-all min-w-0 ${
        highlight ? 'bg-[rgba(222,255,154,0.03)] border-[var(--lime)] border-opacity-30' : 'bg-[var(--bg-elevated)] border-[var(--border)]'
      } ${colSpan ? `col-span-1 md:col-span-${colSpan}` : ''}`}
    >
      <div className="flex items-center gap-2 mb-2 min-w-0">
        {Icon && <Icon size={14} className={highlight ? 'text-[var(--lime)] flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />}
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className={`text-[0.95rem] font-medium break-all sm:break-words ${highlight ? 'text-[var(--lime)]' : 'text-gray-200'}`}>
        {value !== null && value !== undefined && value !== '' ? value : '-'}
      </div>
    </div>
  );

  const SectionCard = ({
    title,
    icon: Icon,
    children,
    delay,
  }: {
    title: string;
    icon: any;
    children: React.ReactNode;
    delay: number;
  }) => (
    <div className={`card animate-fade-in-up delay-${delay} min-w-0 w-full p-4 md:p-6`}>
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border)]">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--bg-base)] border border-[var(--border-strong)]">
          <Icon size={18} className="text-[var(--text-primary)]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{children}</div>
    </div>
  );

  let draftUrl = initialContract.pdfUrl || null;
  if (!draftUrl && Array.isArray(airtableData['Borrador contrato']) && airtableData['Borrador contrato'].length > 0) {
    draftUrl = airtableData['Borrador contrato'][0].url;
  }

  let signedUrl = initialContract.filePdfSigned || null;
  if (!signedUrl && Array.isArray(airtableData['PDF Contrato firmado']) && airtableData['PDF Contrato firmado'].length > 0) {
    signedUrl = airtableData['PDF Contrato firmado'][0].url;
  } else if (!signedUrl && Array.isArray(airtableData['Contrato .PDF']) && airtableData['Contrato .PDF'].length > 0) {
    signedUrl = airtableData['Contrato .PDF'][0].url;
  }

  let annexUrl = initialContract.fileAnexoFirmado || null;
  if (!annexUrl && Array.isArray(airtableData['PDF Anexo firmado']) && airtableData['PDF Anexo firmado'].length > 0) {
    annexUrl = airtableData['PDF Anexo firmado'][0].url;
  }

  const signatureEnvelopes: any[] = Array.isArray(initialContract.signatureEnvelopes)
    ? initialContract.signatureEnvelopes
    : [];
  const latestEnvelope: any = signatureEnvelopes.length > 0 ? signatureEnvelopes[0] : null;
  const summaryDocUrl: string | null =
    latestEnvelope?.signedSummaryPdfUrl ||
    initialContract.summaryPdfUrl ||
    latestEnvelope?.summaryPdfDraftUrl ||
    null;
  const auditTrailUrl: string | null = latestEnvelope?.auditTrailPdfUrl || null;

  const expedienteDocuments: any[] = Array.isArray(initialContract.expedienteDocuments) ? initialContract.expedienteDocuments : [];
  const totalDocsCount = useMemo(() => {
    const urls = new Set<string>();
    if (draftUrl) urls.add(draftUrl);
    if (signedUrl) urls.add(signedUrl);
    if (annexUrl) urls.add(annexUrl);
    if (summaryDocUrl) urls.add(summaryDocUrl);
    if (auditTrailUrl) urls.add(auditTrailUrl);
    expedienteDocuments.forEach((d) => {
      if (d?.url) urls.add(d.url);
    });
    return urls.size;
  }, [draftUrl, signedUrl, annexUrl, summaryDocUrl, auditTrailUrl, expedienteDocuments]);

  const buildDownloadUrl = (url: string) => `/api/documents/smart-download?url=${encodeURIComponent(url)}`;

  const tabs = [
    { id: 'Datos', label: 'Datos', icon: FileText, count: null },
    { id: 'Documentación', label: 'Documentación', icon: FolderOpen, count: totalDocsCount },
    ...(showSips ? [{ id: 'Sips', label: 'SIPS', icon: Search, count: null }] : []),
    ...(isAdvancedUser ? [{ id: 'Switching', label: 'Switching', icon: RefreshCw, count: initialContract.switchingEvents?.length || null }] : []),
    { id: 'Reclamaciones', label: 'Reclamaciones', icon: AlertTriangle, count: initialContract.claims?.length || null },
    { id: 'Facturación', label: 'Facturación', icon: Banknote, count: initialContract.invoices?.length || null },
    ...(isAdvancedUser
      ? [
          { id: 'Consumos', label: 'Consumos', icon: Zap, count: null },
          { id: 'F1s', label: 'F1s', icon: FileSpreadsheet, count: initialContract.f1Invoices?.length || null },
        ]
      : []),
  ];

  const subTabs = [
    { id: 'Resumen Histórico', icon: BarChart2 },
    { id: 'Datos Administrativos', icon: User },
    { id: 'Datos Contrato', icon: FileText },
    { id: 'Datos Técnicos CUPS', icon: Zap },
    { id: 'Datos Económicos Contrato', icon: Wallet },
    { id: 'Catastro', icon: MapPin },
    { id: 'Datos CAU', icon: Battery },
  ];

  const titularDisplayName =
    client.businessName ||
    [client.firstName, client.lastName, client.lastName2].filter(Boolean).join(' ') ||
    lead.businessName ||
    'Sin Cliente';

  const cupsValue = supplyPoint?.cups || lead?.cups || '';
  const annualMwh = initialContract.annualConsumption ?? supplyPoint?.annualConsumption ?? lead?.estimatedMWh ?? null;

  // Cálculo de días restantes de vigencia/permanencia
  const permanenceRemainingInfo = useMemo(() => {
    if (initialContract.terminationDate) {
      return { text: `Finalizado el ${formatDateUTC(initialContract.terminationDate)}`, tone: 'text-gray-400' };
    }
    if (initialContract.expectedEndDate) {
      const endMs = new Date(initialContract.expectedEndDate).getTime();
      if (!isNaN(endMs)) {
        const diffDays = Math.ceil((endMs - Date.now()) / (1000 * 3600 * 24));
        if (diffDays < 0) return { text: `Vencido hace ${Math.abs(diffDays)} días`, tone: 'text-amber-400' };
        if (diffDays <= 45) return { text: `Vence en ${diffDays} días`, tone: 'text-amber-400 font-semibold' };
        return { text: `${diffDays} días restantes`, tone: 'text-[var(--lime)]' };
      }
    }
    return null;
  }, [initialContract.terminationDate, initialContract.expectedEndDate]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '100px' }}>
      <Topbar
        title={`Contrato: ${titularDisplayName}`}
        subtitle={`CUPS: ${cupsValue || 'Sin CUPS'}`}
        showSearch={false}
        customActions={
          <div className="flex gap-2 md:gap-3 items-center overflow-x-auto md:overflow-visible no-scrollbar pb-1 md:pb-0">
            <button onClick={() => router.back()} className="btn-ghost">
              <ChevronLeft size={16} /> <span className="hidden md:inline">Volver</span>
            </button>
            <div className="h-8 border-l border-[var(--border)] mx-1"></div>

            {isAdmin &&
              !['ACTIVO', 'FINALIZADO', 'BAJA', 'RECHAZADO'].includes(initialContract.status) &&
              !initialContract.activationDate &&
              !['R', 'E1'].includes(initialContract.tipo) && (
                <button
                  onClick={async () => {
                    setIsGeneratingXml(true);
                    const loadingToast = toast.loading('Generando paquete XML de Switching...');
                    try {
                      const res = await generateSwitchingXmls([initialContract.id]);
                      if (res.success && res.fileContent) {
                        const link = document.createElement('a');
                        link.href = `data:application/zip;base64,${res.fileContent}`;
                        link.download = res.fileName || 'Switching_Generado.zip';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);

                        toast.success('Paquete XML descargado correctamente', { id: loadingToast });
                        if (res.validationErrors && res.validationErrors.length > 0) {
                          toast('Aviso: ' + res.validationErrors.map((v: any) => v.motivo).join(', '), { icon: '⚠️', duration: 6000 });
                        }
                      } else {
                        toast.error(res.error || 'Error generando XML', { id: loadingToast });
                        if (res.validationErrors && res.validationErrors.length > 0) {
                          toast('Detalle: ' + res.validationErrors.map((v: any) => v.motivo).join(', '), { icon: '⚠️', duration: 6000 });
                        }
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'Error desconocido al generar XML', { id: loadingToast });
                    } finally {
                      setIsGeneratingXml(false);
                    }
                  }}
                  disabled={isGeneratingXml}
                  className="btn-secondary flex items-center gap-2 border-[var(--lime)] text-[var(--lime)] hover:bg-[var(--lime)] hover:text-black"
                  title="Generar paquete de Switching (XML + PDFs) para esta versión del contrato"
                >
                  {isGeneratingXml ? <RefreshCw size={16} className="animate-spin" /> : <FileText size={16} />}
                  <span className="hidden md:inline">{isGeneratingXml ? 'Generando...' : 'Generar XML'}</span>
                </button>
              )}

            {canRequestMod &&
              initialContract.status === 'ACTIVO' &&
              (!versions || versions.length === 0 || initialContract.id === versions[0].id) && (
                <button
                  onClick={() => setShowModModal(true)}
                  className="btn-secondary flex items-center gap-2"
                  title="Modificar Contrato (Subrogación, Cambio Técnico o Autoconsumo)"
                >
                  <Settings size={16} /> <span className="hidden md:inline">Modificar</span>
                </button>
              )}

            {isAdmin && (
              <button
                onClick={() => setShowEditModal(true)}
                className="btn-secondary flex items-center gap-2"
                title="Editar datos y adjuntos del contrato"
              >
                <Pencil size={16} /> <span className="hidden md:inline">Editar</span>
              </button>
            )}

            {isAdmin &&
              initialContract.tipo === 'R' &&
              initialContract.status === 'ACEPTADO' &&
              initialContract.isTacitRenewal === true && (
                <button
                  onClick={() => setShowTacitRenewalModal(true)}
                  disabled={isCommunicatingTacitRenewal}
                  className={
                    initialContract.tacitRenewalCommunicatedAt
                      ? 'bg-[#1E2A3A] text-gray-300 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#2A3B4C] transition-colors flex items-center gap-2 disabled:opacity-50 border border-[#2A3B4C]'
                      : 'bg-[var(--lime)] text-black px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#c2ff66] transition-colors flex items-center gap-2 disabled:opacity-50'
                  }
                  title="Comunicar Renovación Tácita al cliente"
                >
                  {isCommunicatingTacitRenewal ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span className="hidden md:inline">
                    {isCommunicatingTacitRenewal
                      ? 'Enviando...'
                      : initialContract.tacitRenewalCommunicatedAt
                      ? 'Re-comunicar'
                      : 'Comunicar R. Tácita'}
                  </span>
                </button>
              )}

            {!isClientRole && initialContract.status === 'BORRADOR' && (
              <button
                onClick={async () => {
                  setIsSendingSignature(true);
                  const loadingToast = toast.loading('Preparando sobre de Firma Digital y Resumen RD 88/2026...');
                  const res = await sendContractToSignatureAction(initialContract.id);
                  setIsSendingSignature(false);
                  if (res.error) {
                    toast.error(res.error, { id: loadingToast });
                  } else {
                    if (isAdmin && res.signingUrl && res.emailWarning) {
                      navigator.clipboard?.writeText(res.signingUrl).catch(() => {});
                      toast.success(
                        `Sobre ${res.envelopeCode} creado. Enlace copiado al portapapeles (${res.emailWarning})`,
                        { id: loadingToast, duration: 6000 }
                      );
                    } else {
                      toast.success(`Contrato enviado a Firma Digital (${res.envelopeCode})`, { id: loadingToast });
                    }
                    router.refresh();
                  }
                }}
                disabled={isSendingSignature}
                className="btn-primary flex items-center gap-2"
                title="Enviar Documento Resumen Precontractual (RD 88/2026) y Contrato a Firma Digital"
              >
                {isSendingSignature ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                <span className="hidden md:inline">{isSendingSignature ? 'Enviando...' : 'Enviar a Firma'}</span>
              </button>
            )}

            {!isClientRole && initialContract.status === 'VERIFICANDO_FIRMA' && (
              <>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      const res = await getSignatureLinkForCopyAction(initialContract.id);
                      if (res.error || !res.signingUrl) {
                        toast.error(res.error || 'No se pudo obtener el enlace');
                      } else {
                        await navigator.clipboard.writeText(res.signingUrl);
                        toast.success('Enlace seguro de firma copiado al portapapeles');
                      }
                    }}
                    className="btn-secondary flex items-center gap-2"
                    title="Copiar enlace directo del portal de firma (solo Backoffice / Admin)"
                  >
                    <Copy size={15} />
                    <span className="hidden md:inline">Copiar Enlace Firma</span>
                  </button>
                )}
                <button
                  onClick={async () => {
                    setIsSendingSignature(true);
                    const t = toast.loading('Reenviando invitación de firma...');
                    const res = await resendSignatureEnvelopeAction(initialContract.id);
                    setIsSendingSignature(false);
                    if (res.error) toast.error(res.error, { id: t });
                    else {
                      toast.success('Invitación de firma reenviada al cliente', { id: t });
                      router.refresh();
                    }
                  }}
                  disabled={isSendingSignature}
                  className="btn-secondary flex items-center gap-2"
                  title="Reenviar email y SMS de firma digital al cliente"
                >
                  <Send size={15} />
                  <span className="hidden md:inline">Reenviar Firma</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      if (!confirm('¿Desea anular el sobre de firma pendiente y devolver el contrato a Borrador?')) return;
                      const t = toast.loading('Anulando sobre de firma...');
                      const res = await cancelSignatureEnvelopeAction(initialContract.id);
                      if (res.error) toast.error(res.error, { id: t });
                      else {
                        toast.success('Sobre anulado. Contrato devuelto a Borrador.', { id: t });
                        router.refresh();
                      }
                    }}
                    className="btn-secondary flex items-center gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                    title="Anular sobre pendiente y volver a estado Borrador"
                  >
                    <Ban size={15} />
                    <span className="hidden xl:inline">Anular Firma</span>
                  </button>
                )}
              </>
            )}

            {isAdmin && versions && versions.length > 1 && initialContract.id === versions[0].id && (
              <button
                onClick={async () => {
                  if (
                    confirm(
                      '¿Estás seguro de que quieres eliminar esta última versión y volver a la versión anterior? Los documentos y registros enlazados se conservarán en la versión previa.'
                    )
                  ) {
                    setIsDeletingVersion(true);
                    const loadingToast = toast.loading('Eliminando última versión...');
                    const res = await deleteLatestVersionAction(initialContract.id);
                    setIsDeletingVersion(false);
                    if (res.error) {
                      toast.error(res.error, { id: loadingToast });
                    } else if (res.previousVersionId) {
                      toast.success('Versión eliminada correctamente', { id: loadingToast });
                      router.push(`/contratos/${res.previousVersionId}`);
                    }
                  }
                }}
                disabled={isDeletingVersion}
                className="btn-secondary flex items-center gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
                title="Elimina esta versión y vuelve a la anterior"
              >
                {isDeletingVersion ? <RefreshCw size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                <span className="hidden md:inline">{isDeletingVersion ? 'Eliminando...' : 'Versión anterior'}</span>
              </button>
            )}

            {versions && versions.length > 1 && (
              <select
                className="form-input text-xs py-1 px-2 h-auto"
                value={initialContract.id}
                onChange={(e) => {
                  if (e.target.value !== initialContract.id) {
                    router.push(`/contratos/${e.target.value}`);
                  }
                }}
                style={{ appearance: 'none', cursor: 'pointer', background: 'var(--bg-elevated)' }}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Versión {v.version} - {formatDateUTC(v.createdAt)} ({v.status})
                  </option>
                ))}
              </select>
            )}

            <div>{getStatusBadge(initialContract.status)}</div>
          </div>
        }
      />

      <div className="max-w-[1400px] w-full mx-auto px-6 py-6 flex flex-col gap-6 min-w-0">
        {/* EXECUTIVE SUMMARY HEADER CARD */}
        <div className="card p-4 md:p-5 border border-[var(--border)] bg-[var(--bg-surface)] animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {/* 1. Contrato & Trámite */}
            <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Código Contrato</span>
                {initialContract.version > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-lime-500/10 text-[var(--lime)] border border-lime-500/20">
                    v{initialContract.version}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-white truncate">
                  {initialContract.contractCode || initialContract.id}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(initialContract.contractCode || initialContract.id, 'Código de contrato')}
                  className="text-gray-400 hover:text-[var(--lime)] transition-colors shrink-0"
                  title="Copiar código"
                >
                  <Copy size={13} />
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-1.5 truncate">
                Trámite: <span className="text-gray-200 font-medium">{initialContract.tramitationType || initialContract.tipo || 'Alta'}</span>
              </div>
            </div>

            {/* 2. CUPS */}
            <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Punto de Suministro (CUPS)</span>
              <div className="flex items-center gap-2">
                {supplyPoint?.id ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/puntos-suministro/${supplyPoint.id}`)}
                    className="font-mono text-xs sm:text-sm font-bold text-[var(--lime)] hover:underline truncate text-left"
                    title="Abrir ficha del Punto de Suministro"
                  >
                    {cupsValue || 'Sin CUPS'}
                  </button>
                ) : (
                  <span className="font-mono text-xs sm:text-sm font-bold text-[var(--lime)] truncate">{cupsValue || 'Sin CUPS'}</span>
                )}
                {cupsValue && (
                  <button
                    type="button"
                    onClick={() => copyText(cupsValue, 'CUPS')}
                    className="text-gray-400 hover:text-[var(--lime)] transition-colors shrink-0"
                    title="Copiar CUPS"
                  >
                    <Copy size={13} />
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1.5 truncate" title={supplyPoint?.address || ''}>
                {supplyPoint?.city ? `${supplyPoint.postalCode || ''} ${supplyPoint.city} (${supplyPoint.province || ''})`.trim() : supplyPoint?.address || 'Sin dirección'}
              </div>
            </div>

            {/* 3. Titular */}
            <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Titular del Suministro</span>
              {client?.id ? (
                <button
                  type="button"
                  onClick={() => router.push(`/clientes/${client.id}`)}
                  className="text-sm font-bold text-indigo-400 hover:text-indigo-300 hover:underline truncate text-left"
                  title="Ir a la ficha del cliente"
                >
                  {titularDisplayName}
                </button>
              ) : (
                <span className="text-sm font-bold text-white truncate">{titularDisplayName}</span>
              )}
              <div className="text-xs text-gray-400 mt-1.5 font-mono">
                NIF/CIF: <span className="text-gray-200">{client.vatNumber || lead.vatNumber || '-'}</span>
              </div>
            </div>

            {/* 4. Producto y Tarifa */}
            <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Producto y Consumo</span>
              <div className="text-sm font-bold text-white truncate" title={initialContract.product?.name || lead.product || ''}>
                {initialContract.product?.name || lead.product || '-'}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs">
                <span className="px-1.5 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border)] font-mono font-bold text-gray-200">
                  {displayTariff}
                </span>
                <span className="text-gray-400">
                  {annualMwh != null ? `${Number(annualMwh).toLocaleString('es-ES', { maximumFractionDigits: 2 })} MWh/año` : 'Sin consumo est.'}
                </span>
              </div>
            </div>

            {/* 5. Vigencia y Trazabilidad */}
            <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex flex-col justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Vigencia / Cartera</span>
              <div className="text-xs text-gray-200">
                Alta: <span className="font-semibold">{initialContract.activationDate ? formatDateUTC(initialContract.activationDate) : 'Pendiente'}</span>
              </div>
              {permanenceRemainingInfo ? (
                <div className={`text-xs mt-1 ${permanenceRemainingInfo.tone}`}>{permanenceRemainingInfo.text}</div>
              ) : (
                <div className="text-xs text-gray-400 mt-1 truncate">
                  {!isClientRole ? `${initialContract.user?.channel?.name || 'Directo'} · ${initialContract.user?.name || '-'}` : 'Suministro eléctrico'}
                </div>
              )}
            </div>
          </div>

          {/* Trazabilidad rápida: Lead origen / Contrato anterior / Contrato siguiente */}
          {!isClientRole && (lead?.id || initialContract.previousContract?.id || initialContract.nextContract?.id || initialContract.user) && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
              <div className="flex flex-wrap items-center gap-4">
                <span>
                  Canal: <strong className="text-gray-200">{initialContract.user?.channel?.name || lead.source || 'Directo'}</strong>
                </span>
                <span>
                  Comercial: <strong className="text-gray-200">{initialContract.user?.name || initialContract.user?.email || '-'}</strong>
                </span>
                {initialContract.nSolicitud && (
                  <span>
                    Solicitud ATR: <strong className="font-mono text-gray-200">{initialContract.nSolicitud}</strong>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {lead?.id && (
                  <button
                    type="button"
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border)] text-gray-200 transition-colors"
                  >
                    <ExternalLink size={12} className="text-[var(--lime)]" /> Lead Origen
                  </button>
                )}
                {initialContract.previousContract?.id && (
                  <button
                    type="button"
                    onClick={() => router.push(`/contratos/${initialContract.previousContract.id}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border)] text-gray-200 transition-colors"
                    title={`Contrato previo: ${initialContract.previousContract.contractCode || initialContract.previousContract.id}`}
                  >
                    <ArrowLeft size={12} /> Contrato Anterior
                  </button>
                )}
                {initialContract.nextContract?.id && (
                  <button
                    type="button"
                    onClick={() => router.push(`/contratos/${initialContract.nextContract.id}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-lime-500/10 hover:bg-lime-500/20 border border-lime-500/30 text-[var(--lime)] transition-colors"
                    title={`Contrato siguiente / renovación: ${initialContract.nextContract.contractCode || initialContract.nextContract.id}`}
                  >
                    Contrato Siguiente <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* HORIZONTAL TABS */}
        <div className="flex border-b border-[var(--border)] overflow-x-auto no-scrollbar gap-2 pb-[-1px] min-w-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[var(--lime)] text-[var(--lime)] bg-[rgba(222,255,154,0.05)]'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
              {tab.count != null && tab.count > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[11px] bg-white/10 text-gray-200 font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* MODALES */}
        {showModModal && (
          <ModificationModal
            contractId={initialContract.id}
            initialContract={initialContract}
            onClose={() => setShowModModal(false)}
            onSuccess={(newId) => {
              setShowModModal(false);
              router.push(`/contratos/${newId}`);
            }}
            submitAction={createContractModificationAction}
          />
        )}
        {showEditModal && (
          <EditContractModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            contract={{ ...initialContract, signedUrl, draftUrl, annexUrl }}
            onSuccess={() => {
              setShowEditModal(false);
              toast.success('Contrato actualizado correctamente');
              router.refresh();
            }}
          />
        )}
        {isAdmin && isProductModalOpen && initialContract.product && (
          <ProductModal
            product={initialContract.product}
            onClose={() => setIsProductModalOpen(false)}
            onSaved={() => {
              setIsProductModalOpen(false);
              router.refresh();
            }}
          />
        )}

        {/* TAB: DATOS */}
        {activeTab === 'Datos' && (
          <div className="flex flex-col md:flex-row gap-6 items-start min-w-0 w-full">
            {/* VERTICAL TABS */}
            <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 sticky top-6">
              {subTabs.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                    activeSubTab === sub.id
                      ? 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--lime)] shadow-sm'
                      : 'border border-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-elevated)] hover:border-[var(--border)]'
                  }`}
                >
                  <sub.icon size={16} /> {sub.id}
                </button>
              ))}
            </div>

            {/* VERTICAL TAB CONTENT */}
            <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
              {activeSubTab === 'Resumen Histórico' && (
                <div className="animate-fade-in-up">
                  <HistoricalChart invoices={initialContract.historicalInvoices || []} />
                </div>
              )}

              {activeSubTab === 'Datos Administrativos' && (
                <SectionCard title="Datos Administrativos" icon={User} delay={0}>
                  <DataItem label="Tipo de Cliente" value={client.clientType || lead.clientType || 'Empresa'} />
                  {(client.clientType || lead.clientType || '').toLowerCase().includes('física') ||
                  (client.clientType || lead.clientType || '').toLowerCase().includes('fisica') ||
                  String(client.clientType || '').toUpperCase() === 'F' ? (
                    <>
                      <DataItem
                        label="Nombre"
                        value={
                          client?.id ? (
                            <span
                              className="cursor-pointer text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/50"
                              onClick={() => router.push(`/clientes/${client.id}`)}
                            >
                              {getNombreSolo()}
                            </span>
                          ) : (
                            getNombreSolo()
                          )
                        }
                      />
                      <DataItem label="Apellidos" value={getApellidosFull()} />
                    </>
                  ) : (
                    <DataItem
                      label="Razón Social"
                      value={
                        client?.id ? (
                          <span
                            className="cursor-pointer text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/50"
                            onClick={() => router.push(`/clientes/${client.id}`)}
                          >
                            {client.businessName || lead.businessName}
                          </span>
                        ) : (
                          client.businessName || lead.businessName
                        )
                      }
                    />
                  )}
                  <DataItem
                    label="NIF / CIF"
                    value={
                      client?.id ? (
                        <span
                          className="cursor-pointer text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/50 font-mono"
                          onClick={() => router.push(`/clientes/${client.id}`)}
                        >
                          {client.vatNumber || lead.vatNumber}
                        </span>
                      ) : (
                        <span className="font-mono">{client.vatNumber || lead.vatNumber}</span>
                      )
                    }
                  />
                  <DataItem label="CNAE" value={supplyPoint?.cnae || client?.cnae || '-'} />

                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase">Contacto Principal</h3>
                  </div>
                  <DataItem label="Nombre Contacto" value={client.contactName || lead.contactName} />
                  <DataItem label="Apellidos Contacto" value={client.contactLastName || lead.contactLastName} />
                  <DataItem label="Teléfono" value={client.contactPhone || lead.phone} />
                  <DataItem label="Email" value={client.contactEmail || lead.email} />

                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase">Representante Legal</h3>
                  </div>
                  <DataItem label="Nombre Representante" value={client.representativeName || lead.representativeName || client.contactRole} />
                  <DataItem label="NIF Representante" value={client.representativeVat || lead.representativeVat || client.contactVat} />
                  <DataItem label="Email Representante" value={client.representativeEmail || lead.representativeEmail} />
                  <DataItem label="Teléfono Representante" value={client.representativePhone || lead.representativePhone} />

                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase">Datos de Facturación y Cobro</h3>
                  </div>
                  <DataItem label="Domicilio Facturación" value={client.billingAddress || leadData.titularStreet} />
                  <DataItem label="Código Postal" value={client.billingPostalCode || leadData.titularPostalCode} />
                  <DataItem label="Población" value={client.billingCity || leadData.titularCity} />
                  <DataItem label="Provincia" value={client.billingProvince || leadData.titularProvince} />
                  <DataItem
                    label="IBAN Domiciliación"
                    value={
                      initialContract.iban || supplyPoint?.iban || (client as any).iban || (lead as any)?.iban ? (
                        <span className="font-mono">
                          {formatIbanPretty(initialContract.iban || supplyPoint?.iban || (client as any).iban || (lead as any)?.iban)}
                        </span>
                      ) : (
                        '-'
                      )
                    }
                  />
                  <DataItem
                    label="Forma de Pago / SWIFT"
                    value={
                      supplyPoint?.swift || (client as any)?.swift || supplyPoint?.paymentMethod || (initialContract.transferencia ? 'Transferencia' : 'Domiciliación SEPA')
                    }
                  />
                  <DataItem label="¿Factura Papel?" value={client.paperInvoice || leadData.paperInvoice ? 'Sí' : 'No'} />
                  <DataItem label="Email Factura" value={client.invoiceEmail || leadData.invoiceEmail || client.contactEmail || lead.email} />
                </SectionCard>
              )}

              {activeSubTab === 'Datos Contrato' && (
                <>
                  <SectionCard title="Datos del Contrato" icon={FileText} delay={0}>
                    <DataItem
                      label="Código Contrato"
                      value={<span className="font-mono text-gray-300 tracking-wider">{initialContract.contractCode || initialContract.id}</span>}
                    />
                    <DataItem
                      label="Producto"
                      value={
                        initialContract.product ? (
                          isAdmin ? (
                            <span
                              className="cursor-pointer text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-500/50"
                              onClick={() => setIsProductModalOpen(true)}
                            >
                              {initialContract.product.name}
                            </span>
                          ) : (
                            <span>{initialContract.product.name}</span>
                          )
                        ) : (
                          lead.product || '-'
                        )
                      }
                    />
                    <DataItem label="Tipo Tramitación" value={initialContract.tramitationType || initialContract.tipo || 'Alta'} />
                    <DataItem label="Duración / Permanencia (Meses)" value={initialContract.duration ?? initialContract.permanenceMonths ?? initialContract.product?.permanenceMonths ?? '12'} />

                    <DataItem
                      label="Fecha Firma"
                      value={
                        initialContract.signatureDate ||
                        airtableData['Fecha firma'] ||
                        airtableData.fechafirma ||
                        airtableData.fechafirmacontrato ||
                        airtableData['Fecha de firma de contrato']
                          ? formatDateUTC(
                              initialContract.signatureDate ||
                                airtableData['Fecha firma'] ||
                                airtableData.fechafirma ||
                                airtableData.fechafirmacontrato ||
                                airtableData['Fecha de firma de contrato']
                            )
                          : '-'
                      }
                    />
                    <DataItem label="Fecha Solicitud ATR" value={initialContract.requestDate ? formatDateUTC(initialContract.requestDate) : '-'} />
                    <DataItem label="Fecha Aceptación ATR" value={initialContract.fechaAceptacion ? formatDateUTC(initialContract.fechaAceptacion) : '-'} />
                    <DataItem label="Nº Solicitud ATR" value={initialContract.nSolicitud ? <span className="font-mono">{initialContract.nSolicitud}</span> : '-'} />

                    <DataItem label="Fecha Prev. Activación" value={initialContract.fechaPrevistaActivacion ? formatDateUTC(initialContract.fechaPrevistaActivacion) : '-'} />
                    <DataItem highlight label="Fecha Activación" value={initialContract.activationDate ? formatDateUTC(initialContract.activationDate) : '-'} />
                    <DataItem label="Inicio Permanencia" value={initialContract.permanenceStartDate ? formatDateUTC(initialContract.permanenceStartDate) : '-'} />
                    <DataItem label="Fin Previsto / Permanencia" value={initialContract.expectedEndDate ? formatDateUTC(initialContract.expectedEndDate) : '-'} />

                    <DataItem label="Fecha Prev. Baja" value={initialContract.fechaPrevistaBaja ? formatDateUTC(initialContract.fechaPrevistaBaja) : '-'} />
                    <DataItem label="Fecha de Baja" value={initialContract.terminationDate ? formatDateUTC(initialContract.terminationDate) : '-'} />
                    {!isClientRole && (
                      <>
                        <DataItem label="Canal" value={initialContract.user?.channel?.name || lead.source || 'Directo'} />
                        <DataItem label="Agente Comercial" value={initialContract.user?.name || initialContract.user?.email || '-'} />
                      </>
                    )}
                    {!isClientRole && initialContract.bajaProcess && (
                      <DataItem label="Motivo Baja Interna" value={initialContract.bajaProcess} />
                    )}
                    {!isClientRole && initialContract.internalComments && (
                      <DataItem colSpan={2} label="Observaciones Internas" value={initialContract.internalComments} />
                    )}
                    {!isClientRole && initialContract.distributorMsg && (
                      <DataItem colSpan={2} label="Mensaje Distribuidora" value={initialContract.distributorMsg} />
                    )}
                  </SectionCard>

                  <SectionCard title="Servicios de Valor Añadido (SVA)" icon={Settings} delay={100}>
                    {resolvedAdditionalServices.length > 0 ? (
                      resolvedAdditionalServices.map((srv, idx) => (
                        <DataItem
                          key={`${srv.name}-${idx}`}
                          highlight
                          label={srv.name}
                          value={`${srv.priceLabel}${srv.duration ? ` · ${srv.duration} meses` : ''}`}
                        />
                      ))
                    ) : (
                      <>
                        <DataItem label="Concepto SVA" value={getSvaName()} />
                        <DataItem
                          label="Precio SVA"
                          value={
                            initialContract.svaPrice != null || initialContract.preciofromSERVICIOS
                              ? `€ ${initialContract.svaPrice ?? initialContract.preciofromSERVICIOS}`
                              : '-'
                          }
                        />
                        <DataItem label="Duración SVA (Meses)" value={initialContract.svaDuration || '-'} />
                        <DataItem label="Inicio SVA" value={initialContract.svaStartDate ? formatDateUTC(initialContract.svaStartDate) : '-'} />
                      </>
                    )}
                  </SectionCard>
                </>
              )}

              {activeSubTab === 'Datos Técnicos CUPS' && (
                <SectionCard title="Datos Técnicos del Punto de Suministro" icon={Zap} delay={0}>
                  <DataItem
                    highlight
                    label="CUPS"
                    value={
                      supplyPoint?.id ? (
                        <span
                          className="font-mono tracking-widest cursor-pointer hover:underline underline-offset-2"
                          onClick={() => router.push(`/puntos-suministro/${supplyPoint.id}`)}
                        >
                          {supplyPoint.cups || lead.cups}
                        </span>
                      ) : (
                        <span className="font-mono tracking-widest">{supplyPoint.cups || lead.cups}</span>
                      )
                    }
                  />
                  <DataItem label="Tarifa" value={<span className="font-mono font-bold text-gray-200">{displayTariff}</span>} />
                  <DataItem
                    label="Consumo Anual Estimado (MWh)"
                    value={
                      annualMwh != null ? Number(annualMwh).toLocaleString('es-ES', { maximumFractionDigits: 3 }) : '-'
                    }
                  />
                  <DataItem
                    label="Distribuidora"
                    value={
                      supplyPoint.distributorName
                        ? supplyPoint.distributorName.replace(/^\[.*?\]\s*/, '')
                        : supplyPoint.distributor
                        ? supplyPoint.distributor.replace(/^\[.*?\]\s*/, '')
                        : '-'
                    }
                  />

                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase">Dirección de Suministro</h3>
                  </div>
                  <DataItem
                    label="Dirección"
                    value={
                      leadData.direccionSuministro || leadData.direccion
                        ? `${(leadData.direccionSuministro || leadData.direccion).tipoVia || ''} ${(leadData.direccionSuministro || leadData.direccion).nombreVia || ''} ${(leadData.direccionSuministro || leadData.direccion).tipoNumeracion || ''} ${(leadData.direccionSuministro || leadData.direccion).numKm || ''} ${(leadData.direccionSuministro || leadData.direccion).adicional || ''}`.trim()
                        : supplyPoint.address || leadData.address || '-'
                    }
                  />
                  <DataItem label="Código Postal" value={supplyPoint.postalCode} />
                  <DataItem label="Población" value={supplyPoint.city} />
                  <DataItem label="Provincia" value={supplyPoint.province} />

                  <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-4 mb-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase">Potencias Contratadas (kW)</h3>
                  </div>
                  <DataItem label="P1C" value={initialContract.p1c ?? (initialContract.airtableData as any)?.p1c ?? supplyPoint.p1c ?? leadData.p1c ?? supplyPoint.p1p ?? '-'} />
                  <DataItem label="P2C" value={initialContract.p2c ?? (initialContract.airtableData as any)?.p2c ?? supplyPoint.p2c ?? leadData.p2c ?? supplyPoint.p2p ?? '-'} />
                  {displayTariff !== '2.0TD' && displayTariff !== '2.0 A' && (
                    <>
                      <DataItem label="P3C" value={initialContract.p3c ?? (initialContract.airtableData as any)?.p3c ?? supplyPoint.p3c ?? leadData.p3c ?? supplyPoint.p3p ?? '-'} />
                      <DataItem label="P4C" value={initialContract.p4c ?? (initialContract.airtableData as any)?.p4c ?? supplyPoint.p4c ?? leadData.p4c ?? supplyPoint.p4p ?? '-'} />
                      <DataItem label="P5C" value={initialContract.p5c ?? (initialContract.airtableData as any)?.p5c ?? supplyPoint.p5c ?? leadData.p5c ?? supplyPoint.p5p ?? '-'} />
                      <DataItem label="P6C" value={initialContract.p6c ?? (initialContract.airtableData as any)?.p6c ?? supplyPoint.p6c ?? leadData.p6c ?? supplyPoint.p6p ?? '-'} />
                    </>
                  )}
                </SectionCard>
              )}

              {activeSubTab === 'Datos Económicos Contrato' && (
                <>
                  <SectionCard title="Información Comercial del Contrato" icon={FileText} delay={0}>
                    <DataItem
                      highlight
                      label="Producto Contratado"
                      value={
                        initialContract.product ? (
                          isAdmin ? (
                            <span className="cursor-pointer hover:underline underline-offset-2" onClick={() => setIsProductModalOpen(true)}>
                              {initialContract.product.name}
                            </span>
                          ) : (
                            <span>{initialContract.product.name}</span>
                          )
                        ) : (
                          lead.product || '-'
                        )
                      }
                    />
                    <DataItem
                      label="Modelo de Precio"
                      value={isIndexedContract ? 'Indexado (Pass-Through OMIE)' : initialContract.product?.type || 'Precio Fijo'}
                    />
                    <DataItem highlight label="Servicio de Valor Añadido (SVA)" value={resolvedAdditionalServices.length > 0 ? resolvedAdditionalServices.map((s) => s.name).join(', ') : getSvaName()} />
                    <DataItem label="Bolsillo Solar" value={initialContract.bolsilloSolar ? 'Sí' : 'No'} />
                  </SectionCard>

                  <SectionCard title="Precios de Energía Activa (€/kWh)" icon={Wallet} delay={50}>
                    <DataItem label="P1E" value={pricesDisplay.p1E} />
                    <DataItem label="P2E" value={pricesDisplay.p2E} />
                    <DataItem label="P3E" value={pricesDisplay.p3E} />
                    {displayTariff !== '2.0TD' && displayTariff !== '2.0 A' && (
                      <>
                        <DataItem label="P4E" value={pricesDisplay.p4E} />
                        <DataItem label="P5E" value={pricesDisplay.p5E} />
                        <DataItem label="P6E" value={pricesDisplay.p6E} />
                      </>
                    )}
                  </SectionCard>

                  <SectionCard title="Precios de Potencia (€/kW/día)" icon={Zap} delay={50}>
                    <DataItem label="P1P" value={pricesDisplay.p1P} />
                    <DataItem label="P2P" value={pricesDisplay.p2P} />
                    {displayTariff !== '2.0TD' && displayTariff !== '2.0 A' && (
                      <>
                        <DataItem label="P3P" value={pricesDisplay.p3P} />
                        <DataItem label="P4P" value={pricesDisplay.p4P} />
                        <DataItem label="P5P" value={pricesDisplay.p5P} />
                        <DataItem label="P6P" value={pricesDisplay.p6P} />
                      </>
                    )}
                  </SectionCard>

                  {/* Autoconsumo y Excedentes (visible para todos los roles cuando aplica) */}
                  {(initialContract.autoconsumo ||
                    supplyPoint?.hasSelfConsumption ||
                    initialContract.pexc != null ||
                    initialContract.feeExcedentes != null ||
                    initialContract.bolsilloSolar) && (
                    <SectionCard title="Condiciones de Autoconsumo y Bolsillo Solar" icon={Battery} delay={100}>
                      <DataItem label="Precio Excedentes Fijo" value={initialContract.pexc != null ? `${initialContract.pexc} €/MWh` : '-'} />
                      <DataItem label="Fee Excedentes Index" value={initialContract.feeExcedentes != null ? `${initialContract.feeExcedentes} €/MWh` : '-'} />
                      <DataItem label="CG Bolsillo Solar" value={initialContract.cgBolsilloSolar != null ? `${initialContract.cgBolsilloSolar} €/día` : '-'} />
                    </SectionCard>
                  )}

                  {/* Comisiones y Márgenes (NUNCA visible para rol CLIENT) */}
                  {!isClientRole && (
                    <SectionCard title={isAdmin ? 'Márgenes, Costes de Gestión y Comisiones' : 'Fee y Liquidación de Comisiones'} icon={Banknote} delay={150}>
                      {isIndexedContract && (
                        <DataItem
                          highlight
                          label="Fee Index Comercial"
                          value={pricesDisplay.fee != null ? `${pricesDisplay.fee} €/MWh` : '-'}
                        />
                      )}
                      {isAdmin && (
                        <>
                          <DataItem label="Coste Desvíos" value={initialContract.deviationCost != null ? `${initialContract.deviationCost} €/MWh` : '-'} />
                          <DataItem label="Margen Interno FC Snapshot" value={initialContract.marginFC != null ? `${initialContract.marginFC}` : '-'} />
                        </>
                      )}
                      <DataItem
                        label="Comisión Estimada (Base)"
                        value={initialContract.commissionBase != null ? `€ ${Number(initialContract.commissionBase).toFixed(2)}` : '€ 0.00'}
                      />
                      <DataItem
                        highlight
                        label="Comisión Final"
                        value={initialContract.commissionFinal != null ? `€ ${Number(initialContract.commissionFinal).toFixed(2)}` : '€ 0.00'}
                      />
                      {initialContract.commissionRecord && (
                        <DataItem
                          label="Estado Liquidación Comisión"
                          value={
                            <span className="font-semibold">
                              {initialContract.commissionRecord.status} (
                              {Number(initialContract.commissionRecord.amount || 0).toLocaleString('es-ES', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              €)
                            </span>
                          }
                        />
                      )}
                      {isAdmin && (initialContract.calculatedPenalty != null || initialContract.penalization != null) && (
                        <DataItem
                          label="Penalización Calculada"
                          value={`€ ${Number(initialContract.calculatedPenalty ?? initialContract.penalization ?? 0).toFixed(2)}${
                            initialContract.penaltyStatus ? ` (${initialContract.penaltyStatus})` : ''
                          }`}
                        />
                      )}
                    </SectionCard>
                  )}

                  <SectionCard title="Descuentos Aplicados" icon={CheckCircle} delay={200}>
                    <DataItem label="Descuento (€)" value={initialContract.discountPrice != null ? `€ ${initialContract.discountPrice}` : '-'} />
                    <DataItem label="Fecha Inicio Descuento" value={initialContract.discountStartDate ? formatDateUTC(initialContract.discountStartDate) : '-'} />
                    <DataItem label="Fecha Fin Descuento" value={initialContract.discountEndDate ? formatDateUTC(initialContract.discountEndDate) : '-'} />
                  </SectionCard>
                </>
              )}

              {activeSubTab === 'Catastro' && (
                <SectionCard title="Información Catastral" icon={MapPin} delay={0}>
                  <DataItem highlight label="Referencia Catastral" value={supplyPoint.cadastralReference || '-'} />
                  <DataItem label="Provincia Catastro" value={supplyPoint.cadastreProvince || '-'} />
                  <DataItem label="Municipio Catastro" value={supplyPoint.cadastreCity || '-'} />
                  <DataItem label="Tipo Vía" value={supplyPoint.cadastreStreetType || '-'} />
                  <DataItem label="Nombre Vía" value={supplyPoint.cadastreAddress || '-'} />
                  <DataItem label="Número" value={supplyPoint.cadastreNumber || '-'} />
                  <DataItem label="Bloque" value={supplyPoint.cadastreBlock || '-'} />
                  <DataItem label="Planta" value={supplyPoint.cadastreFloor || '-'} />
                  <DataItem label="Puerta" value={supplyPoint.cadastreDoor || '-'} />
                </SectionCard>
              )}

              {activeSubTab === 'Datos CAU' && (
                <SectionCard title="Código de Autoconsumo (CAU)" icon={Battery} delay={0}>
                  <DataItem highlight label="CAU" value={supplyPoint.cau || airtableData.cau || '-'} />
                  <DataItem label="Tipo Autoconsumo" value={supplyPoint.cauType || supplyPoint.selfConsumptionType || airtableData.selfConsumptionType || '-'} />
                  <DataItem label="Subtipo" value={supplyPoint.cauSubtype || airtableData.cauSubtype || '-'} />
                  <DataItem label="Colectivo" value={supplyPoint.cauCollective || airtableData.cauCollective || '-'} />
                  <DataItem label="CIL" value={supplyPoint.cil || airtableData.cil || '-'} />
                  <DataItem label="CIE Autoconsumo" value={supplyPoint.cieSelfConsumption || '-'} />
                  <DataItem label="CIE Consumo" value={supplyPoint.cie || '-'} />
                  <DataItem label="Tecnología Generador" value={supplyPoint.generatorTechnology || airtableData.generatorTechnology || '-'} />
                  <DataItem label="Potencia Instalada Generación (kW)" value={supplyPoint.installedPowerGen || airtableData.installedPowerGen || '-'} />
                  <DataItem
                    label="Tipo de Instalación"
                    value={
                      supplyPoint.installationType || airtableData.installationType
                        ? String(supplyPoint.installationType || airtableData.installationType).padStart(2, '0')
                        : '-'
                    }
                  />
                  <DataItem label="Esquema de Medida" value={supplyPoint.meteringScheme || airtableData.meteringScheme || '-'} />
                </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* TAB: DOCUMENTACIÓN */}
        {activeTab === 'Documentación' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border)]">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FolderOpen className="text-[var(--lime)]" size={20} /> Documentos Contractuales
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Borradores generados, Documento Resumen RD 88/2026, contratos sellados PAdES y evidencias del expediente.
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    className="btn-secondary flex items-center gap-2 text-xs"
                  >
                    <Upload size={14} /> Subir / Reemplazar PDF
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    title: 'Contrato Firmado (PAdES)',
                    subtitle: 'Documento contractual con validez legal y sello criptográfico',
                    url: signedUrl,
                    emptyText: 'Aún no consta PDF firmado',
                  },
                  {
                    title: 'Documento Resumen (RD 88/2026)',
                    subtitle: latestEnvelope?.signedSummaryPdfUrl
                      ? 'Resumen precontractual aceptado y sellado'
                      : 'Resumen precontractual independiente previo',
                    url: summaryDocUrl,
                    emptyText: 'Sin resumen precontractual',
                  },
                  {
                    title: 'Borrador de Contrato',
                    subtitle: 'PDF generado con cláusulas modulares antes de la firma',
                    url: draftUrl,
                    emptyText: 'Sin borrador generado',
                  },
                  {
                    title: 'Certificado de Evidencias',
                    subtitle: 'Audit Trail encadenado SHA-256 eIDAS / RD 88/2026',
                    url: auditTrailUrl,
                    emptyText: 'Se genera automáticamente al completar la firma',
                  },
                  {
                    title: 'Anexo / Modificación Firmada',
                    subtitle: 'Subrogación, cambio técnico o autoconsumo',
                    url: annexUrl,
                    emptyText: 'Sin anexo asociado',
                  },
                ].map((docCard) => (
                  <div
                    key={docCard.title}
                    className={`p-5 rounded-xl border flex flex-col justify-between gap-4 ${
                      docCard.url
                        ? 'bg-[rgba(163,230,53,0.04)] border-lime-500/30'
                        : 'bg-[var(--bg-elevated)] border-[var(--border)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-white text-sm">{docCard.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            docCard.url
                              ? 'bg-lime-500/15 text-[var(--lime)] border border-lime-500/30'
                              : 'bg-white/5 text-gray-400 border border-white/10'
                          }`}
                        >
                          {docCard.url ? 'Disponible' : 'No adjunto'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{docCard.subtitle}</p>
                    </div>

                    {docCard.url ? (
                      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                        <a
                          href={docCard.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={13} /> Abrir
                        </a>
                        <a
                          href={buildDownloadUrl(docCard.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 px-3 rounded-lg bg-[var(--lime)] hover:bg-[#c9f07a] text-xs font-bold text-black flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Download size={13} /> Descargar
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 italic pt-2 border-t border-white/5">{docCard.emptyText}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {latestEnvelope && (
              <div className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FileCheck size={18} className="text-[var(--lime)]" /> Trazabilidad de Firma Digital (eIDAS / RD 88/2026)
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Sobre <span className="font-mono text-gray-200 font-semibold">{latestEnvelope.envelopeCode}</span> · Firmante:{' '}
                      {latestEnvelope.signerName} ({latestEnvelope.signerNif}) · {latestEnvelope.signerEmail}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        latestEnvelope.status === 'SIGNED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : latestEnvelope.status === 'CANCELLED' || latestEnvelope.status === 'EXPIRED'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {latestEnvelope.status}
                    </span>
                    <a
                      href={`/verificar-firma/${encodeURIComponent(latestEnvelope.envelopeCode)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <ExternalLink size={13} /> Verificador Público
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-xs">
                  <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <span className="text-gray-400 uppercase font-semibold block mb-1">T1 · Aceptación Resumen RD 88/2026</span>
                    <span className="text-white font-semibold">
                      {latestEnvelope.summaryAcceptedAt
                        ? new Date(latestEnvelope.summaryAcceptedAt).toLocaleString('es-ES')
                        : 'Pendiente de lectura por el cliente'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <span className="text-gray-400 uppercase font-semibold block mb-1">T2 · Método de Firma</span>
                    <span className="text-white font-semibold">
                      {latestEnvelope.signatureMethod === 'QUALIFIED_CERT_UPLOAD'
                        ? 'Certificado Electrónico Cualificado X.509'
                        : latestEnvelope.signatureMethod === 'OTP_PADES'
                        ? `Firma Avanzada OTP (${latestEnvelope.otpChannel || 'Email'}) + Rúbrica`
                        : latestEnvelope.allowCertUploadFallback
                        ? 'OTP + Rúbrica (Principal) / Cert. X.509 (Opcional B2B)'
                        : 'OTP + Rúbrica + Sello PAdES'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <span className="text-gray-400 uppercase font-semibold block mb-1">T3 · Sellado PAdES / Fecha Firma</span>
                    <span className="text-white font-semibold">
                      {latestEnvelope.signedAt
                        ? new Date(latestEnvelope.signedAt).toLocaleString('es-ES')
                        : `Expira el ${new Date(latestEnvelope.expiresAt).toLocaleDateString('es-ES')}`}
                    </span>
                  </div>
                </div>

                {Array.isArray(latestEnvelope.auditEvents) && latestEnvelope.auditEvents.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-400 uppercase text-[11px]">
                          <th className="py-2 px-3">Fecha / Hora</th>
                          <th className="py-2 px-3">Evento</th>
                          <th className="py-2 px-3">IP / Origen</th>
                          <th className="py-2 px-3">Hash Cadena SHA-256</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestEnvelope.auditEvents.map((ev: any) => (
                          <tr key={ev.id} className="border-b border-[var(--border)]">
                            <td className="py-2 px-3 font-mono text-gray-300 whitespace-nowrap">
                              {new Date(ev.createdAt).toLocaleString('es-ES')}
                            </td>
                            <td className="py-2 px-3 font-semibold text-white">{ev.eventType}</td>
                            <td className="py-2 px-3 text-gray-400 font-mono">{ev.ipAddress || 'Servidor'}</td>
                            <td className="py-2 px-3 font-mono text-gray-400">{String(ev.eventHash || '').slice(0, 18)}...</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText size={18} className="text-gray-400" /> Expediente Documental Completo (Cliente, CUPS y Lead)
                </h3>
                <span className="text-xs text-gray-400">{expedienteDocuments.length} archivos</span>
              </div>

              {expedienteDocuments.length === 0 ? (
                <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg text-sm">
                  No hay documentos adicionales registrados en el expediente de este cliente o suministro.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-xs uppercase text-gray-400">
                        <th className="py-3 px-4 font-semibold">Documento</th>
                        <th className="py-3 px-4 font-semibold">Tipo</th>
                        <th className="py-3 px-4 font-semibold">Origen</th>
                        <th className="py-3 px-4 font-semibold">Fecha</th>
                        <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expedienteDocuments.map((doc) => (
                        <tr key={doc.id} className="border-b border-[var(--border)] hover:bg-white/[0.02] text-sm">
                          <td className="py-3 px-4 text-white font-medium">{doc.name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-mono text-gray-300">
                              {doc.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-400">{doc.origin}</td>
                          <td className="py-3 px-4 text-xs text-gray-400">{doc.createdAt ? formatDateUTC(doc.createdAt) : '-'}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-3">
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-gray-300 hover:text-white inline-flex items-center gap-1"
                              >
                                <ExternalLink size={13} /> Ver
                              </a>
                              <a
                                href={buildDownloadUrl(doc.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-[var(--lime)] hover:underline inline-flex items-center gap-1 font-semibold"
                              >
                                <Download size={13} /> Descargar
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: FACTURACIÓN */}
        {activeTab === 'Facturación' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Banknote className="text-gray-400" /> Facturas del Contrato
                </h2>
                {initialContract.invoices?.length > 0 && (
                  <span className="text-xs text-gray-400">{initialContract.invoices.length} facturas emitidas</span>
                )}
              </div>

              {!initialContract.invoices || initialContract.invoices.length === 0 ? (
                <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
                  No hay facturas emitidas para este contrato.
                </div>
              ) : (
                <>
                  {/* Mobile View Facturas */}
                  <div className="block md:hidden">
                    <div className="flex flex-col gap-3">
                      {initialContract.invoices.map((inv: any) => {
                        const startDist = inv.billingStart || inv.invoiceData?.Desde || inv.desde;
                        const endDist = inv.billingEnd || inv.invoiceData?.Hasta || inv.hasta;
                        const isAbono = (inv.totalAmount || 0) < 0 || String(inv.invoiceType || '').toUpperCase().includes('ABONO');
                        const stateLabel = inv.paymentDate ? 'Cobrada' : inv.communicatedAt ? 'Comunicada' : 'Emitida';
                        const stateClass = inv.paymentDate
                          ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]'
                          : inv.communicatedAt
                          ? 'bg-[rgba(59,130,246,0.15)] text-blue-400 border border-[rgba(59,130,246,0.3)]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-300';

                        return (
                          <div key={inv.id} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-mono text-[var(--lime)] font-bold mb-1">{inv.invoiceNumber}</div>
                                <div className="text-sm text-gray-300">Emisión: {formatDateUTC(inv.issueDate)}</div>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-bold ${stateClass}`}>{stateLabel}</span>
                            </div>

                            <div className="flex flex-col gap-1 text-xs">
                              <div className="text-gray-400">
                                <span className="text-gray-500">Periodo:</span> {startDist ? formatDateUTC(startDist) : '-'} al{' '}
                                {endDist ? formatDateUTC(endDist) : '-'}
                              </div>
                              <div className="text-gray-400">
                                <span className="text-gray-500">Consumo:</span>{' '}
                                {inv.totalMWh != null
                                  ? `${Number(inv.totalMWh).toLocaleString('es-ES', { maximumFractionDigits: 2 })} kWh`
                                  : '-'}
                              </div>
                            </div>

                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-strong)]">
                              <div className={`text-base font-bold ${isAbono ? 'text-amber-400' : 'text-[var(--lime)]'}`}>
                                {(inv.totalAmount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </div>
                              <div className="flex items-center gap-2">
                                {inv.pdfUrl && (
                                  <a
                                    href={buildDownloadUrl(inv.pdfUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-white/5 border border-[var(--border)] rounded px-2.5 py-1.5 text-xs text-[var(--lime)] flex items-center gap-1"
                                  >
                                    <Download size={12} /> PDF
                                  </a>
                                )}
                                <a
                                  href={`/facturas/${inv.id}`}
                                  className="bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white"
                                >
                                  Ver Detalle
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Desktop View Facturas */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-800 text-left text-xs uppercase text-gray-400">
                          <th className="py-3 px-4 font-semibold">Número</th>
                          <th className="py-3 px-4 font-semibold">Tipo</th>
                          <th className="py-3 px-4 font-semibold">Emisión</th>
                          <th className="py-3 px-4 font-semibold">Periodo Facturado</th>
                          <th className="py-3 px-4 font-semibold text-right">Consumo</th>
                          <th className="py-3 px-4 font-semibold text-right">Total</th>
                          <th className="py-3 px-4 font-semibold">Estado</th>
                          <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {initialContract.invoices.map((inv: any) => {
                          const startDist = inv.billingStart || inv.invoiceData?.Desde || inv.desde;
                          const endDist = inv.billingEnd || inv.invoiceData?.Hasta || inv.hasta;
                          const isAbono = (inv.totalAmount || 0) < 0 || String(inv.invoiceType || '').toUpperCase().includes('ABONO');
                          const stateLabel = inv.paymentDate ? 'Cobrada' : inv.communicatedAt ? 'Comunicada' : 'Emitida';
                          const stateClass = inv.paymentDate
                            ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]'
                            : inv.communicatedAt
                            ? 'bg-[rgba(59,130,246,0.15)] text-blue-400 border border-[rgba(59,130,246,0.3)]'
                            : 'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-300';

                          return (
                            <tr key={inv.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                              <td className="py-3 px-4 font-mono text-sm text-gray-200 font-semibold">{inv.invoiceNumber}</td>
                              <td className="py-3 px-4 text-xs text-gray-400">
                                <span className={`px-2 py-0.5 rounded font-semibold ${isAbono ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-gray-300'}`}>
                                  {inv.invoiceType || (isAbono ? 'ABONO' : 'FACTURA')}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-300">{formatDateUTC(inv.issueDate)}</td>
                              <td className="py-3 px-4 text-sm text-gray-400">
                                {startDist ? formatDateUTC(startDist) : '-'} al {endDist ? formatDateUTC(endDist) : '-'}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-300 text-right font-mono">
                                {inv.totalMWh != null
                                  ? `${Number(inv.totalMWh).toLocaleString('es-ES', { maximumFractionDigits: 2 })} kWh`
                                  : '-'}
                              </td>
                              <td className={`py-3 px-4 text-sm font-bold text-right font-mono ${isAbono ? 'text-amber-400' : 'text-[var(--lime)]'}`}>
                                {(inv.totalAmount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold max-w-max ${stateClass}`}>{stateLabel}</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-3">
                                  {inv.pdfUrl && (
                                    <a
                                      href={buildDownloadUrl(inv.pdfUrl)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[var(--lime)] hover:underline text-xs font-semibold inline-flex items-center gap-1"
                                      title="Descargar Factura PDF"
                                    >
                                      <Download size={13} /> PDF
                                    </a>
                                  )}
                                  <a href={`/facturas/${inv.id}`} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                                    Ver Detalle
                                  </a>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Facturas de Penalización (si existen, para roles autorizados) */}
            {isAdmin && initialContract.penaltyInvoices?.length > 0 && (
              <div className="card p-6">
                <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border)]">
                  <ShieldAlert size={18} className="text-amber-400" /> Facturas de Penalización Asociadas
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-xs uppercase text-gray-400">
                        <th className="py-2.5 px-4">Nº Factura</th>
                        <th className="py-2.5 px-4">Emisión</th>
                        <th className="py-2.5 px-4">Estado</th>
                        <th className="py-2.5 px-4">Cobro</th>
                        <th className="py-2.5 px-4 text-right">Importe</th>
                        <th className="py-2.5 px-4 text-right">PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialContract.penaltyInvoices.map((pi: any) => (
                        <tr key={pi.id} className="border-b border-[var(--border)]">
                          <td className="py-2.5 px-4 font-mono text-white">{pi.invoiceNumber}</td>
                          <td className="py-2.5 px-4 text-gray-300">{formatDateUTC(pi.issueDate)}</td>
                          <td className="py-2.5 px-4 text-gray-300">{pi.status}</td>
                          <td className="py-2.5 px-4 text-gray-300">{pi.paymentStatus}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-400">
                            {Number(pi.amount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {pi.pdfUrl ? (
                              <a
                                href={buildDownloadUrl(pi.pdfUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-[var(--lime)] hover:underline inline-flex items-center gap-1"
                              >
                                <Download size={13} /> PDF
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: SIPS */}
        {activeTab === 'Sips' && (
          <div className="card p-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Search className="text-gray-400" /> Datos SIPS ({cupsValue || 'Sin CUPS'})
              </h2>
              <button
                disabled={isUpdatingSips || !supplyPoint?.id}
                onClick={async () => {
                  if (!supplyPoint?.id) {
                    toast.error('Este contrato no tiene un punto de suministro vinculado');
                    return;
                  }
                  setIsUpdatingSips(true);
                  const loadingToast = toast.loading('Consultando nuestro motor SIPS...');
                  try {
                    const { updateSupplyPointSipsAction } = await import('@/app/actions/supplyPointActions');
                    const res = await updateSupplyPointSipsAction(supplyPoint.id);
                    if (res.success) {
                      toast.success('Datos SIPS actualizados correctamente', { id: loadingToast });
                      setSipsRawData(res.sipsData);
                      router.refresh();
                    } else {
                      toast.error(res.error || 'Error al actualizar SIPS', { id: loadingToast });
                    }
                  } catch (e: any) {
                    toast.error('Error al actualizar SIPS', { id: loadingToast });
                  } finally {
                    setIsUpdatingSips(false);
                  }
                }}
                className="btn-primary flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                <RefreshCw size={16} className={isUpdatingSips ? 'animate-spin' : ''} />
                {isUpdatingSips ? 'Consultando SIPS...' : 'Actualizar Datos SIPS'}
              </button>
            </div>

            {sipsRawData ? (
              (() => {
                const raw: any = sipsRawData;
                const periodos = [1, 2, 3, 4, 5, 6];

                // Soporte dual: Motor SIPS Propio (p1..p6, c1..c6, raw) + Formato histórico Ingebau (data.ps[0])
                const isNativeSips = Boolean(raw.cups || raw.tariff || raw.p1 !== undefined || raw.raw);

                const powers: Record<number, any> = {};
                const consumptions: Record<number, any> = {};
                let generalEntries: Array<[string, any]> = [];
                let sipsTariffVal: string | null = null;

                if (isNativeSips) {
                  sipsTariffVal = raw.tariff || null;
                  periodos.forEach((p) => {
                    powers[p] = raw[`p${p}`] ?? null;
                    consumptions[p] = raw[`c${p}`] ?? null;
                  });

                  const summaryPairs: Array<[string, any]> = [
                    ['CUPS', raw.cups],
                    ['Distribuidora', raw.distributor],
                    ['Tarifa SIPS', raw.tariff],
                    ['Consumo Anual Total (kWh)', raw.annualConsumption != null ? Number(raw.annualConsumption).toLocaleString('es-ES') : null],
                    ['CNAE', raw.cnae],
                    ['Código Postal', raw.postalCode],
                    ['Municipio', raw.city],
                    ['Provincia', raw.province],
                    ['Dirección SIPS', raw.address],
                    ['BIE / Maxímetro (kW)', raw.maxBiePower],
                    ['Derechos Extensión (kW)', raw.extensionRights],
                    ['Derechos Acceso (kW)', raw.accessRights],
                  ];

                  // Añadir campos extra de raw.raw si existen
                  if (raw.raw && typeof raw.raw === 'object') {
                    for (const [k, v] of Object.entries(raw.raw)) {
                      if (v !== null && v !== undefined && v !== '' && typeof v !== 'object') {
                        if (!summaryPairs.some(([label]) => label.toLowerCase() === k.toLowerCase())) {
                          summaryPairs.push([k, v]);
                        }
                      }
                    }
                  }

                  generalEntries = summaryPairs.filter(([, v]) => v !== null && v !== undefined && v !== '');
                } else {
                  let psData: any = null;
                  if (raw.data?.ps?.length > 0) psData = raw.data.ps[0];
                  else if (raw.ps?.length > 0) psData = raw.ps[0];
                  else if (raw.CUPS || raw.CNAE) psData = raw;

                  if (!psData) {
                    return (
                      <div className="bg-black/50 p-4 rounded-xl border border-white/5 overflow-x-auto">
                        <pre className="text-xs text-lime-400 font-mono">{JSON.stringify(sipsRawData, null, 2)}</pre>
                      </div>
                    );
                  }

                  sipsTariffVal = psData.TarifaATR || psData.tarifa || null;
                  periodos.forEach((p) => {
                    powers[p] = psData[`PotenciaContratadaP${p}kW`] ?? null;
                    consumptions[p] = psData[`ConsumoAnualP${p}kWh`] ?? null;
                  });

                  const powerKeys = periodos.flatMap((p) => [`ConsumoAnualP${p}kWh`, `PotenciaContratadaP${p}kW`]);
                  generalEntries = Object.entries(psData).filter(
                    ([key, value]) => typeof value !== 'object' && value !== null && value !== '' && !powerKeys.includes(key)
                  );
                }

                // Detectar discrepancia entre tarifa/potencias del contrato y SIPS
                const contractP1 = Number(initialContract.p1c ?? supplyPoint?.p1c ?? NaN);
                const sipsP1 = Number(powers[1] ?? NaN);
                const hasPowerDiff = !isNaN(contractP1) && !isNaN(sipsP1) && Math.abs(contractP1 - sipsP1) > 0.05;
                const hasTariffDiff =
                  sipsTariffVal && displayTariff && displayTariff !== '-' && sipsTariffVal.trim() !== String(displayTariff).trim();

                return (
                  <div className="space-y-6">
                    {(hasTariffDiff || hasPowerDiff) && (
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
                        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-300 mb-1">Diferencia detectada entre Contrato y SIPS</p>
                          <p>
                            {hasTariffDiff && `Tarifa Contrato (${displayTariff}) vs SIPS (${sipsTariffVal}). `}
                            {hasPowerDiff && `Potencia P1 Contrato (${contractP1} kW) vs SIPS (${sipsP1} kW).`}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="bg-white/[0.01] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="text-sm font-semibold text-white">Potencias y Consumos por Período</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[500px]">
                          <thead>
                            <tr className="bg-black/40 border-b border-white/5">
                              <th className="p-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Métrica</th>
                              {periodos.map((p) => (
                                <th key={`th-${p}`} className="p-3 text-xs font-semibold text-white/40 uppercase tracking-wider text-center">
                                  P{p}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 text-sm text-white/70 font-medium">Potencia Contratada SIPS (kW)</td>
                              {periodos.map((p) => (
                                <td key={`pot-${p}`} className="p-3 text-sm text-white font-mono font-medium text-center">
                                  {powers[p] != null ? Number(powers[p]).toLocaleString('es-ES', { maximumFractionDigits: 3 }) : '-'}
                                </td>
                              ))}
                            </tr>
                            <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                              <td className="p-3 text-sm text-white/70 font-medium">Consumo Anual SIPS (kWh)</td>
                              {periodos.map((p) => (
                                <td key={`cons-${p}`} className="p-3 text-sm text-white font-mono font-medium text-center">
                                  {consumptions[p] != null ? Number(consumptions[p]).toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '-'}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-white/[0.01] border border-white/5 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                        <h3 className="text-sm font-semibold text-white">Ficha Técnica SIPS</h3>
                      </div>
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {generalEntries.map(([key, value]) => (
                          <div key={key} className="bg-white/[0.02] border border-white/5 rounded-lg p-3 hover:bg-white/[0.04] transition-colors">
                            <p className="text-[10px] text-white/40 font-semibold mb-1 uppercase tracking-wider truncate" title={key}>
                              {key}
                            </p>
                            <p className="text-sm text-white font-medium truncate" title={String(value)}>
                              {String(value) || '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
                No hay datos SIPS cacheados para este suministro. Pulsa <strong>Actualizar Datos SIPS</strong> para consultarlos en tiempo real desde nuestro SIPS propio.
              </div>
            )}
          </div>
        )}

        {/* TAB: SWITCHING */}
        {activeTab === 'Switching' && (
          <div className="card p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <RefreshCw className="text-gray-400" /> Histórico Switching (XMLs)
              </h2>
            </div>

            {!initialContract.switchingEvents || initialContract.switchingEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
                No hay registros de switching procesados para este CUPS.
              </div>
            ) : (
              <>
                {/* Mobile View Switching */}
                <div className="block md:hidden">
                  <div className="flex flex-col gap-3">
                    {initialContract.switchingEvents.map((ev: any) => (
                      <div key={ev.id} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono text-gray-400 mb-1">{ev.codigoSolicitud || '-'}</div>
                            <div className="text-xs text-gray-300">
                              {ev.fechaSolicitud ? formatDateUTC(ev.fechaSolicitud) : ev.fechaAviso ? formatDateUTC(ev.fechaAviso) : '-'}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              ev.estadoAR === 'ACEPTADO'
                                ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]'
                                : ev.estadoAR === 'RECHAZADO'
                                ? 'bg-[rgba(239,68,68,0.15)] text-red-400 border border-[rgba(239,68,68,0.3)]'
                                : 'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                            }`}
                          >
                            {ev.estadoAR || '-'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-gray-500">Proceso</div>
                            <div className="text-[var(--lime)] font-bold">{ev.proceso || '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Paso</div>
                            <div className="text-gray-300">{ev.paso || '-'}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          <strong>Obs:</strong> {ev.observaciones || '-'}
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-strong)]">
                          <div className="text-xs text-gray-400">
                            Prev. Act: {ev.fechaPrevActivacion ? formatDateUTC(ev.fechaPrevActivacion) : '-'}
                          </div>
                          {ev.xmlUrl ? (
                            <a
                              href={ev.xmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[var(--lime)] hover:text-white transition-colors"
                              title="Descargar XML"
                            >
                              <Download size={14} /> XML
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop View Switching */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-left">
                        <th className="py-3 px-4 font-semibold text-gray-400">FECHA INTERCAMBIO</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">CÓD. SOLICITUD</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">PROCESO</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">PASO</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">ESTADO A/R</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">FECHA A/R</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">FECHA PREV. ACT.</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">OBSERVACIONES</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">ARCHIVO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialContract.switchingEvents.map((ev: any) => (
                        <tr key={ev.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                          <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                            {ev.fechaSolicitud ? formatDateUTC(ev.fechaSolicitud) : ev.fechaAviso ? formatDateUTC(ev.fechaAviso) : '-'}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-400">{ev.codigoSolicitud || '-'}</td>
                          <td className="py-3 px-4 text-[var(--lime)] font-bold">{ev.proceso || '-'}</td>
                          <td className="py-3 px-4 text-gray-300">{ev.paso || '-'}</td>
                          <td className="py-3 px-4">
                            {ev.estadoAR ? (
                              <span
                                className={`px-2 py-1 rounded text-xs font-bold max-w-max ${
                                  ev.estadoAR === 'ACEPTADO'
                                    ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]'
                                    : ev.estadoAR === 'RECHAZADO'
                                    ? 'bg-[rgba(239,68,68,0.15)] text-red-400 border border-[rgba(239,68,68,0.3)]'
                                    : 'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                                }`}
                              >
                                {ev.estadoAR}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-400">{ev.fechaAR ? formatDateUTC(ev.fechaAR) : '-'}</td>
                          <td className="py-3 px-4 text-gray-300 font-medium">
                            {ev.fechaPrevActivacion ? formatDateUTC(ev.fechaPrevActivacion) : '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-500 max-w-[200px] truncate" title={ev.observaciones || ''}>
                            {ev.observaciones || '-'}
                          </td>
                          <td className="py-3 px-4">
                            {ev.xmlUrl ? (
                              <a
                                href={ev.xmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[var(--lime)] hover:text-white transition-colors"
                                title="Descargar XML Original"
                              >
                                <Download size={14} /> XML
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: RECLAMACIONES */}
        {activeTab === 'Reclamaciones' && (
          <div className="card p-6 animate-fade-in-up">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-gray-400" /> Reclamaciones (R1)
                {initialContract.claims?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] text-gray-300 font-normal">
                    {initialContract.claims.length}
                  </span>
                )}
              </h2>
              {isAdmin && (
                <a
                  href={`/reclamaciones/generar${cupsValue ? `?cups=${encodeURIComponent(cupsValue)}` : ''}`}
                  className="px-3 py-1.5 rounded-lg bg-[var(--lime)] text-[var(--bg-base)] text-xs font-bold hover:bg-[#c9f07a] transition-colors flex items-center gap-1.5"
                >
                  <Send size={13} /> Nueva Reclamación R1
                </a>
              )}
            </div>

            {!initialContract.claims || initialContract.claims.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
                No hay reclamaciones registradas para este contrato.
              </div>
            ) : (
              <>
                {/* Mobile View Reclamaciones */}
                <div className="block md:hidden">
                  <div className="flex flex-col gap-3">
                    {initialContract.claims.map((claim: any) => (
                      <div key={claim.codigoSolicitud} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 text-sm">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="font-mono text-[var(--lime)] font-bold mb-1 flex items-center gap-2">
                              {claim.codigoSolicitud}
                              {claim.paso01?.xmlUrl && (
                                <a href={claim.paso01.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 01" className="text-gray-400 hover:text-[var(--lime)]">
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                            <div className="text-xs text-gray-300 font-medium">{getTipoR1Label(claim.tipoReclamacion)}</div>
                            <div className="text-xs text-gray-400">{getSubtipoR1Label(claim.subtipoReclamacion)}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Cód. Dist: <span className="font-mono text-gray-300">{claim.codigoReclamacion || '-'}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                claim.estadoIntegrado === 'Cerrada'
                                  ? 'bg-gray-800 text-gray-200 border-gray-600'
                                  : claim.estadoIntegrado === 'Rechazada'
                                  ? 'bg-red-900/30 text-red-400 border-red-800'
                                  : claim.estadoIntegrado === 'Pte. Info (Paso 03)'
                                  ? 'bg-amber-900/30 text-amber-300 border-amber-700'
                                  : claim.estadoIntegrado === 'Aceptada'
                                  ? 'bg-green-900/30 text-green-400 border-green-800'
                                  : claim.estadoIntegrado === 'Anulada'
                                  ? 'bg-gray-900 text-gray-500 border-gray-700'
                                  : 'bg-blue-900/30 text-blue-400 border-blue-800'
                              }`}
                            >
                              {claim.estadoIntegrado}
                            </span>
                            {claim.diasAbierta !== null && <span className="text-[11px] text-gray-400">{claim.diasAbierta} días abierta</span>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--border-strong)] pt-2">
                          <div>
                            <div className="text-gray-500 mb-1">Paso 01</div>
                            <div className="text-gray-300">{claim.paso01?.fecha ? formatDateUTC(claim.paso01.fecha) : '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500 mb-1">Paso 02</div>
                            <div className="text-gray-300 flex items-center gap-2">
                              {claim.paso02?.fecha ? formatDateUTC(claim.paso02.fecha) : '-'}
                              {claim.paso02?.xmlUrl && (
                                <a href={claim.paso02.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 02" className="text-gray-500 hover:text-[var(--lime)]">
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 text-xs border-t border-[var(--border-strong)] pt-2">
                          {(claim.paso03?.comentario || claim.paso03?.xmlUrl) && (
                            <div>
                              <div className="text-gray-500 mb-1">
                                Paso 03 {claim.paso03?.fechaLimiteEnvio ? `(Límite: ${formatDateUTC(claim.paso03.fechaLimiteEnvio)})` : ''}
                              </div>
                              <div className="text-gray-300 flex items-start justify-between gap-2">
                                <span className="italic whitespace-pre-wrap">{claim.paso03?.comentario || '-'}</span>
                                {claim.paso03?.xmlUrl && (
                                  <a href={claim.paso03.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 03" className="text-gray-500 hover:text-[var(--lime)] shrink-0 mt-0.5">
                                    <Download size={14} />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                          <div>
                            <div className="text-gray-500 mb-1 flex items-center gap-2">
                              <span>Resolución</span>
                              {claim.paso05?.resultadoDescripcion && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    claim.paso05.resultadoCodigo === '01'
                                      ? 'bg-green-900/40 text-green-300'
                                      : claim.paso05.resultadoCodigo === '02'
                                      ? 'bg-red-900/40 text-red-300'
                                      : 'bg-gray-800 text-gray-300'
                                  }`}
                                >
                                  {claim.paso05.resultadoDescripcion}
                                </span>
                              )}
                            </div>
                            <div className="text-gray-300 flex items-start justify-between gap-2">
                              <span className="italic whitespace-pre-wrap">
                                {claim.paso05?.comentario || (claim.estadoIntegrado === 'Rechazada' ? claim.paso02?.comentario : null) || '-'}
                              </span>
                              {claim.paso05?.xmlUrl && (
                                <a href={claim.paso05.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 05" className="text-gray-500 hover:text-[var(--lime)] shrink-0 mt-0.5">
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop View Reclamaciones */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-left text-xs uppercase">
                        <th className="py-3 px-4 font-semibold text-gray-400">CÓD. SOLICITUD</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">TIPO / SUBTIPO</th>
                        <th className="py-3 px-4 font-semibold text-gray-400 text-center">ESTADO</th>
                        <th className="py-3 px-4 font-semibold text-gray-400 text-center">DÍAS</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">PASO 01 / 02</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">PASO 03 / 04</th>
                        <th className="py-3 px-4 font-semibold text-gray-400">RESOLUCIÓN / PASO 05</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialContract.claims.map((claim: any) => (
                        <tr key={claim.codigoSolicitud} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                          <td className="py-3 px-4 font-mono text-gray-300">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span>{claim.codigoSolicitud}</span>
                                {claim.paso01?.xmlUrl && (
                                  <a href={claim.paso01.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 01" className="text-gray-500 hover:text-[var(--lime)]">
                                    <Download size={14} />
                                  </a>
                                )}
                              </div>
                              {claim.codigoReclamacion && <span className="text-[11px] text-gray-500">Dist: {claim.codigoReclamacion}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-0.5 max-w-[230px]">
                              <span className="text-xs font-semibold text-gray-200 truncate" title={getTipoR1Label(claim.tipoReclamacion)}>
                                {getTipoR1Label(claim.tipoReclamacion)}
                              </span>
                              <span className="text-xs text-gray-400 truncate" title={getSubtipoR1Label(claim.subtipoReclamacion)}>
                                {getSubtipoR1Label(claim.subtipoReclamacion)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                  claim.estadoIntegrado === 'Cerrada'
                                    ? 'bg-gray-800 text-gray-200 border-gray-600'
                                    : claim.estadoIntegrado === 'Rechazada'
                                    ? 'bg-red-900/30 text-red-400 border-red-800'
                                    : claim.estadoIntegrado === 'Pte. Info (Paso 03)'
                                    ? 'bg-amber-900/30 text-amber-300 border-amber-700'
                                    : claim.estadoIntegrado === 'Aceptada'
                                    ? 'bg-green-900/30 text-green-400 border-green-800'
                                    : claim.estadoIntegrado === 'Anulada'
                                    ? 'bg-gray-900 text-gray-500 border-gray-700'
                                    : 'bg-blue-900/30 text-blue-400 border-blue-800'
                                }`}
                              >
                                {claim.estadoIntegrado}
                              </span>
                              {claim.paso05?.resultadoDescripcion && (
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    claim.paso05.resultadoCodigo === '01'
                                      ? 'bg-green-900/30 text-green-300'
                                      : claim.paso05.resultadoCodigo === '02'
                                      ? 'bg-red-900/30 text-red-300'
                                      : 'bg-gray-800 text-gray-400'
                                  }`}
                                >
                                  {claim.paso05.resultadoDescripcion}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-center text-gray-200">{claim.diasAbierta !== null ? claim.diasAbierta : '-'}</td>
                          <td className="py-3 px-4 text-xs text-gray-400">
                            <div className="flex flex-col gap-1">
                              <div>P01: {claim.paso01?.fecha ? formatDateUTC(claim.paso01.fecha) : '-'}</div>
                              <div className="flex items-center gap-1.5">
                                <span>P02: {claim.paso02?.fecha ? formatDateUTC(claim.paso02.fecha) : '-'}</span>
                                {claim.paso02?.xmlUrl && (
                                  <a href={claim.paso02.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 02" className="text-gray-500 hover:text-[var(--lime)]">
                                    <Download size={13} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-400 max-w-[240px]" title={claim.paso03?.comentario || ''}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-xs">{claim.paso03?.comentario || '-'}</span>
                                {claim.paso03?.xmlUrl && (
                                  <a href={claim.paso03.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 03" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                                    <Download size={13} />
                                  </a>
                                )}
                              </div>
                              {claim.paso03?.fechaLimiteEnvio && claim.paso03.requiereRespuesta && (
                                <span className="text-[11px] text-amber-400 font-medium">
                                  Límite: {formatDateUTC(claim.paso03.fechaLimiteEnvio)}
                                </span>
                              )}
                              {claim.paso04?.xmlUrl && (
                                <a href={claim.paso04.xmlUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:underline flex items-center gap-1">
                                  <Download size={11} /> Respuesta P04 enviada
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-300 max-w-xs" title={claim.paso05?.comentario || claim.paso02?.comentario || ''}>
                            <div className="flex items-center gap-2">
                              <span className="truncate text-xs">
                                {claim.paso05?.comentario || (claim.estadoIntegrado === 'Rechazada' ? claim.paso02?.comentario : null) || '-'}
                              </span>
                              {claim.paso05?.xmlUrl && (
                                <a href={claim.paso05.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 05" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: F1s */}
        {activeTab === 'F1s' && (
          <div className="card p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="text-gray-400" /> Histórico de Ficheros F1
              </h2>
            </div>

            {!initialContract.f1Invoices || initialContract.f1Invoices.length === 0 ? (
              <div className="p-8 text-center text-gray-400 border border-dashed border-[var(--border-strong)] rounded-lg">
                No hay ficheros F1 registrados para este contrato.
              </div>
            ) : (
              <>
                {/* Mobile View F1s */}
                <div className="block md:hidden">
                  <div className="flex flex-col gap-3">
                    {initialContract.f1Invoices.map((f1: any) => (
                      <div key={f1.id} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono text-[var(--lime)] font-bold mb-1">{f1.numeroFactura || '-'}</div>
                            <div className="text-xs text-gray-300">{f1.fechaEmision ? formatDateUTC(f1.fechaEmision) : '-'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-bold">
                              {f1.saldoFactura != null ? `${f1.saldoFactura.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}
                            </div>
                            <div className="text-xs text-gray-400">Total</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--border-strong)] pt-2">
                          <div>
                            <div className="text-gray-500">Periodo</div>
                            <div className="text-gray-300">
                              {f1.fechaInicio && f1.fechaFin ? `${formatDateUTC(f1.fechaInicio)} al ${formatDateUTC(f1.fechaFin)}` : '-'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-500">Base Imp.</div>
                            <div className="text-gray-300">
                              {f1.baseImponible != null ? `${f1.baseImponible.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-strong)]">
                          <div className="text-xs flex gap-2">
                            <div>
                              <span className="text-gray-500">Peajes:</span>{' '}
                              {f1.totalPeajes != null ? f1.totalPeajes.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : '-'}
                            </div>
                            <div>
                              <span className="text-gray-500">Cargos:</span>{' '}
                              {f1.totalCargos != null ? f1.totalCargos.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : '-'}
                            </div>
                          </div>
                          {f1.xmlUrl ? (
                            <a href={f1.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML" className="flex items-center gap-1 text-[var(--lime)] hover:text-white transition-colors">
                              <Download size={14} /> XML
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop View F1s */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left">
                        <th className="py-3 px-4 font-semibold text-gray-400 text-xs">FECHA EMISIÓN</th>
                        <th className="py-3 px-4 font-semibold text-gray-400 text-xs">Nº FACTURA</th>
                        <th className="py-3 px-4 font-semibold text-gray-400 text-xs">PERIODO</th>
                        <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">BASE IMP.</th>
                        <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">PEAJES</th>
                        <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">CARGOS</th>
                        <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">TOTAL</th>
                        <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-center">XML</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialContract.f1Invoices.map((f1: any) => (
                        <tr key={f1.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                          <td className="py-3 px-4 text-gray-300 whitespace-nowrap">{f1.fechaEmision ? formatDateUTC(f1.fechaEmision) : '-'}</td>
                          <td className="py-3 px-4 font-mono text-[var(--lime)] font-bold">{f1.numeroFactura || '-'}</td>
                          <td className="py-3 px-4 text-gray-300 text-xs">
                            {f1.fechaInicio && f1.fechaFin ? `${formatDateUTC(f1.fechaInicio)} - ${formatDateUTC(f1.fechaFin)}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-300 text-right">
                            {f1.baseImponible != null ? `${f1.baseImponible.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-300 text-right">
                            {f1.totalPeajes != null ? `${f1.totalPeajes.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-300 text-right">
                            {f1.totalCargos != null ? `${f1.totalCargos.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}
                          </td>
                          <td className="py-3 px-4 text-white font-bold text-right">
                            {f1.saldoFactura != null ? `${f1.saldoFactura.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {f1.xmlUrl ? (
                              <a href={f1.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML" className="flex items-center justify-center gap-1 text-[var(--lime)] hover:text-white transition-colors">
                                <Download size={14} /> XML
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'Consumos' && <ConsumosTab cups={supplyPoint?.cups} />}
      </div>

      {showTacitRenewalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[#1E2A3A] bg-[#111827]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Send size={20} className="text-[var(--lime)]" />
                Comunicar Renovación Tácita
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-300 text-sm leading-relaxed">
                ¿Seguro que deseas comunicar la renovación tácita a este cliente? Se enviará un correo electrónico oficial con los nuevos precios de potencia, energía y servicios adicionales que le aplican.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-[#1E2A3A] bg-[#111827]">
              <button
                onClick={() => setShowTacitRenewalModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
                disabled={isCommunicatingTacitRenewal}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setIsCommunicatingTacitRenewal(true);
                  const res = await comunicarRenovacionTacitaAction(initialContract.id);
                  setIsCommunicatingTacitRenewal(false);
                  setShowTacitRenewalModal(false);
                  if (res.error) {
                    toast.error(res.error);
                  } else {
                    toast.success('Renovación tácita comunicada correctamente.');
                    router.refresh();
                  }
                }}
                disabled={isCommunicatingTacitRenewal}
                className="bg-[var(--lime)] text-black px-5 py-2 rounded-lg font-semibold hover:bg-[#c2ff66] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                {isCommunicatingTacitRenewal ? 'Enviando...' : 'Sí, Comunicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
