import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import {
  BrandVariableContext,
  SepaMandateConfig,
  interpolateTemplateVariables,
} from '@/lib/contracts/defaultClauses';
import { SignatureStampInfo } from './ContractPdfTemplate';

export interface ContractModPdfProps {
  templateData: Record<string, any>;
  isTecnica: boolean;
  brandCtx: BrandVariableContext;
  brandLogoDataUri?: string | null;
  brandAccentColor?: string | null;
  sepaMandateConfig: SepaMandateConfig;
  sepaCreditorId?: string | null;
  signatureStamp?: SignatureStampInfo | null;
}

const PERIODS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;

export const ContractModPdfTemplate: React.FC<ContractModPdfProps> = ({
  templateData: d,
  isTecnica,
  brandCtx,
  brandLogoDataUri,
  brandAccentColor,
  sepaMandateConfig,
  sepaCreditorId,
  signatureStamp,
}) => {
  const primary = '#14383b';
  const accent = brandAccentColor || '#F6936B';
  const t = (raw: string | undefined | null) => interpolateTemplateVariables(raw, brandCtx);
  const titularFull = [d.nombretit, d['1apetit'], d['2apetit']].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const styles = StyleSheet.create({
    page: {
      paddingTop: 58,
      paddingBottom: 52,
      paddingLeft: 38,
      paddingRight: 32,
      fontFamily: 'Helvetica',
      fontSize: 8,
      lineHeight: 1.38,
      color: '#1e293b',
      backgroundColor: '#ffffff',
    },
    headerFixed: {
      position: 'absolute',
      top: 14,
      left: 38,
      right: 32,
      height: 36,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1.2,
      borderBottomColor: accent,
      paddingBottom: 5,
    },
    logo: {
      maxHeight: 26,
      maxWidth: 130,
      objectFit: 'contain',
    },
    titleBar: {
      backgroundColor: primary,
      paddingVertical: 5,
      paddingHorizontal: 8,
      marginBottom: 9,
      borderRadius: 2,
    },
    titleText: {
      color: '#ffffff',
      fontSize: 9.4,
      fontFamily: 'Helvetica-Bold',
      textAlign: 'center',
    },
    sectionHeader: {
      backgroundColor: '#f1f5f9',
      borderLeftWidth: 3,
      borderLeftColor: accent,
      paddingVertical: 3,
      paddingHorizontal: 6,
      marginTop: 7,
      marginBottom: 4,
    },
    sectionHeaderText: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: primary,
    },
    box: {
      borderWidth: 0.7,
      borderColor: '#cbd5e1',
      borderRadius: 2,
      padding: 7,
      marginBottom: 5,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 2.5,
    },
    group: {
      flexDirection: 'row',
      marginRight: 14,
    },
    label: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 7.5,
      color: '#334155',
      marginRight: 3,
    },
    val: {
      fontSize: 7.5,
      color: '#0f172a',
    },
    para: {
      fontSize: 7.5,
      textAlign: 'justify',
      color: '#1e293b',
      marginBottom: 4,
    },
    table: {
      borderWidth: 0.7,
      borderColor: '#cbd5e1',
      marginTop: 4,
      marginBottom: 3,
    },
    thRow: {
      flexDirection: 'row',
      backgroundColor: '#e2e8f0',
      borderBottomWidth: 0.7,
      borderBottomColor: '#cbd5e1',
    },
    trRow: {
      flexDirection: 'row',
    },
    cellTarifa: {
      width: '16%',
      padding: 4,
      borderRightWidth: 0.5,
      borderRightColor: '#cbd5e1',
      textAlign: 'center',
      fontSize: 7.5,
    },
    cellP: {
      width: '14%',
      padding: 4,
      borderRightWidth: 0.5,
      borderRightColor: '#cbd5e1',
      textAlign: 'center',
      fontSize: 7.5,
    },
    sigRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 14,
    },
    sigBox: {
      width: '48%',
      minHeight: 70,
      borderWidth: 0.8,
      borderColor: '#94a3b8',
      borderRadius: 3,
      padding: 6,
      justifyContent: 'space-between',
    },
    footerFixed: {
      position: 'absolute',
      bottom: 14,
      left: 38,
      right: 32,
      borderTopWidth: 0.7,
      borderTopColor: '#cbd5e1',
      paddingTop: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 6.7,
      color: '#64748b',
    },
  });

  return (
    <Document
      title={
        isTecnica
          ? `Anexo Modificación Técnica - ${d.numcontrato || d.contrato || ''}`
          : `Anexo Subrogación - ${d.numcontrato || d.contrato || ''}`
      }
      author={brandCtx.companyName}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerFixed} fixed>
          <View>
            {brandLogoDataUri ? (
              <Image src={brandLogoDataUri} style={styles.logo} />
            ) : (
              <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: primary }}>{brandCtx.brandName}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 6.8, color: '#475569' }}>
              {[brandCtx.brandFreePhone900, brandCtx.brandSupportEmail].filter(Boolean).join('  ·  ')}
            </Text>
            <Text style={{ fontSize: 7.6, fontFamily: 'Helvetica-Bold', color: primary }}>
              Nº Contrato: {d.numcontrato || d.contrato || '-'}
            </Text>
          </View>
        </View>

        <View style={styles.titleBar}>
          <Text style={styles.titleText}>
            {isTecnica
              ? 'ANEXO MODIFICACIÓN TÉCNICA DE CONTRATO DE SUMINISTRO'
              : 'ANEXO SUBROGACIÓN POR CAMBIO DE TITULARIDAD'}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>
            {isTecnica ? 'DATOS DEL TITULAR' : 'DATOS DEL NUEVO TITULAR'}
          </Text>
        </View>
        <View style={styles.box}>
          <View style={styles.row}>
            <View style={styles.group}>
              <Text style={styles.label}>Nombre o Razón Social:</Text>
              <Text style={styles.val}>{titularFull || '-'}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.group}>
              <Text style={styles.label}>CIF/NIF/NIE:</Text>
              <Text style={styles.val}>{d.nif || '-'}</Text>
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>CNAE:</Text>
              <Text style={styles.val}>{d.cnae || '-'}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.group}>
              <Text style={styles.label}>Dirección:</Text>
              <Text style={styles.val}>{d.direcciontitular || '-'}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.group}>
              <Text style={styles.label}>CP:</Text>
              <Text style={styles.val}>{d.cptit || '-'}</Text>
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Localidad:</Text>
              <Text style={styles.val}>{d.loctit || '-'}</Text>
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Provincia:</Text>
              <Text style={styles.val}>{d.provtit || '-'}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.group}>
              <Text style={styles.label}>E-Mail:</Text>
              <Text style={styles.val}>{d.mailtitular || '-'}</Text>
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Teléfono:</Text>
              <Text style={styles.val}>{d.tlftitular || '-'}</Text>
            </View>
            {d.mvtitular ? (
              <View style={styles.group}>
                <Text style={styles.label}>Móvil:</Text>
                <Text style={styles.val}>{d.mvtitular}</Text>
              </View>
            ) : null}
          </View>
          {d.nombrerep ? (
            <Text style={[styles.para, { marginBottom: 0, fontSize: 7.1 }]}>
              Actúa en nombre y representación: <Text style={styles.label}>{d.nombrerep}</Text>, mayor de edad, con DNI{' '}
              <Text style={styles.label}>{d.nifrep || '-'}</Text>, aportando copia del NIF del titular del contrato.
            </Text>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>DATOS DEL PUNTO DE SUMINISTRO</Text>
        </View>
        <View style={styles.box}>
          <View style={styles.row}>
            <View style={styles.group}>
              <Text style={styles.label}>CUPS:</Text>
              <Text style={[styles.val, { fontFamily: 'Helvetica-Bold' }]}>{d.cups || '-'}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.group}>
              <Text style={styles.label}>Dirección:</Text>
              <Text style={styles.val}>{d.direccionPS || '-'}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.group}>
              <Text style={styles.label}>CP:</Text>
              <Text style={styles.val}>{d.cpPS || '-'}</Text>
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Localidad:</Text>
              <Text style={styles.val}>{d.localidadPS || '-'}</Text>
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Provincia:</Text>
              <Text style={styles.val}>{d.provPS || '-'}</Text>
            </View>
          </View>
        </View>

        {isTecnica ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>CONDICIONES TÉCNICAS SOLICITADAS</Text>
            </View>
            <View style={styles.box}>
              <Text style={styles.para}>
                Con la firma de este Anexo, el cliente solicita a {brandCtx.brandName} tramitar ante la distribuidora el
                cambio en las potencias contratadas y/o en la tarifa de acceso del punto de suministro indicado,
                quedando de la siguiente forma:
              </Text>
              <View style={styles.table}>
                <View style={styles.thRow}>
                  <Text style={[styles.cellTarifa, { fontFamily: 'Helvetica-Bold' }]}>Tarifa</Text>
                  {PERIODS.map((p, idx) => (
                    <Text
                      key={p}
                      style={[
                        styles.cellP,
                        { fontFamily: 'Helvetica-Bold' },
                        idx === 5 ? { borderRightWidth: 0 } : {},
                      ]}
                    >
                      {p} (kW)
                    </Text>
                  ))}
                </View>
                <View style={styles.trRow}>
                  <Text style={[styles.cellTarifa, { fontFamily: 'Helvetica-Bold' }]}>{d.tarifa || '-'}</Text>
                  {PERIODS.map((p, idx) => (
                    <Text key={p} style={[styles.cellP, idx === 5 ? { borderRightWidth: 0 } : {}]}>
                      {d[`p${idx + 1}c`] || '-'}
                    </Text>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>CONDICIONES APLICABLES</Text>
            </View>
            <View style={styles.box}>
              <Text style={[styles.para, { marginBottom: 0 }]}>
                Las modificaciones de cambio de potencia contratada y/o tarifa llevan asociados los costes regulados
                establecidos en la normativa vigente, que serán trasladados íntegramente según liquidación de la Empresa
                Distribuidora.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>DATOS PARA LA DOMICILIACIÓN BANCARIA</Text>
            </View>
            <View style={styles.box}>
              <View style={styles.row}>
                <Text style={styles.label}>IBAN:</Text>
                <Text style={[styles.val, { fontFamily: 'Helvetica-Bold' }]}>{d.iban || '-'}</Text>
              </View>
              <Text style={[styles.para, { marginBottom: 0, fontSize: 7.1 }]}>
                El Titular acredita ser titular/autorizado de la cuenta y autoriza a {brandCtx.companyName} a enviar
                instrucciones a su entidad para adeudar en su cuenta y a la entidad para efectuar los adeudos en su
                cuenta siguiendo las instrucciones de {brandCtx.companyName}. Como parte de sus derechos, está
                legitimado al reembolso por su entidad en los términos y condiciones del contrato suscrito con la misma.
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>CAMBIO DE TITULARIDAD (SUBROGACIÓN)</Text>
            </View>
            <View style={styles.box}>
              <Text style={[styles.para, { marginBottom: 0 }]}>
                Con la firma de este Anexo, el nuevo titular solicita el cambio de titularidad a su nombre del contrato
                de suministro de energía eléctrica identificado en el encabezado, contando con la expresa conformidad
                del titular anterior, y subrogándose en todos los derechos y obligaciones del mismo, en particular en
                todas las condiciones del contrato de las que ha sido informado previamente, manteniendo el suministro
                la misma actividad y asumiendo el compromiso de pago de todas las facturas, incluyendo la deuda que
                pudiera estar pendiente de pago o generarse en el futuro.
              </Text>
            </View>

            {d.iban ? (
              <View style={[styles.box, { marginTop: 4 }]}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: primary, marginBottom: 3 }}>
                  ORDEN DE DOMICILIACIÓN DE ADEUDO DIRECTO SEPA
                </Text>
                <Text style={{ fontSize: 6.9, marginBottom: 2 }}>
                  <Text style={styles.label}>Acreedor: </Text>
                  {brandCtx.companyName} (CIF: {brandCtx.companyCif}) — {brandCtx.companyAddress}
                  {sepaCreditorId ? ` — ID Acreedor: ${sepaCreditorId}` : ''}
                </Text>
                <Text style={{ fontSize: 6.8, textAlign: 'justify', marginBottom: 3 }}>
                  {t(sepaMandateConfig.coreAuthorizationText)}
                </Text>
                <Text style={{ fontSize: 6.9 }}>
                  <Text style={styles.label}>Deudor: </Text>
                  {titularFull || '-'} (NIF: {d.nif || '-'}) · IBAN: <Text style={styles.label}>{d.iban}</Text> · Pago:
                  Recurrente
                </Text>
              </View>
            ) : null}
          </>
        )}

        <View style={styles.sigRow} wrap={false}>
          <View style={styles.sigBox}>
            <Text style={styles.label}>POR EL TITULAR / CLIENTE:</Text>
            {signatureStamp ? (
              <View>
                {signatureStamp.rubricDataUrl ? (
                  <Image
                    src={signatureStamp.rubricDataUrl}
                    style={{ height: 28, maxWidth: 115, objectFit: 'contain' }}
                  />
                ) : null}
                <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold' }}>
                  {signatureStamp.signerName} ({signatureStamp.signerNif})
                </Text>
                <Text style={{ fontSize: 6.2, color: '#0f766e' }}>
                  {signatureStamp.methodLabel} · {signatureStamp.signedAtFormatted}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 6.8, color: '#64748b', marginTop: 22 }}>
                Fdo.: {d.nombrerep || titularFull || '-'} ({d.nifrep || d.nif || '-'})
              </Text>
            )}
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.label}>POR LA COMERCIALIZADORA:</Text>
            <View>
              <Text style={{ fontSize: 7.4, fontFamily: 'Helvetica-Bold', color: primary }}>
                {brandCtx.companyName}
              </Text>
              <Text style={{ fontSize: 6.6, color: '#475569' }}>CIF: {brandCtx.companyCif}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footerFixed} fixed>
          <Text>
            Fecha: {signatureStamp?.signedAtFormatted || d.fechafirma || d.fecha || '-'} · {brandCtx.brandName}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
