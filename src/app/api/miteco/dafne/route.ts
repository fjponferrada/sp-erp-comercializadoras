import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import { parseMadridEndOfDay, parseMadridStartOfDay } from '@/lib/ppaEngine';
import { mergeDailyReganecuRecords } from '@/lib/reganecuServer';
import { isInternalBillingProductionEnabled } from '@/lib/services/internalInvoiceMapper';
import {
  logRegulatoryGeneration,
  requireRegulatoryContext,
} from '@/lib/regulacionServer';

const CIERRE_ORDER = ['A1', 'C1', 'A2', 'C2', 'A3', 'C3', 'A4', 'C4', 'A5', 'C5'];

function getCierreRank(cierre: string): number {
  return CIERRE_ORDER.indexOf((cierre || '').toUpperCase().trim());
}

function formatSpanishGwh(gwh: number): string {
  const safe = Math.abs(gwh) < 1e-9 ? 0 : gwh;
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(safe);
}

function formatSpanishNumber(val: number, decimals = 2): string {
  const safe = Math.abs(val) < 1e-9 ? 0 : val;
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

function normalizeSignedInvoiceMwh(
  totalMWh: number,
  totalAmount: number,
  invoiceType?: string | null,
  isAbonoStatus = false
): number {
  const t = (invoiceType || '').toUpperCase().trim();
  const isAbono =
    isAbonoStatus || t === 'A' || t === 'AR' || t === 'S' || t === 'R_NEG' || totalAmount < 0;
  if (isAbono && totalMWh > 0 && totalAmount < 0) {
    return -totalMWh;
  }
  return totalMWh;
}

function sanitizeWinAnsi(input?: string | null): string {
  if (!input) return '';
  let out = '';
  for (const ch of String(input)) {
    const cp = ch.codePointAt(0) ?? 32;
    if ((cp >= 32 && cp <= 126) || (cp >= 160 && cp <= 255)) {
      out += ch;
    } else if (ch === '–' || ch === '—') {
      out += '-';
    } else if (ch === '“' || ch === '”') {
      out += '"';
    } else if (ch === '’' || ch === '‘') {
      out += "'";
    } else if (ch === '€') {
      out += 'EUR';
    } else {
      out += ' ';
    }
  }
  return out.trim();
}

async function buildFneeDeclarationPdf(params: {
  year: number;
  companyName: string;
  cif: string;
  contactPerson: string;
  representativeNif: string;
  address: string;
  province: string;
  postalCode: string;
  email: string;
  phone: string;
  libreGwhFormatted: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 48;
  const contentW = pageWidth - marginX * 2;
  const borderGray = rgb(0.35, 0.35, 0.35);
  const headerFill = rgb(0.94, 0.94, 0.94);
  const darkText = rgb(0.08, 0.08, 0.08);
  const mutedText = rgb(0.3, 0.3, 0.3);

  const drawMinistryHeader = (page: any, pageNum: number) => {
    page.drawText('MINISTERIO PARA LA', { x: marginX, y: pageHeight - 44, size: 8.5, font: fontBold, color: darkText });
    page.drawText('TRANSICIÓN ECOLÓGICA', { x: marginX, y: pageHeight - 55, size: 8.5, font: fontBold, color: darkText });
    page.drawText('Y EL RETO DEMOGRÁFICO', { x: marginX, y: pageHeight - 66, size: 8.5, font: fontBold, color: darkText });

    const rightLines = [
      'SECRETARÍA DE ESTADO DE ENERGÍA',
      'DIRECCIÓN GENERAL DE PLANIFICACIÓN Y COORDINACIÓN ENERGÉTICA',
      'SUBDIRECCIÓN GENERAL DE EFICIENCIA Y ACCESO A LA ENERGÍA',
    ];
    rightLines.forEach((line, idx) => {
      const s = idx === 0 ? 8.5 : 7.2;
      const w = font.widthOfTextAtSize(line, s);
      page.drawText(line, {
        x: pageWidth - marginX - w,
        y: pageHeight - 44 - idx * 11,
        size: s,
        font: idx === 0 ? fontBold : font,
        color: darkText,
      });
    });

    page.drawText(String(pageNum), {
      x: pageWidth - marginX - 6,
      y: 34,
      size: 9,
      font,
      color: darkText,
    });
  };

  // ==================== PÁGINA 1 ====================
  const page1 = pdfDoc.addPage([pageWidth, pageHeight]);
  drawMinistryHeader(page1, 1);

  const title = 'MODELO DE COMUNICACIÓN RELATIVO A LAS VENTAS ENERGÉTICAS';
  const titleW = fontBold.widthOfTextAtSize(title, 11.5);
  page1.drawText(title, {
    x: (pageWidth - titleW) / 2,
    y: pageHeight - 110,
    size: 11.5,
    font: fontBold,
    color: darkText,
  });

  const col1W = 165;
  const col2W = contentW - col1W;
  let curY = pageHeight - 140;

  const drawSplitRow = (
    h: number,
    leftLines: string[],
    rightValue: string,
    subSplit?: { labelTop?: string; valTop?: string; labelBottom?: string; valBottom?: string; singleLabel?: string; singleVal?: string }
  ) => {
    const rowBottom = curY - h;
    page1.drawRectangle({
      x: marginX,
      y: rowBottom,
      width: col1W,
      height: h,
      color: headerFill,
      borderColor: borderGray,
      borderWidth: 0.7,
    });
    page1.drawRectangle({
      x: marginX + col1W,
      y: rowBottom,
      width: col2W,
      height: h,
      borderColor: borderGray,
      borderWidth: 0.7,
    });

    leftLines.forEach((ln, idx) => {
      page1.drawText(sanitizeWinAnsi(ln), {
        x: marginX + 6,
        y: curY - 14 - idx * 11,
        size: 8.2,
        font,
        color: darkText,
      });
    });

    if (subSplit) {
      const midMainW = 160;
      const subLabelW = 52;
      const subX = marginX + col1W + midMainW;
      page1.drawLine({
        start: { x: subX, y: curY },
        end: { x: subX, y: rowBottom },
        thickness: 0.7,
        color: borderGray,
      });
      page1.drawRectangle({
        x: subX,
        y: rowBottom,
        width: subLabelW,
        height: h,
        color: headerFill,
        borderColor: borderGray,
        borderWidth: 0.7,
      });

      page1.drawText(sanitizeWinAnsi(rightValue), {
        x: marginX + col1W + 7,
        y: curY - 18,
        size: 8.8,
        font,
        color: darkText,
      });

      if (subSplit.labelTop !== undefined) {
        const halfH = h / 2;
        page1.drawLine({
          start: { x: subX, y: rowBottom + halfH },
          end: { x: marginX + contentW, y: rowBottom + halfH },
          thickness: 0.7,
          color: borderGray,
        });
        page1.drawText(sanitizeWinAnsi(subSplit.labelTop), {
          x: subX + 6,
          y: curY - 17,
          size: 8.2,
          font,
          color: darkText,
        });
        page1.drawText(sanitizeWinAnsi(subSplit.valTop || ''), {
          x: subX + subLabelW + 6,
          y: curY - 17,
          size: 8.8,
          font,
          color: darkText,
        });
        page1.drawText(sanitizeWinAnsi(subSplit.labelBottom || ''), {
          x: subX + 6,
          y: rowBottom + halfH - 17,
          size: 8.2,
          font,
          color: darkText,
        });
        page1.drawText(sanitizeWinAnsi(subSplit.valBottom || ''), {
          x: subX + subLabelW + 6,
          y: rowBottom + halfH - 17,
          size: 8.8,
          font,
          color: darkText,
        });
      } else if (subSplit.singleLabel) {
        page1.drawText(sanitizeWinAnsi(subSplit.singleLabel), {
          x: subX + 6,
          y: curY - 18,
          size: 8.2,
          font,
          color: darkText,
        });
        page1.drawText(sanitizeWinAnsi(subSplit.singleVal || ''), {
          x: subX + subLabelW + 6,
          y: curY - 18,
          size: 8.8,
          font,
          color: darkText,
        });
      }
    } else {
      page1.drawText(sanitizeWinAnsi(rightValue), {
        x: marginX + col1W + 7,
        y: curY - 17,
        size: 8.8,
        font,
        color: darkText,
      });
    }

    curY = rowBottom;
  };

  drawSplitRow(
    68,
    [
      'SUJETO OBLIGADO DEL SISTEMA',
      'NACIONAL DE OBLIGACIONES DE',
      'EFICIENCIA ENERGÉTICA',
      '(Razón social de la entidad)',
    ],
    params.companyName.toUpperCase(),
    {
      labelTop: 'NIF 1',
      valTop: params.cif.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
      labelBottom: 'VAT 2',
      valBottom: '',
    }
  );

  drawSplitRow(
    42,
    ['REPRESENTANTE LEGAL', '(Nombre y apellidos)'],
    params.contactPerson.toUpperCase(),
    {
      singleLabel: 'DNI/NIE 3',
      singleVal: params.representativeNif.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
    }
  );

  drawSplitRow(32, ['DOMICILIO A EFECTOS DE', 'NOTIFICACIONES'], params.address.toUpperCase());
  drawSplitRow(28, ['PROVINCIA'], params.province.toUpperCase(), {
    singleLabel: 'CP',
    singleVal: params.postalCode,
  });
  drawSplitRow(28, ['PAÍS'], 'ESPAÑA');
  drawSplitRow(28, ['CORREO ELECTRÓNICO'], params.email.toUpperCase());
  drawSplitRow(28, ['TELÉFONO DE CONTACTO'], params.phone);

  // Fila Tipo de actividad con casillas vectoriales
  const actRowH = 62;
  const actBottom = curY - actRowH;
  page1.drawRectangle({
    x: marginX,
    y: actBottom,
    width: col1W,
    height: actRowH,
    color: headerFill,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  page1.drawRectangle({
    x: marginX + col1W,
    y: actBottom,
    width: col2W,
    height: actRowH,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  ['TIPO DE ACTIVIDAD/ACTIVIDADES', '(Seleccionar la/las que', 'corresponda/correspondan)'].forEach((ln, idx) => {
    page1.drawText(ln, {
      x: marginX + 6,
      y: curY - 16 - idx * 11,
      size: 8.2,
      font,
      color: darkText,
    });
  });

  const activities = [
    { label: 'ENERGÍA ELÉCTRICA', checked: true },
    { label: 'GLP', checked: false },
    { label: 'GAS NATURAL', checked: false },
    { label: 'PRODUCTOS PETROLÍFEROS', checked: false },
  ];
  activities.forEach((act, idx) => {
    const boxX = marginX + col1W + 8;
    const boxY = curY - 14 - idx * 13;
    page1.drawRectangle({
      x: boxX,
      y: boxY,
      width: 8,
      height: 8,
      borderColor: darkText,
      borderWidth: 0.8,
    });
    if (act.checked) {
      page1.drawLine({
        start: { x: boxX + 1.5, y: boxY + 4 },
        end: { x: boxX + 3.5, y: boxY + 1.5 },
        thickness: 1.3,
        color: darkText,
      });
      page1.drawLine({
        start: { x: boxX + 3.5, y: boxY + 1.5 },
        end: { x: boxX + 6.8, y: boxY + 6.8 },
        thickness: 1.3,
        color: darkText,
      });
    }
    page1.drawText(act.label, {
      x: boxX + 14,
      y: boxY + 1,
      size: 8.3,
      font,
      color: darkText,
    });
  });
  curY = actBottom;

  // Párrafo DECLARO
  const declY = curY - 36;
  page1.drawText('DECLARO', { x: marginX, y: declY, size: 9.5, font: fontBold, color: darkText });
  page1.drawText(
    'bajo mi responsabilidad, a efectos de cumplir lo establecido en el artículo 70.2 de la Ley',
    { x: marginX + 52, y: declY, size: 9.5, font, color: darkText }
  );
  page1.drawText(
    '18/2014, de 15 de octubre, de aprobación de medidas urgentes para el crecimiento, competitividad y',
    { x: marginX, y: declY - 15, size: 9.5, font, color: darkText }
  );
  page1.drawText(
    `eficiencia, que las ventas de energía desagregadas de la citada empresa correspondientes al año ${params.year}`,
    { x: marginX, y: declY - 30, size: 9.5, font, color: darkText }
  );
  page1.drawText('son las siguientes:', { x: marginX, y: declY - 45, size: 9.5, font, color: darkText });

  // Notas al pie página 1
  page1.drawLine({
    start: { x: marginX, y: 108 },
    end: { x: marginX + 160, y: 108 },
    thickness: 0.6,
    color: borderGray,
  });
  const footNotes = [
    '1 Obligatorio indicar NIF (Número de Identificación Fiscal) español, aunque la empresa sea extranjera.',
    '2 Sólo se indicará si la empresa dispone de VAT number (Número de IVA internacional).',
    '1, 2 y 3 Escribir NIF, VAT y DNI/NIE empleando únicamente números y letras. No utilizar puntos (.), comas (,), guiones (-) ni espacios.',
  ];
  footNotes.forEach((fn, i) => {
    page1.drawText(fn, { x: marginX, y: 94 - i * 12, size: 7.5, font, color: mutedText });
  });

  // ==================== PÁGINA 2 ====================
  const page2 = pdfDoc.addPage([pageWidth, pageHeight]);
  drawMinistryHeader(page2, 2);

  let y2 = pageHeight - 108;
  const valColW = 105;
  const leftGroupW = 115;
  const midDescW = contentW - leftGroupW - valColW;

  // Cabecera Año correspondiente
  page2.drawRectangle({
    x: marginX,
    y: y2 - 22,
    width: contentW - valColW,
    height: 22,
    color: headerFill,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  page2.drawRectangle({
    x: marginX + contentW - valColW,
    y: y2 - 22,
    width: valColW,
    height: 22,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  page2.drawText('AÑO CORRESPONDIENTE A LAS VENTAS COMUNICADAS', {
    x: marginX + 6,
    y: y2 - 14,
    size: 8.5,
    font: fontBold,
    color: darkText,
  });
  const yearW = font.widthOfTextAtSize(String(params.year), 9);
  page2.drawText(String(params.year), {
    x: marginX + contentW - valColW + (valColW - yearW) / 2,
    y: y2 - 14,
    size: 9,
    font,
    color: darkText,
  });

  y2 -= 38;

  const drawRightAlignedGwh = (p: any, valStr: string, rowBottom: number, rowH: number, bold = false) => {
    const f = bold ? fontBold : font;
    const w = f.widthOfTextAtSize(valStr, 8.8);
    p.drawText(valStr, {
      x: marginX + contentW - 8 - w,
      y: rowBottom + (rowH - 8) / 2,
      size: 8.8,
      font: f,
      color: darkText,
    });
  };

  // Bloque Energía Eléctrica (4 subfilas)
  const elecRows = [
    { lines: ['Comercialización de referencia por ventas a consumidores', 'acogidos a PVPC'], h: 28, val: '0,000000', bold: false },
    { lines: ['Comercialización de referencia por ventas a consumidores', 'acogidos a TUR'], h: 28, val: '0,000000', bold: false },
    { lines: ['Comercialización libre'], h: 22, val: params.libreGwhFormatted, bold: false },
    { lines: ['VOLUMEN TOTAL DE VENTAS ENERGÍA ELÉCTRICA'], h: 22, val: params.libreGwhFormatted, bold: true },
  ];
  const elecTotalH = elecRows.reduce((a, r) => a + r.h, 0);
  page2.drawRectangle({
    x: marginX,
    y: y2 - elecTotalH,
    width: leftGroupW,
    height: elecTotalH,
    color: headerFill,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  ['VOLUMEN DE', 'VENTAS DE', 'ENERGÍA', 'ELÉCTRICA (GWh)'].forEach((ln, idx) => {
    page2.drawText(ln, {
      x: marginX + 6,
      y: y2 - 24 - idx * 11,
      size: 8.2,
      font: fontBold,
      color: darkText,
    });
  });

  for (const r of elecRows) {
    const rb = y2 - r.h;
    page2.drawRectangle({
      x: marginX + leftGroupW,
      y: rb,
      width: midDescW,
      height: r.h,
      color: headerFill,
      borderColor: borderGray,
      borderWidth: 0.7,
    });
    page2.drawRectangle({
      x: marginX + leftGroupW + midDescW,
      y: rb,
      width: valColW,
      height: r.h,
      borderColor: borderGray,
      borderWidth: 0.7,
    });
    r.lines.forEach((ln, i) => {
      page2.drawText(ln, {
        x: marginX + leftGroupW + 6,
        y: r.lines.length > 1 ? y2 - 11 - i * 10 : rb + 7,
        size: 8.1,
        font: r.bold ? fontBold : font,
        color: darkText,
      });
    });
    drawRightAlignedGwh(page2, r.val, rb, r.h, r.bold);
    y2 = rb;
  }

  // Bloque GLP (6 subfilas a 0,000000)
  const glpRows = [
    { label: 'GLP envasado comercialización regulada', bold: false },
    { label: 'GLP envasado comercialización libre', bold: false },
    { label: 'GLP canalizado comercialización regulada', bold: false },
    { label: 'GLP canalizado comercialización libre', bold: false },
    { label: 'GLP Otros', bold: false },
    { label: 'VOLUMEN TOTAL DE VENTAS GLP', bold: true },
  ];
  const glpRowH = 21;
  const glpTotalH = glpRows.length * glpRowH;
  page2.drawRectangle({
    x: marginX,
    y: y2 - glpTotalH,
    width: leftGroupW,
    height: glpTotalH,
    color: headerFill,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  ['VOLUMEN DE', 'VENTAS DE GLP', '(GWh)'].forEach((ln, idx) => {
    page2.drawText(ln, {
      x: marginX + 6,
      y: y2 - 46 - idx * 11,
      size: 8.2,
      font: fontBold,
      color: darkText,
    });
  });
  for (const r of glpRows) {
    const rb = y2 - glpRowH;
    page2.drawRectangle({
      x: marginX + leftGroupW,
      y: rb,
      width: midDescW,
      height: glpRowH,
      color: headerFill,
      borderColor: borderGray,
      borderWidth: 0.7,
    });
    page2.drawRectangle({
      x: marginX + leftGroupW + midDescW,
      y: rb,
      width: valColW,
      height: glpRowH,
      borderColor: borderGray,
      borderWidth: 0.7,
    });
    page2.drawText(r.label, {
      x: marginX + leftGroupW + 6,
      y: rb + 6.5,
      size: 8.1,
      font: r.bold ? fontBold : font,
      color: darkText,
    });
    drawRightAlignedGwh(page2, '0,000000', rb, glpRowH, r.bold);
    y2 = rb;
  }

  // Bloque Gas Natural (PCS / PCI)
  const gasH = 42;
  const gasSubW = 125;
  const gasLeftW = contentW - valColW - gasSubW;
  const gasBottom = y2 - gasH;
  page2.drawRectangle({
    x: marginX,
    y: gasBottom,
    width: gasLeftW,
    height: gasH,
    color: headerFill,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  [
    'VOLUMEN DE VENTAS DE GAS NATURAL, BIOGÁS Y',
    'COMBUSTIBLES GASEOSOS RENOVABLES DE ORIGEN',
    'NO BIOLÓGICO (GWh)',
  ].forEach((ln, idx) => {
    page2.drawText(ln, {
      x: marginX + 6,
      y: y2 - 12 - idx * 10.5,
      size: 7.9,
      font: fontBold,
      color: darkText,
    });
  });
  ['Referido a PCS', 'Referido a PCI (PCS*0,901)'].forEach((sub, idx) => {
    const sb = y2 - (idx + 1) * 21;
    page2.drawRectangle({
      x: marginX + gasLeftW,
      y: sb,
      width: gasSubW,
      height: 21,
      color: headerFill,
      borderColor: borderGray,
      borderWidth: 0.7,
    });
    page2.drawRectangle({
      x: marginX + gasLeftW + gasSubW,
      y: sb,
      width: valColW,
      height: 21,
      borderColor: borderGray,
      borderWidth: 0.7,
    });
    page2.drawText(sub, {
      x: marginX + gasLeftW + 6,
      y: sb + 6.5,
      size: 7.8,
      font,
      color: darkText,
    });
    drawRightAlignedGwh(page2, '0,000000', sb, 21);
  });
  y2 = gasBottom;

  // Bloque Productos Petrolíferos
  const petH = 38;
  const petBottom = y2 - petH;
  page2.drawRectangle({
    x: marginX,
    y: petBottom,
    width: contentW - valColW,
    height: petH,
    color: headerFill,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  page2.drawRectangle({
    x: marginX + contentW - valColW,
    y: petBottom,
    width: valColW,
    height: petH,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  [
    'VOLUMEN DE VENTAS PRODUCTOS PETROLÍFEROS, BIOCARBURANTES,',
    'BIOLÍQUIDOS Y CARBURANTES LÍQUIDOS RENOVABLES DE ORIGEN NO',
    'BIOLÓGICO (GWh)',
  ].forEach((ln, idx) => {
    page2.drawText(ln, {
      x: marginX + 6,
      y: y2 - 11 - idx * 10,
      size: 7.9,
      font: fontBold,
      color: darkText,
    });
  });
  drawRightAlignedGwh(page2, '0,000000', petBottom, petH);
  y2 = petBottom;

  // VOLUMEN TOTAL DE VENTAS (GWh)
  const totH = 24;
  const totBottom = y2 - totH;
  page2.drawRectangle({
    x: marginX,
    y: totBottom,
    width: contentW - valColW,
    height: totH,
    color: headerFill,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  page2.drawRectangle({
    x: marginX + contentW - valColW,
    y: totBottom,
    width: valColW,
    height: totH,
    borderColor: borderGray,
    borderWidth: 0.7,
  });
  page2.drawText('VOLUMEN TOTAL DE VENTAS (GWh)', {
    x: marginX + 6,
    y: totBottom + 7.5,
    size: 8.5,
    font: fontBold,
    color: darkText,
  });
  drawRightAlignedGwh(page2, params.libreGwhFormatted, totBottom, totH, true);
  y2 = totBottom;

  // Nota y pie de firma electrónica
  page2.drawText(
    'NOTA: Unidades expresadas en GWh, utilizando una coma para separar la parte entera y la decimal. El número máximo de',
    { x: marginX, y: y2 - 18, size: 7.8, font, color: darkText }
  );
  page2.drawText('decimales a emplear es seis.', {
    x: marginX,
    y: y2 - 29,
    size: 7.8,
    font,
    color: darkText,
  });

  page2.drawText(
    'Y para que así conste, firma la presente comunicación, a la fecha indicada en la firma electrónica, en',
    { x: marginX, y: y2 - 54, size: 9, font, color: darkText }
  );
  page2.drawText(`${sanitizeWinAnsi(params.province || 'ESPAÑA').toUpperCase()}.`, {
    x: marginX,
    y: y2 - 68,
    size: 9,
    font: fontBold,
    color: darkText,
  });

  page2.drawText('Fdo.:', { x: 280, y: 155, size: 9, font, color: darkText });
  page2.drawText('(Firma electrónica con certificado de representante de la entidad)', {
    x: 280,
    y: 140,
    size: 7.8,
    font,
    color: mutedText,
  });

  page2.drawText(
    'DIRIGIDO A LA DIRECCIÓN GENERAL DE PLANIFICACIÓN Y COORDINACIÓN ENERGÉTICA DEL',
    { x: marginX, y: 98, size: 8.5, font: fontBold, color: darkText }
  );
  page2.drawText(
    'MINISTERIO PARA LA TRANSICIÓN ECOLÓGICA Y EL RETO DEMOGRÁFICO',
    { x: marginX, y: 85, size: 8.5, font: fontBold, color: darkText }
  );

  return pdfDoc.save();
}

export async function GET(req: Request) {
  try {
    const authRes = await requireRegulatoryContext();
    if (!authRes.ok) return authRes.response;
    const { ctx } = authRes;

    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get('year');
    const format = (searchParams.get('format') || 'json').toLowerCase();
    const source = (searchParams.get('source') || 'invoiced').toLowerCase();
    const overrideGwhParam = searchParams.get('overrideGwh');
    const repNifParam = searchParams.get('repNif') || '';

    if (!yearStr || !/^\d{4}$/.test(yearStr)) {
      return NextResponse.json({ error: 'Falta o es inválido el parámetro year (AAAA)' }, { status: 400 });
    }

    const targetYear = parseInt(yearStr, 10);
    const startDate = parseMadridStartOfDay(`${targetYear}-01-01`);
    const endDate = parseMadridEndOfDay(`${targetYear}-12-31`);
    const startDateSql = new Date(`${targetYear}-01-01T00:00:00.000Z`);
    const endDateSql = new Date(`${targetYear}-12-31T23:59:59.999Z`);

    // 1. Consulta paralela de:
    //    a) Facturas definitivas e internas emitidas de la comercializadora activa (Company)
    //    b) Curvas CCH (LoadCurve) filtradas estrictamente por comercializadora activa y contratos vigentes en la fecha de la curva
    //    c) Liquidación SIMEL/REGANECU en Barras de Central para contraste de auditoría
    const [invoices, internalInvoices, cchRows, reganecuRecords, pendingSummaries] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          OR: [
            { companyId: ctx.companyId },
            { companyId: null, client: { brand: { companyId: ctx.companyId } } },
          ],
          billingEnd: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          invoiceNumber: true,
          f1InvoiceId: true,
          invoiceType: true,
          totalAmount: true,
          totalMWh: true,
          supplyPoint: { select: { cups: true } },
        },
      }),
      isInternalBillingProductionEnabled()
        ? prisma.internalInvoice.findMany({
            where: {
              OR: [
                { companyId: ctx.companyId },
                { companyId: null, client: { brand: { companyId: ctx.companyId } } },
              ],
              status: { in: ['EMITIDA', 'ABONO'] },
              hidden: false,
              billingEnd: { gte: startDate, lte: endDate },
            },
            select: {
              id: true,
              invoiceNumber: true,
              f1InvoiceId: true,
              status: true,
              invoiceType: true,
              totalAmount: true,
              totalMWh: true,
              supplyPoint: { select: { cups: true } },
            },
          })
        : Promise.resolve([]),
      prisma.$queryRaw<Array<{ total_kwh: number | null; cups_count: bigint | number | null }>>`
        WITH active_contracts AS (
          SELECT
            LEFT(sp.cups, 20) AS cups20,
            c."activationDate"::date AS start_d,
            COALESCE(c."terminationDate"::date, '9999-12-31'::date) AS end_d
          FROM "Contract" c
          INNER JOIN "SupplyPoint" sp ON sp.id = c."supplyPointId"
          INNER JOIN "Client" cl ON cl.id = sp."clientId"
          INNER JOIN "Brand" b ON b.id = cl."brandId"
          WHERE b."companyId" = ${ctx.companyId}
            AND c.status NOT IN ('BORRADOR', 'CANCELADO', 'RECHAZADO', 'ANULADO')
            AND c."activationDate" IS NOT NULL
            AND c."activationDate"::date <= ${endDateSql}::date
            AND (c."terminationDate" IS NULL OR c."terminationDate"::date >= ${startDateSql}::date)
        ),
        matched_curves AS (
          SELECT lc.cups, lc.readings
          FROM "LoadCurve" lc
          WHERE lc.date >= ${startDateSql}::date
            AND lc.date <= ${endDateSql}::date
            AND lc.type = 'CONSUMPTION'
            AND EXISTS (
              SELECT 1
              FROM active_contracts ac
              WHERE ac.cups20 = LEFT(lc.cups, 20)
                AND lc.date >= ac.start_d
                AND lc.date <= ac.end_d
            )
        )
        SELECT
          COALESCE(SUM((SELECT SUM(v) FROM unnest(mc.readings) AS v)), 0)::float8 AS total_kwh,
          COUNT(DISTINCT LEFT(mc.cups, 20)) AS cups_count
        FROM matched_curves mc
      `,
      prisma.reganecuData.findMany({
        where: {
          companyId: ctx.companyId,
          date: { gte: startDateSql, lte: endDateSql },
          total: true,
          matricial: false,
        },
      }),
      prisma.pendingEnergySummary.findMany({
        where: {
          companyId: ctx.companyId,
          month: { startsWith: `${targetYear}-` },
        },
      }),
    ]);

    // Consolidar energía facturada (en punto de suministro) sin duplicar F1
    const seenF1Ids = new Set<string>();
    const seenInvNumbers = new Set<string>();
    const invoicedCups = new Set<string>();
    let invoicedMwh = 0;
    let consolidatedInvoicesCount = 0;

    for (const inv of invoices) {
      if (inv.f1InvoiceId) seenF1Ids.add(inv.f1InvoiceId);
      if (inv.invoiceNumber) seenInvNumbers.add(inv.invoiceNumber);
      const signedMwh = normalizeSignedInvoiceMwh(inv.totalMWh || 0, inv.totalAmount || 0, inv.invoiceType, false);
      invoicedMwh += signedMwh;
      consolidatedInvoicesCount++;
      if (inv.supplyPoint?.cups) invoicedCups.add(inv.supplyPoint.cups.slice(0, 20).toUpperCase());
    }

    for (const iInv of internalInvoices) {
      if (iInv.f1InvoiceId && seenF1Ids.has(iInv.f1InvoiceId)) continue;
      if (iInv.invoiceNumber && seenInvNumbers.has(iInv.invoiceNumber)) continue;
      const signedMwh = normalizeSignedInvoiceMwh(
        iInv.totalMWh || 0,
        iInv.totalAmount || 0,
        iInv.invoiceType,
        iInv.status === 'ABONO'
      );
      invoicedMwh += signedMwh;
      consolidatedInvoicesCount++;
      if (iInv.supplyPoint?.cups) invoicedCups.add(iInv.supplyPoint.cups.slice(0, 20).toUpperCase());
    }

    const invoicedKwh = invoicedMwh * 1000;
    const invoicedGwh = invoicedMwh / 1000;

    const cchKwh = cchRows[0]?.total_kwh ? Number(cchRows[0].total_kwh) : 0;
    const cchCupsCount = cchRows[0]?.cups_count ? Number(cchRows[0].cups_count) : 0;
    const cchMwh = cchKwh / 1000;
    const cchGwh = cchMwh / 1000;

    // Consolidar REGANECU en Barras de Central (referencia de contraste con pérdidas de red)
    const reganecuByMonth = new Map<string, { rank: number; recs: any[] }>();
    for (const rec of reganecuRecords) {
      const mKey = rec.date.toISOString().slice(0, 7);
      const rank = getCierreRank(rec.cierre);
      const curr = reganecuByMonth.get(mKey);
      if (!curr || rank > curr.rank) {
        reganecuByMonth.set(mKey, { rank, recs: [rec] });
      } else if (rank === curr.rank) {
        curr.recs.push(rec);
      }
    }
    const pendingByMonth = new Map<string, number>();
    for (const ps of pendingSummaries) {
      pendingByMonth.set(ps.month, ps.liquidatedMwh > 0 ? ps.liquidatedMwh : ps.estimatedBcMwh);
    }

    let reganecuBcMwh = 0;
    let monthsReganecu = 0;
    for (let m = 1; m <= 12; m++) {
      const mKey = `${targetYear}-${String(m).padStart(2, '0')}`;
      const regMonth = reganecuByMonth.get(mKey);
      if (regMonth && regMonth.recs.length > 0) {
        const mergedDays = mergeDailyReganecuRecords(regMonth.recs, false);
        let monthCadMwh = 0;
        for (const dayRec of mergedDays) {
          const jData = (dayRec.jsonData || {}) as Record<string, any>;
          const cad = jData['CAD'];
          if (cad) monthCadMwh += (cad.energyVentas || 0) + (cad.energyCompras || 0);
        }
        if (monthCadMwh > 0) {
          reganecuBcMwh += monthCadMwh;
          monthsReganecu++;
          continue;
        }
      }
      const fallbackMwh = pendingByMonth.get(mKey);
      if (fallbackMwh && fallbackMwh > 0) {
        reganecuBcMwh += fallbackMwh;
        monthsReganecu++;
      }
    }
    const reganecuBcGwh = reganecuBcMwh / 1000;

    // Selección de criterio principal (Ventas facturadas en punto de suministro es el criterio contable/ESCILA estándar;
    // si aún no hay facturación volcada pero sí CCH vigentes, sugerir CCH con aviso claro)
    const primarySource: 'invoiced' | 'cch' =
      source === 'cch' ? 'cch' : invoicedMwh > 0 || cchMwh === 0 ? 'invoiced' : 'cch';
    const selectedGwhAuto = primarySource === 'cch' ? cchGwh : invoicedGwh;

    let effectiveGwh = selectedGwhAuto;
    if (overrideGwhParam !== null && overrideGwhParam !== undefined && overrideGwhParam.trim() !== '') {
      const parsedOverride = Number(overrideGwhParam.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(parsedOverride) && parsedOverride >= 0) {
        effectiveGwh = parsedOverride;
      }
    }

    const warnings: string[] = [];
    if (invoicedMwh > 0 && cchMwh > 0) {
      const diffPct = Math.abs(invoicedMwh - cchMwh) / Math.max(invoicedMwh, cchMwh) * 100;
      if (diffPct > 8) {
        warnings.push(
          `Existe una desviación del ${diffPct.toFixed(1)}% entre la energía facturada (${formatSpanishGwh(invoicedGwh)} GWh) y las curvas CCH de contratos vigentes (${formatSpanishGwh(cchGwh)} GWh). Verifique si faltan facturas ATR de cierre de diciembre o curvas horarias por descargar.`
        );
      }
    } else if (invoicedMwh === 0 && cchMwh > 0) {
      warnings.push(
        `No constan facturas emitidas con fin de periodo en ${targetYear} para ${ctx.company.name}; se muestra como referencia el volumen de curvas CCH de contratos vigentes (${formatSpanishGwh(cchGwh)} GWh).`
      );
    } else if (invoicedMwh === 0 && cchMwh === 0) {
      warnings.push(`No constan ventas facturadas ni curvas CCH de contratos vigentes en ${targetYear} para ${ctx.company.name}.`);
    }

    if (format === 'pdf') {
      const companySlug = (ctx.company.codigo || ctx.company.name || 'EMPRESA')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 20)
        .toUpperCase();

      const filename = `DEC_RESP_FNEE_${companySlug}_${targetYear}.pdf`;

      // Intentar extraer código postal y provincia de la dirección fiscal de Company si constan
      const rawAddr = ctx.company.address || '';
      const cpMatch = rawAddr.match(/\b(\d{5})\b/);
      const postalCode = cpMatch ? cpMatch[1] : '';
      let province = '';
      if (rawAddr.toUpperCase().includes('CORDOBA') || rawAddr.toUpperCase().includes('CÓRDOBA') || postalCode.startsWith('14')) {
        province = 'CÓRDOBA';
      } else if (rawAddr.toUpperCase().includes('MADRID') || postalCode.startsWith('28')) {
        province = 'MADRID';
      }

      const formattedGwh = formatSpanishGwh(effectiveGwh);
      const pdfBytes = await buildFneeDeclarationPdf({
        year: targetYear,
        companyName: ctx.company.name,
        cif: ctx.company.cif,
        contactPerson: ctx.company.contactPerson || '',
        representativeNif: repNifParam,
        address: rawAddr,
        province,
        postalCode,
        email: ctx.company.email || '',
        phone: ctx.company.phone || '',
        libreGwhFormatted: formattedGwh,
      });

      await logRegulatoryGeneration({
        companyId: ctx.companyId,
        category: 'MITECO',
        reportType: 'DAFNE',
        period: String(targetYear),
        version: null,
        filename,
        generatedBy: ctx.userName,
        summary: {
          year: targetYear,
          source: primarySource,
          declaredGwh: Number(effectiveGwh.toFixed(6)),
          declaredGwhFormatted: formattedGwh,
          invoicedGwh: Number(invoicedGwh.toFixed(6)),
          cchGwh: Number(cchGwh.toFixed(6)),
        },
      });

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const selectedKwh = effectiveGwh * 1_000_000;

    return NextResponse.json({
      company: {
        name: ctx.company.name,
        cif: ctx.company.cif,
        contactPerson: ctx.company.contactPerson,
        email: ctx.company.email,
        phone: ctx.company.phone,
        address: ctx.company.address,
      },
      year: targetYear,
      recommendedSource: primarySource,
      recommendedGwh: Number(effectiveGwh.toFixed(6)),
      formattedGwh: formatSpanishGwh(effectiveGwh),
      // Campo retrocompatible acotado a la comercializadora activa
      totalKwh: Number(selectedKwh.toFixed(2)),
      metrics: {
        invoiced: {
          kwh: Number(invoicedKwh.toFixed(2)),
          mwh: Number(invoicedMwh.toFixed(2)),
          gwh: Number(invoicedGwh.toFixed(6)),
          formattedGwh: formatSpanishGwh(invoicedGwh),
          formattedMwh: formatSpanishNumber(invoicedMwh, 2),
          invoicesCount: consolidatedInvoicesCount,
          cupsCount: invoicedCups.size,
        },
        cchActiveContracts: {
          kwh: Number(cchKwh.toFixed(2)),
          mwh: Number(cchMwh.toFixed(2)),
          gwh: Number(cchGwh.toFixed(6)),
          formattedGwh: formatSpanishGwh(cchGwh),
          formattedMwh: formatSpanishNumber(cchMwh, 2),
          cupsCount: cchCupsCount,
        },
        reganecuBc: {
          mwh: Number(reganecuBcMwh.toFixed(2)),
          gwh: Number(reganecuBcGwh.toFixed(6)),
          formattedGwh: formatSpanishGwh(reganecuBcGwh),
          formattedMwh: formatSpanishNumber(reganecuBcMwh, 2),
          monthsCovered: monthsReganecu,
        },
      },
      warnings,
    });
  } catch (error: any) {
    console.error('DAFNE error:', error);
    return NextResponse.json({ error: error.message || 'Error interno consultando DAFNE/FNEE' }, { status: 500 });
  }
}
