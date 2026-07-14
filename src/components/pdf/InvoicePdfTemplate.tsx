import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Svg, Circle, Polygon, Line, Rect } from '@react-pdf/renderer';

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  brand:    '#1a3a5c',  // deep navy
  accent:   '#e8622a',  // vivid orange
  accentLt: '#fdf0ea',  // very light orange tint
  navy2:    '#2c5282',  // medium navy
  navyLt:   '#ebf4ff',  // very light navy
  rowAlt:   '#f7f9fc',  // subtle row stripe
  border:   '#c8d5e3',  // cool grey border
  text:     '#1a202c',  // near-black
  muted:    '#64748b',  // slate grey
  white:    '#ffffff',
  green:    '#00a651',
  totalBg:  '#1a3a5c',
};

const styles = StyleSheet.create({
  // ─── Page ──────────────────────────────────────────────────────────────────
  page: { padding: '28 32', fontFamily: 'Helvetica', fontSize: 7.5, color: C.text, backgroundColor: C.white },

  // ─── Header banner ─────────────────────────────────────────────────────────
  headerBand: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: C.brand, padding: '14 16', marginBottom: 10, borderRadius: 3,
  },
  companyName: { color: C.white, fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  companyTagline: { color: '#a8c4e0', fontSize: 7 },
  invoiceBadge: {
    backgroundColor: C.accent, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 4, alignItems: 'center', justifyContent: 'center',
  },
  invoiceBadgeText: { color: C.white, fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  invoiceBadgeSub: { color: '#fde5d8', fontSize: 6.5, marginTop: 2 },

  // ─── Info grid ─────────────────────────────────────────────────────────────
  infoGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  infoBox: {
    flex: 1, border: `1 solid ${C.border}`, borderRadius: 3, overflow: 'hidden',
  },
  infoBoxHeader: {
    backgroundColor: C.brand, paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center',
  },
  infoBoxHeaderAccent: {
    backgroundColor: C.accent, paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center',
  },
  infoBoxTitle: { color: C.white, fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  infoBoxBody: { padding: '6 8', backgroundColor: C.white },
  infoRow: { flexDirection: 'row', marginBottom: 2.5 },
  infoLabel: { width: 90, color: C.muted, fontSize: 7 },
  infoLabelWide: { width: 120, color: C.muted, fontSize: 7 },
  infoValue: { flex: 1, fontSize: 7.5 },
  infoValueRight: { flex: 1, textAlign: 'right', fontSize: 7.5 },
  totalPayBand: {
    backgroundColor: C.accentLt, borderTop: `1 solid ${C.accent}`,
    flexDirection: 'row', justifyContent: 'space-between', padding: '5 8', marginTop: 3,
  },
  totalPayLabel: { color: C.accent, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  totalPayValue: { color: C.accent, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  // ─── Section title ─────────────────────────────────────────────────────────
  sectionBar: {
    backgroundColor: C.brand, paddingHorizontal: 8, paddingVertical: 4,
    marginTop: 10, marginBottom: 0, borderRadius: '2 2 0 0',
  },
  sectionBarText: { color: C.white, fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

  // ─── Main detail table ─────────────────────────────────────────────────────
  tableWrap: { border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', overflow: 'hidden' },
  tableHead: {
    flexDirection: 'row', backgroundColor: C.navy2,
    paddingVertical: 4, paddingHorizontal: 2,
  },
  thConcept:  { flex: 4.5, color: C.white, fontFamily: 'Helvetica-Bold', paddingLeft: 6, fontSize: 7 },
  thCenter:   { flex: 1,   color: C.white, fontFamily: 'Helvetica-Bold', textAlign: 'center', fontSize: 7 },
  thRight:    { flex: 1.5, color: C.white, fontFamily: 'Helvetica-Bold', textAlign: 'right', paddingRight: 6, fontSize: 7 },

  groupHeader: {
    flexDirection: 'row', backgroundColor: C.navyLt,
    paddingVertical: 3.5, paddingHorizontal: 2, borderTop: `1 solid ${C.border}`,
  },
  ghLabel: { flex: 4.5, fontFamily: 'Helvetica-Bold', color: C.brand, paddingLeft: 6, fontSize: 7.5 },
  ghUnit:  { flex: 1,   fontFamily: 'Helvetica-Bold', color: C.muted, textAlign: 'center', fontSize: 7 },
  ghRight: { flex: 1.5, backgroundColor: C.accentLt, textAlign: 'right', paddingRight: 6, fontSize: 7 },

  dataRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 2, borderTop: `0.5 solid ${C.border}` },
  dataRowAlt: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 2, borderTop: `0.5 solid ${C.border}`, backgroundColor: C.rowAlt },
  drConcept: { flex: 4.5, paddingLeft: 14 },
  drConceptText: { fontSize: 7.5, color: C.text },
  drSubtext: { fontSize: 6, color: C.muted, marginTop: 1 },
  drCenter: { flex: 1,   textAlign: 'center', color: C.text },
  drRight:  { flex: 1.5, textAlign: 'right', paddingRight: 6, backgroundColor: C.accentLt, color: C.text },

  extraRow: { flexDirection: 'row', paddingVertical: 2.5, paddingHorizontal: 2, borderTop: `0.5 solid ${C.border}` },
  erConcept: { flex: 4.5, paddingLeft: 6 },
  erCenter:  { flex: 1, textAlign: 'center', color: C.text },
  erRight:   { flex: 1.5, textAlign: 'right', paddingRight: 6, backgroundColor: C.accentLt },

  // ─── Totals ────────────────────────────────────────────────────────────────
  totalsWrap: { flexDirection: 'row', marginTop: 6 },
  totalsLeft: { flex: 1 },
  totalsRight: {
    width: 180, border: `1 solid ${C.border}`, borderRadius: 3, overflow: 'hidden',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: '4 8', borderBottom: `0.5 solid ${C.border}` },
  totalLabelGrey: { color: C.muted, fontSize: 7.5 },
  totalValGrey: { color: C.text, fontSize: 7.5 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: '7 8', backgroundColor: C.totalBg },
  grandTotalLabel: { color: C.white, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  grandTotalVal: { color: C.accent, fontSize: 10, fontFamily: 'Helvetica-Bold' },

  // ─── Bolsillo Solar ────────────────────────────────────────────────────────
  solarWrap: { marginTop: 12, width: '65%' },
  solarTitle: {
    backgroundColor: C.green, paddingHorizontal: 10, paddingVertical: 4, borderRadius: '3 3 0 0',
  },
  solarTitleText: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  solarTable: { border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', overflow: 'hidden' },
  solarHead: { flexDirection: 'row', backgroundColor: '#e6f4ee' },
  solarHeadCell: { flex: 1, textAlign: 'center', padding: '3 2', fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#1a4731', borderRight: `0.5 solid ${C.border}` },
  solarHeadCellLast: { flex: 1, textAlign: 'center', padding: '3 2', fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#1a4731' },
  solarCell: { flex: 1, textAlign: 'center', padding: '4 2', borderRight: `0.5 solid ${C.border}`, fontSize: 7.5 },
  solarCellLast: { flex: 1, textAlign: 'center', padding: '4 2', fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.green },

  // ─── Legal note ────────────────────────────────────────────────────────────
  legalText: { marginTop: 14, fontSize: 5.5, color: C.muted, textAlign: 'justify', lineHeight: 1.4 },

  // ─── Page 2 styles ─────────────────────────────────────────────────────────
  p2SectionBar: {
    backgroundColor: C.brand, paddingHorizontal: 8, paddingVertical: 4,
    marginTop: 14, marginBottom: 0, borderRadius: '2 2 0 0', flexDirection: 'row', alignItems: 'center',
  },
  p2SectionBarAccent: {
    backgroundColor: C.accent, paddingHorizontal: 8, paddingVertical: 4,
    marginTop: 14, marginBottom: 0, borderRadius: '2 2 0 0', flexDirection: 'row', alignItems: 'center',
  },
  p2SectionBarText: { color: C.white, fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

  consTableWrap: { border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', overflow: 'hidden', marginBottom: 4 },
  consGroupHead: {
    flexDirection: 'row', backgroundColor: C.navy2,
  },
  consSubHead: {
    flexDirection: 'row', backgroundColor: C.navyLt, borderBottom: `1 solid ${C.border}`,
  },
  consSubHeadCell: { flex: 1, padding: '3 2', textAlign: 'center', color: C.brand, fontFamily: 'Helvetica-Bold', fontSize: 6.5, borderRight: `0.5 solid ${C.border}` },
  consSubHeadCellLast: { flex: 1, padding: '3 2', textAlign: 'center', color: C.brand, fontFamily: 'Helvetica-Bold', fontSize: 6.5 },
  consGroupHeadCell: { flex: 3, padding: '4 2', textAlign: 'center', color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 7, borderRight: `0.5 solid rgba(255,255,255,0.3)` },
  consGroupHeadCellFirst: { flex: 1, padding: '4 2', color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 7, borderRight: `0.5 solid rgba(255,255,255,0.3)` },
  consGroupHeadCellLast: { flex: 1, padding: '4 2', textAlign: 'center', color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 7 },
  consDataRow: { flexDirection: 'row', borderTop: `0.5 solid ${C.border}` },
  consDataRowAlt: { flexDirection: 'row', borderTop: `0.5 solid ${C.border}`, backgroundColor: C.rowAlt },
  consCell: { flex: 1, padding: '3 2', textAlign: 'center', borderRight: `0.5 solid ${C.border}`, fontSize: 7 },
  consCellBold: { flex: 1, padding: '3 2', textAlign: 'center', borderRight: `0.5 solid ${C.border}`, fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.brand },
  consCellLast: { flex: 1, padding: '3 2', textAlign: 'center', fontSize: 7 },
  consFooterRow: { flexDirection: 'row', borderTop: `1 solid ${C.border}`, backgroundColor: C.navyLt },
  consFooterLabel: { flex: 2, padding: '3 6', fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.brand },
  consFooterVal: { flex: 1, padding: '3 2', textAlign: 'center', fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.brand, borderLeft: `0.5 solid ${C.border}` },
  consFooterEmpty: { flex: 4, padding: '3 2' },
});

// ─── Helper ────────────────────────────────────────────────────────────────────
function fmt(n: number | undefined, dec = 2): string {
  if (n === undefined || n === null || isNaN(n)) return '-';
  return n.toFixed(dec);
}

// ─── Component ────────────────────────────────────────────────────────────────
export const InvoicePdfTemplate = ({ data }: { data: any }) => {
  const {
    invoiceNumber, issueDate, billingStart, billingEnd,
    clientName, clientNif, clientAddress, cups, tariff, contractedPower,
    powerDetails = [], energyAtrDetails = [], energyMarketDetails = [], reactiveDetails = [],
    alquilerEquipo = 0, bonoSocial = 0, taxElectric = 0, excesosPotencia = 0,
    excedentesAutoconsumo = 0, maxExcedentes = 0, bolsilloSolarLlenado = 0, excedentesKwh = 0,
    f1Readings = null, svaCost = 0, svaConcept = '',
    subtotal1 = 0, taxPercentage = 21, taxAmount = 0, totalAmount = 0,
  } = data;

  const fmtDate = (d: string | Date) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
  const ieeRate = 5.11269;
  const baseIEE = taxElectric ? taxElectric / (ieeRate / 100) : 0;
  const days = powerDetails.length > 0 ? powerDetails[0].days?.toFixed(0) : 30;

  // ─── Consumption data from F1 ─────────────────────────────────────────────
  let consumos: any[] = [
    { p: 'P1', actIni: '-', actFin: '-', act: 0, reactIni: '-', reactFin: '-', reac: 0, max: 0 },
    { p: 'P2', actIni: '-', actFin: '-', act: 0, reactIni: '-', reactFin: '-', reac: 0, max: 0 },
    { p: 'P3', actIni: '-', actFin: '-', act: 0, reactIni: '-', reactFin: '-', reac: 0, max: 0 },
    { p: 'P4', actIni: '-', actFin: '-', act: 0, reactIni: '-', reactFin: '-', reac: 0, max: 0 },
    { p: 'P5', actIni: '-', actFin: '-', act: 0, reactIni: '-', reactFin: '-', reac: 0, max: 0 },
    { p: 'P6', actIni: '-', actFin: '-', act: 0, reactIni: '-', reactFin: '-', reac: 0, max: 0 },
  ];

  if (f1Readings && Object.keys(f1Readings).length > 0) {
    consumos = [];
    for (let i = 1; i <= 6; i++) {
      const pName = `P${i}`;
      const r = f1Readings[pName] || { actIni: '-', actFin: '-', reactIni: '-', reactFin: '-', reactCons: 0, actCons: 0, max: 0 };
      consumos.push({
        p: pName,
        actIni: r.actIni !== '-' ? parseInt(r.actIni).toString() : '-',
        actFin: r.actFin !== '-' ? parseInt(r.actFin).toString() : '-',
        act: r.actCons !== undefined ? Math.round(r.actCons) : 0,
        reactIni: r.reactIni !== '-' ? parseInt(r.reactIni).toString() : '-',
        reactFin: r.reactFin !== '-' ? parseInt(r.reactFin).toString() : '-',
        reac: Math.round(r.reactCons || 0),
        max: r.max ? r.max.toFixed(1) : '0',
      });
    }
  }

  const totalActKwh = consumos.reduce((s, c) => s + (Number(c.act) || 0), 0);
  const totalExcKwh = excedentesKwh > 0 ? excedentesKwh.toFixed(2) : (excedentesAutoconsumo > 0 ? (excedentesAutoconsumo / 0.03).toFixed(2) : '0');
  const pexcPdf = excedentesKwh > 0 ? (excedentesAutoconsumo / excedentesKwh).toFixed(3) : '0.03';

  return (
    <Document>
      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 1 — INVOICE DETAIL
      ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>

        {/* ── Header banner ── */}
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.companyName}>Nuestra Comercializadora S.L.</Text>
            <Text style={styles.companyTagline}>Energía transparente y sostenible para tus negocios</Text>
          </View>
          <View style={styles.invoiceBadge}>
            <Text style={styles.invoiceBadgeText}>FACTURA PROFORMA</Text>
            <Text style={styles.invoiceBadgeSub}>{invoiceNumber || 'BORRADOR'}</Text>
          </View>
        </View>

        {/* ── Info grid row 1 ── */}
        <View style={styles.infoGrid}>
          {/* Datos titular */}
          <View style={styles.infoBox}>
            <View style={styles.infoBoxHeader}>
              <Text style={styles.infoBoxTitle}>DATOS DEL TITULAR</Text>
            </View>
            <View style={styles.infoBoxBody}>
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{clientName}</Text>
              <Text style={{ color: C.muted, marginBottom: 6 }}>{clientAddress || 'Dirección no especificada'}</Text>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>CIF/NIF:</Text><Text style={styles.infoValue}>{clientNif}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>CNAE:</Text><Text style={styles.infoValue}>-</Text></View>
            </View>
          </View>

          {/* Datos factura */}
          <View style={styles.infoBox}>
            <View style={styles.infoBoxHeaderAccent}>
              <Text style={styles.infoBoxTitle}>DATOS DE FACTURA</Text>
            </View>
            <View style={styles.infoBoxBody}>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Nº Factura:</Text><Text style={styles.infoValueRight}>{invoiceNumber || 'Borrador'}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Tipo:</Text><Text style={styles.infoValueRight}>Normal</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Período:</Text><Text style={styles.infoValueRight}>{fmtDate(billingStart)} – {fmtDate(billingEnd)}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Total días:</Text><Text style={styles.infoValueRight}>{days}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Fecha emisión:</Text><Text style={styles.infoValueRight}>{fmtDate(issueDate)}</Text></View>
              <View style={styles.totalPayBand}>
                <Text style={styles.totalPayLabel}>TOTAL A PAGAR</Text>
                <Text style={styles.totalPayValue}>{fmt(totalAmount)} €</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Info grid row 2 ── */}
        <View style={styles.infoGrid}>
          {/* Punto suministro */}
          <View style={styles.infoBox}>
            <View style={styles.infoBoxHeader}>
              <Text style={styles.infoBoxTitle}>DATOS DEL PUNTO DE SUMINISTRO</Text>
            </View>
            <View style={styles.infoBoxBody}>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>CUPS:</Text><Text style={styles.infoValue}>{cups}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Nº Contador:</Text><Text style={styles.infoValue}>{f1Readings?.NumeroSerie || '-'}</Text></View>
              <Text style={{ color: C.muted, marginTop: 4 }}>{clientAddress || 'Dirección no especificada'}</Text>
              <Text style={{ color: C.muted, marginTop: 4, fontSize: 7 }}>AVERÍAS: 900 000 000 (gratuito)</Text>
            </View>
          </View>

          {/* Datos contrato */}
          <View style={styles.infoBox}>
            <View style={styles.infoBoxHeader}>
              <Text style={styles.infoBoxTitle}>DATOS DEL CONTRATO</Text>
            </View>
            <View style={styles.infoBoxBody}>
              <View style={styles.infoRow}><Text style={styles.infoLabelWide}>Ref. Contrato Acceso:</Text><Text style={styles.infoValueRight}>-</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabelWide}>Ref. Contrato Suministro:</Text><Text style={styles.infoValueRight}>-</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabelWide}>Fecha fin contrato:</Text><Text style={styles.infoValueRight}>-</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabelWide}>Tarifa:</Text><Text style={[styles.infoValueRight, { fontFamily: 'Helvetica-Bold', color: C.brand }]}>{tariff}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabelWide}>Potencia contratada:</Text><Text style={styles.infoValueRight}>{contractedPower ? contractedPower.toFixed(3) : '-'} kW</Text></View>
            </View>
          </View>
        </View>

        {/* ── Detail table ── */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionBarText}>DETALLE DE LA FACTURA</Text>
        </View>
        <View style={styles.tableWrap}>
          {/* Column headers */}
          <View style={styles.tableHead}>
            <Text style={styles.thConcept}>Concepto</Text>
            <Text style={styles.thCenter}>Cantidad</Text>
            <Text style={styles.thCenter}>Días</Text>
            <Text style={styles.thCenter}>Precio Ud</Text>
            <Text style={styles.thRight}>FACTURA INTERNA</Text>
          </View>

          {/* ── Potencia ── */}
          {powerDetails.length > 0 && (
            <View style={styles.groupHeader}>
              <Text style={styles.ghLabel}>Potencia Facturada</Text>
              <Text style={styles.ghUnit}>kW</Text>
              <Text style={styles.ghUnit}></Text>
              <Text style={styles.ghUnit}>€/kW/día</Text>
              <Text style={styles.ghRight}></Text>
            </View>
          )}
          {powerDetails.map((p: any, i: number) => (
            <View style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt} key={`pow-${i}`}>
              <View style={styles.drConcept}>
                <Text style={styles.drConceptText}>{p.period}. Potencia Facturada</Text>
                <Text style={styles.drSubtext}>  Peajes potencia: {fmt(p.peajeEur)} €  ·  Cargos potencia: {fmt(p.cargoEur)} €</Text>
              </View>
              <Text style={styles.drCenter}>{p.kw?.toFixed(0)}</Text>
              <Text style={styles.drCenter}>{p.days?.toFixed(0)}</Text>
              <Text style={styles.drCenter}>{p.price?.toFixed(6)}</Text>
              <Text style={styles.drRight}>{fmt(p.total)}</Text>
            </View>
          ))}

          {/* ── ATR Energía ── */}
          {energyAtrDetails.length > 0 && (
            <View style={styles.groupHeader}>
              <Text style={styles.ghLabel}>Término de Energía ATR</Text>
              <Text style={styles.ghUnit}>kWh</Text>
              <Text style={styles.ghUnit}></Text>
              <Text style={styles.ghUnit}>€/kWh</Text>
              <Text style={styles.ghRight}></Text>
            </View>
          )}
          {energyAtrDetails.map((e: any, i: number) => (
            <View style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt} key={`atr-${i}`}>
              <View style={styles.drConcept}>
                <Text style={styles.drConceptText}>{e.period}. ATR Energía</Text>
                <Text style={styles.drSubtext}>  Peajes energía: {fmt(e.peajeEur)} €  ·  Cargos energía: {fmt(e.cargoEur)} €</Text>
              </View>
              <Text style={styles.drCenter}>{e.kwh?.toFixed(0)}</Text>
              <Text style={styles.drCenter}></Text>
              <Text style={styles.drCenter}>{e.price?.toFixed(6)}</Text>
              <Text style={styles.drRight}>{fmt(e.total)}</Text>
            </View>
          ))}

          {/* ── Energía Activa ── */}
          {energyMarketDetails.length > 0 && (
            <View style={styles.groupHeader}>
              <Text style={styles.ghLabel}>Término de Energía Activa</Text>
              <Text style={styles.ghUnit}>kWh</Text>
              <Text style={styles.ghUnit}></Text>
              <Text style={styles.ghUnit}>€/kWh</Text>
              <Text style={styles.ghRight}></Text>
            </View>
          )}
          {energyMarketDetails.map((e: any, i: number) => (
            <View style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt} key={`mkt-${i}`}>
              <View style={styles.drConcept}>
                <Text style={styles.drConceptText}>{e.period}. Energía Activa</Text>
              </View>
              <Text style={styles.drCenter}>{e.kwh?.toFixed(0)}</Text>
              <Text style={styles.drCenter}></Text>
              <Text style={styles.drCenter}>{e.price?.toFixed(6)}</Text>
              <Text style={styles.drRight}>{fmt(e.total)}</Text>
            </View>
          ))}

          {/* ── Energía Reactiva ── */}
          {reactiveDetails && reactiveDetails.length > 0 && (
            <View style={styles.groupHeader}>
              <Text style={styles.ghLabel}>Término de Energía Reactiva</Text>
              <Text style={styles.ghUnit}>kVArh</Text>
              <Text style={styles.ghUnit}></Text>
              <Text style={styles.ghUnit}>€/kVArh</Text>
              <Text style={styles.ghRight}></Text>
            </View>
          )}
          {reactiveDetails && reactiveDetails.map((r: any, i: number) => (
            <View style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt} key={`reac-${i}`}>
              <View style={styles.drConcept}>
                <Text style={styles.drConceptText}>{r.period}. Energía Reactiva</Text>
              </View>
              <Text style={styles.drCenter}>{r.kvarh > 0 ? r.kvarh.toFixed(2) : ''}</Text>
              <Text style={styles.drCenter}></Text>
              <Text style={styles.drCenter}>{r.cost > 0 && r.kvarh > 0 ? (r.cost / r.kvarh).toFixed(6) : ''}</Text>
              <Text style={styles.drRight}>{fmt(r.cost)}</Text>
            </View>
          ))}

          {/* ── Excesos ── */}
          {excesosPotencia > 0 && (
            <>
              <View style={styles.groupHeader}>
                <Text style={styles.ghLabel}>Término de Excesos de Potencia</Text>
                <Text style={styles.ghUnit}></Text>
                <Text style={styles.ghUnit}></Text>
                <Text style={styles.ghUnit}></Text>
                <Text style={styles.ghRight}></Text>
              </View>
              <View style={styles.extraRow}>
                <View style={styles.erConcept}><Text>Importe Excesos de Potencia</Text></View>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erRight}>{fmt(excesosPotencia)}</Text>
              </View>
            </>
          )}

          {/* ── Excedentes ── */}
          {excedentesAutoconsumo > 0 && (
            <>
              <View style={styles.groupHeader}>
                <Text style={styles.ghLabel}>Término de Excedentes</Text>
                <Text style={styles.ghUnit}>kWh</Text>
                <Text style={styles.ghUnit}></Text>
                <Text style={styles.ghUnit}>€/kWh</Text>
                <Text style={styles.ghRight}></Text>
              </View>
              <View style={styles.extraRow}>
                <View style={styles.erConcept}><Text>Excedentes Autoconsumo (máximo aplicable según RD 244/2019: {fmt(maxExcedentes)} €)</Text></View>
                <Text style={styles.erCenter}>{totalExcKwh}</Text>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erCenter}>{pexcPdf}</Text>
                <Text style={styles.erRight}>-{fmt(excedentesAutoconsumo)}</Text>
              </View>
              {bolsilloSolarLlenado > 0 && (
                <View style={styles.extraRow}>
                  <View style={styles.erConcept}><Text>Llenado de Bolsillo Solar (Excedentes – Máximo aplicable)</Text></View>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erRight}></Text>
                </View>
              )}
            </>
          )}

          {/* ── Impuestos / regulados ── */}
          <View style={[styles.groupHeader, { marginTop: 2 }]}>
            <Text style={styles.ghLabel}>Impuestos y Conceptos Regulados</Text>
            <Text style={styles.ghUnit}></Text>
            <Text style={styles.ghUnit}></Text>
            <Text style={styles.ghUnit}></Text>
            <Text style={styles.ghRight}></Text>
          </View>

          {taxElectric > 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>Impuesto Eléctrico</Text>
                <Text style={{ fontSize: 5.5, color: C.muted, marginTop: 1 }}>Base = TPA+TEA+TER: {fmt(baseIEE)} × {ieeRate}% (Mín. 1 €/MWh para 2.0TD/3.0TD; 0,5 €/MWh resto)</Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erRight}>{fmt(taxElectric)}</Text>
            </View>
          )}

          {bonoSocial > 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}><Text>Financiación del Bono Social (Orden TED/1487/2024)</Text></View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}>{days}</Text>
              <Text style={styles.erCenter}>{(bonoSocial / (powerDetails.length > 0 ? powerDetails[0].days : 30)).toFixed(6)}</Text>
              <Text style={styles.erRight}>{fmt(bonoSocial)}</Text>
            </View>
          )}

          {alquilerEquipo > 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}><Text>Alquiler equipo de Medida</Text></View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}>{days}</Text>
              <Text style={styles.erCenter}>{(alquilerEquipo / (powerDetails.length > 0 ? powerDetails[0].days : 30)).toFixed(6)}</Text>
              <Text style={styles.erRight}>{fmt(alquilerEquipo)}</Text>
            </View>
          )}

          <View style={styles.extraRow}>
            <View style={styles.erConcept}><Text>Costes de Gestión Bolsillo Solar</Text></View>
            <Text style={styles.erCenter}></Text>
            <Text style={styles.erCenter}>{days}</Text>
            <Text style={styles.erCenter}>0</Text>
            <Text style={styles.erRight}>0.00</Text>
          </View>

          {svaCost > 0 && (
            <View style={[styles.extraRow, { marginTop: 10, borderTop: 0 }]}>
              <View style={styles.erConcept}><Text>Otros*</Text></View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erRight}>{fmt(svaCost)}</Text>
            </View>
          )}
        </View>

        {/* ── Totals ── */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsLeft} />
          <View style={styles.totalsRight}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelGrey}>Base Imponible</Text>
              <Text style={styles.totalValGrey}>{fmt(subtotal1)} €</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelGrey}>{taxPercentage}% IVA (BI {fmt(subtotal1)} €)</Text>
              <Text style={styles.totalValGrey}>{fmt(taxAmount)} €</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total FACTURA</Text>
              <Text style={styles.grandTotalVal}>{fmt(totalAmount)} €</Text>
            </View>
          </View>
        </View>

        {/* ── Bolsillo Solar ── */}
        <View style={styles.solarWrap}>
          <View style={styles.solarTitle}>
            <Text style={styles.solarTitleText}>🌞  Tu Bolsillo Solar en esta Factura</Text>
          </View>
          <View style={styles.solarTable}>
            <View style={styles.solarHead}>
              <Text style={styles.solarHeadCell}>Saldo inicial</Text>
              <Text style={styles.solarHeadCell}>Llenado</Text>
              <Text style={styles.solarHeadCell}>Uso</Text>
              <Text style={styles.solarHeadCellLast}>Saldo final</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.solarCell}>0.00 €</Text>
              <Text style={styles.solarCell}>{fmt(bolsilloSolarLlenado)} €</Text>
              <Text style={styles.solarCell}>0.00 €</Text>
              <Text style={styles.solarCellLast}>{fmt(bolsilloSolarLlenado)} €</Text>
            </View>
          </View>
        </View>

        {/* ── Legal ── */}
        <Text style={styles.legalText}>
          Peajes aplicados según Resolución 18/12/25 CNMC (BOE-A-2025-263489); cargos, pagos por capacidad, financiación de bono social y pago a operador de mercado según Orden TED/1524/2025 de 23/12/25; pago al operador de sistema según Resolución 23/12/25 CNMC (BOE-A-2025-27211) y FNEE según propuesta de Orden MITECO 2026.
        </Text>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 2 — CONSUMPTION DATA & ENVIRONMENTAL INFO
      ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>

        {/* Repeat a slim header on p2 */}
        <View style={[styles.headerBand, { padding: '8 16', marginBottom: 8 }]}>
          <View>
            <Text style={[styles.companyName, { fontSize: 11 }]}>Nuestra Comercializadora S.L.</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#a8c4e0', fontSize: 7 }}>Información al consumidor</Text>
            <Text style={{ color: C.white, fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{invoiceNumber || 'BORRADOR'}</Text>
          </View>
        </View>

        {/* ── Datos de consumo ── */}
        <View style={styles.p2SectionBar}>
          <Text style={styles.p2SectionBarText}>DATOS DE CONSUMO</Text>
        </View>
        <View style={styles.consTableWrap}>
          {/* Group headers */}
          <View style={styles.consGroupHead}>
            <Text style={styles.consGroupHeadCellFirst}></Text>
            <Text style={[styles.consGroupHeadCell, { flex: 3 }]}>ENERGÍA ACTIVA (kWh)</Text>
            <Text style={[styles.consGroupHeadCell, { flex: 3 }]}>ENERGÍA REACTIVA (kVarh)</Text>
            <Text style={styles.consGroupHeadCellLast}>Maxímetro</Text>
          </View>
          {/* Sub-headers */}
          <View style={styles.consSubHead}>
            <Text style={[styles.consSubHeadCell, { flex: 1 }]}>Periodo</Text>
            <Text style={styles.consSubHeadCell}>Inicio</Text>
            <Text style={styles.consSubHeadCell}>Fin</Text>
            <Text style={styles.consSubHeadCell}>Consumo</Text>
            <Text style={styles.consSubHeadCell}>Inicio</Text>
            <Text style={styles.consSubHeadCell}>Fin</Text>
            <Text style={styles.consSubHeadCell}>Consumo</Text>
            <Text style={styles.consSubHeadCellLast}>-</Text>
          </View>
          {/* Data rows */}
          {consumos.map((c, i) => (
            <View style={i % 2 === 0 ? styles.consDataRow : styles.consDataRowAlt} key={`c-${i}`}>
              <Text style={styles.consCellBold}>{c.p}</Text>
              <Text style={styles.consCell}>{c.actIni}</Text>
              <Text style={styles.consCell}>{c.actFin}</Text>
              <Text style={[styles.consCell, { fontFamily: 'Helvetica-Bold', color: c.act > 0 ? C.accent : C.text }]}>{c.act}</Text>
              <Text style={styles.consCell}>{c.reactIni}</Text>
              <Text style={styles.consCell}>{c.reactFin}</Text>
              <Text style={styles.consCell}>{c.reac}</Text>
              <Text style={styles.consCellLast}>{c.max}</Text>
            </View>
          ))}
          {/* Totals footer */}
          <View style={styles.consFooterRow}>
            <Text style={styles.consFooterLabel}>Energía consumida</Text>
            <Text style={styles.consFooterVal}>{totalActKwh.toLocaleString('es-ES')} (kWh)</Text>
            <Text style={styles.consFooterEmpty}></Text>
          </View>
          {excedentesAutoconsumo > 0 && (
            <View style={styles.consFooterRow}>
              <Text style={styles.consFooterLabel}>Energía excedentaria</Text>
              <Text style={styles.consFooterVal}>{totalExcKwh} (kWh)</Text>
              <Text style={styles.consFooterEmpty}></Text>
            </View>
          )}
        </View>

        {/* ── Origen de la electricidad ── */}
        <View style={styles.p2SectionBar}>
          <Text style={styles.p2SectionBarText}>ORIGEN DE LA ELECTRICIDAD</Text>
        </View>
        <View style={{ border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', padding: '10 20', flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.brand, marginBottom: 6 }}>NUESTRA COMERCIALIZADORA S.L.</Text>
            <Svg width="100" height="100" viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r="48" fill={C.green} />
              <Circle cx="50" cy="50" r="32" fill="white" />
              <Circle cx="50" cy="50" r="18" fill={C.green} />
            </Svg>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.green, marginTop: 4 }}>Renovable 100%</Text>
          </View>
          <View style={{ flex: 2 }}>
            <Text style={{ fontSize: 7, color: C.muted, lineHeight: 1.5 }}>
              La electricidad suministrada proviene 100% de fuentes de energía renovable. Certificado de Garantía de Origen expedido por la CNMC. Más información en https://gdo.cnmc.es/
            </Text>
          </View>
        </View>

        {/* ── Impacto medioambiental ── */}
        <View style={styles.p2SectionBarAccent}>
          <Text style={styles.p2SectionBarText}>IMPACTO MEDIOAMBIENTAL</Text>
        </View>
        <View style={{ border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', padding: '8 12' }}>
          <Text style={{ fontSize: 6.5, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>
            En una escala de A a G (A = mínimo impacto, G = máximo), la energía comercializada tiene los siguientes valores:
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(['CO2 (g/kWh)', 'Residuos Radiactivos (mg/kWh)'] as const).map((label, li) => (
              <View key={li} style={{ flex: 1, border: `1 solid ${C.border}`, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ backgroundColor: C.accent, padding: '4 6' }}>
                  <Text style={{ color: C.white, fontSize: 6.5, fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>{label}</Text>
                </View>
                {[
                  { lbl: 'A', bg: '#00a651', w: '35%' },
                  { lbl: 'B', bg: '#50b848', w: '45%' },
                  { lbl: 'C', bg: '#c4d600', w: '55%' },
                  { lbl: 'D', bg: '#ffdd00', w: '65%' },
                  { lbl: 'E', bg: '#f59c00', w: '75%' },
                  { lbl: 'F', bg: '#e65f00', w: '85%' },
                  { lbl: 'G', bg: '#e3000f', w: '100%' },
                ].map(({ lbl, bg, w }) => (
                  <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', padding: '1 4' }}>
                    <Text style={{ width: 10, fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.muted }}>{lbl}</Text>
                    <View style={{ width: w, height: 8, backgroundColor: bg, borderRadius: 1 }}>
                      {lbl === 'A' && <Text style={{ color: C.white, fontSize: 5.5, paddingLeft: 2, marginTop: 1 }}>★</Text>}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* ── Observaciones ── */}
        <View style={[styles.p2SectionBar, { marginTop: 10 }]}>
          <Text style={styles.p2SectionBarText}>OBSERVACIONES</Text>
        </View>
        <View style={{ border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', padding: '6 10' }}>
          <Text style={{ fontSize: 5.5, color: C.muted, lineHeight: 1.5 }}>
            Peajes a aplicar según Resolución de 18/12/25 de la CNMC (BOE-A-2025-263489); los cargos, pagos por capacidad, financiación de bono social y pago a operador de mercado a aplicar según Orden TED/1524/2025, de 23/12/25; pago al operador de sistema según Resolución de 23/12/25 de la CNMC (BOE-A-2025-27211) y FNEE según propuesta de Orden de MITECO para 2026.
          </Text>
          {svaCost > 0 && (
            <Text style={{ fontSize: 5.5, color: C.muted, lineHeight: 1.5, marginTop: 4 }}>
              El concepto Otros de su Factura incluye: un coste de {fmt(svaCost)}€ en {svaConcept}.
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
};
