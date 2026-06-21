import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.invoice.findFirst({
    where: { invoiceNumber: 'A260614802' },
    include: { client: true, contract: true, supplyPoint: true }
  });
  if (!inv) return;
  const d: any = inv.invoiceData || {};
  const clientName = d['NOMBRE/RAZON SOCIAL'] || inv.client?.businessName || (inv.client ? `${inv.client.firstName || ''} ${inv.client.lastName || ''}`.trim() : '');
  const cif = d['CIF'] || d['NIF/CIF'] || inv.client?.vatNumber || '';
  
  const toExcelDate = (date: Date | null | undefined) => {
    if (!date) return '';
    return 25569.0 + ((date.getTime() - (date.getTimezoneOffset() * 60 * 1000)) / (1000 * 60 * 60 * 24));
  };

  const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const parsed = parseFloat(String(val).replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  const row = [
    inv.invoiceNumber,
    inv.contract?.contractCode || '',
    d['Numero factura rectificada'] || '',
    clientName,
    cif,
    inv.supplyPoint?.cups || d['CUPS'] || '',
    inv.invoiceType || 'Normal',
    toExcelDate(inv.issueDate),
    d['Procedencia Desde'] || '',
    d['Procedencia Hasta'] || inv.origin || '',
    toExcelDate(inv.billingStart),
    toExcelDate(inv.billingEnd),
    parseNum(d['Dias'] || d['Numero Dias Alquiler 1'] || 0),
    parseNum(d['P1 Potencia Contratada']),
    parseNum(d['P2 Potencia Contratada']),
    parseNum(d['P3 Potencia Contratada']),
    parseNum(d['P4 Potencia Contratada']),
    parseNum(d['P5 Potencia Contratada']),
    parseNum(d['P6 Potencia Contratada']),
    parseNum(d['P1 Potencia Max Demanda']),
    parseNum(d['P2 Potencia Max Demanda']),
    parseNum(d['P3 Potencia Max Demanda']),
    parseNum(d['P4 Potencia Max Demanda']),
    parseNum(d['P5 Potencia Max Demanda']),
    parseNum(d['P6 Potencia Max Demanda']),
    parseNum(d['P1 Energia Activa Consumida']),
    parseNum(d['P2 Energia Activa Consumida']),
    parseNum(d['P3 Energia Activa Consumida']),
    parseNum(d['P4 Energia Activa Consumida']),
    parseNum(d['P5 Energia Activa Consumida']),
    parseNum(d['P6 Energia Activa Consumida']),
    parseNum(d['Energía Total Consumida']),
    parseNum(d['P1 Energia Reactiva Consumida']),
    parseNum(d['P2 Energia Reactiva Consumida']),
    parseNum(d['P3 Energia Reactiva Consumida']),
    parseNum(d['P4 Energia Reactiva Consumida']),
    parseNum(d['P5 Energia Reactiva Consumida']),
    parseNum(d['P6 Energia Reactiva Consumida']),
    parseNum(d['Reactiva Total Consumida']),
    parseNum(d['Importe Ponderado ATR Potencia P1']),
    parseNum(d['Importe Ponderado ATR Potencia P2']),
    parseNum(d['Importe Ponderado ATR Potencia P3']),
    parseNum(d['Importe Ponderado ATR Potencia P4']),
    parseNum(d['Importe Ponderado ATR Potencia P5']),
    parseNum(d['Importe Ponderado ATR Potencia P6']),
    parseNum(d['Importe Ponderado ATR Energia P1']),
    parseNum(d['Importe Ponderado ATR Energia P2']),
    parseNum(d['Importe Ponderado ATR Energia P3']),
    parseNum(d['Importe Ponderado ATR Energia P4']),
    parseNum(d['Importe Ponderado ATR Energia P5']),
    parseNum(d['Importe Ponderado ATR Energia P6']),
    parseNum(d['Importe Potencia Factura']),
    parseNum(d['Importe Energia Factura']),
    parseNum(d['Importe Total R ATR']),
    parseNum(d['Importe Ajuste Gas']),
    parseNum(d['Importe Total Excesos ATR']),
    parseNum(d['Importe Impuesto'] || d['Base Imponible Tasa Municipal']),
    parseNum(d['Importe Bono Social']),
    parseNum(d['Alquiler Equipo de Medida']),
    parseNum(d['Subtotal 2']),
    parseNum(d['Subtotal Otros Concepto']),
    parseNum(d['Base Imponible 0']),
    parseNum(d['Base Imponible 21']),
    parseNum(d['Importe IVA']),
    inv.totalAmount || parseNum(d['Total'])
  ];
  console.log(row);
}
main().then(()=>prisma.$disconnect());
