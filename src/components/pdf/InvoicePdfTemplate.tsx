import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Circle,
  Path,
  Rect,
  Line,
  Polygon,
  Image,
  Link,
} from '@react-pdf/renderer';

// ─── Paleta ejecutiva por defecto (sobria y de alto contraste en pantalla e impresión) ───
const C = {
  brand: '#14383b', // verde petróleo corporativo profundo
  navy2: '#1f4e52', // petróleo medio para subcabeceras de tabla
  navyLt: '#eef5f5', // tinte petróleo muy suave
  accent: '#e06d3b', // coral corporativo con contraste AA para texto blanco
  accentSoft: '#f6936b', // coral claro de marca
  accentLt: '#fef4ef', // fondo cálido para columna Total €
  rowAlt: '#f8fafc',
  border: '#cbd5e1',
  text: '#0f172a',
  muted: '#475569',
  subtle: '#64748b',
  white: '#ffffff',
  green: '#009640',
  link: '#1d4ed8',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 30,
    paddingLeft: 32,
    paddingRight: 26,
    fontFamily: 'Helvetica',
    fontSize: 7.2,
    color: C.text,
    backgroundColor: C.white,
  },

  // Texto registral vertical en margen izquierdo (presente en todas las páginas)
  verticalLegalWrap: {
    position: 'absolute',
    left: -252,
    top: 415,
    width: 530,
    transform: 'rotate(-90deg)',
  },
  verticalLegalText: {
    fontSize: 5.1,
    color: C.subtle,
    textAlign: 'center',
    letterSpacing: 0.15,
  },

  // Pie de página corporativo fijo
  footerWrap: {
    position: 'absolute',
    bottom: 11,
    left: 32,
    right: 26,
    borderTop: `0.6 solid ${C.border}`,
    paddingTop: 3.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 6.3,
    color: C.muted,
    fontFamily: 'Helvetica-Bold',
  },
  footerPageNum: {
    fontSize: 6,
    color: C.subtle,
  },

  // Cabecera principal Página 1
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
    paddingBottom: 6,
    borderBottom: `1.5 solid ${C.brand}`,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '64%',
  },
  logoImg: {
    height: 34,
    maxWidth: 145,
    objectFit: 'contain',
    marginRight: 10,
  },
  companyMetaBlock: {
    justifyContent: 'center',
  },
  companyNameText: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
  },
  companyMetaSub: {
    fontSize: 6.1,
    color: C.muted,
    marginTop: 1.2,
  },
  invoiceBadge: {
    backgroundColor: C.brand,
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 3,
    alignItems: 'flex-end',
    borderLeft: `3.5 solid ${C.accent}`,
  },
  invoiceBadgeTitle: {
    color: C.white,
    fontSize: 9.8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.6,
  },
  invoiceBadgeNumber: {
    color: '#fed7aa',
    fontSize: 7.8,
    fontFamily: 'Helvetica-Bold',
    marginTop: 1.5,
  },

  // Cuadrícula de metadatos (4 cajas superiores)
  infoGrid: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 6,
  },
  infoBox: {
    flex: 1,
    border: `0.8 solid ${C.border}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  infoBoxHeader: {
    backgroundColor: C.brand,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  infoBoxHeaderAccent: {
    backgroundColor: C.accent,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  infoBoxTitle: {
    color: C.white,
    fontSize: 6.7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.4,
  },
  infoBoxBody: {
    padding: '4.5 7',
    backgroundColor: C.white,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 1.7,
    alignItems: 'flex-start',
  },
  infoLabel: {
    width: 84,
    color: C.muted,
    fontSize: 6.4,
  },
  infoLabelWide: {
    width: 98,
    color: C.muted,
    fontSize: 6.4,
  },
  infoValue: {
    flex: 1,
    fontSize: 6.7,
    color: C.text,
  },
  infoValueRight: {
    flex: 1,
    textAlign: 'right',
    fontSize: 6.7,
    color: C.text,
  },
  totalPayBand: {
    backgroundColor: C.accentLt,
    borderTop: `1 solid ${C.accent}`,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3.5 7',
    marginTop: 2.5,
  },
  totalPayLabel: {
    color: C.accent,
    fontSize: 7.6,
    fontFamily: 'Helvetica-Bold',
  },
  totalPayValue: {
    color: C.accent,
    fontSize: 8.4,
    fontFamily: 'Helvetica-Bold',
  },

  // Barras de sección y tabla DETALLE DE LA FACTURA (Regla estricta .agents/AGENTS.md)
  sectionBar: {
    backgroundColor: C.brand,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    marginTop: 3,
    borderRadius: '2 2 0 0',
  },
  sectionBarText: {
    color: C.white,
    fontSize: 7.6,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  tableWrap: {
    border: `0.8 solid ${C.border}`,
    borderRadius: '0 0 3 3',
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.navy2,
    paddingVertical: 3.5,
    paddingHorizontal: 2,
  },
  thConcept: {
    flex: 4.6,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    paddingLeft: 6,
    fontSize: 6.8,
  },
  thCenter: {
    flex: 1,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    fontSize: 6.8,
  },
  thRight: {
    flex: 1.4,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    paddingRight: 6,
    fontSize: 6.8,
  },

  groupHeader: {
    flexDirection: 'row',
    backgroundColor: C.navyLt,
    paddingVertical: 2.5,
    paddingHorizontal: 2,
    borderTop: `0.8 solid ${C.border}`,
  },
  ghLabel: {
    flex: 4.6,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
    paddingLeft: 6,
    fontSize: 6.9,
  },
  ghUnit: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textAlign: 'center',
    fontSize: 6.5,
  },
  ghRight: {
    flex: 1.4,
    backgroundColor: C.accentLt,
    textAlign: 'right',
    paddingRight: 6,
    fontSize: 6.8,
  },

  dataRow: {
    flexDirection: 'row',
    paddingVertical: 2.1,
    paddingHorizontal: 2,
    borderTop: `0.5 solid ${C.border}`,
  },
  dataRowAlt: {
    flexDirection: 'row',
    paddingVertical: 2.1,
    paddingHorizontal: 2,
    borderTop: `0.5 solid ${C.border}`,
    backgroundColor: C.rowAlt,
  },
  drConcept: {
    flex: 4.6,
    paddingLeft: 10,
  },
  drConceptText: {
    fontSize: 6.9,
    color: C.text,
  },
  drSubtext: {
    fontSize: 5.6,
    color: C.muted,
    marginTop: 0.8,
  },
  drCenter: {
    flex: 1,
    textAlign: 'center',
    color: C.text,
    fontSize: 6.8,
  },
  drRight: {
    flex: 1.4,
    textAlign: 'right',
    paddingRight: 6,
    backgroundColor: C.accentLt,
    color: C.text,
    fontSize: 6.9,
  },

  extraRow: {
    flexDirection: 'row',
    paddingVertical: 2.2,
    paddingHorizontal: 2,
    borderTop: `0.5 solid ${C.border}`,
  },
  erConcept: {
    flex: 4.6,
    paddingLeft: 6,
    paddingRight: 4,
  },
  erCenter: {
    flex: 1,
    textAlign: 'center',
    color: C.text,
    fontSize: 6.8,
  },
  erRight: {
    flex: 1.4,
    textAlign: 'right',
    paddingRight: 6,
    backgroundColor: C.accentLt,
    fontSize: 6.9,
  },

  // Totales y Bolsillo Solar
  totalsWrap: {
    flexDirection: 'row',
    marginTop: 5,
    alignItems: 'flex-start',
  },
  totalsLeft: {
    flex: 1,
    paddingRight: 10,
  },
  totalsRight: {
    width: 212,
    border: `0.8 solid ${C.border}`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '3.5 8',
    borderBottom: `0.5 solid ${C.border}`,
  },
  totalLabelGrey: {
    color: C.muted,
    fontSize: 6.9,
  },
  totalValGrey: {
    color: C.text,
    fontSize: 6.9,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5.5 8',
    backgroundColor: C.brand,
  },
  grandTotalLabel: {
    color: C.white,
    fontSize: 8.4,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalVal: {
    color: '#fed7aa',
    fontSize: 9.2,
    fontFamily: 'Helvetica-Bold',
  },

  solarWrap: {
    width: '100%',
  },
  solarTitle: {
    backgroundColor: C.green,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: '3 3 0 0',
  },
  solarTitleText: {
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
  },
  solarTable: {
    border: `0.8 solid ${C.border}`,
    borderRadius: '0 0 3 3',
    overflow: 'hidden',
  },
  solarHead: {
    flexDirection: 'row',
    backgroundColor: '#e6f4ee',
  },
  solarHeadCell: {
    flex: 1,
    textAlign: 'center',
    padding: '2.5 2',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.4,
    color: '#14532d',
    borderRight: `0.5 solid ${C.border}`,
  },
  solarHeadCellLast: {
    flex: 1,
    textAlign: 'center',
    padding: '2.5 2',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.4,
    color: '#14532d',
  },
  solarCell: {
    flex: 1,
    textAlign: 'center',
    padding: '3 2',
    borderRight: `0.5 solid ${C.border}`,
    fontSize: 6.8,
  },
  solarCellLast: {
    flex: 1,
    textAlign: 'center',
    padding: '3 2',
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: C.green,
  },

  // Estilos Página 2 (Consumos, Histórico, Etiquetado CNMC, Observaciones y QR)
  p2HeaderBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
    marginBottom: 5,
    borderBottom: `1.2 solid ${C.brand}`,
  },
  p2SectionBar: {
    backgroundColor: C.brand,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 5,
    borderRadius: '2 2 0 0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  p2SectionBarAccent: {
    backgroundColor: C.accent,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 5,
    borderRadius: '2 2 0 0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  p2SectionBarText: {
    color: C.white,
    fontSize: 7.2,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.4,
  },
  p2SectionSubText: {
    color: '#e2e8f0',
    fontSize: 5.8,
  },

  consTableWrap: {
    border: `0.8 solid ${C.border}`,
    borderRadius: '0 0 3 3',
    overflow: 'hidden',
  },
  consGroupHead: {
    flexDirection: 'row',
    backgroundColor: C.navy2,
  },
  consGroupCellFirst: {
    flex: 0.75,
    padding: '3 2',
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.4,
    textAlign: 'center',
    borderRight: '0.5 solid rgba(255,255,255,0.28)',
  },
  consGroupCellSpan3: {
    flex: 3.3,
    padding: '3 2',
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.4,
    textAlign: 'center',
    borderRight: '0.5 solid rgba(255,255,255,0.28)',
  },
  consGroupCellLast: {
    flex: 1.05,
    padding: '3 2',
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.4,
    textAlign: 'center',
  },
  consSubHead: {
    flexDirection: 'row',
    backgroundColor: C.navyLt,
    borderBottom: `0.8 solid ${C.border}`,
  },
  consSubCellPeriod: {
    flex: 0.75,
    padding: '2.2 2',
    textAlign: 'center',
    color: C.brand,
    fontFamily: 'Helvetica-Bold',
    fontSize: 6,
    borderRight: `0.5 solid ${C.border}`,
  },
  consSubCell: {
    flex: 1.1,
    padding: '2.2 2',
    textAlign: 'center',
    color: C.brand,
    fontFamily: 'Helvetica-Bold',
    fontSize: 5.8,
    borderRight: `0.5 solid ${C.border}`,
  },
  consSubCellLast: {
    flex: 1.05,
    padding: '2.2 2',
    textAlign: 'center',
    color: C.brand,
    fontFamily: 'Helvetica-Bold',
    fontSize: 5.8,
  },
  consDataRow: {
    flexDirection: 'row',
    borderTop: `0.5 solid ${C.border}`,
  },
  consDataRowAlt: {
    flexDirection: 'row',
    borderTop: `0.5 solid ${C.border}`,
    backgroundColor: C.rowAlt,
  },
  consCellPeriod: {
    flex: 0.75,
    padding: '2.2 2',
    textAlign: 'center',
    borderRight: `0.5 solid ${C.border}`,
    fontSize: 6.4,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
  },
  consCell: {
    flex: 1.1,
    padding: '2.2 2',
    textAlign: 'center',
    borderRight: `0.5 solid ${C.border}`,
    fontSize: 6.4,
  },
  consCellLast: {
    flex: 1.05,
    padding: '2.2 2',
    textAlign: 'center',
    fontSize: 6.4,
  },
  consFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: `0.8 solid ${C.border}`,
    backgroundColor: C.navyLt,
    padding: '2.8 7',
  },
});

// ─── Formateadores numéricos y de fechas en español (coma decimal) ───────────
function fmtEs(n: number | undefined | null, dec = 2): string {
  if (n === undefined || n === null || isNaN(Number(n))) return '-';
  const num = Number(n);
  const fixed = num.toFixed(dec);
  const [intPart, decPart] = fixed.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}

function fmtSmartEs(val: string | number | undefined | null, maxDec = 3): string {
  if (val === undefined || val === null || val === '' || val === '-') return '-';
  const num =
    typeof val === 'number' ? val : parseFloat(String(val).trim().replace(',', '.'));
  if (!Number.isFinite(num)) return String(val);
  if (Math.abs(num - Math.round(num)) < 1e-6) {
    return fmtEs(Math.round(num), 0);
  }
  const fixed = num.toFixed(maxDec).replace(/0+$/, '').replace(/\.$/, '');
  const decCount = fixed.includes('.') ? fixed.split('.')[1].length : 0;
  return fmtEs(num, decCount);
}

function fmtQtyEs(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(Number(n))) return '';
  return fmtSmartEs(n, 3);
}

function fmtMadridDate(d?: string | Date | null): string {
  if (!d) return '-';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    const [y, m, day] = d.trim().split('-');
    return `${day}/${m}/${y}`;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const iso = dt.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, day] = iso.split('-');
    return `${day}/${m}/${y}`;
  }
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

function fmtXmlExclusiveStartToInclusiveEs(isoDate?: string): string {
  if (!isoDate || isoDate.length < 10) return '';
  const clean = isoDate.trim().substring(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return '';
  const shifted = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().substring(0, 10);
  return fmtMadridDate(shifted);
}

const SCALE_ROWS: Array<{
  letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  color: string;
  barW: number;
}> = [
  { letter: 'A', color: '#009640', barW: 26 },
  { letter: 'B', color: '#50b848', barW: 34 },
  { letter: 'C', color: '#b5d334', barW: 42 },
  { letter: 'D', color: '#ffdd00', barW: 50 },
  { letter: 'E', color: '#f59c00', barW: 58 },
  { letter: 'F', color: '#eb690b', barW: 66 },
  { letter: 'G', color: '#e30613', barW: 74 },
];

function EnvironmentalScale({
  activeLetter = 'A',
}: {
  activeLetter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
}) {
  return (
    <View style={{ paddingVertical: 1 }}>
      {SCALE_ROWS.map((row) => {
        const isSelected = row.letter === activeLetter;
        return (
          <View
            key={row.letter}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 10.2,
              marginBottom: 1.6,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: row.barW,
                  height: 9.8,
                  backgroundColor: row.color,
                  justifyContent: 'center',
                  paddingLeft: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 5.7,
                    fontFamily: 'Helvetica-Bold',
                    color: row.letter === 'D' ? '#0f172a' : '#ffffff',
                  }}
                >
                  {row.letter}
                </Text>
              </View>
              <Svg width="5" height="9.8" viewBox="0 0 5 10">
                <Polygon points="0,0 5,5 0,10" fill={row.color} />
              </Svg>
            </View>

            {isSelected ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Svg width="5.5" height="10.8" viewBox="0 0 5.5 11">
                  <Polygon points="5.5,0 0,5.5 5.5,11" fill="#0f172a" />
                </Svg>
                <View
                  style={{
                    backgroundColor: '#0f172a',
                    height: 10.8,
                    minWidth: 16,
                    paddingHorizontal: 4.5,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 6.6,
                      fontFamily: 'Helvetica-Bold',
                      color: '#ffffff',
                    }}
                  >
                    {activeLetter}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export const InvoicePdfTemplate = ({ data }: { data: any }) => {
  const {
    invoiceNumber,
    invoiceType = 'Normal',
    issueDate,
    paymentDate,
    billingStart,
    billingEnd,
    billingDays,

    companyName = 'Comercializadora Eléctrica',
    companyCif = '-',
    companyAddress = '',
    companyEmail = '',
    companyPhone = '',
    companyWeb = '',
    companyOrdenCnmc = 'R2-950',
    companyVerticalLegalText = '',
    logoUrl = null,

    clientName = 'Cliente',
    clientNif = '-',
    clientAddress = '',
    ibanMasked = '',
    paymentMethodType = 'RECIBO',
    sepaMandateRef = '',
    companyBankIban = '',
    companyBankName = '',

    cups = '-',
    supplyAddress = '',
    supplyPostalCode = '',
    tariff = '2.0TD',
    cargoSegment = '1',
    cnae = '-',
    meterSerialNumber = '-',
    distributorName = '',
    distributorPhone = '900 000 000',
    accessContractRef = '-',
    supplyContractRef = '-',
    f1FiscalCode = '-',
    productName = '',
    pricingModality = '',
    contractEndDate = null,
    isAutoRenewal = true,
    hasPermanence = false,
    permanenceEndDate = null,
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

    totalMWh = 0,
    subtotal1 = 0,
    taxType = 'IVA',
    taxPercentage = 21,
    taxAmount = 0,
    taxBreakdown = [],
    totalAmount = 0,

    consumptionHistory = [],
    annualTotalKwh = 0,
    dailyAvgKwh = 0,
    dailyAvgEur = 0,
    prevYearSameMonthKwh = null,
    postalCodeAvgKwh = null,
    maxDemandedPowers12m = {},
    powerControlMode = 'ICP',
    rectifiedInfo = null,
    boeLegalText = '',
    indexedFormulaNote = '',
    f1DistributorComments = '',
    energyOriginMix = [],
    environmentalImpact = {
      labelYear: 2024,
      co2Letter: 'A',
      co2CompanyGPerKwh: 0,
      co2NationalGPerKwh: 102,
      radLetter: 'A',
      radCompanyUgPerKwh: 0,
      radNationalUgPerKwh: 446,
    },
    showCnmcQr = false,
    cnmcQrUrl = '',
    cnmcQrSvgPath = '',
    cnmcQrModuleCount = 45,
  } = data;

  const is20TD = String(tariff || '').includes('2.0');
  const daysNum =
    Number(billingDays) ||
    (powerDetails.length > 0 && powerDetails[0]?.days
      ? Math.round(Number(powerDetails[0].days))
      : 30);
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

  // Potencias contratadas formateadas por periodo aplicable (2 periodos en 2.0TD; 6 periodos en 3.0TD/6.1TD)
  let contractedPowersText = '-';
  if (is20TD) {
    const p1 = contractedPowers?.P1 ?? contractedPower;
    const p2 = contractedPowers?.P2 ?? contractedPowers?.P3 ?? p1;
    if (p1) {
      contractedPowersText = `${fmtSmartEs(p1, 3)} / ${fmtSmartEs(p2, 3)} kW`;
    }
  } else {
    const sixVals = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
      .map((p) => contractedPowers?.[p])
      .filter((v) => typeof v === 'number' && !isNaN(v) && v > 0);
    if (sixVals.length > 0) {
      contractedPowersText = `${['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
        .map((p) => (contractedPowers?.[p] ? fmtSmartEs(contractedPowers[p], 2) : '0'))
        .join(' / ')} kW`;
    } else if (contractedPower) {
      contractedPowersText = `${fmtSmartEs(contractedPower, 3)} kW`;
    }
  }

  // Lecturas de contador por periodo (P1-P3 en 2.0TD; P1-P6 en 3.0TD/6.1TD)
  const displayPeriods = is20TD ? [1, 2, 3] : [1, 2, 3, 4, 5, 6];
  let readingStartLabel = fmtMadridDate(billingStart);
  let readingEndLabel = fmtInclusiveEndDate(billingStart, billingEnd);
  let readingProcLabel = '';

  const consumos = displayPeriods.map((i) => {
    const pName = `P${i}`;
    const r = f1Readings?.[pName] || {};
    if (r.fechaDesde && readingStartLabel === fmtMadridDate(billingStart)) {
      const parsedIni = fmtXmlExclusiveStartToInclusiveEs(r.fechaDesde);
      if (parsedIni) readingStartLabel = parsedIni;
    }
    if (r.fechaHasta) {
      const parsedFin = fmtMadridDate(r.fechaHasta);
      if (parsedFin && parsedFin !== '-') readingEndLabel = parsedFin;
    }
    if (r.procFin && !readingProcLabel) {
      readingProcLabel = r.procFin;
    }

    const icpOrMaxVal =
      powerControlMode === 'ICP'
        ? i <= 2
          ? contractedPowers?.[pName]
            ? fmtSmartEs(contractedPowers[pName], 2)
            : ''
          : ''
        : r.max && Number(r.max) > 0
          ? fmtSmartEs(r.max, 3)
          : '0';

    const hasReactiveRow =
      (r.reactIni !== undefined && r.reactIni !== '-') ||
      (r.reactFin !== undefined && r.reactFin !== '-') ||
      Number(r.reactCons || 0) > 0;

    return {
      p: pName,
      actIni: r.actIni !== undefined && r.actIni !== '-' ? fmtSmartEs(r.actIni, 3) : '-',
      actFin: r.actFin !== undefined && r.actFin !== '-' ? fmtSmartEs(r.actFin, 3) : '-',
      actNum: Number(r.actCons || 0),
      actStr: fmtSmartEs(r.actCons ?? 0, 3),
      reactIni: hasReactiveRow ? fmtSmartEs(r.reactIni, 3) : '',
      reactFin: hasReactiveRow ? fmtSmartEs(r.reactFin, 3) : '',
      reacStr: hasReactiveRow ? fmtSmartEs(r.reactCons ?? 0, 3) : '',
      maxStr: icpOrMaxVal,
    };
  });

  const sumMeterActKwh = consumos.reduce((s, c) => s + (c.actNum || 0), 0);
  const sumDetailKwh =
    (energyMarketDetails.length > 0
      ? energyMarketDetails.reduce((s: number, e: any) => s + Math.abs(Number(e.kwh || 0)), 0)
      : energyAtrDetails.reduce((s: number, e: any) => s + Math.abs(Number(e.kwh || 0)), 0)) ||
    Math.abs(Number(totalMWh || 0) * 1000);
  const totalBilledKwh = sumDetailKwh > 0 ? sumDetailKwh : sumMeterActKwh;
  const hasTrafoLossesDiff =
    sumMeterActKwh > 0 && totalBilledKwh > 0 && Math.abs(totalBilledKwh - sumMeterActKwh) >= 0.5;

  const absExcAutoconsumo = Math.abs(Number(excedentesAutoconsumo || 0));
  const absExcKwh = Math.abs(Number(excedentesKwh || 0));
  const totalExcKwhStr =
    absExcKwh > 0
      ? fmtEs(absExcKwh, 2)
      : absExcAutoconsumo > 0
        ? fmtEs(absExcAutoconsumo / 0.03, 2)
        : '0,00';
  const pexcPdfStr =
    pexc !== null && pexc !== undefined && Number(pexc) > 0
      ? fmtEs(Number(pexc) / 1000, 6)
      : absExcKwh > 0
        ? fmtEs(absExcAutoconsumo / absExcKwh, 6)
        : '0,000000';

  const isProforma =
    String(invoiceNumber || '').startsWith('PROFORMA-') ||
    String(invoiceNumber || '').startsWith('BORRADOR');
  const invTypeUpper = String(invoiceType || 'Normal').toUpperCase();
  const isRect = invTypeUpper === 'RECTIFICADORA' || invTypeUpper === 'RECTIFICATIVA';
  const isAbono = invTypeUpper === 'ABONO' || totalAmount < 0;

  const badgeTitle = isRect
    ? 'FACTURA RECTIFICATIVA'
    : isAbono
      ? 'FACTURA DE ABONO'
      : isProforma
        ? 'FACTURA PROFORMA'
        : 'FACTURA';

  const displayInvoiceType = isRect
    ? `Rectificativa${rectifiedInfo ? ' (1)' : ''}`
    : isAbono
      ? `Abono${rectifiedInfo ? ' (1)' : ''}`
      : invoiceType;

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

  const footerContactLine = [
    companyPhone && companyPhone !== '-' ? `Telf. ${companyPhone} (Gratuito)` : null,
    companyWeb || null,
    companyEmail && companyEmail !== '-' ? companyEmail : null,
  ]
    .filter(Boolean)
    .join('  -  ');

  const verticalLegalStr =
    companyVerticalLegalText ||
    `${companyName.toUpperCase()} · CIF ${companyCif} · Nº Orden Comercializadoras ${companyOrdenCnmc}.`;

  // Texto de potencias máximas demandadas en los últimos 12 meses (ordenado P1..P6)
  const max12mEntries = Object.entries(maxDemandedPowers12m || {})
    .filter(([, v]) => typeof v === 'number' && Number(v) > 0)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const max12mText =
    max12mEntries.length > 0
      ? max12mEntries.map(([k, v]) => `${k}: ${fmtSmartEs(v as number, 3)} kW`).join(' · ')
      : '';

  // Geometría del gráfico vectorial de evolución histórica (14 meses)
  const histBars: Array<{ label: string; kwh: number; isCurrent?: boolean }> =
    Array.isArray(consumptionHistory) && consumptionHistory.length > 0
      ? consumptionHistory
      : [{ label: 'Actual', kwh: totalBilledKwh, isCurrent: true }];
  const maxBarKwh = Math.max(10, ...histBars.map((b) => Number(b.kwh || 0)));

  const originRows =
    Array.isArray(energyOriginMix) && energyOriginMix.length > 0
      ? energyOriginMix
      : [
          { source: 'Renovable', companyPct: 100, nationalPct: 50.8, color: C.green },
          { source: 'Cogen. Alta Eficiencia', companyPct: 0, nationalPct: 2.6, color: '#63b3ed' },
          { source: 'CC Gas Natural', companyPct: 0, nationalPct: 18.3, color: '#f6ad55' },
          { source: 'Carbón', companyPct: 0, nationalPct: 1.5, color: '#4a5568' },
          { source: 'Fuel / Gas', companyPct: 0, nationalPct: 1.2, color: '#b7791f' },
          { source: 'Nuclear', companyPct: 0, nationalPct: 20.9, color: '#805ad5' },
          { source: 'Otras no renovables', companyPct: 0, nationalPct: 4.7, color: '#a0aec0' },
        ];

  const productDisplay =
    productName && pricingModality && !productName.toLowerCase().includes(pricingModality.split(' ')[0].toLowerCase())
      ? `${productName} (${pricingModality})`
      : productName || pricingModality || '-';

  return (
    <Document>
      {/* ═══════════════════════════════════════════════════════════════════════
          PÁGINA 1 — DATOS CONTRACTUALES Y DETALLE DE LA FACTURA
      ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        {/* Margen vertical registral y pie fijo */}
        <View style={styles.verticalLegalWrap} fixed>
          <Text style={styles.verticalLegalText}>{verticalLegalStr}</Text>
        </View>
        <View style={styles.footerWrap} fixed>
          <Text style={styles.footerText}>{footerContactLine}</Text>
          <Text
            style={styles.footerPageNum}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`}
          />
        </View>

        {/* Cabecera de Marca */}
        <View style={styles.headerTopRow}>
          <View style={styles.logoWrap}>
            {logoUrl ? <Image src={logoUrl} style={styles.logoImg} /> : null}
            <View style={styles.companyMetaBlock}>
              <Text style={styles.companyNameText}>{companyName}</Text>
              <Text style={styles.companyMetaSub}>
                CIF: {companyCif} · Reg. CNMC Comercializadoras: {companyOrdenCnmc}
              </Text>
              {companyAddress && companyAddress !== '-' ? (
                <Text style={styles.companyMetaSub}>{companyAddress}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.invoiceBadge}>
            <Text style={styles.invoiceBadgeTitle}>{badgeTitle}</Text>
            <Text style={styles.invoiceBadgeNumber}>{invoiceNumber || 'BORRADOR'}</Text>
          </View>
        </View>

        {/* Fila 1: DATOS DEL TITULAR + DATOS DE FACTURA */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <View style={styles.infoBoxHeader}>
              <Text style={styles.infoBoxTitle}>DATOS DEL TITULAR</Text>
            </View>
            <View style={styles.infoBoxBody}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.2, marginBottom: 1.5 }}>
                {clientName}
              </Text>
              <Text style={{ color: C.muted, fontSize: 6.3, marginBottom: 3 }}>
                {clientAddress || 'Dirección fiscal no especificada'}
              </Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CIF / NIF:</Text>
                <Text style={styles.infoValue}>
                  {clientNif}
                  {cnae && cnae !== '-' ? `   ·   CNAE: ${cnae}` : ''}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Cod. Mandato:</Text>
                <Text style={styles.infoValue}>{sepaMandateRef || '-'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tipo de Cobro:</Text>
                <Text style={styles.infoValue}>
                  {paymentMethodType === 'TRANSFERENCIA'
                    ? `TRANSFERENCIA${companyBankIban ? ` (${companyBankName ? `${companyBankName}: ` : ''}${companyBankIban})` : ''}`
                    : `RECIBO   ${ibanMasked}`}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <View style={styles.infoBoxHeaderAccent}>
              <Text style={styles.infoBoxTitle}>DATOS DE FACTURA</Text>
            </View>
            <View style={styles.infoBoxBody}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Nº Factura:</Text>
                <Text style={[styles.infoValueRight, { fontFamily: 'Helvetica-Bold' }]}>
                  {invoiceNumber || 'Borrador'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Tipo de Factura:</Text>
                <Text style={styles.infoValueRight}>{displayInvoiceType}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Período de consumo:</Text>
                <Text style={styles.infoValueRight}>
                  {fmtMadridDate(billingStart)} a {fmtInclusiveEndDate(billingStart, billingEnd)} (
                  {daysStr} días)
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Fecha emisión Factura:</Text>
                <Text style={styles.infoValueRight}>{fmtMadridDate(issueDate)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Fecha cargo a partir de:</Text>
                <Text style={styles.infoValueRight}>
                  {paymentDate ? fmtMadridDate(paymentDate) : fmtMadridDate(issueDate)}
                </Text>
              </View>
              <View style={styles.totalPayBand}>
                <Text style={styles.totalPayLabel}>
                  {totalAmount < 0 ? 'TOTAL A ABONAR:' : 'TOTAL A PAGAR:'}
                </Text>
                <Text style={styles.totalPayValue}>{fmtEs(totalAmount, 2)} €</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fila 2: DATOS DEL PUNTO DE SUMINISTRO + DATOS DEL CONTRATO */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <View style={styles.infoBoxHeader}>
              <Text style={styles.infoBoxTitle}>DATOS DEL PUNTO DE SUMINISTRO</Text>
            </View>
            <View style={styles.infoBoxBody}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CUPS:</Text>
                <Text style={[styles.infoValue, { fontFamily: 'Helvetica-Bold' }]}>{cups}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nº Serie Contador:</Text>
                <Text style={styles.infoValue}>
                  {meterSerialNumber && meterSerialNumber !== '-'
                    ? meterSerialNumber
                    : f1Readings?.NumeroSerie || '-'}
                </Text>
              </View>
              <Text style={{ color: C.muted, fontSize: 6.3, marginTop: 1, marginBottom: 2.5 }}>
                {supplyAddress || clientAddress || 'Dirección de suministro no especificada'}
              </Text>
              <Text style={{ color: C.text, fontSize: 6.3 }}>
                Distribuidora: {distributorName && distributorName !== '-' ? distributorName : '-'}
              </Text>
              {distributorPhone && distributorPhone !== '-' ? (
                <Text
                  style={{
                    color: C.brand,
                    fontFamily: 'Helvetica-Bold',
                    fontSize: 6.4,
                    marginTop: 1.5,
                  }}
                >
                  AVERÍAS Y URGENCIAS: {distributorPhone} (Gratuito 24h)
                </Text>
              ) : null}
            </View>
          </View>

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
              {f1FiscalCode && f1FiscalCode !== '-' ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabelWide}>Ref. Factura ATR (F1):</Text>
                  <Text style={styles.infoValueRight}>{f1FiscalCode}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Modalidad contratada:</Text>
                <Text style={styles.infoValueRight}>{productDisplay}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Fecha fin de contrato:</Text>
                <Text style={styles.infoValueRight}>
                  {contractEndDate ? fmtMadridDate(contractEndDate) : '-'}
                  {contractEndDate && isAutoRenewal ? ' (renovación anual automática)' : ''}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Tarifa / Seg. Cargos:</Text>
                <Text
                  style={[
                    styles.infoValueRight,
                    { fontFamily: 'Helvetica-Bold', color: C.brand },
                  ]}
                >
                  {tariff}   ·   Segmento Cargos: {cargoSegment}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabelWide}>Potencia Contratada (kW):</Text>
                <Text style={styles.infoValueRight}>{contractedPowersText}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── TABLA DETALLE DE LA FACTURA (Estructura estricta .agents/AGENTS.md) ── */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionBarText}>DETALLE DE LA FACTURA</Text>
        </View>
        <View style={styles.tableWrap}>
          <View style={styles.tableHead}>
            <Text style={styles.thConcept}>Concepto</Text>
            <Text style={styles.thCenter}>Cantidad</Text>
            <Text style={styles.thCenter}>Días</Text>
            <Text style={styles.thCenter}>Precio Ud</Text>
            <Text style={styles.thRight}>Total €</Text>
          </View>

          {/* 1. Potencia Facturada */}
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
                  Peajes potencia: {fmtEs(p.peajeEur, 2)} €, Cargos potencia: {fmtEs(p.cargoEur, 2)} €
                </Text>
              </View>
              <Text style={styles.drCenter}>{fmtSmartEs(p.kw, 3)}</Text>
              <Text style={styles.drCenter}>
                {p.days ? Math.round(Number(p.days)).toString() : daysStr}
              </Text>
              <Text style={styles.drCenter}>{fmtEs(p.price, 6)}</Text>
              <Text style={styles.drRight}>{fmtEs(p.total, 2)}</Text>
            </View>
          ))}

          {/* 2. Término de Energía ATR */}
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
                  Peajes energía: {fmtEs(e.peajeEur, 2)} €, Cargos energía: {fmtEs(e.cargoEur, 2)} €
                </Text>
              </View>
              <Text style={styles.drCenter}>{fmtQtyEs(e.kwh)}</Text>
              <Text style={styles.drCenter}></Text>
              <Text style={styles.drCenter}>{fmtEs(e.price, 6)}</Text>
              <Text style={styles.drRight}>{fmtEs(e.total, 2)}</Text>
            </View>
          ))}

          {/* 3. Término de Energía Activa */}
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
              <Text style={styles.drCenter}>{fmtQtyEs(e.kwh)}</Text>
              <Text style={styles.drCenter}></Text>
              <Text style={styles.drCenter}>{fmtEs(e.price, 6)}</Text>
              <Text style={styles.drRight}>{fmtEs(e.total, 2)}</Text>
            </View>
          ))}

          {/* Término de Energía Reactiva / Capacitiva (solo cuando existe importe repercutido) */}
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
                <Text style={styles.drCenter}>{r.kvarh ? fmtQtyEs(r.kvarh) : ''}</Text>
                <Text style={styles.drCenter}></Text>
                <Text style={styles.drCenter}>
                  {r.cost && r.kvarh ? fmtEs(Math.abs(r.cost / r.kvarh), 6) : ''}
                </Text>
                <Text style={styles.drRight}>{fmtEs(r.cost, 2)}</Text>
              </View>
            ))}
          {capacitiveEnergyCost !== 0 &&
            !(reactiveDetails || []).some((r: any) => String(r.period).includes('Cap')) && (
              <View style={styles.extraRow}>
                <View style={styles.erConcept}>
                  <Text>Energía Reactiva Capacitiva</Text>
                </View>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erRight}>{fmtEs(capacitiveEnergyCost, 2)}</Text>
              </View>
            )}

          {/* 4. Término de Excesos de Potencia */}
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
                <Text style={styles.erRight}>{fmtEs(excesosPotencia, 2)}</Text>
              </View>
            </>
          )}

          {/* 5. Término de Excedentes */}
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
                    {fmtEs(Math.abs(maxExcedentes), 2)} €)
                  </Text>
                </View>
                <Text style={styles.erCenter}>{totalExcKwhStr}</Text>
                <Text style={styles.erCenter}></Text>
                <Text style={styles.erCenter}>{pexcPdfStr}</Text>
                <Text style={styles.erRight}>
                  {excedentesAutoconsumo > 0
                    ? `-${fmtEs(excedentesAutoconsumo, 2)}`
                    : fmtEs(-excedentesAutoconsumo, 2)}
                </Text>
              </View>
              {bolsilloSolarLlenado !== 0 && (
                <View style={styles.extraRow}>
                  <View style={styles.erConcept}>
                    <Text>
                      Llenado de Bolsillo Solar (Excedentes - Máximo aplicable:{' '}
                      {fmtEs(bolsilloSolarLlenado, 2)} €)
                    </Text>
                  </View>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erCenter}></Text>
                  <Text style={styles.erRight}>0,00</Text>
                </View>
              )}
            </>
          )}

          {/* 6. Impuestos y Conceptos Regulados/Adicionales */}
          <View style={styles.groupHeader}>
            <Text style={styles.ghLabel}>Impuestos y Conceptos Regulados/Adicionales</Text>
            <Text style={styles.ghUnit}></Text>
            <Text style={styles.ghUnit}></Text>
            <Text style={styles.ghUnit}>€/día</Text>
            <Text style={styles.ghRight}></Text>
          </View>

          {taxElectric !== 0 && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>
                  Impuesto Eléctrico{' '}
                  <Text style={{ fontSize: 5.7, color: C.muted }}>
                    (Impuesto especial sobre la facturación de la electricidad suministrada (Base =
                    TPA + TEA + TER): {fmtEs(baseIEE, 2)} x {fmtEs(ieePct, 6)}%
                    {ieeReductionPct > 0 ? ` [Reducción Art. 98 LIE: ${fmtSmartEs(ieeReductionPct, 2)}%]` : ''}{' '}
                    (Mínimo de 1 €/MWh para tarifas 2.0TD y 3.0TD y 0,5 €/MWh para el resto))
                  </Text>
                </Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erRight}>{fmtEs(taxElectric, 2)}</Text>
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
              <Text style={styles.erCenter}>{fmtEs(Math.abs(bsUnitRate), 6)}</Text>
              <Text style={styles.erRight}>{fmtEs(bonoSocial, 2)}</Text>
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
                {fmtEs(Math.abs(alquilerEquipo) / Math.max(daysNum, 1), 6)}
              </Text>
              <Text style={styles.erRight}>{fmtEs(alquilerEquipo, 2)}</Text>
            </View>
          )}

          {showBolsilloSolar && (
            <View style={styles.extraRow}>
              <View style={styles.erConcept}>
                <Text>Costes de Gestión Bolsillo Solar</Text>
              </View>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}>{daysStr}</Text>
              <Text style={styles.erCenter}>{fmtEs(Math.abs(cgBsUnitRate), 6)}</Text>
              <Text style={styles.erRight}>{fmtEs(cgBolsilloSolarCost, 2)}</Text>
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
              <Text style={styles.erRight}>{fmtEs(penalizacionNoIcpCost, 2)}</Text>
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
              <Text style={styles.erRight}>{fmtEs(recargoInfAnioCost, 2)}</Text>
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
              <Text style={styles.erRight}>{fmtEs(interesesDemoraCost, 2)}</Text>
            </View>
          )}

          {repercutiblesBaseItems.map((item: any, idx: number) => (
            <View style={styles.extraRow} key={`rep-${idx}`}>
              <View style={styles.erConcept}>
                <Text>{item.description || `Concepto distribuidora (${item.code})`}</Text>
              </View>
              <Text style={styles.erCenter}>{item.units ? fmtQtyEs(item.units) : ''}</Text>
              <Text style={styles.erCenter}></Text>
              <Text style={styles.erCenter}>
                {item.unitPrice ? fmtEs(Number(item.unitPrice), 4) : ''}
              </Text>
              <Text style={styles.erRight}>{fmtEs(item.total, 2)}</Text>
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
                    {sva.dailyPrice ? fmtEs(Math.abs(Number(sva.dailyPrice)), 6) : ''}
                  </Text>
                  <Text style={styles.erRight}>{fmtEs(sva.total, 2)}</Text>
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
                    {fmtEs(Math.abs(svaCost) / Math.max(daysNum, 1), 6)}
                  </Text>
                  <Text style={styles.erRight}>{fmtEs(svaCost, 2)}</Text>
                </View>
              )}
        </View>

        {/* 7. Totales & 8. Tu Bolsillo Solar en esta Factura */}
        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totalsLeft}>
            {showBolsilloSolar && (
              <View style={styles.solarWrap}>
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
                    <Text style={styles.solarCell}>{fmtEs(bolsilloSolarSaldoInicial, 2)} €</Text>
                    <Text style={styles.solarCell}>{fmtEs(bolsilloSolarLlenado, 2)} €</Text>
                    <Text style={styles.solarCell}>{fmtEs(bolsilloSolarUso, 2)} €</Text>
                    <Text style={styles.solarCellLast}>{fmtEs(bolsilloSolarSaldoFinal, 2)} €</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={styles.totalsRight}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelGrey}>Base Imponible</Text>
              <Text style={styles.totalValGrey}>{fmtEs(subtotal1, 2)} €</Text>
            </View>

            {Array.isArray(taxBreakdown) && taxBreakdown.length > 0 ? (
              taxBreakdown.map((tb: any, idx: number) => (
                <View style={styles.totalRow} key={`tb-${idx}`}>
                  <Text style={styles.totalLabelGrey}>
                    {fmtEs(tb.rate, 2)}% {tb.taxType || taxType} (BI {fmtEs(tb.base, 2)} €)
                  </Text>
                  <Text style={styles.totalValGrey}>{fmtEs(tb.amount, 2)} €</Text>
                </View>
              ))
            ) : (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelGrey}>
                  {fmtEs(taxPercentage, 2)}% {taxType} (BI {fmtEs(subtotal1, 2)} €)
                </Text>
                <Text style={styles.totalValGrey}>{fmtEs(taxAmount, 2)} €</Text>
              </View>
            )}

            {(conceptosRepercutiblesExempt !== 0 || repercutiblesExemptItems.length > 0) && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelGrey}>Conceptos exentos (fianzas/suplidos)</Text>
                <Text style={styles.totalValGrey}>{fmtEs(conceptosRepercutiblesExempt, 2)} €</Text>
              </View>
            )}

            {bolsilloSolarUso !== 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabelGrey, { color: C.green }]}>
                  Descuento Bolsillo Solar
                </Text>
                <Text style={[styles.totalValGrey, { color: C.green }]}>
                  -{fmtEs(Math.abs(bolsilloSolarUso), 2)} €
                </Text>
              </View>
            )}

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total FACTURA</Text>
              <Text style={styles.grandTotalVal}>{fmtEs(totalAmount, 2)} €</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PÁGINA 2 — LECTURAS, HISTÓRICO, ETIQUETADO CNMC Y DERECHOS / QR CNMC
      ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.verticalLegalWrap} fixed>
          <Text style={styles.verticalLegalText}>{verticalLegalStr}</Text>
        </View>
        <View style={styles.footerWrap} fixed>
          <Text style={styles.footerText}>{footerContactLine}</Text>
          <Text
            style={styles.footerPageNum}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`}
          />
        </View>

        {/* Cabecera compacta Página 2 */}
        <View style={styles.p2HeaderBand}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {logoUrl ? (
              <Image src={logoUrl} style={{ height: 20, maxWidth: 86, objectFit: 'contain', marginRight: 8 }} />
            ) : null}
            <View>
              <Text style={{ fontSize: 8.2, fontFamily: 'Helvetica-Bold', color: C.brand }}>
                {companyName}
              </Text>
              <Text style={{ fontSize: 6.3, color: C.muted }}>
                Información al Consumidor y Etiquetado Energético
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: C.brand }}>
              Nº Factura: {invoiceNumber || 'BORRADOR'}
            </Text>
            <Text style={{ fontSize: 6.2, color: C.muted }}>CUPS: {cups}</Text>
          </View>
        </View>

        {/* 1. DATOS DE CONSUMO Y LECTURAS DE CONTADOR */}
        <View wrap={false}>
          <View style={[styles.p2SectionBar, { marginTop: 0 }]}>
            <Text style={styles.p2SectionBarText}>DATOS DE CONSUMO Y LECTURAS DE CONTADOR</Text>
            {readingProcLabel ? (
              <Text style={styles.p2SectionSubText}>Tipo de lectura: {readingProcLabel}</Text>
            ) : null}
          </View>
          <View style={styles.consTableWrap}>
            <View style={styles.consGroupHead}>
              <Text style={styles.consGroupCellFirst}>Periodo</Text>
              <Text style={styles.consGroupCellSpan3}>ENERGÍA ACTIVA (kWh)</Text>
              <Text style={styles.consGroupCellSpan3}>ENERGÍA REACTIVA (kVArh)</Text>
              <Text style={styles.consGroupCellLast}>{powerControlMode} (kW)</Text>
            </View>
            <View style={styles.consSubHead}>
              <Text style={styles.consSubCellPeriod}>Horario</Text>
              <Text style={styles.consSubCell}>
                {readingStartLabel}
                {readingProcLabel ? `\n(${readingProcLabel})` : ''}
              </Text>
              <Text style={styles.consSubCell}>
                {readingEndLabel}
                {readingProcLabel ? `\n(${readingProcLabel})` : ''}
              </Text>
              <Text style={styles.consSubCell}>Consumo</Text>
              <Text style={styles.consSubCell}>{readingStartLabel}</Text>
              <Text style={styles.consSubCell}>{readingEndLabel}</Text>
              <Text style={styles.consSubCell}>Consumo</Text>
              <Text style={styles.consSubCellLast}>
                {powerControlMode === 'ICP' ? 'ICP' : 'Maxímetro'}
              </Text>
            </View>
            {consumos.map((c, i) => (
              <View style={i % 2 === 0 ? styles.consDataRow : styles.consDataRowAlt} key={`c-${i}`}>
                <Text style={styles.consCellPeriod}>{c.p}</Text>
                <Text style={styles.consCell}>{c.actIni}</Text>
                <Text style={styles.consCell}>{c.actFin}</Text>
                <Text
                  style={[
                    styles.consCell,
                    { fontFamily: 'Helvetica-Bold', color: c.actNum > 0 ? C.accent : C.text },
                  ]}
                >
                  {c.actStr}
                </Text>
                <Text style={styles.consCell}>{c.reactIni}</Text>
                <Text style={styles.consCell}>{c.reactFin}</Text>
                <Text style={styles.consCell}>{c.reacStr}</Text>
                <Text style={styles.consCellLast}>{c.maxStr}</Text>
              </View>
            ))}
            <View
              style={[
                styles.consFooterRow,
                hasTrafoLossesDiff || max12mEntries.length > 2
                  ? { flexDirection: 'column', alignItems: 'flex-start', gap: 1.5 }
                  : {},
              ]}
            >
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 6.6, color: C.brand }}>
                Energía consumida: {fmtSmartEs(totalBilledKwh, 2)} kWh
                {hasTrafoLossesDiff
                  ? `  (Lectura contador: ${fmtSmartEs(sumMeterActKwh, 2)} kWh + coef. pérdidas transformación)`
                  : ''}
                {absExcKwh > 0 ? `   ·   Excedentes vertidos: ${totalExcKwhStr} kWh` : ''}
              </Text>
              {max12mText ? (
                <Text style={{ fontSize: 6, color: C.muted }}>
                  Pot. máx. demandadas (últimos 12 meses):{' '}
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: C.text }}>{max12mText}</Text>
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* 2. EVOLUCIÓN HISTÓRICA DE CONSUMO E INDICADORES (RD 88/2026) */}
        <View wrap={false}>
          <View style={styles.p2SectionBar}>
            <Text style={styles.p2SectionBarText}>
              EVOLUCIÓN HISTÓRICA DE CONSUMO (ÚLTIMOS 14 MESES) E INDICADORES
            </Text>
            <Text style={styles.p2SectionSubText}>kWh facturados por mes</Text>
          </View>
          <View
            style={{
              border: `0.8 solid ${C.border}`,
              borderRadius: '0 0 3 3',
              padding: '6 8',
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
            }}
          >
            {/* Gráfico vectorial de barras */}
            <View style={{ flex: 1.85 }}>
              <Svg width="100%" height="78" viewBox="0 0 340 82">
                {/* Líneas guía horizontales */}
                <Line x1="28" y1="8" x2="336" y2="8" stroke="#e2e8f0" strokeWidth="0.6" />
                <Line x1="28" y1="36" x2="336" y2="36" stroke="#e2e8f0" strokeWidth="0.6" />
                <Line x1="28" y1="64" x2="336" y2="64" stroke="#94a3b8" strokeWidth="0.8" />
                {histBars.map((bar, idx) => {
                  const slotW = 306 / Math.max(histBars.length, 1);
                  const barW = Math.min(13, slotW * 0.62);
                  const x = 30 + idx * slotW + (slotW - barW) / 2;
                  const h = Math.max(
                    bar.kwh > 0 ? 2 : 0,
                    (Math.min(bar.kwh, maxBarKwh) / maxBarKwh) * 54
                  );
                  const y = 64 - h;
                  return (
                    <Rect
                      key={`hb-${idx}`}
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={1.2}
                      fill={bar.isCurrent ? C.accent : C.navy2}
                    />
                  );
                })}
              </Svg>
              {/* Etiquetas inferiores de meses */}
              <View style={{ flexDirection: 'row', paddingLeft: 22, marginTop: -8 }}>
                {histBars.map((bar, idx) => (
                  <View key={`hl-${idx}`} style={{ flex: 1, alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 4.8,
                        color: bar.isCurrent ? C.accent : C.muted,
                        fontFamily: bar.isCurrent ? 'Helvetica-Bold' : 'Helvetica',
                      }}
                    >
                      {bar.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Panel derecho de indicadores de consumo */}
            <View
              style={{
                flex: 1,
                borderLeft: `0.6 solid ${C.border}`,
                paddingLeft: 8,
                justifyContent: 'center',
              }}
            >
              <View style={styles.infoRow}>
                <Text style={{ width: 98, fontSize: 6.1, color: C.muted }}>Consumo medio diario:</Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 6.4, fontFamily: 'Helvetica-Bold' }}>
                  {fmtEs(dailyAvgKwh, 2)} kWh/día
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={{ width: 98, fontSize: 6.1, color: C.muted }}>Gasto medio diario:</Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 6.4, fontFamily: 'Helvetica-Bold' }}>
                  {fmtEs(dailyAvgEur, 2)} €/día
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={{ width: 98, fontSize: 6.1, color: C.muted }}>Acumulado últimos 12m:</Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 6.4, fontFamily: 'Helvetica-Bold' }}>
                  {fmtEs(annualTotalKwh, 2)} kWh
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={{ width: 98, fontSize: 6.1, color: C.muted }}>Mismo mes año ant.:</Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 6.2, color: C.text }}>
                  {prevYearSameMonthKwh !== null && prevYearSameMonthKwh !== undefined
                    ? `${fmtEs(prevYearSameMonthKwh, 2)} kWh`
                    : 'Sin histórico'}
                </Text>
              </View>
              {postalCodeAvgKwh ? (
                <View style={styles.infoRow}>
                  <Text style={{ width: 98, fontSize: 6.1, color: C.muted }}>
                    Media C.P. {supplyPostalCode}:
                  </Text>
                  <Text style={{ flex: 1, textAlign: 'right', fontSize: 6.2, color: C.brand }}>
                    {fmtEs(postalCodeAvgKwh, 1)} kWh
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* 3. ETIQUETADO DE LA ELECTRICIDAD (Circular 2/2021 CNMC): ORIGEN + IMPACTO MEDIOAMBIENTAL */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 5 }} wrap={false}>
          {/* Columna izquierda: Origen de la Electricidad */}
          <View style={{ flex: 0.96 }}>
            <View style={[styles.p2SectionBar, { marginTop: 0 }]}>
              <Text style={styles.p2SectionBarText}>ORIGEN DE LA ELECTRICIDAD</Text>
            </View>
            <View
              style={{
                border: `0.8 solid ${C.border}`,
                borderRadius: '0 0 3 3',
                padding: '6 7',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 8 }}>
                <Svg width="46" height="46" viewBox="0 0 100 100">
                  <Circle cx="50" cy="50" r="46" fill={C.green} />
                  <Circle cx="50" cy="50" r="26" fill={C.white} />
                </Svg>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', color: C.green }}>
                    100,0% Energía Renovable
                  </Text>
                  <Text style={{ fontSize: 5.7, color: C.muted, marginTop: 1, lineHeight: 1.3 }}>
                    Garantías de Origen (GdO) acreditadas por la CNMC para{' '}
                    {String(companyName).replace(/\.+$/, '')}.
                  </Text>
                </View>
              </View>

              {/* Tabla oficial de 7 tecnologías vs Mix Nacional */}
              <View style={{ border: `0.5 solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', backgroundColor: C.navyLt, padding: '2 4' }}>
                  <Text style={{ flex: 1.7, fontSize: 5.6, fontFamily: 'Helvetica-Bold', color: C.brand }}>
                    Fuente energética
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 5.6,
                      fontFamily: 'Helvetica-Bold',
                      color: C.brand,
                      textAlign: 'right',
                    }}
                  >
                    Comercializadora
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 5.6,
                      fontFamily: 'Helvetica-Bold',
                      color: C.brand,
                      textAlign: 'right',
                    }}
                  >
                    Mix nacional
                  </Text>
                </View>
                {originRows.map((r: any, idx: number) => (
                  <View
                    key={`mix-${idx}`}
                    style={{
                      flexDirection: 'row',
                      padding: '1.6 4',
                      borderTop: `0.4 solid ${C.border}`,
                      backgroundColor: idx === 0 ? '#ecfdf5' : idx % 2 === 1 ? C.rowAlt : C.white,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1.7,
                        fontSize: 5.7,
                        fontFamily: idx === 0 ? 'Helvetica-Bold' : 'Helvetica',
                        color: idx === 0 ? '#065f46' : C.text,
                      }}
                    >
                      {r.source}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 5.7,
                        textAlign: 'right',
                        fontFamily: idx === 0 ? 'Helvetica-Bold' : 'Helvetica',
                        color: idx === 0 ? C.green : C.text,
                      }}
                    >
                      {fmtEs(r.companyPct, 1)}%
                    </Text>
                    <Text style={{ flex: 1, fontSize: 5.7, textAlign: 'right', color: C.muted }}>
                      {fmtEs(r.nationalPct, 1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Columna derecha: Impacto Medioambiental */}
          <View style={{ flex: 1.04 }}>
            <View style={[styles.p2SectionBarAccent, { marginTop: 0 }]}>
              <Text style={styles.p2SectionBarText}>IMPACTO MEDIOAMBIENTAL</Text>
              <Text style={styles.p2SectionSubText}>Escala CNMC A–G (Media nacional: D)</Text>
            </View>
            <View
              style={{
                border: `0.8 solid ${C.border}`,
                borderRadius: '0 0 3 3',
                padding: '5 7',
              }}
            >
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {/* Escala CO2 */}
                <View style={{ flex: 1, border: `0.5 solid ${C.border}`, borderRadius: 2, padding: 4 }}>
                  <Text
                    style={{
                      fontSize: 5.8,
                      fontFamily: 'Helvetica-Bold',
                      color: C.brand,
                      textAlign: 'center',
                      marginBottom: 2,
                    }}
                  >
                    Emisiones CO2 eq.
                  </Text>
                  <EnvironmentalScale activeLetter={environmentalImpact.co2Letter || 'A'} />
                  <View style={{ borderTop: `0.5 solid ${C.border}`, paddingTop: 2.5, marginTop: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 5.5, color: C.muted }}>Comercializadora:</Text>
                      <Text style={{ fontSize: 5.7, fontFamily: 'Helvetica-Bold', color: C.green }}>
                        {fmtSmartEs(environmentalImpact.co2CompanyGPerKwh, 1)} g/kWh
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 }}>
                      <Text style={{ fontSize: 5.5, color: C.muted }}>Media nacional:</Text>
                      <Text style={{ fontSize: 5.6, color: C.text }}>
                        {fmtSmartEs(environmentalImpact.co2NationalGPerKwh, 1)} g/kWh
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Escala Residuos Radiactivos (µg/kWh) */}
                <View style={{ flex: 1, border: `0.5 solid ${C.border}`, borderRadius: 2, padding: 4 }}>
                  <Text
                    style={{
                      fontSize: 5.8,
                      fontFamily: 'Helvetica-Bold',
                      color: C.brand,
                      textAlign: 'center',
                      marginBottom: 2,
                    }}
                  >
                    Residuos Radiactivos
                  </Text>
                  <EnvironmentalScale activeLetter={environmentalImpact.radLetter || 'A'} />
                  <View style={{ borderTop: `0.5 solid ${C.border}`, paddingTop: 2.5, marginTop: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 5.5, color: C.muted }}>Comercializadora:</Text>
                      <Text style={{ fontSize: 5.7, fontFamily: 'Helvetica-Bold', color: C.green }}>
                        {fmtSmartEs(environmentalImpact.radCompanyUgPerKwh, 1)} µg/kWh
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 }}>
                      <Text style={{ fontSize: 5.5, color: C.muted }}>Media nacional:</Text>
                      <Text style={{ fontSize: 5.6, color: C.text }}>
                        {fmtSmartEs(environmentalImpact.radNationalUgPerKwh, 1)} µg/kWh
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <Text style={{ fontSize: 5.4, color: C.muted, textAlign: 'center', marginTop: 4 }}>
                Más información sobre el origen e impacto ambiental de la electricidad en{' '}
                <Link src="https://gdo.cnmc.es/" style={{ color: C.link, textDecoration: 'underline' }}>
                  https://gdo.cnmc.es/
                </Link>
              </Text>
            </View>
          </View>
        </View>

        {/* 4. OBSERVACIONES, NORMATIVA, DERECHOS DEL CONSUMIDOR Y QR COMPARADOR CNMC */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 5 }} wrap={false}>
          <View style={{ flex: showCnmcQr && cnmcQrSvgPath ? 2.25 : 1 }}>
            <View style={[styles.p2SectionBar, { marginTop: 0 }]}>
              <Text style={styles.p2SectionBarText}>
                OBSERVACIONES, NORMATIVA Y DERECHOS DEL CONSUMIDOR
              </Text>
            </View>
            <View
              style={{
                border: `0.8 solid ${C.border}`,
                borderRadius: '0 0 3 3',
                padding: '5.5 8',
              }}
            >
              {rectifiedInfo?.legalNoteText ? (
                <View
                  style={{
                    backgroundColor: C.accentLt,
                    borderLeft: `2.5 solid ${C.accent}`,
                    padding: '3.5 6',
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 5.9, fontFamily: 'Helvetica-Bold', color: C.text, lineHeight: 1.35 }}>
                    {rectifiedInfo.legalNoteText}
                  </Text>
                </View>
              ) : null}

              {f1DistributorComments ? (
                <Text style={{ fontSize: 5.5, color: C.text, lineHeight: 1.32, marginBottom: 3 }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>Información distribuidora: </Text>
                  {f1DistributorComments}
                </Text>
              ) : null}

              <Text style={{ fontSize: 5.4, color: C.muted, lineHeight: 1.32, marginBottom: 2.5 }}>
                {boeLegalText}
              </Text>

              {indexedFormulaNote ? (
                <Text style={{ fontSize: 5.4, color: C.muted, lineHeight: 1.32, marginBottom: 2.5 }}>
                  {indexedFormulaNote}
                </Text>
              ) : null}

              <Text style={{ fontSize: 5.4, color: C.muted, lineHeight: 1.32, marginBottom: 2.5 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: C.text }}>
                  Cambio de comercializador y permanencia:{' '}
                </Text>
                El consumidor tiene derecho a cambiar gratuitamente de comercializador.{' '}
                {hasPermanence && permanenceEndDate
                  ? `Este contrato cuenta con compromiso de permanencia vigente hasta el ${fmtMadridDate(permanenceEndDate)}.`
                  : 'Este suministro no tiene penalización por permanencia vigente.'}
                {svaCost !== 0 && svaConcept
                  ? ` Servicios adicionales incluidos: ${svaConcept} (${fmtEs(svaCost, 2)} €).`
                  : ''}
              </Text>

              <Text style={{ fontSize: 5.4, color: C.muted, lineHeight: 1.32 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: C.text }}>
                  Atención al Cliente, Reclamaciones y Resolución Alternativa de Litigios:{' '}
                </Text>
                Teléfono gratuito {companyPhone !== '-' ? companyPhone : '900 525 826'} · Email{' '}
                {companyEmail !== '-' ? companyEmail : ''} · Dirección postal: {companyAddress}. Puede
                acudir gratuitamente a las Juntas Arbitrales de Consumo o al órgano competente en
                materia de energía de su Comunidad Autónoma (más información en{' '}
                <Link src="https://www.cnmc.es" style={{ color: C.link, textDecoration: 'underline' }}>
                  www.cnmc.es
                </Link>
                ).
                {is20TD
                  ? ' Los consumidores con tarifa 2.0TD y potencia <= 10 kW que cumplan los requisitos legales de vulnerabilidad pueden solicitar el Bono Social y el PVPC a través de cualquier Comercializador de Referencia (COR).'
                  : ''}
              </Text>
            </View>
          </View>

          {/* Recuadro oficial Comparador CNMC (BOE-A-2022-16989: QR mínimo 3x3 cm = 85.04 pt + enlace subrayado) */}
          {showCnmcQr && cnmcQrSvgPath && cnmcQrUrl ? (
            <View style={{ width: 146 }}>
              <View style={[styles.p2SectionBarAccent, { marginTop: 0 }]}>
                <Text style={styles.p2SectionBarText}>Comparador CNMC</Text>
              </View>
              <View
                style={{
                  border: `0.8 solid ${C.border}`,
                  borderRadius: '0 0 3 3',
                  padding: '5 6',
                  alignItems: 'center',
                }}
              >
                <View style={{ padding: 3, backgroundColor: C.white }}>
                  <Svg
                    width="88"
                    height="88"
                    viewBox={`0 0 ${cnmcQrModuleCount} ${cnmcQrModuleCount}`}
                  >
                    <Rect
                      x="0"
                      y="0"
                      width={cnmcQrModuleCount}
                      height={cnmcQrModuleCount}
                      fill={C.white}
                    />
                    <Path d={cnmcQrSvgPath} fill="#000000" />
                  </Svg>
                </View>
                <Text
                  style={{
                    fontSize: 5.1,
                    color: C.muted,
                    textAlign: 'center',
                    lineHeight: 1.28,
                    marginTop: 2,
                  }}
                >
                  En el código QR o haciendo click en el siguiente enlace (
                  <Link
                    src={cnmcQrUrl}
                    style={{ color: C.link, textDecoration: 'underline', fontFamily: 'Helvetica-Bold' }}
                  >
                    https://comparador.cnmc.gob.es
                  </Link>
                  ) se pueden consultar y comparar las distintas ofertas vigentes de las
                  comercializadoras de energía eléctrica.
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
};
