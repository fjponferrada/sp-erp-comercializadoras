import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 12, color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  section: { marginVertical: 10 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, borderBottom: '1 solid #ccc', paddingBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  bold: { fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 10, color: 'grey' }
});

export const InvoicePdfTemplate = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>FACTURA DE LUZ</Text>
          <Text>Nº Factura: {data.invoiceNumber || 'Borrador'}</Text>
          <Text>Fecha de Emisión: {data.issueDate ? new Date(data.issueDate).toLocaleDateString() : '-'}</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={styles.bold}>Nuestra Comercializadora S.L.</Text>
          <Text>NIF: B-00000000</Text>
          <Text>Calle Ejemplo 123, Madrid</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DATOS DEL CLIENTE</Text>
        <Text style={styles.bold}>{data.clientName}</Text>
        <Text>NIF/CIF: {data.clientNif}</Text>
        <Text>CUPS: {data.cups}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DETALLES DE FACTURACIÓN</Text>
        <View style={styles.row}>
          <Text>Periodo Facturado:</Text>
          <Text>{data.billingStart ? new Date(data.billingStart).toLocaleDateString() : '-'} a {data.billingEnd ? new Date(data.billingEnd).toLocaleDateString() : '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text>Consumo Total:</Text>
          <Text>{data.totalMWh ? (data.totalMWh * 1000).toFixed(2) : '0.00'} kWh</Text>
        </View>
      </View>

      <View style={{ ...styles.section, marginTop: 20 }}>
        <Text style={styles.sectionTitle}>RESUMEN ECONÓMICO</Text>

        {data.invoiceData?.energyCost !== undefined && (
          <View style={{ marginBottom: 10 }}>
            <View style={styles.row}>
              <Text>Coste de Energía (Mercado + Fee):</Text>
              <Text>{((data.invoiceData.energyCost || 0) + (data.invoiceData.feeApplied || 0) * (data.totalMWh || 0)).toFixed(2)} €</Text>
            </View>
            <View style={styles.row}>
              <Text>Cargos y Pagos Regulados (Capacidad + FNEE):</Text>
              <Text>{((data.invoiceData.capacityCost || 0) + (data.invoiceData.fneeCost || 0)).toFixed(2)} €</Text>
            </View>
            <View style={styles.row}>
              <Text>Término de Potencia:</Text>
              <Text>{(data.invoiceData.powerCost || 0).toFixed(2)} €</Text>
            </View>
          </View>
        )}

        <View style={{ ...styles.row, borderTop: '1 solid #eee', paddingTop: 5 }}>
          <Text style={styles.bold}>Base Imponible:</Text>
          <Text style={styles.bold}>{data.subtotal1?.toFixed(2) || '0.00'} €</Text>
        </View>
        <View style={styles.row}>
          <Text>Impuesto IVA ({data.taxPercentage || 21}%):</Text>
          <Text>{data.taxAmount?.toFixed(2) || '0.00'} €</Text>
        </View>
        <View style={{ ...styles.row, marginTop: 10, paddingTop: 5, borderTop: '2 solid #333' }}>
          <Text style={{ ...styles.bold, fontSize: 16 }}>TOTAL FACTURA:</Text>
          <Text style={{ ...styles.bold, fontSize: 16 }}>{data.totalAmount?.toFixed(2) || '0.00'} €</Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Plantilla nativa de React-PDF. Ubicación: src/components/pdf/InvoicePdfTemplate.tsx
      </Text>
    </Page>
  </Document>
);
