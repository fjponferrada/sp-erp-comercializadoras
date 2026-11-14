import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { Page, Text, View, Document, StyleSheet, renderToStream } from '@react-pdf/renderer';
import { Resend } from 'resend';
import { auth } from '@/auth';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22,
    borderBottom: '2pt solid #84CC16',
    paddingBottom: 14,
  },
  brandBadge: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#3F6212',
    backgroundColor: '#ECFCCB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  title: {
    fontSize: 20,
    color: '#111827',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 3,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#4D7C0F',
    fontWeight: 'bold',
    marginBottom: 8,
    borderBottom: '1pt solid #E5E7EB',
    paddingBottom: 4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 9.5,
    color: '#4B5563',
    width: '38%',
  },
  value: {
    fontSize: 9.5,
    color: '#111827',
    fontWeight: 'bold',
    width: '62%',
    textAlign: 'right',
  },
  subHeading: {
    fontSize: 9.5,
    color: '#374151',
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 5,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F9FAFB',
    border: '1pt solid #E5E7EB',
    padding: 10,
    borderRadius: 6,
  },
  priceBox: {
    width: '33%',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 8.5,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 11.5,
    color: '#111827',
    fontWeight: 'bold',
    marginTop: 1,
  },
  savingsBox: {
    backgroundColor: '#ECFCCB',
    border: '1pt solid #BEF264',
    padding: 12,
    borderRadius: 6,
    marginBottom: 18,
  },
  savingsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#3F6212',
    marginBottom: 6,
  },
  autoconsumoBox: {
    backgroundColor: '#FFFBEB',
    border: '1pt solid #FDE68A',
    padding: 12,
    borderRadius: 6,
    marginTop: 10,
  },
  autoconsumoTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#B45309',
    marginBottom: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center',
    borderTop: '1pt solid #E5E7EB',
    paddingTop: 8,
  },
});

const OfferDocument = ({ lead, prices, offerType }: { lead: any; prices: any; offerType: string }) => {
  const is20TD = (lead.tariff || '2.0TD') === '2.0TD';
  const isIndexed =
    prices.isIndexed === true ||
    (!prices.p1 || Number(prices.p1) === 0 || prices.p1 === '0.000' || prices.p1 === '0');
  const hasPowerPrices = Number(prices.p1p || 0) > 0 || Number(prices.p2p || 0) > 0;
  const hasComparison = Boolean(lead.monthlyExpense || lead.savings || lead.comparative);

  const powerSummary = is20TD
    ? `P1: ${lead.p1c || '-'} kW | P2: ${lead.p2c || '-'} kW`
    : `P1: ${lead.p1c || '-'} | P2: ${lead.p2c || '-'} | P3: ${lead.p3c || '-'} | P4: ${lead.p4c || '-'} | P5: ${lead.p5c || '-'} | P6: ${lead.p6c || '-'} kW`;

  const energyPeriods = is20TD
    ? [
        { label: 'P1 (Punta)', val: prices.p1 },
        { label: 'P2 (Llano)', val: prices.p2 },
        { label: 'P3 (Valle)', val: prices.p3 },
      ]
    : [
        { label: 'P1', val: prices.p1 },
        { label: 'P2', val: prices.p2 },
        { label: 'P3', val: prices.p3 },
        { label: 'P4', val: prices.p4 },
        { label: 'P5', val: prices.p5 },
        { label: 'P6', val: prices.p6 },
      ];

  const powerPeriods = is20TD
    ? [
        { label: 'P1 Potencia', val: prices.p1p },
        { label: 'P2 Potencia', val: prices.p2p },
      ]
    : [
        { label: 'P1 Potencia', val: prices.p1p },
        { label: 'P2 Potencia', val: prices.p2p },
        { label: 'P3 Potencia', val: prices.p3p },
        { label: 'P4 Potencia', val: prices.p4p },
        { label: 'P5 Potencia', val: prices.p5p },
        { label: 'P6 Potencia', val: prices.p6p },
      ];

  const brandName = lead.brandName || 'AED Energía';
  const brandEmail = lead.brandEmail || 'clientes@aed-energia.com';
  const brandPhone = lead.brandPhone || '900 525 826';
  const brandAddress = lead.brandAddress || 'España';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>
              {offerType === 'autoconsumo' ? 'Oferta Comercial de Autoconsumo' : 'Oferta de Suministro Eléctrico'}
            </Text>
            <Text style={styles.subtitle}>
              Referencia: {lead.id ? lead.id.slice(0, 8).toUpperCase() : lead.cups || '-'} · Fecha:{' '}
              {new Date().toLocaleDateString('es-ES')}
            </Text>
          </View>
          <Text style={styles.brandBadge}>{brandName}</Text>
        </View>

        {/* Datos del Cliente y Suministro */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Titular y Punto de Suministro</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Titular / Razón Social:</Text>
            <Text style={styles.value}>{lead.businessName || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>NIF / CIF:</Text>
            <Text style={styles.value}>{lead.vatNumber || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Dirección Suministro:</Text>
            <Text style={styles.value}>{lead.address || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>CUPS:</Text>
            <Text style={styles.value}>{lead.cups || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tarifa ATR y Potencias:</Text>
            <Text style={styles.value}>
              {lead.tariff || '2.0TD'} ({powerSummary})
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Consumo Anual Estimado:</Text>
            <Text style={styles.value}>
              {lead.estimatedMWh
                ? `${Number(lead.estimatedMWh).toFixed(3)} MWh/año (${Math.round(Number(lead.estimatedMWh) * 1000).toLocaleString('es-ES')} kWh)`
                : '-'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Producto Ofertado:</Text>
            <Text style={styles.value}>
              {lead.productName || lead.product || '-'} {lead.productType ? `(${lead.productType})` : ''}
            </Text>
          </View>
        </View>

        {/* Comparativa de Ahorro (opcional) */}
        {hasComparison && (
          <View style={styles.savingsBox}>
            <Text style={styles.savingsTitle}>Resumen del Estudio Comparativo</Text>
            {lead.monthlyExpense && (
              <View style={styles.row}>
                <Text style={styles.label}>Gasto Mensual Actual:</Text>
                <Text style={styles.value}>{lead.monthlyExpense} €/mes</Text>
              </View>
            )}
            {lead.savings && (
              <View style={styles.row}>
                <Text style={styles.label}>Ahorro Anual Estimado:</Text>
                <Text style={{ ...styles.value, color: '#3F6212', fontSize: 11 }}>
                  {Number(lead.savings).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/año
                </Text>
              </View>
            )}
            {lead.comparative && (
              <View style={styles.row}>
                <Text style={styles.label}>Detalle:</Text>
                <Text style={styles.value}>{lead.comparative}</Text>
              </View>
            )}
          </View>
        )}

        {/* Condiciones Económicas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Condiciones Económicas Ofertadas (Sin Impuestos)</Text>

          {isIndexed ? (
            <View style={{ padding: 12, backgroundColor: '#F3F4F6', borderRadius: 6, marginBottom: 8 }}>
              <Text style={{ fontSize: 10, color: '#111827', lineHeight: 1.5 }}>
                Modalidad Indexada Pass-Through: Término de energía facturado a coste horario de mercado mayorista más peajes y cargos regulados, con un margen de comercialización (Fee) de {prices.fee || '0.00'} €.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.subHeading}>Término de Energía (€/kWh)</Text>
              <View style={styles.priceGrid}>
                {energyPeriods.map((ep) => (
                  <View key={ep.label} style={styles.priceBox}>
                    <Text style={styles.priceLabel}>{ep.label}</Text>
                    <Text style={styles.priceValue}>{ep.val && ep.val !== '0' ? `${ep.val} €/kWh` : '-'}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {hasPowerPrices && (
            <>
              <Text style={styles.subHeading}>Término de Potencia (€/kW/día)</Text>
              <View style={styles.priceGrid}>
                {powerPeriods.map((pp) => (
                  <View key={pp.label} style={styles.priceBox}>
                    <Text style={styles.priceLabel}>{pp.label}</Text>
                    <Text style={styles.priceValue}>{pp.val && pp.val !== '0' ? `${pp.val} €/kW/día` : '-'}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {offerType === 'autoconsumo' && (
            <View style={styles.autoconsumoBox}>
              <Text style={styles.autoconsumoTitle}>Condiciones de Autoconsumo y Excedentes</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Compensación de Excedentes:</Text>
                <Text style={styles.value}>
                  {prices.pexc && Number(prices.pexc) > 0 ? `${prices.pexc} €/kWh` : 'Precio de mercado / Simplificada'}
                </Text>
              </View>
              {prices.feeExcedentes && Number(prices.feeExcedentes) > 0 && (
                <View style={styles.row}>
                  <Text style={styles.label}>Coste Gestión Excedentes:</Text>
                  <Text style={styles.value}>{prices.feeExcedentes} €</Text>
                </View>
              )}
              <View style={styles.row}>
                <Text style={styles.label}>Bolsillo Solar (Batería Virtual):</Text>
                <Text style={styles.value}>
                  {prices.bolsilloSolar === 'true' || prices.bolsilloSolar === true
                    ? `INCLUIDO${prices.cgBolsilloSolar ? ` (${prices.cgBolsilloSolar} €/día)` : ''}`
                    : 'NO INCLUIDO'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            {brandName} · Atención al Cliente: {brandEmail} · Tel. {brandPhone}
          </Text>
          {brandAddress ? <Text>{brandAddress}</Text> : null}
          <Text style={{ marginTop: 2 }}>
            Oferta informativa sujeta a validación técnica de ATR/SIPS. Impuesto Eléctrico, alquiler de contador e IVA/IGIC aplicables según normativa vigente.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { lead, prices, offerType = 'suministro', action } = body;

    const brandName = lead?.brandName || 'AED Energía';
    const brandCode = lead?.brandCode || 'AED';

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

      const isIndexed =
        prices.isIndexed === true ||
        (!prices.p1 || Number(prices.p1) === 0 || prices.p1 === '0.000' || prices.p1 === '0');
      const termEnergiaText = isIndexed
        ? `<p>El término de energía se facturará en modalidad <strong>Indexada Pass-Through</strong> con un margen de comercialización (Fee) de ${prices.fee || '0.00'} €.</p>`
        : `<p>Se aplicarán precios fijos competitivos (${lead.productName || 'Tarifa Fija'}). Puedes consultar el desglose completo por periodos en el PDF adjunto.</p>`;

      await resend.emails.send({
        from: `${brandName} <noreply@aed-energia.com>`,
        to: [emailTo],
        subject: `Tu Oferta de ${offerType === 'autoconsumo' ? 'Autoconsumo' : 'Suministro Eléctrico'} - ${brandName}`,
        html: `
          <div style="font-family: sans-serif; color: #333; line-height: 1.5; max-width: 600px; margin: 0 auto;">
            <h2>Hola ${lead.businessName || 'cliente'},</h2>
            <p>Adjuntamos la propuesta comercial personalizada para tu punto de suministro${lead.cups ? ` con CUPS <strong>${lead.cups}</strong>` : ''}.</p>
            ${termEnergiaText}
            ${lead.savings ? `<p><strong>Ahorro anual estimado:</strong> ${Number(lead.savings).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/año.</p>` : ''}
            <p>Si deseas activar la oferta o tienes cualquier consulta, estamos a tu disposición.</p>
            <p>Un saludo,<br><strong>El equipo de ${brandName}</strong></p>
          </div>
        `,
        attachments: [
          {
            filename: `Oferta_${offerType.toUpperCase()}_${brandCode}_${lead.cups || lead.id}.pdf`,
            content: pdfBuffer,
          },
        ],
      });

      return NextResponse.json({ success: true });
    }

    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Oferta_${offerType.toUpperCase()}_${brandCode}_${lead.cups || lead.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
