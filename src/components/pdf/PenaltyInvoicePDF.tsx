import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40, borderBottom: '2pt solid #E5E7EB', paddingBottom: 20 },
  logo: { width: 120 },
  title: { fontSize: 24, color: '#111827', fontWeight: 'bold' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  colHalf: { width: '48%' },
  label: { fontSize: 9, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 11, color: '#111827' },
  table: { marginTop: 30, borderTop: '1pt solid #E5E7EB' },
  tableHeader: { flexDirection: 'row', borderBottom: '1pt solid #E5E7EB', paddingVertical: 8, backgroundColor: '#F9FAFB' },
  tableRow: { flexDirection: 'row', borderBottom: '1pt solid #E5E7EB', paddingVertical: 12 },
  colConcept: { flex: 1, paddingLeft: 8 },
  colAmount: { width: '20%', textAlign: 'right', paddingRight: 8 },
  headerText: { fontSize: 9, fontWeight: 'bold', color: '#4B5563' },
  totals: { marginTop: 20, alignSelf: 'flex-end', width: '40%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 10, color: '#4B5563' },
  totalValue: { fontSize: 11, fontWeight: 'bold', color: '#111827' },
  totalFinalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '2pt solid #111827' },
  totalFinalValue: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#9CA3AF', borderTop: '1pt solid #E5E7EB', paddingTop: 10 }
});

export const PenaltyInvoicePDF = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          {data.brandLogo ? <Image src={data.brandLogo} style={styles.logo} /> : <Text style={styles.title}>{data.brandName}</Text>}
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={styles.title}>FACTURA</Text>
          <Text style={styles.subtitle}>{data.invoiceNumber}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.colHalf}>
          <Text style={styles.label}>DATOS DEL EMISOR</Text>
          <Text style={styles.value}>{data.brandName}</Text>
          <Text style={styles.value}>CIF: {data.brandVat}</Text>
          <Text style={styles.value}>{data.brandAddress}</Text>
        </View>
        <View style={styles.colHalf}>
          <Text style={styles.label}>DATOS DEL CLIENTE</Text>
          <Text style={styles.value}>{data.clientName}</Text>
          <Text style={styles.value}>CIF: {data.clientVat}</Text>
          <Text style={styles.value}>{data.clientAddress}</Text>
          <Text style={styles.value}>{data.clientCity}, {data.clientPostalCode}</Text>
        </View>
      </View>

      <View style={{ marginTop: 20 }}>
        <View style={styles.row}>
          <View style={styles.colHalf}>
            <Text style={styles.label}>FECHA DE EMISIÓN</Text>
            <Text style={styles.value}>{data.issueDate}</Text>
          </View>
          <View style={styles.colHalf}>
            <Text style={styles.label}>CUPS</Text>
            <Text style={styles.value}>{data.cups}</Text>
          </View>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={styles.colConcept}><Text style={styles.headerText}>CONCEPTO</Text></View>
          <View style={styles.colAmount}><Text style={styles.headerText}>IMPORTE</Text></View>
        </View>
        <View style={styles.tableRow}>
          <View style={styles.colConcept}>
            <Text style={{ fontSize: 10, color: '#111827', marginBottom: 4 }}>Penalización por baja anticipada</Text>
            <Text style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>Resolución de contrato antes del fin de la permanencia</Text>
            {data.daysRemaining !== undefined && (
              <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 4 }}>
                Base de consumo diario considerado: {data.dailyConsumption ? data.dailyConsumption.toFixed(2) : '0.00'} kWh/día
              </Text>
            )}
            {data.daysRemaining !== undefined && (
              <Text style={{ fontSize: 9, color: '#6B7280' }}>
                Días restantes hasta finalización de contrato: {data.daysRemaining} días
              </Text>
            )}
          </View>
          <View style={styles.colAmount}>
            <Text style={{ fontSize: 10 }}>{data.baseAmount.toFixed(2)} €</Text>
          </View>
        </View>
      </View>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Base Imponible</Text>
          <Text style={styles.totalValue}>{data.baseAmount.toFixed(2)} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>IVA (21%)</Text>
          <Text style={styles.totalValue}>{data.taxAmount.toFixed(2)} €</Text>
        </View>
        <View style={styles.totalFinalRow}>
          <Text style={styles.totalLabel}>TOTAL FACTURA</Text>
          <Text style={styles.totalFinalValue}>{data.totalAmount.toFixed(2)} €</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text>Este documento es una factura válida a todos los efectos legales.</Text>
        <Text>Inscrita en el Registro Mercantil. {data.brandName} - {data.brandVat}</Text>
      </View>
    </Page>
  </Document>
);
