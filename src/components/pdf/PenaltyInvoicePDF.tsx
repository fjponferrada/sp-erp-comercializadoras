import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

export interface PenaltyInvoicePDFLine {
  cups: string;
  contractCode?: string | null;
  baseAmount: number;
  dailyConsumption?: number;
  daysRemaining?: number;
}

export interface PenaltyInvoicePDFData {
  invoiceNumber: string;
  issueDate: string;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  brandName: string;
  brandVat: string;
  brandAddress: string;
  brandLogo?: string | null;
  clientName: string;
  clientVat: string;
  clientAddress?: string | null;
  clientCity?: string | null;
  clientPostalCode?: string | null;
  cups?: string;
  contractCode?: string | null;
  dailyConsumption?: number;
  daysRemaining?: number;
  lines?: PenaltyInvoicePDFLine[];
  banks?: Array<{ name?: string | null; iban?: string | null }>;
  isAbono?: boolean;
  rectifiedInvoiceNumber?: string | null;
  rectifiedIssueDate?: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    borderBottom: '2pt solid #E5E7EB',
    paddingBottom: 18,
  },
  logo: { width: 120 },
  title: { fontSize: 22, color: '#111827', fontWeight: 'bold' },
  titleAbono: { fontSize: 18, color: '#B91C1C', fontWeight: 'bold' },
  subtitle: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  rectifiedBadge: { fontSize: 9, color: '#B91C1C', marginTop: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  colHalf: { width: '48%' },
  label: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: { fontSize: 10.5, color: '#111827', marginBottom: 1 },
  table: { marginTop: 24, borderTop: '1pt solid #E5E7EB' },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1pt solid #E5E7EB',
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #E5E7EB',
    paddingVertical: 10,
  },
  colConcept: { flex: 1, paddingLeft: 8, paddingRight: 8 },
  colAmount: { width: '22%', textAlign: 'right', paddingRight: 8, justifyContent: 'center' },
  headerText: { fontSize: 9, fontWeight: 'bold', color: '#4B5563' },
  totals: { marginTop: 18, alignSelf: 'flex-end', width: '42%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { fontSize: 10, color: '#4B5563' },
  totalValue: { fontSize: 11, fontWeight: 'bold', color: '#111827' },
  totalFinalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '2pt solid #111827',
  },
  totalFinalValue: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9CA3AF',
    borderTop: '1pt solid #E5E7EB',
    paddingTop: 10,
  },
});

export const PenaltyInvoicePDF = ({ data }: { data: PenaltyInvoicePDFData }) => {
  const isAbono = Boolean(data.isAbono);
  const lines: PenaltyInvoicePDFLine[] =
    Array.isArray(data.lines) && data.lines.length > 0
      ? data.lines
      : [
          {
            cups: data.cups || '-',
            contractCode: data.contractCode || null,
            baseAmount: Number(data.baseAmount || 0),
            dailyConsumption: data.dailyConsumption,
            daysRemaining: data.daysRemaining,
          },
        ];
  const isMultiLine = lines.length > 1;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {data.brandLogo ? (
              <Image src={data.brandLogo} style={styles.logo} />
            ) : (
              <Text style={styles.title}>{data.brandName}</Text>
            )}
          </View>
          <View style={{ textAlign: 'right', maxWidth: '58%' }}>
            <Text style={isAbono ? styles.titleAbono : styles.title}>
              {isAbono ? 'FACTURA RECTIFICATIVA / ABONO' : 'FACTURA'}
            </Text>
            <Text style={styles.subtitle}>{data.invoiceNumber}</Text>
            {isAbono && data.rectifiedInvoiceNumber && (
              <Text style={styles.rectifiedBadge}>
                Rectifica factura: {data.rectifiedInvoiceNumber}
                {data.rectifiedIssueDate ? ` (${data.rectifiedIssueDate})` : ''}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.colHalf}>
            <Text style={styles.label}>DATOS DEL EMISOR</Text>
            <Text style={styles.value}>{data.brandName}</Text>
            <Text style={styles.value}>CIF: {data.brandVat}</Text>
            {data.brandAddress ? <Text style={styles.value}>{data.brandAddress}</Text> : null}
          </View>
          <View style={styles.colHalf}>
            <Text style={styles.label}>DATOS DEL CLIENTE</Text>
            <Text style={styles.value}>{data.clientName}</Text>
            <Text style={styles.value}>CIF: {data.clientVat}</Text>
            {data.clientAddress ? <Text style={styles.value}>{data.clientAddress}</Text> : null}
            {data.clientCity || data.clientPostalCode ? (
              <Text style={styles.value}>
                {[data.clientCity, data.clientPostalCode].filter(Boolean).join(', ')}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={styles.row}>
            <View style={styles.colHalf}>
              <Text style={styles.label}>FECHA DE EMISIÓN</Text>
              <Text style={styles.value}>{data.issueDate}</Text>
            </View>
            <View style={styles.colHalf}>
              <Text style={styles.label}>
                {isMultiLine ? 'SUMINISTROS INCLUIDOS' : 'CUPS'}
              </Text>
              <Text style={styles.value}>
                {isMultiLine
                  ? `${lines.length} puntos de suministro (desglose inferior)`
                  : lines[0]?.cups || '-'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colConcept}>
              <Text style={styles.headerText}>CONCEPTO</Text>
            </View>
            <View style={styles.colAmount}>
              <Text style={styles.headerText}>IMPORTE</Text>
            </View>
          </View>

          {lines.map((line, idx) => (
            <View key={`${line.cups}-${idx}`} style={styles.tableRow} wrap={false}>
              <View style={styles.colConcept}>
                <Text style={{ fontSize: 10, color: '#111827', fontWeight: 'bold', marginBottom: 3 }}>
                  {isAbono
                    ? `Abono / Anulación de penalización por baja anticipada${data.rectifiedInvoiceNumber ? ` (Rectif. ${data.rectifiedInvoiceNumber})` : ''}`
                    : 'Penalización por baja anticipada'}
                  {isMultiLine ? ` · CUPS ${line.cups}` : ''}
                </Text>
                <Text style={{ fontSize: 8.8, color: '#6B7280', marginBottom: 2 }}>
                  {isAbono
                    ? 'Rectificación contable de indemnización por resolución anticipada de contrato'
                    : 'Resolución de contrato antes del fin del compromiso de permanencia'}
                  {line.contractCode ? ` · Contrato: ${line.contractCode}` : ''}
                </Text>
                {!isAbono && line.dailyConsumption !== undefined && (
                  <Text style={{ fontSize: 8.5, color: '#6B7280', marginTop: 2 }}>
                    Base de consumo diario considerado: {Number(line.dailyConsumption || 0).toFixed(2)} kWh/día
                    {line.daysRemaining !== undefined
                      ? ` · Días restantes de permanencia: ${line.daysRemaining} días`
                      : ''}
                  </Text>
                )}
              </View>
              <View style={styles.colAmount}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: isAbono ? '#B91C1C' : '#111827' }}>
                  {Number(line.baseAmount || 0).toFixed(2)} €
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Base Imponible</Text>
            <Text style={styles.totalValue}>{Number(data.baseAmount || 0).toFixed(2)} €</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA (21%)</Text>
            <Text style={styles.totalValue}>{Number(data.taxAmount || 0).toFixed(2)} €</Text>
          </View>
          <View style={styles.totalFinalRow}>
            <Text style={styles.totalLabel}>{isAbono ? 'TOTAL ABONO' : 'TOTAL FACTURA'}</Text>
            <Text style={{ ...styles.totalFinalValue, color: isAbono ? '#B91C1C' : '#111827' }}>
              {Number(data.totalAmount || 0).toFixed(2)} €
            </Text>
          </View>
        </View>

        {!isAbono && data.banks && data.banks.length > 0 && (
          <View
            style={{
              marginTop: 24,
              padding: 12,
              backgroundColor: '#F9FAFB',
              border: '1pt solid #E5E7EB',
              borderRadius: 4,
            }}
            wrap={false}
          >
            <Text style={{ fontSize: 8.8, color: '#4B5563', lineHeight: 1.45, marginBottom: 6 }}>
              Si la forma de pago que tenía contratada era por transferencia bancaria, o si teniendo domiciliación bancaria prefiere liquidar por transferencia, deberá hacerla a cualquiera de los siguientes números de cuenta, indicando en el concepto el número de esta factura:
            </Text>
            {data.banks.map((bank, i) => (
              <Text key={i} style={{ fontSize: 9, fontWeight: 'bold', color: '#111827', marginBottom: 3 }}>
                {bank.name}: {bank.iban}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            {isAbono
              ? 'Este documento constituye una factura rectificativa válida a todos los efectos legales.'
              : 'Este documento es una factura válida a todos los efectos legales.'}
          </Text>
          <Text>
            Inscrita en el Registro Mercantil. {data.brandName} - {data.brandVat}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
