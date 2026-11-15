import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import {
  AnnexAutoconsumoConfig,
  BrandVariableContext,
  ContractClauseItem,
  ParticularConditionsConfig,
  SepaMandateConfig,
  filterClausesForContract,
  interpolateTemplateVariables,
} from '@/lib/contracts/defaultClauses';

export interface SignatureStampInfo {
  signedAtFormatted: string;
  signerName: string;
  signerNif: string;
  methodLabel: string;
  rubricDataUrl?: string | null;
  envelopeCode?: string;
}

export interface ContractPdfRenderProps {
  templateData: Record<string, any>;
  isB2B: boolean;
  isTransferencia?: boolean;
  isIndexed?: boolean;
  hasSelfConsumption?: boolean;
  hasSolarWallet?: boolean;
  brandCtx: BrandVariableContext;
  brandLogoDataUri?: string | null;
  brandAccentColor?: string | null;
  bankAccounts?: Array<{ bankName: string; iban: string }>;
  sepaCreditorId?: string | null;
  particularConfig: ParticularConditionsConfig;
  clauses: ContractClauseItem[];
  annexAutoconsumo: AnnexAutoconsumoConfig;
  sepaMandateConfig: SepaMandateConfig;
  signatureStamp?: SignatureStampInfo | null;
}

const PERIODS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;

function resolveReadableBrandPrimary(hex?: string | null): string {
  // Corporate dark slate/petrol for crisp readability on white paper, paired with brand accent border
  if (!hex) return '#14383b';
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return '#14383b';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // If accent is very bright (like lime #DEFF9A or soft coral #F6936B), use deep corporate slate for header text background
  return luminance > 0.62 ? '#14383b' : `#${clean}`;
}

const createStyles = (primaryColor: string, accentBorder: string) =>
  StyleSheet.create({
    page: {
      paddingTop: 58,
      paddingBottom: 56,
      paddingLeft: 38,
      paddingRight: 30,
      fontFamily: 'Helvetica',
      fontSize: 7.7,
      lineHeight: 1.34,
      color: '#1e293b',
      backgroundColor: '#ffffff',
    },
    headerFixed: {
      position: 'absolute',
      top: 14,
      left: 38,
      right: 30,
      height: 36,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1.2,
      borderBottomColor: accentBorder,
      paddingBottom: 5,
    },
    headerLogo: {
      maxHeight: 26,
      maxWidth: 130,
      objectFit: 'contain',
    },
    headerBrandFallback: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
    },
    headerRightCol: {
      alignItems: 'flex-end',
    },
    headerContactLine: {
      fontSize: 6.8,
      color: '#475569',
    },
    headerContractNum: {
      fontSize: 7.6,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      marginTop: 1.5,
    },
    verticalRegistryWrap: {
      position: 'absolute',
      left: -245,
      top: 410,
      width: 520,
      transform: 'rotate(-90deg)',
    },
    verticalRegistryText: {
      fontSize: 5.1,
      color: '#64748b',
      textAlign: 'center',
    },
    footerFixed: {
      position: 'absolute',
      bottom: 12,
      left: 38,
      right: 30,
      borderTopWidth: 0.7,
      borderTopColor: '#cbd5e1',
      paddingTop: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    footerColLeft: {
      width: '28%',
    },
    footerColCenter: {
      width: '44%',
      alignItems: 'center',
    },
    footerColRight: {
      width: '28%',
      alignItems: 'flex-end',
    },
    footerLabel: {
      fontSize: 6.5,
      color: '#475569',
    },
    footerBold: {
      fontSize: 6.7,
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a',
    },
    docMainTitleBar: {
      backgroundColor: primaryColor,
      paddingVertical: 5,
      paddingHorizontal: 8,
      marginBottom: 8,
      borderRadius: 2,
    },
    docMainTitleText: {
      color: '#ffffff',
      fontFamily: 'Helvetica-Bold',
      fontSize: 9.2,
      textAlign: 'center',
      letterSpacing: 0.3,
    },
    sectionHeader: {
      backgroundColor: '#f1f5f9',
      borderLeftWidth: 3,
      borderLeftColor: accentBorder,
      paddingVertical: 3,
      paddingHorizontal: 6,
      marginTop: 6,
      marginBottom: 4,
    },
    sectionHeaderText: {
      fontSize: 7.8,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      textTransform: 'uppercase',
    },
    box: {
      borderWidth: 0.7,
      borderColor: '#cbd5e1',
      borderRadius: 2,
      paddingVertical: 5,
      paddingHorizontal: 7,
      marginBottom: 4,
    },
    fieldRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 2.5,
    },
    fieldGroup: {
      flexDirection: 'row',
      marginRight: 12,
    },
    fieldLabel: {
      fontSize: 7.3,
      fontFamily: 'Helvetica-Bold',
      color: '#334155',
      marginRight: 3,
    },
    fieldValue: {
      fontSize: 7.3,
      color: '#0f172a',
    },
    paragraph: {
      fontSize: 7.2,
      color: '#1e293b',
      textAlign: 'justify',
      marginBottom: 3.5,
    },
    smallNote: {
      fontSize: 6.7,
      color: '#475569',
      textAlign: 'justify',
      marginBottom: 3,
    },
    formulaBox: {
      backgroundColor: '#f8fafc',
      borderWidth: 0.7,
      borderColor: '#94a3b8',
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginVertical: 3,
      borderRadius: 2,
    },
    formulaText: {
      fontSize: 7.6,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      textAlign: 'center',
    },
    table: {
      borderWidth: 0.7,
      borderColor: '#cbd5e1',
      marginTop: 2,
      marginBottom: 3,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: '#e2e8f0',
      borderBottomWidth: 0.7,
      borderBottomColor: '#cbd5e1',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#e2e8f0',
    },
    tableFirstCol: {
      width: '28%',
      paddingVertical: 3,
      paddingHorizontal: 5,
      borderRightWidth: 0.5,
      borderRightColor: '#cbd5e1',
      fontSize: 6.9,
      fontFamily: 'Helvetica-Bold',
      color: '#1e293b',
    },
    tablePeriodCol: {
      width: '12%',
      paddingVertical: 3,
      paddingHorizontal: 2,
      borderRightWidth: 0.5,
      borderRightColor: '#cbd5e1',
      textAlign: 'center',
      fontSize: 7,
    },
    clauseWrap: {
      marginBottom: 5,
    },
    clauseTitle: {
      fontSize: 7.6,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      marginBottom: 2,
    },
    clauseParagraph: {
      fontSize: 6.75,
      lineHeight: 1.3,
      color: '#1e293b',
      textAlign: 'justify',
      marginBottom: 2.2,
    },
    sepaCard: {
      borderWidth: 0.9,
      borderColor: '#94a3b8',
      borderRadius: 3,
      padding: 9,
      marginBottom: 10,
    },
    sepaTitle: {
      fontSize: 8.6,
      fontFamily: 'Helvetica-Bold',
      color: '#ffffff',
      backgroundColor: primaryColor,
      paddingVertical: 4,
      paddingHorizontal: 7,
      marginBottom: 6,
      textAlign: 'center',
    },
    sepaSubTitle: {
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      marginTop: 4,
      marginBottom: 2,
      borderBottomWidth: 0.5,
      borderBottomColor: '#cbd5e1',
      paddingBottom: 1.5,
    },
    signatureBlockRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
      gap: 12,
    },
    signatureBox: {
      width: '48%',
      minHeight: 68,
      borderWidth: 0.8,
      borderColor: '#94a3b8',
      borderRadius: 3,
      padding: 6,
      justifyContent: 'space-between',
    },
    rubricImg: {
      height: 30,
      maxWidth: 120,
      objectFit: 'contain',
      marginVertical: 2,
    },
  });

export const ContractPdfTemplate: React.FC<ContractPdfRenderProps> = ({
  templateData: d,
  isB2B,
  isTransferencia = false,
  isIndexed = false,
  hasSelfConsumption = false,
  hasSolarWallet = false,
  brandCtx,
  brandLogoDataUri,
  brandAccentColor,
  bankAccounts = [],
  sepaCreditorId,
  particularConfig,
  clauses,
  annexAutoconsumo,
  sepaMandateConfig,
  signatureStamp,
}) => {
  const primaryColor = resolveReadableBrandPrimary(brandAccentColor);
  const accentBorder = brandAccentColor || '#F6936B';
  const styles = createStyles(primaryColor, accentBorder);

  const t = (raw: string | undefined | null) => interpolateTemplateVariables(raw, brandCtx);

  const titularFull = [d.nombretit, d['1apetit'], d['2apetit']].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const registryLine = [
    `${brandCtx.companyName} (CIF: ${brandCtx.companyCif})`,
    brandCtx.companyAddress,
    brandCtx.companyRegistroMercantil,
  ]
    .filter(Boolean)
    .join(' — ');

  const visibleClauses = filterClausesForContract(clauses, {
    isB2B,
    isIndexed,
    hasSelfConsumption,
    hasSolarWallet,
  });

  const renderPageChrome = () => (
    <>
      <View style={styles.headerFixed} fixed>
        <View>
          {brandLogoDataUri ? (
            <Image src={brandLogoDataUri} style={styles.headerLogo} />
          ) : (
            <Text style={styles.headerBrandFallback}>{brandCtx.brandName}</Text>
          )}
        </View>
        <View style={styles.headerRightCol}>
          <Text style={styles.headerContactLine}>
            {[brandCtx.brandFreePhone900, brandCtx.brandSupportEmail].filter(Boolean).join('  ·  ')}
          </Text>
          <Text style={styles.headerContractNum}>Nº Contrato: {d.numcontrato || '-'}</Text>
        </View>
      </View>

      <View style={styles.verticalRegistryWrap} fixed>
        <Text style={styles.verticalRegistryText}>{registryLine}</Text>
      </View>

      <View style={styles.footerFixed} fixed>
        <View style={styles.footerColLeft}>
          <Text style={styles.footerLabel}>
            Fecha: <Text style={styles.footerBold}>{signatureStamp?.signedAtFormatted || d.fechafirma || '-'}</Text>
          </Text>
          <Text style={styles.footerLabel}>{brandCtx.brandName}</Text>
        </View>
        <View style={styles.footerColCenter}>
          {signatureStamp ? (
            <Text style={styles.footerBold}>
              Firmado electrónicamente por {signatureStamp.signerName} ({signatureStamp.signerNif})
            </Text>
          ) : (
            <Text style={styles.footerLabel}>Firma Cliente · Conformidad Precontractual y Contractual</Text>
          )}
        </View>
        <View style={styles.footerColRight}>
          <Text
            style={styles.footerLabel}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </View>
    </>
  );

  const renderSignatureBoxes = () => (
    <View style={styles.signatureBlockRow} wrap={false}>
      <View style={styles.signatureBox}>
        <Text style={styles.fieldLabel}>POR EL CLIENTE / TITULAR:</Text>
        {signatureStamp ? (
          <View>
            {signatureStamp.rubricDataUrl ? (
              <Image src={signatureStamp.rubricDataUrl} style={styles.rubricImg} />
            ) : null}
            <Text style={{ fontSize: 6.7, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
              {signatureStamp.signerName} — NIF: {signatureStamp.signerNif}
            </Text>
            <Text style={{ fontSize: 6.2, color: '#0f766e' }}>
              {signatureStamp.methodLabel} · {signatureStamp.signedAtFormatted}
              {signatureStamp.envelopeCode ? ` · Ref: ${signatureStamp.envelopeCode}` : ''}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 6.7, color: '#64748b' }}>
              Fdo.: {d.nombrerep || titularFull || '-'} ({d.nifrep || d.nif || '-'})
            </Text>
          </View>
        )}
      </View>

      <View style={styles.signatureBox}>
        <Text style={styles.fieldLabel}>POR LA COMERCIALIZADORA:</Text>
        <View>
          <Text style={{ fontSize: 7.4, fontFamily: 'Helvetica-Bold', color: primaryColor }}>
            {brandCtx.companyName}
          </Text>
          <Text style={{ fontSize: 6.5, color: '#475569' }}>CIF: {brandCtx.companyCif}</Text>
          <Text style={{ fontSize: 6.2, color: '#64748b', marginTop: 4 }}>
            Sello Corporativo Autorizado · {brandCtx.brandName}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderSepaMandateCard = (scheme: 'CORE' | 'B2B') => (
    <View style={styles.sepaCard} wrap={false}>
      <Text style={styles.sepaTitle}>
        {scheme === 'B2B'
          ? 'ORDEN DE DOMICILIACIÓN DE ADEUDO DIRECTO SEPA B2B (Business to Business)'
          : 'ORDEN DE DOMICILIACIÓN DE ADEUDO DIRECTO SEPA'}
      </Text>
      <Text style={styles.smallNote}>
        <Text style={styles.fieldLabel}>Referencia de la orden de domiciliación: </Text>
        {t(sepaMandateConfig.creditorReferenceNote)}
      </Text>

      <Text style={styles.sepaSubTitle}>Identificación del acreedor</Text>
      <View style={styles.fieldRow}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Nombre del acreedor:</Text>
          <Text style={styles.fieldValue}>{brandCtx.companyName}</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CIF:</Text>
          <Text style={styles.fieldValue}>{brandCtx.companyCif}</Text>
        </View>
        {sepaCreditorId ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ID Acreedor SEPA:</Text>
            <Text style={styles.fieldValue}>{sepaCreditorId}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Dirección:</Text>
          <Text style={styles.fieldValue}>{brandCtx.companyAddress}</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>País:</Text>
          <Text style={styles.fieldValue}>España</Text>
        </View>
      </View>

      <View style={{ marginVertical: 4 }}>
        <Text style={styles.paragraph}>
          {t(scheme === 'B2B' ? sepaMandateConfig.b2bAuthorizationText : sepaMandateConfig.coreAuthorizationText)}
        </Text>
      </View>

      <Text style={styles.sepaSubTitle}>Identificación del deudor</Text>
      <View style={styles.fieldRow}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>NIF del cliente:</Text>
          <Text style={styles.fieldValue}>{d.nif || '-'}</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Nombre del cliente (titular de la cuenta de cargo):</Text>
          <Text style={styles.fieldValue}>{titularFull || '-'}</Text>
        </View>
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Dirección:</Text>
          <Text style={styles.fieldValue}>{d.direcciontitular || '-'}</Text>
        </View>
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Código postal:</Text>
          <Text style={styles.fieldValue}>{d.cptit || '-'}</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Población:</Text>
          <Text style={styles.fieldValue}>{d.loctit || '-'}</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Provincia:</Text>
          <Text style={styles.fieldValue}>{d.provtit || '-'}</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>País:</Text>
          <Text style={styles.fieldValue}>España</Text>
        </View>
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Número de cuenta - IBAN:</Text>
          <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>{d.iban || '-'}</Text>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Tipo de pago:</Text>
          <Text style={styles.fieldValue}>Recurrente</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Document
      title={`Contrato ${brandCtx.brandName} - ${d.numcontrato || ''}`}
      author={brandCtx.companyName}
      subject="Contrato de Suministro Eléctrico"
    >
      {/* PÁGINAS 1..N: CONDICIONES PARTICULARES + GENERALES + ANEXO AUTOCONSUMO */}
      <Page size="A4" style={styles.page}>
        {renderPageChrome()}

        <View style={styles.docMainTitleBar}>
          <Text style={styles.docMainTitleText}>
            CONDICIONES PARTICULARES DEL CONTRATO DE SUMINISTRO ELÉCTRICO
          </Text>
        </View>

        {/* DATOS DEL TITULAR */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>DATOS DEL TITULAR</Text>
        </View>
        <View style={styles.box}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nombre o Razón Social:</Text>
              <Text style={styles.fieldValue}>{titularFull || '-'}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CIF/NIF/NIE:</Text>
              <Text style={styles.fieldValue}>{d.nif || '-'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CNAE:</Text>
              <Text style={styles.fieldValue}>{d.cnae || '-'}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Dirección:</Text>
              <Text style={styles.fieldValue}>{d.direcciontitular || '-'}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CP:</Text>
              <Text style={styles.fieldValue}>{d.cptit || '-'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Localidad:</Text>
              <Text style={styles.fieldValue}>{d.loctit || '-'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Provincia:</Text>
              <Text style={styles.fieldValue}>{d.provtit || '-'}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>E-Mail:</Text>
              <Text style={styles.fieldValue}>{d.mailtitular || '-'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Teléfono:</Text>
              <Text style={styles.fieldValue}>{d.tlftitular || '-'}</Text>
            </View>
            {d.mvtitular ? (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Móvil:</Text>
                <Text style={styles.fieldValue}>{d.mvtitular}</Text>
              </View>
            ) : null}
          </View>
          {d.nombrerep ? (
            <Text style={[styles.smallNote, { marginBottom: 0, marginTop: 1 }]}>
              Actúa en nombre y representación: <Text style={styles.fieldLabel}>{d.nombrerep}</Text>, mayor de edad, con
              DNI <Text style={styles.fieldLabel}>{d.nifrep || '-'}</Text>, aportando copia del NIF del titular del
              contrato.
            </Text>
          ) : null}
        </View>

        {/* DATOS DEL PUNTO DE SUMINISTRO */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>DATOS DEL PUNTO DE SUMINISTRO</Text>
        </View>
        <View style={styles.box}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CUPS:</Text>
              <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>{d.cups || '-'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tarifa de acceso:</Text>
              <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>{d.tarifa || '-'}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Dirección:</Text>
              <Text style={styles.fieldValue}>{d.direccionPS || '-'}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>CP:</Text>
              <Text style={styles.fieldValue}>{d.cpPS || '-'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Localidad:</Text>
              <Text style={styles.fieldValue}>{d.localidadPS || '-'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Provincia:</Text>
              <Text style={styles.fieldValue}>{d.provPS || '-'}</Text>
            </View>
          </View>
        </View>

        {/* ENVÍO DE FACTURAS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>ENVÍO DE FACTURAS</Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.smallNote}>{t(particularConfig.invoiceDeliveryNote)}</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>
              ¿Cómo desea recibir sus facturas (coste correo postal {particularConfig.paperInvoiceFeeLabel})?
            </Text>
            <Text style={styles.fieldValue}>{d.ftraspapel || 'Email'}</Text>
          </View>
        </View>

        {/* DATOS PARA LA DOMICILIACIÓN BANCARIA / FORMA DE PAGO */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>
            {isTransferencia ? 'MODALIDAD DE PAGO: TRANSFERENCIA BANCARIA' : 'DATOS PARA LA DOMICILIACIÓN BANCARIA'}
          </Text>
        </View>
        <View style={styles.box}>
          {isTransferencia ? (
            <View>
              <Text style={styles.smallNote}>
                El Cliente abonará las facturas emitidas mediante transferencia bancaria a las cuentas designadas por{' '}
                {brandCtx.companyName} en los términos acordados:
              </Text>
              {bankAccounts.map((acc, idx) => (
                <Text key={idx} style={styles.fieldLabel}>
                  • {acc.bankName}: <Text style={styles.fieldValue}>{acc.iban}</Text>
                </Text>
              ))}
            </View>
          ) : (
            <View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>IBAN:</Text>
                <Text style={[styles.fieldValue, { fontFamily: 'Helvetica-Bold' }]}>{d.iban || '-'}</Text>
              </View>
              <Text style={[styles.smallNote, { marginBottom: 0 }]}>
                {t(isB2B ? particularConfig.sepaB2BAuthNote : particularConfig.sepaCoreAuthNote)}
              </Text>
            </View>
          )}
        </View>

        {/* TÉRMINO DE ENERGÍA */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>TÉRMINO DE ENERGÍA</Text>
        </View>
        <View style={styles.box}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Producto contratado:</Text>
              <Text style={styles.fieldValue}>{d.nombreprod || d.producto || '-'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Modalidad:</Text>
              <Text style={styles.fieldValue}>{d.tipoprod || '-'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Fee (€/MWh):</Text>
              <Text style={styles.fieldValue}>{d.fee ?? '0'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>DSV (€/MWh):</Text>
              <Text style={styles.fieldValue}>{d.dsv ?? '0'}</Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 3 }]}>
            A) TABLA DE PRECIOS FIJOS (Solo aplicable a modalidades &quot;Fijo&quot; y &quot;Fijo Mixto&quot;) (En la modalidad Fijo
            Mixto, estos precios se aplicarán únicamente durante el segundo semestre del contrato).
          </Text>

          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.tableFirstCol}>Periodo</Text>
              {PERIODS.map((p, idx) => (
                <Text
                  key={p}
                  style={[
                    styles.tablePeriodCol,
                    { fontFamily: 'Helvetica-Bold' },
                    idx === 5 ? { borderRightWidth: 0 } : {},
                  ]}
                >
                  {p}
                </Text>
              ))}
            </View>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.tableFirstCol}>Precio Energía (€/kWh)*</Text>
              {PERIODS.map((p, idx) => {
                const key = `p${idx + 1}e`;
                return (
                  <Text key={p} style={[styles.tablePeriodCol, idx === 5 ? { borderRightWidth: 0 } : {}]}>
                    {d[key] ?? '0'}
                  </Text>
                );
              })}
            </View>
          </View>
          <Text style={styles.smallNote}>* No se incluyen impuestos aplicables.</Text>
          <Text style={styles.smallNote}>{t(particularConfig.fixedPriceGuaranteeText)}</Text>

          <Text style={[styles.fieldLabel, { marginTop: 3 }]}>
            B) CÁLCULO DE PRECIO INDEXADO (Solo aplicable a modalidades &quot;Indexado&quot; y al primer semestre de &quot;Fijo
            Mixto&quot;)
          </Text>
          <Text style={styles.smallNote}>{t(particularConfig.indexedIntroText)}</Text>
          <Text style={styles.smallNote}>
            La fórmula aplicada para obtener el precio de cada hora (en €/MWh), que ya incluye el Coste de Gestión
            (FEE), es la siguiente:
          </Text>
          <View style={styles.formulaBox}>
            <Text style={styles.formulaText}>&quot;{t(particularConfig.indexedFormulaExpression)}&quot;</Text>
          </View>
          <Text style={styles.smallNote}>{t(particularConfig.indexedFormulaLegend)}</Text>
          <Text style={[styles.smallNote, { marginBottom: 0 }]}>{t(particularConfig.indexedSwitchToFixedNote)}</Text>
        </View>

        {/* TÉRMINO DE POTENCIA */}
        <View style={styles.sectionHeader} wrap={false}>
          <Text style={styles.sectionHeaderText}>TÉRMINO DE POTENCIA</Text>
        </View>
        <View style={styles.box} wrap={false}>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.tableFirstCol}>Concepto</Text>
              {PERIODS.map((p, idx) => (
                <Text
                  key={p}
                  style={[
                    styles.tablePeriodCol,
                    { fontFamily: 'Helvetica-Bold' },
                    idx === 5 ? { borderRightWidth: 0 } : {},
                  ]}
                >
                  {p}
                </Text>
              ))}
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableFirstCol}>Potencia contratada (kW)</Text>
              {PERIODS.map((p, idx) => {
                const key = `p${idx + 1}c`;
                return (
                  <Text key={p} style={[styles.tablePeriodCol, idx === 5 ? { borderRightWidth: 0 } : {}]}>
                    {d[key] ?? '0'}
                  </Text>
                );
              })}
            </View>
            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.tableFirstCol}>Precio Potencia (€/kW/año)*</Text>
              {PERIODS.map((p, idx) => {
                const key = `p${idx + 1}p`;
                return (
                  <Text key={p} style={[styles.tablePeriodCol, idx === 5 ? { borderRightWidth: 0 } : {}]}>
                    {d[key] ?? '0'}
                  </Text>
                );
              })}
            </View>
          </View>
          <Text style={[styles.smallNote, { marginBottom: 0 }]}>* No se incluyen impuestos aplicables.</Text>
        </View>

        {/* CONDICIONES APLICABLES */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>CONDICIONES APLICABLES</Text>
        </View>
        <View style={styles.box}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Compromiso mínimo de permanencia:</Text>
              <Text style={styles.fieldValue}>
                {d.MESESPERMANENCIA ?? '0'} meses desde la fecha de activación del suministro.
              </Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Servicio adicional:</Text>
              <Text style={styles.fieldValue}>{d.servicios || 'Sin servicios adicionales'}</Text>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Consumo anual estimado:</Text>
              <Text style={styles.fieldValue}>{d.consumoanual || '0'} kWh</Text>
            </View>
          </View>
          <Text style={styles.smallNote}>
            <Text style={styles.fieldLabel}>Renovación: </Text>
            {t(particularConfig.renewalText)}
          </Text>
          <Text style={styles.smallNote}>
            <Text style={styles.fieldLabel}>Penalización por terminación anticipada: </Text>
            En caso de resolución del contrato o cambio de comercializadora antes del vencimiento pactado,{' '}
            {brandCtx.brandName} aplicará una penalización consistente en:
          </Text>
          <Text style={styles.smallNote}>• {t(particularConfig.penaltyLowVoltageText)}</Text>
          <Text style={styles.smallNote}>• {t(particularConfig.penaltyHighVoltageText)}</Text>
          <Text style={styles.smallNote}>
            • <Text style={styles.fieldLabel}>Gestión Administrativa: </Text>
            {t(isB2B ? particularConfig.adminFeeB2BText : particularConfig.adminFeeConsumerText)}
          </Text>
          <Text style={styles.smallNote}>{t(particularConfig.indexedPenaltyValuationNote)}</Text>
          {Boolean(particularConfig.takeOrPayText?.trim()) &&
          particularConfig.takeOrPayScope !== 'DISABLED' &&
          (particularConfig.takeOrPayScope === 'ALL' ? true : isB2B) ? (
            <Text style={styles.smallNote}>
              <Text style={styles.fieldLabel}>Consumo Mínimo Garantizado (Solo aplicable a Alta Tensión 6.X TD): </Text>
              {t(particularConfig.takeOrPayText)}
            </Text>
          ) : null}
          <Text style={styles.smallNote}>
            <Text style={styles.fieldLabel}>Impuestos, Conceptos Regulados y Modificaciones Normativas: </Text>
            {t(particularConfig.taxesAndRegulatedText)}
          </Text>
          <Text style={styles.smallNote}>
            <Text style={styles.fieldLabel}>Traslado regulatorio: </Text>
            {t(particularConfig.regulatoryPassThroughText)}
          </Text>
          <Text style={[styles.smallNote, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>Compromiso de Suministro 100% Renovable: </Text>
            {t(particularConfig.greenCommitmentText)}
          </Text>
        </View>

        {/* TRAMITACIÓN Y ENTRADA EN VIGOR */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>TRAMITACIÓN Y ENTRADA EN VIGOR</Text>
        </View>
        <View style={styles.box}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Tipo de tramitación:</Text>
            <Text style={styles.fieldValue}>{d.tramitacion || 'Cambio comercializadora sin cambios'}*</Text>
          </View>
          <Text style={styles.smallNote}>* {t(particularConfig.tramitationRightsNote)}</Text>
          <Text style={styles.smallNote}>* {t(particularConfig.renewalTransitionNote)}</Text>
          <Text style={styles.smallNote}>
            <Text style={styles.fieldLabel}>Titularidad: </Text>El Cliente declara ser el legítimo usuario (con justo
            título) del inmueble suministrado.
          </Text>
          {!isB2B ? (
            <Text style={[styles.smallNote, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Información sobre el Bono Social (Aplicable a consumidores particulares): </Text>
              {t(particularConfig.bonoSocialConsumerNote)}
            </Text>
          ) : null}
        </View>

        {renderSignatureBoxes()}

        {/* CONDICIONES GENERALES */}
        <View break style={styles.docMainTitleBar}>
          <Text style={styles.docMainTitleText}>
            CONDICIONES GENERALES DEL CONTRATO DE SUMINISTRO ELÉCTRICO
          </Text>
        </View>

        {visibleClauses.map((clause, index) => {
          const paragraphs = t(clause.body)
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean);

          return (
            <View key={clause.id} style={styles.clauseWrap}>
              <Text style={styles.clauseTitle}>
                {index + 1}. {t(clause.title)}
              </Text>
              {paragraphs.map((para, pIdx) => (
                <Text key={pIdx} style={styles.clauseParagraph}>
                  {para}
                </Text>
              ))}
            </View>
          );
        })}

        {/* ANEXO DE AUTOCONSUMO Y BATERÍA VIRTUAL (O BOLSILLO SOLAR) */}
        {(annexAutoconsumo.alwaysIncludeAnnex || hasSelfConsumption || hasSolarWallet) && (
          <View break>
            <View style={styles.docMainTitleBar}>
              <Text style={styles.docMainTitleText}>
                ANEXO DE AUTOCONSUMO Y BATERÍA VIRTUAL (O BOLSILLO SOLAR)
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>AUTOCONSUMO CON COMPENSACIÓN DE EXCEDENTES</Text>
            </View>
            <View style={styles.box}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Modalidad:</Text>
                  <Text style={styles.fieldValue}>{d.modalidadauto || 'Sin autoconsumo'}</Text>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Precio (€/MWh):</Text>
                  <Text style={styles.fieldValue}>{d.pexc ?? '0'}</Text>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>FEE_Exc (€/MWh):</Text>
                  <Text style={styles.fieldValue}>{d.feeexc ?? d.conpexc ?? '0'}</Text>
                </View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 3 }]}>A) VALORACIÓN DE EXCEDENTES</Text>
              <Text style={styles.smallNote}>{t(annexAutoconsumo.surplusValuationIntro)}</Text>
              <View style={styles.formulaBox}>
                <Text style={styles.formulaText}>&quot;{t(annexAutoconsumo.surplusFormulaExpression)}&quot;</Text>
              </View>
              <Text style={styles.smallNote}>{t(annexAutoconsumo.surplusFormulaLegend)}</Text>

              <Text style={[styles.fieldLabel, { marginTop: 3 }]}>B) CONDICIONES DE LA COMPENSACIÓN</Text>
              <Text style={[styles.smallNote, { marginBottom: 0 }]}>
                {t(annexAutoconsumo.compensationConditionsText)}
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>BATERÍA VIRTUAL (O BOLSILLO SOLAR)</Text>
            </View>
            <View style={styles.box}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>¿Asociar a bolsillo solar?:</Text>
                  <Text style={styles.fieldValue}>{d.asociarabolsillo || 'No'}</Text>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Coste de gestión de bolsillo solar (€/mes):</Text>
                  <Text style={styles.fieldValue}>{d.cbolsillosolar ?? '0'}</Text>
                </View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 3 }]}>
                C) CONDICIONES DEL BOLSILLO SOLAR (BATERÍA VIRTUAL)
              </Text>
              <Text style={styles.smallNote}>{t(annexAutoconsumo.solarWalletIntro)}</Text>
              <Text style={[styles.smallNote, { marginBottom: 0 }]}>
                {t(annexAutoconsumo.solarWalletConditionsText)}
              </Text>
            </View>

            {renderSignatureBoxes()}
          </View>
        )}

        {/* ORDEN DE DOMICILIACIÓN SEPA */}
        {!isTransferencia && (
          <View break>
            {isB2B ? (
              <>
                {renderSepaMandateCard('B2B')}
                {sepaMandateConfig.includeBothInB2B ? renderSepaMandateCard('CORE') : null}
              </>
            ) : (
              renderSepaMandateCard('CORE')
            )}
            {renderSignatureBoxes()}
          </View>
        )}
      </Page>
    </Document>
  );
};
