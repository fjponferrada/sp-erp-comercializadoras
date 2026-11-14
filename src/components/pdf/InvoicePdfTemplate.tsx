import React from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, Circle } from '@react-pdf/renderer';

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  brand: '#1a3a5c', // deep navy
  accent: '#e8622a', // vivid orange
  accentLt: '#fdf0ea', // very light orange tint
  navy2: '#2c5282', // medium navy
  navyLt: '#ebf4ff', // very light navy
  rowAlt: '#f7f9fc', // subtle row stripe
  border: '#c8d5e3', // cool grey border
  text: '#1a202c', // near-black
  muted: '#64748b', // slate grey
  white: '#ffffff',
  green: '#00a651',
  totalBg: '#1a3a5c',
};

const styles = StyleSheet.create({
  page: {
    padding: '26 30',
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: C.text,
    backgroundColor: C.white,
  },

  headerBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: C.brand,
    padding: '12 16',
    marginBottom: 9,
    borderRadius: 3,
  },
  companyName: { color: C.white, fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  companyTagline: { color: '#cbd5e1', fontSize: 6.5, marginTop: 1 },
  invoiceBadge: {
    backgroundColor: C.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceBadgeText: {
    color: C.white,
    fontSize: 11.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
  },
  invoiceBadgeSub: { color: '#fde5d8', fontSize: 6.5, marginTop: 2 },

  infoGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  infoBox: {
    flex: 1,
    border: `1 solid ${C.border}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  infoBoxHeader: {
    backgroundColor: C.brand,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBoxHeaderAccent: {
    backgroundColor: C.accent,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBoxTitle: { color: C.white, fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  infoBoxBody: { padding: '5 8', backgroundColor: C.white },
  infoRow: { flexDirection: 'row', marginBottom: 2 },
  infoLabel: { width: 85, color: C.muted, fontSize: 6.8 },
  infoLabelWide: { width: 108, color: C.muted, fontSize: 6.8 },
  infoValue: { flex: 1, fontSize: 7.2 },
  infoValueRight: { flex: 1, textAlign: 'right', fontSize: 7.2 },
  totalPayBand: {
    backgroundColor: C.accentLt,
    borderTop: `1 solid ${C.accent}`,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '4 8',
    marginTop: 3,
  },
  totalPayLabel: { color: C.accent, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  totalPayValue: { color: C.accent, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  sectionBar: {
    backgroundColor: C.brand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    marginBottom: 0,
    borderRadius: '2 2 0 0',
  },
  sectionBarText: { color: C.white, fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

  tableWrap: { border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', overflow: 'hidden' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.navy2,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  thConcept: {
    flex: 4.6,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    paddingLeft: 6,
    fontSize: 7,
  },
  thCenter: {
    flex: 1,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    fontSize: 7,
  },
  thRight: {
    flex: 1.4,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    paddingRight: 6,
    fontSize: 7,
  },

  groupHeader: {
    flexDirection: 'row',
    backgroundColor: C.navyLt,
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderTop: `1 solid ${C.border}`,
  },
  ghLabel: {
    flex: 4.6,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
    paddingLeft: 6,
    fontSize: 7.2,
  },
  ghUnit: { flex: 1, fontFamily: 'Helvetica-Bold', color: C.muted, textAlign: 'center', fontSize: 6.8 },
  ghRight: {
    flex: 1.4,
    backgroundColor: C.accentLt,
    textAlign: 'right',
    paddingRight: 6,
    fontSize: 7,
  },

  dataRow: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    borderTop: `0.5 solid ${C.border}`,
  },
  dataRowAlt: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    borderTop: `0.5 solid ${C.border}`,
    backgroundColor: C.rowAlt,
  },
  drConcept: { flex: 4.6, paddingLeft: 12 },
  drConceptText: { fontSize: 7.2, color: C.text },
  drSubtext: { fontSize: 5.8, color: C.muted, marginTop: 1 },
  drCenter: { flex: 1, textAlign: 'center', color: C.text, fontSize: 7 },
  drRight: {
    flex: 1.4,
    textAlign: 'right',
    paddingRight: 6,
    backgroundColor: C.accentLt,
    color: C.text,
    fontSize: 7.2,
  },

  extraRow: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    borderTop: `0.5 solid ${C.border}`,
  },
  erConcept: { flex: 4.6, paddingLeft: 6 },
  erCenter: { flex: 1, textAlign: 'center', color: C.text, fontSize: 7 },
  erRight: {
    flex: 1.4,
    textAlign: 'right',
    paddingRight: 6,
    backgroundColor: C.accentLt,
    fontSize: 7.2,
  },

  totalsWrap: { flexDirection: 'row', marginTop: 6 },
  totalsLeft: { flex: 1, paddingRight: 10 },
  totalsRight: {
    width: 210,
    border: `1 solid ${C.border}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '4 8',
    borderBottom: `0.5 solid ${C.border}`,
  },
  totalLabelGrey: { color: C.muted, fontSize: 7.2 },
  totalValGrey: { color: C.text, fontSize: 7.2 },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '6 8',
    backgroundColor: C.totalBg,
  },
  grandTotalLabel: { color: C.white, fontSize: 8.8, fontFamily: 'Helvetica-Bold' },
  grandTotalVal: { color: C.accent, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },

  solarWrap: { marginTop: 8, width: '65%' },
  solarTitle: {
    backgroundColor: C.green,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: '3 3 0 0',
  },
  solarTitleText: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  solarTable: { border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', overflow: 'hidden' },
  solarHead: { flexDirection: 'row', backgroundColor: '#e6f4ee' },
  solarHeadCell: {
    flex: 1,
    textAlign: 'center',
    padding: '3 2',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    color: '#1a4731',
    borderRight: `0.5 solid ${C.border}`,
  },
  solarHeadCellLast: {
    flex: 1,
    textAlign: 'center',
    padding: '3 2',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.8,
    color: '#1a4731',
  },
  solarCell: {
    flex: 1,
    textAlign: 'center',
    padding: '3.5 2',
    borderRight: `0.5 solid ${C.border}`,
    fontSize: 7.2,
  },
  solarCellLast: {
    flex: 1,
    textAlign: 'center',
    padding: '3.5 2',
    fontSize: 7.2,
    fontFamily: 'Helvetica-Bold',
    color: C.green,
  },

  legalText: { marginTop: 8, fontSize: 5.5, color: C.muted, textAlign: 'justify', lineHeight: 1.35 },

  p2SectionBar: {
    backgroundColor: C.brand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 12,
    marginBottom: 0,
    borderRadius: '2 2 0 0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  p2SectionBarAccent: {
    backgroundColor: C.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 12,
    marginBottom: 0,
    borderRadius: '2 2 0 0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  p2SectionBarText: { color: C.white, fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

  consTableWrap: {
    border: `1 solid ${C.border}`,
    borderRadius: '0 0 3 3',
    overflow: 'hidden',
    marginBottom: 4,
  },
  consGroupHead: { flexDirection: 'row', backgroundColor: C.navy2 },
  consSubHead: {
    flexDirection: 'row',
    backgroundColor: C.navyLt,
    borderBottom: `1 solid ${C.border}`,
  },
  consSubHeadCell: {
    flex: 1,
    padding: '3 2',
    textAlign: 'center',
    color: C.brand,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
    borderRight: `0.5 solid ${C.border}`,
  },
  consSubHeadCellLast: {
    flex: 1,
    padding: '3 2',
    textAlign: 'center',
    color: C.brand,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.5,
  },
  consGroupHeadCell: {
    flex: 3,
    padding: '4 2',
    textAlign: 'center',
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    borderRight: `0.5 solid rgba(255,255,255,0.3)`,
  },
  consGroupHeadCellFirst: {
    flex: 1,
    padding: '4 2',
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    borderRight: `0.5 solid rgba(255,255,255,0.3)`,
  },
  consGroupHeadCellLast: {
    flex: 1,
    padding: '4 2',
    textAlign: 'center',
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
  },
  consDataRow: { flexDirection: 'row', borderTop: `0.5 solid ${C.border}` },
  consDataRowAlt: {
    flexDirection: 'row',
    borderTop: `0.5 solid ${C.border}`,
    backgroundColor: C.rowAlt,
  },
  consCell: {
    flex: 1,
    padding: '3 2',
    textAlign: 'center',
    borderRight: `0.5 solid ${C.border}`,
    fontSize: 7,
  },
  consCellBold: {
    flex: 1,
    padding: '3 2',
    textAlign: 'center',
    borderRight: `0.5 solid ${C.border}`,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
  },
  consCellLast: { flex: 1, padding: '3 2', textAlign: 'center', fontSize: 7 },
  consFooterRow: {
    flexDirection: 'row',
    borderTop: `1 solid ${C.border}`,
    backgroundColor: C.navyLt,
  },
  consFooterLabel: {
    flex: 2,
    padding: '3 6',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.brand,
  },
  consFooterVal: {
    flex: 1,
    padding: '3 2',
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.brand,
    borderLeft: `0.5 solid ${C.border}`,
  },
  consFooterEmpty: { flex: 4, padding: '3 2' },
});

function fmt(n: number | undefined | null, dec = 2): string {
  if (n === undefined || n === null || isNaN(n)) return '-';
  return n.toFixed(dec);
}

function fmtQty(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '';
  if (Math.abs(n - Math.round(n)) < 1e-4) return Math.round(n).toString();
  return n.toFixed(2);
}

function fmtMadridDate(d?: string | Date | null): string {
  if (!d) return '-';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
}

function fmtInclusiveEndDate(start?: string | Date | null, end?: string | Date | null): string {
  if (!end) return '-';
  const endDt = end instanceof Date ? end : new Date(end);
  if (isNaN(endDt.getTime())) return '-';
  if (start) {
    const startDt = start instanceof Date ? start : new Date(start);
    if (!isNaN(startDt.getTime()) && endDt.getTime() - startDt.getTime() >= 20 * 3600 * 1000) {
      return fmtMadridDate(new Date(endDt.getTime() - 12 * 3600 * 1000));
    }
  }
  return fmtMadridDate(endDt);
}

export const InvoicePdfTemplate = ({ data }: { data: any }) => {
  const {
    invoiceNumber,
    invoiceType = 'Normal',
    issueDate,
    billingStart,
    billingEnd,
    billingDays,

    companyName = 'Comercializadora Eléctrica',
    companyCif = '-',
    companyAddress = '',
    companyEmail = '',
    companyPhone = '',

    clientName = 'Cliente',
    clientNif = '-',
    clientAddress = '',
    ibanMasked = '',

    cups = '-',
    supplyAddress = '',
    tariff = '2.0TD',
    cnae = '-',
    meterSerialNumber = '-',
    distributorName = '',
    distributorPhone = '900 000 000',
    accessContractRef = '-',
    supplyContractRef = '-',
    contractEndDate = null,
    contractedPowers = {},
    contractedPower,

    powerDetails = [],
    energyAtrDetails = [],
    energyMarketDetails = [],
    reactiveDetails = [],
    capacitiveEnergyCost = 0,
    excesosPotencia = 0,
    penalizacionNoIcpCost = 0,
    recargoInfAnioCost = 0,
    interesesDemoraCost = 0,
    conceptosRepercutibles = [],
    conceptosRepercutiblesExempt = 0,

    alquilerEquipo = 0,
    bonoSocial = 0,
    bonoSocialDailyRate,
    bonoSocialLabel,
    baseIEE: rawBaseIEE,
    ieeRate: rawIeeRate,
    ieeReductionPct = 0,
    taxElectric = 0,

    excedentesAutoconsumo = 0,
    maxExcedentes = 0,
    excedentesKwh = 0,
    pexc = null,
    hasBolsilloSolar = false,
    cgBolsilloSolarCost = 0,
    cgBolsilloSolarDailyRate = 0,
    bolsilloSolarSaldoInicial = 0,
    bolsilloSolarLlenado = 0,
    bolsilloSolarUso = 0,
    bolsilloSolarSaldoFinal = 0,

    f1Readings = null,
    svaCost = 0,
    svaConcept = '',
    svaDetails = [],

    subtotal1 = 0,
    taxType = 'IVA',
    taxPercentage = 21,
    taxAmount = 0,
    taxBreakdown = [],
    totalAmount = 0,
  } = data;

  const daysNum =
    Number(billingDays) ||
    (powerDetails.length > 0 && powerDetails[0]?.days ? Math.round(Number(powerDetails[0].days)) : 30);
  const daysStr = daysNum.toString();

  const ieePct = rawIeeRate
    ? Number(rawIeeRate) < 1
      ? Number(rawIeeRate) * 100
      : Number(rawIeeRate)
    : 5.11269632;
  const baseIEE =
    rawBaseIEE !== undefined && rawBaseIEE !== null
      ? Number(rawBaseIEE)
      : taxElectric
        ? taxElectric / (ieePct / 100)
        : 0;

  const bsUnitRate =
    bonoSocialDailyRate !== undefined && Number(bonoSocialDailyRate) !== 0
      ? Number(bonoSocialDailyRate)
      : daysNum > 0
        ? bonoSocial / daysNum
        : 0;

  const cgBsUnitRate =
    cgBolsilloSolarDailyRate !== undefined && Number(cgBolsilloSolarDailyRate) !== 0
      ? Number(cgBolsilloSolarDailyRate)
      : daysNum > 0 && cgBolsilloSolarCost !== 0
        ? cgBolsilloSolarCost / daysNum
        : 0;

  // Potencias contratadas formateadas
  let contractedPowersText = '-';
  const powerEntries = Object.entries(contractedPowers || {}).filter(
    ([, v]) => typeof v === 'number' && !isNaN(v as number) && (v as number) > 0
  );
  if (powerEntries.length > 0) {
    const uniqueVals = Array.from(new Set(powerEntries.map(([, v]) => Number(v).toFixed(2))));
    if (uniqueVals.length === 1) {
      contractedPowersText = `${Number(powerEntries[0][1]).toFixed(3)} kW`;
    } else {
      contractedPowersText = powerEntries
        .map(([p, v]) => `${p}:${Number(v).toFixed(2)}`)
        .join(' · ') + ' kW';
    }
  } else if (contractedPower) {
    contractedPowersText = `${Number(contractedPower).toFixed(3)} kW`;
  }

  // Datos de consumo de contador (Página 2)
  let consumos: any[] = [1, 2, 3, 4, 5, 6].map((i) => ({
    p: `P${i}`,
    actIni: '-',
    actFin: '-',
    act: 0,
    reactIni: '-',
    reactFin: '-',
    reac: 0,
    max: '0',
  }));

  if (f1Readings && Object.keys(f1Readings).length > 0) {
    consumos = [];
    for (let i = 1; i <= 6; i++) {
      const pName = `P${i}`;
      const r = f1Readings[pName] || {
        actIni: '-',
        actFin: '-',
        reactIni: '-',
        reactFin: '-',
        reactCons: 0,
        actCons: 0,
        max: 0,
      };
      consumos.push({
        p: pName,
        actIni: r.actIni !== '-' && r.actIni !== undefined ? parseInt(r.actIni).toString() : '-',
        actFin: r.actFin !== '-' && r.actFin !== undefined ? parseInt(r.actFin).toString() : '-',
        act: r.actCons !== undefined ? Math.round(Number(r.actCons)) : 0,
        reactIni:
          r.reactIni !== '-' && r.reactIni !== undefined ? parseInt(r.reactIni).toString() : '-',
        reactFin:
          r.reactFin !== '-' && r.reactFin !== undefined ? parseInt(r.reactFin).toString() : '-',
        reac: Math.round(Number(r.reactCons || 0)),
        max: r.max ? Number(r.max).toFixed(1) : '0',
      });
    }
  }

  const totalActKwh = consumos.reduce((s, c) => s + (Number(c.act) || 0), 0);
  const absExcAutoconsumo = Math.abs(Number(excedentesAutoconsumo || 0));
  const absExcKwh = Math.abs(Number(excedentesKwh || 0));
  const totalExcKwh =
    absExcKwh > 0
      ? absExcKwh.toFixed(2)
      : absExcAutoconsumo > 0
        ? (absExcAutoconsumo / 0.03).toFixed(2)
        : '0.00';
  const pexcPdf =
    pexc !== null && pexc !== undefined && Number(pexc) > 0
      ? (Number(pexc) / 1000).toFixed(6)
      : absExcKwh > 0
        ? (absExcAutoconsumo / absExcKwh).toFixed(6)
        : '0.000000';

  const isProforma = String(invoiceNumber || '').startsWith('PROFORMA-') || String(invoiceNumber || '').startsWith('BORRADOR');
  const badgeTitle =
    invoiceType?.toUpperCase() === 'RECTIFICADORA'
      ? 'FACTURA RECTIFICADORA'
      : invoiceType?.toUpperCase() === 'ABONO'
        ? 'FACTURA DE ABONO'
        : isProforma
          ? 'FACTURA PROFORMA'
          : 'FACTURA';

  const repercutiblesBaseItems = (conceptosRepercutibles || []).filter(
    (c: any) => String(c.taxTypeCode) !== '3' && Number(c.total) !== 0
  );
  const repercutiblesExemptItems = (conceptosRepercutibles || []).filter(
    (c: any) => String(c.taxTypeCode) === '3' && Number(c.total) !== 0
  );

  const showBolsilloSolar = Boolean(
    hasBolsilloSolar ||
      cgBolsilloSolarCost !== 0 ||
      bolsilloSolarLlenado !== 0 ||
      bolsilloSolarUso !== 0 ||
      bolsilloSolarSaldoInicial !== 0 ||
      bolsilloSolarSaldoFinal !== 0
  );

  return (
    <Document>
      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 1 — DETALLE DE LA FACTURA
      ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        {/* ── Header banner ── */}
        <View style={styles.headerBand}>
          <View style={{ maxWidth: '68%' }}>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.companyTagline}>
              CIF: {companyCif}
              {companyAddress && companyAddress !== '-' ? ` · ${companyAddress}` : ''}
            </Text>
            {(companyPhone && companyPhone !== '-') || (companyEmail && companyEmail !== '-') ? (
              <Text style={styles.companyTagline}>
                {[
                  companyPhone && companyPhone !== '-' ? `Tel: ${companyPhone}` : null,
                  companyEmail && companyEmail !== '-' ? companyEmail : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>
          <View style={styles.invoiceBadge}>
            <Text style={styles.invoiceBadgeText}>{badgeTitle}</Text>
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
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>{clientName}</Text>
              <Text style={{ color: C.muted, marginBottom: 4, fontSize: 6.8 }}>
                {clientAddress || 'Dirección no especificada'}
              </Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CIF/NIF:</Text>
                <Text style={styles.infoValue}>{clientNif}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CNAE:</Text>
                <Text style={styles.infoValue}>{cnae || '-'}</Text>
              </View>
              {ibanMasked ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Forma de pago:</Text>
                  <Text style={styles.infoValue}>{ibanMasked}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Datos factura */}
          <View style={styles.infoBox}>
            <View style={styles.infoBoxHeaderAccent}>
              <Text style={styles.infoBoxTitle}>DATOS DE FACTURA</Text>
            </View>
            <View style={styles.infoBoxBody}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nº Factura:</Text>
                <Text style={styles.infoValueRight}>{invoiceNumber || 'Borrador'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tipo:</Text>
                <Text style={styles.infoValueRight}>{invoiceType}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Período:</Text>
                <Text style={styles.infoValueRight}>
                  {fmtMadridDate(billingStart)} – {fmtInclusiveEndDate(billingStart, billingEnd)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total días:</Text>
                <Text style={styles.infoValueRight}>{daysStr}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Fecha emisión:</Text>
                <Text style={styles.infoValueRight}>{fmtMadridDate(issueDate)}</Text>
              </View>
              <View style={styles.totalPayBand}>
                <Text style={styles.totalPayLabel}>
                  {totalAmount < 0 ? 'TOTAL A ABONAR' : 'TOTAL A PAGAR'}
                </Text>
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
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CUPS:</Text>
                <Text style={styles.infoValue}>{cups}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nº Contador:</Text>
                <Text style={styles.infoValue}>
                  {meterSerialNumber && meterSerialNumber !== '-'
                    ? meterSerialNumber
                    : f1Readings?.NumeroSerie || '-'}
                </Text>
              </View>
              <Text style={{ color: C.muted, marginTop: 2, fontSize: 6.8 }}>
                {supplyAddress || clientAddress || 'Dirección no especificada'}
              </Text>
              <Text style={{ color: C.muted, marginTop: 3, fontSize: 6.8 }}>
                DISTRIBUIDORA: {distributorName && distributorName !== '-' ? `${distributorName} · ` : ''}
                AVERÍAS: {distributorPhone || '900 000 000'} (gratuito)
              </Text>
            </View>
          </View>

          {/* Datos contrato */}
          <View style={styles.infoBox}>
            <View style={styles.infoBoxHeader}>
              <Text style={styles.infoBoxTitle}>DATOS DEL CONTRATO</Text>
            </View>
            <View style={styles.infoBoxBody}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Ref. Contrato Acceso:</Text>
                <Text style={styles.infoValueRight}>{accessContractRef || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Ref. Contrato Suministro:</Text>
                <Text style={styles.infoValueRight}>{supplyContractRef || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Fecha fin contrato:</Text>
                <Text style={styles.infoValueRight}>
                  {contractEndDate ? fmtMadridDate(contractEndDate) : '-'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Tarifa:</Text>
                <Text
                  style={[
                    styles.infoValueRight,
                    { fontFamily: 'Helvetica-Bold', color: C.brand },
                  ]}
                >
                  {tariff}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Potencia contratada:</Text>
                <Text style={styles.infoValueRight}>{contractedPowersText}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Detail table ── */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionBarText}>DETALLE DE LA FACTURA</Text>
        </View>
        <View style={styles.tableWrap}>
          {/* Column headers strictly per .agents/AGENTS.md */}
          <View style={styles.tableHead}>
            <Text style={styles.thConcept}>Concepto</Text>
            <Text style={styles.thCenter}>Cantidad</Text>
            <Text style={styles.thCenter}>Días</Text>
            <Text style={styles.thCenter}>Precio Ud</Text>
            <Text style={styles.thRight}>Total €</Text>
          </View>

          {/* ── 1. Potencia Facturada ── */}
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
                <Text style={styles.drSubtext}>
                  Peajes potencia: {fmt(p.peajeEur)} €, Cargos potencia: {fmt(p.cargoEur)} €
                </Text>
              </View>
              <Text style={styles.drCenter}>{p.kw?.toFixed(3)}</Text>
              <Text style={styles.drCenter}>{p.days ? Math.round(Number(p.days)).toString() : daysStr}</Text>
              <Text style={styles.drCenter}>{p.price?.toFixed(6)}</Text>
              <Text style={styles.drRight}>{fmt(p.total)}</Text>
            </View>
          ))}

          {/* ── 2. Término de Energía ATR ── */}
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
                <Text style={styles.drSubtext}>
                  Peajes energía: {fmt(e.peajeEur)} €, Cargos energía: {fmt(e.cargoEur)} €
                </Text>
              </View>
              <Text style={styles.drCenter}>{fmtQty(e.kwh)}</Text>
              <Text style={styles.drCenter}></Text>
              <Text style={styles.drCenter}>{e.price?.toFixed(6)}</Text>
              <Text style={styles.drRight}>{fmt(e.total)}</Text>
            </View>
          ))}

          {/* ── 3. Término de Energía Activa ── */}
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
              <Text style={styles.drCenter}>{fmtQty(e.kwh)}</Text>
              <Text style={styles.drCenter}></Text>
              <Text style={styles.drCenter}>{e.price?.toFixed(6)}</Text>
              <Text style={styles.drRight}>{fmt(e.total)}</Text>
            </View>
          ))}

          {/* ── Energía Reactiva / Capacitiva ── */}
          {((reactiveDetails && reactiveDetails.length > 0) || capacitiveEnergyCost !== 0) && (
            <View style={styles.groupHeader}>
              <Text style={styles.ghLabel}>Término de Energía Reactiva</Text>
              <Text style={styles.ghUnit}>kVArh</Text>
              <Text style={styles.ghUnit}></Text>
              <Text style={styles.ghUnit}>€/kVArh</Text>
              <Text style={styles.ghRight}></Text>
            </View>
          )}
          {reactiveDetails &&
            reactiveDetails.map((r: any, i: number) => (
              <View style={i % 2 === 0 ? styles.dataRow : styles.dataRowAlt} key={`reac-${i}`}>
                <View style={styles.drConcept}>
                  <Text style={styles.drConceptText}>{r.period}. Energía Reactiva</Text>
                </View>
                <Text style={styles.drCenter}>{r.kvarh ? fmtQty(r.kvarh) : ''}</Text>
                <Text style={styles.drCenter}></Text>
                <Text style={styles.drCenter}>
                  {r.cost && r.kvarh ? Math.abs(r.cost / r.kvarh).toFixed(6) : ''}
                </Text>
                <Text style={styles.drRight}>{fmt(r.cost)}</Text>
              </View>
            ))}
          {capacitiveEnergyCost !== 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>Energía Reactiva Capacitiva</Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erRight}>{fmt(capacitiveEnergyCost)}</Text>
            </View>
          )}

          {/* ── 4. Término de Excesos de Potencia ── */}
          {excesosPotencia !== 0 && (
            <>
              <View style={styles.groupHeader}>
                <Text style={styles.ghLabel}>Término de Excesos de Potencia</Text>
                <Text style={styles.ghUnit}></Text>
                <Text style={styles.ghUnit}></Text>
                <Text style={styles.ghUnit}></Text>
                <Text style={styles.ghRight}></Text>
              </View>
              <View style={styles.extraRow}>
                <View style={styles.erConcept}>
                  <Text>Importe Excesos de Potencia</Text>
                </View>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erRight}>{fmt(excesosPotencia)}</Text>
              </View>
            </>
          )}

          {/* ── 5. Término de Excedentes ── */}
          {(excedentesAutoconsumo !== 0 || bolsilloSolarLlenado !== 0) && (
            <>
              <View style={styles.groupHeader}>
                <Text style={styles.ghLabel}>Término de Excedentes</Text>
                <Text style={styles.ghUnit}>kWh</Text>
                <Text style={styles.ghUnit}></Text>
                <Text style={styles.ghUnit}>€/kWh</Text>
                <Text style={styles.ghRight}></Text>
              </View>
              <View style={styles.extraRow}>
                <View style={styles.erConcept}>
                  <Text>
                    Excedentes Autoconsumo (máximo aplicable según RD 244/2019:{' '}
                    {fmt(Math.abs(maxExcedentes))} €)
                  </Text>
                </View>
                <Text style={styles.erCenter}>{totalExcKwh}</Text>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erCenter}>{pexcPdf}</Text>
                <Text style={styles.erRight}>
                  {excedentesAutoconsumo > 0
                    ? `-${fmt(excedentesAutoconsumo)}`
                    : fmt(-excedentesAutoconsumo)}
                </Text>
              </View>
              {bolsilloSolarLlenado !== 0 && (
                <View style={styles.extraRow}>
                  <View style={styles.erConcept}>
                    <Text>
                      Llenado de Bolsillo Solar (Excedentes - Máximo aplicable:{' '}
                      {fmt(bolsilloSolarLlenado)} €)
                    </Text>
                  </View>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erRight}>0.00</Text>
                </View>
              )}
            </>
          )}

          {/* ── 6. Impuestos y Conceptos Regulados/Adicionales ── */}
          <View style={[styles.groupHeader, { marginTop: 1 }]}>
            <Text style={styles.ghLabel}>Impuestos y Conceptos Regulados/Adicionales</Text>
            <Text style={styles.ghUnit}></Text>
            <Text style={styles.ghUnit}></Text>
            <Text style={styles.ghUnit}></Text>
            <Text style={styles.ghRight}></Text>
          </View>

          {taxElectric !== 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>Impuesto Eléctrico</Text>
                <Text style={{ fontSize: 5.5, color: C.muted, marginTop: 1 }}>
                  Impuesto especial sobre la facturación de la electricidad suministrada (Base = TPA
                  + TEA + TER): {fmt(baseIEE)} x {ieePct.toFixed(5)}%
                  {ieeReductionPct > 0 ? ` (Reducción Art. 98 LIE: ${ieeReductionPct}%)` : ''}{' '}
                  (Mínimo de 1 €/MWh para tarifas 2.0TD y 3.0TD y 0,5 €/MWh para el resto)
                </Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erRight}>{fmt(taxElectric)}</Text>
            </View>
          )}

          {bonoSocial !== 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>
                  {bonoSocialLabel || 'Financiación del Bono Social según Orden TED/1487/2024'}
                </Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}>{daysStr}</Text>
              <Text style={styles.erCenter}>{Math.abs(bsUnitRate).toFixed(6)}</Text>
              <Text style={styles.erRight}>{fmt(bonoSocial)}</Text>
            </View>
          )}

          {alquilerEquipo !== 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>Alquiler equipo de Medida</Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}>{daysStr}</Text>
              <Text style={styles.erCenter}>
                {(Math.abs(alquilerEquipo) / Math.max(daysNum, 1)).toFixed(6)}
              </Text>
              <Text style={styles.erRight}>{fmt(alquilerEquipo)}</Text>
            </View>
          )}

          {showBolsilloSolar && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>Costes de Gestión Bolsillo Solar</Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}>{daysStr}</Text>
              <Text style={styles.erCenter}>{Math.abs(cgBsUnitRate).toFixed(6)}</Text>
              <Text style={styles.erRight}>{fmt(cgBolsilloSolarCost)}</Text>
            </View>
          )}

          {penalizacionNoIcpCost !== 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>Penalización por ausencia de ICP</Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erRight}>{fmt(penalizacionNoIcpCost)}</Text>
            </View>
          )}

          {recargoInfAnioCost !== 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>Recargo contratación duración inferior a un año</Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erRight}>{fmt(recargoInfAnioCost)}</Text>
            </View>
          )}

          {interesesDemoraCost !== 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>Intereses de demora reglamentarios</Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erRight}>{fmt(interesesDemoraCost)}</Text>
            </View>
          )}

          {repercutiblesBaseItems.map((item: any, idx: number) => (
            <View style={styles.extraRow} key={`rep-${idx}`}>
              <View style={styles.erConcept}>
                <Text>{item.description || `Concepto distribuidora (${item.code})`}</Text>
              </View>
              <Text style={styles.erCenter}>{item.units ? fmtQty(item.units) : ''}</Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}>
                {item.unitPrice ? Number(item.unitPrice).toFixed(4) : ''}
              </Text>
              <Text style={styles.erRight}>{fmt(item.total)}</Text>
            </View>
          ))}

          {Array.isArray(svaDetails) && svaDetails.length > 0
            ? svaDetails.map((sva: any, idx: number) => (
                <View style={styles.extraRow} key={`sva-${idx}`}>
                  <View style={styles.erConcept}>
                    <Text>{sva.name}</Text>
                  </View>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erCenter}>{sva.days || daysStr}</Text>
                  <Text style={styles.erCenter}>
                    {sva.dailyPrice ? Math.abs(Number(sva.dailyPrice)).toFixed(6) : ''}
                  </Text>
                  <Text style={styles.erRight}>{fmt(sva.total)}</Text>
                </View>
              ))
            : svaCost !== 0 && (
                <View style={styles.extraRow}>
                  <View style={styles.erConcept}>
                    <Text>{svaConcept || 'Servicios de Valor Añadido'}</Text>
                  </View>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erCenter}>{daysStr}</Text>
                  <Text style={styles.erCenter}>
                    {(Math.abs(svaCost) / Math.max(daysNum, 1)).toFixed(6)}
                  </Text>
                  <Text style={styles.erRight}>{fmt(svaCost)}</Text>
                </View>
              )}
        </View>

        {/* ── 7. Totales & 8. Tu Bolsillo Solar ── */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsLeft}>
            {showBolsilloSolar && (
              <View style={[styles.solarWrap, { width: '100%', marginTop: 0 }]}>
                <View style={styles.solarTitle}>
                  <Text style={styles.solarTitleText}>Tu Bolsillo Solar en esta Factura</Text>
                </View>
                <View style={styles.solarTable}>
                  <View style={styles.solarHead}>
                    <Text style={styles.solarHeadCell}>Saldo inicial</Text>
                    <Text style={styles.solarHeadCell}>Llenado</Text>
                    <Text style={styles.solarHeadCell}>Uso</Text>
                    <Text style={styles.solarHeadCellLast}>Saldo final</Text>
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    <Text style={styles.solarCell}>{fmt(bolsilloSolarSaldoInicial)} €</Text>
                    <Text style={styles.solarCell}>{fmt(bolsilloSolarLlenado)} €</Text>
                    <Text style={styles.solarCell}>{fmt(bolsilloSolarUso)} €</Text>
                    <Text style={styles.solarCellLast}>{fmt(bolsilloSolarSaldoFinal)} €</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={styles.totalsRight}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelGrey}>Base Imponible</Text>
              <Text style={styles.totalValGrey}>{fmt(subtotal1)} €</Text>
            </View>

            {Array.isArray(taxBreakdown) && taxBreakdown.length > 0 ? (
              taxBreakdown.map((tb: any, idx: number) => (
                <View style={styles.totalRow} key={`tb-${idx}`}>
                  <Text style={styles.totalLabelGrey}>
                    {tb.rate}% {tb.taxType || taxType} (BI {fmt(tb.base)} €)
                  </Text>
                  <Text style={styles.totalValGrey}>{fmt(tb.amount)} €</Text>
                </View>
              ))
            ) : (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelGrey}>
                  {taxPercentage}% {taxType} (BI {fmt(subtotal1)} €)
                </Text>
                <Text style={styles.totalValGrey}>{fmt(taxAmount)} €</Text>
              </View>
            )}

            {(conceptosRepercutiblesExempt !== 0 || repercutiblesExemptItems.length > 0) && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelGrey}>Conceptos exentos (fianzas/suplidos)</Text>
                <Text style={styles.totalValGrey}>{fmt(conceptosRepercutiblesExempt)} €</Text>
              </View>
            )}

            {bolsilloSolarUso !== 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabelGrey, { color: C.green }]}>
                  Descuento Bolsillo Solar
                </Text>
                <Text style={[styles.totalValGrey, { color: C.green }]}>
                  -{fmt(Math.abs(bolsilloSolarUso))} €
                </Text>
              </View>
            )}

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total FACTURA</Text>
              <Text style={styles.grandTotalVal}>{fmt(totalAmount)} €</Text>
            </View>
          </View>
        </View>

        {/* ── Legal ── */}
        <Text style={styles.legalText}>
          Peajes de transporte y distribución según Resolución CNMC vigente; cargos del sistema
          eléctrico, pagos por capacidad, retribución OM/OS y financiación del Bono Social según
          Orden Ministerial MITECO aplicable a cada día natural del periodo facturado.
        </Text>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 2 — DATOS DE CONSUMO E INFORMACIÓN AMBIENTAL
      ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={[styles.headerBand, { padding: '8 16', marginBottom: 8 }]}>
          <View>
            <Text style={[styles.companyName, { fontSize: 11 }]}>{companyName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#cbd5e1', fontSize: 7 }}>Información al consumidor</Text>
            <Text style={{ color: C.white, fontSize: 8, fontFamily: 'Helvetica-Bold' }}>
              {invoiceNumber || 'BORRADOR'}
            </Text>
          </View>
        </View>

        {/* ── Datos de consumo ── */}
        <View style={styles.p2SectionBar}>
          <Text style={styles.p2SectionBarText}>DATOS DE CONSUMO</Text>
        </View>
        <View style={styles.consTableWrap}>
          <View style={styles.consGroupHead}>
            <Text style={styles.consGroupHeadCellFirst}></Text>
            <Text style={[styles.consGroupHeadCell, { flex: 3 }]}>ENERGÍA ACTIVA (kWh)</Text>
            <Text style={[styles.consGroupHeadCell, { flex: 3 }]}>ENERGÍA REACTIVA (kVArh)</Text>
            <Text style={styles.consGroupHeadCellLast}>Maxímetro (kW)</Text>
          </View>
          <View style={styles.consSubHead}>
            <Text style={[styles.consSubHeadCell, { flex: 1 }]}>Periodo</Text>
            <Text style={styles.consSubHeadCell}>Inicio</Text>
            <Text style={styles.consSubHeadCell}>Fin</Text>
            <Text style={styles.consSubHeadCell}>Consumo</Text>
            <Text style={styles.consSubHeadCell}>Inicio</Text>
            <Text style={styles.consSubHeadCell}>Fin</Text>
            <Text style={styles.consSubHeadCell}>Consumo</Text>
            <Text style={styles.consSubHeadCellLast}>Max.</Text>
          </View>
          {consumos.map((c, i) => (
            <View style={i % 2 === 0 ? styles.consDataRow : styles.consDataRowAlt} key={`c-${i}`}>
              <Text style={styles.consCellBold}>{c.p}</Text>
              <Text style={styles.consCell}>{c.actIni}</Text>
              <Text style={styles.consCell}>{c.actFin}</Text>
              <Text
                style={[
                  styles.consCell,
                  { fontFamily: 'Helvetica-Bold', color: c.act > 0 ? C.accent : C.text },
                ]}
              >
                {c.act}
              </Text>
              <Text style={styles.consCell}>{c.reactIni}</Text>
              <Text style={styles.consCell}>{c.reactFin}</Text>
              <Text style={styles.consCell}>{c.reac}</Text>
              <Text style={styles.consCellLast}>{c.max}</Text>
            </View>
          ))}
          <View style={styles.consFooterRow}>
            <Text style={styles.consFooterLabel}>Energía consumida</Text>
            <Text style={styles.consFooterVal}>{totalActKwh.toLocaleString('es-ES')} kWh</Text>
            <Text style={styles.consFooterEmpty}></Text>
          </View>
          {absExcKwh > 0 && (
            <View style={styles.consFooterRow}>
              <Text style={styles.consFooterLabel}>Energía excedentaria vertida</Text>
              <Text style={styles.consFooterVal}>{totalExcKwh} kWh</Text>
              <Text style={styles.consFooterEmpty}></Text>
            </View>
          )}
        </View>

        {/* ── Origen de la electricidad ── */}
        <View style={styles.p2SectionBar}>
          <Text style={styles.p2SectionBarText}>ORIGEN DE LA ELECTRICIDAD</Text>
        </View>
        <View
          style={{
            border: `1 solid ${C.border}`,
            borderRadius: '0 0 3 3',
            padding: '10 20',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text
              style={{
                fontFamily: 'Helvetica-Bold',
                fontSize: 8,
                color: C.brand,
                marginBottom: 6,
                textAlign: 'center',
              }}
            >
              {String(companyName).toUpperCase()}
            </Text>
            <Svg width="90" height="90" viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r="48" fill={C.green} />
              <Circle cx="50" cy="50" r="32" fill="white" />
              <Circle cx="50" cy="50" r="18" fill={C.green} />
            </Svg>
            <Text
              style={{
                fontFamily: 'Helvetica-Bold',
                fontSize: 10,
                color: C.green,
                marginTop: 4,
              }}
            >
              Renovable 100%
            </Text>
          </View>
          <View style={{ flex: 2 }}>
            <Text style={{ fontSize: 7, color: C.muted, lineHeight: 1.5 }}>
              La electricidad suministrada proviene de fuentes de energía renovable acreditadas
              mediante el Sistema de Garantías de Origen y Etiquetado de la Electricidad expedido
              por la CNMC. Más información en https://gdo.cnmc.es/
            </Text>
          </View>
        </View>

        {/* ── Impacto medioambiental ── */}
        <View style={styles.p2SectionBarAccent}>
          <Text style={styles.p2SectionBarText}>IMPACTO MEDIOAMBIENTAL</Text>
        </View>
        <View style={{ border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', padding: '8 12' }}>
          <Text style={{ fontSize: 6.5, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>
            En una escala de A a G (A = mínimo impacto, G = máximo), la energía comercializada tiene
            los siguientes valores:
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(['CO2 (g/kWh)', 'Residuos Radiactivos (mg/kWh)'] as const).map((label, li) => (
              <View
                key={li}
                style={{
                  flex: 1,
                  border: `1 solid ${C.border}`,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <View style={{ backgroundColor: C.accent, padding: '4 6' }}>
                  <Text
                    style={{
                      color: C.white,
                      fontSize: 6.5,
                      fontFamily: 'Helvetica-Bold',
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </Text>
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
                  <View
                    key={lbl}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: '1 4' }}
                  >
                    <Text
                      style={{
                        width: 10,
                        fontSize: 6,
                        fontFamily: 'Helvetica-Bold',
                        color: C.muted,
                      }}
                    >
                      {lbl}
                    </Text>
                    <View style={{ width: w, height: 8, backgroundColor: bg, borderRadius: 1 }} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* ── Observaciones ── */}
        <View style={[styles.p2SectionBar, { marginTop: 10 }]}>
          <Text style={styles.p2SectionBarText}>OBSERVACIONES Y RECLAMACIONES</Text>
        </View>
        <View style={{ border: `1 solid ${C.border}`, borderRadius: '0 0 3 3', padding: '6 10' }}>
          <Text style={{ fontSize: 5.8, color: C.muted, lineHeight: 1.45 }}>
            Atención al Cliente y Reclamaciones ({companyName}):{' '}
            {[
              companyPhone && companyPhone !== '-' ? `Teléfono ${companyPhone}` : null,
              companyEmail && companyEmail !== '-' ? `Email ${companyEmail}` : null,
              companyAddress && companyAddress !== '-' ? `Dirección ${companyAddress}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Consulte nuestros canales habituales de atención.'}{' '}
            En caso de discrepancia con la facturación o las condiciones de suministro, el
            consumidor puede acudir al sistema arbitral de consumo o al órgano competente en materia
            de energía de su Comunidad Autónoma.
          </Text>
          {svaCost !== 0 && svaConcept ? (
            <Text style={{ fontSize: 5.8, color: C.muted, lineHeight: 1.45, marginTop: 3 }}>
              Servicios adicionales contratados incluidos en esta factura: {svaConcept} (
              {fmt(svaCost)} €).
            </Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
};
