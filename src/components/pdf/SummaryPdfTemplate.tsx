import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import {
  BrandVariableContext,
  ParticularConditionsConfig,
  SummaryDocumentConfig,
  interpolateTemplateVariables,
} from '@/lib/contracts/defaultClauses';

export interface SummaryPdfRenderProps {
  templateData: Record<string, any>;
  isB2B: boolean;
  isIndexed: boolean;
  isTransferencia?: boolean;
  hasSelfConsumption?: boolean;
  hasSolarWallet?: boolean;
  brandCtx: BrandVariableContext;
  brandLogoDataUri?: string | null;
  brandAccentColor?: string | null;
  particularConfig: ParticularConditionsConfig;
  summaryConfig: SummaryDocumentConfig;
  acceptedStamp?: {
    acceptedAtFormatted: string;
    signerName: string;
    signerNif: string;
    ipAddress?: string | null;
    envelopeCode?: string;
  } | null;
}

const PERIODS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;

function resolvePrimary(hex?: string | null): string {
  if (!hex) return '#14383b';
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return '#14383b';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#14383b' : `#${clean}`;
}

function formatDailyPowerPrice(annualStr: any): string {
  const num = parseFloat(String(annualStr ?? '0').replace(',', '.'));
  if (!Number.isFinite(num) || num <= 0) return '0,000000';
  return (num / 365).toFixed(6).replace('.', ',');
}

export const SummaryPdfTemplate: React.FC<SummaryPdfRenderProps> = ({
  templateData: d,
  isB2B,
  isIndexed,
  isTransferencia = false,
  hasSelfConsumption = false,
  hasSolarWallet = false,
  brandCtx,
  brandLogoDataUri,
  brandAccentColor,
  particularConfig,
  summaryConfig,
  acceptedStamp,
}) => {
  const primary = resolvePrimary(brandAccentColor);
  const accent = brandAccentColor || '#F6936B';
  const t = (raw: string | undefined | null) => interpolateTemplateVariables(raw, brandCtx);

  const titularFull = [d.nombretit, d['1apetit'], d['2apetit']].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const permanenceMonths = Number(d.MESESPERMANENCIA || 0);

  const styles = StyleSheet.create({
    page: {
      paddingTop: 26,
      paddingBottom: 38,
      paddingLeft: 32,
      paddingRight: 32,
      fontFamily: 'Helvetica',
      fontSize: 8,
      lineHeight: 1.35,
      color: '#0f172a',
      backgroundColor: '#ffffff',
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: accent,
      paddingBottom: 8,
      marginBottom: 8,
    },
    logo: {
      maxHeight: 30,
      maxWidth: 140,
      objectFit: 'contain',
    },
    brandFallback: {
      fontSize: 14,
      fontFamily: 'Helvetica-Bold',
      color: primary,
    },
    badgePill: {
      backgroundColor: primary,
      color: '#ffffff',
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 3,
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
    },
    subtitleBanner: {
      backgroundColor: '#f8fafc',
      borderWidth: 0.8,
      borderColor: '#cbd5e1',
      borderRadius: 3,
      paddingVertical: 5,
      paddingHorizontal: 8,
      marginBottom: 8,
    },
    twoColRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 7,
    },
    colCard: {
      width: '49%',
      borderWidth: 0.8,
      borderColor: '#cbd5e1',
      borderRadius: 3,
      padding: 7,
    },
    cardTitle: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: primary,
      borderBottomWidth: 0.7,
      borderBottomColor: '#e2e8f0',
      paddingBottom: 2.5,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    kvLine: {
      fontSize: 7.4,
      marginBottom: 2,
      color: '#334155',
    },
    kvBold: {
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a',
    },
    sectionBlock: {
      borderWidth: 0.8,
      borderColor: '#cbd5e1',
      borderRadius: 3,
      padding: 7,
      marginBottom: 7,
    },
    table: {
      borderWidth: 0.7,
      borderColor: '#cbd5e1',
      marginTop: 3,
      marginBottom: 3,
    },
    thRow: {
      flexDirection: 'row',
      backgroundColor: primary,
    },
    trRow: {
      flexDirection: 'row',
      borderTopWidth: 0.6,
      borderTopColor: '#cbd5e1',
    },
    colConcept: {
      width: '28%',
      paddingVertical: 3,
      paddingHorizontal: 5,
      borderRightWidth: 0.5,
      borderRightColor: '#cbd5e1',
      fontSize: 7,
      fontFamily: 'Helvetica-Bold',
    },
    colPeriod: {
      width: '12%',
      paddingVertical: 3,
      paddingHorizontal: 2,
      borderRightWidth: 0.5,
      borderRightColor: '#cbd5e1',
      textAlign: 'center',
      fontSize: 7,
    },
    warningBox: {
      backgroundColor: '#fffbeb',
      borderWidth: 0.9,
      borderColor: '#f59e0b',
      borderRadius: 3,
      padding: 6,
      marginBottom: 6,
    },
    infoBox: {
      backgroundColor: '#f0fdfa',
      borderWidth: 0.9,
      borderColor: '#0d9488',
      borderRadius: 3,
      padding: 6,
      marginBottom: 6,
    },
    footer: {
      position: 'absolute',
      bottom: 12,
      left: 32,
      right: 32,
      borderTopWidth: 0.6,
      borderTopColor: '#cbd5e1',
      paddingTop: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 6.5,
      color: '#64748b',
    },
  });

  return (
    <Document
      title={`Documento Resumen Precontractual - ${d.numcontrato || ''}`}
      author={brandCtx.companyName}
      subject="Documento Resumen Precontractual RD 88/2026"
    >
      <Page size="A4" style={styles.page}>
        {/* CABECERA */}
        <View style={styles.topHeader}>
          <View>
            {brandLogoDataUri ? (
              <Image src={brandLogoDataUri} style={styles.logo} />
            ) : (
              <Text style={styles.brandFallback}>{brandCtx.brandName}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.badgePill}>DOCUMENTO RESUMEN PRECONTRACTUAL</Text>
            <Text style={{ fontSize: 7.2, color: '#475569', marginTop: 3 }}>
              Ref. Contrato: <Text style={styles.kvBold}>{d.numcontrato || '-'}</Text> · Fecha: {d.fechafirma || '-'}
            </Text>
          </View>
        </View>

        <View style={styles.subtitleBanner}>
          <Text style={{ fontSize: 7.4, fontFamily: 'Helvetica-Bold', color: primary }}>
            {t(summaryConfig.headerLegalSubtitle)}
          </Text>
          <Text style={{ fontSize: 6.9, color: '#475569', marginTop: 1 }}>
            Este documento independiente resume las condiciones esenciales de la oferta de suministro eléctrico para su
            lectura y aceptación expresa con carácter previo a la formalización del contrato.
          </Text>
        </View>

        {/* IDENTIFICACIÓN DE LAS PARTES Y SUMINISTRO */}
        <View style={styles.twoColRow}>
          <View style={styles.colCard}>
            <Text style={styles.cardTitle}>1. Datos de la Comercializadora</Text>
            <Text style={styles.kvLine}>
              Razón Social: <Text style={styles.kvBold}>{brandCtx.companyName}</Text>
            </Text>
            <Text style={styles.kvLine}>
              CIF: <Text style={styles.kvBold}>{brandCtx.companyCif}</Text> · Marca:{' '}
              <Text style={styles.kvBold}>{brandCtx.brandName}</Text>
            </Text>
            <Text style={styles.kvLine}>Domicilio: {brandCtx.companyAddress || '-'}</Text>
            <Text style={styles.kvLine}>
              Tel. Gratuito Atención Cliente: <Text style={styles.kvBold}>{brandCtx.brandFreePhone900 || '-'}</Text>
            </Text>
            <Text style={styles.kvLine}>
              Email Atención / Desistimiento: <Text style={styles.kvBold}>{brandCtx.brandSupportEmail || '-'}</Text>
            </Text>
          </View>

          <View style={styles.colCard}>
            <Text style={styles.cardTitle}>2. Datos del Titular y Suministro</Text>
            <Text style={styles.kvLine}>
              Titular: <Text style={styles.kvBold}>{titularFull || '-'}</Text> ({d.nif || '-'})
            </Text>
            <Text style={styles.kvLine}>
              CUPS: <Text style={styles.kvBold}>{d.cups || '-'}</Text> · Tarifa:{' '}
              <Text style={styles.kvBold}>{d.tarifa || '-'}</Text>
            </Text>
            <Text style={styles.kvLine}>
              Dirección PS: {d.direccionPS || '-'} ({d.cpPS || ''} {d.localidadPS || ''}, {d.provPS || ''})
            </Text>
            <Text style={styles.kvLine}>
              Consumo Anual Estimado: <Text style={styles.kvBold}>{d.consumoanual || '0'} kWh</Text>
            </Text>
            <Text style={styles.kvLine}>
              Trámite: <Text style={styles.kvBold}>{d.tramitacion || 'Cambio de comercializadora'}</Text>
            </Text>
          </View>
        </View>

        {/* RESUMEN DE PRECIOS Y PRODUCTO */}
        <View style={styles.sectionBlock}>
          <Text style={styles.cardTitle}>
            3. Producto y Condiciones Económicas (Sin Impuestos) — {d.nombreprod || d.producto || 'Suministro Eléctrico'}{' '}
            ({isIndexed ? 'Modalidad Indexada' : 'Modalidad Precio Fijo / Mixto'})
          </Text>

          {/* POTENCIA */}
          <Text style={{ fontSize: 7.3, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginTop: 1 }}>
            A) Término de Potencia Contratada y Precios Unitarios:
          </Text>
          <View style={styles.table}>
            <View style={styles.thRow}>
              <Text style={[styles.colConcept, { color: '#ffffff' }]}>Concepto</Text>
              {PERIODS.map((p, idx) => (
                <Text
                  key={p}
                  style={[
                    styles.colPeriod,
                    { color: '#ffffff', fontFamily: 'Helvetica-Bold' },
                    idx === 5 ? { borderRightWidth: 0 } : {},
                  ]}
                >
                  {p}
                </Text>
              ))}
            </View>
            <View style={styles.trRow}>
              <Text style={styles.colConcept}>Potencia (kW)</Text>
              {PERIODS.map((p, idx) => (
                <Text key={p} style={[styles.colPeriod, idx === 5 ? { borderRightWidth: 0 } : {}]}>
                  {d[`p${idx + 1}c`] ?? '0'}
                </Text>
              ))}
            </View>
            <View style={styles.trRow}>
              <Text style={styles.colConcept}>Precio (€/kW/año)</Text>
              {PERIODS.map((p, idx) => (
                <Text key={p} style={[styles.colPeriod, idx === 5 ? { borderRightWidth: 0 } : {}]}>
                  {d[`p${idx + 1}p`] ?? '0'}
                </Text>
              ))}
            </View>
            <View style={styles.trRow}>
              <Text style={styles.colConcept}>Equiv. (€/kW/día)</Text>
              {PERIODS.map((p, idx) => (
                <Text key={p} style={[styles.colPeriod, idx === 5 ? { borderRightWidth: 0 } : {}]}>
                  {formatDailyPowerPrice(d[`p${idx + 1}p`])}
                </Text>
              ))}
            </View>
          </View>

          {/* ENERGÍA */}
          <Text style={{ fontSize: 7.3, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginTop: 4 }}>
            B) Término de Energía Consumida:
          </Text>
          {isIndexed ? (
            <View
              style={{
                backgroundColor: '#f8fafc',
                borderWidth: 0.7,
                borderColor: '#cbd5e1',
                padding: 5,
                marginTop: 2,
                borderRadius: 2,
              }}
            >
              <Text style={{ fontSize: 7.3, color: '#0f172a' }}>
                <Text style={styles.kvBold}>Modalidad Indexada a Mercado Mayorista (OMIE Pass-Through): </Text>
                Fórmula horaria <Text style={styles.kvBold}>{t(particularConfig.indexedFormulaExpression)}</Text>
              </Text>
              <Text style={{ fontSize: 7.2, color: '#334155', marginTop: 2 }}>
                • Coste de Gestión Comercial (<Text style={styles.kvBold}>FEE</Text>):{' '}
                <Text style={styles.kvBold}>{d.fee ?? '0'} €/MWh</Text> (equiv.{' '}
                {((parseFloat(String(d.fee || '0').replace(',', '.')) || 0) / 1000).toFixed(5).replace('.', ',')} €/kWh)
                {'   ·   '}Desvíos (<Text style={styles.kvBold}>DSV</Text>):{' '}
                <Text style={styles.kvBold}>{d.dsv ?? '0'} €/MWh</Text>
              </Text>
            </View>
          ) : (
            <View style={styles.table}>
              <View style={styles.thRow}>
                <Text style={[styles.colConcept, { color: '#ffffff' }]}>Periodo</Text>
                {PERIODS.map((p, idx) => (
                  <Text
                    key={p}
                    style={[
                      styles.colPeriod,
                      { color: '#ffffff', fontFamily: 'Helvetica-Bold' },
                      idx === 5 ? { borderRightWidth: 0 } : {},
                    ]}
                  >
                    {p}
                  </Text>
                ))}
              </View>
              <View style={styles.trRow}>
                <Text style={styles.colConcept}>Energía (€/kWh)</Text>
                {PERIODS.map((p, idx) => (
                  <Text key={p} style={[styles.colPeriod, idx === 5 ? { borderRightWidth: 0 } : {}]}>
                    {d[`p${idx + 1}e`] ?? '0'}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* AUTOCONSUMO, SVA Y FORMA DE PAGO */}
          <View style={{ marginTop: 4 }}>
            <Text style={styles.kvLine}>
              • <Text style={styles.kvBold}>Autoconsumo / Batería Virtual: </Text>
              {hasSelfConsumption || d.modalidadauto === 'Con excedentes'
                ? `Con excedentes (Precio: ${d.pexc ?? '0'} €/MWh · FEE_Exc: ${d.feeexc ?? '0'} €/MWh)${
                    hasSolarWallet || d.asociarabolsillo === 'Si'
                      ? ` · Asociado a Bolsillo Solar (${d.cbolsillosolar ?? '0'} €/mes)`
                      : ''
                  }`
                : 'Sin compensación de excedentes contratada'}
            </Text>
            <Text style={styles.kvLine}>
              • <Text style={styles.kvBold}>Servicios Adicionales (SVA): </Text>
              {d.servicios || 'Ninguno'}
            </Text>
            <Text style={styles.kvLine}>
              • <Text style={styles.kvBold}>Facturación y Pago: </Text>
              Envío por {d.ftraspapel || 'Email'} (coste papel: {particularConfig.paperInvoiceFeeLabel}) · Pago por{' '}
              {isTransferencia ? 'Transferencia Bancaria' : `Domiciliación SEPA (${d.iban || '-'})`}
            </Text>
            <Text style={{ fontSize: 6.7, color: '#475569', marginTop: 2 }}>{t(summaryConfig.priceTransparencyNote)}</Text>
          </View>
        </View>

        {/* DURACIÓN, PERMANENCIA Y PENALIZACIONES */}
        <View style={styles.sectionBlock}>
          <Text style={styles.cardTitle}>4. Duración, Renovación, Permanencia y Penalizaciones</Text>
          <Text style={styles.kvLine}>
            • <Text style={styles.kvBold}>Duración inicial y renovación: </Text>12 meses desde la activación del
            suministro, con prórroga anual automática salvo preaviso de 30 días naturales.
          </Text>
          <Text style={styles.kvLine}>
            • <Text style={styles.kvBold}>Compromiso de permanencia: </Text>
            {permanenceMonths > 0
              ? `SÍ — ${permanenceMonths} meses desde la fecha de activación del suministro.`
              : 'SIN compromiso de permanencia.'}
          </Text>
          <Text style={styles.kvLine}>
            • <Text style={styles.kvBold}>Penalización por baja anticipada: </Text>
            {permanenceMonths > 0
              ? `${t(particularConfig.penaltyLowVoltageText)} ${t(particularConfig.penaltyHighVoltageText)}`
              : 'No aplica penalización por permanencia (salvo costes regulados o administrativos en no consumidores).'}
          </Text>
        </View>

        {/* DERECHOS DEL CONSUMIDOR, DESISTIMIENTO Y BONO SOCIAL (RD 88/2026) */}
        <View style={styles.infoBox}>
          <Text style={{ fontSize: 7.4, fontFamily: 'Helvetica-Bold', color: '#0f766e', marginBottom: 2 }}>
            5. Derecho de Desistimiento y Atención Gratuita al Cliente (RD 88/2026)
          </Text>
          <Text style={{ fontSize: 7, color: '#134e4a', marginBottom: 2 }}>
            {t(isB2B ? summaryConfig.withdrawalRightB2BText : summaryConfig.withdrawalRightConsumerText)}
          </Text>
          <Text style={{ fontSize: 7, color: '#134e4a' }}>{t(summaryConfig.claimsAndSupportText)}</Text>
        </View>

        {!isB2B && (
          <View style={styles.warningBox}>
            <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: '#92400e', marginBottom: 1 }}>
              ADVERTENCIA LEGAL SOBRE EL BONO SOCIAL ELÉCTRICO (PVPC)
            </Text>
            <Text style={{ fontSize: 6.9, color: '#78350f' }}>{t(summaryConfig.bonoSocialWarningText)}</Text>
          </View>
        )}

        {/* CONSTANCIA DE ENTREGA Y ACEPTACIÓN PRECONTRACTUAL */}
        {acceptedStamp ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#16a34a',
              backgroundColor: '#f0fdf4',
              borderRadius: 3,
              padding: 6,
              marginTop: 2,
            }}
          >
            <Text style={{ fontSize: 7.3, fontFamily: 'Helvetica-Bold', color: '#166534' }}>
              CONSTANCIA DE LECTURA Y ACEPTACIÓN PRECONTRACTUAL EXPRESA (FASE T1 COMPLETADA)
            </Text>
            <Text style={{ fontSize: 6.8, color: '#14532d', marginTop: 1.5 }}>
              Aceptado por: {acceptedStamp.signerName} ({acceptedStamp.signerNif}) · Fecha y hora UTC/CET:{' '}
              {acceptedStamp.acceptedAtFormatted}
              {acceptedStamp.ipAddress ? ` · IP: ${acceptedStamp.ipAddress}` : ''}
              {acceptedStamp.envelopeCode ? ` · Sobre: ${acceptedStamp.envelopeCode}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {brandCtx.companyName} (CIF: {brandCtx.companyCif}) · Tel. Gratuito: {brandCtx.brandFreePhone900}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Documento Resumen RD 88/2026 · Pág. ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
