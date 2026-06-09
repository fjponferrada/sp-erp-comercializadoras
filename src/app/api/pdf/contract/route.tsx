import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, renderToStream } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: '2pt solid #000000',
    paddingBottom: 15,
  },
  title: {
    fontSize: 20,
    color: '#000000',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 10,
    color: '#4B5563',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#000000',
    fontWeight: 'bold',
    backgroundColor: '#F3F4F6',
    padding: 5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 9,
    color: '#4B5563',
    width: '30%',
  },
  value: {
    fontSize: 9,
    color: '#111827',
    fontWeight: 'bold',
    width: '70%',
  },
  gridBox: {
    border: '1pt solid #D1D5DB',
    padding: 10,
    marginTop: 5,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
    border: '1pt solid #D1D5DB',
    padding: 10,
  },
  priceBox: {
    width: '33%',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 8,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 11,
    color: '#111827',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#9CA3AF',
    textAlign: 'center',
    borderTop: '1pt solid #E5E7EB',
    paddingTop: 10,
  },
  legalText: {
    fontSize: 7,
    color: '#4B5563',
    lineHeight: 1.4,
    marginTop: 10,
    textAlign: 'justify'
  },
  signatureBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  signArea: {
    width: '45%',
    borderTop: '1pt solid #000',
    paddingTop: 5,
    textAlign: 'center',
  },
  signText: {
    fontSize: 9,
    fontWeight: 'bold'
  }
});

const ContractDocument = ({ contract, lead, prices }: { contract: any, lead: any, prices: any }) => {
  const d = new Date().toLocaleDateString('es-ES');
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>CONTRATO DE SUMINISTRO ELÉCTRICO</Text>
            <Text style={styles.subtitle}>Referencia de Contrato: {contract.id}</Text>
            <Text style={styles.subtitle}>Fecha de Generación: {d}</Text>
          </View>
        </View>

        {/* Client Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. DATOS DEL TITULAR</Text>
          <View style={styles.gridBox}>
            <View style={styles.row}>
              <Text style={styles.label}>Titular / Razón Social:</Text>
              <Text style={styles.value}>{lead.businessName || '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>NIF / CIF:</Text>
              <Text style={styles.value}>{lead.vatNumber || '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Dirección Fiscal:</Text>
              <Text style={styles.value}>{lead.address || '-'} - {lead.zipCode || ''} {lead.city || ''}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Representante Legal:</Text>
              <Text style={styles.value}>{(lead.contactName || '') + ' ' + (lead.contactLastName || '')}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Email / Teléfono:</Text>
              <Text style={styles.value}>{lead.email || '-'} / {lead.phone || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Suministro Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. DATOS DEL PUNTO DE SUMINISTRO</Text>
          <View style={styles.gridBox}>
            <View style={styles.row}>
              <Text style={styles.label}>CUPS:</Text>
              <Text style={styles.value}>{lead.cups || '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tarifa de Acceso:</Text>
              <Text style={styles.value}>{lead.tariff || '-'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Dirección de Suministro:</Text>
              <Text style={styles.value}>{lead.supplyAddress || lead.address || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Precios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. CONDICIONES ECONÓMICAS (€/kWh)</Text>
          <View style={styles.priceGrid}>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>P1 (Punta)</Text>
              <Text style={styles.priceValue}>{prices.p1}</Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>P2 (Llano)</Text>
              <Text style={styles.priceValue}>{prices.p2}</Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>P3 (Valle)</Text>
              <Text style={styles.priceValue}>{prices.p3}</Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>P4</Text>
              <Text style={styles.priceValue}>{prices.p4}</Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>P5</Text>
              <Text style={styles.priceValue}>{prices.p5}</Text>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>P6</Text>
              <Text style={styles.priceValue}>{prices.p6}</Text>
            </View>
          </View>
          <View style={{ marginTop: 5 }}>
            <Text style={{ fontSize: 9, color: '#000', fontWeight: 'bold' }}>
              Fee Comercial: {prices.fee || '0.00'} €/mes
            </Text>
          </View>
        </View>

        {/* Bank */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. DOMICILIACIÓN BANCARIA (SEPA)</Text>
          <View style={styles.gridBox}>
            <View style={styles.row}>
              <Text style={styles.label}>IBAN:</Text>
              <Text style={styles.value}>{lead.iban || 'ES......................'}</Text>
            </View>
            <Text style={styles.legalText}>
              Mediante la firma de este documento, el deudor autoriza a AED Energía a enviar instrucciones a la entidad del deudor para adeudar en su cuenta y a la entidad para efectuar los adeudos en su cuenta siguiendo las instrucciones del acreedor.
            </Text>
          </View>
        </View>

        {/* Firmas */}
        <View style={styles.signatureBox}>
          <View style={styles.signArea}>
            <Text style={styles.signText}>EL CLIENTE / TITULAR</Text>
            <Text style={{ fontSize: 7, marginTop: 4, color: '#6B7280' }}>{lead.businessName || lead.firstName}</Text>
            <Text style={{ fontSize: 7, color: '#6B7280' }}>NIF/CIF: {lead.vatNumber}</Text>
          </View>
          <View style={styles.signArea}>
            <Text style={styles.signText}>LA COMERCIALIZADORA</Text>
            <Text style={{ fontSize: 7, marginTop: 4, color: '#6B7280' }}>AED Energía</Text>
            <Text style={{ fontSize: 7, color: '#6B7280' }}>Firma Autorizada</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>AED Energía - Atención al Cliente: clientes@aed-energia.com - Tel. 900 525 826</Text>
          <Text>Condiciones Generales del Contrato disponibles en www.aed-energia.com</Text>
        </View>

      </Page>
    </Document>
  );
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contract, lead, prices } = body;

    const stream = await renderToStream(<ContractDocument contract={contract} lead={lead} prices={prices} />);
    
    // Convert Node.js stream to Web stream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      }
    });

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Contrato_AED_${lead?.cups || contract.id}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating contract PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
