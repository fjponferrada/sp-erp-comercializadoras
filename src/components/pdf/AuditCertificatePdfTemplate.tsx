import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

export interface AuditEventPdfItem {
  eventType: string;
  eventLabel: string;
  timestampFormatted: string;
  ipAddress?: string | null;
  userAgentShort?: string | null;
  detailText?: string | null;
  eventHash: string;
}

export interface AuditCertificatePdfProps {
  envelopeCode: string;
  verificationUrl: string;
  qrCodeDataUri?: string | null;
  brandName: string;
  companyName: string;
  companyCif: string;
  brandLogoDataUri?: string | null;
  brandAccentColor?: string | null;

  contractCode: string;
  cups: string;
  tariff: string;
  supplyAddress: string;
  documentKindLabel: string;
  flowModeLabel: string;

  signerName: string;
  signerNif: string;
  signerEmail: string;
  signerPhone?: string | null;
  isB2B: boolean;

  summaryPdfHashSha256: string;
  summaryAcceptedAtFormatted: string;
  summaryAcceptedIp?: string | null;

  contractPdfDraftHashSha256: string;
  signatureMethod: 'OTP_PADES' | 'QUALIFIED_CERT_UPLOAD';
  signedAtFormatted: string;

  // OTP_PADES specifics
  otpChannel?: string | null;
  otpVerifiedAtFormatted?: string | null;
  rubricDataUri?: string | null;

  // QUALIFIED_CERT_UPLOAD specifics
  certSubjectDn?: string | null;
  certIssuerDn?: string | null;
  certSerialNumber?: string | null;
  certSignerNif?: string | null;
  uploadedSignedPdfHashSha256?: string | null;

  // Seal & QTSA
  tsaProvider: string;
  tsaTimestampFormatted: string;

  auditEvents: AuditEventPdfItem[];
}

function resolvePrimaryColor(hex?: string | null): string {
  if (!hex) return '#0f2942';
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return '#0f2942';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0f2942' : `#${clean}`;
}

export const AuditCertificatePdfTemplate: React.FC<AuditCertificatePdfProps> = (props) => {
  const primary = resolvePrimaryColor(props.brandAccentColor);
  const accent = props.brandAccentColor && /^#[0-9a-fA-F]{6}$/.test(props.brandAccentColor) ? props.brandAccentColor : primary;

  const styles = StyleSheet.create({
    page: {
      paddingTop: 30,
      paddingBottom: 38,
      paddingHorizontal: 34,
      fontFamily: 'Helvetica',
      fontSize: 7.5,
      lineHeight: 1.32,
      color: '#1e293b',
      backgroundColor: '#ffffff',
    },
    topBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: accent,
      paddingBottom: 8,
      marginBottom: 10,
    },
    logo: {
      maxHeight: 28,
      maxWidth: 130,
      objectFit: 'contain',
    },
    brandTitleFallback: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      color: primary,
    },
    bannerRight: {
      alignItems: 'flex-end',
    },
    certBadge: {
      backgroundColor: primary,
      color: '#ffffff',
      fontFamily: 'Helvetica-Bold',
      fontSize: 7.5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 3,
      marginBottom: 2,
    },
    envelopeCodeText: {
      fontSize: 7.2,
      fontFamily: 'Helvetica-Bold',
      color: '#334155',
    },
    mainTitleBox: {
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 4,
      padding: 8,
      marginBottom: 9,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    mainTitleLeft: {
      flex: 1,
      paddingRight: 10,
    },
    mainTitle: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: primary,
      marginBottom: 3,
    },
    mainSubtitle: {
      fontSize: 7,
      color: '#475569',
      lineHeight: 1.35,
    },
    qrBox: {
      width: 64,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrImage: {
      width: 54,
      height: 54,
    },
    qrCaption: {
      fontSize: 5.8,
      color: '#64748b',
      textAlign: 'center',
      marginTop: 2,
    },
    sectionHeader: {
      backgroundColor: primary,
      color: '#ffffff',
      fontFamily: 'Helvetica-Bold',
      fontSize: 7.5,
      paddingVertical: 3,
      paddingHorizontal: 7,
      borderRadius: 2,
      marginTop: 6,
      marginBottom: 4,
    },
    gridBox: {
      borderWidth: 0.8,
      borderColor: '#cbd5e1',
      borderRadius: 3,
      padding: 6,
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      marginBottom: 3,
    },
    colHalf: {
      width: '50%',
      paddingRight: 6,
    },
    colFull: {
      width: '100%',
    },
    label: {
      fontSize: 6.5,
      fontFamily: 'Helvetica-Bold',
      color: '#64748b',
      textTransform: 'uppercase',
    },
    value: {
      fontSize: 7.4,
      color: '#0f172a',
      fontFamily: 'Helvetica-Bold',
    },
    valueNormal: {
      fontSize: 7.2,
      color: '#1e293b',
    },
    hashMono: {
      fontSize: 6.4,
      fontFamily: 'Courier',
      color: '#0f172a',
      backgroundColor: '#f1f5f9',
      paddingVertical: 2,
      paddingHorizontal: 4,
      borderRadius: 2,
      marginTop: 1,
    },
    signatureBoxRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'stretch',
      gap: 8,
    },
    signatureDetailsCol: {
      width: '66%',
    },
    rubricBox: {
      width: '32%',
      borderWidth: 0.8,
      borderColor: '#94a3b8',
      borderStyle: 'dashed',
      borderRadius: 3,
      padding: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
    },
    rubricImg: {
      maxWidth: 135,
      maxHeight: 48,
      objectFit: 'contain',
    },
    table: {
      borderWidth: 0.8,
      borderColor: '#cbd5e1',
      borderRadius: 2,
      marginTop: 2,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#e2e8f0',
      borderBottomWidth: 0.8,
      borderBottomColor: '#cbd5e1',
      paddingVertical: 3,
      paddingHorizontal: 4,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#e2e8f0',
      paddingVertical: 3,
      paddingHorizontal: 4,
    },
    th: {
      fontSize: 6.3,
      fontFamily: 'Helvetica-Bold',
      color: '#334155',
    },
    td: {
      fontSize: 6.3,
      color: '#1e293b',
    },
    tdMono: {
      fontSize: 5.8,
      fontFamily: 'Courier',
      color: '#334155',
    },
    footerLegal: {
      position: 'absolute',
      bottom: 14,
      left: 34,
      right: 34,
      borderTopWidth: 0.6,
      borderTopColor: '#cbd5e1',
      paddingTop: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 6,
      color: '#64748b',
    },
  });

  return (
    <Document
      title={`Certificado de Evidencias Electrónicas - ${props.envelopeCode}`}
      author={props.companyName}
      subject={`Auditoría eIDAS y RD 88/2026 - Contrato ${props.contractCode}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.topBanner}>
          <View>
            {props.brandLogoDataUri ? (
              <Image src={props.brandLogoDataUri} style={styles.logo} />
            ) : (
              <Text style={styles.brandTitleFallback}>{props.brandName}</Text>
            )}
            <Text style={{ fontSize: 6.5, color: '#64748b', marginTop: 2 }}>
              {props.companyName} · CIF {props.companyCif}
            </Text>
          </View>
          <View style={styles.bannerRight}>
            <Text style={styles.certBadge}>CERTIFICADO DE EVIDENCIAS ELECTRÓNICAS</Text>
            <Text style={styles.envelopeCodeText}>ID Sobre: {props.envelopeCode}</Text>
          </View>
        </View>

        {/* Intro + QR */}
        <View style={styles.mainTitleBox}>
          <View style={styles.mainTitleLeft}>
            <Text style={styles.mainTitle}>
              Dossier Probatorio de Contratación Electrónica (Reglamento UE 910/2014 eIDAS · Ley 6/2020 · RD 88/2026)
            </Text>
            <Text style={styles.mainSubtitle}>
              El presente certificado acredita de forma fehaciente e inalterable la secuencia cronológica de puesta a disposición
              previa y aceptación expresa del Documento Resumen Precontractual (Real Decreto 88/2026), la autenticación reforzada
              del firmante y la integridad criptográfica (SHA-256 + Sello PAdES PKCS#7) del contrato suscrito.
            </Text>
            <Text style={{ fontSize: 6.3, color: primary, marginTop: 3, fontFamily: 'Helvetica-Bold' }}>
              Verificación pública en línea: {props.verificationUrl}
            </Text>
          </View>
          {props.qrCodeDataUri ? (
            <View style={styles.qrBox}>
              <Image src={props.qrCodeDataUri} style={styles.qrImage} />
              <Text style={styles.qrCaption}>Verificar autenticidad</Text>
            </View>
          ) : null}
        </View>

        {/* 1. Datos del Contrato y del Firmante */}
        <Text style={styles.sectionHeader}>1. IDENTIFICACIÓN DEL CONTRATO Y DEL FIRMANTE</Text>
        <View style={styles.gridBox}>
          <View style={styles.row}>
            <View style={styles.colHalf}>
              <Text style={styles.label}>Código Contrato / Documento</Text>
              <Text style={styles.value}>
                {props.contractCode} ({props.documentKindLabel})
              </Text>
            </View>
            <View style={styles.colHalf}>
              <Text style={styles.label}>CUPS y Tarifa de Acceso</Text>
              <Text style={styles.value}>
                {props.cups || '-'} · Tarifa {props.tariff || '-'}
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.colFull}>
              <Text style={styles.label}>Dirección del Punto de Suministro</Text>
              <Text style={styles.valueNormal}>{props.supplyAddress || '-'}</Text>
            </View>
          </View>
          <View style={[styles.row, { marginTop: 2 }]}>
            <View style={styles.colHalf}>
              <Text style={styles.label}>Firmante / Representante</Text>
              <Text style={styles.value}>
                {props.signerName} ({props.signerNif}) {props.isB2B ? '[B2B / PYME]' : '[Consumidor]'}
              </Text>
            </View>
            <View style={styles.colHalf}>
              <Text style={styles.label}>Canales Verificados (Email / Móvil)</Text>
              <Text style={styles.valueNormal}>
                {props.signerEmail} {props.signerPhone ? ` · ${props.signerPhone}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Cumplimiento Precontractual RD 88/2026 */}
        <Text style={styles.sectionHeader}>2. PRELACIÓN TEMPORAL — DOCUMENTO RESUMEN PRECONTRACTUAL (RD 88/2026)</Text>
        <View style={styles.gridBox}>
          <View style={styles.row}>
            <View style={styles.colHalf}>
              <Text style={styles.label}>Modo de Flujo Regulatorio</Text>
              <Text style={styles.valueNormal}>{props.flowModeLabel}</Text>
            </View>
            <View style={styles.colHalf}>
              <Text style={styles.label}>Instante Exacto Aceptación Resumen (T1 &lt; T2)</Text>
              <Text style={styles.value}>
                {props.summaryAcceptedAtFormatted} {props.summaryAcceptedIp ? `(IP: ${props.summaryAcceptedIp})` : ''}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 2 }}>
            <Text style={styles.label}>Huella Criptográfica SHA-256 del Documento Resumen Precontractual Aceptado</Text>
            <Text style={styles.hashMono}>{props.summaryPdfHashSha256}</Text>
          </View>
        </View>

        {/* 3. Evidencia Criptográfica de Firma del Contrato */}
        <Text style={styles.sectionHeader}>3. EVIDENCIA DE FIRMA ELECTRÓNICA Y SELLADO DE TIEMPO (T2 / T3)</Text>
        <View style={styles.gridBox}>
          {props.signatureMethod === 'OTP_PADES' ? (
            <View style={styles.signatureBoxRow}>
              <View style={styles.signatureDetailsCol}>
                <View style={styles.row}>
                  <View style={styles.colHalf}>
                    <Text style={styles.label}>Método de Firma</Text>
                    <Text style={styles.value}>Firma Electrónica Avanzada (OTP + Rúbrica + PAdES)</Text>
                  </View>
                  <View style={styles.colHalf}>
                    <Text style={styles.label}>Fecha/Hora Firma (T2)</Text>
                    <Text style={styles.value}>{props.signedAtFormatted}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.colHalf}>
                    <Text style={styles.label}>Canal Autenticación OTP</Text>
                    <Text style={styles.valueNormal}>{props.otpChannel || 'SMS + Email'}</Text>
                  </View>
                  <View style={styles.colHalf}>
                    <Text style={styles.label}>Autoridad Sellado Tiempo (TSA)</Text>
                    <Text style={styles.valueNormal}>
                      {props.tsaProvider} ({props.tsaTimestampFormatted})
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 2 }}>
                  <Text style={styles.label}>SHA-256 Borrador Contractual Original Suscrito</Text>
                  <Text style={styles.hashMono}>{props.contractPdfDraftHashSha256}</Text>
                </View>
              </View>
              <View style={styles.rubricBox}>
                <Text style={[styles.label, { marginBottom: 3 }]}>Rúbrica Gráfica Capturada</Text>
                {props.rubricDataUri ? (
                  <Image src={props.rubricDataUri} style={styles.rubricImg} />
                ) : (
                  <Text style={{ fontSize: 6.5, color: '#64748b' }}>Validado mediante código OTP</Text>
                )}
                <Text style={{ fontSize: 5.8, color: '#475569', marginTop: 2 }}>
                  {props.signerName} ({props.signerNif})
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.row}>
                <View style={styles.colHalf}>
                  <Text style={styles.label}>Método de Firma</Text>
                  <Text style={styles.value}>Certificado Electrónico Cualificado X.509 (PAdES Cliente)</Text>
                </View>
                <View style={styles.colHalf}>
                  <Text style={styles.label}>Fecha/Hora Validación Criptográfica</Text>
                  <Text style={styles.value}>{props.signedAtFormatted}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.colHalf}>
                  <Text style={styles.label}>Titular Certificado X.509 (Subject DN)</Text>
                  <Text style={styles.valueNormal}>{props.certSubjectDn || '-'}</Text>
                </View>
                <View style={styles.colHalf}>
                  <Text style={styles.label}>Prestador Cualificado Emisor (Issuer DN)</Text>
                  <Text style={styles.valueNormal}>{props.certIssuerDn || '-'}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.colHalf}>
                  <Text style={styles.label}>Nº Serie Certificado / NIF Verificado</Text>
                  <Text style={styles.valueNormal}>
                    Serie: {props.certSerialNumber || '-'} · ID Verificado: {props.certSignerNif || props.signerNif}
                  </Text>
                </View>
                <View style={styles.colHalf}>
                  <Text style={styles.label}>Sellado de Tiempo de Auditoría</Text>
                  <Text style={styles.valueNormal}>
                    {props.tsaProvider} ({props.tsaTimestampFormatted})
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 2 }}>
                <Text style={styles.label}>SHA-256 Borrador Original / SHA-256 PDF Firmado Cualificado Aportado</Text>
                <Text style={styles.hashMono}>Borrador: {props.contractPdfDraftHashSha256}</Text>
                {props.uploadedSignedPdfHashSha256 ? (
                  <Text style={styles.hashMono}>Firmado X.509: {props.uploadedSignedPdfHashSha256}</Text>
                ) : null}
              </View>
            </View>
          )}
        </View>

        {/* 4. Cadena Inmutable de Eventos (Audit Log encadenado SHA-256) */}
        <Text style={styles.sectionHeader}>4. TRAZABILIDAD CRONOLÓGICA INMUTABLE (CADENA DE HASHES SHA-256)</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: '19%' }]}>Fecha / Hora (UTC)</Text>
            <Text style={[styles.th, { width: '23%' }]}>Hito / Evento</Text>
            <Text style={[styles.th, { width: '16%' }]}>IP Origen</Text>
            <Text style={[styles.th, { width: '24%' }]}>Detalle</Text>
            <Text style={[styles.th, { width: '18%' }]}>Hash Cadena</Text>
          </View>
          {props.auditEvents.map((ev, idx) => (
            <View key={`${ev.eventType}-${idx}`} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, { width: '19%' }]}>{ev.timestampFormatted}</Text>
              <Text style={[styles.td, { width: '23%', fontFamily: 'Helvetica-Bold' }]}>{ev.eventLabel}</Text>
              <Text style={[styles.td, { width: '16%' }]}>{ev.ipAddress || 'Servidor ERP'}</Text>
              <Text style={[styles.td, { width: '24%' }]}>{ev.detailText || '-'}</Text>
              <Text style={[styles.tdMono, { width: '18%' }]}>{ev.eventHash.slice(0, 16)}...</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footerLegal} fixed>
          <Text>
            {props.companyName} (CIF {props.companyCif}) · Motor de Firma Digital eIDAS / RD 88/2026
          </Text>
          <Text>Sobre {props.envelopeCode} · Documento sellado criptográficamente (PAdES PKCS#7)</Text>
        </View>
      </Page>
    </Document>
  );
};
