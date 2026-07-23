import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, renderToStream, Image } from '@react-pdf/renderer';
import { Resend } from 'resend';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    borderBottom: '2pt solid #E5E7EB',
    paddingBottom: 20,
  },
  logo: {
    width: 120,
  },
  title: {
    fontSize: 24,
    color: '#111827',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#84CC16', // AED Lime
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottom: '1pt solid #E5E7EB',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    color: '#4B5563',
    width: '40%',
  },
  value: {
    fontSize: 10,
    color: '#111827',
    fontWeight: 'bold',
    width: '60%',
    textAlign: 'right',
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 8,
  },
  priceBox: {
    width: '33%',
    marginBottom: 15,
  },
  priceLabel: {
    fontSize: 9,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center',
    borderTop: '1pt solid #E5E7EB',
    paddingTop: 10,
  },
  autoconsumoBox: {
    backgroundColor: '#FFFBEB',
    border: '1pt solid #FDE68A',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  autoconsumoTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D97706',
    marginBottom: 10,
  }
});

const OfferDocument = ({ lead, prices, offerType }: { lead: any, prices: any, offerType: string }) => {
  const isIndexed = !prices.p1 || Number(prices.p1) === 0 || prices.p1 === '0.000' || prices.p1 === '0';

  return (
  <Document>
    <Page size="A4" style={styles.page}>
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {offerType === 'autoconsumo' ? 'Oferta de Autoconsumo' : 'Oferta de Suministro'}
          </Text>
          <Text style={styles.subtitle}>Referencia: {lead.id ? lead.id.slice(0, 8).toUpperCase() : lead.cups}</Text>
          <Text style={styles.subtitle}>Fecha: {new Date().toLocaleDateString('es-ES')}</Text>
        </View>
      </View>

      {/* Client Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Datos del Cliente</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Titular / Razón Social:</Text>
          <Text style={styles.value}>{lead.businessName || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>NIF / CIF:</Text>
          <Text style={styles.value}>{lead.vatNumber || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Dirección:</Text>
          <Text style={styles.value}>{lead.address || '-'}</Text>
        </View>
      </View>

      {/* Suministro Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Punto de Suministro</Text>
        <View style={styles.row}>
          <Text style={styles.label}>CUPS:</Text>
          <Text style={styles.value}>{lead.cups || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tarifa de Acceso:</Text>
          <Text style={styles.value}>{lead.tariff || '-'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Consumo Estimado:</Text>
          <Text style={styles.value}>{lead.estimatedMWh ? `${Number(lead.estimatedMWh).toFixed(2)} MWh/año` : '-'}</Text>
        </View>
      </View>

      {/* Precios */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Condiciones Económicas</Text>
        
        {isIndexed ? (
          <View style={{ marginTop: 10, padding: 15, backgroundColor: '#F3F4F6', borderRadius: 8 }}>
            <Text style={{ fontSize: 11, color: '#111827', lineHeight: 1.5 }}>
              Término de energía facturado a precio de mercado (Tarifa Indexada) más un margen de comercialización (Fee) de {prices.fee || '0.00'}.
            </Text>
          </View>
        ) : (
          <>
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
            <View style={{ marginTop: 20, padding: 10, backgroundColor: '#ECFCCB', borderRadius: 6 }}>
              <Text style={{ fontSize: 11, color: '#3F6212', fontWeight: 'bold' }}>
                Margen Comercial (Fee): {prices.fee || '0.00'} €/mes
              </Text>
            </View>
          </>
        )}

        {offerType === 'autoconsumo' && (
          <View style={styles.autoconsumoBox}>
            <Text style={styles.autoconsumoTitle}>Condiciones de Autoconsumo (Paneles Solares)</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Excedentes:</Text>
              <Text style={styles.value}>Compensación Simplificada</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Fee Excedentes:</Text>
              <Text style={styles.value}>{prices.feeExcedentes || '0.00'} €</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Bolsillo Solar (Batería Virtual):</Text>
              <Text style={styles.value}>{prices.bolsilloSolar === 'true' || prices.bolsilloSolar === true ? 'INCLUIDO' : 'NO INCLUIDO'}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>AED Energía - Atención al Cliente: clientes@aed-energia.com - Tel. 900 525 826</Text>
        <Text>Av. Gran Capitán, 43, 14008, Córdoba, España</Text>
      </View>

    </Page>
  </Document>
  );
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lead, prices, offerType = 'suministro', action } = body;

    const stream = await renderToStream(<OfferDocument lead={lead} prices={prices} offerType={offerType} />);
    
    if (action === 'send') {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const pdfBuffer = Buffer.concat(chunks);
      
      const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
      const emailTo = lead.email || lead.contactEmail;
      
      if (!emailTo) {
        return NextResponse.json({ success: false, error: 'El cliente no tiene un email válido' }, { status: 400 });
      }

      const isIndexed = !prices.p1 || Number(prices.p1) === 0 || prices.p1 === '0.000' || prices.p1 === '0';
      const termEnergiaText = isIndexed 
        ? `<p>El término de energía se facturará a <strong>precio de mercado (Indexado)</strong> más un pequeño margen de comercialización de ${prices.fee || '0.00'}.</p>`
        : `<p>Se aplicarán precios fijos competitivos durante toda la duración del contrato. Puedes consultar el desglose exacto en el PDF adjunto.</p>`;

      await resend.emails.send({
        from: 'AED Energía <noreply@aed-energia.com>',
        to: [emailTo],
        subject: `Tu Oferta de ${offerType === 'autoconsumo' ? 'Autoconsumo' : 'Suministro'} - AED Energía`,
        html: `
          <div style="font-family: sans-serif; color: #333; line-height: 1.5; max-width: 600px; margin: 0 auto;">
            <h2>Hola ${lead.businessName || 'cliente'},</h2>
            <p>Adjuntamos la oferta personalizada para tu punto de suministro con CUPS <strong>${lead.cups || ''}</strong>.</p>
            ${termEnergiaText}
            <p>Si tienes cualquier duda, contacta con nosotros.</p>
            <p>Un saludo,<br><strong>El equipo de AED Energía</strong></p>
          </div>
        `,
        attachments: [
          {
            filename: `Oferta_${offerType.toUpperCase()}_AED_${lead.cups || lead.id}.pdf`,
            content: pdfBuffer,
          }
        ]
      });

      return NextResponse.json({ success: true });
    }

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
        'Content-Disposition': `attachment; filename="Oferta_${offerType.toUpperCase()}_AED_${lead.cups || lead.id}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
